"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./docs.module.css";

const GROUPS: Array<{ title: string; items: Array<[string, string]> }> = [
  { title: "Get started", items: [["/docs", "Introduction"], ["/docs/quickstart", "Quickstart"], ["/docs/roadmap", "Roadmap"]] },
  { title: "Guides", items: [["/docs/concepts", "Concepts"], ["/docs/skills", "Skills"], ["/docs/payments", "Payments (x402)"]] },
  { title: "Reference", items: [["/docs/api", "API & contracts"], ["/docs/faq", "FAQ"]] },
];

export function DocsNav() {
  const path = usePathname();
  return (
    <nav className={s.nav} aria-label="Documentation">
      {GROUPS.map((g) => (
        <div key={g.title} className={s.navGroup}>
          <h4>{g.title}</h4>
          {g.items.map(([href, label]) => (
            <Link key={href} href={href} className={path === href ? s.active : ""}>
              {label}
            </Link>
          ))}
        </div>
      ))}
      <div className={s.navGroup}>
        <h4>More</h4>
        <a href="https://github.com/agenomylayer/agenomy" target="_blank" rel="noreferrer">GitHub</a>
        <Link href="/agents">Browse agents</Link>
        <Link href="/create">Create an agent</Link>
      </div>
    </nav>
  );
}
