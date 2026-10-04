/** Spelling-insensitive word comparison, shared by the aligner and the reader (VAR-023). */

/**
 * A spelling-insensitive key for an early modern or modern word: u/v, i/j and y/i are
 * interchangeable, doubled letters and a final e are dropped ("heere" ~ "here", "haue" ~ "have").
 */
export function wordKey(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('ſ', 's')
    .replaceAll('v', 'u')
    .replaceAll('j', 'i')
    .replaceAll('y', 'i')
    .replace(/[^a-z]/g, '')
    .replaceAll('ck', 'c') // "musicke" ~ "music"
    .replace(/(.)\1+/g, '$1')
    .replace(/(.)e$/, '$1')
    .replace(/(..)ed$/, '$1d') // "stopped" ~ "stopp'd"
    .replace(/([pkcsx])t$/, '$1d'); // "stopt" ~ "stopped", "kist" ~ "kissed"
}

/** A text's words with their character offsets, split as the aligner splits them. */
export function wordSpans(text: string): { start: number; end: number; word: string }[] {
  const spans: { start: number; end: number; word: string }[] = [];
  for (const match of text.matchAll(/[^\s—–-]+/g)) {
    spans.push({ start: match.index, end: match.index + match[0].length, word: match[0] });
  }
  return spans;
}
