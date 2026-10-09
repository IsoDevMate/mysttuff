import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Eye, Calendar, Tag } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { api } from '../api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ArticleList({ onEdit, onNew }) {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const data = await api.getArticles();
      setArticles(data);
    } catch (error) {
      toast.error('Failed to fetch articles');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    try {
      await api.deleteArticle(id);
      setArticles(prev => prev.filter(article => article.id !== id));
      toast.success('Article deleted');
    } catch (error) {
      toast.error('Failed to delete article');
    }
  };

  // Fall back to router navigation when props are not provided (router-based setup)
  const handleEdit = (article) => {
    if (typeof onEdit === 'function') {
      onEdit(article);
    } else {
      navigate(`/articles/${article.id}`);
    }
  };

  const handleNew = () => {
    if (typeof onNew === 'function') {
      onNew();
    } else {
      navigate('/articles/new');
    }
  };

  const filteredArticles = articles.filter(article => {
    if (filter === 'published') return article.published;
    if (filter === 'draft') return !article.published;
    return true;
  });

  if (loading) {
    return (
      <div aria-label="Loading articles" className="max-w-6xl mx-auto space-y-4 animate-pulse p-2">
        <div className="h-10 w-48 rounded bg-muted" />
        {[1, 2, 3].map((item) => <div key={item} className="h-24 rounded-xl bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Your writing</p>
          <h1 className="font-display text-3xl font-semibold">Articles</h1>
        </div>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" /> New article
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <label htmlFor="article-filter" className="text-sm text-muted-foreground">Show</label>
        <select
          id="article-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="min-h-11 max-w-full border border-input bg-card text-foreground rounded-md px-3 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All Articles ({articles.length})</option>
          <option value="published">Published ({articles.filter(a => a.published).length})</option>
          <option value="draft">Drafts ({articles.filter(a => !a.published).length})</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-border">
          {filteredArticles.map((article) => (
            <li key={article.id}>
              <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <h3 className="min-w-0 flex-1 text-lg font-medium break-words">
                      {article.title}
                    </h3>
                    <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      article.published
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
                    }`}>
                      {article.published ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(article.created_at), 'MMM d, yyyy')}
                    </div>
                    {article.category && (
                      <div className="flex items-center">
                        <Tag className="h-4 w-4 mr-1" />
                        {article.category}
                      </div>
                    )}
                  </div>

                  {article.excerpt && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {article.excerpt}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:ml-4">
                  {article.published && (
                    <a
                      href={`https://mysttuff-72jz.vercel.app/blog?slug=${article.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label={`View ${article.title}`}
                      title="View article"
                    >
                      <Eye className="h-5 w-5" />
                    </a>
                  )}
                  <button
                    onClick={() => handleEdit(article)}
                    className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={`Edit ${article.title}`}
                    title="Edit article"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="min-h-11 min-w-11 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Delete ${article.title}`}
                    title="Delete article"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {filteredArticles.length === 0 && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-4">No articles match this filter.</div>
          <Button variant="outline" onClick={handleNew}>Write an article</Button>
        </div>
      )}
    </div>
  );
}
