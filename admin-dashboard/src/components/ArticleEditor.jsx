import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Save, ArrowLeft, Eye, EyeOff, Upload, Columns, X, Keyboard, ListTree, Cloud, Check, CloudOff, Loader2 } from 'lucide-react';
import MarkdownToolbar from './MarkdownToolbar';
import { MarkdownPreview } from './MarkdownPreview';
import ImageUpload from './ImageUpload';
import ImageOrganizer from './ImageOrganizer';
import ShortcutsModal from './ShortcutsModal';
import { api } from '../api';
import toast from 'react-hot-toast';
import { insertAtCursor, wrapSelection, prefixLine } from '../utils/markdownEditor';

// tags is stored as a JSON string in the DB — normalize to an array
const parseTags = (raw) => {
    if (Array.isArray(raw)) return raw;
    if (!raw) return [];
    try {
        const v = JSON.parse(raw);
        return Array.isArray(v) ? v : [];
    } catch {
        return String(raw).split(',').map(s => s.trim()).filter(Boolean);
    }
};

// ─── Crash-safety draft (localStorage snapshot) ─────────────────────────────
const draftKeyFor = (id) => `article-editor-draft-${id || 'new'}`;

const EMPTY_ARTICLE = {
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    category: '',
    published: false,
    image_url: '',
    tags: [],
    show_toc: true
};

const ArticleEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview' | 'split'
    const contentRef = useRef(null);
    const imageUploadRef = useRef(null);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [tagInput, setTagInput] = useState('');
    // autosave state machine: 'idle' | 'saving' | 'saved' | 'error'
    const [saveStatus, setSaveStatus] = useState('idle');
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [draftKey, setDraftKey] = useState(null); // set once the local article id is known
    const [recoverableDraft, setRecoverableDraft] = useState(null); // pending crash-recovery snapshot
    const [article, setArticleState] = useState({ ...EMPTY_ARTICLE });
    const articleRef = useRef(article); // latest article for async callbacks
    const autosaveTimerRef = useRef(null);
    const serverSavedRef = useRef(null); // last payload successfully persisted to the server
    const creatingRef = useRef(false); // guards against double-creating a new article

    const setArticle = (updater) => {
        setArticleState(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            articleRef.current = next;
            return next;
        });
    };

    // Instant crash-safety: snapshot to localStorage on every change (before any
    // debounced server save). This is what survives a power cut mid-sentence.
    useEffect(() => {
        if (!draftKey || loading) return;
        try {
            localStorage.setItem(draftKey, JSON.stringify({
                ...article,
                savedAt: Date.now(),
            }));
        } catch {
            /* storage full/blocked — server autosave is the fallback */
        }
    }, [article, draftKey, loading]);

    // Debounced server autosave (drafts only — never publishes). Fires 2s after
    // the last change, and only when there is something new to persist.
    useEffect(() => {
        if (!draftKey || loading) return;
        if (!article.title?.trim() && !article.content?.trim()) return;
        if (JSON.stringify(article) === JSON.stringify(serverSavedRef.current)) return;
        clearTimeout(autosaveTimerRef.current);
        setSaveStatus('idle');
        autosaveTimerRef.current = setTimeout(() => {
            autosaveToServer();
        }, 2000);
        return () => clearTimeout(autosaveTimerRef.current);
    }, [article, draftKey, loading]);

    const autosaveToServer = useCallback(async () => {
        const current = articleRef.current;
        if (!current) return;
        if (JSON.stringify(current) === JSON.stringify(serverSavedRef.current)) return;
        // New articles: create once, then flip to update mode — user stays in the editor
        if (!draftKey || draftKey.endsWith('new')) {
            if (creatingRef.current) return;
            if (!current.title?.trim() && !current.content?.trim()) return;
            creatingRef.current = true;
            try {
                setSaveStatus('saving');
                const created = await api.createArticle({ ...current, published: current.published || false });
                serverSavedRef.current = current;
                const newId = created?.id;
                if (newId) {
                    const oldKey = draftKey;
                    setDraftKey(draftKeyFor(newId));
                    // Carry the real id on the local object so later saves update, not re-create
                    setArticle(prev => ({ ...prev, id: newId }));
                    // Move the localStorage snapshot to the new id so recovery stays consistent
                    try {
                        const snap = localStorage.getItem(oldKey);
                        if (snap) {
                            localStorage.setItem(draftKeyFor(newId), snap);
                            localStorage.removeItem(oldKey);
                        }
                    } catch { /* noop */ }
                    window.history.replaceState(null, '', `/articles/${newId}`);
                }
                setSaveStatus('saved');
                setLastSavedAt(Date.now());
            } catch {
                setSaveStatus('error');
            } finally {
                creatingRef.current = false;
            }
            return;
        }
        // Existing article: silent draft update
        const articleId = draftKey.replace('article-editor-draft-', '');
        try {
            setSaveStatus('saving');
            await api.updateArticle(articleId, { ...current, published: current.published || false });
            serverSavedRef.current = current;
            setSaveStatus('saved');
            setLastSavedAt(Date.now());
        } catch {
            setSaveStatus('error');
        }
    }, [draftKey]);

    // Warn before leaving with unsaved server changes (localStorage snapshot still protects data)
    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (saveStatus === 'saving') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [saveStatus]);

    useEffect(() => {
        if (id && id !== 'new') {
            loadArticle();
        } else {
            setDraftKey(draftKeyFor('new'));
            // Offer recovery of a brand-new article that was never server-saved
            try {
                const raw = localStorage.getItem(draftKeyFor('new'));
                if (raw) {
                    const snap = JSON.parse(raw);
                    if ((snap.title?.trim() || snap.content?.trim())) {
                        setRecoverableDraft({ key: draftKeyFor('new'), snapshot: snap });
                    }
                }
            } catch { /* corrupt snapshot — ignore */ }
        }
    }, [id]);

    const loadArticle = async () => {
        try {
            setLoading(true);
            const articles = await api.getArticles();
            const foundArticle = articles.find(a => a.id === id);
            const base = foundArticle
                ? {
                    ...foundArticle,
                    tags: parseTags(foundArticle.tags),
                    show_toc: foundArticle.show_toc !== 0 && foundArticle.show_toc !== false,
                }
                : {
                    title: '', slug: '', content: '', excerpt: '', category: '',
                    published: false, image_url: '', tags: [], show_toc: true,
                };
            serverSavedRef.current = base;

            // Crash recovery: is there a newer local snapshot with actual changes?
            const key = draftKeyFor(id);
            let recovered = null;
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const snap = JSON.parse(raw);
                    const serverTime = foundArticle?.updated_at ? new Date(foundArticle.updated_at + 'Z').getTime() : 0;
                    const differs = JSON.stringify({ ...snap, savedAt: undefined }) !== JSON.stringify({ ...base, savedAt: undefined });
                    if (snap.savedAt && snap.savedAt > serverTime + 1000 && differs) recovered = snap;
                }
            } catch { /* corrupt snapshot — ignore */ }

            setDraftKey(key);
            if (recovered) {
                setArticle(base); // start from server version; restore on confirm
                setRecoverableDraft({ key, snapshot: recovered });
            } else {
                setArticle(base);
                try { localStorage.removeItem(key); } catch { /* noop */ }
            }
        } catch (error) {
            toast.error('Failed to load article');
        } finally {
            setLoading(false);
        }
    };

    const restoreDraft = () => {
        if (!recoverableDraft) return;
        const snap = recoverableDraft.snapshot;
        const { savedAt, ...rest } = snap;
        setArticle(prev => ({
            ...prev,
            ...rest,
            tags: parseTags(rest.tags),
            show_toc: rest.show_toc !== 0 && rest.show_toc !== false,
        }));
        setRecoverableDraft(null);
        toast.success('Recovered your unsaved changes');
    };

    const discardDraft = () => {
        if (recoverableDraft) {
            try { localStorage.removeItem(recoverableDraft.key); } catch { /* noop */ }
        }
        setRecoverableDraft(null);
    };

    const generateSlug = (title) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9 -]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim('-');
    };

    const handleTitleChange = (title) => {
        setArticle(prev => ({ ...prev, title, slug: generateSlug(title) }));
    };

    const handleContentChange = (newContent) => {
        if (typeof newContent === 'function') {
            setArticle(prev => ({ ...prev, content: newContent(prev.content) }));
        } else {
            setArticle(prev => ({ ...prev, content: newContent }));
        }
    };

    // ─── Tags ────────────────────────────────────────────────────────────────
    const addTag = () => {
        const t = tagInput.trim().toLowerCase();
        if (!t) return;
        setArticle(prev => ({ ...prev, tags: prev.tags?.includes(t) ? prev.tags : [...(prev.tags || []), t] }));
        setTagInput('');
    };
    const removeTag = (t) => setArticle(prev => ({ ...prev, tags: (prev.tags || []).filter(x => x !== t) }));

    // ─── Formatting shortcuts (inside the editor textarea) ──────────────────
    const applyEdit = (fn) => {
        const el = contentRef.current;
        if (!el) return;
        const result = fn(el);
        handleContentChange(result.newValue);
        requestAnimationFrame(() => {
            el.focus();
            if (result.selectStart !== undefined) el.setSelectionRange(result.selectStart, result.selectEnd);
            else if (result.cursorPos !== undefined) el.setSelectionRange(result.cursorPos, result.cursorPos);
        });
    };

    const handleEditorKeyDown = (e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (!mod) return;
        const key = e.key.toLowerCase();
        if (key === 'b') { e.preventDefault(); applyEdit(el => wrapSelection(el, '**', '**', 'bold text')); }
        else if (key === 'i') { e.preventDefault(); applyEdit(el => wrapSelection(el, '_', '_', 'italic text')); }
        else if (key === 'k') { e.preventDefault(); applyEdit(el => wrapSelection(el, '[', '](https://)', 'link text')); }
        else if (key === 'e') { e.preventDefault(); applyEdit(el => wrapSelection(el, '`', '`', 'code')); }
        else if (key === 'x' && e.shiftKey) { e.preventDefault(); applyEdit(el => wrapSelection(el, '~~', '~~', 'strikethrough')); }
        else if (['1', '2', '3', '4'].includes(key)) { e.preventDefault(); applyEdit(el => prefixLine(el, '#'.repeat(Number(key)) + ' ')); }
        else if (key === '8' && e.shiftKey) { e.preventDefault(); applyEdit(el => insertAtCursor(el, '\n- List item\n- List item\n')); }
        else if (key === '7' && e.shiftKey) { e.preventDefault(); applyEdit(el => insertAtCursor(el, '\n1. First item\n2. Second item\n')); }
        else if (key === 'u') { e.preventDefault(); imageUploadRef.current?.openPicker(); }
    };

    // ─── Global shortcuts (save / publish / cheat sheet) ─────────────────────
    useEffect(() => {
        const onKey = (e) => {
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) {
                if (e.key === '?') {
                    const el = document.activeElement;
                    const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
                    if (!typing) setShowShortcuts(v => !v);
                }
                return;
            }
            const key = e.key.toLowerCase();
            if (key === 's' && e.shiftKey) { e.preventDefault(); handleSave(true); }
            else if (key === 's') { e.preventDefault(); handleSave(false); }
            else if (key === '/') { e.preventDefault(); setShowShortcuts(v => !v); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    // ─── Paste / drag-drop files straight into the editor ────────────────────
    const uploadAndInsert = (files) => {
        const media = [...files].filter(f => f.type?.startsWith('image/') || f.type?.startsWith('video/'));
        if (media.length) imageUploadRef.current?.uploadFiles(media, { insert: true, skipCrop: true });
    };
    const handleEditorPaste = (e) => {
        const files = e.clipboardData?.files;
        if (files?.length) {
            e.preventDefault();
            uploadAndInsert(files);
        }
    };
    const handleEditorDrop = (e) => {
        if (e.dataTransfer?.files?.length) {
            e.preventDefault();
            uploadAndInsert(e.dataTransfer.files);
        }
    };

    const handleSave = async (publish = false) => {
        const current = articleRef.current || article;
        if (!current.title?.trim()) {
            toast.error('Title is required');
            return;
        }
        clearTimeout(autosaveTimerRef.current);
        try {
            setLoading(true);
            const articleData = { ...current, published: publish };
            const articleId = (id && id !== 'new') ? id : current.id;
            if (articleId) {
                const updated = await api.updateArticle(articleId, articleData);
                serverSavedRef.current = current;
                setSaveStatus('saved');
                setLastSavedAt(Date.now());
                toast.success(publish ? 'Article published' : 'Draft saved');
                if (updated?.id && updated.id !== articleId) {
                    window.history.replaceState(null, '', `/articles/${updated.id}`);
                }
                // Keep the editor open — no navigation on save
            } else {
                const created = await api.createArticle(articleData);
                serverSavedRef.current = current;
                setSaveStatus('saved');
                setLastSavedAt(Date.now());
                toast.success(publish ? 'Article published' : 'Draft saved');
                if (created?.id) {
                    const newId = created.id;
                    setDraftKey(draftKeyFor(newId));
                    setArticle(prev => ({ ...prev, id: newId }));
                    try { localStorage.removeItem(draftKeyFor('new')); } catch { /* noop */ }
                    // Stay in the editor — just swap the URL to the real article id
                    window.history.replaceState(null, '', `/articles/${newId}`);
                }
            }
        } catch (error) {
            toast.error('Failed to save article');
        } finally {
            setLoading(false);
        }
    };

    if (loading && id !== 'new') {
        return <div className="p-6">Loading...</div>;
    }

    const isSplit = viewMode === 'split';
    const isPreview = viewMode === 'preview';
    const isEdit = viewMode === 'edit';

    return (
        <div className="max-w-6xl mx-auto space-y-4">
            {/* Top bar */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-3">
                    <Button variant="outline" onClick={() => navigate('/articles')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <h1 className="text-xl font-bold">
                        {id === 'new' ? 'New Article' : 'Edit Article'}
                    </h1>
                </div>

                {/* Shortcuts help */}
                <button
                    onClick={() => setShowShortcuts(true)}
                    title="Keyboard shortcuts (Ctrl/⌘ + /)"
                    className="p-2 rounded-lg border hover:bg-muted transition-colors"
                >
                    <Keyboard className="h-4 w-4" />
                </button>

                {/* View mode toggle */}
                <div className="flex items-center border rounded-lg overflow-hidden">
                    <button
                        onClick={() => setViewMode('edit')}
                        className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                            isEdit ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                    >
                        <EyeOff className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                        onClick={() => setViewMode('split')}
                        className={`px-3 py-1.5 text-sm flex items-center gap-1.5 border-x transition-colors ${
                            isSplit ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                    >
                        <Columns className="h-3.5 w-3.5" /> Split
                    </button>
                    <button
                        onClick={() => setViewMode('preview')}
                        className={`px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors ${
                            isPreview ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        }`}
                    >
                        <Eye className="h-3.5 w-3.5" /> Preview
                    </button>
                </div>

                {/* Save/Publish actions */}
                <div className="flex items-center space-x-3">
                    {/* Autosave status indicator */}
                    <span
                        className="text-xs text-muted-foreground flex items-center gap-1.5"
                        title={lastSavedAt ? `Autosaved at ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Autosave keeps your work safe as you type'}
                    >
                        {saveStatus === 'saving' && (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                            </>
                        )}
                        {saveStatus === 'saved' && (
                            <>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                                Saved {lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </>
                        )}
                        {saveStatus === 'error' && (
                            <>
                                <CloudOff className="h-3.5 w-3.5 text-red-500" /> Offline — retrying
                            </>
                        )}
                        {saveStatus === 'idle' && (
                            <>
                                <Cloud className="h-3.5 w-3.5 opacity-50" /> Autosave on
                            </>
                        )}
                    </span>
                    <Button
                        variant="outline"
                        onClick={() => handleSave(false)}
                        disabled={loading}
                    >
                        <Save className="mr-2 h-4 w-4" />
                        Save Draft
                    </Button>
                    <Button
                        onClick={() => handleSave(true)}
                        disabled={loading}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        <Eye className="mr-2 h-4 w-4" />
                        Publish
                    </Button>
                </div>
            </div>

            {/* Crash-recovery banner */}
            {recoverableDraft && (
                <div className="flex items-center justify-between gap-3 border border-yellow-300 bg-yellow-50 text-yellow-900 rounded-lg px-4 py-2.5 text-sm">
                    <span>
                        We found unsaved work from a previous session
                        {recoverableDraft.snapshot.savedAt &&
                            ` (${new Date(recoverableDraft.snapshot.savedAt).toLocaleString()})`}. Restore it?
                    </span>
                    <span className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" onClick={discardDraft}>Discard</Button>
                        <Button size="sm" onClick={restoreDraft}>Restore</Button>
                    </span>
                </div>
            )}

            <div className={`grid gap-6 ${isSplit ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
                {/* Editor column — hidden in preview mode */}
                {!isPreview && (
                    <div className={`space-y-4 ${isSplit ? '' : 'lg:col-span-2'}`}>
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Content</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="title">Title</Label>
                                    <Input
                                        id="title"
                                        value={article.title}
                                        onChange={(e) => handleTitleChange(e.target.value)}
                                        placeholder="Article title..."
                                        className="text-lg"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="slug">URL Slug</Label>
                                    <Input
                                        id="slug"
                                        value={article.slug}
                                        onChange={(e) => setArticle(prev => ({ ...prev, slug: e.target.value }))}
                                        placeholder="url-slug"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="excerpt">Excerpt</Label>
                                    <textarea
                                        id="excerpt"
                                        value={article.excerpt}
                                        onChange={(e) => setArticle(prev => ({ ...prev, excerpt: e.target.value }))}
                                        placeholder="Brief description..."
                                        className="w-full p-3 border rounded-lg h-16 resize-none bg-background text-foreground text-sm"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="content">
                                        Markdown Content
                                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                                            {article.content.length} chars
                                        </span>
                                    </Label>
                                    <MarkdownToolbar
                                        textareaRef={contentRef}
                                        onContentChange={handleContentChange}
                                        onImageClick={() => imageUploadRef.current?.openPicker()}
                                    />
                                    <textarea
                                        ref={contentRef}
                                        id="content"
                                        value={article.content}
                                        onChange={(e) => handleContentChange(e.target.value)}
                                        onKeyDown={handleEditorKeyDown}
                                        onPaste={handleEditorPaste}
                                        onDrop={handleEditorDrop}
                                        placeholder="Write in Markdown... Use the toolbar above for headings, quotes, code, tables, and images."
                                        className={`w-full p-3 border border-t-0 rounded-b-lg font-mono text-sm bg-background text-foreground ${
                                            isSplit ? 'h-[500px]' : 'h-96'
                                        }`}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ListTree className="h-4 w-4" /> Article structure &amp; image placement
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ImageOrganizer
                                    content={article.content}
                                    onContentChange={handleContentChange}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Upload className="h-4 w-4" /> Add Media
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ImageUpload
                                    ref={imageUploadRef}
                                    onInsert={handleContentChange}
                                    onSetFeatured={(url) => setArticle(prev => ({ ...prev, image_url: url }))}
                                    textareaRef={contentRef}
                                    autoInsert
                                    allowVideos
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                    Uploads <strong>auto-insert at your cursor</strong>. You can also paste
                                    (<kbd className="px-1 bg-muted rounded">Ctrl/⌘+V</kbd>) or drag files straight into the
                                    editor. Use <strong>Set as featured</strong> for the hero banner above the title.
                                </p>
                            </CardContent>
                        </Card>

                        {/* Settings — only show in non-split edit mode in sidebar column */}
                        {isEdit && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Settings</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="category">Category</Label>
                                        <Input
                                            id="category"
                                            value={article.category}
                                            onChange={(e) => setArticle(prev => ({ ...prev, category: e.target.value }))}
                                            placeholder="e.g., Technology"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="tags">Tags</Label>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {(article.tags || []).map((t) => (
                                                <span key={t} className="text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    {t}
                                                    <button type="button" onClick={() => removeTag(t)} className="hover:text-red-500">
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <Input
                                            id="tags"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ',') {
                                                    e.preventDefault();
                                                    addTag();
                                                } else if (e.key === 'Backspace' && !tagInput && article.tags?.length) {
                                                    removeTag(article.tags[article.tags.length - 1]);
                                                }
                                            }}
                                            onBlur={addTag}
                                            placeholder="Add a tag and press Enter"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="featured-image">Featured Hero Image</Label>
                                        <p className="text-xs text-muted-foreground mb-1">
                                            Optional banner above the title — separate from inline body images
                                        </p>
                                        <Input
                                            id="featured-image"
                                            value={article.image_url}
                                            onChange={(e) => setArticle(prev => ({ ...prev, image_url: e.target.value }))}
                                            placeholder="https://... or use Set as featured on an upload"
                                        />
                                        {article.image_url && (
                                            <img
                                                src={article.image_url}
                                                alt="Featured preview"
                                                className="mt-2 w-full h-24 object-cover rounded-lg"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            id="published"
                                            checked={article.published}
                                            onChange={(e) => setArticle(prev => ({ ...prev, published: e.target.checked }))}
                                            className="rounded"
                                        />
                                        <Label htmlFor="published">Published</Label>
                                    </div>
                                    <div className="flex items-start space-x-2">
                                        <input
                                            type="checkbox"
                                            id="show_toc"
                                            checked={article.show_toc !== false}
                                            onChange={(e) => setArticle(prev => ({ ...prev, show_toc: e.target.checked }))}
                                            className="rounded mt-1"
                                        />
                                        <div>
                                            <Label htmlFor="show_toc">Auto table of contents</Label>
                                            <p className="text-xs text-muted-foreground">
                                                Builds a clickable TOC from your H2/H3 headings. Uncheck to hand-write your own inside the content.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                {/* Preview column */}
                {(isPreview || isSplit) && (
                    <div className={`space-y-4 ${isPreview ? 'lg:col-span-3' : ''}`}>
                        {/* Settings bar in preview/split mode */}
                        {(isPreview || isSplit) && (
                            <Card>
                                <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <Label className="text-xs">Category</Label>
                                        <Input
                                            value={article.category}
                                            onChange={(e) => setArticle(prev => ({ ...prev, category: e.target.value }))}
                                            placeholder="Category"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <Label className="text-xs">Featured Image URL</Label>
                                        <Input
                                            value={article.image_url}
                                            onChange={(e) => setArticle(prev => ({ ...prev, image_url: e.target.value }))}
                                            placeholder="https://..."
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    <div className="flex items-end gap-4">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={article.published}
                                                onChange={(e) => setArticle(prev => ({ ...prev, published: e.target.checked }))}
                                            />
                                            Published
                                        </label>
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={article.show_toc !== false}
                                                onChange={(e) => setArticle(prev => ({ ...prev, show_toc: e.target.checked }))}
                                            />
                                            Auto TOC
                                        </label>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Eye className="h-4 w-4" /> Preview
                                    <span className="text-xs font-normal text-muted-foreground ml-1">
                                        (as it appears on your blog)
                                    </span>
                                </CardTitle>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    article.published
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                }`}>
                                    {article.published ? 'Published' : 'Draft'}
                                </span>
                            </CardHeader>
                            <CardContent className={`overflow-y-auto ${isSplit ? 'max-h-[700px]' : ''}`}>
                                <MarkdownPreview
                                    content={article.content}
                                    title={article.title}
                                    category={article.category}
                                    image_url={article.image_url}
                                />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Sidebar in edit-only mode */}
                {isEdit && (
                    <div className="space-y-4">
                        {/* Already rendered Settings inline above for edit mode */}
                    </div>
                )}
            </div>

            <ShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </div>
    );
};

export default ArticleEditor;
