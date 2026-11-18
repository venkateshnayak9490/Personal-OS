/** What another app shared (Android's Share sheet → our manifest share_target, GET /share?title&text&url). */
export interface Shared {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

/**
 * Turn a share into an Inbox task: a readable title, and the link + any extra text as notes.
 * Chrome on Android often leaves `url` empty and puts the link inside `text`.
 */
export function taskFromShare(s: Shared): { title: string; description?: string } | null {
  const raw = s.text?.trim() ?? '';
  const url = s.url?.trim() || raw.match(/https?:\/\/\S+/)?.[0] || '';
  const text = url ? raw.replace(url, '').trim() : raw;
  const title = (s.title?.trim() || text.split('\n')[0]?.trim() || url).slice(0, 200);
  if (!title) return null;
  const notes = [text === title ? '' : text, url === title ? '' : url].filter(Boolean).join('\n\n');
  return { title, description: notes || undefined };
}
