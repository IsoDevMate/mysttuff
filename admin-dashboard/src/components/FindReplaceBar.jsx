import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { X, ChevronUp, ChevronDown, CaseSensitive, Replace, ReplaceAll } from "lucide-react";

/**
 * Find & replace for the markdown editor.
 *
 * Keeps focus in the find field so Enter / Shift+Enter keep stepping through
 * matches; the matched range is selected and scrolled into view in the
 * textarea behind it. Exposes { next, prev } to the editor so Enter inside the
 * textarea also advances while the bar is open.
 */
const FindReplaceBar = forwardRef(function FindReplaceBar(
  { content, textareaRef, onContentChange, onClose },
  ref
) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [index, setIndex] = useState(0);
  const findInputRef = useRef(null);

  useEffect(() => {
    findInputRef.current?.focus();
  }, []);

  const matches = useMemo(() => {
    if (!find) return [];
    const hay = matchCase ? content : content.toLowerCase();
    const needle = matchCase ? find : find.toLowerCase();
    const out = [];
    let i = hay.indexOf(needle);
    while (i !== -1) {
      out.push({ start: i, end: i + needle.length });
      i = hay.indexOf(needle, i + needle.length);
    }
    return out;
  }, [content, find, matchCase]);

  useEffect(() => {
    setIndex(0);
  }, [find, matchCase]);

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, matches.length - 1)));
  }, [matches.length]);

  const reveal = (i) => {
    if (!matches.length) return;
    const n = ((i % matches.length) + matches.length) % matches.length;
    setIndex(n);
    const el = textareaRef?.current;
    if (!el) return;
    const m = matches[n];
    // Select without stealing focus from the find field.
    el.setSelectionRange(m.start, m.end);
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const lines = content.slice(0, m.start).split("\n").length;
    el.scrollTop = Math.max(0, (lines - 4) * lineHeight);
  };

  const next = () => reveal(index + 1);
  const prev = () => reveal(index - 1);

  useImperativeHandle(ref, () => ({ next, prev }), [index, matches, content]);

  const replaceOne = () => {
    if (!matches.length) return;
    const m = matches[Math.min(index, matches.length - 1)];
    onContentChange(content.slice(0, m.start) + replace + content.slice(m.end), { immediate: true });
  };

  const replaceAll = () => {
    if (!matches.length) return;
    const hay = matchCase ? content : content.toLowerCase();
    const needle = matchCase ? find : find.toLowerCase();
    let out = "";
    let i = 0;
    for (;;) {
      const at = hay.indexOf(needle, i);
      if (at === -1) {
        out += content.slice(i);
        break;
      }
      out += content.slice(i, at) + replace;
      i = at + needle.length;
    }
    onContentChange(out, { immediate: true });
  };

  const onFieldKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) prev();
      else next();
    }
  };

  const inputCls =
    "min-h-11 w-full px-3 rounded-md border border-input bg-background text-sm text-foreground";

  return (
    <div className="border border-b-0 bg-muted/20 p-2 flex flex-wrap items-center gap-2">
      <input
        ref={findInputRef}
        value={find}
        onChange={(e) => setFind(e.target.value)}
        onKeyDown={onFieldKeyDown}
        placeholder="Find"
        aria-label="Find"
        className={`${inputCls} flex-1 min-w-[8rem]`}
      />
      <input
        value={replace}
        onChange={(e) => setReplace(e.target.value)}
        onKeyDown={onFieldKeyDown}
        placeholder="Replace with"
        aria-label="Replace with"
        className={`${inputCls} flex-1 min-w-[8rem]`}
      />

      <span className="text-xs text-muted-foreground tabular-nums px-1 min-w-[4.5rem] text-center">
        {find ? (matches.length ? `${index + 1} / ${matches.length}` : "no matches") : ""}
      </span>

      <button
        type="button"
        onClick={() => setMatchCase((v) => !v)}
        aria-pressed={matchCase}
        title="Match case"
        className={`h-11 w-11 flex items-center justify-center rounded-md transition-colors ${
          matchCase ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
        }`}
      >
        <CaseSensitive className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={prev}
        disabled={!matches.length}
        title="Previous match (Shift+Enter)"
        className="h-11 w-11 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={next}
        disabled={!matches.length}
        title="Next match (Enter)"
        className="h-11 w-11 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={replaceOne}
        disabled={!matches.length}
        title="Replace"
        className="h-11 px-3 flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted disabled:opacity-30"
      >
        <Replace className="h-4 w-4" /> Replace
      </button>
      <button
        type="button"
        onClick={replaceAll}
        disabled={!matches.length}
        title="Replace all"
        className="h-11 px-3 flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted disabled:opacity-30"
      >
        <ReplaceAll className="h-4 w-4" /> All
      </button>
      <button
        type="button"
        onClick={onClose}
        title="Close (Esc)"
        aria-label="Close find and replace"
        className="h-11 w-11 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
});

export default FindReplaceBar;
