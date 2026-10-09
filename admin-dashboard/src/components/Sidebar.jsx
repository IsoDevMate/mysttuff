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
  ToggleLeft,
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
        { path: '/flags', icon: ToggleLeft, label: 'Feature Flags' },
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
                    <div className="p-6 border-b border-border/80">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">creator studio</p>
                        <h2 className="font-display text-2xl font-semibold tracking-tight">mysttuff</h2>
                    </div>

                    <nav className="flex-1 p-4 space-y-1.5">
                        {menuItems.map((item) => (
                            <Link key={item.path} to={item.path}>
                                <div className={`flex min-h-11 items-center space-x-3 px-3 rounded-lg transition-colors ${
                                    location.pathname === item.path
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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
                role="dialog"
                aria-modal={isOpen ? 'true' : undefined}
                aria-label="Studio navigation"
                aria-hidden={!isOpen}
                inert={!isOpen ? '' : undefined}
                className="fixed left-0 top-0 z-40 h-full w-64 bg-card border-r border-border shadow-lg lg:hidden"
            >
                <div className="flex items-center justify-between p-6 border-b border-border/80">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">creator studio</p>
                        <h2 className="font-display text-xl font-semibold">mysttuff</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Close navigation">
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <nav id="mobile-studio-navigation" className="p-4 space-y-1.5">
                    {menuItems.map((item) => (
                        <Link key={item.path} to={item.path} onClick={toggleSidebar}>
                            <motion.div
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.98 }}
                                className={`flex min-h-11 items-center space-x-3 px-3 rounded-lg transition-colors ${
                                    location.pathname === item.path
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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