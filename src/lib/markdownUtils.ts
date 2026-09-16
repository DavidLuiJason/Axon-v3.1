import removeMarkdown from 'remove-markdown';

/**
 * Pre-processes and normalizes raw text for Markdown rendering.
 * Addresses common LLM / input formatting quirks:
 * - Stray periods or line breaks after numbers: "1.\nItem" or "1.\n. Item" -> "1. Item"
 * - Missing space after ordered list delimiter: "1.Item" -> "1. Item"
 * - Stray dot bullet markers: ". Item" -> "- Item"
 * - Unicode bullets (•, ●, ○, ◦) -> "- Item"
 * - Blockquote missing space: ">Quote" -> "> Quote"
 * - Setext confusion for horizontal rules: ensures blank line before "---"
 */
export function normalizeMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let normalized = text.replace(/\r\n/g, '\n');

  // Convert unicode bullets into standard markdown hyphens
  normalized = normalized.replace(/^([ \t]*)[•●○◦][ \t]+/gm, '$1- ');

  // Fix line breaks directly following numbered list markers: "1.\nItem" or "1.\n. Item" -> "1. Item"
  normalized = normalized.replace(/^([ \t]*\d+[\.\)])[ \t]*\n+[ \t]*\.?[ \t]*/gm, '$1 ');

  // Fix missing space after numbered list markers: "1.Item" -> "1. Item"
  normalized = normalized.replace(/^([ \t]*\d+[\.\)])([A-Za-z])/gm, '$1 $2');

  // Fix lone period used as a bullet point: ". Item" -> "- Item"
  normalized = normalized.replace(/^([ \t]*)\.[ \t]+(\S)/gm, '$1- $2');

  // Fix blockquote marker missing space: ">Quote" -> "> Quote"
  normalized = normalized.replace(/^([ \t]*>)([^\s>])/gm, '$1 $2');

  // Ensure horizontal rules preceded by text have an extra newline so they are not parsed as Setext headings
  normalized = normalized.replace(/([^\n])\n([ \t]*(?:---|\*\*\*|___)[ \t]*)(?:\n|$)/g, '$1\n\n$2\n');

  return normalized;
}

/**
 * Strips all Markdown syntax formatting to produce clean, readable plain text.
 * Strips:
 * - Bold (**text**, __text__) and italics (*text*, _text_)
 * - Headers (#, ##, ###)
 * - Bullet list markers (-, *, +) and stray dot markers (.)
 * - Inline code (`code`) and fenced code blocks (```)
 * - Blockquotes (> quote)
 * - Horizontal rules (---, ***)
 * - Links [text](url) -> text, Images ![alt](url) -> alt
 * - Strikethrough (~~text~~)
 * - Table formatting borders (|---|---|)
 * Keeps:
 * - Numbered list ordering (1. Item, 2. Item) for readability
 * - Clean plain-text content
 */
export function stripMarkdown(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let str = text.replace(/\r\n/g, '\n');

  // Normalize unicode bullets
  str = str.replace(/^([ \t]*)[•●○◦][ \t]+/gm, '$1- ');

  // Remove markdown table header divider lines (|---|---|)
  str = str.replace(/^[ \t]*\|?([ \t]*:?-+:?[ \t]*\|)+[ \t]*:?-+:?[ \t]*\|?[ \t]*$/gm, '');

  // Clean up table row borders (| Cell 1 | Cell 2 | -> Cell 1 | Cell 2)
  str = str.replace(/^[ \t]*\|[ \t]*(.*?)[ \t]*\|[ \t]*$/gm, (_, inner) => {
    return inner.split('|').map((c: string) => c.trim()).join(' | ');
  });

  // Use remove-markdown for standard GFM parsing
  str = removeMarkdown(str, {
    gfm: true,
    stripListLeaders: false,
    useImgAltText: true,
  });

  // Explicitly strip bullet list markers (-, *, +) without stripping numbered list markers (1.)
  str = str.replace(/^([ \t]*)[*\-+][ \t]+/gm, '$1');

  // Also strip stray dot list markers (. Item)
  str = str.replace(/^([ \t]*)\.[ \t]+/gm, '$1');

  // Clean excess blank lines
  str = str.replace(/\n{3,}/g, '\n\n');

  return str.trim();
}
