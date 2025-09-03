import "dotenv/config";
import { Worker, QueueEvents } from "bullmq";
import { db } from "@repo/db";
import OpenAI from "openai";

const connection = { url: process.env.REDIS_URL || "redis://127.0.0.1:6379" };
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const events = new QueueEvents("review", { connection });
events.on("waiting", ({ jobId }) => console.log("[review] waiting", jobId));
events.on("active", ({ jobId }) => console.log("[review] active", jobId));
events.on("completed", ({ jobId }) => console.log("[review] completed", jobId));
events.on("failed", ({ jobId, failedReason }) => console.error("[review] failed", jobId, failedReason));

type JobData = { prId: string; runId: string };

function buildPrompt(filePath: string, patch: string) {
  return `
You are an expert code reviewer. Analyze the UNIFIED DIFF PATCH below and produce JSON with suggestions.
Focus on correctness, security, performance, style, and maintainability. If no issues, return an empty array [].

Return JSON only with this array shape:
[
  {
    "filePath": "string",
    "startLine": 0,
    "endLine": 0,
    "severity": "info|warn|error|security",
    "message": "human-friendly explanation",
    "fixPatch": "optional unified diff snippet applying a fix"
  }
]

Constraints:
- startLine/endLine refer to the *new* file's line numbers where possible.
- If line numbers are unclear, best-effort estimate and set start=end.
- Keep messages concise and actionable.

FILE: ${filePath}
PATCH:
${patch}
`.trim();
}

function safeParseArray(jsonText: string): any[] {
  try {
    const cleaned = jsonText.replace(/```json/gi, "```").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// --- AI call with fallback ---
async function getSuggestionsFromAI(prompt: string): Promise<{ arr: any[]; usedMock: boolean }> {
  // 1) try gpt-4o-mini
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });
    const text = r.choices?.[0]?.message?.content ?? "[]";
    const arr = safeParseArray(text);
    if (arr.length || text.trim() === "[]") return { arr, usedMock: false };
  } catch (e: any) {
    console.warn("[ai] 4o-mini failed:", e?.status || e?.code || e?.message);
  }

  // 2) fallback to gpt-3.5-turbo
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });
    const text = r.choices?.[0]?.message?.content ?? "[]";
    const arr = safeParseArray(text);
    if (arr.length || text.trim() === "[]") return { arr, usedMock: false };
  } catch (e: any) {
    console.warn("[ai] 3.5-turbo failed:", e?.status || e?.code || e?.message);
  }

  // 3) last resort: mock
  return {
    usedMock: true,
    arr: [
      {
        filePath: "unknown",
        startLine: 1,
        endLine: 1,
        severity: "info",
        message: "Mock suggestion (AI unavailable): add a brief comment describing this change.",
        fixPatch: null,
      },
    ],
  };
}

new Worker<JobData>(
  "review",
  async (job) => {
    const { prId, runId } = job.data;
    console.log("[review] process start", { prId, runId });

    try {
      await db.reviewRun.update({
        where: { id: runId },
        data: { status: "running", startedAt: new Date() },
      });

      const pr = await db.pullRequest.findUnique({
        where: { id: prId },
        include: { files: true },
      });
      if (!pr) throw new Error("PR not found");

      const suggestionsAll: any[] = [];
      let anyMock = false;

      for (const file of pr.files) {
        if (!file.patch?.trim()) continue;

        const prompt = buildPrompt(file.path, file.patch);
        const { arr, usedMock } = await getSuggestionsFromAI(prompt);
        if (usedMock) anyMock = true;

        // Ensure at least one per-file suggestion if we're mocking
        const results = (arr && arr.length > 0)
          ? arr
          : (usedMock ? [{
              filePath: file.path,           // 👈 key: attach to this file
              startLine: 1,
              endLine: 1,
              severity: "info",
              message: "Mock: add a brief comment explaining this change.",
              fixPatch: null,
            }] : []);

        for (const s of results) {
          if (!s?.message) continue;
          suggestionsAll.push({
            runId,
            filePath: s.filePath || file.path,
            startLine: Number.isFinite(+s.startLine) ? +s.startLine : 1,
            endLine: Number.isFinite(+s.endLine)
              ? +s.endLine
              : Number.isFinite(+s.startLine) ? +s.startLine : 1,
            message: String(s.message).slice(0, 1000),
            fixPatch: s.fixPatch ? String(s.fixPatch).slice(0, 5000) : null,
            severity: ["info","warn","error","security"].includes(s.severity) ? s.severity : "info",
          });
        }
      }
      if (suggestionsAll.length) {
        await db.suggestion.createMany({
          data: suggestionsAll.map(({ fixPatch, ...rest }) => ({ ...rest, fixPatch: fixPatch ?? undefined })),
        });
      }

      await db.reviewRun.update({
        where: { id: runId },
        data: {
          status: "completed",
          completedAt: new Date(),
          provider: anyMock ? "mock" : "openai", // 👈 use the run-level flag
        },
      });

      console.log("[review] process done", { prId, runId, count: suggestionsAll.length });
      return { count: suggestionsAll.length };
    } catch (err: any) {
      console.error("[review] process error", err?.message || err);
      await db.reviewRun.update({ where: { id: runId }, data: { status: "failed" } });
      throw err;
    }
  },
  { connection, concurrency: 1 }
);


console.log("Worker ready.");
