/**
 * Text styling for Aurora's replies.
 *
 * The persona asks for lowercase prose with no emoji, but small local models
 * ignore that. This is a hard safety net: emoji are stripped, and prose is
 * lowercased while code (fenced blocks, inline spans, paths, identifiers) keeps
 * its real casing.
 */
/** Remove emoji, then tidy the whitespace they leave behind. */
export declare function stripEmoji(text: string): string;
/** Rewrite the prose portions of a full reply. */
export declare function lowercaseProse(text: string): string;
/** Strip emoji and lowercase prose in one pass. */
export declare function styleReply(text: string): string;
