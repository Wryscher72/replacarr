"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, LayoutDashboard, Tv2, Film, Download, Calendar,
  Settings, Activity, HardDriveDownload, BookmarkX, Server, History,
  Settings2, ShieldBan, Layers, ArrowRight,
} from "lucide-react";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";

// ── Command registry ───────────────────────────────────────────────────────────

interface Command {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  accentVar?: string;
  category: string;
  keywords?: string;
}

const ALL_COMMANDS: Command[] = [
  // Overview
  { id: "dashboard",   label: "Dashboard",              href: "/",                    icon: LayoutDashboard,  category: "Overview"    },
  { id: "activity",    label: "Activity",               href: "/activity",            icon: Activity,         category: "Overview"    },
  { id: "calendar",    label: "Calendar",               href: "/calendar",            icon: Calendar,         category: "Overview"    },
  { id: "history",     label: "History",                href: "/history",             icon: History,          category: "Overview"    },
  // Media
  { id: "sonarr",      label: "Sonarr — Series",        href: "/sonarr",              icon: Tv2,              accentVar: "--color-sonarr",  category: "Media"     },
  { id: "radarr",      label: "Radarr — Movies",        href: "/radarr",              icon: Film,             accentVar: "--color-radarr",  category: "Media"     },
  { id: "collections", label: "Movie Collections",      href: "/radarr/collections",  icon: Layers,           accentVar: "--color-radarr",  category: "Media"     },
  { id: "wanted",      label: "Wanted",                 href: "/wanted",              icon: BookmarkX,        category: "Media"     },
  { id: "profiles",    label: "Profiles",               href: "/profiles",            icon: Settings2,        category: "Media"     },
  { id: "blocklist",   label: "Blocklist",              href: "/blocklist",           icon: ShieldBan,        category: "Media"     },
  // Downloaders
  { id: "sabnzbd",     label: "SABnzbd",                href: "/sabnzbd",             icon: HardDriveDownload, accentVar: "--color-sabnzbd", category: "Downloaders" },
  { id: "queue",       label: "Downloads Queue",        href: "/queue",               icon: Download,         category: "Queue"     },
  // System
  { id: "settings",    label: "Settings",               href: "/settings",            icon: Settings,         category: "System"    },
  { id: "system",      label: "System Status",          href: "/system",              icon: Server,           category: "System"    },
];

// Simple case-insensitive substring filter
function filterCommands(commands: Command[], q: string): Command[] {
  if (!q.trim()) return commands;
  const lower = q.toLowerCase();
  return commands.filter(
    (c) =>
      c.label.toLowerCase().includes(lower) ||
      c.category.toLowerCase().includes(lower) ||
      (c.keywords?.toLowerCase().includes(lower) ?? false)
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const { commandPaletteOpen, openCommandPalette, closeCommandPalette } = useUIStore();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Global Ctrl+K / Cmd+K hotkey ────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        commandPaletteOpen ? closeCommandPalette() : openCommandPalette();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, openCommandPalette, closeCommandPalette]);

  // ── Focus + reset when opened ────────────────────────────────────────────────
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery("");
      setCursor(0);
      // Small delay so the animation starts before focus steals the event
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandPaletteOpen]);

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => filterCommands(ALL_COMMANDS, query), [query]);

  // Reset cursor when results change
  useEffect(() => { setCursor(0); }, [filtered.length]);

  // Scroll active item into view
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // ── Actions ────────────────────────────────────────────────────────────────────
  function navigate(cmd: Command) {
    closeCommandPalette();
    router.push(cmd.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
        break;
      case "Enter":
        if (filtered[cursor]) navigate(filtered[cursor]);
        break;
      case "Escape":
        closeCommandPalette();
        break;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeCommandPalette}
          />

          {/* Palette panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl"
          >
            {/* ── Search bar ── */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--color-border)]">
              <Search size={15} className="text-[var(--color-text-muted)] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search pages, sections…"
                aria-label="Command palette search"
                className="flex-1 bg-transparent text-white placeholder-[var(--color-text-muted)] text-sm outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="p-1 rounded text-[var(--color-text-muted)] hover:text-white transition-colors"
                >
                  <X size={13} />
                </button>
              )}
              <kbd className="hidden sm:flex items-center px-1.5 py-0.5 rounded bg-[var(--color-bg-base)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] font-mono">
                ESC
              </kbd>
            </div>

            {/* ── Results ── */}
            <div ref={listRef} className="max-h-[340px] overflow-y-auto py-1.5">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-[var(--color-text-muted)] py-10">
                  No results for &ldquo;{query}&rdquo;
                </p>
              ) : (
                filtered.map((cmd, i) => {
                  const Icon = cmd.icon;
                  const isActive = i === cursor;
                  const color = cmd.accentVar ? `var(${cmd.accentVar})` : null;
                  return (
                    <button
                      key={cmd.id}
                      data-idx={i}
                      onClick={() => navigate(cmd)}
                      onMouseEnter={() => setCursor(i)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        isActive
                          ? "bg-[var(--color-accent)]/10"
                          : "hover:bg-white/3"
                      )}
                    >
                      {/* Icon */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={
                          color
                            ? { background: `color-mix(in srgb, ${color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)` }
                            : { background: "var(--color-bg-base)", border: "1px solid var(--color-border)" }
                        }
                      >
                        <Icon
                          size={13}
                          style={color ? { color } : { color: "var(--color-text-secondary)" }}
                        />
                      </div>

                      {/* Label */}
                      <span className={cn(
                        "flex-1 text-sm font-medium truncate",
                        isActive ? "text-white" : "text-[var(--color-text-secondary)]"
                      )}>
                        {cmd.label}
                      </span>

                      {/* Category + arrow */}
                      <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">{cmd.category}</span>
                      {isActive && <ArrowRight size={12} className="text-[var(--color-accent)] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-base)]/50">
              <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-px rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] font-mono">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-px rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] font-mono">↵</kbd>
                  open
                </span>
              </div>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
