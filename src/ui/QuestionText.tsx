import type { ReactNode } from 'react';

export function QuestionText({ text, allowedUrls }: { text: string; allowedUrls: readonly string[] }) {
  const allowed = new Set(allowedUrls);
  const content: ReactNode[] = [];
  let offset = 0;
  for (const match of text.matchAll(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    if (!allowed.has(match[2])) continue;
    content.push(text.slice(offset, match.index));
    content.push(<a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer">{match[1]}</a>);
    offset = match.index + match[0].length;
  }
  content.push(text.slice(offset));
  return <>{content}</>;
}
