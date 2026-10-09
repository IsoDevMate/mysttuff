import React, { useEffect, useState } from "react";
import { api } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

const FLAG_META = {
  instants_widget: {
    label: "Instants floating widget",
    description: "The ⚡ bubble bottom-right on every public page (realtime feed + thoughts).",
  },
  instants_gallery_film: {
    label: "Instants gallery film strip",
    description: "The horizontal live strip at the top of the Gallery page.",
  },
  instants_home_section: {
    label: "Instants homepage section",
    description: "The 'live instants' bento/snap-scroll section on the public homepage.",
  },
  instants_reactions: {
    label: "Instant reactions + notes",
    description: "Anonymous emoji reactions and free-note threads on every instant.",
  },
  instants_capture: {
    label: "Instant capture (camera)",
    description: "The camera-first capture screen inside the instants widget (admin only).",
  },
  instants_crosslink: {
    label: "Instants on article pages",
    description: "A live strip under each article showing instants linked to that story.",
  },
};

const STATES = ["off", "canary", "on"];

const STATE_STYLES = {
  off: "bg-stone-200 text-stone-700 border-stone-300",
  canary: "bg-amber-100 text-amber-800 border-amber-300",
  on: "bg-green-100 text-green-800 border-green-300",
};

const STATE_HELP = {
  off: "Hidden from everyone.",
  canary: "Visible to you (admin) and visitors who open the site with ?new-ui=1. Nobody else sees it.",
  on: "Visible to everyone.",
};

export default function Flags() {
  const [flags, setFlags] = useState(null);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getFlags()
      .then(setFlags)
      .catch((e) => setError(e.message));
  }, []);

  const flip = async (key, state) => {
    setSaving(key);
    setError(null);
    const prev = flags;
    setFlags((f) => f.map((fl) => (fl.key === key ? { ...fl, state } : fl))); // optimistic
    try {
      await api.setFlag(key, state);
    } catch (e) {
      setFlags(prev); // roll back
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  if (error && !flags) {
    return <p className="p-6 text-sm text-red-600">Failed to load flags: {error}</p>;
  }
  if (!flags) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feature flags</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Roll features out in stages without redeploying: off → canary (you only) → everyone.
        </p>
      </div>

      {error && flags && (
        <p className="text-sm text-red-600 border border-red-200 rounded px-3 py-2">
          Save failed, change rolled back: {error}
        </p>
      )}

      {flags.map((flag) => {
        const meta = FLAG_META[flag.key] || { label: flag.key, description: "" };
        return (
          <Card key={flag.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{meta.label}</CardTitle>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {STATES.map((s) => (
                  <button
                    key={s}
                    onClick={() => flip(flag.key, s)}
                    disabled={saving === flag.key || flag.state === s}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      flag.state === s ? STATE_STYLES[s] : "bg-transparent text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {s === "off" ? "Off" : s === "canary" ? "Canary (me only)" : "On (everyone)"}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{STATE_HELP[flag.state]}</p>
            </CardContent>
          </Card>
        );
      })}

      <div className="text-xs text-muted-foreground border rounded-md p-3 bg-muted/40">
        <p className="font-medium mb-1">Rollout recipe</p>
        <p>
          1. Set a flag to <strong>Canary</strong> — browse the live site while logged into public admin to QA it.
          2. Share the site with <code>?new-ui=1</code> to let friends preview. 3. Set to <strong>On</strong> when
          happy. Broken at 2am? Back to <strong>Off</strong> — no redeploy.
        </p>
      </div>
    </div>
  );
}
