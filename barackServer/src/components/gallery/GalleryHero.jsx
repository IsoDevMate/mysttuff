import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play } from "lucide-react";

/**
 * A manually browsed story cover for the Gallery. Visitors choose a frame and
 * move through it at their own pace; normal page scrolling stays untouched.
 */
const EASE = [0.22, 1, 0.36, 1];

const slideVariants = {
  enter: (dir) => ({ opacity: 0, scale: 1.04, x: dir * 40 }),
  center: { opacity: 1, scale: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, scale: 0.97, x: dir * -40 }),
};

export default function GalleryHero({ slides, onOpenItem, onExplore }) {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const goTo = useCallback(
    (index, dir) => {
      const count = slides.length;
      if (!count) return;
      const wrapped = ((index % count) + count) % count;
      setDirection(dir ?? (wrapped > active ? 1 : -1));
      setActive(wrapped);
    },
    [active, slides.length]
  );

  const next = useCallback(() => goTo(active + 1, 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1, -1), [active, goTo]);

  // Autoplay — resets on every slide change so each slide gets a full interval
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setTimeout(() => next(), 5000);
    return () => clearTimeout(t);
  }, [active, next, slides.length]);

  if (!slides.length) return null;
  const slide = slides[active];

  return (
    <section
      aria-label="Featured gallery stories"
      className="relative min-h-[min(780px,calc(100svh-5rem))] h-[min(780px,calc(100svh-5rem))] w-full overflow-hidden -mt-20"
      style={{ backgroundColor: "#0c0a09" }}
    >
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-hero-motion] { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      {/* Background slides */}
      <AnimatePresence mode="sync" custom={direction}>
        <motion.div
          key={active}
          data-hero-motion
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"          exit="exit"
          transition={{ duration: reducedMotion ? 0 : 0.35, ease: EASE }}

          className="absolute inset-0"
        >
          <img
            src={slide.src}
            alt={slide.title}
            draggable={false}
            className="h-full w-full object-cover object-center select-none"
          />
        </motion.div>
      </AnimatePresence>

      {/* Scrims — keep text readable */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to right, rgba(12,10,9,0.95) 0%, rgba(12,10,9,0.5) 45%, rgba(12,10,9,0) 75%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(12,10,9,1) 0%, rgba(12,10,9,0) 35%, rgba(12,10,9,0.3) 100%)" }}
      />

      {/* Left content panel — re-animates on every slide */}
      <div className="absolute inset-y-0 left-0 z-10 flex flex-col justify-center max-w-xl px-6 sm:px-10 lg:px-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            data-hero-motion
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: reducedMotion ? 0 : 0.35, ease: EASE }}
          >
            <p className="font-mono text-xs uppercase tracking-[0.2em] mb-4" style={{ color: "#f0ebe3", opacity: 0.55 }}>
              gallery · {slide.overline}
            </p>
            <h1
              className="font-serif-display text-4xl sm:text-5xl xl:text-6xl font-bold leading-[1.05] mb-4"
              style={{ color: "#f0ebe3" }}
            >
              {slide.title}
            </h1>
            <p className="font-body text-sm sm:text-base mb-8 max-w-md" style={{ color: "#f0ebe3", opacity: 0.65 }}>
              {slide.subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={onExplore}
                className="font-body text-sm min-h-11 px-6 rounded-lg transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#f0ebe3", color: "#0c0a09" }}
              >
                Explore the gallery
              </button>
              {slide.item && (
                <button
                  onClick={() => onOpenItem?.(slide.item, slide.mediaIndex)}
                  className="font-body text-sm min-h-11 px-6 rounded-lg border flex items-center justify-center gap-2 transition-colors hover:bg-white/10"
                  style={{ borderColor: "#f0ebe3" + "55", color: "#f0ebe3" }}
                >
                  <Play className="w-3.5 h-3.5" /> View
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Top-right counter */}
      <div className="absolute top-24 right-6 sm:right-10 z-10 font-mono text-xs tracking-[0.2em]" style={{ color: "#f0ebe3", opacity: 0.5 }}>
        {String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
      </div>

      {/* Scroll hint — only on the first slide */}
      <AnimatePresence>
        {active === 0 && (
          <motion.div
            data-hero-motion
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 1.5, duration: 0.6 }}
            className="absolute bottom-28 right-6 sm:right-10 z-10 flex flex-col items-center gap-2"
          >
            <span className="font-mono text-xs tracking-[0.2em]" style={{ color: "#f0ebe3", opacity: 0.5 }}>
              SCROLL
            </span>
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              className="w-px h-6"
              style={{ backgroundColor: "#f0ebe3", opacity: 0.5 }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frame picker */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-6 sm:px-10 lg:px-16 pb-6">
        <div className="flex gap-2 sm:gap-3 items-end overflow-x-auto">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              aria-current={i === active}
              className={`relative shrink-0 rounded overflow-hidden group transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                i === active
                  ? "h-16 w-24 sm:h-20 sm:w-32 opacity-100"
                  : "h-12 w-16 sm:h-16 sm:w-24 opacity-50 hover:opacity-80"
              }`}
              style={i === active ? { boxShadow: "0 0 0 2px var(--accent-color, #a8a29e)" } : {}}
            >
              <img
                src={s.src}
                alt=""
                draggable={false}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </button>
          ))}
        </div>
      </div>

    </section>
  );
}
