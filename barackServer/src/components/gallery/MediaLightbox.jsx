import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { isVideo } from "@/lib/gallery";

/**
 * Full-screen media lightbox. Shows an item's media (images + videos) as a
 * carousel: arrows, dot indicators, keyboard ← → and Esc, videos with controls.
 */
export default function MediaLightbox({ item, media = [], initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(Math.min(initialIndex, media.length - 1));

  useEffect(() => {
    setIndex(Math.min(initialIndex, Math.max(0, media.length - 1)));
  }, [item, initialIndex, media.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, media.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, media.length]);

  if (!item) return null;
  const current = media[index];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: "rgba(10,9,8,0.96)" }}
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="font-serif-display text-lg" style={{ color: "#f0ebe3" }}>
            {item.title}
          </p>
          {item.description && (
            <p className="font-body text-xs mt-0.5" style={{ color: "#f0ebe3", opacity: 0.55 }}>
              {item.description}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded-full transition-colors hover:bg-white/10"
          style={{ color: "#f0ebe3" }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Media stage */}
      <div
        className="relative flex-1 flex items-center justify-center px-4 sm:px-16 min-h-0"
        onClick={onClose}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => Math.max(i - 1, 0));
          }}
          disabled={index === 0}
          aria-label="Previous"
          className="absolute left-4 sm:left-8 p-2 rounded-full disabled:opacity-20 enabled:hover:bg-white/10 transition-colors"
          style={{ color: "#f0ebe3" }}
        >
          <ChevronLeft className="w-7 h-7" />
        </button>

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className="max-w-5xl max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {!current ? null : isVideo(current) ? (
              <video
                src={current.url}
                controls
                autoPlay
                className="max-h-[75vh] max-w-full rounded-lg"
              />
            ) : (
              <img
                src={current.url}
                alt={item.title}
                className="max-h-[75vh] max-w-full object-contain rounded-lg"
              />
            )}
          </motion.div>
        </AnimatePresence>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setIndex((i) => Math.min(i + 1, media.length - 1));
          }}
          disabled={index === media.length - 1}
          aria-label="Next"
          className="absolute right-4 sm:right-8 p-2 rounded-full disabled:opacity-20 enabled:hover:bg-white/10 transition-colors"
          style={{ color: "#f0ebe3" }}
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>

      {/* Dots / counter */}
      {media.length > 1 && (
        <div className="flex items-center justify-center gap-2 pb-6" onClick={(e) => e.stopPropagation()}>
          {media.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Media ${i + 1}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? 24 : 6,
                backgroundColor: "#f0ebe3",
                opacity: i === index ? 0.9 : 0.3,
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
