import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  FileText, 
  Upload, 
  Settings as SettingsIcon, 
  X,
  LogOut,
  Activity,
  ClipboardList,
  Flame,
  Zap,
} from 'lucide-react';
import { Button } from './ui/button';
import { api } from '../api';

const sidebarVariants = {
    open: { x: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
    closed: { x: "-100%", transition: { type: "spring", stiffness: 300, damping: 30 } }
};

function Sidebar({ isOpen, toggleSidebar }) {
    const location = useLocation();

    const menuItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/articles', icon: FileText, label: 'Articles' },
        { path: '/gallery', icon: Upload, label: 'Gallery' },
        { path: '/hot-takes', icon: Flame, label: 'Hot Takes' },
        { path: '/instants', icon: Zap, label: 'Instants' },
        { path: '/health', icon: Activity, label: 'System Health' },
        { path: '/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
        { path: '/settings', icon: SettingsIcon, label: 'Settings' },
    ];

    const handleLogout = () => {
        api.clearToken();
        window.location.href = '/login';
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
                <div className="flex min-h-0 flex-1 flex-col bg-card border-r border-border">
                    <div className="flex items-center justify-between p-6 border-b">
                        <h2 className="text-xl font-bold">Blog Admin</h2>
                    </div>

                    <nav className="flex-1 p-4 space-y-2">
                        {menuItems.map((item) => (
                            <Link key={item.path} to={item.path}>
                                <div className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                                    location.pathname === item.path
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-accent hover:text-accent-foreground'
                                }`}>
                                    <item.icon className="h-5 w-5" />
                                    <span>{item.label}</span>
                                </div>
                            </Link>
                        ))}
                    </nav>

                    <div className="p-4 border-t">
                        <Button 
                            variant="outline" 
                            className="w-full justify-start"
                            onClick={handleLogout}
                        >
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar */}
            <motion.div
                variants={sidebarVariants}
                animate={isOpen ? "open" : "closed"}
                className="fixed left-0 top-0 z-40 h-full w-64 bg-card border-r border-border shadow-lg lg:hidden"
            >
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="text-xl font-bold">Blog Admin</h2>
                    <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <nav className="p-4 space-y-2">
                    {menuItems.map((item) => (
                        <Link key={item.path} to={item.path} onClick={toggleSidebar}>
                            <motion.div
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.98 }}
                                className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                                    location.pathname === item.path
                                        ? 'bg-primary text-primary-foreground'
                                        : 'hover:bg-accent hover:text-accent-foreground'
                                }`}
                            >
                                <item.icon className="h-5 w-5" />
                                <span>{item.label}</span>
                            </motion.div>
                        </Link>
                    ))}
                </nav>

                <div className="absolute bottom-4 left-4 right-4">
                    <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={handleLogout}
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </motion.div>
        </>
    );
}

export default Sidebar;