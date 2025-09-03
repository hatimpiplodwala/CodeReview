"use client";
import { useQuery, useMutation } from "@apollo/client";
import { PR_DETAIL, RUN_ANALYSIS } from "../../../lib/gql";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PRDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, refetch, startPolling, stopPolling } = useQuery(PR_DETAIL, {
    variables: { id: params.id },
    pollInterval: 0, // we'll control polling manually
  });
  const [runAnalysis, { loading: queuing }] = useMutation(RUN_ANALYSIS);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!data?.pr?.reviewRuns?.length) return;
    const latest = data.pr.reviewRuns[0]; // newest-first from API include/order
    if (latest.status === "queued" || latest.status === "running") {
      startPolling(2000);
    } else {
      stopPolling();
    }
  }, [data, startPolling, stopPolling]);

  if (loading) return <main className="p-6">Loading…</main>;
  if (error) return <main className="p-6 text-red-600">Error: {error.message}</main>;
  if (!data?.pr) return <main className="p-6">Not found</main>;

  const pr = data.pr;
  const latest = pr.reviewRuns?.[0];
  const isBusy = latest && (latest.status === "queued" || latest.status === "running");

  const allSuggestions = (pr.reviewRuns?.flatMap((r: any) => r.suggestions) || []) as any[];

  async function handleRun() {
    try {
      await runAnalysis({ variables: { prId: pr.id } });
      setFlash("Queued analysis. This page will refresh automatically.");
      startPolling(2000);
    } catch (e: any) {
      setFlash("Failed to queue analysis: " + e.message);
    }
  }

  const byFile = new Map<string, any[]>();
  for (const f of pr.files) byFile.set(f.path, []);
  const unscoped: any[] = [];

  for (const s of allSuggestions) {
    if (s.filePath && byFile.has(s.filePath)) {
      byFile.get(s.filePath)!.push(s);
    } else {
      unscoped.push(s); // filePath "unknown" or not matching a file
    }
  }

  return (
    <main className="p-6 space-y-5">
      {/* header & button unchanged */}
  
      {flash && <div className="p-3 rounded bg-yellow-100 text-yellow-900">{flash}</div>}
  
      <div className="space-y-6">
        {pr.files.map((f: any) => {
          const fileSuggs = byFile.get(f.path) || [];
          return (
            <div key={f.id} className="border rounded p-4">
              <div className="font-semibold mb-2">{f.path}</div>
  
              {/* Diff viewer */}
              <pre className="bg-gray-900 p-3 rounded-lg overflow-x-auto text-sm font-mono">
                {f.patch.split("\n").map((line: string, i: number) => {
                  const color =
                    line.startsWith("+") ? "text-green-400" :
                    line.startsWith("-") ? "text-red-400" :
                    "text-gray-200";
                  return <div key={i} className={color}>{line}</div>;
                })}
              </pre>
  
              {/* Suggestions for this file */}
              {fileSuggs.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-sm font-semibold">AI Suggestions</div>
                  <ul className="space-y-2">
                    {fileSuggs.map((s: any) => (
                      <li key={s.id} className="border rounded p-2 bg-gray-50">
                        <div className="text-xs text-gray-500">
                          L{s.startLine}{s.endLine && s.endLine !== s.startLine ? `–${s.endLine}` : ""} • {s.severity}
                        </div>
                        <div>{s.message}</div>
                        {s.fixPatch && (
                          <pre className="mt-2 bg-gray-900 text-gray-200 p-2 rounded overflow-x-auto text-xs font-mono">
                            {s.fixPatch}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
  
        {/* Unscoped suggestions once at the bottom */}
        {unscoped.length > 0 && (
          <div className="border rounded p-4">
            <div className="font-semibold mb-2">General Suggestions</div>
            <ul className="space-y-2">
              {unscoped.map((s: any) => (
                <li key={s.id} className="border rounded p-2 bg-gray-50">
                  <div className="text-xs text-gray-500">
                    {s.filePath || "unknown"} • L{s.startLine}
                    {s.endLine && s.endLine !== s.startLine ? `–${s.endLine}` : ""} • {s.severity}
                  </div>
                  <div>{s.message}</div>
                  {s.fixPatch && (
                    <pre className="mt-2 bg-gray-900 text-gray-200 p-2 rounded overflow-x-auto text-xs font-mono">
                      {s.fixPatch}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
