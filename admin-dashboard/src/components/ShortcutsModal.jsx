import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
const MOD = isMac ? '⌘' : 'Ctrl';

const GROUPS = [
  {
    label: 'Document',
    shortcuts: [
      { keys: [`${MOD}`, 'S'], action: 'Save draft' },
      { keys: [`${MOD}`, '⇧', 'S'], action: 'Publish / update' },
      { keys: [`${MOD}`, '/'], action: 'Toggle this cheat sheet' },
    ],
  },
  {
    label: 'Formatting (in the editor)',
    shortcuts: [
      { keys: [`${MOD}`, 'B'], action: 'Bold' },
      { keys: [`${MOD}`, 'I'], action: 'Italic' },
      { keys: [`${MOD}`, 'K'], action: 'Insert link' },
      { keys: [`${MOD}`, 'E'], action: 'Inline code' },
      { keys: [`${MOD}`, '⇧', 'X'], action: 'Strikethrough' },
    ],
  },
  {
    label: 'Structure',
    shortcuts: [
      { keys: [`${MOD}`, '1–4'], action: 'Heading 1–4' },
      { keys: [`${MOD}`, '⇧', '8'], action: 'Bullet list' },
      { keys: [`${MOD}`, '⇧', '7'], action: 'Numbered list' },
      { keys: [`${MOD}`, 'U'], action: 'Upload image / video' },
      { keys: [`${MOD}`, '⇧', 'F'], action: 'Toggle fullscreen edit' },
    ],
  },
];

export default function ShortcutsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-background">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Keyboard className="h-4 w-4" /> Keyboard shortcuts
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-5">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <div key={s.action} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{s.action}</span>
                    <span className="flex gap-1">
                      {s.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="px-1.5 py-0.5 text-[11px] font-mono bg-muted border border-border rounded"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground border-t pt-3">
            Tip: you can also paste or drag image files straight into the editor — they upload to
            R2 and insert at your cursor automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
