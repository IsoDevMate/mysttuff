import React, { createContext, useContext, useEffect, useState } from "react";

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");

const FlagsContext = createContext({ flags: null, newUi: false, setNewUi: () => {} });

/**
 * Is this browser an admin session?
 * Checks for the admin dashboard's token and verifies it against a
 * token-protected endpoint. Cheap and stateless — no admin user data leaks.
 */
async function isAdminSession(base) {
  try {
    const token = localStorage.getItem("adminToken");
    if (!token) return false;
    const r = await fetch(`${base}/admin/flags`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

export function FlagsProvider({ children }) {
  const [flags, setFlags] = useState(null); // null = loading, {} = loaded
  const [newUi, setNewUiState] = useState(() => localStorage.getItem("newUi") === "1");

  // ?new-ui=1 → opt in for this session (persisted); ?new-ui=0 → opt out
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("new-ui");
    if (p === "1") {
      localStorage.setItem("newUi", "1");
      setNewUiState(true);
    } else if (p === "0") {
      localStorage.removeItem("newUi");
      setNewUiState(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [raw, admin] = await Promise.all([
          fetch(`${BASE}/flags`).then((r) => (r.ok ? r.json() : {})),
          isAdminSession(BASE),
        ]);
        if (!alive) return;
        // Resolve: 'on' → everyone; 'canary' → admin or new-ui opt-in; 'off' → no one.
        const resolved = {};
        for (const [key, state] of Object.entries(raw)) {
          resolved[key] = state === "on" || (state === "canary" && (admin || newUi));
        }
        setFlags(resolved);
      } catch {
        if (alive) setFlags({}); // fail open = features hidden; classic site still works
      }
    })();
    return () => {
      alive = false;
    };
  }, [newUi]);

  const setNewUi = (v) => {
    if (v) localStorage.setItem("newUi", "1");
    else localStorage.removeItem("newUi");
    setNewUiState(v);
  };

  return <FlagsContext.Provider value={{ flags, newUi, setNewUi }}>{children}</FlagsContext.Provider>;
}

export function useFlags() {
  return useContext(FlagsContext);
}

// Convenience: while flags are loading, treat features as OFF so nothing
// flashes in before we know the rollout state (no flash-of-new-UI).
export function flagOn(flags, key) {
  return !!flags && !!flags[key];
}
