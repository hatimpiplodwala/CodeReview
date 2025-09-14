import "dotenv/config";
import { Worker } from "bullmq";
import { db } from "@repo/db";

/** === Env / Config === */
type JobData = { prId: string; runId: string; model?: string };

const connection = { url: process.env.REDIS_URL || "redis://127.0.0.1:6379" };

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/+$/, "");
const DEFAULT_MODEL   = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
const FALLBACKS       = (process.env.OLLAMA_FALLBACKS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const AI_TIMEOUT_PRIMARY_MS = Number(process.env.AI_TIMEOUT_MS || 90000);
const AI_TIMEOUT_RETRY_MS   = Math.max(30000, Math.floor(AI_TIMEOUT_PRIMARY_MS * 0.66));
const AI_MAX_TOKENS         = Number(process.env.AI_MAX_TOKENS || 512);
const AI_TEMPERATURE        = Number(process.env.AI_TEMPERATURE || 0.1);

const MAX_PATCH_LINES       = Number(process.env.MAX_PATCH_LINES || 800);
const MAX_PATCH_CHARS       = Number(process.env.MAX_PATCH_CHARS || 40000);
const MAX_HUNKS_PER_FILE    = Number(process.env.MAX_HUNKS_PER_FILE || 6);

/** === Helpers === */

function clampPatch(patch: string) {
  const lines = patch.split("\n");
  const clipped = lines.slice(0, MAX_PATCH_LINES).join("\n");
  return clipped.slice(0, MAX_PATCH_CHARS);
}

function splitIntoHunks(patch: string): string[] {
  const lines = (patch || "").split("\n");
  const hunks: string[] = [];
  let cur: string[] = [];
  for (const l of lines) {
    if (l.startsWith("@@")) {
      if (cur.length) hunks.push(cur.join("\n"));
      cur = [l];
    } else {
      cur.push(l);
    }
  }
  if (cur.length) hunks.push(cur.join("\n"));
  return hunks;
}

function buildPrompt(filePath: string, patch: string) {
  return [
    "You are a senior engineer. Review the unified diff PATCH and return ONLY a JSON array (no prose).",
    "Array schema:",
    "[",
    '  {"filePath":"<string>","startLine":<int>,"endLine":<int>,"severity":"info|warn|error|security","message":"<string>","fixPatch":"<unified diff or omit>"}',
    "]",
    "- Comment only on potential issues or clear improvements.",
    "- Lines refer to NEW file numbering. If unclear, estimate and set startLine=endLine.",
    "- Keep messages concise and actionable.",
    `FILE: ${filePath}`,
    "PATCH:",
    patch,
  ].join("\n");
}

function safeParseArray(text: string): any[] {
  try {
    const cleaned = String(text || "").replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ruleBasedHints(path: string, patch: string) {
  const lower = (patch || "").toLowerCase();
  const hints: any[] = [];
  if (/\beval\s*\(/i.test(patch)) {
    hints.push({
      filePath: path,
      startLine: 1,
      endLine: 1,
      severity: "security",
      message: "Avoid eval(): security and performance risk. Use safe parsing or explicit functions.",
      fixPatch: null,
    });
  }
  if (lower.includes("innerhtml")) {
    hints.push({
      filePath: path,
      startLine: 1,
      endLine: 1,
      severity: "security",
      message: "Direct innerHTML can enable XSS. Prefer textContent or sanitize inputs.",
      fixPatch: null,
    });
  }
  if (/console\.log\(/i.test(patch) && /return /.test(patch)) {
    hints.push({
      filePath: path,
      startLine: 1,
      endLine: 1,
      severity: "info",
      message: "Remove stray console.log in production code.",
      fixPatch: null,
    });
  }
  return hints;
}

/** Call Ollama /api/generate with staged timeouts and keep_alive to reduce cold-start cost. */
async function callOllamaGenerate({
  model,
  prompt,
  timeoutMs,
  maxTokens,
  temperature,
}: {
  model: string;
  prompt: string;
  timeoutMs: number;
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        options: {
          num_ctx: 8192,
          num_predict: maxTokens,
          temperature,
          keep_alive: "5m",
        },
        stream: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`ollama ${res.status}: ${body.slice(0, 200)}`);
    }
    const json: any = await res.json();
    return String(json?.response ?? "[]");
  } finally {
    clearTimeout(to);
  }
}

/** Try preferred model, then fallbacks, with staged timeouts. */
async function getSuggestionsFromAI(prompt: string, preferred?: string) {
  const candidates = [preferred || DEFAULT_MODEL, ...FALLBACKS];
  for (const m of candidates) {
    try {
      const t0 = Date.now();
      let text = await callOllamaGenerate({
        model: m,
        prompt,
        timeoutMs: AI_TIMEOUT_PRIMARY_MS,
        maxTokens: AI_MAX_TOKENS,
        temperature: AI_TEMPERATURE,
      });
      let arr = safeParseArray(text);
      if (!arr.length) {
        // quick retry with smaller budget
        text = await callOllamaGenerate({
          model: m,
          prompt,
          timeoutMs: AI_TIMEOUT_RETRY_MS,
          maxTokens: Math.max(128, Math.floor(AI_MAX_TOKENS / 2)),
          temperature: AI_TEMPERATURE,
        });
        arr = safeParseArray(text);
      }
      if (arr.length) {
        console.log("[ai] model=%s ms=%d items=%d", m, Date.now() - t0, arr.length);
        return { arr, provider: `ollama:${m}` };
      }
      console.warn("[ai] empty json from model %s", m);
    } catch (e: any) {
      console.warn("[ai] %s failed: %s", m, e?.message || e);
    }
  }
  return { arr: [], provider: "mock" };
}

/** === Worker === */
new Worker<JobData>(
  "review",
  async (job) => {
    const { prId, runId, model } = job.data;
    const chosenModel = model || DEFAULT_MODEL;

    console.log("[review] process start", { prId, runId, chosenModel });

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
      const providersSeen: string[] = [];

      for (const file of pr.files) {
        if (!file.patch?.trim()) continue;

        try {
          const patch = clampPatch(file.patch);
          const hunks = splitIntoHunks(patch).slice(0, MAX_HUNKS_PER_FILE);

          let fileSuggestions: any[] = [];

          for (let i = 0; i < hunks.length; i++) {
            const hunkPrompt = buildPrompt(`${file.path} (hunk ${i + 1}/${hunks.length})`, hunks[i]);
            const { arr, provider } = await getSuggestionsFromAI(hunkPrompt, chosenModel);
            if (provider) providersSeen.push(provider);

            const normalized = (arr ?? []).map((s: any) => ({
              ...s,
              filePath: !s?.filePath || s.filePath === "unknown" ? file.path : s.filePath,
              severity: ["info", "warn", "error", "security"].includes(s?.severity) ? s.severity : "info",
              startLine: Number.isFinite(+s?.startLine) ? +s.startLine : 1,
              endLine: Number.isFinite(+s?.endLine)
                ? +s.endLine
                : Number.isFinite(+s?.startLine)
                ? +s.startLine
                : 1,
              message: String(s?.message ?? "").slice(0, 1000),
              fixPatch: s?.fixPatch ? String(s.fixPatch).slice(0, 5000) : null,
            }));

            fileSuggestions.push(...normalized);
          }

          if (fileSuggestions.length === 0) {
            const hints = ruleBasedHints(file.path, patch);
            if (hints.length) fileSuggestions = hints;
          }

          if (fileSuggestions.length === 0) {
            fileSuggestions = [
              {
                filePath: file.path,
                startLine: 1,
                endLine: 1,
                severity: "info",
                message: "No clear issues found. Consider adding/expanding unit tests for this change.",
                fixPatch: null,
              },
            ];
          }

          suggestionsAll.push(
            ...fileSuggestions.map((r) => ({
              runId,
              filePath: r.filePath,
              startLine: r.startLine,
              endLine: r.endLine,
              message: r.message,
              fixPatch: r.fixPatch ?? undefined,
              severity: r.severity,
            }))
          );
          console.log("[review] analyzed", file.path, "suggestions:", fileSuggestions.length);
        } catch (e: any) {
          console.warn("[review] file failed", file.path, e?.message || e);
          suggestionsAll.push({
            runId,
            filePath: file.path,
            startLine: 1,
            endLine: 1,
            message: "Mock suggestion (AI unavailable): add a brief comment describing this change.",
            fixPatch: undefined,
            severity: "info",
          });
          providersSeen.push("mock");
        }
      }

      if (suggestionsAll.length === 0) {
        suggestionsAll.push({
          runId,
          filePath: "unknown",
          startLine: 1,
          endLine: 1,
          message: "No files with diffs were analyzed. Provide a unified diff patch to get suggestions.",
          fixPatch: undefined,
          severity: "info",
        });
        providersSeen.push("mock");
      }

      if (suggestionsAll.length) {
        await db.suggestion.createMany({
          data: suggestionsAll.map(({ fixPatch, ...rest }) => ({ ...rest, fixPatch: fixPatch ?? undefined })),
        });
      }

      const providerFinal = providersSeen.find((p) => p.startsWith("ollama:")) || "mock";
      await db.reviewRun.update({
        where: { id: runId },
        data: { status: "completed", completedAt: new Date(), provider: providerFinal },
      });

      console.log("[review] process done", {
        prId,
        runId,
        count: suggestionsAll.length,
        provider: providerFinal,
      });
      return { count: suggestionsAll.length };
    } catch (err: any) {
      console.error("[review] process error", err?.message || err);
      await db.reviewRun.update({ where: { id: runId }, data: { status: "failed" } });
      throw err;
    }
  },
  { connection, concurrency: 1 }
);
