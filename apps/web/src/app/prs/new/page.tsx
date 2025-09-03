"use client";
import { useState } from "react";
import { useMutation } from "@apollo/client";
import { CREATE_PR } from "../../../lib/gql";
import { useRouter } from "next/navigation";

type FileRow = { path: string; patch: string };

export default function NewPRPage() {
  const router = useRouter();
  const [repo, setRepo] = useState("owner/repo");
  const [number, setNumber] = useState<number>(1);
  const [title, setTitle] = useState("My demo PR");
  const [author, setAuthor] = useState("you");
  const [headSha, setHeadSha] = useState("HEAD123");
  const [baseSha, setBaseSha] = useState("BASE123");
  const [files, setFiles] = useState<FileRow[]>([
    { path: "src/example.ts", patch: "@@ -1,3 +1,5 @@\n+const x = 1;\n export function hello(){\n   return 'hi'\n }\n+console.log(x);\n" },
  ]);

  const [createPR, { loading, error }] = useMutation(CREATE_PR);

  function updateFile(i: number, key: keyof FileRow, val: string) {
    setFiles(prev => prev.map((f, idx) => (idx === i ? { ...f, [key]: val } : f)));
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
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create PR</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col">Repo
            <input className="border rounded p-2" value={repo} onChange={e => setRepo(e.target.value)} />
          </label>
          <label className="flex flex-col">PR Number
            <input className="border rounded p-2" type="number" value={number} onChange={e => setNumber(parseInt(e.target.value || "0"))} />
          </label>
          <label className="flex flex-col">Title
            <input className="border rounded p-2" value={title} onChange={e => setTitle(e.target.value)} />
          </label>
          <label className="flex flex-col">Author
            <input className="border rounded p-2" value={author} onChange={e => setAuthor(e.target.value)} />
          </label>
          <label className="flex flex-col">Head SHA
            <input className="border rounded p-2" value={headSha} onChange={e => setHeadSha(e.target.value)} />
          </label>
          <label className="flex flex-col">Base SHA
            <input className="border rounded p-2" value={baseSha} onChange={e => setBaseSha(e.target.value)} />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Files</h2>
            <button type="button" className="px-2 py-1 border rounded" onClick={() => setFiles(f => [...f, { path: "", patch: "" }])}>
              + Add file
            </button>
          </div>

          {files.map((f, i) => (
            <div key={i} className="border rounded p-3 space-y-2">
              <input className="border rounded p-2 w-full" placeholder="path e.g. src/index.ts"
                     value={f.path} onChange={e => updateFile(i, "path", e.target.value)} />
              <textarea className="border rounded p-2 w-full h-40 font-mono" placeholder="unified diff patch"
                        value={f.patch} onChange={e => updateFile(i, "patch", e.target.value)} />
              <div className="text-right">
                <button type="button" className="text-sm text-red-600"
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-red-600">Error: {error.message}</p>}
        <button disabled={loading} className="px-4 py-2 rounded bg-black text-white">
          {loading ? "Creating…" : "Create PR"}
        </button>
      </form>
    </main>
  );
}
