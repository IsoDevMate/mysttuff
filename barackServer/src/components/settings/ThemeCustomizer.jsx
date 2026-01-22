import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Palette, Type } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const fonts = [
  { value: "playfair", label: "Playfair Display", family: "'Playfair Display', Georgia, serif" },
  { value: "serif", label: "Classic Serif", family: "'Lora', Georgia, serif" },
  { value: "mono", label: "Monospace", family: "'JetBrains Mono', monospace" },
  { value: "handwriting", label: "Handwriting", family: "'Caveat', cursive" },
  { value: "modern", label: "Modern Sans", family: "'Plus Jakarta Sans', sans-serif" },
  { value: "classic", label: "Classic Sans", family: "'Inter', sans-serif" },
];

const palettes = {
  warm: { bg: "#FAF3E8", text: "#292524", accent: "#78716c" },
  cool: { bg: "#EFF6FF", text: "#1e293b", accent: "#64748b" },
  minimal: { bg: "#FFFFFF", text: "#000000", accent: "#737373" },
  vibrant: { bg: "#FEF3C7", text: "#92400e", accent: "#d97706" },
};

export default function ThemeCustomizer() {
  const [theme, setTheme] = useState("light");
  const [palette, setPalette] = useState("warm");
  const [font, setFont] = useState("playfair");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    const savedPalette = localStorage.getItem("palette") || "warm";
    const savedFont = localStorage.getItem("font") || "playfair";
    
    setTheme(savedTheme);
    setPalette(savedPalette);
    setFont(savedFont);
    
    applyTheme(savedTheme, savedPalette, savedFont);
  }, []);

  const applyTheme = (t, p, f) => {
    const root = document.documentElement;
    const colors = palettes[p];
    
    if (t === "dark") {
      root.style.setProperty('--bg-color', '#0a0a0a');
      root.style.setProperty('--text-color', '#fafafa');
      root.style.setProperty('--accent-color', '#737373');
    } else {
      root.style.setProperty('--bg-color', colors.bg);
      root.style.setProperty('--text-color', colors.text);
      root.style.setProperty('--accent-color', colors.accent);
    }
    
    const selectedFont = fonts.find(fo => fo.value === f);
    root.style.setProperty('--font-serif', selectedFont.family);
  };

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme, palette, font);
  };

  const changePalette = (newPalette) => {
    setPalette(newPalette);
    localStorage.setItem("palette", newPalette);
    applyTheme(theme, newPalette, font);
  };

  const changeFont = (newFont) => {
    setFont(newFont);
    localStorage.setItem("font", newFont);
    applyTheme(theme, palette, newFont);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Palette className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-body text-xs">Customize</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel className="font-body text-xs opacity-60">Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => changeTheme("light")}>
          <Sun className="w-4 h-4 mr-2" /> Light {theme === "light" && "✓"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme("dark")}>
          <Moon className="w-4 h-4 mr-2" /> Dark {theme === "dark" && "✓"}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-body text-xs opacity-60">Colors</DropdownMenuLabel>
        {Object.keys(palettes).map((p) => (
          <DropdownMenuItem key={p} onClick={() => changePalette(p)}>
            <div className="w-4 h-4 rounded mr-2" style={{ backgroundColor: palettes[p].accent }} />
            {p.charAt(0).toUpperCase() + p.slice(1)} {palette === p && "✓"}
          </DropdownMenuItem>
        ))}
        
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-body text-xs opacity-60">Font</DropdownMenuLabel>
        {fonts.map((f) => (
          <DropdownMenuItem key={f.value} onClick={() => changeFont(f.value)}>
            <Type className="w-4 h-4 mr-2" />
            {f.label} {font === f.value && "✓"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}