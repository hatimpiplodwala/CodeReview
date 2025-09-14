"use client";
import { useState } from "react";
import { useMutation } from "@apollo/client";
import { CREATE_PR } from "../../../lib/gql";
import { useRouter } from "next/navigation";

type FileRow = { path: string; patch: string };

const demo1 = {
  path: "src/example.ts",
  patch: [
    "@@ -1,3 +1,7 @@",
    "+const token = (window as any).location.hash;",
    "+eval('console.log(token)')",
    " export function hello(){",
    "   return 'hi'",
    " }",
  ].join("\n"),
};

const demo2 = {
  path: "web/index.html",
  patch: [
    "@@ -5,8 +5,10 @@",
    " <body>",
    "-  <div id=\"app\"></div>",
    "+  <div id=\"app\"></div>",
    "+  <script>document.getElementById('app').innerHTML = location.search;</script>",
    " </body>",
  ].join("\n"),
};

export default function NewPRPage() {
  const router = useRouter();
  const [repo, setRepo] = useState("owner/repo");
  const [number, setNumber] = useState<number>(Math.floor(Math.random() * 1000));
  const [title, setTitle] = useState("Demo PR");
  const [author, setAuthor] = useState("you");
  const [headSha, setHeadSha] = useState("HEAD123");
  const [baseSha, setBaseSha] = useState("BASE123");
  const [files, setFiles] = useState<FileRow[]>([demo1]);

  const [createPR, { loading, error }] = useMutation(CREATE_PR);

  function updateFile(i: number, key: keyof FileRow, val: string) {
    setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { data } = await createPR({
      variables: {
        input: { repo, number: Number(number), title, author, headSha, baseSha, files },
      },
    });
    router.push(`/prs/${data.createPR.id}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[color:var(--fg)]">Create PR</h1>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm">
            <div className="mb-1 text-[color:var(--fg)]/90">Repo</div>
            <input className="input" value={repo} onChange={(e) => setRepo(e.target.value)} />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-[color:var(--fg)]/90">PR Number</div>
            <input
              type="number"
              className="input"
              value={number}
              onChange={(e) => setNumber(parseInt(e.target.value || "0"))}
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-[color:var(--fg)]/90">Title</div>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-[color:var(--fg)]/90">Author</div>
            <input className="input" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-[color:var(--fg)]/90">Head SHA</div>
            <input className="input" value={headSha} onChange={(e) => setHeadSha(e.target.value)} />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-[color:var(--fg)]/90">Base SHA</div>
            <input className="input" value={baseSha} onChange={(e) => setBaseSha(e.target.value)} />
          </label>
        </div>

        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Files</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setFiles((f) => [...f, { path: "", patch: "" }])}
              >
                + Add file
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => setFiles([demo1, demo2])}
              >
                Load demo
              </button>
            </div>
          </div>

          {files.map((f, i) => (
            <div key={i} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--bg)] p-3 space-y-2">
              <input
                className="input"
                placeholder="path e.g. src/index.ts"
                value={f.path}
                onChange={(e) => updateFile(i, "path", e.target.value)}
              />
              <textarea
                className="input h-40 font-mono text-sm"
                placeholder="unified diff patch"
                value={f.patch}
                onChange={(e) => updateFile(i, "patch", e.target.value)}
              />
              <div className="text-right">
                <button
                  type="button"
                  className="text-xs text-red-300 hover:underline"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-[color:var(--error)]">Error: {error.message}</p>}

        <div className="flex gap-2">
          <button disabled={loading} className="btn-primary">
            {loading ? "Creating…" : "Create PR"}
          </button>
          <button type="button" onClick={() => setFiles([demo1])} className="btn-secondary">
            Reset form
          </button>
        </div>
      </form>
    </div>
  );
}
