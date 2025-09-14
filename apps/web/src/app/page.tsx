import Link from "next/link";

export default function HomePage() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="col-span-2 card p-8 bg-[color:var(--bg-light)]">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[color:var(--fg)]">
          Ship better code with AI-assisted reviews
        </h1>
        <p className="mt-3 text-[color:var(--fg-muted)] max-w-2xl">
          Paste a PR diff, run analysis locally via Ollama, and get actionable suggestions for
          security, performance, style, and maintainability.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/prs/new" className="btn-primary">Create PR</Link>
          <Link href="/prs" className="btn-secondary">View PRs</Link>
        </div>
      </section>

      <div className="card">
        <h2 className="font-semibold">How it works</h2>
        <ol className="mt-3 space-y-2 text-sm text-[color:var(--fg)]/80 list-decimal list-inside">
          <li>Create a PR with one or more unified diff patches.</li>
          <li>Run analysis — the worker sends diffs to your local model via Ollama.</li>
          <li>Review suggestions inline and copy/download fix patches.</li>
        </ol>
      </div>

      <div className="card">
        <h2 className="font-semibold">Tips</h2>
        <ul className="mt-3 space-y-2 text-sm text-[color:var(--fg)]/80 list-disc list-inside">
          <li>Try “JS: eval & innerHTML” patterns to see security suggestions.</li>
          <li>Use smaller models (e.g. <code>mistral</code>) for speed.</li>
          <li>Truncate huge patches to keep analysis snappy.</li>
        </ul>
      </div>
    </div>
  );
}
