import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:3001/api';

export default function AdminDashboard() {
  const [articles, setArticles] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentArticle, setCurrentArticle] = useState({
    title: '', slug: '', content: '', excerpt: '', category: 'other', published: false
  });
  const [token, setToken] = useState(localStorage.getItem('adminToken'));

  useEffect(() => {
    if (token) fetchArticles();
  }, [token]);

  const fetchArticles = async () => {
    const res = await fetch(`${API_BASE}/admin/articles`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) setArticles(await res.json());
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password')
      })
    });
    
    if (res.ok) {
      const { token } = await res.json();
      localStorage.setItem('adminToken', token);
      setToken(token);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const method = currentArticle.id ? 'PUT' : 'POST';
    const url = currentArticle.id 
      ? `${API_BASE}/admin/articles/${currentArticle.id}`
      : `${API_BASE}/admin/articles`;

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(currentArticle)
    });

    if (res.ok) {
      fetchArticles();
      setIsEditing(false);
      setCurrentArticle({ title: '', slug: '', content: '', excerpt: '', category: 'other', published: false });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this article?')) return;
    
    await fetch(`${API_BASE}/admin/articles/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchArticles();
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Admin Login</h2>
        <form onSubmit={handleLogin}>
          <input name="username" placeholder="Username" className="w-full p-2 mb-3 border rounded" required />
          <input name="password" type="password" placeholder="Password" className="w-full p-2 mb-3 border rounded" required />
          <button className="w-full bg-blue-500 text-white p-2 rounded">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <button 
          onClick={() => setIsEditing(true)}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          New Article
        </button>
      </div>

      {isEditing && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-bold mb-4">{currentArticle.id ? 'Edit' : 'New'} Article</h2>
          <form onSubmit={handleSave}>
            <input
              placeholder="Title"
              value={currentArticle.title}
              onChange={(e) => setCurrentArticle({...currentArticle, title: e.target.value})}
              className="w-full p-2 mb-3 border rounded"
              required
            />
            <input
              placeholder="Slug"
              value={currentArticle.slug}
              onChange={(e) => setCurrentArticle({...currentArticle, slug: e.target.value})}
              className="w-full p-2 mb-3 border rounded"
              required
            />
            <textarea
              placeholder="Excerpt"
              value={currentArticle.excerpt}
              onChange={(e) => setCurrentArticle({...currentArticle, excerpt: e.target.value})}
              className="w-full p-2 mb-3 border rounded h-20"
            />
            <textarea
              placeholder="Content (Markdown)"
              value={currentArticle.content}
              onChange={(e) => setCurrentArticle({...currentArticle, content: e.target.value})}
              className="w-full p-2 mb-3 border rounded h-40"
              required
            />
            <select
              value={currentArticle.category}
              onChange={(e) => setCurrentArticle({...currentArticle, category: e.target.value})}
              className="w-full p-2 mb-3 border rounded"
            >
              <option value="backend">Backend</option>
              <option value="ai">AI</option>
              <option value="databases">Databases</option>
              <option value="experiments">Experiments</option>
              <option value="other">Other</option>
            </select>
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                checked={currentArticle.published}
                onChange={(e) => setCurrentArticle({...currentArticle, published: e.target.checked})}
                className="mr-2"
              />
              Published
            </label>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Save</button>
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {articles.map(article => (
          <div key={article.id} className="p-4 border rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold">{article.title}</h3>
                <p className="text-gray-600">{article.excerpt}</p>
                <span className={`inline-block px-2 py-1 text-xs rounded ${article.published ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {article.published ? 'Published' : 'Draft'}
                </span>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setCurrentArticle(article);
                    setIsEditing(true);
                  }}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(article.id)}
                  className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
