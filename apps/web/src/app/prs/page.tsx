"use client";
import Link from "next/link";
import { useQuery } from "@apollo/client";
import { PR_LIST } from "../../lib/gql";

export default function PRListPage() {
  const { data, loading, error } = useQuery(PR_LIST, { fetchPolicy: "cache-and-network" });
  if (loading && !data) return <div>Loading…</div>;
  if (error) return <div className="text-[color:var(--error)]">Error: {error.message}</div>;

  const prs = data?.prs ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[color:var(--fg)]">Pull Requests</h1>
        <Link href="/prs/new" className="btn-primary">New PR</Link>
      </div>

      {prs.length === 0 ? (
        <div className="card text-[color:var(--fg-muted)]">No PRs yet. Create your first one.</div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-4">
          {prs.map((pr: any) => (
            <li key={pr.id} className="card card-hover">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-[color:var(--fg)]">
                    {pr.repo} <span className="text-[color:var(--fg-muted)]">#{pr.number}</span>
                  </div>
                  <div className="text-sm text-[color:var(--fg)]/85">{pr.title}</div>
                  <div className="mt-1 text-xs text-[color:var(--fg-muted)]">by {pr.author}</div>
                </div>
                <span
                  className={[
                    "text-[11px] px-2 py-1 rounded border",
                    pr.state === "open"
                      ? "border-emerald-700 bg-emerald-900/40 text-emerald-200"
                      : "border-[color:var(--border)] bg-[color:var(--bg)] text-[color:var(--fg-muted)]",
                  ].join(" ")}
                >
                  {pr.state ?? "open"}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-[color:var(--fg-muted)]">
                  head <span className="text-[color:var(--fg)]/70">{pr.headSha?.slice(0, 7) || "—"}</span> • base{" "}
                  <span className="text-[color:var(--fg)]/70">{pr.baseSha?.slice(0, 7) || "—"}</span>
                </div>
                <Link href={`/prs/${pr.id}`} className="text-sm underline text-[color:var(--fg)]">
                  Open
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
