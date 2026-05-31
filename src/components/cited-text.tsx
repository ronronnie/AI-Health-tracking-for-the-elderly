"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Matches: [some_file.md -> Section Name]
const CITATION_RE = /\[([^\]]+?\.(?:md|pdf|txt))\s*->\s*([^\]]+?)\]/g;

type Part =
  | { type: "text"; content: string }
  | { type: "citation"; file: string; section: string };

function parseCitations(text: string): Part[] {
  const parts: Part[] = [];
  let lastIndex = 0;
  const re = new RegExp(CITATION_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "citation", file: match[1].trim(), section: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex) });
  }
  return parts;
}

function CitationBadge({ file, section }: { file: string; section: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block align-middle">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium transition-colors mx-0.5 cursor-pointer",
          open
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        {section}
      </button>
      {open && (
        <span className="absolute bottom-full left-0 z-50 mb-1.5 w-56 rounded-xl border bg-card p-3 shadow-lg text-xs whitespace-normal pointer-events-none">
          <span className="block font-semibold text-foreground leading-snug">{section}</span>
          <span className="block text-muted-foreground mt-1 font-mono text-[10px] break-all">{file}</span>
        </span>
      )}
    </span>
  );
}

interface CitedTextProps {
  text: string;
  className?: string;
}

export function CitedText({ text, className }: CitedTextProps) {
  const parts = parseCitations(text);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "text" ? (
          <span key={i}>{part.content}</span>
        ) : (
          <CitationBadge key={i} file={part.file} section={part.section} />
        )
      )}
    </span>
  );
}
