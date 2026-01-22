import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { base44 } from "@/api/mockData";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const categories = ["all", "backend", "ai", "databases", "experiments", "other"];

export default function Blog() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: () => base44.entities.BlogPost.filter({ published: true }, '-created_date'),
  });

  const filteredPosts = posts
    .filter(p => activeCategory === "all" || p.category === activeCategory)
    .filter(p => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        p.title?.toLowerCase().includes(query) ||
        p.excerpt?.toLowerCase().includes(query) ||
        p.content?.toLowerCase().includes(query)
      );
    });

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <header className="py-12">
        <h1 className="font-serif-display text-5xl md:text-6xl font-bold mb-4">
          Writing
        </h1>
        <p className="font-body text-lg opacity-60">
          Thoughts and experiments I've documented.
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
        <Input
          type="text"
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 bg-white/50 border-current/20"
        />
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-12 border-b pb-6" style={{ borderColor: 'var(--text-color, #292524)' + '20' }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`font-body text-sm px-4 py-2 rounded-full transition-all ${
              activeCategory === cat
                ? "opacity-100 font-medium"
                : "opacity-50 hover:opacity-100"
            }`}
            style={activeCategory === cat ? {
              backgroundColor: 'var(--accent-color, #78716c)',
              color: 'var(--bg-color, #FAF3E8)'
            } : {}}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Posts List */}
      {isLoading ? (
        <div className="space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-stone-200 rounded w-24 mb-3" />
              <div className="h-8 bg-stone-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-stone-200 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredPosts.length > 0 ? (
        <div className="space-y-10">
          {filteredPosts.map((post) => (
            <Link 
              key={post.id}
              to={createPageUrl(`BlogPost?id=${post.id}`)}
              className="block group"
            >
              <article className="border-b border-stone-200 pb-10 transition-all hover:border-stone-400">
                <div className="flex items-center gap-3 mb-3">
                  {post.category && (
                    <span className="font-body text-xs uppercase tracking-wider text-stone-400 bg-stone-100 px-2 py-1 rounded">
                      {post.category}
                    </span>
                  )}
                  <span className="font-body text-xs text-stone-400">
                    {format(new Date(post.created_date), 'MMMM d, yyyy')}
                  </span>
                </div>
                <h2 className="font-serif-display text-3xl font-bold text-stone-900 group-hover:text-stone-600 transition-colors mb-3">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="font-body text-stone-500 leading-relaxed">
                    {post.excerpt}
                  </p>
                )}
              </article>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <p className="font-body text-stone-400">
            {activeCategory === "all" 
              ? "No posts yet. Check back soon." 
              : `No posts in ${activeCategory} yet.`}
          </p>
        </div>
      )}
    </div>
  );
}