import React, { useState } from 'react';
import {
  Heading1, Heading2, Heading3, Heading4,
  Bold, Italic, Strikethrough, Quote, Code, Code2,
  Link, Image, Table, Minus, List, ListOrdered,
} from 'lucide-react';
import { MARKDOWN_SNIPPETS, applySnippet } from '../utils/markdownEditor';

const TOOL_GROUPS = [
  {
    label: 'Headings',
    tools: [
      { id: 'h1', icon: Heading1, title: 'Heading 1', snippet: MARKDOWN_SNIPPETS.h1 },
      { id: 'h2', icon: Heading2, title: 'Heading 2', snippet: MARKDOWN_SNIPPETS.h2 },
      { id: 'h3', icon: Heading3, title: 'Heading 3', snippet: MARKDOWN_SNIPPETS.h3 },
      { id: 'h4', icon: Heading4, title: 'Heading 4', snippet: MARKDOWN_SNIPPETS.h4 },
    ],
  },
  {
    label: 'Format',
    tools: [
      { id: 'bold', icon: Bold, title: 'Bold', snippet: MARKDOWN_SNIPPETS.bold },
      { id: 'italic', icon: Italic, title: 'Italic', snippet: MARKDOWN_SNIPPETS.italic },
      { id: 'strike', icon: Strikethrough, title: 'Strikethrough', snippet: MARKDOWN_SNIPPETS.strikethrough },
      { id: 'inlineCode', icon: Code, title: 'Inline code', snippet: MARKDOWN_SNIPPETS.inlineCode },
    ],
  },
  {
    label: 'Blocks',
    tools: [
      { id: 'quote', icon: Quote, title: 'Blockquote', snippet: MARKDOWN_SNIPPETS.blockquote },
      { id: 'codeBlock', icon: Code2, title: 'Code block', snippet: MARKDOWN_SNIPPETS.codeBlock },
      { id: 'table', icon: Table, title: 'Table', snippet: MARKDOWN_SNIPPETS.table },
      { id: 'hr', icon: Minus, title: 'Horizontal rule', snippet: MARKDOWN_SNIPPETS.hr },
      { id: 'ul', icon: List, title: 'Bullet list', snippet: MARKDOWN_SNIPPETS.ul },
      { id: 'ol', icon: ListOrdered, title: 'Numbered list', snippet: MARKDOWN_SNIPPETS.ol },
      { id: 'link', icon: Link, title: 'Link', snippet: MARKDOWN_SNIPPETS.link },
    ],
  },
];

function ToolbarButton({ icon: Icon, title, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded hover:bg-muted transition-colors ${
        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export default function MarkdownToolbar({ textareaRef, onContentChange, onImageClick }) {
  const [codeLang, setCodeLang] = useState('javascript');

  const apply = (snippet) => {
    const el = textareaRef?.current;
    if (!el) return;
    const result = applySnippet(el, snippet);
    onContentChange(result.newValue);
    requestAnimationFrame(() => {
      el.focus();
      if (result.selectStart !== undefined) {
        el.setSelectionRange(result.selectStart, result.selectEnd);
      } else {
        el.setSelectionRange(result.cursorPos, result.cursorPos);
      }
    });
  };

  const insertCodeBlock = () => {
    const el = textareaRef?.current;
    if (!el) return;
    const snippet = {
      type: 'insert',
      value: `\n\`\`\`${codeLang}\n// your code here\n\`\`\`\n`,
    };
    const result = applySnippet(el, snippet);
    onContentChange(result.newValue);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.cursorPos, result.cursorPos);
    });
  };

  return (
    <div className="border rounded-t-lg bg-muted/30 p-2 space-y-2">
      {TOOL_GROUPS.map((group) => (
        <div key={group.label} className="flex items-center gap-0.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 w-14 shrink-0">
            {group.label}
          </span>
          {group.tools.map((tool) => (
            <ToolbarButton
              key={tool.id}
              icon={tool.icon}
              title={tool.title}
              onClick={() => apply(tool.snippet)}
            />
          ))}
        </div>
      ))}

      <div className="flex items-center gap-2 flex-wrap border-t pt-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 w-14 shrink-0">
          Code
        </span>
        <select
          value={codeLang}
          onChange={(e) => setCodeLang(e.target.value)}
          className="text-xs border rounded px-2 py-1 bg-background h-7"
        >
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="python">Python</option>
          <option value="bash">Bash</option>
          <option value="json">JSON</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="sql">SQL</option>
          <option value="java">Java</option>
          <option value="go">Go</option>
          <option value="rust">Rust</option>
          <option value="plaintext">Plain text</option>
        </select>
        <ToolbarButton icon={Code2} title="Insert code block" onClick={insertCodeBlock} />
        <div className="flex-1" />
        <ToolbarButton
          icon={Image}
          title="Insert image (upload & crop)"
          onClick={onImageClick}
        />
      </div>
    </div>
  );
}
