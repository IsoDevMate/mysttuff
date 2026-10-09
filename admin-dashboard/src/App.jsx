import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Moon, Sun } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

import { Button } from './components/ui/button';
import ArticleList from './components/ArticleList';
import Gallery from './components/Gallery';
import HotTakes from './components/HotTakes';
import Instants from './components/Instants';
import Flags from './components/Flags';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import PrivateRoute from './components/PrivateRoute';
import ArticleEditor from './components/ArticleEditor';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import SystemHealth from './components/SystemHealth';
import AuditLogs from './components/AuditLogs';

const queryClient = new QueryClient();

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  if (location.pathname === '/login') {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(false)} />
      
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:ml-64">
        <header className="sticky top-0 z-20 bg-background/95 border-b border-border/80">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
              aria-label="Open navigation"
              aria-expanded={sidebarOpen}
              aria-controls="mobile-studio-navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="hidden lg:block" />
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-medium">A</span>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-page-enter p-4 sm:p-6">
          <AnimatePresence mode="wait">
            <Outlet />
          </AnimatePresence>
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<PrivateRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/articles" element={<ArticleList />} />
                <Route path="/articles/new" element={<ArticleEditor />} />
                <Route path="/articles/:id" element={<ArticleEditor />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/hot-takes" element={<HotTakes />} />
                <Route path="/instants" element={<Instants />} />
                <Route path="/flags" element={<Flags />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/health" element={<SystemHealth />} />
                <Route path="/audit-logs" element={<AuditLogs />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
