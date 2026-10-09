import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Users, FileText, BarChart3, Upload, Plus, Edit, Trash2 } from 'lucide-react';
import { api } from '../api';
import toast from 'react-hot-toast';
import PlaygroundStudio from './PlaygroundStudio';

function Dashboard() {
    const navigate = useNavigate();
    const [articles, setArticles] = useState([]);
    const [gallery, setGallery] = useState([]);
    const [loading, setLoading] = useState(true);
    // The admin dashboard reads its own flags: admin token is already required
    // for anything here, so canary resolves to "on" for every dashboard viewer.
    const [playground, setPlayground] = useState(null); // null = deciding

    useEffect(() => {
        api.getFlags()
            .then((flags) => {
                const row = (flags || []).find((f) => f.key === 'admin_playground');
                setPlayground(row?.state === 'canary' || row?.state === 'on');
            })
            .catch(() => setPlayground(false)); // fail-closed to the classic board
    }, []);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [articlesData, galleryData] = await Promise.all([
                api.getArticles(),
                api.getGallery()
            ]);
            setArticles(articlesData);
            setGallery(galleryData);
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const deleteArticle = async (id) => {
        if (!confirm('Delete this article?')) return;
        try {
            await api.deleteArticle(id);
            setArticles(prev => prev.filter(a => a.id !== id));
            toast.success('Article deleted');
        } catch (error) {
            toast.error('Failed to delete article');
        }
    };

    const stats = [
        { title: "Articles", value: articles.length, icon: FileText },
        { title: "Published", value: articles.filter(a => a.published).length, icon: BarChart3 },
        { title: "Drafts", value: articles.filter(a => !a.published).length, icon: Edit },
        { title: "Photo stories", value: gallery.length, icon: Upload }
    ];

    // Creative playground (flag-gated): the studio home replaces the stats wall.
    if (playground) return <PlaygroundStudio />;
    // Keep the shell quiet while rollout state resolves, then show a real loader.
    if (playground === null) return <div aria-label="Loading creator studio" className="space-y-5 animate-pulse"><div className="h-12 w-72 rounded bg-muted" /><div className="h-24 rounded-xl bg-muted" /><div className="grid gap-3 sm:grid-cols-2"><div className="h-28 rounded-xl bg-muted" /><div className="h-28 rounded-xl bg-muted" /></div></div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Your writing</p>
                    <h1 className="font-display text-3xl font-semibold">Studio overview</h1>
                </div>
                <Button onClick={() => navigate('/articles/new')}>
                    <Plus className="mr-2 h-4 w-4" />
                    New article
                </Button>
            </div>

            {loading ? (
                <div aria-label="Loading dashboard data" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 animate-pulse">
                    {[1, 2, 3, 4].map((item) => <div key={item} className="h-28 rounded-xl bg-muted" />)}
                </div>
            ) : (
            <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (                        <Card key={stat.title} className="transition-colors hover:border-primary/40">

                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {stat.title}
                            </CardTitle>
                            <stat.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Recent writing</CardTitle>
                            <Button variant="outline" size="sm" onClick={() => navigate('/articles')}>
                                View All
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {articles.slice(0, 5).map((article) => (
                                    <div key={article.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium">{article.title}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {article.published ? 'Published' : 'Draft'} • {new Date(article.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex space-x-2">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                aria-label={`Edit ${article.title}`}
                                                onClick={() => navigate(`/articles/${article.id}`)}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                aria-label={`Delete ${article.title}`}
                                                onClick={() => deleteArticle(article.id)}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {articles.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8">
                                        No articles yet. Create your first article!
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>                            <CardTitle>Go to</CardTitle>

                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button 
                            className="w-full justify-start" 
                            variant="outline"
                            onClick={() => navigate('/articles/new')}
                        >
                            <FileText className="mr-2 h-4 w-4" />
                            Write an article
                        </Button>
                        <Button 
                            className="w-full justify-start" 
                            variant="outline"
                            onClick={() => navigate('/gallery')}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Arrange photo stories
                        </Button>
                        <Button 
                            className="w-full justify-start" 
                            variant="outline"
                            onClick={() => navigate('/settings')}
                        >
                            <Users className="mr-2 h-4 w-4" />
                            Settings
                        </Button>
                    </CardContent>
                </Card>
            </div>
            </>
            )}
        </div>
    );
}

export default Dashboard;