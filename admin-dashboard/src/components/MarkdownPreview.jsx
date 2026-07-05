import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

export const markdownComponents = {
  h1: ({ children }) => <h1 className="text-2xl font-bold mt-8 mb-3">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold mt-6 mb-3">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-bold mt-4 mb-2">{children}</h3>,
  h4: ({ children }) => <h4 className="text-base font-bold mt-4 mb-2">{children}</h4>,
  p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc ml-6 mb-4 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ml-6 mb-4 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/40 pl-4 italic opacity-80 my-6 bg-muted/30 py-2 rounded-r">
      {children}
    </blockquote>
  ),
  code: ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    if (!inline && match) {
      return (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          className="rounded-lg my-4 text-sm !bg-[#282c34]"
          customStyle={{ margin: 0, borderRadius: '0.5rem' }}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      );
    }
    return (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4 hover:opacity-70 transition-opacity text-primary"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <span className="block my-6">
      <img
        src={src}
        alt={alt || ''}
        className="w-full rounded-lg"
        onError={(e) => {
          e.target.outerHTML = `<span class="flex items-center gap-2 text-red-500 text-sm border border-red-300 rounded p-2">⚠ Image failed to load: ${src}</span>`;
        }}
      />
      {alt && alt !== 'Image' && (
        <span className="text-xs text-muted-foreground mt-1 block text-center">{alt}</span>
      )}
    </span>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-6">
      <table className="min-w-full border-collapse border border-muted text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-muted px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-muted px-3 py-2">{children}</td>
  ),
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
  hr: () => <hr className="my-8 border-muted" />,
};

export function MarkdownPreview({ content, title, category, image_url }) {
  return (
    <div className="prose max-w-none font-sans">
      {image_url && (
        <>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Featured hero</p>
          <img
            src={image_url}
            alt="Featured"
            className="w-full h-64 object-cover rounded-lg mb-6"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.insertAdjacentHTML(
                'afterend',
                '<p class="text-red-500 text-sm border border-red-300 rounded p-2 mb-4">⚠ Featured image failed to load — check the URL</p>',
              );
            }}
          />
        </>
      )}
      {category && (
        <span className="text-xs uppercase tracking-wider opacity-60 bg-muted px-2 py-1 rounded">
          {category}
        </span>
      )}
      {title && <h1 className="text-3xl font-bold mt-3 mb-6">{title}</h1>}
      <div className="border-t mb-8" />
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content || '*No content yet...*'}
      </ReactMarkdown>
    </div>
  );
}
