import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { blogAPI } from "@/api/blogAPI";
import { takeLink } from "@/lib/hotTakes";
import { createPageUrl } from "@/lib/utils";
import { Flame, Camera, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

/**
 * "Hot takes on this piece" — an instant-camera widget for the article page.
 *
 * Only the takes tied to the article you're reading show up. They cycle
 * through the viewfinder; the shutter advances with a flash. ← / → also step,
 * and every control is a 44px tap target. Motion is skipped when the visitor
 * prefers reduced motion.
 */
export default function HotTakesCamera({ slug }) {
  const reduceMotion = useReducedMotion();
  // Only this article's takes — fetched per slug, not filtered client-side.
  const { data: mine = [] } = useQuery({
    queryKey: ["hot-takes", slug],
    queryFn: () => blogAPI.getHotTakesForArticle(slug),
    enabled: !!slug,
  });

  const count = mine.length;
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [slug]);

  const step = (dir) => {
    if (count < 2) return;
    setIndex((i) => (((i + dir) % count) + count) % count);
    if (!reduceMotion) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 200);
    }
  };

  useEffect(() => {
    if (count < 2) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, reduceMotion]);

  if (!count) return null;
  const take = mine[Math.min(index, count - 1)];
  // Only link out when the linked article is actually readable on the site.
  const linkSlug = takeLink(take);

  const arrow = (dir, Icon, label) =>
    count > 1 && (
      <button
        type="button"
        onClick={() => step(dir)}
        aria-label={label}
        className="w-11 h-11 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors active:scale-90"
        style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
      >
        <Icon className="w-4 h-4" />
      </button>
    );

  return (
    <section className="mt-14 mb-4" aria-label="Hot takes on this article">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif-display text-xl font-bold flex items-center gap-2">
          <Flame className="w-4 h-4" style={{ color: "var(--accent-color, #78716c)" }} />
          hot takes on this piece
        </h2>
        <span className="font-body text-xs opacity-40">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
      </div>

      <div
        className="relative mx-auto w-full max-w-sm rounded-[28px] overflow-hidden"
        style={{ backgroundColor: "#0b0b0b", border: "1px solid rgba(255,255,255,0.10)" }}
      >
        {/* Camera top bar */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--accent-color, #78716c)" }} />
          <p className="font-body text-[11px] tracking-wide text-zinc-400 flex items-center gap-1.5 uppercase">
            <Camera className="w-3 h-3" /> take {String(index + 1).padStart(2, "0")}
          </p>
          <span className="ml-auto font-body text-[10px] text-zinc-500">
            {linkSlug ? "linked to this article" : "hot off the press"}
          </span>
        </div>

        {/* Viewfinder — the take itself */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={take.id}
              initial={reduceMotion ? false : { opacity: 0, scale: 1.03, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="px-6 py-10 min-h-[220px] flex items-center"
            >
              <p className="font-serif-display text-2xl leading-snug text-zinc-50">
                “{take.take}”
              </p>
            </motion.blockquote>
          </AnimatePresence>

          {/* Shutter flash */}
          <AnimatePresence>
            {flash && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="pointer-events-none absolute inset-0 bg-white"
                aria-hidden="true"
              />
            )}
          </AnimatePresence>
        </div>

        {/* Film strip progress */}
        {count > 1 && (
          <div className="px-4 flex gap-1.5" aria-hidden="true">
            {mine.map((t, i) => (
              <span
                key={t.id}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{
                  backgroundColor: i === index ? "var(--accent-color, #78716c)" : "rgba(255,255,255,0.18)",
                }}
              />
            ))}
          </div>
        )}

        {/* Controls — the shutter advances to the next take */}
        {count > 1 && (
          <div className="px-4 py-4 flex items-center gap-3">
            {arrow(-1, ChevronLeft, "Previous take")}

            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Take the next hot take"
              className="relative flex-1 min-h-11 rounded-full flex items-center justify-center gap-2 font-body text-sm font-medium active:scale-[0.98] transition-transform"
              style={{ backgroundColor: "#f0ebe3", color: "#0b0b0b" }}
            >
              <Camera className="w-4 h-4" />
              next take
            </button>

            {arrow(1, ChevronRight, "Next take")}
          </div>
        )}

        {/* Read the take */}
        {linkSlug && (
          <Link
            to={createPageUrl(`BlogPost?slug=${encodeURIComponent(linkSlug)}`)}
            className="flex items-center justify-center gap-1.5 px-4 py-3 font-body text-xs text-zinc-300 hover:text-white border-t transition-colors"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            read the take <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </section>
  );
}
