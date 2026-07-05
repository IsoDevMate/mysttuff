import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Save, ArrowLeft, Eye, EyeOff, Upload, Columns } from 'lucide-react';
import MarkdownToolbar from './MarkdownToolbar';
import { MarkdownPreview } from './MarkdownPreview';
import ImageUpload from './ImageUpload';
import { api } from '../api';
import toast from 'react-hot-toast';

const ArticleEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('edit'); // 'edit' | 'preview' | 'split'
    const contentRef = useRef(null);
    const imageUploadRef = useRef(null);
    const [article, setArticle] = useState({
        title: '',
        slug: '',
        content: '',
        excerpt: '',
        category: '',
        published: false,
        image_url: ''
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
                setArticle(foundArticle);
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
                                    <Upload className="h-4 w-4" /> Add Images
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ImageUpload
                                    ref={imageUploadRef}
                                    onInsert={handleContentChange}
                                    textareaRef={contentRef}
                                />
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
                                        <Label htmlFor="featured-image">Featured Image URL</Label>
                                        <Input
                                            id="featured-image"
                                            value={article.image_url}
                                            onChange={(e) => setArticle(prev => ({ ...prev, image_url: e.target.value }))}
                                            placeholder="https://..."
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
                                    <div className="flex items-end gap-2">
                                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={article.published}
                                                onChange={(e) => setArticle(prev => ({ ...prev, published: e.target.checked }))}
                                            />
                                            Published
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
        </div>
    );
};

export default ArticleEditor;
