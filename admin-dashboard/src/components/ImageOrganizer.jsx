import React, { useMemo, useState } from 'react';
import { GripVertical, Image as ImageIcon, Code2, Type } from 'lucide-react';
import { splitBlocks, moveBlock } from '../utils/markdownEditor';

/**
 * Visual map of the article: every block (heading / paragraph / image / code)
 * in order. Standalone image blocks are draggable — drop one before any block
 * and the markdown is rewritten so the image lands there.
 */
export default function ImageOrganizer({ content, onContentChange }) {
  const [dragging, setDragging] = useState(null); // block index
  const [overIndex, setOverIndex] = useState(null); // drop target block index

  const blocks = useMemo(() => splitBlocks(content || ''), [content]);
  const imageBlocks = blocks.filter((b) => b.kind === 'image');

  if (!content?.trim()) {
    return (
      <p className="text-xs text-muted-foreground">
        Start writing — your article's structure (headings, images, sections) appears here so you
        can drag images between sections.
      </p>
    );
  }

  if (!imageBlocks.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No standalone images in the article yet. Upload one below (or paste/drop it into the
        editor) and it will show up here, draggable between sections.
      </p>
    );
  }

  const handleDrop = (targetIndex) => {
    if (dragging === null || dragging === targetIndex) {
      setDragging(null);
      setOverIndex(null);
      return;
    }
    onContentChange(moveBlock(content, dragging, targetIndex));
    setDragging(null);
    setOverIndex(null);
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-2">
        Drag an image and drop it before any section — the markdown is rewritten for you.
      </p>

      {blocks.map((block, i) => (
        <React.Fragment key={i}>
          {/* drop zone above each block */}
          <div
            onDragOver={(e) => {
              if (dragging === null) return;
              e.preventDefault();
              setOverIndex(i);
            }}
            onDragLeave={() => setOverIndex((v) => (v === i ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(i);
            }}
            className={`h-1.5 rounded-full transition-all ${
              dragging !== null && overIndex === i
                ? 'bg-primary h-3'
                : dragging !== null
                  ? 'bg-muted-foreground/15'
                  : ''
            }`}
          />

          {block.kind === 'image' ? (
            <div
              draggable
              onDragStart={() => setDragging(i)}
              onDragEnd={() => {
                setDragging(null);
                setOverIndex(null);
              }}
              className={`flex items-center gap-2 px-2 py-1.5 rounded border bg-blue-50/60 dark:bg-blue-950/30 cursor-grab active:cursor-grabbing transition-opacity ${
                dragging === i ? 'opacity-40' : 'hover:border-blue-400'
              }`}
              title="Drag to reposition this image"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <ImageIcon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="text-xs font-medium truncate">
                🖼 {block.text || 'image'}
              </span>
              <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                drag to move
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
          ) : (
            <div className="flex items-center gap-2 px-2 py-1 text-xs opacity-40">
              <Type className="h-3 w-3 shrink-0" />
              <span className="truncate">{block.raw.slice(0, 60)}</span>
            </div>
          )}
        </React.Fragment>
      ))}

      {/* final drop zone at the very end */}
      <div
        onDragOver={(e) => {
          if (dragging === null) return;
          e.preventDefault();
          setOverIndex(blocks.length);
        }}
        onDragLeave={() => setOverIndex((v) => (v === blocks.length ? null : v))}
        onDrop={(e) => {
          e.preventDefault();
          if (dragging !== null && dragging !== blocks.length - 1) {
            onContentChange(moveBlock(content, dragging, blocks.length - 1));
          }
          setDragging(null);
          setOverIndex(null);
        }}
        className={`h-1.5 rounded-full transition-all ${
          dragging !== null && overIndex === blocks.length
            ? 'bg-primary h-3'
            : dragging !== null
              ? 'bg-muted-foreground/15'
              : ''
        }`}
      />
    </div>
  );
}
