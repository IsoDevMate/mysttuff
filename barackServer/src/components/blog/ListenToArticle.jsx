import React, { useEffect, useMemo, useRef, useState } from "react";
import { Headphones, Pause, Play, Square, Turtle, Rabbit } from "lucide-react";

// Strip markdown down to plain speakable text: no URLs, fences, or markup.
const markdownToSpeech = (markdown = "") =>
  String(markdown)
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // images -> alt text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links -> label
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^[>\s-]+/gm, "") // quotes / list markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // bold
    .replace(/(\*|_)(.*?)\1/g, "$2") // italic
    .replace(/~~(.*?)~~/g, "$1") // strikethrough
    .replace(/\|/g, " ") // tables
    .replace(/\s+/g, " ")
    .trim();

// Chrome/Safari cut long utterances off (~15s), so queue the article as
// sentence-sized chunks instead of one giant utterance.
const chunkText = (text, maxLen = 220) => {
  const sentences = String(text).match(/[^.!?]+[.!?]+["']?\s*|[^.!?]+$/g) || [text];
  const chunks = [];
  let current = "";
  for (const s of sentences) {
    const piece = s.trim();
    if (!piece) continue;
    if ((current + " " + piece).trim().length > maxLen && current) {
      chunks.push(current.trim());
      current = piece;
    } else {
      current = (current + " " + piece).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
};

const RATES = [0.75, 1, 1.25, 1.5];

export default function ListenToArticle({ title = "", content = "" }) {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const chunks = useMemo(
    () => chunkText(`${title}. ${markdownToSpeech(content)}`),
    [title, content]
  );
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [rate, setRate] = useState(1);
  const indexRef = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const stop = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setPlaying(false);
    indexRef.current = 0;
    setChunkIndex(0);
  };

  const speakChunk = (i) => {
    if (!supported) return;
    if (i >= chunks.length) {
      setPlaying(false);
      indexRef.current = 0;
      setChunkIndex(0);
      return;
    }
    const utter = new SpeechSynthesisUtterance(chunks[i]);
    utter.rate = rateRef.current;
    utter.onend = () => {
      indexRef.current = i + 1;
      setChunkIndex(i + 1);
      speakChunk(i + 1);
    };
    utter.onerror = () => setPlaying(false);
    window.speechSynthesis.speak(utter);
  };

  const toggle = () => {
    if (!supported) return;
    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
    } else {
      // Resume where we paused; a fresh start when finished or never started.
      window.speechSynthesis.cancel();
      const i = indexRef.current >= chunks.length ? 0 : indexRef.current;
      indexRef.current = i;
      setChunkIndex(i);
      setPlaying(true);
      // cancel() is async in some browsers — a tick avoids eating chunk one.
      setTimeout(() => speakChunk(i), 50);
    }
  };

  // Stop speech when leaving the page or unmounting so audio never leaks.
  useEffect(() => {
    if (!open) return;
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [open]);

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!supported || chunks.length === 0) return null;

  const done = chunkIndex >= chunks.length;
  const pct = done ? 100 : Math.round((chunkIndex / Math.max(chunks.length, 1)) * 100);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full border font-body text-sm transition-opacity hover:opacity-100 opacity-70"
        style={{ borderColor: "var(--text-color, #292524)30" }}
        aria-label="Listen to this article"
      >
        <Headphones className="w-4 h-4" aria-hidden="true" />
        Listen to this article
      </button>
    );
  }

  return (
    <div
      className="border rounded-lg p-4 max-w-full"
      style={{ borderColor: "var(--text-color, #292524)20" }}
      aria-label="Audio player for this article"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          className="inline-flex items-center justify-center gap-2 min-h-11 min-w-11 px-4 rounded-full text-white font-body text-sm"
          style={{ backgroundColor: "var(--text-color, #292524)" }}
          aria-label={playing ? "Pause reading aloud" : "Play article audio"}
        >
          {playing ? (
            <Pause className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4" aria-hidden="true" />
          )}
          {playing ? "Pause" : chunkIndex > 0 && !done ? "Resume" : "Play"}
        </button>
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center justify-center gap-2 min-h-11 min-w-11 px-3 rounded-full border font-body text-sm opacity-70 hover:opacity-100"
          style={{ borderColor: "var(--text-color, #292524)30" }}
          aria-label="Stop and restart article audio"
        >
          <Square className="w-4 h-4" aria-hidden="true" />
          Restart
        </button>
        <div
          className="inline-flex items-center gap-1 ml-auto"
          role="group"
          aria-label="Reading speed"
        >
          <Turtle className="w-4 h-4 opacity-50" aria-hidden="true" />
          {RATES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRate(r)}
              aria-pressed={rate === r}
              className={`min-h-11 min-w-11 px-2 rounded-full font-body text-xs border ${
                rate === r ? "font-semibold" : "opacity-60"
              }`}
              style={{
                borderColor:
                  rate === r
                    ? "var(--text-color, #292524)"
                    : "var(--text-color, #292524)30",
              }}
            >
              {r}x
            </button>
          ))}
          <Rabbit className="w-4 h-4 opacity-50" aria-hidden="true" />
        </div>
        <button
          type="button"
          onClick={() => {
            stop();
            setOpen(false);
          }}
          className="min-h-11 min-w-11 px-3 rounded-full font-body text-sm opacity-50 hover:opacity-100"
          aria-label="Close audio player"
        >
          Close
        </button>
      </div>
      <div
        role="progressbar"
        aria-label="Listening progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-3 h-1 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--text-color, #292524)14" }}
      >
        <div
          className="h-full transition-[width] duration-300 motion-reduce:transition-none"
          style={{
            width: `${pct}%`,
            backgroundColor: "var(--accent-color, #78716c)",
          }}
        />
      </div>
      <p className="mt-2 font-body text-xs opacity-50">
        {done
          ? "Finished. Press Play to listen again."
          : playing
            ? `Reading part ${Math.min(chunkIndex + 1, chunks.length)} of ${chunks.length}…`
            : chunkIndex > 0
              ? `Paused at part ${chunkIndex + 1} of ${chunks.length}.`
              : `About a ${chunks.length}-part listen. Read aloud by your browser, no download needed.`}
      </p>
    </div>
  );
}
