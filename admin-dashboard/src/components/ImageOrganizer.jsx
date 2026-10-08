import React, { useMemo, useState } from 'react';
import { GripVertical, Image as ImageIcon, Code2, Type, ArrowUp, ArrowDown, MoveVertical } from 'lucide-react';
import { splitBlocks, moveBlock } from '../utils/markdownEditor';

const IMAGE_LINE_RE = /^\s*!\[([^\]]*)\]\(([^)\s]+)[^)]*\)\s*$/;

/**
 * Visual map of the article: every block (heading / paragraph / image / code)
 * in order, with thumbnails for images. Standalone image blocks can be dragged
 * — or nudged with ▲/▼ buttons (touch-friendly). Images stuck inside a
 * paragraph get a "lift" button that puts them on their own line so they
 * become draggable too.
 */
export default function ImageOrganizer({ content, onContentChange }) {
  const [draggingId, setDraggingId] = useState(null); // block index being dragged
  const [overIndex, setOverIndex] = useState(null); // drop target block index

  const blocks = useMemo(() => splitBlocks(content || ''), [content]);
  const draggableImages = blocks.filter((b) => b.kind === 'image');
  const inlineImages = blocks.filter((b) => b.kind === 'paragraph-with-image');

  const hasAnything = content?.trim();
  const hasImages = draggableImages.length + inlineImages.length > 0;

  // Pull standalone image URLs for thumbnail rendering
  const imageUrlOf = (block) => {
    const m = block.raw.match(IMAGE_LINE_RE);
    return m?.[2] || null;
  };

  /** Put an inline image on its own line (with blank lines around it) */
  const liftImage = (block) => {
    const lines = content.split('\n');
    const m = block.raw.match(/!\[[^\]]*\]\([^)\s]+[^)]*\)/);
    if (!m) return;
    const imageMd = m[0];
    // Replace the paragraph's lines with: blank, image line, blank
    const replacement = ['', imageMd, ''];
    lines.splice(block.startLine, block.endLine - block.startLine + 1, ...replacement);
    onContentChange(lines.join('\n').replace(/\n{3,}/g, '\n\n'));
  };

  if (!hasAnything) {
    return (
      <p className="text-xs text-muted-foreground">
        Start writing — your article's structure (headings, images, sections) appears here so you
        can drag images between sections.
      </p>
    );
  }

  if (!hasImages) {
    return (
      <p className="text-xs text-muted-foreground">
        No images in the article yet. Upload one below (or paste/drop it into the editor) and it
        will show up here with a thumbnail you can move around.
      </p>
    );
  }

  const handleDrop = (fromIndex, targetIndex) => {
    if (fromIndex === null || fromIndex === undefined || fromIndex === targetIndex) {
      setDraggingId(null);
      setOverIndex(null);
      return;
    }
    onContentChange(moveBlock(content, fromIndex, targetIndex));
    setDraggingId(null);
    setOverIndex(null);
  };

  const nudge = (fromIndex, dir) => {
    const target = fromIndex + dir;
    if (target < 0 || target >= blocks.length) return;
    onContentChange(moveBlock(content, fromIndex, target));
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
        <MoveVertical className="h-3 w-3" />
        Drag an image (or use ▲▼) to move it before any section. Inline images can be lifted out.
      </p>

      {blocks.map((block, i) => (
        <React.Fragment key={i}>
          {/* Drop zone above each block — invisibly tall while dragging so any
              vertical position over the gap lands here (drag-anywhere) */}
          <div
            onDragOver={(e) => {
              if (draggingId === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setOverIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = e.dataTransfer.getData('text/organizer-index');
              const fromIdx = from === '' ? draggingId : Number(from);
              handleDrop(fromIdx, i);
            }}
            className={`rounded-full transition-all ${
              draggingId !== null
                ? `my-1 ${overIndex === i ? 'h-6 bg-primary/80 ring-2 ring-primary/30' : 'h-4 bg-muted-foreground/20'}`
                : 'h-1.5'
            }`}
          />

          {block.kind === 'image' ? (
            <div
              draggable
              onDragStart={(e) => {
                // dataTransfer makes the drag survive state re-renders
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/organizer-index', String(i));
                setDraggingId(i);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setOverIndex(null);
              }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded border bg-blue-50/60 dark:bg-blue-950/30 cursor-grab active:cursor-grabbing transition-opacity ${
                draggingId === i ? 'opacity-40' : 'hover:border-blue-400'
              }`}
              title="Drag to reposition this image — or use the arrows"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 hidden sm:block" />
              {imageUrlOf(block) ? (
                <img
                  src={imageUrlOf(block)}
                  alt=""
                  className="h-9 w-14 object-cover rounded shrink-0 border"
                  loading="lazy"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <ImageIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              )}
              <span className="text-xs font-medium truncate flex-1">
                {block.text || 'image'}
              </span>
              <span className="flex gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => nudge(i, -1)}
                  disabled={i === 0}
                  className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-20"
                  title="Move up"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => nudge(i, 1)}
                  disabled={i === blocks.length - 1}
                  className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-20"
                  title="Move down"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </span>
            </div>
          ) : block.kind === 'heading' ? (
            <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold opacity-80">
              <span className="text-[10px] font-mono opacity-50">{'#'.repeat(Math.min(6, (block.raw.match(/^#+/) || ['#'])[0].length))}</span>
              <span className="truncate">{block.text}</span>
            </div>
          ) : block.kind === 'code' ? (
            <div className="flex items-center gap-2 px-2 py-1 text-xs opacity-50">
              <Code2 className="h-3 w-3" /> code block
            </div>
          ) : block.kind === 'paragraph-with-image' ? (
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs rounded border border-dashed border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
              <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span className="truncate flex-1 opacity-70">
                image inside a paragraph — lift it out to move it
              </span>
              <button
                type="button"
                onClick={() => liftImage(block)}
                className="shrink-0 text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                title="Put this image on its own line so it can be dragged"
              >
                Lift image
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2 py-1 text-xs opacity-40">
              <Type className="h-3 w-3 shrink-0" />
              <span className="truncate">{block.raw.slice(0, 60)}</span>
            </div>
          )}
        </React.Fragment>
      ))}

      {/* final drop zone at the very end — same tall target as the others */}
      <div
        onDragOver={(e) => {
          if (draggingId === null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setOverIndex(blocks.length);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const from = e.dataTransfer.getData('text/organizer-index');
          const fromIdx = from === '' ? draggingId : Number(from);
          if (fromIdx !== null && fromIdx !== blocks.length - 1) {
            onContentChange(moveBlock(content, fromIdx, blocks.length));
          }
          setDraggingId(null);
          setOverIndex(null);
        }}
        className={`rounded-full transition-all ${
          draggingId !== null
            ? `my-1 ${overIndex === blocks.length ? 'h-6 bg-primary/80 ring-2 ring-primary/30' : 'h-4 bg-muted-foreground/20'}`
            : 'h-1.5'
        }`}
      />
    </div>
  );
}
