"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Theme Switcher Component
 *
 * Allows users to switch between different visual themes.
 * Themes are defined in src/styles/themes.css
 *
 * Usage:
 * <ThemeSwitcher />
 *
 * Available themes:
 * - default: Your current design
 * - apple: Apple-inspired minimalist design
 * - ocean: Calming ocean blues
 * - cyberpunk: Neon futuristic
 * - forest: Natural greens
 * - sunset: Warm oranges and purples
 * - monochrome: Black and white
 */

export type ThemeName =
  | "default"
  | "apple"
  | "ocean"
  | "cyberpunk"
  | "forest"
  | "sunset"
  | "monochrome";

interface Theme {
  name: ThemeName;
  label: string;
  description: string;
  className: string;
}

const themes: Theme[] = [
  {
    name: "default",
    label: "Default",
    description: "Your original design",
    className: "",
  },
  {
    name: "apple",
    label: "Apple",
    description: "Minimalist, clean, premium",
    className: "theme-apple",
  },
  {
    name: "ocean",
    label: "Ocean",
    description: "Calming blues and teals",
    className: "theme-ocean",
  },
  {
    name: "cyberpunk",
    label: "Cyberpunk",
    description: "Neon pink and cyan",
    className: "theme-cyberpunk",
  },
  {
    name: "forest",
    label: "Forest",
    description: "Natural greens",
    className: "theme-forest",
  },
  {
    name: "sunset",
    label: "Sunset",
    description: "Warm and vibrant",
    className: "theme-sunset",
  },
  {
    name: "monochrome",
    label: "Monochrome",
    description: "Pure black and white",
    className: "theme-monochrome",
  },
];

export function ThemeSwitcher() {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>("default");
  const [isOpen, setIsOpen] = useState(false);

  // Load saved theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as ThemeName;
    if (savedTheme && themes.find((t) => t.name === savedTheme)) {
      applyTheme(savedTheme);
    }
  }, []);

  const applyTheme = (themeName: ThemeName) => {
    const theme = themes.find((t) => t.name === themeName);
    if (!theme) return;

    // Remove all theme classes
    themes.forEach((t) => {
      if (t.className) {
        document.body.classList.remove(t.className);
      }
    });

    // Apply new theme class
    if (theme.className) {
      document.body.classList.add(theme.className);
      document.body.classList.add("theme-transition"); // Smooth transition
    }

    // Save to localStorage
    localStorage.setItem("theme", themeName);
    setCurrentTheme(themeName);
  };

  const handleThemeChange = (themeName: ThemeName) => {
    applyTheme(themeName);
    setIsOpen(false);
  };

  const currentThemeObj = themes.find((t) => t.name === currentTheme);

  return (
    <div className="relative">
      {/* Theme Switcher Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
        aria-label="Switch theme"
        aria-expanded={isOpen}
      >
        <span className="text-sm">🎨</span>
        <span className="hidden sm:inline">{currentThemeObj?.label}</span>
      </Button>

      {/* Theme Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Theme Menu */}
          <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border border-border bg-background shadow-lg">
            <div className="p-3 border-b border-border">
              <h3 className="font-semibold text-sm">Choose Theme</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Change the visual style of the site
              </p>
            </div>

            <div className="p-2 max-h-96 overflow-y-auto">
              {themes.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => handleThemeChange(theme.name)}
                  className={`
                    w-full text-left px-3 py-2.5 rounded-md transition-colors
                    hover:bg-accent hover:text-accent-foreground
                    ${
                      currentTheme === theme.name
                        ? "bg-accent text-accent-foreground"
                        : ""
                    }
                  `}
                  aria-current={currentTheme === theme.name}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{theme.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {theme.description}
                      </div>
                    </div>
                    {currentTheme === theme.name && (
                      <span className="text-sm ml-2">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-border text-xs text-muted-foreground">
              Themes are powered by CSS variables
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Simple Theme Selector (for settings pages)
 *
 * A simpler version without dropdown, useful for settings pages
 */
export function SimpleThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>("default");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as ThemeName;
    if (savedTheme) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const themeName = e.target.value as ThemeName;
    const theme = themes.find((t) => t.name === themeName);
    if (!theme) return;

    // Remove all theme classes
    themes.forEach((t) => {
      if (t.className) document.body.classList.remove(t.className);
    });

    // Apply new theme
    if (theme.className) {
      document.body.classList.add(theme.className);
      document.body.classList.add("theme-transition");
    }

    localStorage.setItem("theme", themeName);
    setCurrentTheme(themeName);
  };

  return (
    <div className="space-y-2">
      <label htmlFor="theme-select" className="text-sm font-medium">
        Visual Theme
      </label>
      <select
        id="theme-select"
        value={currentTheme}
        onChange={handleChange}
        className="w-full px-3 py-2 border border-border rounded-md bg-background"
      >
        {themes.map((theme) => (
          <option key={theme.name} value={theme.name}>
            {theme.label} - {theme.description}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Change the entire visual style of the website
      </p>
    </div>
  );
}
