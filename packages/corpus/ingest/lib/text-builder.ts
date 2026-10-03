import type { Mark, MarkType } from '../../src/schema.ts';

/**
 * Accumulates a text node's text with whitespace collapsed and marks recorded over the final
 * string, so mark offsets always match `text` (CRP-023).
 */
export class TextBuilder {
  #text = '';
  readonly #open: { type: MarkType; start: number }[] = [];
  readonly #marks: Mark[] = [];

  get length(): number {
    return this.#text.length;
  }

  get isEmpty(): boolean {
    return this.#text.trim() === '';
  }

  append(chunk: string): void {
    let addition = chunk.replace(/\s+/g, ' ');
    if (addition.startsWith(' ') && (this.#text === '' || this.#text.endsWith(' '))) {
      addition = addition.slice(1);
    }
    if (addition === '') {
      return;
    }
    // Normalize across the boundary so a combining mark composes with the previous letter.
    if (this.#text !== '' && /^\p{M}/u.test(addition)) {
      const last = this.#text.slice(-1);
      this.#text = this.#text.slice(0, -1) + (last + addition).normalize('NFC');
    } else {
      this.#text += addition.normalize('NFC');
    }
  }

  /** Appends text covered by a mark of the given type. */
  appendMarked(chunk: string, type: MarkType): void {
    this.open(type);
    this.append(chunk);
    this.close(type);
  }

  open(type: MarkType): void {
    this.#open.push({ type, start: this.#text.length });
  }

  close(type: MarkType): void {
    const index = this.#open.findLastIndex((mark) => mark.type === type);
    if (index < 0) {
      return;
    }
    const [mark] = this.#open.splice(index, 1);
    if (mark && this.#text.length > mark.start) {
      this.#marks.push({ start: mark.start, end: this.#text.length, type });
    }
  }

  /** The finished text (trimmed) and its marks, clamped and merged. Open marks are closed. */
  build(): { text: string; marks?: Mark[] } {
    for (const mark of [...this.#open].reverse()) {
      this.close(mark.type);
    }
    const leading = this.#text.length - this.#text.trimStart().length;
    const text = this.#text.trim();
    const marks: Mark[] = [];
    for (const mark of this.#marks) {
      const start = Math.max(0, mark.start - leading);
      const end = Math.min(text.length, mark.end - leading);
      if (end <= start) {
        continue;
      }
      const previous = marks.findLast((m) => m.type === mark.type && m.end >= start);
      if (previous) {
        previous.end = Math.max(previous.end, end);
      } else {
        marks.push({ start, end, type: mark.type });
      }
    }
    marks.sort((a, b) => a.start - b.start || a.end - b.end || a.type.localeCompare(b.type));
    return marks.length > 0 ? { text, marks } : { text };
  }
}
