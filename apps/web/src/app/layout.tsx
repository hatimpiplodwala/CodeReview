import "./globals.css";
import Link from "next/link";
import ApolloProviderWrapper from "./apollo-provider";

export const metadata = {
  title: "AI Code Review",
  description: "AI-assisted code review sandbox",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <ApolloProviderWrapper>
          <header className="sticky top-0 z-40 border-b border-[color:var(--border)] bg-[color:var(--bg)]/80 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
              <Link href="/" className="font-semibold tracking-tight text-[color:var(--fg)]">
                <span>AI</span><span className="text-[color:var(--fg-muted)]">CodeReview</span>
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link href="/prs" className="text-[color:var(--fg)] hover:underline">PRs</Link>
                <Link href="/prs/new" className="text-[color:var(--fg)] hover:underline">Create PR</Link>
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

          <footer className="border-t border-[color:var(--border)] mt-10">
            <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-[color:var(--fg-muted)]">
              © {new Date().getFullYear()} AI Code Review • Demo build
            </div>
          </footer>
        </ApolloProviderWrapper>
      </body>
    </html>
  );
}
