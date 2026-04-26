"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Tv2,
  Film,
  Download,
  Calendar,
  Settings,
  Activity,
  ChevronRight,
  HardDriveDownload,
  BookmarkX,
  Server,
  History,
  Settings2,
  ShieldBan,
  Layers,
  X,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  color?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const navItems: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/history", label: "History", icon: History },
    ],
  },
  {
    group: "Discover",
    items: [
      { href: "/discover", label: "Discover", icon: Clapperboard, color: "tmdb" },
    ],
  },
  {
    group: "Media",
    items: [
      { href: "/sonarr", label: "Sonarr", icon: Tv2, color: "sonarr" },
      { href: "/radarr", label: "Radarr", icon: Film, color: "radarr" },
      { href: "/radarr/collections", label: "Collections", icon: Layers, color: "radarr" },
      { href: "/wanted", label: "Wanted", icon: BookmarkX },
      { href: "/profiles", label: "Profiles", icon: Settings2 },
      { href: "/blocklist", label: "Blocklist", icon: ShieldBan },
    ],
  },
  {
    group: "Downloaders",
    items: [
      { href: "/sabnzbd", label: "SABnzbd", icon: HardDriveDownload, color: "sabnzbd" },
    ],
  },
  {
    group: "Queue",
    items: [
      { href: "/queue", label: "Downloads", icon: Download },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/system", label: "System", icon: Server },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, closeSidebar } = useUIStore();

  return (
    <>
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-60 z-30 flex flex-col glass border-r border-[var(--color-border)] transition-transform duration-300",
          // On large screens: always visible. On small: slide in/out.
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-[var(--color-border)]">
        <div className="relative w-8 h-8 flex items-center justify-center">
          <div className="absolute inset-0 rounded-lg bg-[var(--color-accent)] opacity-20 blur-md" />
          <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-cyan)] flex items-center justify-center">
            <span className="text-white font-black text-sm">R</span>
          </div>
        </div>
        <div className="flex-1">
          <span className="text-white font-bold text-base tracking-wide text-glow-accent">
            Replacarr
          </span>
          <div className="text-[var(--color-text-muted)] text-[10px] tracking-widest uppercase">
            Media Console
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={closeSidebar}
          className="lg:hidden p-1 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close sidebar"
        >
          <X size={16} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {navItems.map((group) => (
          <div key={group.group}>
            <p className="px-3 mb-2 text-[10px] font-semibold tracking-[0.15em] uppercase text-[var(--color-text-muted)]">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeSidebar}
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group",
                        isActive
                          ? "text-white"
                          : "text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-bg-card)]"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="nav-indicator"
                          className="absolute inset-0 rounded-lg"
                          style={{
                            background:
                              item.color === "sonarr"
                                ? "linear-gradient(90deg, var(--color-sonarr-glow), transparent)"
                                : item.color === "radarr"
                                  ? "linear-gradient(90deg, var(--color-radarr-glow), transparent)"
                                  : item.color === "sabnzbd"
                                    ? "linear-gradient(90deg, var(--color-sabnzbd-glow), transparent)"
                                    : item.color === "tmdb"
                                      ? "linear-gradient(90deg, var(--color-tmdb-glow), transparent)"
                                      : "linear-gradient(90deg, var(--color-accent-glow), transparent)",                            borderLeft:
                              item.color === "sonarr"
                                ? "2px solid var(--color-sonarr)"
                                : item.color === "radarr"
                                  ? "2px solid var(--color-radarr)"
                                  : item.color === "sabnzbd"
                                    ? "2px solid var(--color-sabnzbd)"
                                    : item.color === "tmdb"
                                      ? "2px solid var(--color-tmdb)"
                                      : "2px solid var(--color-accent-bright)",
                          }}
                          transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                        />
                      )}
                      <Icon
                        size={16}
                        className={cn(
                          "relative z-10 flex-shrink-0 transition-colors",
                          isActive
                            ? item.color === "sonarr"
                              ? "text-[var(--color-sonarr)]"
                              : item.color === "radarr"
                                ? "text-[var(--color-radarr)]"
                                : item.color === "sabnzbd"
                                  ? "text-[var(--color-sabnzbd)]"
                                  : item.color === "tmdb"
                                    ? "text-[var(--color-tmdb)]"
                                    : "text-[var(--color-accent-bright)]"
                            : ""
                        )}
                      />
                      <span className="relative z-10 flex-1 font-medium">{item.label}</span>
                      {isActive && (
                        <ChevronRight
                          size={12}
                          className="relative z-10 text-[var(--color-text-muted)]"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        <p className="text-[10px] text-[var(--color-text-muted)] text-center tracking-wide">
          v0.1.0 — Phase 1
        </p>
      </div>
    </aside>
    </>
  );
}
