// A hot take links to an article only when that article is actually readable on
// the site. A take can point at a draft, and the public article route 404s for
// drafts, so linking one would show readers "Post not found".
//
// `article_live` is undefined on older API responses (before it was added);
// treat that as "link" so behaviour is unchanged until the backend redeploys.
export function takeLink(take) {
  if (!take?.article_slug) return null;
  if (take.article_live !== undefined && Number(take.article_live) !== 1) return null;
  const slug = String(take.article_slug).trim();
  return slug || null;
}
