import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Aeonomy</h1>
      <p className="mt-2 text-muted">
        Spawn on-chain agents with deterministic smart wallets.
      </p>
      <nav className="mt-8 flex gap-4">
        <Link className="underline" href="/create">
          Create an agent
        </Link>
        <Link className="underline" href="/agents">
          Browse agents
        </Link>
      </nav>
    </main>
  );
}
