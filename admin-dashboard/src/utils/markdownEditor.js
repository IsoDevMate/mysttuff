/**
 * Insert text at the textarea cursor, replacing any selection.
 * Returns the new full content string and cursor position.
 */
export function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const newValue = before + text + after;
  const cursorPos = start + text.length;
  return { newValue, cursorPos };
}

/**
 * Wrap the current selection (or placeholder) with prefix/suffix markdown.
 */
export function wrapSelection(textarea, prefix, suffix = prefix, placeholder = 'text') {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end) || placeholder;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  const wrapped = prefix + selected + suffix;
  const newValue = before + wrapped + after;
  const selectStart = start + prefix.length;
  const selectEnd = selectStart + selected.length;
  return { newValue, selectStart, selectEnd };
}

/** Prefix the current line with markdown heading markers. */
export function prefixLine(textarea, prefix) {
  const start = textarea.selectionStart;
  const value = textarea.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const before = value.slice(0, lineStart);
  const after = value.slice(lineStart);
  const newValue = before + prefix + after;
  const cursorPos = start + prefix.length;
  return { newValue, cursorPos };
}

export const MARKDOWN_SNIPPETS = {
  h1: { type: 'prefix', value: '# ' },
  h2: { type: 'prefix', value: '## ' },
  h3: { type: 'prefix', value: '### ' },
  h4: { type: 'prefix', value: '#### ' },
  bold: { type: 'wrap', prefix: '**', suffix: '**', placeholder: 'bold text' },
  italic: { type: 'wrap', prefix: '_', suffix: '_', placeholder: 'italic text' },
  strikethrough: { type: 'wrap', prefix: '~~', suffix: '~~', placeholder: 'strikethrough' },
  inlineCode: { type: 'wrap', prefix: '`', suffix: '`', placeholder: 'code' },
  blockquote: { type: 'insert', value: '\n> Quote text here\n' },
  hr: { type: 'insert', value: '\n---\n' },
  ul: { type: 'insert', value: '\n- List item\n- List item\n' },
  ol: { type: 'insert', value: '\n1. First item\n2. Second item\n' },
  link: { type: 'wrap', prefix: '[', suffix: '](https://)', placeholder: 'link text' },
  table: {
    type: 'insert',
    value: '\n| Column 1 | Column 2 | Column 3 |\n| -------- | -------- | -------- |\n| Cell     | Cell     | Cell     |\n',
  },
  codeBlock: { type: 'insert', value: '\n```javascript\n// your code here\n```\n' },
};

export function applySnippet(textarea, snippet) {
  if (snippet.type === 'prefix') {
    return prefixLine(textarea, snippet.value);
  }
  if (snippet.type === 'wrap') {
    return wrapSelection(textarea, snippet.prefix, snippet.suffix, snippet.placeholder);
  }
  return insertAtCursor(textarea, snippet.value);
}

// ─── Article structure helpers (image drag-repositioning) ────────────────────

const IMAGE_LINE_RE = /^\s*!\[([^\]]*)\]\(([^)\s]+)[^)]*\)\s*$/;

/**
 * Split markdown content into top-level blocks (fence-aware so code blocks
 * containing blank lines stay intact).
 * Returns [{ raw, startLine, endLine, kind: 'heading' | 'image' | 'other' | 'code', text }]
 * where kind 'image' = standalone image block, 'heading' = markdown heading.
 */
export function splitBlocks(content) {
  const lines = content.split('\n');
  const blocks = [];
  let current = [];
  let startLine = 0;
  let inFence = false;

  const flush = (endLineExclusive) => {
    if (current.length) {
      const raw = current.join('\n');
      const first = current[0] || '';
      const headingMatch = first.match(/^(#{1,6})\s+(.*)$/);
      let kind = 'other';
      let text = '';
      if (inFence || /^\s*```/.test(first)) {
        kind = 'code';
      } else if (headingMatch) {
        kind = 'heading';
        text = headingMatch[2];
      } else if (IMAGE_LINE_RE.test(raw)) {
        kind = 'image';
        const m = raw.match(IMAGE_LINE_RE);
        text = m?.[1] || m?.[2] || 'image';
      } else if (/!\[[^\]]*\]\([^)\s]+[^)]*\)/.test(raw)) {
        // An image embedded inside a paragraph (text before/after it on the same block)
        kind = 'paragraph-with-image';
        text = 'image in paragraph';
      }
      blocks.push({ raw, startLine, endLine: endLineExclusive - 1, kind, text });
      current = [];
    }
  };

  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      current.push(line);
      if (!inFence) flush(i + 1);
      return;
    }
    if (!inFence && line.trim() === '') {
      flush(i);
      startLine = i + 1;
      return;
    }
    if (!current.length) startLine = i;
    current.push(line);
  });
  flush(lines.length);

  return blocks;
}

/** Extract { level, text, line } for headings — used by the admin outline and TOC. */
export function getHeadings(content) {
  return content
    .split('\n')
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => /^#{1,6}\s+/.test(line))
    .map(({ line, i }) => {
      const m = line.match(/^(#{1,6})\s+(.*)$/);
      return { level: m[1].length, text: m[2].trim(), line: i };
    });
}

/**
 * Move the image block at imageBlockIndex to just before targetBlockIndex.
 * Returns the rewritten content string.
 */
export function moveBlock(content, fromIndex, toIndex) {
  const blocks = splitBlocks(content);
  if (fromIndex < 0 || fromIndex >= blocks.length) return content;
  if (fromIndex === toIndex) return content;

  const from = blocks[fromIndex];
  // Remove the source block, then re-derive indices on the shortened list.
  // Moving down: "target index" toIndex in the original list corresponds to the
  // block that will sit AFTER the removed one — i.e. original index toIndex+1
  // becomes index toIndex after removal, so insert BEFORE remaining[toIndex].
  const remaining = blocks.filter((_, i) => i !== fromIndex);
  // toIndex >= blocks.length means "append at the very end"
  const appendAtEnd = toIndex >= blocks.length;
  const target = appendAtEnd ? null : remaining[Math.min(toIndex, remaining.length - 1)];
  if (!appendAtEnd && !target) return content;

  const lines = content.split('\n');
  // Replace source block lines with a single marker to splice cleanly
  const removed = [...lines];
  removed.splice(from.startLine, from.endLine - from.startLine + 1);
  // Insert before the target block (or at the end when appending)
  const insertLines = [...from.raw.split('\n'), ''];
  if (appendAtEnd) {
    removed.push(...insertLines);
  } else {
    let targetStart = target.startLine;
    if (target.startLine > from.startLine) {
      targetStart -= from.endLine - from.startLine + 1;
    }
    removed.splice(targetStart, 0, ...insertLines);
  }
  return removed.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
