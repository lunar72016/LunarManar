export type LinkedTextPart = { type: "text" | "link"; value: string };

const urlPattern = /(https?:\/\/[^\s<>"']+)/g;
const trailingPunctuation = /[),.;!?，。！？、】【）】]+$/;

export function splitLinkedText(value: string): LinkedTextPart[] {
  if (!value) return [];
  const parts: LinkedTextPart[] = [];
  let cursor = 0;

  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(value)) !== null) {
    const start = match.index;
    const matchedUrl = match[0];
    const url = matchedUrl.replace(trailingPunctuation, "");
    const suffix = matchedUrl.slice(url.length);
    if (start > cursor) parts.push({ type: "text", value: value.slice(cursor, start) });
    if (url) parts.push({ type: "link", value: url });
    if (suffix) parts.push({ type: "text", value: suffix });
    cursor = start + matchedUrl.length;
  }

  if (cursor < value.length) parts.push({ type: "text", value: value.slice(cursor) });
  return parts.length ? parts : [{ type: "text", value }];
}
