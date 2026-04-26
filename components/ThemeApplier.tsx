"use client";

import { useEffect } from "react";
import { useSettings } from "@/store/settings";

// Accent theme definitions — each overrides --color-accent, --color-accent-bright, --color-accent-glow
const THEMES: Record<string, { accent: string; accentBright: string; accentGlow: string }> = {
  purple: { accent: "#7c3aed", accentBright: "#9f5fff", accentGlow: "#7c3aed44" },
  cyan:   { accent: "#06b6d4", accentBright: "#22d3ee", accentGlow: "#06b6d444" },
  green:  { accent: "#10b981", accentBright: "#34d399", accentGlow: "#10b98144" },
  orange: { accent: "#f97316", accentBright: "#fb923c", accentGlow: "#f9731644" },
  pink:   { accent: "#ec4899", accentBright: "#f472b6", accentGlow: "#ec489944" },
};

/**
 * Mounts with no visible output; watches the persisted accent-color setting
 * and injects overrides onto the document root so all --color-accent* vars
 * update live without a reload.
 */
export function ThemeApplier() {
  const { theme } = useSettings();

  useEffect(() => {
    const t = THEMES[theme.accentColor] ?? THEMES.purple;
    const root = document.documentElement;
    root.style.setProperty("--color-accent", t.accent);
    root.style.setProperty("--color-accent-bright", t.accentBright);
    root.style.setProperty("--color-accent-glow", t.accentGlow);
  }, [theme.accentColor]);

  useEffect(() => {
    document.documentElement.classList.toggle("compact", theme.compactMode);
  }, [theme.compactMode]);

  return null;
}
