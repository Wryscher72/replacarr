"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, CheckCircle2, Download, AlertTriangle, Tv2, Film, X, Menu, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSettings } from "@/store/settings";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";

interface HistoryRecord {
  id: number;
  title?: string;
  sourceTitle?: string;
  eventType: string;
  date: string;
  series?: { title: string };
  movie?: { title: string };
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  grabbed: Download,
  downloadFolderImported: CheckCircle2,
  downloadImported: CheckCircle2,
  downloadFailed: AlertTriangle,
};

function NotificationPanel({
  sonarrRecords, radarrRecords, onClose,
}: {
  sonarrRecords: HistoryRecord[]| undefined;
  radarrRecords: HistoryRecord[] | undefined;
  onClose: () => void;
}) {
  const merged = [
    ...(sonarrRecords ?? []).map((r) => ({ ...r, _service: "sonarr" as const })),
    ...(radarrRecords ?? []).map((r) => ({ ...r, _service: "radarr" as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl glass border border-[var(--color-border)] shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold text-white">Recent Activity</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-white/10 text-[var(--color-text-muted)] hover:text-white transition-colors">
          <X size={13} />
        </button>
      </div>
      {merged.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-6">No recent activity</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border)]">
          {merged.map((r) => {
            const Icon = EVENT_ICONS[r.eventType] ?? CheckCircle2;
            const title = r.series?.title ?? r.movie?.title ?? r.sourceTitle ?? r.title ?? "Unknown";
            const isFailed = r.eventType === "downloadFailed";
            const color = r._service === "sonarr" ? "var(--color-sonarr)" : "var(--color-radarr)";
            return (
              <li key={`${r._service}-${r.id}`} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-white/3 transition-colors">
                <Icon
                  size={13}
                  className="mt-0.5 shrink-0"
                  style={{ color: isFailed ? "var(--color-danger)" : color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{title}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {r._service === "sonarr"
                      ? <Tv2 size={9} style={{ color }} />
                      : <Film size={9} style={{ color }} />}
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {r.eventType.replace(/([A-Z])/g, " $1").toLowerCase().trim()}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                      {new Date(r.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface ServiceStatusProps {
  label: string;
  color: string;
  isOnline: boolean;
  isLoading: boolean;
}

function ServiceStatus({ label, color, isOnline, isLoading }: ServiceStatusProps) {
  return (
    <div className="flex items-center gap-1.5">
      {isLoading ? (
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-muted)] animate-pulse" />
      ) : isOnline ? (
        <div
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
      ) : (
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-danger)]" />
      )}
      <span
        className={cn(
          "text-xs font-mono font-semibold",
          isOnline ? "" : "text-[var(--color-danger)]"
        )}
        style={isOnline ? { color } : undefined}
      >
        {label}
      </span>
    </div>
  );
}

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { sonarr, radarr, sabnzbd } = useSettings();
  const { sonarrApi, radarrApi, sabnzbdApi } = useApi();
  const [showNotifications, setShowNotifications] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const { toggleSidebar, openCommandPalette } = useUIStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const { data: sonarrHistory } = useQuery<{ records: HistoryRecord[] }>(
    {
      queryKey: ["sonarr-history-recent"],
      queryFn: () => sonarrApi.get("/history?pageSize=15&sortKey=date&sortDirection=descending&includeSeries=true&includeEpisode=true").then((r) => r.data),
      enabled: sonarr.enabled && !!sonarr.apiKey,
      refetchInterval: 30000,
      retry: false,
    }
  );

  const { data: radarrHistory } = useQuery<{ records: HistoryRecord[] }>(
    {
      queryKey: ["radarr-history-recent"],
      queryFn: () => radarrApi.get("/history?pageSize=15&sortKey=date&sortDirection=descending&includeMovie=true").then((r) => r.data),
      enabled: radarr.enabled && !!radarr.apiKey,
      refetchInterval: 30000,
      retry: false,
    }
  );

  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const badgeCount = [
    ...(sonarrHistory?.records ?? []),
    ...(radarrHistory?.records ?? []),
  ].filter((r) => new Date(r.date).getTime() > recentCutoff).length;

  const { data: sonarrStatus, isLoading: sonarrLoading } = useQuery({
    queryKey: ["sonarr-ping"],
    queryFn: () => sonarrApi.get("/system/status"),
    enabled: sonarr.enabled && !!sonarr.apiKey,
    refetchInterval: 60000,
    retry: false,
  });

  const { data: radarrStatus, isLoading: radarrLoading } = useQuery({
    queryKey: ["radarr-ping"],
    queryFn: () => radarrApi.get("/system/status"),
    enabled: radarr.enabled && !!radarr.apiKey,
    refetchInterval: 60000,
    retry: false,
  });

  const { data: sabnzbdStatus, isLoading: sabnzbdLoading } = useQuery({
    queryKey: ["sabnzbd-ping"],
    queryFn: () => sabnzbdApi.get("/?mode=version&output=json"),
    enabled: sabnzbd.enabled && !!sabnzbd.apiKey,
    refetchInterval: 60000,
    retry: false,
  });

  const sonarrOnline = !!sonarrStatus;
  const radarrOnline = !!radarrStatus;
  const sabnzbdOnline = !!sabnzbdStatus;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-4 glass border-b border-[var(--color-border)]">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden p-2 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-card)] transition-colors -ml-1"
          aria-label="Toggle navigation"
        >
          <Menu size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white tracking-wide">{title}</h1>
          {subtitle && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-5">
        {/* Ctrl+K search hint — hidden on very small screens */}
        <button
          onClick={openCommandPalette}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-colors text-xs"
          title="Open command palette (Ctrl+K)"
        >
          <Search size={12} />
          <span className="hidden md:inline">Search…</span>
          <kbd className="hidden lg:flex items-center px-1.5 py-px rounded bg-[var(--color-bg-base)] border border-[var(--color-border)] font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>
        {/* Service status indicators */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)]">
          <ServiceStatus
            label="SONARR"
            color="var(--color-sonarr)"
            isOnline={sonarrOnline}
            isLoading={sonarrLoading && sonarr.enabled && !!sonarr.apiKey}
          />
          <div className="w-px h-3 bg-[var(--color-border)]" />
          <ServiceStatus
            label="RADARR"
            color="var(--color-radarr)"
            isOnline={radarrOnline}
            isLoading={radarrLoading && radarr.enabled && !!radarr.apiKey}
          />
          {sabnzbd.enabled && !!sabnzbd.apiKey && (
            <>
              <div className="w-px h-3 bg-[var(--color-border)]" />
              <ServiceStatus
                label="SAB"
                color="var(--color-sabnzbd)"
                isOnline={sabnzbdOnline}
                isLoading={sabnzbdLoading}
              />
            </>
          )}
        </div>

        {/* Notifications bell */}
        <div ref={bellRef} className="relative">
          <button
            onClick={() => setShowNotifications((v) => !v)}
            className={cn(
              "relative p-2 rounded-lg transition-colors",
              showNotifications
                ? "bg-[var(--color-bg-card)] text-white"
                : "hover:bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-white"
            )}
          >
            <Bell size={16} />
            {badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-[9px] font-bold px-0.5">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <NotificationPanel
              sonarrRecords={sonarrHistory?.records}
              radarrRecords={radarrHistory?.records}
              onClose={() => setShowNotifications(false)}
            />
          )}
        </div>
      </div>
    </header>
  );
}
