// gallery.media is stored as JSON text: [{ url, type: 'image' | 'video' }]
// Older items only have image_url — normalize both shapes.
export function getMedia(item) {
  if (item?.media) {
    try {
      const parsed = JSON.parse(item.media);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      // fall through to legacy
    }
  }
  return item?.image_url ? [{ url: item.image_url, type: "image" }] : [];
}

export const isVideo = (media) => media.type === "video" || /\.(mp4|webm|mov)(\?|$)/i.test(media.url || "");
