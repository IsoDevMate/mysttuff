import { Link } from "react-router-dom";
import { createPageUrl } from "./lib/utils";
import ThemeCustomizer from "./components/settings/ThemeCustomizer";
import DesignPresets from "./components/settings/DesignPresets";

export default function Layout({ children, currentPageName }) {
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
          
          <div className="flex items-center gap-4 font-body text-sm">
            <Link 
              to={createPageUrl("Home")} 
              className={`hover:opacity-100 transition-opacity ${currentPageName === 'Home' ? 'opacity-100' : 'opacity-60'}`}
            >
              home
            </Link>
            <Link 
              to={createPageUrl("Blog")} 
              className={`hover:opacity-100 transition-opacity ${currentPageName === 'Blog' ? 'opacity-100' : 'opacity-60'}`}
            >
              writing
            </Link>
            <Link 
              to={createPageUrl("Gallery")} 
              className={`hover:opacity-100 transition-opacity ${currentPageName === 'Gallery' ? 'opacity-100' : 'opacity-60'}`}
            >
              gallery
            </Link>
            <Link 
              to={createPageUrl("Links")} 
              className={`hover:opacity-100 transition-opacity ${currentPageName === 'Links' ? 'opacity-100' : 'opacity-60'}`}
            >
              links
            </Link>
            <div className="flex items-center gap-1 border-l pl-4" style={{ borderColor: 'var(--text-color, #292524)' + '20' }}>
              <DesignPresets />
              <ThemeCustomizer />
            </div>
          </div>
        </div>
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