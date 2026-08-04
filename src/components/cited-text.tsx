"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ── Token types ─────────────────────────────────────────────────────────────

type Token =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "newline" }
  | { kind: "citation"; file: string; section: string };

// ── Tokenizer: handles markdown bold/headings + [file.md -> Section] ────────

function tokenizeRichText(input: string): Token[] {
  const raw: Token[] = [];
  const lines = input.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Block headings: # text
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const clean = headingMatch[1].replace(/\*\*([^*]+)\*\*/g, "$1").trim();
      raw.push({ kind: "heading", text: clean });
    } else {
      // Inline: **bold** and [file.md -> Section]
      // Create a fresh regex each iteration to avoid shared lastIndex state
      const INLINE =
        /\*\*([^*\n]+?)\*\*|\[([^\]]+?\.(?:md|pdf|txt))\s*->\s*([^\]]+?)\]/g;
      let lastIdx = 0;
      let m: RegExpExecArray | null;
      while ((m = INLINE.exec(line)) !== null) {
        if (m.index > lastIdx) {
          raw.push({ kind: "text", text: line.slice(lastIdx, m.index) });
        }
        if (m[1] !== undefined) {
          raw.push({ kind: "bold", text: m[1] });
        } else {
          raw.push({ kind: "citation", file: m[2].trim(), section: m[3].trim() });
        }
        lastIdx = m.index + m[0].length;
      }
      if (lastIdx < line.length) {
        raw.push({ kind: "text", text: line.slice(lastIdx) });
      }
    }

    if (i < lines.length - 1) raw.push({ kind: "newline" });
  }

  // Collapse consecutive newlines into one
  const tokens: Token[] = [];
  for (const tok of raw) {
    if (tok.kind === "newline" && tokens[tokens.length - 1]?.kind === "newline") continue;
    tokens.push(tok);
  }
  return tokens;
}

// ── Citation badge ──────────────────────────────────────────────────────────

function CitationBadge({
  index,
  file,
  section,
}: {
  index: number;
  file: string;
  section: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Source ${index}: ${section}`}
        className={cn(
          "align-super ml-0.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full border px-1 text-[10px] font-semibold leading-none transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          open
            ? "border-primary/40 bg-primary/15 text-primary"
            : "border-border bg-muted text-muted-foreground/90 hover:bg-accent hover:text-accent-foreground"
        )}
      >
        {index}
      </button>
      {open && (
        <span className="absolute bottom-full left-0 z-50 mb-1.5 w-52 rounded-xl border bg-card p-2.5 shadow-lg text-xs whitespace-normal pointer-events-none">
          <span className="block font-semibold text-foreground leading-snug">{section}</span>
          <span className="block text-muted-foreground mt-0.5 font-mono text-[10px] break-all">{file}</span>
        </span>
      )}
    </span>
  );
}

// ── Public component ────────────────────────────────────────────────────────

interface CitedTextProps {
  text: string;
  className?: string;
}

export function CitedText({ text, className }: CitedTextProps) {
  const tokens = useMemo(() => tokenizeRichText(text), [text]);
  // Sequential reference number per citation, so prose stays readable and
  // markers read like footnotes (¹ ² ³) instead of inline section-name chips.
  let citationNo = 0;
  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        switch (tok.kind) {
          case "text":
            return <span key={i}>{tok.text}</span>;
          case "bold":
            return (
              <strong key={i} className="font-semibold text-foreground">
                {tok.text}
              </strong>
            );
          case "heading":
            return (
              <span
                key={i}
                className="block font-semibold text-foreground text-sm mt-3 first:mt-0 mb-0.5"
              >
                {tok.text}
              </span>
            );
          case "newline":
            // Newlines render as spaces in flowing prose; headings (block) create visual breaks naturally
            return <span key={i}> </span>;
          case "citation": {
            citationNo += 1;
            return (
              <CitationBadge
                key={i}
                index={citationNo}
                file={tok.file}
                section={tok.section}
              />
            );
          }
        }
      })}
    </span>
  );
}
