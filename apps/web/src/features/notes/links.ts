import type { Link } from '@shakespeer/storage';

/** Whether a link may be stored and opened: http and https only (ANN-003). */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** How a link shows without a label: its host and path (ANN-003). */
export function linkText(link: Link): string {
  if (link.label) {
    return link.label;
  }
  try {
    const url = new URL(link.url);
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return link.url;
  }
}
