import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";
export type ThemeAccent = "violet" | "blue" | "green" | "orange" | "pink" | "slate";
export type ThemeDensity = "compact" | "normal" | "comfortable";
export type ThemeFontSize = "sm" | "md" | "lg";

interface ThemeSettings {
  mode: ThemeMode;
  accent: ThemeAccent;
  density: ThemeDensity;
  fontSize: ThemeFontSize;
}

interface ThemeContextType extends ThemeSettings {
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: ThemeAccent) => void;
  setDensity: (density: ThemeDensity) => void;
  setFontSize: (fontSize: ThemeFontSize) => void;
  isThemePanelOpen: boolean;
  setIsThemePanelOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ACCENT_COLORS: Record<ThemeAccent, string> = {
  violet: "262.1 83.3% 57.8%", // Adjusted for consistency
  blue: "217.2 91.2% 59.8%",
  green: "158 64% 52%",
  orange: "25 95% 53%",
  pink: "330 81% 60%",
  slate: "215 25% 45%",
};

const FONT_SIZES: Record<ThemeFontSize, string> = {
  sm: "14px",
  md: "16px",
  lg: "18px",
};

const STORAGE_KEY = "bite_erp_preferences";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ThemeSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse theme settings", e);
      }
    }
    return {
      mode: "dark",
      accent: "violet",
      density: "normal",
      fontSize: "md",
    };
  });

  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);

  const updateSetting = <K extends keyof ThemeSettings>(key: K, value: ThemeSettings[K]) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      return newSettings;
    });
  };

  useEffect(() => {
    const root = document.documentElement;
    
    // Theme Mode
    if (settings.mode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Accent Color
    root.style.setProperty("--primary", ACCENT_COLORS[settings.accent]);
    root.style.setProperty("--ring", ACCENT_COLORS[settings.accent]);

    // Density
    root.setAttribute("data-density", settings.density);

    // Font Size
    root.style.fontSize = FONT_SIZES[settings.fontSize];
  }, [settings]);

  const value = {
    ...settings,
    setMode: (mode: ThemeMode) => updateSetting("mode", mode),
    setAccent: (accent: ThemeAccent) => updateSetting("accent", accent),
    setDensity: (density: ThemeDensity) => updateSetting("density", density),
    setFontSize: (fontSize: ThemeFontSize) => updateSetting("fontSize", fontSize),
    isThemePanelOpen,
    setIsThemePanelOpen,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
