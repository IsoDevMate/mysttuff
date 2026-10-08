// tags is stored as JSON text in the DB. Entries may be plain strings or
// { name, url } objects where url is an admin-defined custom link.
// Normalize to { name, url? } objects.
export function parseTagEntries(raw) {
  const toArray = (r) => {
    if (Array.isArray(r)) return r;
    if (!r) return [];
    try {
      const v = JSON.parse(r);
      return Array.isArray(v) ? v : [];
    } catch {
      return String(r)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  };

  return toArray(raw)
    .map((t) => {
      if (typeof t === "string") return { name: t };
      if (t && typeof t === "object" && t.name) {
        return t.url ? { name: String(t.name), url: String(t.url) } : { name: String(t.name) };
      }
      return null;
    })
    .filter(Boolean);
}

// Tag names only (for filtering)
export function parseTags(raw) {
  return parseTagEntries(raw).map((t) => t.name);
}

// Where does clicking this tag go? Custom URL wins; otherwise the blog filter.
export function tagHref(tag, createPageUrl) {
  if (tag.url) return tag.url;
  return createPageUrl(`Blog?tag=${encodeURIComponent(tag.name)}`);
}
