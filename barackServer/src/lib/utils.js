import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function createPageUrl(page) {
  // If page is "Home", return root
  if (page === "Home") return "/";
  
  // If page contains query params (e.g. "BlogPost?id=123"), handle it
  if (page.includes("?")) {
    const [path, query] = page.split("?");
    return `/${path}?${query}`;
  }
  
  return `/${page}`;
}