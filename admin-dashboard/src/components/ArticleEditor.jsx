import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Save, ArrowLeft, Eye, EyeOff, Upload, Columns, X, Keyboard, ListTree } from 'lucide-react';
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

const ArticleEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview' | 'split'
    const contentRef = useRef(null);
    const imageUploadRef = useRef(null);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [article, setArticle] = useState({
        title: '',
        slug: '',
        content: '',
        excerpt: '',
        category: '',
        published: false,
        image_url: '',
        tags: [],
        show_toc: true
    });

    useEffect(() => {
        if (id && id !== 'new') {
            loadArticle();
        }
    }, [id]);

    const loadArticle = async () => {
        try {
            setLoading(true);
            const articles = await api.getArticles();
            const foundArticle = articles.find(a => a.id === id);
            if (foundArticle) {
                setArticle({
                    ...foundArticle,
                    tags: parseTags(foundArticle.tags),
                    show_toc: foundArticle.show_toc !== 0 && foundArticle.show_toc !== false,
                });
            }
        } catch (error) {
            toast.error('Failed to load article');
        } finally {
            setLoading(false);
        }
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
        if (!article.title.trim()) {
            toast.error('Title is required');
            return;
        }
        try {
            setLoading(true);
            const articleData = { ...article, published: publish };
            if (id && id !== 'new') {
                await api.updateArticle(id, articleData);
                toast.success(publish ? 'Article published' : 'Draft saved');
            } else {
                await api.createArticle(articleData);
                toast.success(publish ? 'Article published' : 'Draft saved');
                navigate('/articles');
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
                <div className="flex space-x-2">
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
