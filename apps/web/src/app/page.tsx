"use client";

import { gql, useQuery } from "@apollo/client";
import Editor from "@monaco-editor/react";

const HELLO = gql`query { hello }`;

export default function Home() {
  const { data, loading, error } = useQuery(HELLO);

  return (
    <main className="p-6 space-y-6">
      <div className="space-x-3">
        <a className="underline" href="/prs">View PRs</a>
        <a className="underline" href="/prs/new">New PR</a>
      </div>

      <h1 className="text-2xl font-bold">AI Code Review — Web</h1>

      <section className="p-4 rounded border">
        <h2 className="font-semibold mb-2">GraphQL connectivity</h2>
        {loading && <p>Loading…</p>}
        {error && <p className="text-red-600">Error: {error.message}</p>}
        {data && <p>API says: <span className="font-mono">{data.hello}</span></p>}
      </section>

      <section className="p-4 rounded border">
        <h2 className="font-semibold mb-2">Monaco editor (demo)</h2>
        <Editor
          height="50vh"
          defaultLanguage="typescript"
          theme="vs-dark"
          defaultValue={`// Monaco is working.\nfunction greet(name: string){\n  return \`Hello, \${name}\`;\n}`}
          options={{ readOnly: false, minimap: { enabled: false } }}
        />
      </section>
    </main>
  );
}
