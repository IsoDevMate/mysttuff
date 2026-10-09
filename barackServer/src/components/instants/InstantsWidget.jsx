import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Send, MessageCircle, Sparkles } from "lucide-react";
import { blogAPI } from "@/api/blogAPI";
import { createPageUrl } from "@/lib/utils";

/**
 * Instants — a Locket-style floating widget.
 *
 * - A pulsing zap bubble sits above the bottom-right corner on every page.
 * - Opening it reveals the live feed: new instants arrive in realtime over
 *   SSE (Server-Sent Events) — no refresh, like photos popping onto a Locket.
 * - Every instant is a "thought bubble": readers can add their own thoughts.
 * - Reading is open to everyone; posting a thought requires being on the
 *   waitlist (unknown emails are auto-added as pending, like asking to join).
 */
export default function InstantsWidget() {
  const [open, setOpen] = useState(false);
  const [instants, setInstants] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [activeId, setActiveId] = useState(null); // instant whose thoughts are open
  const [thoughts, setThoughts] = useState([]);
  const [thoughtForm, setThoughtForm] = useState({ author_name: "", email: "", body: "" });
  const [thoughtMsg, setThoughtMsg] = useState(null);
  const [sending, setSending] = useState(false);
  const seenIds = useRef(new Set());
  const feedRef = useRef(null);

  // Initial load
  useEffect(() => {
    let alive = true;
    blogAPI
      .getInstants(50)
      .then((rows) => {
        if (!alive) return;
        rows.forEach((r) => seenIds.current.add(r.id));
        setInstants(rows);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  // Realtime: Server-Sent Events with automatic reconnect (browser-native)
  useEffect(() => {
    const base = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");
    const es = new EventSource(`${base}/instants/stream`);

    const upsert = (row) => {
      if (seenIds.current.has(row.id)) {
        if (row.published === 0) {
          setInstants((prev) => prev.filter((i) => i.id !== row.id));
        } else {
          setInstants((prev) => prev.map((i) => (i.id === row.id ? row : i)));
        }
      } else if (row.published !== 0) {
        seenIds.current.add(row.id);
        setInstants((prev) => [row, ...prev]);
      }
    };

    es.addEventListener("instant:new", (e) => e.data && upsert(JSON.parse(e.data)));
    es.addEventListener("instant:update", (e) => e.data && upsert(JSON.parse(e.data)));
    es.addEventListener("instant:remove", (e) => {
      if (!e.data) return;
      const { id } = JSON.parse(e.data);
      seenIds.current.delete(id);
      setInstants((prev) => prev.filter((i) => i.id !== id));
    });
    es.addEventListener("thought:new", (e) => {
      if (!e.data) return;
      const { instantId, thought } = JSON.parse(e.data);
      if (instantId === activeId) {
        setThoughts((prev) => [...prev.filter((t) => t.id !== thought.id), thought]);
      }
    });

    return () => es.close();
  }, [activeId]);

  const openThoughts = useCallback(async (instantId) => {
    setActiveId(instantId);
    setThoughtMsg(null);
    try {
      setThoughts(await blogAPI.getThoughts(instantId));
    } catch {
      setThoughts([]);
    }
  }, []);

  const submitThought = async (e) => {
    e.preventDefault();
    if (!activeId) return;
    setSending(true);
    setThoughtMsg(null);
    try {
      const res = await blogAPI.postThought(activeId, thoughtForm);
      if (res.queued) {
        setThoughtMsg({ kind: "waitlist", text: res.message });
        setThoughtForm((f) => ({ ...f, body: "" }));
      } else {
        setThoughts((prev) => [...prev, res]);
        setThoughtForm((f) => ({ ...f, body: "" }));
        setThoughtMsg({ kind: "ok", text: "Thought added" });
      }
    } catch (err) {
      setThoughtMsg({ kind: "error", text: err.message || "Could not send" });
    } finally {
      setSending(false);
    }
  };

  const timeAgo = (iso) => {
    const then = new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
    const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  };

  // "expires in 3h" countdown — instants are ephemeral, Instagram-style
  const expiresLabel = (iso) => {
    const then = new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
    const mins = Math.round((then - Date.now()) / 60000);
    if (mins <= 0) return null;
    if (mins < 60) return `${mins}m left`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h left`;
    return `${Math.round(hrs / 24)}d left`;
  };

  // Drop expired instants from the feed without waiting for the next fetch
  useEffect(() => {
    const t = setInterval(() => {
      setInstants((prev) => {
        const alive = prev.filter((i) => !i.expires_at || new Date(i.expires_at) > new Date());
        return alive.length === prev.length ? prev : alive;
      });
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const activeInstant = instants.find((i) => i.id === activeId);

  return (
    <>
      {/* Floating trigger — bottom-right, above everything */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.2, type: "spring", stiffness: 260, damping: 18 }}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close instants" : "Open instants"}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{
          backgroundColor: "var(--accent-color, #78716c)",
          color: "var(--bg-color, #FAF3E8)",
        }}
      >
        {open ? <X className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
        {!open && loaded && instants.length > 0 && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-20 pointer-events-none"
            style={{ backgroundColor: "var(--accent-color, #78716c)" }}
          />
        )}
      </motion.button>

      {/* The feed panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-5 z-40 w-[min(92vw,380px)] max-h-[70vh] rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
            style={{
              backgroundColor: "var(--bg-color, #FAF3E8)",
              borderColor: "var(--text-color, #292524)" + "20",
              color: "var(--text-color, #292524)",
            }}
          >
            {/* Header */}
            <div
              className="px-4 py-3 border-b flex items-center gap-2 shrink-0"
              style={{ borderColor: "var(--text-color, #292524)" + "15" }}
            >
              <Sparkles className="w-4 h-4 opacity-60" />
              <p className="font-serif-display font-bold text-sm">instants</p>
              <span className="font-body text-[10px] opacity-50 flex items-center gap-1 ml-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                live
              </span>
            </div>

            {/* Feed */}
            <div ref={feedRef} className="overflow-y-auto p-3 space-y-2.5 flex-1">
              {!loaded ? (
                <p className="font-body text-xs opacity-40 text-center py-8">loading…</p>
              ) : instants.length === 0 ? (
                <p className="font-body text-xs opacity-40 text-center py-8">
                  no instants yet — the first spark lands here
                </p>
              ) : (
                <AnimatePresence initial={false}>
                  {instants.map((instant) => (
                    <motion.div
                      key={instant.id}
                      layout
                      initial={{ opacity: 0, y: -12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                      className={`rounded-xl border p-3 font-body ${
                        activeId === instant.id ? "ring-1" : ""
                      }`}
                      style={{
                        borderColor: "var(--text-color, #292524)" + "18",
                        backgroundColor: "var(--text-color, #292524)" + "06",
                      }}
                    >
                      {instant.text && (
                        <p className="text-sm leading-snug whitespace-pre-wrap break-words">
                          {instant.text}
                        </p>
                      )}
                      {instant.image_url && (
                        <img
                          src={instant.image_url}
                          alt=""
                          loading="lazy"
                          className="mt-2 rounded-lg max-h-56 w-full object-cover"
                        />
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] opacity-40">
                          {timeAgo(instant.created_at)}
                          {instant.expires_at && expiresLabel(instant.expires_at) && (
                            <span className="ml-1.5" style={{ color: "var(--accent-color, #78716c)" }}>
                              · {expiresLabel(instant.expires_at)}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
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
                          <button
                            onClick={() =>
                              activeId === instant.id ? setActiveId(null) : openThoughts(instant.id)
                            }
                            className="text-[10px] flex items-center gap-1 opacity-60 hover:opacity-100"
                          >
                            <MessageCircle className="w-3 h-3" /> think along
                          </button>
                        </div>
                      </div>

                      {/* Thought thread */}
                      {activeId === instant.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          className="mt-3 pt-3 border-t overflow-hidden"
                          style={{ borderColor: "var(--text-color, #292524)" + "15" }}
                        >
                          {thoughts.length > 0 && (
                            <div className="space-y-2 mb-3">
                              {thoughts.map((t) => (
                                <div key={t.id} className="text-xs">
                                  <span className="font-medium">{t.author_name}</span>
                                  <span className="opacity-70"> {t.body}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <form onSubmit={submitThought} className="space-y-1.5">
                            <input
                              required
                              value={thoughtForm.author_name}
                              onChange={(e) => setThoughtForm((f) => ({ ...f, author_name: e.target.value }))}
                              placeholder="your name"
                              className="w-full text-xs px-2 py-1.5 rounded-lg border bg-transparent outline-none focus:ring-1"
                              style={{ borderColor: "var(--text-color, #292524)" + "25" }}
                            />
                            <input
                              required
                              type="email"
                              value={thoughtForm.email}
                              onChange={(e) => setThoughtForm((f) => ({ ...f, email: e.target.value }))}
                              placeholder="email — new folks join the waitlist"
                              className="w-full text-xs px-2 py-1.5 rounded-lg border bg-transparent outline-none focus:ring-1"
                              style={{ borderColor: "var(--text-color, #292524)" + "25" }}
                            />
                            <div className="flex gap-1.5">
                              <input
                                required
                                value={thoughtForm.body}
                                onChange={(e) => setThoughtForm((f) => ({ ...f, body: e.target.value }))}
                                placeholder="your thought…"
                                className="flex-1 text-xs px-2 py-1.5 rounded-lg border bg-transparent outline-none focus:ring-1"
                                style={{ borderColor: "var(--text-color, #292524)" + "25" }}
                              />
                              <button
                                type="submit"
                                disabled={sending}
                                className="px-2.5 rounded-lg flex items-center justify-center disabled:opacity-40"
                                style={{ backgroundColor: "var(--accent-color, #78716c)", color: "var(--bg-color, #FAF3E8)" }}
                              >
                                <Send className="w-3 h-3" />
                              </button>
                            </div>
                            {thoughtMsg && (
                              <p
                                className={`text-[10px] ${
                                  thoughtMsg.kind === "error" ? "text-red-500" : "opacity-60"
                                }`}
                              >
                                {thoughtMsg.text}
                              </p>
                            )}
                          </form>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <p
              className="px-4 py-2 text-[10px] font-body opacity-40 border-t shrink-0"
              style={{ borderColor: "var(--text-color, #292524)" + "12" }}
            >
              sparks & concepts I meet during the day —{" "}
              <a
                href={createPageUrl("Recap")}
                onClick={() => setOpen(false)}
                className="underline hover:opacity-100"
              >
                browse the recap
              </a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
