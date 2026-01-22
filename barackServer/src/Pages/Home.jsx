import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { base44 } from "@/api/mockData";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function Home() {
  const { data: posts = [] } = useQuery({
    queryKey: ['posts-home'],
    queryFn: () => base44.entities.BlogPost.filter({ published: true }, '-created_date', 3),
  });

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      {/* Hero */}
      <section className="py-20">
        <h1 className="font-serif-display text-5xl md:text-7xl font-bold text-stone-900 leading-[1.1] mb-8">
          experiments,<br />
          thoughts &<br />
          random stuff
        </h1>
        <p className="font-body text-lg text-stone-500 max-w-md leading-relaxed">
          A place where I put things I'm working on. Backend experiments, AI explorations, database deep-dives, and whatever else catches my interest.
        </p>
      </section>

      {/* Divider */}
      <div className="border-t border-stone-300 my-12" />

      {/* Recent Posts */}
      {posts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-10">
            <h2 className="font-serif-display text-2xl font-bold text-stone-900">
              Recent writing
            </h2>
            <Link 
              to={createPageUrl("Blog")}
              className="font-body text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1"
            >
              view all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          <div className="space-y-8">
            {posts.map((post) => (
              <Link 
                key={post.id}
                to={createPageUrl(`BlogPost?id=${post.id}`)}
                className="block group"
              >
                <article className="border-b border-stone-200 pb-8 transition-all hover:border-stone-400">
                  <div className="flex items-center gap-3 mb-3">
                    {post.category && (
                      <span className="font-body text-xs uppercase tracking-wider text-stone-400">
                        {post.category}
                      </span>
                    )}
                    <span className="font-body text-xs text-stone-400">
                      {format(new Date(post.created_date), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <h3 className="font-serif-display text-2xl font-bold text-stone-900 group-hover:text-stone-600 transition-colors mb-2">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="font-body text-stone-500 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                </article>
              </Link>
            ))}
          </div>
        </section>
      )}

      {posts.length === 0 && (
        <section className="py-12">
          <p className="font-body text-stone-400 text-center">
            Nothing here yet. Check back soon.
          </p>
        </section>
      )}
    </div>
  );
}