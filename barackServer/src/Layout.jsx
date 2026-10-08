import { Link } from "react-router-dom";
import { useState } from "react";
import { createPageUrl } from "./lib/utils";
import ThemeCustomizer from "./components/settings/ThemeCustomizer";
import DesignPresets from "./components/settings/DesignPresets";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "home", page: "Home" },
  { label: "writing", page: "Blog" },
  { label: "tags", page: "Tags" },
  { label: "gallery", page: "Gallery" },
  { label: "links", page: "Links" },
];

export default function Layout({ children, currentPageName }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-color, #FAF3E8)', color: 'var(--text-color, #292524)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800;900&family=Inter:wght@300;400;500;600&family=Lora:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Caveat:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        
        :root {
          --bg-color: #FAF3E8;
          --text-color: #292524;
          --accent-color: #78716c;
          --font-serif: 'Playfair Display', Georgia, serif;
        }
        
        .font-serif-display {
          font-family: var(--font-serif);
        }
        
        .font-body {
          font-family: 'Inter', -apple-system, sans-serif;
        }
      `}</style>
      
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm" style={{ backgroundColor: 'var(--bg-color, #FAF3E8)' + 'e6' }}>
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link 
            to={createPageUrl("Home")} 
            className="font-serif-display text-xl font-bold hover:opacity-60 transition-opacity"
          >
            ~
          </Link>
          
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4 font-body text-sm">
            {NAV_LINKS.map(({ label, page }) => (
              <Link
                key={page}
                to={createPageUrl(page)}
                className={`hover:opacity-100 transition-opacity ${currentPageName === page ? 'opacity-100' : 'opacity-60'}`}
              >
                {label}
              </Link>
            ))}
            <div className="flex items-center gap-1 border-l pl-4" style={{ borderColor: 'var(--text-color, #292524)' + '20' }}>
              <DesignPresets />
              <ThemeCustomizer />
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t px-6 py-3 font-body text-sm" style={{ borderColor: 'var(--text-color, #292524)' + '15' }}>
            <div className="flex flex-col">
              {NAV_LINKS.map(({ label, page }) => (
                <Link
                  key={page}
                  to={createPageUrl(page)}
                  onClick={() => setMenuOpen(false)}
                  className={`py-2.5 border-b last:border-b-0 transition-opacity ${
                    currentPageName === page ? 'opacity-100 font-medium' : 'opacity-60'
                  }`}
                  style={{ borderColor: 'var(--text-color, #292524)' + '10' }}
                >
                  {label}
                </Link>
              ))}
              <div className="flex items-center gap-1 pt-3">
                <DesignPresets />
                <ThemeCustomizer />
              </div>
            </div>
          </div>
        )}
      </nav>
      
      <main className="pt-20">
        {children}
      </main>
      
      <footer className="border-t mt-20" style={{ borderColor: 'var(--text-color, #292524)' + '20' }}>
        <div className="max-w-3xl mx-auto px-6 py-8">
          <p className="font-body text-xs opacity-40 text-center">
            just putting stuff here
          </p>
        </div>
      </footer>
    </div>
  );
}