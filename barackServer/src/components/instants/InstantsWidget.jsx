import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, X, Send, MessageCircle, Sparkles, ChevronLeft, ChevronRight, Camera, Image as ImageIcon, RefreshCw, Circle, Loader2 } from "lucide-react";
import { useFlags, flagOn } from "../../lib/flags";
import { createPageUrl } from "../../lib/utils";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");

// Anonymous visitor id — random, per-browser, never an identity.
function visitorId() {
  let v = localStorage.getItem("visitorId");
  if (!v) {
    v = "v:" + crypto.randomUUID();
    localStorage.setItem("visitorId", v);
  }
  return v;
}

const REACTIONS = ["❤️", "😂", "🔥", "😮", "🥲", "👏"];

// Client-side downscale/compress — keep uploads small on mobile data.
async function compressToDataUrl(file, maxDim = 1080, quality = 0.82) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function timeAgo(iso) {
  const then = new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function expiresLabel(iso) {
  const then = new Date(iso.endsWith("Z") ? iso : iso + "Z").getTime();
  const mins = Math.round((then - Date.now()) / 60000);
  if (mins <= 0) return null;
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h left`;
  return `${Math.round(hrs / 24)}d left`;
}

/**
 * Instants — IG-instants-style floating widget.
 *
 * Feed opens as a dark card (Instagram-instants look): big rounded media,
 * emoji reaction row that toggles on tap, and free-form notes
 * (no name, no email — moderation is admin-side). Realtime over SSE.
 */
export default function InstantsWidget() {
  const { flags } = useFlags();
  const reactionsOn = flagOn(flags, "instants_reactions");
  const captureOn = flagOn(flags, "instants_capture");

  const [open, setOpen] = useState(false);
  const [capture, setCapture] = useState(null); // null | {mode:'camera'|'roll'|'none', preview, caption, sending, error, facing}
  const [instants, setInstants] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [viewing, setViewing] = useState(null); // instant open in IG-style viewer
  const [reactionCounts, setReactionCounts] = useState({}); // instantId -> {emoji: count}
  const [mine, setMine] = useState({}); // instantId -> Set(emoji)
  const [thoughts, setThoughts] = useState([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteMsg, setNoteMsg] = useState(null);
  const [sending, setSending] = useState(false);
  const seenIds = useRef(new Set());
  const vId = useRef(visitorId());
  const feedRef = useRef(null);
  const inFlight = useRef(new Set()); // "instantId:emoji" — serialize rapid toggles

  const addThought = (thought) =>
    setThoughts((prev) => (prev.some((t) => t.id === thought.id) ? prev : [...prev, thought]));

  // Initial load
  useEffect(() => {
    let alive = true;
    fetch(`${BASE}/instants?limit=50`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (!alive) return;
        rows.forEach((r) => seenIds.current.add(r.id));
        setInstants(rows);
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  // Reactions load — when enabled and feed loaded
  useEffect(() => {
    if (!reactionsOn || !loaded || instants.length === 0) return;
    let alive = true;
    (async () => {
      const counts = {};
      const my = {};
      await Promise.all(
        instants.slice(0, 20).map(async (inst) => {
          try {
            const r = await fetch(
              `${BASE}/instants/${inst.id}/reactions?visitor_id=${encodeURIComponent(vId.current)}`
            );
            if (!r.ok) return;
            const data = await r.json();
            counts[inst.id] = Object.fromEntries((data.counts || []).map((c) => [c.emoji, Number(c.count)]));
            my[inst.id] = new Set(data.mine || []);
          } catch { /* offline ok */ }
        })
      );
      if (!alive) return;
      setReactionCounts((prev) => ({ ...prev, ...counts }));
      setMine((prev) => ({ ...prev, ...my }));
    })();
    return () => {
      alive = false;
    };
  }, [reactionsOn, loaded, instants.length]);

  // Realtime: SSE
  useEffect(() => {
    const es = new EventSource(`${BASE}/instants/stream`);

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
      setViewing((v) => (v?.id === id ? null : v));
    });
    es.addEventListener("thought:new", (e) => {
      if (!e.data) return;
      const { instantId, thought } = JSON.parse(e.data);
      addThought(thought); // deduped — SSE may arrive before the POST response
    });
    es.addEventListener("thought:remove", (e) => {
      if (!e.data) return;
      const { thoughtId } = JSON.parse(e.data);
      setThoughts((prev) => prev.filter((t) => t.id !== thoughtId));
    });

    return () => es.close();
  }, []);

  const loadThoughts = useCallback(async (instantId) => {
    try {
      const r = await fetch(`${BASE}/instants/${instantId}/thoughts`);
      setThoughts(r.ok ? await r.json() : []);
    } catch {
      setThoughts([]);
    }
  }, []);

  const openThoughts = (instant) => {
    setViewing(instant);
    setNoteMsg(null);
    loadThoughts(instant.id);
  };

  const react = async (instant, emoji) => {
    // serialize rapid toggles against slow networks: ignore clicks while this
    // emoji's toggle is still in flight (previous state still authoritative).
    const key = `${instant.id}:${emoji}`;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);

    // optimistic toggle
    const had = mine[instant.id]?.has(emoji);
    setMine((prev) => {
      const set = new Set(prev[instant.id] || []);
      if (had) set.delete(emoji);
      else set.add(emoji);
      return { ...prev, [instant.id]: set };
    });
    setReactionCounts((prev) => {
      const cur = { ...(prev[instant.id] || {}) };
      cur[emoji] = Math.max(0, (cur[emoji] || 0) + (had ? -1 : 1));
      return { ...prev, [instant.id]: cur };
    });
    try {
      const r = await fetch(`${BASE}/instants/${instant.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, visitor_id: vId.current }),
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      setReactionCounts((prev) => ({
        ...prev,
        [instant.id]: Object.fromEntries((data.counts || []).map((c) => [c.emoji, Number(c.count)])),
      }));
    } catch {
      // roll back on failure
      setMine((prev) => {
        const set = new Set(prev[instant.id] || []);
        if (had) set.add(emoji);
        else set.delete(emoji);
        return { ...prev, [instant.id]: set };
      });
    } finally {
      inFlight.current.delete(key);
    }
  };

  const submitNote = async (e) => {
    e.preventDefault();
    if (!noteDraft.trim() || !viewing) return;
    setSending(true);
    try {
      const r = await fetch(`${BASE}/instants/${viewing.id}/thoughts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteDraft, visitor_id: vId.current }),
      });
      const res = await r.json();
      if (!r.ok) {
        setNoteMsg({ kind: "error", text: res.error || "Could not send" });
      } else {
        addThought(res); // deduped against the SSE echo
        setNoteDraft("");
        setNoteMsg(null);
      }
    } catch {
      setNoteMsg({ kind: "error", text: "Could not send" });
    } finally {
      setSending(false);
    }
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

  // ── Capture flow (flag-gated, admin-token verified like the canary check) ──
  // admin-check: same token the flags provider verified — cheap re-read.
  const isAdmin = !!localStorage.getItem("adminToken");

  const startCapture = async (mode) => {
    if (mode === "camera") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: capture?.facing || "user", width: { ideal: 1080 } },
          audio: false,
        });
        setCapture({ mode: "camera", stream, preview: null, caption: "", sending: false, error: null, facing: capture?.facing || "user" });
      } catch {
        setCapture({ mode: "none", preview: null, caption: "", sending: false, error: "camera unavailable — pick a photo instead", facing: "user" });
      }
    } else if (mode === "roll") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        compressToDataUrl(file).then((preview) =>
          setCapture({ mode: "roll", preview, caption: "", sending: false, error: null })
        );
      };
      input.click();
    } else {
      setCapture({ mode: "none", preview: null, caption: "", sending: false, error: null });
    }
  };

  const stopCamera = () => {
    capture?.stream?.getTracks().forEach((t) => t.stop());
  };

  const flipCamera = () => {
    const facing = capture?.facing === "user" ? "environment" : "user";
    stopCamera();
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing }, audio: false })
      .then((stream) => setCapture((c) => ({ ...c, stream, facing })))
      .catch(() => setCapture((c) => ({ ...c, facing }))); // keep old stream if flip fails
  };

  const shoot = () => {
    if (!capture?.stream) return;
    const video = document.createElement("video");
    video.srcObject = capture.stream;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      video.play();
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(1080, video.videoWidth);
      canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      stopCamera();
      setCapture((c) => ({ ...c, mode: "camera", stream: null, preview: canvas.toDataURL("image/jpeg", 0.82) }));
    };
  };

  const sendCapture = async () => {
    if (!capture?.preview && !capture?.caption.trim()) return;
    setCapture((c) => ({ ...c, sending: true, error: null }));
    try {
      const fd = new FormData();
      if (capture.preview) {
        const blob = await (await fetch(capture.preview)).blob();
        fd.append("file", blob, "instant.jpg");
      }
      if (capture.caption.trim()) fd.append("text", capture.caption.trim());
      const r = await fetch(`${BASE}/instants/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` },
        body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not post");
      upsert(data); // SSE may also echo it; upsert dedupes
      setCapture(null);
      setViewing(null);
    } catch (err) {
      setCapture((c) => ({ ...c, sending: false, error: err.message }));
    }
  };

  const neighbours = (inst) => {
    const idx = instants.findIndex((i) => i.id === inst.id);
    return {
      prev: idx > 0 ? instants[idx - 1] : null,
      next: idx >= 0 && idx < instants.length - 1 ? instants[idx + 1] : null,
    };
  };

  const reactionRow = (inst, large) =>
    reactionsOn && (
      <div className={`flex items-center ${large ? "gap-3" : "gap-1"} flex-wrap`}>
        {REACTIONS.map((emoji) => {
          const count = reactionCounts[inst.id]?.[emoji] || 0;
          const isMine = mine[inst.id]?.has(emoji);
          return (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                react(inst, emoji);
              }}
              aria-label={`react ${emoji}`}
              className={`flex items-center gap-1 rounded-full font-body transition-all active:scale-90 ${
                large ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-[11px]"
              } ${isMine ? "font-semibold" : ""}`}
              style={{
                backgroundColor: isMine
                  ? "rgba(255,255,255,0.18)"
                  : count > 0
                  ? "rgba(255,255,255,0.08)"
                  : "transparent",
                border: isMine ? "1px solid rgba(255,255,255,0.3)" : "1px solid transparent",
              }}
            >
              <span className={isMine ? "scale-110" : "opacity-80"}>{emoji}</span>
              {count > 0 && <span className="text-white/80">{count}</span>}
            </button>
          );
        })}
      </div>
    );

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

      {/* The feed panel — dark IG-instants look */}
      <AnimatePresence>
        {open && !viewing && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-5 z-40 w-[min(92vw,380px)] max-h-[70vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: "#0b0b0b", color: "#f4f4f5", border: "1px solid rgba(255,255,255,0.08)" }}
          >
          <div className="px-4 py-3 flex items-center gap-2 shrink-0 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <Sparkles className="w-4 h-4 text-zinc-400" />
            <p className="font-serif-display font-bold text-sm">instants</p>
            {captureOn && isAdmin && (
              <button
                onClick={() => startCapture("camera")}
                aria-label="capture an instant"
                className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-zinc-300 active:scale-90 transition-transform"
                style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
            <span className="font-body text-[10px] text-zinc-400 flex items-center gap-1" style={{ marginLeft: captureOn && isAdmin ? 8 : "auto" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              live
            </span>
          </div>

          <div ref={feedRef} className="overflow-y-auto p-3 space-y-4 flex-1" style={{ scrollbarWidth: "thin" }}>
            {!loaded ? (
              <p className="font-body text-xs text-zinc-500 text-center py-8">loading…</p>
            ) : instants.length === 0 ? (
              <p className="font-body text-xs text-zinc-500 text-center py-8">
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
                  >
                    <button
                      onClick={() => openThoughts(instant)}
                      className="block w-full text-left group"
                      aria-label="open instant"
                    >
                      {/* stacked squircle: tinted ghost cards behind, soft rotation */}
                      <div className="relative">
                        <div
                          className="absolute inset-x-3 -bottom-1 h-6 rounded-[26px]"
                          style={{ background: "rgba(255,255,255,0.05)", transform: "rotate(-1.6deg)" }}
                          aria-hidden="true"
                        />
                        <div
                          className="absolute inset-x-1.5 -bottom-0.5 h-6 rounded-[28px]"
                          style={{ background: "rgba(255,255,255,0.09)", transform: "rotate(1.1deg)" }}
                          aria-hidden="true"
                        />
                        <div
                          className="relative overflow-hidden transition-transform group-active:scale-[0.985]"
                          style={{
                            borderRadius: "28px",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                        {instant.image_url ? (
                          <img
                            src={instant.image_url}
                            alt=""
                            loading="lazy"
                            className="w-full max-h-80 object-cover aspect-[4/5]"
                          />
                        ) : (
                          <div className="w-full aspect-[4/5] max-h-80 flex items-center justify-center p-5"
                               style={{ background: "linear-gradient(145deg, #1c1c1e, #2a2a2c)" }}>
                            <p className="text-[15px] leading-snug whitespace-pre-wrap break-words text-zinc-100 font-body">
                              {instant.text}
                            </p>
                          </div>
                        )}
                        {instant.image_url && instant.text && (
                          <div className="absolute inset-x-0 bottom-0 p-4 pt-12 bg-gradient-to-t from-black/85 to-transparent">
                            <p className="text-[13px] leading-snug whitespace-pre-wrap break-words text-white">
                              {instant.text}
                            </p>
                          </div>
                        )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 px-1">
                        <span className="text-[10px] text-zinc-500">
                          {timeAgo(instant.created_at)}
                          {instant.expires_at && expiresLabel(instant.expires_at) && (
                            <span className="ml-1.5 text-amber-400/80">· {expiresLabel(instant.expires_at)}</span>
                          )}
                        </span>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MessageCircle className="w-3 h-3" /> notes & reactions
                        </span>
                      </div>
                    </button>
                    {reactionRow(instant, false)}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          <p
            className="px-4 py-2 text-[10px] font-body text-zinc-500 border-t shrink-0"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}
          >
            sparks & concepts I meet during the day —{" "}
            <a href={createPageUrl("Recap")} onClick={() => setOpen(false)} className="underline hover:text-zinc-300">
              browse the recap
            </a>
          </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* IG-style single-instant viewer */}
      <AnimatePresence>
        {open && viewing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-5 z-40 w-[min(92vw,380px)] max-h-[78vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: "#0b0b0b", color: "#f4f4f5", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* viewer header */}
            <div className="px-4 py-3 flex items-center gap-2 shrink-0 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <button
                onClick={() => setViewing(null)}
                className="text-zinc-400 hover:text-white"
                aria-label="back to feed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <p className="text-xs text-zinc-400 font-body">
                {timeAgo(viewing.created_at)}
                {viewing.expires_at && expiresLabel(viewing.expires_at) && (
                  <span className="ml-1.5 text-amber-400/80">· {expiresLabel(viewing.expires_at)}</span>
                )}
              </p>
              {viewing.link_url && (
                <a
                  href={viewing.link_url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto text-[11px] underline text-zinc-400 hover:text-white truncate max-w-[130px]"
                >
                  source
                </a>
              )}
            </div>

            <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: "thin" }}>
              {/* big rounded media / gradient placeholder */}
              <div className="p-3">
                <div className="relative rounded-[28px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  {viewing.image_url ? (
                    <img src={viewing.image_url} alt="" className="w-full aspect-[4/5] object-cover" />
                  ) : (
                    <div className="w-full aspect-[4/5] flex items-center justify-center p-6"
                         style={{ background: "linear-gradient(145deg, #1c1c1e, #2a2a2c)" }}>
                      <p className="text-base leading-snug whitespace-pre-wrap break-words text-zinc-100 font-body">
                        {viewing.text}
                      </p>
                    </div>
                  )}
                  {viewing.image_url && viewing.text && (
                    <div className="absolute inset-x-0 bottom-0 p-4 pt-14 bg-gradient-to-t from-black/85 to-transparent">
                      <p className="text-sm leading-snug whitespace-pre-wrap break-words text-white">
                        {viewing.text}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 px-1">
                  {reactionRow(viewing, true)}
                </div>
              </div>

              {/* notes thread */}
              <div className="px-4 pb-4">
                <p className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2 font-body">notes</p>
                <div className="space-y-2 mb-3">
                  {thoughts.length === 0 ? (
                    <p className="text-xs text-zinc-600">no notes yet — leave one, no name needed</p>
                  ) : (
                    thoughts.map((t) => (
                      <div key={t.id} className="text-xs leading-snug">
                        <span className="text-zinc-400">{t.author_name === "someone" || !t.author_name ? "" : t.author_name}</span>
                        <span className="text-zinc-100"> {t.body}</span>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={submitNote} className="flex gap-1.5">
                  <input
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="leave a note… (no name, no email)"
                    maxLength={1200}
                    className="flex-1 text-xs px-3 py-2.5 rounded-full bg-white/5 border outline-none focus:ring-1 text-white placeholder:text-zinc-600"
                    style={{ borderColor: "rgba(255,255,255,0.12)" }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !noteDraft.trim()}
                    aria-label="send note"
                    className="px-3 rounded-full flex items-center justify-center disabled:opacity-30"
                    style={{ backgroundColor: "#fafaf9", color: "#0b0b0b" }}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
                {noteMsg && (
                  <p className={`text-[10px] mt-1.5 ${noteMsg.kind === "error" ? "text-red-400" : "text-zinc-500"}`}>
                    {noteMsg.text}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Capture screen — camera/roll/none, squircle preview, shutter (flag-gated) */}
      <AnimatePresence>
        {open && capture && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-5 z-40 w-[min(92vw,380px)] max-h-[78vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: "#0b0b0b", color: "#f4f4f5", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="px-4 py-3 flex items-center gap-2 shrink-0 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <button
                onClick={() => { stopCamera(); setCapture(null); }}
                className="text-zinc-400 hover:text-white"
                aria-label="close capture"
              >
                <X className="w-5 h-5" />
              </button>
              <p className="text-xs text-zinc-400 font-body">new instant</p>
            </div>

            <div className="p-4 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
              {/* live camera or squircle preview */}
              {capture.mode === "camera" && capture.stream ? (
                <CameraLive stream={capture.stream} onShoot={shoot} />
              ) : capture.preview ? (
                <div className="relative">
                  <img
                    src={capture.preview}
                    alt="instant preview"
                    className="w-full aspect-[4/5] object-cover"
                    style={{ borderRadius: "28% 28% 30% 30% / 26% 26% 30% 30%" }}
                  />
                </div>
              ) : (
                <div
                  className="w-full aspect-[4/5] flex flex-col items-center justify-center gap-2 text-zinc-500"
                  style={{ background: "linear-gradient(145deg, #1c1c1e, #2a2a2c)", borderRadius: "28% 28% 30% 30% / 26% 26% 30% 30%" }}
                >
                  <Sparkles className="w-6 h-6" />
                  <p className="text-xs font-body text-center px-6">camera or roll, or just type below</p>
                </div>
              )}

              {/* shutter + flip + gallery row (pre-shot) */}
              {capture.mode === "camera" && capture.stream && (
                <div className="flex items-center justify-center gap-6 mt-4">
                  <button
                    onClick={flipCamera}
                    aria-label="flip camera"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={shoot}
                    aria-label="take the shot"
                    className="relative w-16 h-16 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                    style={{ backgroundColor: "#fafaf9" }}
                  >
                    <Circle className="w-12 h-12" style={{ color: "#0b0b0b", fill: "#0b0b0b" }} />
                  </button>
                  <button
                    onClick={() => startCapture("roll")}
                    aria-label="pick from gallery"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* caption + send */}
              {!capture.stream && (
                <div className="mt-4 flex gap-1.5">
                  <input
                    value={capture.caption}
                    onChange={(e) => setCapture((c) => ({ ...c, caption: e.target.value }))}
                    placeholder="say it in a few words (optional)"
                    maxLength={280}
                    className="flex-1 text-xs px-3 py-2.5 rounded-full bg-white/5 border outline-none focus:ring-1 text-white placeholder:text-zinc-600"
                    style={{ borderColor: "rgba(255,255,255,0.12)" }}
                  />
                  <button
                    onClick={sendCapture}
                    disabled={capture.sending || (!capture.preview && !capture.caption.trim())}
                    aria-label="post instant"
                    className="px-3.5 rounded-full flex items-center justify-center disabled:opacity-30 active:scale-95 transition-transform"
                    style={{ backgroundColor: "#fafaf9", color: "#0b0b0b" }}
                  >
                    {capture.sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              )}
              {capture.error && <p className="text-[10px] text-red-400 mt-2 font-body">{capture.error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Live camera preview in a squircle — the viewfinder.
function CameraLive({ stream, onShoot }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);
  return (
    <video
      ref={ref}
      muted
      playsInline
      className="w-full aspect-[4/5] object-cover"
      style={{ borderRadius: "28% 28% 30% 30% / 26% 26% 30% 30%", transform: "scaleX(-1)" }}
    />
  );
}
