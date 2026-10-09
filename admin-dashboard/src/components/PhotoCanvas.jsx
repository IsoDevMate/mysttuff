import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Check, Loader2, Heading1, Sparkles, RotateCcw, Film } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';

/**
 * PhotoCanvas — the "50-photo moment" (full-screen, temporary, direct manipulation).
 *
 * Arrives holding a gallery item (edit mode) or a fresh context (create).
 * Drop or pick a batch of photos → they upload one by one, thumbnails land
 * immediately while the rest are still in flight ("perceived performance").
 * Drag any tile to rearrange; the first position is the cover. Saving sends
 * the real PUT/POST — toast confirms only on server-ok. Escape discarded =
 * nothing was persisted; nothing is faked.
 *
 * Motion: the OS reduced-motion preference disables entrance/tilt anims.
 */

const IMAGES_ACCEPT = { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] };

function useReducedMotionPref() {
    const [reduce, setReduce] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const apply = () => setReduce(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);
    return reduce;
}

function PhotoCanvas({ item, onClose, onSaved }) {
    const reduceMotion = useReducedMotionPref();
    const isNew = !item?.id;

    // media arrives as JSON text (old rows) or an array (drizzle of API shapes) —
    // normalize both, mirroring the public site's getMedia() helper.
    const parseMedia = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (!raw) return [];
        try {
            const v = JSON.parse(raw);
            return Array.isArray(v) ? v : [];
        } catch {
            return [];
        }
    };

    // Canvas state
    const [title, setTitle] = useState(item?.title || '');
    const [description, setDescription] = useState(item?.description || '');
    const [date, setDate] = useState(item?.date ? String(item.date).split('T')[0] : new Date().toISOString().split('T')[0]);
    const [tiles, setTiles] = useState(() =>
        parseMedia(item?.media).map((m) => ({ ...m, status: 'done' }))
    );

    // Uploads
    const [uploadingCount, setUploadingCount] = useState(0);
    const [saving, setSaving] = useState(false);
    const [savedOnce, setSavedOnce] = useState(false);
    const [picking, setPicking] = useState(false);

    // Drag state (pointer-based, flip-based reorder)
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const dragIndex = useRef(null);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && !uploadingCount && !saving) {
                confirm('Leave the canvas? Unsaved arrangement is not kept.') && onClose(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, uploadingCount, saving]);

    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const uploadFiles = useCallback(async (files) => {
        const list = [...files].filter((f) => (f.type || '').startsWith('image/'));
        if (!list.length) {
            toast.error('Only images on the canvas — videos upload from the article editor');
            return;
        }
        setUploadingCount((n) => n + list.length);
        for (const file of list) {
            try {
                const upload = await api.uploadFile(file);
                setTiles((prev) => [
                    ...prev,
                    { url: upload.url, type: 'image', status: 'done' },
                ]);
            } catch (err) {
                toast.error(`Upload failed (${file.name}) — ${err.message}`);
                setTiles((prev) => prev.filter((t) => t.status !== 'pending'));
            } finally {
                setUploadingCount((n) => n - 1);
            }
        }
    }, []);

    const onDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setPicking(false);
        if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
    };

    // Reorder: drag tile i over tile j → flip positions (simple, predictable)
    const handleTileDragOver = (e, index) => {
        e.preventDefault();
        if (dragOverIndex !== index) setDragOverIndex(index);
    };
    const handleTileDrop = (e, index) => {
        e.preventDefault();
        const from = dragIndex.current;
        dragIndex.current = null;
        setDragOverIndex(null);
        if (from === null || from === index) return;
        setTiles((prev) => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(index, 0, moved);
            return next;
        });
    };
    // Keyboard reorder — the accessible alternative for drag-and-drop
    const nudgeTile = (index, dir) => {
        const target = index + dir;
        if (target < 0 || target >= tiles.length) return;
        setTiles((prev) => {
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };
    const removeTile = (index) => setTiles((prev) => prev.filter((_, i) => i !== index));

    const save = async () => {
        if (!title.trim()) {
            toast.error('Give this gallery a title before publishing');
            return;
        }
        const doneTiles = tiles.filter((t) => t.status === 'done');
        if (!doneTiles.length) {
            toast.error('Add at least one photo first');
            return;
        }
        setSaving(true);
        const payload = {
            title: title.trim(),
            description,
            type: 'photo',
            date,
            image_url: doneTiles[0].url, // position 0 is the cover
            media: doneTiles.map(({ url, type }) => ({ url, type })),
        };
        try {
            let savedItem;
            if (isNew) {
                savedItem = await api.createGalleryItem(payload);
            } else {
                savedItem = await api.updateGalleryItem(item.id, payload);
            }
            setSavedOnce(true);
            toast.success('Published — arranged exactly how you left it');
            onSaved?.(savedItem);
            onClose(true);
        } catch (err) {
            toast.error('Save failed — everything is still on the canvas, try again');
            setSaving(false);
        }
    };

    const hasPending = uploadingCount > 0 || tiles.some((t) => t.status === 'pending');

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[110] flex flex-col"
            style={{ backgroundColor: 'rgba(10,10,10,0.97)' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
        >
            {/* ── top bar ── */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/10 text-white">
                <Sparkles className="w-4 h-4 text-white/50" />
                <p className="text-sm font-medium">{isNew ? 'photo canvas — new gallery' : `photo canvas — “${item?.title || 'gallery'}”`}</p>
                {uploadingCount > 0 && (
                    <span className="text-xs text-amber-300 flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" /> uploading {uploadingCount} photo{uploadingCount > 1 ? 's' : ''}…
                    </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => onClose(false)}
                        disabled={saving}
                        className="text-xs px-3 py-1.5 rounded-full text-white/70 hover:text-white disabled:opacity-40"
                    >
                        discard
                    </button>
                    <button
                        onClick={save}
                        disabled={saving || hasPending}
                        className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full font-medium bg-white text-black disabled:opacity-30 active:scale-95 transition-transform"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        {saving ? 'publishing…' : isNew ? 'publish gallery' : 'save arrangement'}
                    </button>
                </div>
            </div>

            {/* ── meta row ── */}
            <div className="px-5 pt-4 pb-1 flex flex-wrap items-center gap-3 text-white">
                <div className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5">
                    <Heading1 className="w-3.5 h-3.5 text-white/40" />
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={
                            isNew
                                ? 'gallery title — try the event name…'
                                : 'title'
                        }
                        className="bg-transparent text-sm outline-none placeholder:text-white/30 w-52"
                    />
                </div>
                <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-transparent text-xs text-white/70 outline-none border border-white/15 rounded-lg px-2.5 py-2"
                    aria-label="Gallery date"
                />
                <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="caption (optional)"
                    className="bg-transparent text-xs outline-none border border-white/15 rounded-lg px-2.5 py-2 w-44 placeholder:text-white/30"
                />
                {!isNew && (
                    <span className="text-[10px] text-white/30 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> original is safe — only "save" writes
                    </span>
                )}
            </div>

            {/* ── canvas ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
                <div
                    className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                    role="list"
                    aria-label="Gallery photos — drag to rearrange"
                >
                    <AnimatePresence>
                        {tiles.map((tile, index) => (
                            <motion.div
                                key={tile.url + String(index)}
                                layout={reduceMotion ? undefined : true}
                                initial={reduceMotion ? undefined : { opacity: 0, scale: 0.9, rotate: index % 2 ? 2 : -2 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.25 }}
                                draggable={tile.status === 'done'}
                                onDragStart={() => { dragIndex.current = index; }}
                                onDragEnd={() => { dragIndex.current = null; setDragOverIndex(null); }}
                                onDragOver={(e) => handleTileDragOver(e, index)}
                                onDrop={(e) => handleTileDrop(e, index)}
                                className={`relative rounded-2xl overflow-hidden border group text-left ${
                                    dragOverIndex === index ? 'border-white/70' : 'border-white/10'
                                }`}
                                style={{ aspectRatio: '4/5' }}
                                role="listitem"
                            >
                                {index === 0 && (
                                    <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-medium bg-white text-black">
                                        cover
                                    </span>
                                )}
                                <img
                                    src={tile.url}
                                    alt=""
                                    loading="lazy"
                                    className={`absolute inset-0 w-full h-full object-cover ${tile.status === 'uploading' ? 'opacity-60' : ''}`}
                                />
                                {/* hover controls */}
                                <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
                                    <button
                                        onClick={() => nudgeTile(index, -1)}
                                        disabled={index === 0}
                                        className="text-[11px] text-white bg-white/15 px-2.5 py-1 rounded-full disabled:opacity-30"
                                    >
                                        ← earlier
                                    </button>
                                    <button
                                        onClick={() => nudgeTile(index, 1)}
                                        disabled={index === tiles.length - 1}
                                        className="text-[11px] text-white bg-white/15 px-2.5 py-1 rounded-full disabled:opacity-30"
                                    >
                                        later →
                                    </button>
                                    <button
                                        onClick={() => removeTile(index)}
                                        className="text-[11px] text-red-300 bg-black/40 px-2.5 py-1 rounded-full"
                                    >
                                        remove
                                    </button>
                                </div>
                                {/* drag affordance */}
                                {tile.status === 'done' && tiles.length > 1 && (
                                    <span className="absolute bottom-1.5 right-1.5 text-[9px] text-white/50 bg-black/40 px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        drag ↔ {index + 1}
                                    </span>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* add tile */}
                    <button
                        onClick={() => setPicking(true)}
                        aria-label="Add photos to the canvas"
                        className={`rounded-2xl border-2 border-dashed border-white/20 hover:border-white/50 transition-colors flex flex-col items-center justify-center gap-2 text-white/50 hover:text-white/80 ${
                            picking ? 'border-white/60' : ''
                        }`}
                        style={{ aspectRatio: '4/5'}}
                    >
                        <Upload className="w-6 h-6" />
                        <span className="text-xs font-body text-center px-3">drop photos<br />here or click</span>
                        <input
                            type="file"
                            accept={Object.keys(IMAGES_ACCEPT)[0]}
                            multiple
                            className="hidden"
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                                if (e.target.files?.length) uploadFiles(e.target.files);
                                e.target.value = ''; // allow re-picking the same file
                            }}
                            ref={(node) => {
                                if (node && picking) { node.click(); setPicking(false); }
                            }}
                        />
                    </button>
                </div>

                {tiles.length === 0 && !uploadingCount && (
                    <p className="text-center text-white/40 text-sm mt-10 font-body">
                        nothing on the canvas yet — drop a batch of event photos and start arranging
                    </p>
                )}
            </div>

            {/* ── honest footer ── */}
            <div className="px-5 py-2.5 border-t border-white/10 text-[10px] text-white/30 font-body flex items-center gap-3">
                <span>{tiles.filter((t) => t.status === 'done').length} photo{tiles.length === 1 ? '' : 's'} · position 1 = cover</span>
                {hasPending && <span>· uploads still landing — save unlocks when done</span>}
                {savedOnce && !saving && !hasPending && <span>· published ✓</span>}
                {!savedOnce && !hasPending && <span>· esc leaves without saving</span>}
            </div>
        </motion.div>
    );
}

export default PhotoCanvas;
