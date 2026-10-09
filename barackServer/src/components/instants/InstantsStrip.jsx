import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Zap, X } from "lucide-react";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");
const slugFromUrl = () => new URLSearchParams(window.location.search).get("slug") || "";

/**
 * "Moments from this story" — a live strip under each article showing instants
 * linked to what you're reading (explicit link_url match, or tag/slug keyword
 * match on the backend). Reading pulls you into moments; moments live-update
 * over SSE while the page is open, Instagram-inbox style.
 */
export default function InstantsStrip() {
  const slug = slugFromUrl();
  const [instants, setInstants] = useState(null); // null = loading
  const [hasNew, setHasNew] = useState(false);
  const [viewing, setViewing] = useState(null); // instant open in the mini viewer
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    fetch(`${BASE}/articles/${encodeURIComponent(slug)}/instants`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => alive && setInstants(Array.isArray(rows) ? rows : []))
      .catch(() => alive && setInstants([]));

    // Filter the global stream down to instants that match this story's keywords
    const es = new EventSource(`${BASE}/instants/stream`);
    const refetch = () => {
      fetch(`${BASE}/articles/${encodeURIComponent(slug)}/instants`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => {
          if (!alive) return;
          setInstants((prev) => {
            if (!Array.isArray(rows) || rows.length === (prev || []).length) return prev;
            // a genuinely new matching instant arrives → flash the "new" pill
            if (prev && rows.length > prev.length) setHasNew(true);
            return rows;
          });
        })
        .catch(() => {});
    };
    let timer = null;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(refetch, 400);
    };
    es.addEventListener("instant:new", debounced);
    es.addEventListener("instant:update", debounced);
    es.addEventListener("instant:remove", debounced);
    return () => {
      alive = false;
      clearTimeout(timer);
      es.close();
    };
  }, [slug]);

  if (!instants || instants.length === 0) return null;

  return (
    <section className="mt-14 mb-4">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif-display text-xl font-bold flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: "var(--accent-color, #78716c)" }} />
          moments from this story
          {hasNew && (
            <motion.span
              initial={{ scale: reduceMotion ? 1 : 0 }}
              animate={{ scale: 1 }}
              className="font-body text-[10px] px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: "var(--accent-color, #78716c)" }}
            >
              new
            </motion.span>
          )}
        </h2>
        <span className="font-body text-xs opacity-40">{instants.length} live</span>
      </div>

      <div
        className="flex gap-3 overflow-x-auto pb-3 snap-x"
        style={{ scrollbarWidth: "thin" }}
      >
        <AnimatePresence initial={false}>
          {instants.map((instant, i) => (
            <motion.button
              key={instant.id}
              layout
              type="button"
              onClick={() => setViewing(instant)}
              initial={reduceMotion ? false : { opacity: 0, y: 16, rotate: i % 2 ? 1.4 : -1.4 }}
              animate={{ opacity: 1, y: 0, rotate: i % 2 ? 1 : -1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.35, delay: reduceMotion ? 0 : Math.min(i * 0.04, 0.3) }}
              whileTap={reduceMotion ? undefined : { scale: 0.96, rotate: 0 }}
              className="shrink-0 w-44 sm:w-52 snap-start text-left font-body rounded-[24px] overflow-hidden relative group"
              style={{
                backgroundColor: "#0b0b0b",
                color: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(255,255,255,0.12)",
                aspectRatio: "4 / 5",
              }}
            >
              {instant.image_url ? (
                <img
                  src={instant.image_url}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ filter: "saturate(1.05)" }}
                />
              ) : (
                <div className="absolute inset-0 p-3 flex items-center overflow-hidden">
                  <p className="text-xs leading-snug whitespace-pre-wrap break-words line-clamp-6">
                    {instant.text}
                  </p>
                </div>
              )}
              {instant.image_url && instant.text && (
                <p className="absolute bottom-0 inset-x-0 px-3 pb-2.5 pt-6 text-[10px] leading-snug line-clamp-2"
                  style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}
                >
                  {instant.text}
                </p>
              )}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Mini immersive viewer — tap a tile, step through the matching moments */}
      <AnimatePresence>
        {viewing && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.92)" }}
            onClick={() => setViewing(null)}
          >
            <motion.div
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative max-h-[86vh] max-w-[92vw] sm:max-w-md w-full rounded-[28px] overflow-hidden"
              style={{ backgroundColor: "#0b0b0b", border: "1px solid rgba(255,255,255,0.14)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close viewer"
                onClick={() => setViewing(null)}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-full text-white/70 hover:text-white"
                style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
              >
                <X className="w-4 h-4" />
              </button>
              {viewing.image_url ? (
                <img
                  src={viewing.image_url}
                  alt=""
                  className="w-full max-h-[70vh] object-contain"
                  style={{ backgroundColor: "#0b0b0b" }}
                />
              ) : (
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words" style={{ color: "rgba(255,255,255,0.92)" }}>
                    {viewing.text}
                  </p>
                </div>
              )}
              {viewing.text && viewing.image_url && (
                <p className="px-4 py-3 text-xs leading-snug whitespace-pre-wrap break-words" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {viewing.text}
                </p>
              )}
              {/* step through siblings */}
              {instants.length > 1 && (
                <div
                  className="px-4 pb-3 flex gap-1.5"
                  aria-hidden="true"
                >
                  {instants.map((it) => (
                    <span
                      key={it.id}
                      className="h-1 flex-1 rounded-full"
                      style={{
                        backgroundColor: it.id === viewing.id ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.25)",
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
