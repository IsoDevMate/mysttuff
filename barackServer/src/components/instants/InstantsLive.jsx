import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ChevronRight, ArrowUpRight } from "lucide-react";
import { createPageUrl } from "@/lib/utils";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");

function timeLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt.endsWith("Z") ? expiresAt : expiresAt + "Z") - Date.now();
  if (ms <= 0) return "gone";
  const h = ms / 36e5;
  if (h >= 1) return `${Math.floor(h)}h left`;
  const m = Math.max(1, Math.round(ms / 6e4));
  return `${m}m left`;
}

function Card({ instant, big }) {
  const label = timeLeft(instant.expires_at);
  return (
    <div
      className="relative h-full rounded-2xl border p-4 font-body flex flex-col overflow-hidden"
      style={{
        borderColor: "var(--text-color, #292524)" + "18",
        backgroundColor: instant.image_url ? "transparent" : "var(--text-color, #292524)" + "05",
      }}
    >
      {instant.image_url && (
        <img
          src={instant.image_url}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {instant.image_url && instant.text && (
        <div className="absolute inset-x-0 bottom-0 p-4 pt-10 bg-gradient-to-t from-black/70 to-transparent" />
      )}
      <div className={instant.image_url && instant.text ? "relative mt-auto" : "relative"}>
        {instant.text && (
          <p
            className={`leading-snug whitespace-pre-wrap break-words ${
              big ? "text-base sm:text-lg" : "text-xs"
            } ${instant.image_url ? "text-white" : ""}`}
          >
            {instant.text}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {instant.link_url && (
            <a
              href={instant.link_url}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-0.5 text-[10px] underline opacity-70 hover:opacity-100 truncate max-w-[180px] ${
                instant.image_url ? "text-white opacity-90" : ""
              }`}
            >
              {instant.link_url.replace(/^https?:\/\//, "").split("/")[0]}
              <ArrowUpRight className="w-2.5 h-2.5 shrink-0" />
            </a>
          )}
          {label && (
            <span
              className={`text-[9px] uppercase tracking-wide ${
                instant.image_url ? "text-white/70" : "opacity-40"
              }`}
            >
              {label === "gone" ? "expired" : label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Homepage "live instants" section — realtime ephemeral captures.
 * Mobile: horizontal snap-scroll row. Desktop (lg+): bento mosaic
 * (first card spans 2×2, second spans 2 cols). Hidden when empty.
 */
export default function InstantsLive() {
  const [instants, setInstants] = useState(null);
  const [hasNew, setHasNew] = useState(false);
  const [, tick] = useState(0);

  // re-render every 30s so "3h left" countdowns stay honest
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/instants?limit=9`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => alive && setInstants(rows))
      .catch(() => alive && setInstants([]));

    const es = new EventSource(`${BASE}/instants/stream`);
    const upsert = (row) => {
      setInstants((prev) => {
        const list = prev || [];
        if (list.some((i) => i.id === row.id)) {
          return row.published === 0
            ? list.filter((i) => i.id !== row.id)
            : list.map((i) => (i.id === row.id ? row : i));
        }
        if (row.published !== 0) {
          setHasNew(true);
          return [row, ...list].slice(0, 9);
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
    <section aria-label="Live instants" className="py-4">
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="font-serif-display text-2xl font-bold text-stone-900 flex items-center gap-2.5">
          <span className="relative inline-flex w-4 h-4 items-center justify-center">
            <span
              className="absolute inline-flex w-3 h-3 rounded-full opacity-40 animate-ping"
              style={{ backgroundColor: "var(--accent-color, #78716c)" }}
            />
            <span
              className="relative inline-flex w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: "var(--accent-color, #78716c)" }}
            />
          </span>
          live instants
          {hasNew && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="font-body text-[10px] px-1.5 py-0.5 rounded-full text-white font-normal"
              style={{ backgroundColor: "var(--accent-color, #78716c)" }}
            >
              just dropped
            </motion.span>
          )}
        </h2>
        <Link
          to={createPageUrl("Recap")}
          className="font-body text-sm text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1"
        >
          the archive <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Mobile: snap-scroll film row */}
      <div className="lg:hidden -mx-6 px-6">
        <div className="flex gap-3 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: "none" }}>
          <AnimatePresence initial={false}>
            {instants.map((instant) => (
              <motion.article
                key={instant.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="shrink-0 w-64 snap-start"
              >
                <Card instant={instant} />
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Desktop: bento mosaic */}
      <div className="hidden lg:grid grid-cols-4 auto-rows-[8.5rem] gap-3">
        <AnimatePresence initial={false}>
          {instants.map((instant, idx) => {
            // mosaic placement: first card 2×2, second 2 wide, rest flow normally
            const span =
              idx === 0 ? "col-span-2 row-span-2" : idx === 1 ? "col-span-2" : "col-span-1";
            return (
              <motion.article
                key={instant.id}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.35, layout: { duration: 0.3 } }}
                className={span}
              >
                <Card instant={instant} big={idx < 2} />
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>

      <p className="font-body text-[11px] text-stone-400 mt-3">
        instants vanish when their timer runs out — what's here now is what's alive.
      </p>
    </section>
  );
}
