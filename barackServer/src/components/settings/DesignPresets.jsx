import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkles, Check } from "lucide-react";

const presets = [
  {
    id: "warm-classic",
    name: "Warm Classic",
    description: "Current design - warm beige tones",
    preview: "bg-[#FAF3E8] border-2 border-stone-200",
    config: {
      theme: "light",
      palette: "warm",
      font: "playfair",
      bg: "#FAF3E8",
      text: "#292524",
      accent: "#78716c",
      fontFamily: "'Playfair Display', Georgia, serif"
    }
  },
  {
    id: "brutalist",
    name: "Brutalist",
    description: "Bold, stark, minimalist",
    preview: "bg-white border-4 border-black",
    config: {
      theme: "light",
      palette: "minimal",
      font: "mono",
      bg: "#FFFFFF",
      text: "#000000",
      accent: "#000000",
      fontFamily: "'JetBrains Mono', monospace"
    }
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark, elegant, focused",
    preview: "bg-[#0a0a0a] border-2 border-zinc-800",
    config: {
      theme: "dark",
      palette: "warm",
      font: "serif",
      bg: "#0a0a0a",
      text: "#fafafa",
      accent: "#a3a3a3",
      fontFamily: "'Lora', Georgia, serif"
    }
  },
  {
    id: "notebook",
    name: "Notebook",
    description: "Handwritten, personal feel",
    preview: "bg-[#FFFEF7] border-2 border-amber-200",
    config: {
      theme: "light",
      palette: "vibrant",
      font: "handwriting",
      bg: "#FFFEF7",
      text: "#451a03",
      accent: "#d97706",
      fontFamily: "'Caveat', cursive"
    }
  },
  {
    id: "nordic",
    name: "Nordic",
    description: "Cool, clean, spacious",
    preview: "bg-[#F8FAFC] border-2 border-slate-200",
    config: {
      theme: "light",
      palette: "cool",
      font: "modern",
      bg: "#F8FAFC",
      text: "#0f172a",
      accent: "#64748b",
      fontFamily: "'Plus Jakarta Sans', sans-serif"
    }
  },
  {
    id: "typewriter",
    name: "Typewriter",
    description: "Monospace, writer's aesthetic",
    preview: "bg-[#F5F5DC] border-2 border-[#8B7355]",
    config: {
      theme: "light",
      palette: "warm",
      font: "mono",
      bg: "#F5F5DC",
      text: "#2c2416",
      accent: "#8B7355",
      fontFamily: "'JetBrains Mono', monospace"
    }
  }
];

export default function DesignPresets() {
  const [open, setOpen] = useState(false);
  const [currentPreset, setCurrentPreset] = useState("warm-classic");

  const applyPreset = (preset) => {
    const root = document.documentElement;
    const config = preset.config;
    
    root.style.setProperty('--bg-color', config.bg);
    root.style.setProperty('--text-color', config.text);
    root.style.setProperty('--accent-color', config.accent);
    root.style.setProperty('--font-serif', config.fontFamily);
    
    localStorage.setItem("theme", config.theme);
    localStorage.setItem("palette", config.palette);
    localStorage.setItem("font", config.font);
    localStorage.setItem("preset", preset.id);
    
    setCurrentPreset(preset.id);
  };

  React.useEffect(() => {
    const savedPreset = localStorage.getItem("preset");
    if (savedPreset) {
      setCurrentPreset(savedPreset);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">Designs</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif-display text-2xl">Design Presets</DialogTitle>
          <DialogDescription className="font-body">
            Try different looks - your choice is saved automatically
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset)}
              className="text-left p-4 border-2 rounded-lg hover:border-current/40 transition-all relative group"
              style={{
                borderColor: currentPreset === preset.id ? 'var(--accent-color)' : 'var(--text-color, #000)' + '10'
              }}
            >
              {currentPreset === preset.id && (
                <div className="absolute top-3 right-3">
                  <Check className="w-5 h-5" />
                </div>
              )}
              
              <div className={`w-full h-24 rounded-md mb-3 ${preset.preview} flex items-center justify-center overflow-hidden`}>
                <div className="text-center p-4" style={{ 
                  backgroundColor: preset.config.bg,
                  color: preset.config.text,
                  fontFamily: preset.config.fontFamily,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center'
                }}>
                  <div className="text-lg font-bold mb-1">Aa</div>
                  <div className="text-xs opacity-60">Sample text</div>
                </div>
              </div>
              
              <h4 className="font-serif-display font-bold text-lg mb-1">
                {preset.name}
              </h4>
              <p className="font-body text-sm opacity-60">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-current/5 rounded-lg">
          <p className="font-body text-sm opacity-70">
            💡 After selecting a preset, you can still fine-tune colors and fonts using the customizer
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}