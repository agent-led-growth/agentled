import React from "react";

import { MONO } from "./tokens";

/**
 * A small, dependency-free Markdown renderer for AI answers. Web-search answers
 * come back as Markdown (bold, bullet/numbered lists, headings, links), so
 * rendering the raw text shows literal `**`/`***`/`-`. This handles that common
 * subset and highlights the monitored brand's mention inside plain text runs.
 * Deliberately not a full CommonMark parser — just what the answers actually use.
 */

const markStyle: React.CSSProperties = {
  background: "var(--grn)",
  color: "#14170f",
  padding: "1px 4px",
  fontWeight: 600,
};

/** Split a plain-text run on the brand mention, wrapping matches in <mark>. */
function highlightPlain(
  text: string,
  highlight: string | undefined,
  keyBase: string,
): React.ReactNode[] {
  if (!highlight) return [text];
  const lower = text.toLowerCase();
  const needle = highlight.toLowerCase();
  const out: React.ReactNode[] = [];
  let from = 0;
  let hit = lower.indexOf(needle, from);
  let k = 0;
  while (hit !== -1) {
    if (hit > from) out.push(text.slice(from, hit));
    out.push(
      <mark key={`${keyBase}-m${k++}`} style={markStyle}>
        {text.slice(hit, hit + highlight.length)}
      </mark>,
    );
    from = hit + highlight.length;
    hit = lower.indexOf(needle, from);
  }
  if (from < text.length) out.push(text.slice(from));
  return out.length ? out : [text];
}

// Bold-italic / bold / italic / inline code / link — matched in that order.
const INLINE =
  /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((https?:\/\/[^\s)]+)\))/g;

/** Inline Markdown → nodes, with the brand mention highlighted in plain runs. */
function renderInline(
  text: string,
  highlight: string | undefined,
  keyBase: string,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(...highlightPlain(text.slice(last, m.index), highlight, `${keyBase}-p${k}`));
    }
    if (m[2] != null) {
      nodes.push(
        <strong key={`${keyBase}-bi${k}`} style={{ fontStyle: "italic" }}>
          {m[2]}
        </strong>,
      );
    } else if (m[3] != null) {
      nodes.push(<strong key={`${keyBase}-b${k}`}>{m[3]}</strong>);
    } else if (m[4] != null) {
      nodes.push(<em key={`${keyBase}-i${k}`}>{m[4]}</em>);
    } else if (m[5] != null) {
      nodes.push(
        <code key={`${keyBase}-c${k}`} style={{ fontFamily: MONO, fontSize: "0.9em" }}>
          {m[5]}
        </code>,
      );
    } else {
      nodes.push(
        <a
          key={`${keyBase}-l${k}`}
          href={m[7]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--ink)", textDecoration: "underline" }}
        >
          {m[6]}
        </a>,
      );
    }
    last = m.index + m[0].length;
    k++;
  }
  if (last < text.length) {
    nodes.push(...highlightPlain(text.slice(last), highlight, `${keyBase}-p${k}`));
  }
  return nodes;
}

const H_RULE = /^\s*(?:---|\*\*\*|___)\s*$/;
const HEADING = /^\s*(#{1,6})\s+(.*)$/;
const UL_ITEM = /^\s*[-*]\s+(.*)$/;
const OL_ITEM = /^\s*\d+\.\s+(.*)$/;
const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

/** Render an AI answer's Markdown as blocks (paragraphs, lists, headings). */
export function AnswerMarkdown({ text, highlight }: { text: string; highlight?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let b = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (H_RULE.test(line)) {
      blocks.push(<hr key={`b${b++}`} style={{ border: 0, borderTop: "1px solid var(--line)" }} />);
      i++;
      continue;
    }
    const h = line.match(HEADING);
    if (h) {
      blocks.push(
        <p key={`b${b++}`} style={{ margin: 0, fontWeight: 700 }}>
          {renderInline(h[2], highlight, `b${b}`)}
        </p>,
      );
      i++;
      continue;
    }
    if (UL_ITEM.test(line)) {
      const items: React.ReactNode[] = [];
      let match: RegExpMatchArray | null;
      while (i < lines.length && (match = lines[i].match(UL_ITEM))) {
        items.push(<li key={`b${b}-${i}`}>{renderInline(match[1], highlight, `b${b}-${i}`)}</li>);
        i++;
      }
      blocks.push(
        <ul key={`b${b++}`} style={{ ...listStyle, listStyleType: "disc" }}>
          {items}
        </ul>,
      );
      continue;
    }
    if (OL_ITEM.test(line)) {
      const items: React.ReactNode[] = [];
      let match: RegExpMatchArray | null;
      while (i < lines.length && (match = lines[i].match(OL_ITEM))) {
        items.push(<li key={`b${b}-${i}`}>{renderInline(match[1], highlight, `b${b}-${i}`)}</li>);
        i++;
      }
      blocks.push(
        <ol key={`b${b++}`} style={{ ...listStyle, listStyleType: "decimal" }}>
          {items}
        </ol>,
      );
      continue;
    }
    // Paragraph: gather consecutive non-blank, non-block lines.
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !UL_ITEM.test(lines[i]) &&
      !OL_ITEM.test(lines[i]) &&
      !H_RULE.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={`b${b++}`} style={{ margin: 0 }}>
        {renderInline(buf.join(" "), highlight, `b${b}`)}
      </p>,
    );
  }

  return <div className="flex flex-col gap-[12px]">{blocks}</div>;
}
