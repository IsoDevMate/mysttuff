import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Save, ArrowLeft, Eye, Upload } from 'lucide-react';
import ImageUpload from './ImageUpload';
import { api } from '../api';
import toast from 'react-hot-toast';

const ArticleEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
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
        setArticle(prev => ({
            ...prev,
            title,
            slug: generateSlug(title)
        }));
    };

    const handleImageUploaded = (imageUrl) => {
        const markdown = `\n![Image](${imageUrl})\n`;
        setArticle(prev => ({
            ...prev,
            content: prev.content + markdown
        }));
        toast.success('Image inserted into content');
    };

    const handleSave = async (publish = false) => {
        if (!article.title.trim()) {
            toast.error('Title is required');
            return;
        }

        try {
            setLoading(true);
            const articleData = {
                ...article,
                published: publish
            };

            if (id && id !== 'new') {
                await api.updateArticle(id, articleData);
                toast.success('Article updated');
            } else {
                await api.createArticle(articleData);
                toast.success('Article created');
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

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Button variant="outline" onClick={() => navigate('/articles')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Button>
                    <h1 className="text-2xl font-bold">
                        {id === 'new' ? 'Create Article' : 'Edit Article'}
                    </h1>
                </div>
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
                        className="bg-green-600 hover:bg-green-700"
                    >
                        <Eye className="mr-2 h-4 w-4" />
                        Publish
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Article Content</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    value={article.title}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    placeholder="Enter article title..."
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
                                    placeholder="Brief description of the article..."
                                    className="w-full p-3 border rounded-lg h-20 resize-none"
                                />
                            </div>

                            <div>
                                <Label htmlFor="content">Content (Markdown)</Label>
                                <textarea
                                    id="content"
                                    value={article.content}
                                    onChange={(e) => setArticle(prev => ({ ...prev, content: e.target.value }))}
                                    placeholder="Write your article content in Markdown..."
                                    className="w-full p-3 border rounded-lg h-96 font-mono text-sm"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center">
                                <Upload className="mr-2 h-4 w-4" />
                                Add Images
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ImageUpload onImageUploaded={handleImageUploaded} />
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="category">Category</Label>
                                <Input
                                    id="category"
                                    value={article.category}
                                    onChange={(e) => setArticle(prev => ({ ...prev, category: e.target.value }))}
                                    placeholder="e.g., Technology, Tutorial"
                                />
                            </div>

                            <div>
                                <Label htmlFor="featured-image">Featured Image URL</Label>
                                <Input
                                    id="featured-image"
                                    value={article.image_url}
                                    onChange={(e) => setArticle(prev => ({ ...prev, image_url: e.target.value }))}
                                    placeholder="https://example.com/image.jpg"
                                />
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

                    {article.image_url && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Featured Image Preview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <img
                                    src={article.image_url}
                                    alt="Featured"
                                    className="w-full h-32 object-cover rounded-lg"
                                />
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ArticleEditor;