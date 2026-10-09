import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ChevronRight } from "lucide-react";
import { createPageUrl } from "@/lib/utils";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");

/**
 * "Instant film" strip at the top of the Gallery — a horizontal row of the
 * latest live instants, updating in realtime over SSE (Instagram-inbox style:
 * new captures slide in the moment they're fired).
 */
export default function InstantsFilm() {
  const [instants, setInstants] = useState(null); // null = still loading
  const [hasNew, setHasNew] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/instants?limit=12`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => alive && setInstants(rows))
      .catch(() => alive && setInstants([]));

    const es = new EventSource(`${BASE}/instants/stream`);
    const upsert = (row) => {
      setInstants((prev) => {
        const list = prev || [];
        if (list.some((i) => i.id === row.id)) {
          return row.published === 0 ? list.filter((i) => i.id !== row.id) : list.map((i) => (i.id === row.id ? row : i));
        }
        if (row.published !== 0) {
          setHasNew(true);
          return [row, ...list].slice(0, 12);
        }
        return list;
      });
    };
    es.addEventListener("instant:new", (e) => e.data && upsert(JSON.parse(e.data)));
    es.addEventListener("instant:update", (e) => e.data && upsert(JSON.parse(e.data)));
    es.addEventListener("instant:remove", (e) => {
      if (!e.data) return;
      const { id } = JSON.parse(e.data);
      setInstants((prev) => (prev || []).filter((i) => i.id !== id));
    });
    return () => {
      alive = false;
      es.close();
    };
  }, []);

  if (!instants || instants.length === 0) return null;

  return (
    <section className="pt-10 pb-2">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif-display text-xl font-bold flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: "var(--accent-color, #78716c)" }} />
          instant film
          {hasNew && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="font-body text-[10px] px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: "var(--accent-color, #78716c)" }}
            >
              new
            </motion.span>
          )}
        </h2>
        <Link
          to={createPageUrl("Recap")}
          className="font-body text-xs opacity-50 hover:opacity-100 transition-opacity inline-flex items-center gap-1"
        >
          recap <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 snap-x" style={{ scrollbarWidth: "thin" }}>
        <AnimatePresence initial={false}>
          {instants.map((instant) => (
            <motion.article
              key={instant.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="shrink-0 w-52 sm:w-60 snap-start rounded-xl border p-3 font-body"
              style={{
                borderColor: "var(--text-color, #292524)" + "18",
                backgroundColor: "var(--text-color, #292524)" + "05",
              }}
            >
              {instant.image_url && (
                <img
                  src={instant.image_url}
                  alt=""
                  loading="lazy"
                  className="rounded-lg w-full h-24 object-cover mb-2"
                />
              )}
              {instant.text && (
                <p className="text-xs leading-snug whitespace-pre-wrap break-words line-clamp-4">{instant.text}</p>
              )}
              {instant.link_url && (
                <a
                  href={instant.link_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] underline opacity-50 hover:opacity-100 mt-1.5 block truncate"
                >
                  {instant.link_url}
                </a>
              )}
              {instant.expires_at && (
                <p className="text-[9px] opacity-35 mt-1.5">
                  ephemeral — expires {new Date(instant.expires_at.endsWith("Z") ? instant.expires_at : instant.expires_at + "Z").toLocaleDateString()}
                </p>
              )}
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
