import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Login from './components/Login';
import ArticleList from './components/ArticleList';
import ArticleEditor from './components/ArticleEditor';
import { api } from './api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('list'); // 'list' | 'editor'
  const [editingArticle, setEditingArticle] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    api.clearToken();
    setIsAuthenticated(false);
    setCurrentView('list');
    setEditingArticle(null);
  };

  const handleNewArticle = () => {
    setEditingArticle(null);
    setCurrentView('editor');
  };

  const handleEditArticle = (article) => {
    setEditingArticle(article);
    setCurrentView('editor');
  };

  const handleSaveArticle = () => {
    setCurrentView('list');
    setEditingArticle(null);
  };

  const handleCancelEdit = () => {
    setCurrentView('list');
    setEditingArticle(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Barack Blog Admin
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setCurrentView('list')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'list'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Articles
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {currentView === 'list' && (
          <ArticleList
            onNew={handleNewArticle}
            onEdit={handleEditArticle}
          />
        )}
        
        {currentView === 'editor' && (
          <ArticleEditor
            article={editingArticle}
            onSave={handleSaveArticle}
            onCancel={handleCancelEdit}
          />
        )}
      </main>

      <Toaster position="top-right" />
    </div>
  );
}

export default App;
