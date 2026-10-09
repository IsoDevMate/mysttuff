import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import toast from 'react-hot-toast';
import {
    FileText, Zap, Sparkles, CornerDownLeft, Image as ImageIcon,
    PenLine, ChevronRight, X, Clock, Flame, ArrowUpRight,
} from 'lucide-react';

/**
 * Playground Studio — the creative home behind `admin_playground`.
 * Not a stats wall: a "what are we making?" box that routes intent, resumable
 * chips for unfinished work, recent captures to keep the reciprocity loop
 * visible, and contextual suggestions (cover-less articles, quiet galleries).
 * Everything false-opens to the real tools — no fake buttons.
 */

const PLACEHOLDER = "what are we making today? try \"article about postgres\" or \"photos from friday\"";

// Route the command box text to the right surface.
function routeCommand(text, articles) {
    const t = text.toLowerCase();
    if (/photo|picture|gallery|upload|drop/.test(t)) return { label: 'gallery studio', to: '/gallery' };
    if (/instant|moment|capture|quick/.test(t)) return { label: 'instants studio', to: '/instants' };
    if (/flag|rollout|experiment/.test(t)) return { label: 'flags', to: '/flags' };
    if (/take|opinion|hot/.test(t)) return { label: 'hot takes', to: '/hot-takes' };
    // Default: an article. Reuse an existing draft if the words match one.
    const draft = articles.find((a) => !a.published && (a.title || '').toLowerCase().includes(t.split(' ').slice(-2).join(' ')) && t.length > 6);
    if (draft) return { label: `resume “${draft.title.slice(0, 32)}”`, to: `/articles/${draft.id}` };
    return { label: 'start writing', to: '/articles/new' };
}

