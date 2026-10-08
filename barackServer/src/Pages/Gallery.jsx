import React, { useMemo, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { blogAPI } from "@/api/blogAPI";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Film, Layers, Play, ArrowLeft } from "lucide-react";
import { createPageUrl } from "@/lib/utils";
import { format } from "date-fns";
import GalleryHero from "@/components/gallery/GalleryHero";
import MediaLightbox from "@/components/gallery/MediaLightbox";
import { getMedia, isVideo } from "@/lib/gallery";

const typeLabels = {
  photo: "Photos",
  podcast: "Podcasts",
  event: "Events",
  design: "Designs",
  channel: "Channels",
  other: "Other",
};

export default function Gallery() {
  const rowsRef = useRef(null);
  const [lightbox, setLightbox] = useState(null); // { item, media, index }

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => blogAPI.getGallery(),
  });

  // Normalize items: attach parsed media
  const normalized = useMemo(
    () => items.map((item) => ({ ...item, mediaList: getMedia(item) })).filter((i) => i.mediaList.length),
    [items]
  );

  // Hero slides: every image in the gallery, capped
  const heroSlides = useMemo(
    () =>
      normalized
        .flatMap((item) =>
          item.mediaList
            .map((m, mediaIndex) => ({ ...m, mediaIndex, item }))
            .filter((m) => !isVideo(m))
        )
        .slice(0, 8)
        .map((m) => ({
          src: m.url,
          title: m.item.title,
          subtitle: `${typeLabels[m.item.type] || m.item.type || "Gallery"}${
            m.item.date ? " · " + format(new Date(m.item.date), "MMMM yyyy") : ""
          }`,
          overline: typeLabels[m.item.type] || m.item.type || "moment",
          item: m.item,
          mediaIndex: m.mediaIndex,
        })),
    [normalized]
  );

  // Netflix rows: group by the item's type
  const rows = useMemo(() => {
    const byType = {};
    normalized.forEach((item) => {
      const key = item.type || "other";
      if (!byType[key]) byType[key] = [];
      byType[key].push(item);
    });
    return Object.entries(byType).sort((a, b) => b[1].length - a[1].length);
  }, [normalized]);

  const openLightbox = useCallback((item, mediaIndex = 0) => {
    setLightbox({ item, media: item.mediaList, index: mediaIndex });
  }, []);

  const scrollRow = (type, dir) => {
    const el = rowsRef.current?.querySelector(`[data-row-direction="${type}"]`);
    el?.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div className="pb-24">
      {/* Back navigation — sticky so it's reachable even mid-scroll on the hero */}
      <div className="sticky top-20 z-30 max-w-6xl mx-auto px-4 sm:px-6 pt-3">
        <Link
          to={createPageUrl("Home")}
          className="inline-flex items-center gap-1.5 font-body text-sm opacity-60 hover:opacity-100 transition-opacity bg-[var(--bg-color,#FAF3E8)]/80 backdrop-blur-sm px-3 py-1.5 rounded-full border"
          style={{ borderColor: "var(--text-color, #292524)" + "20" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> back home
        </Link>
      </div>

      {/* Netflix-style hero — purely decorative */}
      <GalleryHero
        slides={heroSlides}
        onOpenItem={openLightbox}
        onExplore={() => rowsRef.current?.scrollIntoView({ behavior: "smooth" })}
      />

      <div className="max-w-6xl mx-auto px-6">
        {/* Fallback header when there's no hero imagery */}
        {!heroSlides.length && (
          <header className="pt-24 pb-4">
            <h1 className="font-serif-display text-5xl md:text-6xl font-bold mb-4">Gallery</h1>
            <p className="font-body text-lg opacity-60">
              Things I've done, places I've been, stuff I love.
            </p>
          </header>
        )}

        {/* ─── Netflix-style rows by type ─── */}
        <section ref={rowsRef} className={heroSlides.length ? "pt-16" : "pt-12"}>
          <div className="flex items-center gap-2 mb-8">
            <Layers className="w-4 h-4 opacity-40" />
            <h2 className="font-serif-display text-2xl font-bold">Collections</h2>
          </div>

          {isLoading ? (
            <div className="space-y-10">
              {[1, 2].map((r) => (
                <div key={r}>
                  <div className="h-5 w-40 bg-current/10 rounded mb-4 animate-pulse" />
                  <div className="flex gap-4 overflow-hidden">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="shrink-0 w-64 aspect-video bg-current/10 rounded-lg animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-body opacity-40">Nothing here yet. Add some items to your gallery.</p>
            </div>
          ) : (
            <div className="space-y-12">
              {rows.map(([type, typeItems]) => (
                <div key={type} className="group/row relative">
                  <div className="flex items-baseline justify-between mb-4">
                    <h3 className="font-serif-display text-xl font-bold">
                      {typeLabels[type] || type}
                      <span className="font-body text-xs opacity-40 ml-2">{typeItems.length}</span>
                    </h3>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity">
                      <button
                        onClick={() => scrollRow(type, -1)}
                        aria-label={`Scroll ${typeLabels[type] || type} back`}
                        className="p-1.5 rounded-full border border-current/20 hover:bg-current/10 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => scrollRow(type, 1)}
                        aria-label={`Scroll ${typeLabels[type] || type} forward`}
                        className="p-1.5 rounded-full border border-current/20 hover:bg-current/10 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div
                    data-row-direction={type}
                    className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 snap-x"
                    style={{ scrollbarWidth: "thin" }}
                  >
                    {typeItems.flatMap((item) =>
                      item.mediaList.map((media, mediaIndex) => {
                        const video = isVideo(media);
                        return (
                          <button
                            key={`${item.id}-${mediaIndex}`}
                            onClick={() => openLightbox(item, mediaIndex)}
                            className="relative shrink-0 w-44 xs:w-52 sm:w-64 aspect-video rounded-lg overflow-hidden snap-start bg-current/5 group/tile"
                            aria-label={`${item.title}${mediaIndex > 0 ? ` — media ${mediaIndex + 1}` : ""}`}
                          >
                            {video ? (
                              <video
                                src={media.url}
                                muted
                                playsInline
                                preload="metadata"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={media.url}
                                alt={item.title}
                                loading="lazy"
                                draggable={false}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover/tile:scale-105"
                              />
                            )}
                            {video && (
                              <span
                                className="absolute inset-0 flex items-center justify-center"
                                style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
                              >
                                <Play className="w-8 h-8 text-white opacity-80" />
                              </span>
                            )}
                            <span className="absolute inset-x-0 bottom-0 p-2.5 pt-8 text-left opacity-0 group-hover/tile:opacity-100 transition-opacity"
                              style={{ background: "linear-gradient(to top, rgba(12,10,9,0.85), transparent)" }}
                            >
                              <span className="font-body text-xs text-white block truncate">{item.title}</span>
                            </span>
                            {item.mediaList.length > 1 && (
                              <span className="absolute top-2 right-2 font-mono text-[10px] text-white bg-black/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                                {video ? <Film className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                                {mediaIndex + 1}/{item.mediaList.length}
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── Instagram-style grid — everything, image first ─── */}
        {!isLoading && normalized.length > 0 && (
          <section className="pt-12 sm:pt-20">
            <h2 className="font-serif-display text-2xl font-bold mb-8">Everything</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {normalized.flatMap((item, idx) =>
                item.mediaList.map((media, mediaIndex) => {
                  const video = isVideo(media);
                  return (
                    <motion.button
                      key={`${item.id}-${mediaIndex}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.4) }}
                      onClick={() => openLightbox(item, mediaIndex)}
                      className="relative aspect-square overflow-hidden group/gcell bg-current/5"
                      aria-label={item.title}
                    >
                      {video ? (
                        <video src={media.url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                      ) : (
                        <img
                          src={media.url}
                          alt={item.title}
                          loading="lazy"
                          draggable={false}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/gcell:scale-105"
                        />
                      )}
                      {video && (
                        <span className="absolute top-2 right-2 text-white drop-shadow">
                          <Film className="w-4 h-4" />
                        </span>
                      )}
                      {/* hover overlay — IG style: title only, no description clutter */}
                      <span
                        className="absolute inset-0 flex items-end p-3 opacity-0 group-hover/gcell:opacity-100 transition-opacity"
                        style={{ background: "linear-gradient(to top, rgba(12,10,9,0.7), transparent 60%)" }}
                      >
                        <span className="font-body text-xs text-white truncate">
                          {item.title}
                          {item.mediaList.length > 1 && ` · ${item.mediaList.length} items`}
                        </span>
                      </span>
                    </motion.button>
                  );
                })
              )}
            </div>
          </section>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <MediaLightbox
          item={lightbox.item}
          media={lightbox.media}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
