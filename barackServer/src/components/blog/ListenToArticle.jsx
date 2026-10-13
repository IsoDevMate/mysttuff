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

// Prefer a usable English voice: browser default first, then en-US, then any en.
const pickVoice = (voices) => {
  if (!voices || !voices.length) return null;
  return (
    voices.find((v) => v.default && v.lang && v.lang.toLowerCase().startsWith("en")) ||
    voices.find((v) => v.default) ||
    voices.find((v) => v.lang && v.lang.toLowerCase() === "en-us") ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en")) ||
    voices[0]
  );
};

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
  const [voicesReady, setVoicesReady] = useState(false);
  const [error, setError] = useState("");
  const indexRef = useRef(0);
  const rateRef = useRef(rate);
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const voiceRef = useRef(null);
  const chunksRef = useRef(chunks);
  rateRef.current = rate;
  chunksRef.current = chunks;
  playingRef.current = playing;

  // Voices load async in most browsers — wait for them and pin one, or some
  // systems speak with no voice at all (silence with no error).
  useEffect(() => {
    if (!supported || !open) return;
    const synth = window.speechSynthesis;
    const load = () => {
      const voices = synth.getVoices();
      if (voices && voices.length) {
        voiceRef.current = pickVoice(voices);
        setVoicesReady(true);
        return true;
      }
      return false;
    };
    if (load()) return;
    const onVoices = () => load();
    synth.addEventListener("voiceschanged", onVoices);
    // Fallback poll — some browsers never fire voiceschanged.
    const timer = setInterval(() => {
      if (load()) clearInterval(timer);
    }, 500);
    const timeout = setTimeout(() => clearInterval(timer), 8000);
    return () => {
      synth.removeEventListener("voiceschanged", onVoices);
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [supported, open]);

  const speakChunk = (i) => {
    const synth = window.speechSynthesis;
    const list = chunksRef.current;
    if (i >= list.length) {
      setPlaying(false);
      pausedRef.current = false;
      indexRef.current = 0;
      setChunkIndex(0);
      return;
    }
    try {
      const utter = new SpeechSynthesisUtterance(list[i]);
      utter.rate = rateRef.current;
      utter.volume = 1;
      utter.pitch = 1;
      if (voiceRef.current) {
        utter.voice = voiceRef.current;
        utter.lang = voiceRef.current.lang;
      } else {
        utter.lang = "en-US";
      }
      utter.onend = () => {
        // Ignore the end event from an utterance we cancelled ourselves.
        if (!playingRef.current || pausedRef.current) return;
        indexRef.current = i + 1;
        setChunkIndex(i + 1);
        speakChunk(i + 1);
      };
      utter.onerror = (e) => {
        // Our own pause/stop calls surface as canceled/interrupted — not real failures.
        const kind = e && e.error;
        if (kind === "canceled" || kind === "interrupted") return;
        setPlaying(false);
        pausedRef.current = false;
        setError(
          kind === "not-allowed"
            ? "Your browser blocked the audio. Tap Play again to allow it."
            : "The voice stopped unexpectedly. Tap Play to try again."
        );
      };
      synth.speak(utter);
    } catch {
      setPlaying(false);
      pausedRef.current = false;
      setError("Reading aloud is not available in this browser.");
    }
  };

  // Watchdog: Chrome can go quietly idle mid-queue. If we think we're playing
  // but nothing is speaking and nothing is paused, re-speak the current chunk.
  // If the engine paused itself, resume it.
  useEffect(() => {
    if (!open || !playing) return;
    const timer = setInterval(() => {
      if (!playingRef.current) return;
      const synth = window.speechSynthesis;
      try {
        if (synth.paused) {
          synth.resume();
          return;
        }
        if (!synth.speaking) {
          synth.cancel();
          setTimeout(() => {
            if (playingRef.current) speakChunk(indexRef.current);
          }, 100);
        }
      } catch {
        /* watchdog must never break playback */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [open, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const startFrom = (i) => {
    const synth = window.speechSynthesis;
    setError("");
    pausedRef.current = false;
    try {
      synth.cancel();
    } catch {
      /* noop */
    }
    indexRef.current = i;
    setChunkIndex(i);
    setPlaying(true);
    // cancel() applies async in some browsers — a tick avoids eating the chunk.
    setTimeout(() => speakChunk(i), 120);
  };

  const toggle = () => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    if (playing) {
      // True pause: resume() continues mid-sentence instead of restarting the chunk.
      pausedRef.current = true;
      setPlaying(false);
      try {
        synth.pause();
      } catch {
        try {
          synth.cancel();
        } catch {
          /* noop */
        }
      }
    } else if (pausedRef.current && indexRef.current < chunksRef.current.length) {
      setError("");
      pausedRef.current = false;
      setPlaying(true);
      try {
        synth.resume();
      } catch {
        startFrom(indexRef.current);
      }
      // If resume produced no audio (engine dropped the queue), restart the chunk.
      setTimeout(() => {
        try {
          if (
            playingRef.current &&
            !window.speechSynthesis.speaking &&
            !window.speechSynthesis.paused
          ) {
            startFrom(indexRef.current);
          }
        } catch {
          /* noop */
        }
      }, 600);
    } else {
      const i =
        indexRef.current >= chunksRef.current.length ? 0 : indexRef.current;
      startFrom(i);
    }
  };

  const stop = () => {
    pausedRef.current = false;
    setError("");
    if (!supported) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* noop */
    }
    setPlaying(false);
    indexRef.current = 0;
    setChunkIndex(0);
  };

  const changeRate = (r) => {
    setRate(r);
    rateRef.current = r;
    // Apply immediately to what's being read.
    if (playingRef.current) startFrom(indexRef.current);
  };

  // Stop speech when the player closes, the page unmounts, or the tab hides.
  useEffect(() => {
    if (!open) return;
    const onHide = () => {
      if (document.hidden) {
        pausedRef.current = true;
        setPlaying(false);
        try {
          window.speechSynthesis.pause();
        } catch {
          /* noop */
        }
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    };
  }, [open]);

  useEffect(
    () => () => {
      try {
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      } catch {
        /* noop */
      }
    },
    []
  );

  if (!supported || chunks.length === 0) return null;

  const done = chunkIndex >= chunks.length && !playing && !pausedRef.current;
  const shownIndex = Math.min(chunkIndex, Math.max(chunks.length - 1, 0));
  const pct = done
    ? 100
    : Math.round((chunkIndex / Math.max(chunks.length, 1)) * 100);

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
          {playing ? "Pause" : chunkIndex > 0 ? "Resume" : "Play"}
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
              onClick={() => changeRate(r)}
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
      <p className="mt-2 font-body text-xs opacity-50" role="status">
        {error ||
          (done
            ? "Finished. Press Play to listen again."
            : playing
              ? `Reading part ${shownIndex + 1} of ${chunks.length}…`
              : chunkIndex > 0
                ? `Paused at part ${shownIndex + 1} of ${chunks.length}.`
                : voicesReady
                  ? `About a ${chunks.length}-part listen. Read aloud by your browser, no download needed.`
                  : "Loading a voice… if this sticks, your browser may have no speech voices installed. Press Play anyway to try.")}
      </p>
    </div>
  );
}
