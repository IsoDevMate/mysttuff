import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { base44 } from "@/api/mockData";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import CommentSection from "@/components/blog/CommentSection";
import LikeButton from "@/components/blog/LikeButton";
import ShareButtons from "@/components/blog/ShareButtons";
import RelatedPosts from "@/components/blog/RelatedPosts";

export default function BlogPost() {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get('id');

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: async () => {
      const posts = await base44.entities.BlogPost.filter({ id: postId });
      return posts[0];
    },
    enabled: !!postId,
  });

  const { data: socials = [] } = useQuery({
    queryKey: ['socials-sidebar'],
    queryFn: () => base44.entities.SocialLink.list('order', 5),
  });

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
            <div className="flex items-center gap-3 mb-4">
              {post.category && (
                <span className="font-body text-xs uppercase tracking-wider opacity-60 bg-current/5 px-2 py-1 rounded">
                  {post.category}
                </span>
              )}
              <span className="font-body text-xs opacity-40 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(post.created_date), 'MMMM d, yyyy')}
              </span>
            </div>
            <h1 className="font-serif-display text-4xl md:text-5xl font-bold leading-tight mb-6">
              {post.title}
            </h1>
            
            {/* Like Button */}
            <div className="flex items-center gap-3">
              <LikeButton postId={post.id} />
            </div>
          </header>

          {/* Divider */}
          <div className="border-t mb-12" style={{ borderColor: 'var(--text-color, #292524)' + '20' }} />

          {/* Content */}
          <article className="font-body leading-relaxed prose-styles">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="font-serif-display text-3xl font-bold mt-12 mb-4">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="font-serif-display text-2xl font-bold mt-10 mb-4">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="font-serif-display text-xl font-bold mt-8 mb-3">
                    {children}
                  </h3>
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
                code: ({ inline, children }) => 
                  inline ? (
                    <code className="bg-current/10 px-1.5 py-0.5 rounded text-sm font-mono">
                      {children}
                    </code>
                  ) : (
                    <pre className="bg-black text-white p-6 rounded-lg overflow-x-auto my-6">
                      <code className="font-mono text-sm">{children}</code>
                    </pre>
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