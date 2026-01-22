import React, { useState } from "react";
import { base44 } from "@/api/mockData";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink, Calendar } from "lucide-react";
import { format } from "date-fns";

const types = ["all", "photo", "podcast", "event", "design", "channel", "other"];

const typeLabels = {
  photo: "Photos",
  podcast: "Podcasts",
  event: "Events",
  design: "Designs",
  channel: "Channels",
  other: "Other"
};

export default function Gallery() {
  const [activeType, setActiveType] = useState("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['gallery'],
    queryFn: () => base44.entities.Gallery.list('-created_date'),
  });

  const filteredItems = activeType === "all" 
    ? items 
    : items.filter(item => item.type === activeType);

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <header className="py-12">
        <h1 className="font-serif-display text-5xl md:text-6xl font-bold mb-4">
          Gallery
        </h1>
        <p className="font-body text-lg opacity-60">
          Things I've done, places I've been, stuff I love.
        </p>
      </header>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2 mb-12 border-b pb-6" style={{ borderColor: 'var(--text-color, #292524)' + '20' }}>
        {types.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`font-body text-sm px-4 py-2 rounded-full transition-all ${
              activeType === type
                ? "opacity-100 font-medium"
                : "opacity-50 hover:opacity-100"
            }`}
            style={activeType === type ? {
              backgroundColor: 'var(--accent-color, #78716c)',
              color: 'var(--bg-color, #FAF3E8)'
            } : {}}
          >
            {type === "all" ? "all" : typeLabels[type] || type}
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-current/10 rounded-lg mb-3" />
              <div className="h-4 bg-current/10 rounded w-3/4 mb-2" />
              <div className="h-3 bg-current/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group"
            >
              <div className="relative overflow-hidden rounded-lg aspect-square bg-current/5 mb-3">
                {item.image_url ? (
                  <img 
                    src={item.image_url} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-body text-4xl opacity-20">
                      {typeLabels[item.type]?.[0] || "?"}
                    </span>
                  </div>
                )}
                
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-3 right-3 bg-current/80 backdrop-blur-sm text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-body text-xs opacity-40 uppercase tracking-wider">
                    {typeLabels[item.type] || item.type}
                  </span>
                  {item.date && (
                    <>
                      <span className="opacity-20">•</span>
                      <span className="font-body text-xs opacity-40 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(item.date), 'MMM yyyy')}
                      </span>
                    </>
                  )}
                </div>
                <h3 className="font-serif-display text-lg font-semibold mb-1">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="font-body text-sm opacity-60 line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="font-body opacity-40">
            {activeType === "all" 
              ? "Nothing here yet. Add some items to your gallery." 
              : `No ${typeLabels[activeType]?.toLowerCase() || activeType} yet.`}
          </p>
        </div>
      )}
    </div>
  );
}