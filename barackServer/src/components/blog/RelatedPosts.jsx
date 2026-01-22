import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { base44 } from "@/api/mockData";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function RelatedPosts({ currentPostId, category }) {
  const { data: posts = [] } = useQuery({
    queryKey: ['related-posts', category],
    queryFn: async () => {
      const allPosts = await base44.entities.BlogPost.filter({ 
        category, 
        published: true 
      }, '-created_date', 4);
      return allPosts.filter(p => p.id !== currentPostId).slice(0, 3);
    },
    enabled: !!category,
  });

  if (posts.length === 0) return null;

  return (
    <div className="mt-16 border-t border-current/10 pt-12">
      <h3 className="font-serif-display text-2xl font-bold mb-8">
        Related Articles
      </h3>
      <div className="grid gap-6">
        {posts.map((post) => (
          <Link 
            key={post.id}
            to={createPageUrl(`BlogPost?id=${post.id}`)}
            className="group flex items-start gap-4 p-4 border border-current/10 rounded-lg hover:border-current/30 transition-all"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-body text-xs opacity-60">
                  {format(new Date(post.created_date), 'MMM d')}
                </span>
              </div>
              <h4 className="font-serif-display text-lg font-semibold group-hover:opacity-70 transition-opacity">
                {post.title}
              </h4>
              {post.excerpt && (
                <p className="font-body text-sm opacity-60 mt-1 line-clamp-2">
                  {post.excerpt}
                </p>
              )}
            </div>
            <ArrowRight className="w-4 h-4 mt-1 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>
    </div>
  );
}
