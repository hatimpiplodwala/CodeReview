"use client";
import { useQuery, useMutation } from "@apollo/client";
import { PR_DETAIL, RUN_ANALYSIS } from "../../../lib/gql";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { mapNewFileLines } from "../../../lib/diff";

type Sev = "info" | "warn" | "error" | "security";
type Suggestion = {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  severity: Sev;
  message: string;
  fixPatch?: string | null;
};
type FileEntry = { id: string; path: string; patch: string };

const sevColors: Record<Sev, string> = {
  info: "bg-blue-500/20 text-blue-200",
  warn: "bg-yellow-500/20 text-yellow-200",
  error: "bg-red-500/20 text-red-200",
  security: "bg-purple-500/20 text-purple-200",
};

export default function PRDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data, loading, error, startPolling, stopPolling } = useQuery(PR_DETAIL, {
    variables: { id: params.id },
    pollInterval: 0,
  });

  const [runAnalysis, { loading: queuing }] = useMutation(RUN_ANALYSIS);
  const [flash, setFlash] = useState<string | null>(null);
  const [sevFilter, setSevFilter] = useState<Sev | null>(null);
  const [previewFix, setPreviewFix] = useState<{ suggestion: Suggestion; file: FileEntry | null } | null>(null);

  // Match the worker defaults/fallbacks
  const [model, setModel] = useState("qwen2.5-coder:7b");

  const pr = data?.pr ?? null;
  const latest = pr?.reviewRuns?.[0] ?? null;
  const isBusy = !!(latest && (latest.status === "queued" || latest.status === "running"));

  useEffect(() => {
    const latestRun = data?.pr?.reviewRuns?.[0];
    if (latestRun && (latestRun.status === "queued" || latestRun.status === "running")) startPolling(2000);
    else stopPolling();
  }, [data, startPolling, stopPolling]);

  const allSuggestions: Suggestion[] = (pr?.reviewRuns?.flatMap((r: any) => r.suggestions) || []) as Suggestion[];
  const prFiles: FileEntry[] = (pr?.files || []) as FileEntry[];

  const { byFile, unscoped } = useMemo(() => {
    const map = new Map<string, Suggestion[]>();
    for (const f of prFiles) map.set(f.path, []);
    const un: Suggestion[] = [];
    for (const s of allSuggestions) {
      if (s.filePath && map.has(s.filePath)) map.get(s.filePath)!.push(s);
      else un.push(s);
    }
    return { byFile: map, unscoped: un };
  }, [prFiles, allSuggestions]);

  const fileLineMaps = useMemo(() => {
    const rec: Record<string, number[]> = {};
    for (const f of prFiles) rec[f.path] = mapNewFileLines(f.patch || "");
    return rec;
  }, [prFiles]);

  const filtered = (arr: Suggestion[]) => (sevFilter ? arr.filter((s) => s.severity === sevFilter) : arr);

  if (loading) return <main>Loading…</main>;
  if (error) return <main className="text-[color:var(--error)]">Error: {error.message}</main>;
  if (!pr) return <main>Not found</main>;

  async function handleRun() {
    try {
      await runAnalysis({ variables: { prId: pr.id, model } });
      setFlash("Queued analysis. This page will refresh automatically.");
      startPolling(2000);
    } catch (e: any) {
      setFlash("Failed to queue analysis: " + e.message);
    }
  }

  function getPatchBody(patch: string) {
    return patch
      .split("\n")
      .filter((l) => !l.startsWith("---") && !l.startsWith("+++") && !l.startsWith("@@"))
      .join("\n")
      .trim();
  }

  function FixPreview({ file, suggestion }: { file: FileEntry; suggestion: Suggestion }) {
    const currentBody = getPatchBody(file.patch || "");
    const fixBody = getPatchBody(suggestion.fixPatch || "");
    const renderLines = (text: string) =>
      text.split("\n").map((line, i) => {
        const color = line.startsWith("+") ? "text-green-400" : line.startsWith("-") ? "text-red-400" : "text-[color:var(--fg)]";
        return (
          <div key={i} className={color}>
            {line}
          </div>
        );
      });
    return (
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card overflow-hidden p-0">
          <div className="px-3 py-2 text-xs border-b border-[color:var(--border)] text-[color:var(--fg-muted)]">Current patch snippet</div>
          <pre className="bg-[color:var(--bg)] p-3 text-sm font-mono overflow-auto min-h-[220px]">
            {currentBody ? renderLines(currentBody) : <span className="text-[color:var(--fg-muted)]">No patch content.</span>}
          </pre>
        </div>
        <div className="card overflow-hidden p-0">
          <div className="px-3 py-2 text-xs border-b border-[color:var(--border)] text-[color:var(--fg-muted)]">Suggested fix (patch)</div>
          <pre className="bg-[color:var(--bg)] p-3 text-sm font-mono overflow-auto min-h-[220px]">
            {fixBody ? renderLines(fixBody) : <span className="text-[color:var(--fg-muted)]">No fixPatch provided.</span>}
          </pre>
        </div>
      </div>
    );
  }

  function downloadPatchFile(s: Suggestion) {
    const blob = new Blob([s.fixPatch || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = (s.filePath?.split("/").pop() || "fix").replace(/[^\w.-]+/g, "_");
    a.href = url;
    a.download = `${base}.patch`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <button className="text-sm underline" onClick={() => router.push("/prs")}>
          ← Back to list
        </button>
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-xs rounded border border-[color:var(--border)] bg-[color:var(--bg)] px-2 py-1"
            title="Model"
          >
            <option value="qwen2.5-coder:7b">qwen2.5-coder:7b</option>
            <option value="deepseek-coder-v2:16b-lite">deepseek-coder-v2:16b-lite</option>
            <option value="mistral-nemo:12b-instruct">mistral-nemo:12b-instruct</option>
          </select>

          {(["info", "warn", "error", "security"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSevFilter((prev) => (prev === s ? null : s))}
              className={[
                "text-xs px-2 py-1 rounded border",
                sevFilter === s ? "bg-[color:var(--bg-lighter)] border-[color:var(--border)]" : "bg-[color:var(--bg)] border-[color:var(--border)]",
              ].join(" ")}
              title={`Show only ${s}`}
            >
              {s}
            </button>
          ))}

          {sevFilter && (
            <button onClick={() => setSevFilter(null)} className="text-xs px-2 py-1 rounded border bg-[color:var(--bg)] border-[color:var(--border)]">
              clear
            </button>
          )}

          <button onClick={handleRun} disabled={queuing || isBusy} className="btn-primary">
            {queuing ? "Queuing…" : isBusy ? "Running…" : "Run Analysis"}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[color:var(--fg)]">
          {pr.repo} <span className="text-[color:var(--fg-muted)]">#{pr.number}</span>
        </h1>
        <p className="text-[color:var(--fg-muted)]">
          {pr.title} — by {pr.author}
        </p>
        <p className="text-xs text-[color:var(--fg-muted)]">
          head: {pr.headSha} | base: {pr.baseSha} | state: {pr.state}
          {latest?.provider && !isBusy && (
            <span className="ml-2 text-xs px-2 py-1 rounded bg-[color:var(--bg-lighter)] text-[color:var(--fg)]">{latest.provider}</span>
          )}
          {isBusy && (
            <span className="inline-flex items-center gap-1 ml-2 text-xs px-2 py-1 rounded bg-[color:var(--bg-lighter)] text-[color:var(--fg)]">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> running…
            </span>
          )}
        </p>
      </div>

      {flash && <div className="card text-[color:var(--warn)] bg-[color:var(--bg)]">{flash}</div>}

      <div className="space-y-6">
        {prFiles.map((f) => {
          const fileSuggs = filtered(byFile.get(f.path) || []);
          const newFileLineMap = fileLineMaps[f.path] || [];
          return (
            <div key={f.id} className="card">
              <div className="font-semibold mb-2 text-[color:var(--fg)]">{f.path}</div>

              <pre className="bg-[color:var(--bg)] p-3 rounded-lg overflow-x-auto text-sm font-mono">
                {f.patch.split("\n").map((line: string, i: number) => {
                  const nline = newFileLineMap[i]; // 0 = not in new file
                  const isInSuggestion = (byFile.get(f.path) || []).some(
                    (s) => nline && nline >= s.startLine && nline <= (s.endLine || s.startLine)
                  );
                  const baseColor = line.startsWith("+")
                    ? "text-green-300"
                    : line.startsWith("-")
                    ? "text-red-300"
                    : "text-[color:var(--fg)]";
                  const bg = isInSuggestion ? "bg-[color:var(--bg-lighter)]/60" : "";
                  return (
                    <div key={i} className={`${baseColor} ${bg}`}>
                      {line}
                    </div>
                  );
                })}
              </pre>

              {fileSuggs.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-semibold">AI Suggestions</div>
                  <ul className="space-y-3">
                    {fileSuggs.map((s) => {
                      const chip = sevColors[s.severity] ?? sevColors.info;
                      const fileForFix = prFiles.find((ff) => ff.path === s.filePath) || null;
                      return (
                        <li key={s.id} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)]">
                          <div className="p-3">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs px-2 py-1 rounded ${chip}`}>{s.severity}</span>
                              <span className="text-xs text-[color:var(--fg-muted)]">
                                L{s.startLine}
                                {s.endLine && s.endLine !== s.startLine ? `–${s.endLine}` : ""}
                              </span>
                            </div>
                            <p className="mt-2 text-sm">{s.message}</p>
                            {s.fixPatch && (
                              <div className="mt-3 flex items-center gap-2">
                                <button onClick={() => setPreviewFix({ suggestion: s, file: fileForFix })} className="btn-secondary text-xs">
                                  Preview & copy fix
                                </button>
                                <button onClick={() => navigator.clipboard?.writeText(s.fixPatch || "")} className="btn-secondary text-xs">
                                  Copy patch
                                </button>
                                <button onClick={() => downloadPatchFile(s)} className="btn-secondary text-xs">
                                  Download .patch
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          );
        })}

        {filtered(unscoped).length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">General Suggestions</div>
              <span className="text-xs text-[color:var(--fg-muted)]">{filtered(unscoped).length}</span>
            </div>
            <ul className="space-y-3">
              {filtered(unscoped).map((s) => {
                const chip = sevColors[s.severity] ?? sevColors.info;
                const fileForFix = prFiles.find((ff) => ff.path === s.filePath) || null;
                return (
                  <li key={s.id} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)]">
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={`px-2 py-1 rounded ${chip}`}>{s.severity}</span>
                          <span className="text-[color:var(--fg-muted)]">{s.filePath && s.filePath !== "unknown" ? s.filePath : "unknown"}</span>
                        </div>
                        <span className="text-xs text-[color:var(--fg-muted)]">
                          L{s.startLine}
                          {s.endLine && s.endLine !== s.startLine ? `–${s.endLine}` : ""}
                        </span>
                      </div>

                      <p className="mt-2 text-sm">{s.message}</p>

                      {s.fixPatch && (
                        <div className="mt-3 flex items-center gap-2">
                          <button onClick={() => setPreviewFix({ suggestion: s, file: fileForFix })} className="btn-secondary text-xs">
                            Preview & copy fix
                          </button>
                          <button onClick={() => navigator.clipboard?.writeText(s.fixPatch || "")} className="btn-secondary text-xs">
                            Copy patch
                          </button>
                          <button onClick={() => downloadPatchFile(s)} className="btn-secondary text-xs">
                            Download .patch
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {previewFix && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-5xl rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-light)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[color:var(--border)] p-3">
              <h2 className="text-sm font-semibold">Suggested Fix</h2>
              <button onClick={() => setPreviewFix(null)} className="text-sm text-[color:var(--fg-muted)] hover:underline">
                ✕
              </button>
            </div>
            {previewFix.file ? (
              <div className="p-4">
                <FixPreview file={previewFix.file} suggestion={previewFix.suggestion} />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button onClick={() => navigator.clipboard?.writeText(previewFix.suggestion.fixPatch || "")} className="btn-secondary text-xs">
                    Copy patch
                  </button>
                  <button onClick={() => downloadPatchFile(previewFix.suggestion)} className="btn-secondary text-xs">
                    Download .patch
                  </button>
                  <button onClick={() => setPreviewFix(null)} className="btn-primary text-xs">
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="card">Couldn’t locate the file in this PR. You can still copy or download the patch.</div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button onClick={() => navigator.clipboard?.writeText(previewFix.suggestion.fixPatch || "")} className="btn-secondary text-xs">
                    Copy patch
                  </button>
                  <button onClick={() => downloadPatchFile(previewFix.suggestion)} className="btn-secondary text-xs">
                    Download .patch
                  </button>
                  <button onClick={() => setPreviewFix(null)} className="btn-primary text-xs">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
