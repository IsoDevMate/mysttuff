import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { blogAPI } from "@/api/blogAPI";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, ListTree } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CommentSection from "@/components/blog/CommentSection";
import LikeButton from "@/components/blog/LikeButton";
import ShareButtons from "@/components/blog/ShareButtons";
import RelatedPosts from "@/components/blog/RelatedPosts";

const slugify = (text) =>
  String(text).toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

const textOf = (children) =>
  Array.isArray(children) ? children.map(textOf).join("") : String(children ?? "");

const parseTags = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

// H2/H3 headings from the markdown source (fence-aware) — powers the auto TOC
const getTocItems = (markdown) => {
  const items = [];
  let inFence = false;
  for (const line of (markdown || "").split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{2,3})\s+(.*)$/);
    if (m) items.push({ level: m[1].length, text: m[2].trim(), id: slugify(m[2]) });
  }
  return items;
};

export default function BlogPost() {
  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug');

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', slug],
    queryFn: () => blogAPI.getArticle(slug),
    enabled: !!slug,
  });

  const { data: socials = [] } = useQuery({
    queryKey: ['socials-sidebar'],
    queryFn: () => blogAPI.getSocialLinks(),
  });

  const tags = parseTags(post?.tags);
  const tocItems = useMemo(
    () => (post && post.show_toc !== 0 ? getTocItems(post.content) : []),
    [post]
  );
  const [activeId, setActiveId] = useState(null);

  // Scroll-spy: highlight the section currently on screen
  useEffect(() => {
    if (!tocItems.length) return;
    const els = tocItems.map((t) => document.getElementById(t.id)).filter(Boolean);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [tocItems]);

  const scrollTo = (e, id) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const tocNav = (
    <nav className="space-y-1.5">
      {tocItems.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={(e) => scrollTo(e, item.id)}
          className={`block font-body text-xs transition-opacity hover:opacity-100 ${
            item.level === 3 ? "pl-3" : ""
          } ${activeId === item.id ? "opacity-100 font-medium" : "opacity-50"}`}
        >
          {item.text}
        </a>
      ))}
    </nav>
  );

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="animate-pulse max-w-3xl">
          <div className="h-4 bg-current/10 rounded w-24 mb-6" />
          <div className="h-12 bg-current/10 rounded w-3/4 mb-4" />
          <div className="h-4 bg-current/10 rounded w-32 mb-12" />
          <div className="space-y-4">
            <div className="h-4 bg-current/10 rounded w-full" />
            <div className="h-4 bg-current/10 rounded w-full" />
            <div className="h-4 bg-current/10 rounded w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1 className="font-serif-display text-4xl font-bold mb-4">
          Post not found
        </h1>
        <Link 
          to={createPageUrl("Blog")}
          className="font-body opacity-60 hover:opacity-100 transition-opacity inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to writing
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <div className="flex gap-12 relative">
        {/* Main Content */}
        <div className="flex-1 max-w-3xl">
          {/* Back Link */}
          <Link 
            to={createPageUrl("Blog")}
            className="font-body text-sm opacity-40 hover:opacity-100 transition-opacity inline-flex items-center gap-2 mb-12"
          >
            <ArrowLeft className="w-4 h-4" /> back to writing
          </Link>

          {/* Header */}
          <header className="mb-12">
            {post.image_url && (
              <img
                src={post.image_url}
                alt=""
                className="w-full max-h-80 object-cover rounded-lg mb-8"
              />
            )}
            <div className="flex items-center gap-3 mb-4">
              {post.category && (
                <span className="font-body text-xs uppercase tracking-wider opacity-60 bg-current/5 px-2 py-1 rounded">
                  {post.category}
                </span>
              )}
              <span className="font-body text-xs opacity-40 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(post.created_at), 'MMMM d, yyyy')}
              </span>
            </div>
            <h1 className="font-serif-display text-4xl md:text-5xl font-bold leading-tight mb-6">
              {post.title}
            </h1>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {tags.map((tag) => (
                  <Link
                    key={tag}
                    to={createPageUrl(`Blog?tag=${encodeURIComponent(tag)}`)}
                    className="font-body text-xs lowercase opacity-50 hover:opacity-100 transition-opacity border px-2 py-0.5 rounded-full"
                    style={{ borderColor: 'var(--text-color, #292524)' + '30' }}
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
            
            {/* Like Button */}
            <div className="flex items-center gap-3">
              <LikeButton postId={post.id} />
            </div>
          </header>

          {/* Divider */}
          <div className="border-t mb-12" style={{ borderColor: 'var(--text-color, #292524)' + '20' }} />

          {/* Table of contents — mobile (desktop version lives in the sidebar) */}
          {tocItems.length >= 2 && (
            <details className="lg:hidden mb-8 border rounded-lg p-4" style={{ borderColor: 'var(--text-color, #292524)' + '20' }}>
              <summary className="font-body text-sm font-medium cursor-pointer flex items-center gap-2">
                <ListTree className="w-4 h-4" /> On this page
              </summary>
              <div className="mt-3">{tocNav}</div>
            </details>
          )}

          {/* Content */}
          <article className="font-body leading-relaxed prose-styles">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="font-serif-display text-3xl font-bold mt-12 mb-4">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2
                    id={slugify(textOf(children))}
                    className="font-serif-display text-2xl font-bold mt-10 mb-4 scroll-mt-24"
                  >
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3
                    id={slugify(textOf(children))}
                    className="font-serif-display text-xl font-bold mt-8 mb-3 scroll-mt-24"
                  >
                    {children}
                  </h3>
                ),
                h4: ({ children }) => (
                  <h4 className="font-serif-display text-lg font-bold mt-6 mb-2">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="mb-6 text-lg leading-relaxed opacity-90">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="mb-6 ml-6 space-y-2" style={{ listStyleType: 'disc' }}>
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="mb-6 ml-6 space-y-2" style={{ listStyleType: 'decimal' }}>
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="text-lg opacity-80">
                    {children}
                  </li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 pl-6 my-8 italic opacity-70" style={{ borderColor: 'var(--accent-color, #78716c)' }}>
                    {children}
                  </blockquote>
                ),
                // react-markdown v9+ removed the `inline` prop — detect via language- class.
                // `pre` renders its child directly so block code isn't nested <pre><pre>.
                pre: ({ children }) => <>{children}</>,
                code: ({ className, children }) =>
                  /language-/.test(className || "") ? (
                    <pre className="bg-black text-white p-6 rounded-lg overflow-x-auto my-6">
                      <code className="font-mono text-sm">{children}</code>
                    </pre>
                  ) : (
                    <code className="bg-current/10 px-1.5 py-0.5 rounded text-sm font-mono">
                      {children}
                    </code>
                  ),
                a: ({ children, href }) => (
                  <a 
                    href={href} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:opacity-70 transition-opacity"
                  >
                    {children}
                  </a>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic">{children}</em>
                ),
                img: ({ src, alt }) => (
                  <img 
                    src={src} 
                    alt={alt} 
                    className="w-full rounded-lg my-8"
                  />
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-8">
                    <table className="min-w-full border-collapse border opacity-90" style={{ borderColor: 'var(--text-color, #292524)' + '30' }}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead style={{ backgroundColor: 'var(--text-color, #292524)' + '08' }}>{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="border px-4 py-2 text-left font-semibold text-sm" style={{ borderColor: 'var(--text-color, #292524)' + '30' }}>
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border px-4 py-2 text-sm opacity-80" style={{ borderColor: 'var(--text-color, #292524)' + '30' }}>
                    {children}
                  </td>
                ),
                del: ({ children }) => (
                  <del className="line-through opacity-60">{children}</del>
                ),
                hr: () => (
                  <hr className="my-10 border-t" style={{ borderColor: 'var(--text-color, #292524)' + '20' }} />
                ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          </article>

          {/* Related Posts */}
          <RelatedPosts currentPostId={post.id} category={post.category} />

          {/* Comments */}
          <CommentSection postId={post.id} />

          {/* Footer */}
          <div className="border-t mt-16 pt-8" style={{ borderColor: 'var(--text-color, #292524)' + '20' }}>
            <Link 
              to={createPageUrl("Blog")}
              className="font-body text-sm opacity-40 hover:opacity-100 transition-opacity inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> back to writing
            </Link>
          </div>
        </div>

        {/* Sidebar - Desktop Only */}
        <aside className="hidden lg:block w-64 sticky top-24 self-start">
          <div className="space-y-8">
            {/* Table of contents */}
            {tocItems.length >= 2 && (
              <div className="p-6 border rounded-lg" style={{ borderColor: 'var(--text-color, #292524)' + '20' }}>
                <p className="font-body text-sm font-medium mb-3 flex items-center gap-2">
                  <ListTree className="w-4 h-4" /> On this page
                </p>
                {tocNav}
              </div>
            )}

            {/* Share */}
            <div className="p-6 border rounded-lg" style={{ borderColor: 'var(--text-color, #292524)' + '20' }}>
              <ShareButtons title={post.title} />
            </div>

            {/* Socials */}
            {socials.length > 0 && (
              <div className="p-6 border rounded-lg" style={{ borderColor: 'var(--text-color, #292524)' + '20' }}>
                <p className="font-body text-sm font-medium mb-3">Find me</p>
                <div className="space-y-2">
                  {socials.map((social) => (
                    <a
                      key={social.id}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-body text-xs opacity-60 hover:opacity-100 transition-opacity block"
                    >
                      {social.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}