import React from "react";
import { base44 } from "@/api/mockData";
import { useQuery } from "@tanstack/react-query";
import { 
  Twitter, 
  Linkedin, 
  Github, 
  Twitch, 
  ExternalLink,
  Link as LinkIcon,
  Instagram,
  Youtube
} from "lucide-react";
import { motion } from "framer-motion";

const iconMap = {
  twitter: Twitter,
  linkedin: Linkedin,
  github: Github,
  twitch: Twitch,
  instagram: Instagram,
  youtube: Youtube,
  default: LinkIcon,
};

export default function Links() {
  const { data: links = [], isLoading } = useQuery({
    queryKey: ['links'],
    queryFn: () => base44.entities.SocialLink.list('order'),
  });

  const getIcon = (iconName) => {
    const normalizedName = iconName?.toLowerCase() || 'default';
    return iconMap[normalizedName] || iconMap.default;
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <header className="py-12 text-center">
        <h1 className="font-serif-display text-5xl font-bold text-stone-900 mb-4">
          Links
        </h1>
        <p className="font-body text-stone-500">
          Find me around the internet.
        </p>
      </header>

      {/* Links List */}
      <div className="space-y-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-stone-200 rounded-xl" />
            </div>
          ))
        ) : links.length > 0 ? (
          links.map((link, index) => {
            const Icon = getIcon(link.icon);
            return (
              <motion.a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group flex items-center gap-4 p-5 bg-white border border-stone-200 rounded-xl hover:border-stone-400 hover:shadow-lg transition-all"
              >
                <div className="w-10 h-10 bg-stone-100 rounded-lg flex items-center justify-center group-hover:bg-stone-900 transition-colors">
                  <Icon className="w-5 h-5 text-stone-600 group-hover:text-white transition-colors" />
                </div>
                <span className="font-body font-medium text-stone-900 flex-1">
                  {link.name}
                </span>
                <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-stone-600 transition-colors" />
              </motion.a>
            );
          })
        ) : (
          <div className="text-center py-12">
            <p className="font-body text-stone-400">
              No links added yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}