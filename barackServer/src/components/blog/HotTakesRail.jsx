import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { blogAPI } from "@/api/blogAPI";
import { Flame, ArrowRight } from "lucide-react";

/**
 * "AI Hot Takes" — short spicy takes shown on top of the Blog page.
 * Each take can be linked to an article, so clicking it reroutes there.
 * Self-contained so it can be lifted onto its own page later.
 */
export default function HotTakesRail() {
  const { data: takes = [] } = useQuery({
    queryKey: ["hot-takes"],
    queryFn: () => blogAPI.getHotTakes(),
  });

  if (!takes.length) return null;

  return (
    <section className="mb-16">
      <div className="flex items-center gap-2 mb-6">
        <Flame className="w-4 h-4" style={{ color: "var(--accent-color, #78716c)" }} />
        <h2 className="font-serif-display text-xl font-bold">AI hot takes</h2>
        <span className="font-body text-xs opacity-40">unfiltered, obviously</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {takes.map((take) => {
          const inner = (
            <>
              <p className="font-serif-display text-lg leading-snug mb-3 flex-1">
                “{take.take}”
              </p>
              <span className="font-body text-xs opacity-50 flex items-center gap-1 mt-auto">
                {take.article_slug ? (
                  <>
                    read the take <ArrowRight className="w-3 h-3" />
                  </>
                ) : (
                  "hot off the press"
                )}
              </span>
            </>
          );

          const cardClass =
            "group shrink-0 w-72 snap-start border rounded-lg p-4 flex flex-col transition-all hover:opacity-100 opacity-80 hover:-translate-y-0.5";
            const style = {
              borderColor: "var(--text-color, #292524)" + "25",
              backgroundColor: "var(--text-color, #292524)" + "05",
            };

          return take.article_slug ? (
            <Link key={take.id} to={createPageUrl(`BlogPost?slug=${take.article_slug}`)} className={cardClass} style={style}>
              {inner}
            </Link>
          ) : (
            <div key={take.id} className={cardClass} style={style}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
