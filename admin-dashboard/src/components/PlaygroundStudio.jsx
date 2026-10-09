import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import toast from 'react-hot-toast';
import PhotoCanvas from './PhotoCanvas';
import {
    FileText, Zap, Image as ImageIcon, PenLine, ChevronRight, X, Clock, Flame, ArrowUpRight,
} from 'lucide-react';

function routeCommand(text, articles) {
    const t = text.toLowerCase();
    if (/photo|picture|gallery|upload|drop|event/.test(t)) return { label: 'open photo stories', to: '/gallery' };
    if (/instant|moment|capture|quick/.test(t)) return { label: 'open camera moments', to: '/instants' };
    if (/flag|rollout|experiment/.test(t)) return { label: 'open feature flags', to: '/flags' };
    if (/take|opinion|hot/.test(t)) return { label: 'open hot takes', to: '/hot-takes' };
    const draft = articles.find((article) =>
        !article.published && (article.title || '').toLowerCase().includes(t.split(' ').slice(-2).join(' ')) && t.length > 6
    );
    if (draft) return { label: `resume “${draft.title.slice(0, 32)}”`, to: `/articles/${draft.id}` };
    return { label: 'start an article', to: '/articles/new' };
}

function PlaygroundStudio() {
    const navigate = useNavigate();
    const [canvasItem, setCanvasItem] = useState(null);
    const [reduceMotion, setReduceMotion] = useState(false);
    const [command, setCommand] = useState('');
    const [articles, setArticles] = useState([]);
    const [gallery, setGallery] = useState([]);
    const [captures, setCaptures] = useState([]);
    const [reactionSummary, setReactionSummary] = useState({});
    const [dismissed, setDismissed] = useState(() => {
        try { return JSON.parse(localStorage.getItem('pgDismissed') || '[]'); } catch { return []; }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const updateMotionPreference = () => setReduceMotion(mediaQuery.matches);
        updateMotionPreference();
        mediaQuery.addEventListener('change', updateMotionPreference);
        return () => mediaQuery.removeEventListener('change', updateMotionPreference);
    }, []);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [articlesData, galleryData, instantData, reactions] = await Promise.all([
                    api.getArticles(),
                    api.getGallery(),
                    api.getInstants().catch(() => []),
                    api.getReactionSummary().catch(() => ({})),
                ]);
                if (!alive) return;
                setArticles(articlesData || []);
                setGallery(galleryData || []);
                setCaptures((instantData || []).filter((instant) => instant.source === 'capture').slice(0, 8));
                setReactionSummary(reactions || {});
            } catch {
                if (alive) toast.error('Could not load your work. Refresh to try again.');
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    const drafts = useMemo(() => articles.filter((article) => !article.published), [articles]);
    const coverless = useMemo(() => articles.filter((article) => article.published && !article.image_url), [articles]);

    const suggestions = useMemo(() => {
        const all = [];
        for (const draft of drafts.slice(0, 3)) {
            all.push({
                id: `draft-${draft.id}`,
                title: draft.title || 'Untitled draft',
                detail: 'Continue writing this draft',
                to: `/articles/${draft.id}`,
                icon: PenLine,
            });
        }
        for (const article of coverless.slice(0, 2)) {
            all.push({
                id: `cover-${article.id}`,
                title: article.title,
                detail: 'Choose a cover image for this article',
                to: `/articles/${article.id}`,
                icon: ImageIcon,
            });
        }
        if (gallery.length > 0) {
            const withMedia = [...gallery].sort((a, b) => {
                const count = (item) => {
                    try { return Array.isArray(item.media) ? item.media.length : JSON.parse(item.media || '[]').length; }
                    catch { return 0; }
                };
                return count(b) - count(a);
            });
            const richest = withMedia[0];
            all.push({
                id: `gallery-canvas-${richest?.id || 'any'}`,
                title: richest?.title || `${gallery.length} photo stories`,
                detail: 'Set the cover and sequence for this event',
                to: null,
                icon: ImageIcon,
                galleryItem: richest || null,
            });
            all.push({
                id: 'gallery-browse',
                title: `${gallery.length} photo stories`,
                detail: 'Review the full gallery',
                to: '/gallery',
                icon: ImageIcon,
            });
        }
        const reactionTotal = Object.values(reactionSummary).reduce(
            (sum, list) => sum + (list || []).reduce((count, reaction) => count + Number(reaction.count || 0), 0),
            0
        );
        if (reactionTotal > 0) {
            all.push({
                id: 'reactions-loop',
                title: `${reactionTotal} reactions to your moments`,
                detail: 'See how visitors responded',
                to: '/instants',
                icon: Flame,
            });
        }
        return all.filter((item) => !dismissed.includes(item.id)).slice(0, 4);
    }, [drafts, coverless, gallery, reactionSummary, dismissed]);

    const dismiss = (id) => {
        const next = [...dismissed, id];
        setDismissed(next);
        try { localStorage.setItem('pgDismissed', JSON.stringify(next)); } catch { /* storage is optional */ }
    };

    const commandRoute = routeCommand(command, articles);
    const hour = new Date().getHours();
    const greeting = hour < 5 ? 'still up' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

    return (
        <div className="max-w-5xl mx-auto">
            <motion.p
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-muted-foreground mb-1"
            >
                {greeting}, your studio is ready
            </motion.p>
            <motion.h1
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="font-display text-4xl sm:text-5xl font-semibold leading-[1.08] mb-8 max-w-3xl"
            >
                what are we <span className="text-primary">making</span> today?
            </motion.h1>

            <motion.form
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={(event) => { event.preventDefault(); if (command.trim()) navigate(commandRoute.to); }}
                className="mb-8 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border-2 border-border p-3 sm:p-4 bg-card transition-colors focus-within:border-primary/60"
            >
                <input
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    placeholder="Write an article, find a draft, or arrange event photos"
                    aria-label="Find a studio task"
                    className="min-h-11 min-w-0 flex-1 bg-transparent px-2 text-base sm:text-lg outline-none placeholder:text-muted-foreground/70"
                />
                {command.trim() && (
                    <button
                        type="submit"
                        className="min-h-11 shrink-0 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
                    >
                        {commandRoute.label}
                    </button>
                )}
            </motion.form>

            <div className="flex flex-wrap gap-2 mb-10">
                {[
                    { label: 'write an article', icon: FileText, action: () => navigate('/articles/new') },
                    { label: 'arrange event photos', icon: ImageIcon, action: () => setCanvasItem({}) },
                    { label: 'capture a moment', icon: Zap, action: () => navigate('/instants') },
                ].map((action, index) => (
                    <motion.button
                        key={action.label}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + index * 0.04 }}
                        onClick={action.action}
                        className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-accent transition-colors active:scale-[0.98]"
                    >
                        <action.icon className="h-4 w-4" aria-hidden="true" /> {action.label}
                    </motion.button>
                ))}
            </div>

            {loading ? (
                <div aria-label="Loading your studio" className="space-y-3 animate-pulse mb-10">
                    <div className="h-3 w-28 rounded bg-muted" />
                    <div className="grid gap-3 sm:grid-cols-2">
                        {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 rounded-xl bg-muted" />)}
                    </div>
                </div>
            ) : suggestions.length > 0 && (
                <AnimatePresence>
                    <motion.section
                        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mb-10"
                    >
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Work to pick up</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {suggestions.map((item) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    className="relative rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/35"
                                >
                                    <button
                                        onClick={() => dismiss(item.id)}
                                        aria-label={`Dismiss ${item.title}`}
                                        className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                    >
                                        <X className="h-4 w-4" aria-hidden="true" />
                                    </button>
                                    <button
                                        onClick={() => (item.to ? navigate(item.to) : setCanvasItem(item.galleryItem || {}))}
                                        className="flex min-h-11 w-full items-start gap-3 pr-10 text-left"
                                    >
                                        <item.icon className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" aria-hidden="true" />
                                        <span className="min-w-0">
                                            <span className="block font-medium break-words">{item.title}</span>
                                            <span className="mt-1 block text-sm text-muted-foreground">{item.detail}</span>
                                        </span>
                                        <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>
                </AnimatePresence>
            )}

            {captures.length > 0 && (
                <section className="mb-10">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Camera moments</p>
                        <button onClick={() => navigate('/instants')} className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                            View all <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        {captures.map((capture) => {
                            const reactions = reactionSummary[capture.id] || [];
                            const total = reactions.reduce((sum, reaction) => sum + Number(reaction.count || 0), 0);
                            const top = reactions.slice().sort((a, b) => b.count - a.count)[0];
                            return (
                                <button
                                    key={capture.id}
                                    onClick={() => navigate('/instants')}
                                    className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-card text-left"
                                    aria-label={`Open camera moment${capture.text ? `: ${capture.text.slice(0, 60)}` : ''}`}
                                >
                                    {capture.image_url ? (
                                        <img src={capture.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                                    ) : (
                                        <span className="absolute inset-0 flex items-center p-2 text-xs leading-snug line-clamp-4">{capture.text}</span>
                                    )}
                                    {total > 0 && (
                                        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 px-2 py-1 text-xs text-white">
                                            {top?.emoji} {top?.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </section>
            )}

            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{articles.filter((article) => article.published).length} published articles</span>
                <span aria-hidden="true">·</span>
                <span>{drafts.length} drafts</span>
                <span aria-hidden="true">·</span>
                <span>{gallery.length} photo stories</span>
                <span aria-hidden="true">·</span>
                <Clock className="h-3 w-3" aria-hidden="true" />
                <span>Classic article list: <a className="underline underline-offset-2" href="/articles">Articles</a></span>
            </p>

            {createPortal(
                <AnimatePresence>
                    {canvasItem !== null && (
                        <PhotoCanvas
                            key={canvasItem.id || 'new'}
                            item={canvasItem.id ? canvasItem : null}
                            onClose={() => setCanvasItem(null)}
                            onSaved={() => api.getGallery().then((items) => setGallery(items || [])).catch(() => {})}
                        />
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}

export default PlaygroundStudio;
