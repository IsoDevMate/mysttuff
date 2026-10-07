import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { blogAPI } from "@/api/blogAPI";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Tag, ArrowLeft, Hash } from "lucide-react";

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

export default function Tags() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const activeTag = urlParams.get("tag") || "";

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => blogAPI.getArticles(),
  });

  // Build tag → posts map from all published articles
  const tagMap = {};
  posts.forEach((p) => {
    parseTags(p.tags).forEach((tag) => {
      if (!tagMap[tag]) tagMap[tag] = [];
      tagMap[tag].push(p);
    });
  });
  const tags = Object.entries(tagMap).sort((a, b) => b[1].length - a[1].length);

  const selectedPosts = activeTag ? tagMap[activeTag] || [] : [];

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <header className="py-12">
        <h1 className="font-serif-display text-5xl md:text-6xl font-bold mb-4">Tags</h1>
        <p className="font-body text-lg opacity-60">
          Every topic I've written about. Pick one to jump into those articles.
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-wrap gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-24 bg-current/10 rounded-full animate-pulse" />
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="py-20 text-center">
          <Tag className="w-8 h-8 mx-auto opacity-20 mb-4" />
          <p className="font-body opacity-40">
            No tags yet — they appear once articles have them.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {tags.map(([tag, tagPosts]) => (
            <button
              key={tag}
              onClick={() => navigate(createPageUrl(`Blog?tag=${encodeURIComponent(tag)}`))}
              className={`font-body text-sm lowercase border px-4 py-2 rounded-full transition-all hover:-translate-y-0.5 ${
                activeTag === tag ? "opacity-100 font-medium" : "opacity-70 hover:opacity-100"
              }`}
              style={{
                borderColor: "var(--text-color, #292524)" + "30",
                backgroundColor:
                  activeTag === tag ? "var(--accent-color, #78716c)" : "transparent",
                color: activeTag === tag ? "var(--bg-color, #FAF3E8)" : "inherit",
              }}
            >
              <Hash className="inline w-3 h-3 mr-0.5 opacity-60" />
              {tag}
              <span className="ml-1.5 opacity-50">{tagPosts.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Articles for the selected tag */}
      {activeTag && (
        <section className="mt-16">
          <div className="flex items-center justify-between mb-8 border-b pb-4" style={{ borderColor: "var(--text-color, #292524)" + "20" }}>
            <h2 className="font-serif-display text-2xl font-bold flex items-center gap-2">
              <Hash className="w-5 h-5 opacity-50" />
              {activeTag}
            </h2>
            <Link
              to={createPageUrl("Tags")}
              className="font-body text-sm opacity-50 hover:opacity-100 transition-opacity inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> all tags
            </Link>
          </div>

          {selectedPosts.length === 0 ? (
            <p className="font-body opacity-40 text-center py-12">
              Nothing tagged #{activeTag} yet.
            </p>
          ) : (
            <div className="space-y-8">
              {selectedPosts.map((post) => (
                <Link
                  key={post.id}
                  to={createPageUrl(`BlogPost?slug=${post.slug}`)}
                  className="block group"
                >
                  <article className="border-b pb-8 transition-all hover:opacity-90" style={{ borderColor: "var(--text-color, #292524)" + "20" }}>
                    <div className="flex items-center gap-3 mb-2">
                      {post.category && (
                        <span className="font-body text-xs uppercase tracking-wider opacity-50">
                          {post.category}
                        </span>
                      )}
                      <span className="font-body text-xs opacity-40">
                        {format(new Date(post.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    <h3 className="font-serif-display text-2xl font-bold mb-2 group-hover:opacity-70 transition-opacity">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="font-body opacity-60 leading-relaxed">{post.excerpt}</p>
                    )}
                  </article>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
