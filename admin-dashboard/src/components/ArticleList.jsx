import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, Calendar, Tag } from 'lucide-react';
import { api } from '../api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ArticleList({ onEdit, onNew }) {
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

  const filteredArticles = articles.filter(article => {
    if (filter === 'published') return article.published;
    if (filter === 'draft') return !article.published;
    return true;
  });

  const categories = [...new Set(articles.map(a => a.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading articles...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Articles</h1>
        <button
          onClick={onNew}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Article
        </button>
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Articles ({articles.length})</option>
          <option value="published">Published ({articles.filter(a => a.published).length})</option>
          <option value="draft">Drafts ({articles.filter(a => !a.published).length})</option>
        </select>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {filteredArticles.map((article) => (
            <li key={article.id}>
              <div className="px-4 py-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {article.title}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      article.published 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {article.published ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  
                  <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(article.created_at), 'MMM d, yyyy')}
                    </div>
                    <div className="flex items-center">
                      <Tag className="h-4 w-4 mr-1" />
                      {article.category}
                    </div>
                  </div>
                  
                  {article.excerpt && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {article.excerpt}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {article.published && (
                    <a
                      href={`http://localhost:3000/blog/${article.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-blue-500"
                      title="View article"
                    >
                      <Eye className="h-5 w-5" />
                    </a>
                  )}
                  <button
                    onClick={() => onEdit(article)}
                    className="p-2 text-gray-400 hover:text-indigo-500"
                    title="Edit article"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                    title="Delete article"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {filteredArticles.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">No articles found</div>
          <button
            onClick={onNew}
            className="text-indigo-600 hover:text-indigo-500"
          >
            Create your first article
          </button>
        </div>
      )}
    </div>
  );
}
