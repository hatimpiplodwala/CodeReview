"use client";
import Link from "next/link";
import { useQuery } from "@apollo/client";
import { PR_LIST } from "../../lib/gql";


export default function PRListPage() {
  const { data, loading, error } = useQuery(PR_LIST);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pull Requests</h1>
        <Link href="/prs/new" className="px-3 py-2 rounded bg-black text-white">New PR</Link>
      </div>

      {loading && <p>Loading…</p>}
      {error && <p className="text-red-600">Error: {error.message}</p>}

      <ul className="divide-y">
        {data?.prs?.map((pr: any) => (
          <li key={pr.id} className="py-3">
            <Link href={`/prs/${pr.id}`} className="hover:underline">
              <span className="font-semibold">{pr.repo} #{pr.number}</span> — {pr.title}
              <span className="ml-2 text-sm text-gray-500">by {pr.author}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
