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
