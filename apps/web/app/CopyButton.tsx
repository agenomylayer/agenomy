"use client";

import { useState } from "react";

/**
 * Tiny copy-to-clipboard button used in the quickstart + CTA install rows.
 * Mirrors the inline data-copy handler from the approved landing mockup.
 */
export function CopyButton({
  text,
  label = "Copy command",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch {
          /* noop */
        }
        document.body.removeChild(ta);
      }
    } catch {
      /* noop */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button type="button" onClick={handleCopy} aria-label={label}>
      <svg viewBox="0 0 24 24" fill="none">
        <rect
          x="9"
          y="9"
          width="11"
          height="11"
          rx="2.2"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M5 15V5a2 2 0 0 1 2-2h10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="copy-label">{copied ? "copied" : "copy"}</span>
    </button>
  );
}
