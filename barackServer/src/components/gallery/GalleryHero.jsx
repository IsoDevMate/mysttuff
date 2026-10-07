import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play } from "lucide-react";

/**
 * Netflix-style "story mode" hero for the Gallery.
 * - h-screen, stacked slides, direction-aware 0.75s transitions
 * - wheel hijack gated by an IntersectionObserver (only when ≥90% visible),
 *   700ms cooldown, and edge release so users are never trapped
 * - 5s autoplay with a linear progress bar riding the active thumbnail
 * - touch swipes on mobile
 */
const EASE = [0.22, 1, 0.36, 1];
const AUTOPLAY_MS = 5000;

const slideVariants = {
  enter: (dir) => ({ opacity: 0, scale: 1.04, x: dir * 40 }),
  center: { opacity: 1, scale: 1, x: 0 },
  exit: (dir) => ({ opacity: 0, scale: 0.97, x: dir * -40 }),
};

export default function GalleryHero({ slides, onOpenItem, onExplore }) {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState(1);
  const sectionRef = useRef(null);
  const fullyVisibleRef = useRef(false);
  const coolingRef = useRef(false);
  const touchStartRef = useRef(null);

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

  // The hero renders null while the gallery query loads — effects below must
  // re-run once the section actually mounts (hasSlides flips false → true).
  const hasSlides = slides.length > 0;

  // Autoplay — resets on every slide change so each slide gets a full interval
  useEffect(() => {
    if (!hasSlides || slides.length <= 1) return;
    const t = setTimeout(() => next(), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [active, next, slides.length, hasSlides]);

  // Only hijack the wheel while the hero fills the screen
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !hasSlides) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        fullyVisibleRef.current = entry.intersectionRatio >= 0.9;
      },
      { threshold: [0, 0.9, 1] }
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, [hasSlides]);

  // Wheel hijack with cooldown + edge release
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || slides.length <= 1) return;

    const onWheel = (e) => {
      if (!fullyVisibleRef.current) return;
      const down = e.deltaY > 0;
      // Never trap the user: release the page at the edges
      if ((down && active === slides.length - 1) || (!down && active === 0)) return;
      e.preventDefault();
      if (coolingRef.current) return;
      coolingRef.current = true;
      setTimeout(() => (coolingRef.current = false), 700);
      down ? next() : prev();
    };

    section.addEventListener("wheel", onWheel, { passive: false });
    return () => section.removeEventListener("wheel", onWheel);
  }, [active, next, prev, slides.length, hasSlides]);

  // Touch swipes (mobile)
  const onTouchStart = (e) => {
    touchStartRef.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartRef.current === null || slides.length <= 1) return;
    const delta = touchStartRef.current - e.changedTouches[0].clientY;
    touchStartRef.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta > 0 && active < slides.length - 1) next();
    else if (delta < 0 && active > 0) prev();
  };

  if (!slides.length) return null;
  const slide = slides[active];

  return (
    <section
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden -mt-20"
      style={{ backgroundColor: "#0c0a09" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
          animate="center"
          exit="exit"
          transition={{ duration: 0.75, ease: EASE }}
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
            transition={{ duration: 0.55, ease: EASE }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] mb-4" style={{ color: "#f0ebe3", opacity: 0.55 }}>
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
                className="font-body text-sm px-6 py-2.5 rounded-lg transition-opacity hover:opacity-80"
                style={{ backgroundColor: "#f0ebe3", color: "#0c0a09" }}
              >
                Explore the gallery
              </button>
              {slide.item && (
                <button
                  onClick={() => onOpenItem?.(slide.item, slide.mediaIndex)}
                  className="font-body text-sm px-6 py-2.5 rounded-lg border flex items-center justify-center gap-2 transition-colors hover:bg-white/10"
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
      <div className="absolute top-24 right-6 sm:right-10 z-10 font-mono text-[10px] tracking-[0.25em]" style={{ color: "#f0ebe3", opacity: 0.5 }}>
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
            <span className="font-mono text-[10px] tracking-[0.25em]" style={{ color: "#f0ebe3", opacity: 0.5 }}>
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

      {/* Thumbnail row with autoplay progress */}
      <div className="absolute bottom-0 left-0 right-0 z-10 px-6 sm:px-10 lg:px-16 pb-6">
        <div className="flex gap-2 sm:gap-3 items-end overflow-x-auto">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}: ${s.title}`}
              aria-current={i === active}
              className={`relative shrink-0 rounded overflow-hidden group transition-all duration-300 ${
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
              {i === active && slides.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: "#f0ebe3" + "40" }}>
                  <motion.div
                    key={active}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: AUTOPLAY_MS / 1000, ease: "linear" }}
                    className="h-full"
                    style={{ backgroundColor: "var(--accent-color, #a8a29e)" }}
                  />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
