/**
 * Text styling for Aurora's replies.
 *
 * The persona asks for lowercase prose with no emoji, but small local models
 * ignore that. This is a hard safety net: emoji are stripped, and prose is
 * lowercased while code (fenced blocks, inline spans, paths, identifiers) keeps
 * its real casing.
 */

// Emoji blocks, flags, variation selectors, ZWJ, dingbats, misc symbols.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F3FB}-\u{1F3FF}\u{200D}\u{20E3}\u{2b50}\u{2764}\u{2665}\u{2728}\u{2727}\u{2726}\u{2600}-\u{26FF}]/gu;

/** Remove emoji, then tidy the whitespace they leave behind. */
export function stripEmoji(text: string): string {
  return text
    .replace(EMOJI, '')
    .replace(/[ \t]+(\n|$)/g, '$1')
    .replace(/(\n)[ \t]+/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
}

/**
 * Keep a word's casing only when it looks like code — a path, filename, env var
 * or identifier (something with a separator or digit). Everything else is pure
 * prose and gets lowercased.
 */
function styleWord(word: string): string {
  const core = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
  if (!core) return word.toLowerCase();
  if (/[/\\]/.test(core)) return word; // path
  if (/\w\.\w|\.\w+$|^\w+\./.test(core)) return word; // filename / extension
  if (/_/.test(core)) return word; // identifier
  if (/\d/.test(core)) return word; // version / number-ish
  return word.toLowerCase();
}

/** Rewrite the prose portions of a full reply. */
export function lowercaseProse(text: string): string {
  const segments = text.split(/```/);
  return segments
    .map((segment, index) => {
      if (index % 2 === 1) return segment; // inside a fence — keep as-is
      // Split on inline `code` spans so they are preserved too.
      const inline = segment.split(/(`[^`]*`)/g);
      return inline
        .map((part, partIndex) => {
          if (partIndex % 2 === 1) return part; // inline code — keep
          // Match whole paths/filenames/identifiers as one token, or plain words.
          return part.replace(/[A-Za-z0-9_.@:/\\~-]*[A-Za-z][A-Za-z0-9_.@:/\\~-]*/g, styleWord);
        })
        .join('');
    })
    .join('```');
}

/** Strip emoji and lowercase prose in one pass. */
export function styleReply(text: string): string {
  return lowercaseProse(stripEmoji(text));
}
