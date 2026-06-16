import type { ReactNode } from "react";
import s from "./docs.module.css";
import { DocsNav } from "./DocsNav";

export const metadata = {
  title: "Docs — Agenomy",
  description: "Documentation for Agenomy: the on-chain layer for autonomous AI workers.",
};

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <a href="/" className="brand">
            <span className="mark" aria-hidden="true">
              <img src="/logo.png" alt="" width={30} height={30} />
            </span>
            Agenomy
          </a>
          <nav className="nav-links">
            <a href="/agents">agents</a>
            <a href="/create">create</a>
            <a href="/docs">docs</a>
            <a href="https://github.com/agenomylayer/agenomy" target="_blank" rel="noreferrer">github</a>
            <a href="https://x.com/agenomylayer" target="_blank" rel="noreferrer">x</a>
          </nav>
          <div className="nav-right">
            <span className="pill">
              <span className="dot" aria-hidden="true"></span>Base · Sepolia
            </span>
            <a href="/create" className="btn btn-primary">Create agent</a>
          </div>
          <a href="/create" className="btn btn-primary nav-toggle">Create</a>
        </div>
      </header>

      <div className={s.shell}>
        <DocsNav />
        <main className={s.content}>{children}</main>
      </div>
    </>
  );
}
