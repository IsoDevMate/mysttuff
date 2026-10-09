import React, { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isThisWeek } from "date-fns";
import { ArrowLeft, Zap, Heart } from "lucide-react";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");

const MONTHS_ORDER_RECENT_FIRST = (a, b) => (a < b ? 1 : -1);

/**
 * Recap — the public archive of every instant ever captured, grouped by
 * month. Instagram lets you compile disappearing Instants into a Recap;
 * here the archive is always browsable even though the live feed expires.
 */
export default function Recap() {
  // The recap endpoint returns every published instant ever — including expired ones
  const { data: all = [], isLoading } = useQuery({
    queryKey: ["instants-recap"],
    queryFn: async () => {
      const base = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");
      const res = await fetch(`${base}/instants/recap`);
      if (!res.ok) throw new Error("recap fetch failed");
      return res.json();
    },
  });

  // ── Creator-only grid: Today / This week with real reaction counts ──
  // The admin token doubles as the creator key (same as the capture flow).
  const isAdmin = !!localStorage.getItem("adminToken");
  const [reactions, setReactions] = useState({});
  useEffect(() => {
    if (!isAdmin || !all.length) return;
    let alive = true;
    fetch(`${BASE}/admin/reaction-summary`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
    })
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => alive && setReactions(data || {}))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isAdmin, all.length]);

  const { today, thisWeek } = useMemo(() => {
    const withCount = (i) =>
      (reactions[i.id] || []).reduce((sum, r) => sum + Number(r.count || 0), 0);
    const parse = (i) => new Date(i.created_at.endsWith("Z") ? i.created_at : i.created_at + "Z");
    const sorted = [...all].sort((a, b) => parse(b) - parse(a));
    return {
      today: sorted.filter((i) => isToday(parse(i))),
      thisWeek: sorted.filter((i) => !isToday(parse(i)) && isThisWeek(parse(i), { weekStartsOn: 1 })),
    };
  }, [all, reactions]);

  const creatorGrid = (title, items) =>
    items.length === 0 ? null : (
      <section className="mb-10 rounded-2xl border p-5" style={{ borderColor: "var(--text-color, #292524)" + "20", backgroundColor: "var(--text-color, #292524)" + "04" }}>
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="font-serif-display text-xl font-bold">{title}</h2>
          <span className="font-body text-xs opacity-40">{items.length} · your private view</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {items.map((i) => {
            const rcs = reactions[i.id] || [];
            const total = rcs.reduce((s, r) => s + Number(r.count || 0), 0);
            const top = rcs.slice().sort((a, b) => b.count - a.count)[0];
            return (
              <Link
                key={i.id}
                to={createPageUrl("Gallery")}
                className="relative rounded-[20px] overflow-hidden group aspect-[4/5]"
                style={{ backgroundColor: "var(--text-color, #292524)" + "08" }}
                title={i.text || ""}
              >
                {i.image_url ? (
                  <img src={i.image_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 p-2.5 flex items-center">
                    <p className="text-[10px] leading-snug line-clamp-5 whitespace-pre-wrap break-words font-body">{i.text}</p>
                  </div>
                )}
                {total > 0 && (
                  <span
                    className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-body text-white"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    {top?.emoji} {rcs.find((r) => r.emoji === top?.emoji)?.count}
                    {rcs.length > 1 && <span style={{ marginLeft: 2 }}><Heart className="w-2.5 h-2.5 inline" /> {total}</span>}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <p className="font-body text-[10px] opacity-35 mt-3">
          reaction counts update as visitors respond · compile these into a recap when the moment feels right
        </p>
      </section>
    );

  const groups = useMemo(() => {
    const byMonth = {};
    all.forEach((i) => {
      const key = format(new Date(i.created_at.endsWith("Z") ? i.created_at : i.created_at + "Z"), "MMMM yyyy");
      if (!byMonth[key]) byMonth[key] = [];
      byMonth[key].push(i);
    });
    return Object.entries(byMonth).sort(([a], [b]) => MONTHS_ORDER_RECENT_FIRST(a, b));
  }, [all]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
      <header className="py-12">
        <Link
          to={createPageUrl("Home")}
          className="font-body text-sm opacity-50 hover:opacity-100 transition-opacity inline-flex items-center gap-1.5 mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> back home
        </Link>
        <h1 className="font-serif-display text-5xl md:text-6xl font-bold mb-4">Recap</h1>
        <p className="font-body text-lg opacity-60">
          Every spark I've captured — words, concepts, links worth keeping. The live feed shows
          recent ones; this is the whole story.
        </p>
      </header>

      {isAdmin && (today.length > 0 || thisWeek.length > 0) && (
        <div className="mb-8">
          {creatorGrid("today", today)}
          {creatorGrid("this week", thisWeek)}
        </div>
      )}

      {isLoading || (!all.length && !groups.length) ? (
        <div className="space-y-6">
          {[1, 2, 3].map((m) => (
            <div key={m}>
              <div className="h-5 w-40 bg-current/10 rounded animate-pulse mb-4" />
              <div className="h-16 bg-current/5 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="py-20 text-center">
          <Zap className="w-8 h-8 mx-auto opacity-20 mb-4" />
          <p className="font-body opacity-40">No instants captured yet.</p>
        </div>
      ) : (
        <div className="space-y-14">
          {groups.map(([month, items]) => (
            <section key={month}>
              <div className="flex items-baseline gap-3 mb-5 border-b pb-3" style={{ borderColor: "var(--text-color, #292524)" + "20" }}>
                <h2 className="font-serif-display text-2xl font-bold">{month}</h2>
                <span className="font-body text-xs opacity-40">{items.length}</span>
              </div>
              <div className="space-y-4">
                {items.map((instant) => (
                  <article
                    key={instant.id}
                    className="rounded-xl border p-4 font-body"
                    style={{
                      borderColor: "var(--text-color, #292524)" + "18",
                      backgroundColor: "var(--text-color, #292524)" + "05",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Zap className="w-3.5 h-3.5 mt-1 opacity-40 shrink-0" style={{ color: "var(--accent-color, #78716c)" }} />
                      <div className="flex-1 min-w-0">
                        {instant.text && (
                          <p className="text-sm leading-snug whitespace-pre-wrap break-words">{instant.text}</p>
                        )}
                        {instant.image_url && (
                          <img
                            src={instant.image_url}
                            alt=""
                            loading="lazy"
                            className="mt-3 rounded-lg max-h-72 w-auto max-w-full object-cover"
                          />
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] opacity-40">
                            {format(new Date(instant.created_at.endsWith("Z") ? instant.created_at : instant.created_at + "Z"), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                          {instant.link_url && (
                            <a
                              href={instant.link_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] underline opacity-50 hover:opacity-100"
                            >
                              source
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
