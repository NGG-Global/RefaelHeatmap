import { Fragment, type ReactNode } from "react";

/**
 * Keeps hyphen-joined words ("ב-AI", "שאלה-תשובה") on one line without
 * changing the text: each such word is wrapped in a no-wrap span.
 */
export function keepHyphenated(text: string): ReactNode {
  if (!text.includes("-")) return text;
  return text.split(/(\s+)/).map((part, i) =>
    part.includes("-") ? (
      <span key={i} style={{ whiteSpace: "nowrap" }}>
        {part}
      </span>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