function PlaygroundStudio() {
    const navigate = useNavigate();
    // Respect the OS motion preference (framer-motion's version isn't exported
    // in this build, so a plain media query is safer).
    const [reduceMotion, setReduceMotion] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const apply = () => setReduceMotion(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);
    const [command, setCommand] = useState('');
    const [articles, setArticles] = useState([]);
    const [gallery, setGallery] = useState([]);
    const [captures, setCaptures] = useState([]);
    const [reactionSummary, setReactionSummary] = useState({});
    const [dismissed, setDismissed] = useState(() => JSON.parse(localStorage.getItem('pgDismissed') || '[]'));
    const inputRef = useRef(null);
    const [greeted, setGreeted] = useState(false);
    useEffect(() => setGreeted(true), []);

    useEffect(() => {
        (async () => {
            try {
                const [arts, gal, insts, reactions] = await Promise.all([
                    api.getArticles(),
                    api.getGallery(),
                    api.getInstants().catch(() => []),
                    api.getReactionSummary().catch(() => ({})),
                ]);
                setArticles(arts || []);
                setGallery(gal || []);
                setCaptures((insts || []).filter((i) => i.source === 'capture').slice(0, 8));
                setReactionSummary(reactions || {});
            } catch {
                toast.error('Could not load your work — retrying is safe');
            }
        })();
    }, []);

    const drafts = useMemo(() => articles.filter((a) => !a.published), [articles]);
    const coverless = useMemo(() => articles.filter((a) => a.published && !a.image_url), [articles]);

    const suggestions = useMemo(() => {
        const all = [];
        for (const d of drafts.slice(0, 3)) {
            all.push({ id: `draft-${d.id}`, kind: 'draft', title: d.title || 'untitled draft', sub: 'unfinished — want to finish it?', to: `/articles/${d.id}`, icon: PenLine });
        }
        for (const c of coverless.slice(0, 2)) {
            all.push({ id: `cover-${c.id}`, kind: 'cover', title: c.title, sub: 'published with no cover image — give it one?', to: `/articles/${c.id}`, icon: ImageIcon });
        }
        if (gallery.length > 0) {
            all.push({ id: 'gallery-breathe', kind: 'gallery', title: `${gallery.length} photos in the gallery`, sub: 'rearrange, recaption, or set a new vibe', to: '/gallery', icon: ImageIcon });
        }
        const reactionTotal = Object.values(reactionSummary).reduce((s, list) => s + list.reduce((x, r) => x + Number(r.count || 0), 0), 0);
        if (reactionTotal > 0) {
            all.push({ id: 'reactions-loop', kind: 'loop', title: `${reactionTotal} reactions so far`, sub: 'people are responding — keep the loop going', to: '/instants', icon: Flame });
        }
        return all.filter((s) => !dismissed.includes(s.id)).slice(0, 4);
    }, [drafts, coverless, gallery, reactionSummary, dismissed]);

    const dismiss = (id) => {
        const next = [...dismissed, id];
        setDismissed(next);
        localStorage.setItem('pgDismissed', JSON.stringify(next));
    };

    const cmd = routeCommand(command, articles);
    const hour = new Date().getHours();
    const greeting = hour < 5 ? 'still up' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

    return (
        <div className="max-w-5xl mx-auto" style={{ ['--motion-safe']: reduceMotion ? 0 : 1 }}>
            <style>{`@media (prefers-reduced-motion: reduce) { .pg-motion { animation: none !important; transition: none !important } }`}</style>

            {/* ── greeting ── */}
            <motion.p
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-muted-foreground mb-1 font-body"
            >
                {greeting} — the studio is warm
            </motion.p>
            <motion.h1
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-4xl font-bold tracking-tight mb-8"
            >
                what are we <span style={{ color: 'var(--accent-color, #78716c)' }}>making</span> today?
            </motion.h1>

            {/* ── the command box ── */}
            <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="relative mb-8"
            >
                <form
                    onSubmit={(e) => { e.preventDefault(); if (command.trim()) navigate(cmd.to); }}
                    className="group relative flex items-center gap-3 rounded-2xl border-2 px-5 py-4 bg-card transition-colors focus-within:border-primary/60"
                    style={{ borderColor: 'rgba(120,113,108,0.25)' }}
                >
                    <Sparkles className="w-5 h-5 text-muted-foreground shrink-0" />
                    <input
                        ref={inputRef}
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder={PLACEHOLDER}
                        aria-label="What are we making today?"
                        className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground/50 font-body"
                    />
                    {command.trim() ? (
                        <button
                            type="submit"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-foreground active:scale-95 transition-transform"
                        >
                            {cmd.label} <CornerDownLeft className="w-3.5 h-3.5" />
                        </button>
                    ) : (
                        <kbd className="hidden sm:block text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">enter ↵</kbd>
                    )}
                </form>
            </motion.div>

            {/* ── quick leaps: the three surfaces ── */}
            <div className="flex flex-wrap gap-2 mb-10">
                {[
                    { label: 'write an article', icon: FileText, to: '/articles/new' },
                    { label: 'drop photos', icon: ImageIcon, to: '/gallery' },
                    { label: 'capture a moment', icon: Zap, to: '/instants' },
                ].map((leap, i) => (
                    <motion.button
                        key={leap.label}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                        onClick={() => navigate(leap.to)}
                        className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-body hover:bg-accent active:scale-95 transition-transform"
                    >
                        <leap.icon className="w-4 h-4" /> {leap.label}
                    </motion.button>
                ))}
            </div>

            {/* ── contextual suggestions (ephemeral — dismissible) ── */}
            <AnimatePresence>
                {suggestions.length > 0 && (
                    <motion.section
                        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mb-10"
                    >
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-body">loose ends & possibilities</p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            {suggestions.map((s) => (
                                <motion.div
                                    key={s.id}
                                    layout
                                    initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="relative group rounded-xl border p-4 bg-card hover:shadow-md transition-shadow"
                                >
                                    <button
                                        onClick={() => dismiss(s.id)}
                                        aria-label={`dismiss suggestion: ${s.title}`}
                                        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-accent transition-opacity"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => navigate(s.to)} className="text-left w-full">
                                        <div className="flex items-start gap-3">
                                            <s.icon className="w-4 h-4 mt-0.5 text-muted-foreground" />
                                            <div className="min-w-0">
                                                <p className="font-medium truncate">{s.title}</p>
                                                <p className="text-sm text-muted-foreground">{s.sub}</p>
                                            </div>
                                            <ArrowUpRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                                        </div>
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            {/* ── recent captures + their reactions (the reciprocity loop) ── */}
            {captures.length > 0 && (
                <section className="mb-10">
                    <div className="flex items-baseline justify-between mb-3">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-body">moments you caught</p>
                        <button onClick={() => navigate('/instants')} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                            all instants <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {captures.map((c, i) => {
                            const rcs = reactionSummary[c.id] || [];
                            const total = rcs.reduce((s, r) => s + Number(r.count || 0), 0);
                            const top = rcs.slice().sort((a, b) => b.count - a.count)[0];
                            return (
                                <motion.button
                                    key={c.id}
                                    initial={reduceMotion ? false : { opacity: 0, rotate: i % 2 ? 1.5 : -1.5, y: 10 }}
                                    animate={{ opacity: 1, rotate: 0, y: 0 }}
                                    transition={{ delay: 0.2 + i * 0.04 }}
                                    onClick={() => navigate('/instants')}
                                    className="shrink-0 w-28 rounded-2xl overflow-hidden border bg-card text-left relative"
                                    style={{ aspectRatio: '4/5' }}
                                >
                                    {c.image_url ? (
                                        <img src={c.image_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 p-2 flex items-center"><p className="text-[10px] leading-snug line-clamp-4">{c.text}</p></div>
                                    )}
                                    {total > 0 && (
                                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] text-white" style={{ background: 'rgba(0,0,0,0.55)' }}>
                                            {top?.emoji} {top?.count}
                                        </span>
                                    )}
                                </motion.button>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* ── quiet footer stats (the old dashboard's data, demoted) ── */}
            <p className="text-xs text-muted-foreground font-body flex items-center gap-3 opacity-60">
                <span>{articles.filter((a) => a.published).length} live stories</span>
                <span>·</span>
                <span>{drafts.length} brewing</span>
                <span>·</span>
                <span>{gallery.length} photos</span>
                <span>·</span>
                <Clock className="w-3 h-3" />
                <span>the classic board is still under /articles if you miss it</span>
            </p>
        </div>
    );
}

export default PlaygroundStudio;
