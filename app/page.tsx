"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Tv2,
  Film,
  HardDrive,
  Download,
  HardDriveDownload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Activity,
  Clock,
  Settings,
} from "lucide-react";
import { useSettings } from "@/store/settings";
import { useApi } from "@/hooks/useApi";
import { Header } from "@/components/layout/Header";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ---- Types ----
interface SonarrSeries {
  id: number;
  title: string;
  monitored: boolean;
  statistics: {
    episodeFileCount: number;
    episodeCount: number;
    sizeOnDisk: number;
  };
}

interface RadarrMovie {
  id: number;
  title: string;
  monitored: boolean;
  hasFile: boolean;
  sizeOnDisk: number;
}

interface DiskSpace {
  path: string;
  freeSpace: number;
  totalSpace: number;
}

interface HealthCheck {
  type: string;
  message: string;
  source: string;
}

interface QueueRecord {
  id: number;
  title: string;
  status: string;
  sizeleft: number;
  size: number;
}

interface HistoryRecord {
  id: number;
  date: string;
  eventType: string;
}

// ---- Disk Bar ----
function DiskBar({ disk, color }: { disk: DiskSpace; color: string }) {
  const usedSpace = disk.totalSpace - disk.freeSpace;
  const pct = disk.totalSpace > 0 ? Math.round((usedSpace / disk.totalSpace) * 100) : 0;
  const label = disk.path.split(/[\/]/).filter(Boolean).pop() ?? disk.path;
  const isAlmost = pct > 85;
  const barColor = isAlmost ? "var(--color-warning)" : color;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--color-text-secondary)] font-medium truncate max-w-[60%]" title={disk.path}>{label}</span>
        <span className={`text-xs font-mono ${isAlmost ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}`}>{formatBytes(disk.freeSpace)} free</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ background: barColor }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: "easeOut" }} />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-[var(--color-text-muted)]">Used {pct}%</span>
        <span className="text-[10px] text-[var(--color-text-muted)]">{formatBytes(disk.totalSpace)}</span>
      </div>
    </div>
  );
}

// ---- Stat Card ----
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  isLoading?: boolean;
  href?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, color, isLoading, href }: StatCardProps) {
  const content = (
    <motion.div
      whileHover={href ? { y: -2, scale: 1.01 } : undefined}
      className={cn(
        "relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 overflow-hidden",
        href && "cursor-pointer hover:border-[var(--color-border-bright)] transition-colors"
      )}
    >
      <div
        className="absolute inset-0 opacity-5"
        style={{
          background: `radial-gradient(circle at top right, ${color}, transparent 70%)`,
        }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            {title}
          </p>
          {isLoading ? (
            <div className="mt-2 w-16 h-7 rounded shimmer" />
          ) : (
            <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
          )}
          {subtitle && (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{subtitle}</p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}22`, border: `1px solid ${color}33` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      {href && (
        <div className="relative mt-3 flex items-center gap-1 text-xs font-medium" style={{ color }}>
          View all <ArrowRight size={11} />
        </div>
      )}
    </motion.div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

// ---- Health Badge ----
function HealthBadge({ checks, label }: { checks: HealthCheck[] | undefined; label: string }) {
  if (!checks) return null;
  const errors = checks.filter((c) => c.type === "error");
  const warnings = checks.filter((c) => c.type === "warning");

  if (errors.length > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--color-danger)]">
        <XCircle size={11} /> {errors.length} error{errors.length !== 1 ? "s" : ""}
      </span>
    );
  }
  if (warnings.length > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--color-warning)]">
        <AlertTriangle size={11} /> {warnings.length} warning{warnings.length !== 1 ? "s" : ""}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-[var(--color-success)]">
      <CheckCircle2 size={11} /> Healthy
    </span>
  );
}

// ---- Queue Item ----
function QueueRow({ item }: { item: QueueRecord }) {
  const pct = item.size > 0 ? Math.round(((item.size - item.sizeleft) / item.size) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--color-border)] last:border-0">
      <Download size={13} className="text-[var(--color-text-muted)] flex-shrink-0" />
      <p className="flex-1 text-sm text-white truncate">{item.title}</p>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-20 h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-accent)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-[var(--color-text-muted)] w-8 text-right">{pct}%</span>
      </div>
    </div>
  );
}

// ---- Not Configured Banner ----
function NotConfiguredBanner() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-12 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[var(--color-accent-glow)] border border-[var(--color-accent)] flex items-center justify-center mb-6">
        <span className="text-4xl">🛸</span>
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Welcome to Replacarr</h2>
      <p className="text-[var(--color-text-secondary)] max-w-md mb-6">
        Your unified Sonarr &amp; Radarr media console. To get started, configure your server
        connections in Settings.
      </p>
      <Link
        href="/settings"
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-bright)] text-white font-semibold transition-colors"
      >
        <Settings size={16} />
        Open Settings
      </Link>
    </div>
  );
}

// ---- Main Dashboard ----
export default function DashboardPage() {
  const { sonarr, radarr, sabnzbd, isConfigured } = useSettings();
  const { sonarrApi, radarrApi, sabnzbdApi } = useApi();

  const configured = isConfigured();

  const { data: sonarrSeries, isLoading: seriesLoading } = useQuery<SonarrSeries[]>({
    queryKey: ["sonarr-series"],
    queryFn: () => sonarrApi.get("/series").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });

  const { data: sonarrDisk, isLoading: sonarrDiskLoading } = useQuery<DiskSpace[]>({
    queryKey: ["sonarr-disk"],
    queryFn: () => sonarrApi.get("/diskspace").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });

  const { data: sonarrHealth } = useQuery<HealthCheck[]>({
    queryKey: ["sonarr-health"],
    queryFn: () => sonarrApi.get("/health").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });

  const { data: sonarrQueue } = useQuery<{ records: QueueRecord[] }>({
    queryKey: ["sonarr-queue"],
    queryFn: () => sonarrApi.get("/queue").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
    refetchInterval: 10000,
  });

  const { data: radarrMovies, isLoading: moviesLoading } = useQuery<RadarrMovie[]>({
    queryKey: ["radarr-movies"],
    queryFn: () => radarrApi.get("/movie").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const { data: radarrDisk, isLoading: radarrDiskLoading } = useQuery<DiskSpace[]>({
    queryKey: ["radarr-disk"],
    queryFn: () => radarrApi.get("/diskspace").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const { data: radarrHealth } = useQuery<HealthCheck[]>({
    queryKey: ["radarr-health"],
    queryFn: () => radarrApi.get("/health").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const { data: radarrQueue } = useQuery<{ records: QueueRecord[] }>({
    queryKey: ["radarr-queue"],
    queryFn: () => radarrApi.get("/queue").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
    refetchInterval: 10000,
  });

  const { data: sabQueue } = useQuery({
    queryKey: ["sabnzbd-queue-dash"],
    queryFn: () => sabnzbdApi.get("/?mode=queue&output=json").then((r) => r.data),
    enabled: sabnzbd.enabled && !!sabnzbd.apiKey,
    refetchInterval: 10000,
  });

  const { data: sonarrHistory } = useQuery<{ records: HistoryRecord[] }>({
    queryKey: ["sonarr-history-dash"],
    queryFn: () => sonarrApi.get("/history?pageSize=50&sortKey=date&sortDirection=descending").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
    staleTime: 60000,
  });

  const { data: radarrHistory } = useQuery<{ records: HistoryRecord[] }>({
    queryKey: ["radarr-history-dash"],
    queryFn: () => radarrApi.get("/history?pageSize=50&sortKey=date&sortDirection=descending").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
    staleTime: 60000,
  });

  // Computed stats
  const seriesCount = sonarrSeries?.length ?? 0;
  const monitoredSeries = sonarrSeries?.filter((s) => s.monitored).length ?? 0;
  const totalEpisodes = sonarrSeries?.reduce((a, s) => a + s.statistics.episodeCount, 0) ?? 0;
  const episodesOnDisk = sonarrSeries?.reduce((a, s) => a + s.statistics.episodeFileCount, 0) ?? 0;

  const movieCount = radarrMovies?.length ?? 0;
  const moviesOnDisk = radarrMovies?.filter((m) => m.hasFile).length ?? 0;

  const sonarrFreeSpace = sonarrDisk?.[0]?.freeSpace;
  const radarrFreeSpace = radarrDisk?.[0]?.freeSpace;

  const allQueueItems = [
    ...(sonarrQueue?.records ?? []),
    ...(radarrQueue?.records ?? []),
  ].slice(0, 6);

  const sabSpeed: string = sabQueue?.queue?.speed ?? "";
  const sabSlots: number = sabQueue?.queue?.noofslots ?? 0;

  // Activity chart: count grabs+imports per day for last 7 days
  const activityDays = 7;
  const activityMap: Record<string, number> = {};
  const now = new Date();
  for (let i = activityDays - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    activityMap[d.toISOString().split("T")[0]] = 0;
  }
  const allHistory = [
    ...(sonarrHistory?.records ?? []),
    ...(radarrHistory?.records ?? []),
  ];
  for (const r of allHistory) {
    // Sonarr: downloadFolderImported — Radarr: movieFileImported
    if (r.eventType === "grabbed" || r.eventType === "downloadFolderImported" || r.eventType === "movieFileImported") {
      const day = r.date.split("T")[0];
      if (day in activityMap) activityMap[day] = (activityMap[day] ?? 0) + 1;
    }
  }
  const activityEntries = Object.entries(activityMap);
  const activityMax = Math.max(...Object.values(activityMap), 1);

  // Disk usage aggregated
  const allDisks: { disk: DiskSpace; color: string }[] = [
    ...(sonarrDisk ?? []).map((d) => ({ disk: d, color: "var(--color-sonarr)" })),
    ...(radarrDisk ?? []).filter((rd) => !(sonarrDisk ?? []).some((sd) => sd.path === rd.path)).map((d) => ({ disk: d, color: "var(--color-radarr)" })),
  ];

  if (!configured) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Dashboard" />
        <NotConfiguredBanner />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Dashboard" subtitle="Your media at a glance" />

      <div className="flex-1 p-6 space-y-6 bg-grid">
        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="TV Series"
            value={seriesLoading ? "…" : seriesCount}
            subtitle={`${monitoredSeries} monitored`}
            icon={Tv2}
            color="var(--color-sonarr)"
            isLoading={seriesLoading}
            href="/sonarr"
          />
          <StatCard
            title="Episodes"
            value={seriesLoading ? "…" : episodesOnDisk.toLocaleString()}
            subtitle={`of ${totalEpisodes.toLocaleString()} total`}
            icon={Activity}
            color="var(--color-sonarr)"
            isLoading={seriesLoading}
          />
          <StatCard
            title="Movies"
            value={moviesLoading ? "…" : movieCount}
            subtitle={`${moviesOnDisk} on disk`}
            icon={Film}
            color="var(--color-radarr)"
            isLoading={moviesLoading}
            href="/radarr"
          />
          <StatCard
            title="Active Downloads"
            value={allQueueItems.length + sabSlots}
            subtitle="across all services"
            icon={Download}
            color="var(--color-accent-bright)"
            href="/queue"
          />
        </div>

        {/* Main content row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Service Status */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
              Service Health
            </h2>

            {sonarr.enabled && !!sonarr.apiKey && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Tv2 size={14} className="text-[var(--color-sonarr)]" />
                    <span className="text-sm font-semibold text-white">Sonarr</span>
                  </div>
                  <HealthBadge checks={sonarrHealth} label="Sonarr" />
                </div>
                <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
                  <span>
                    <HardDrive size={10} className="inline mr-1" />
                    {sonarrFreeSpace ? formatBytes(sonarrFreeSpace) : "—"} free
                  </span>
                </div>
              </div>
            )}

            {radarr.enabled && !!radarr.apiKey && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Film size={14} className="text-[var(--color-radarr)]" />
                    <span className="text-sm font-semibold text-white">Radarr</span>
                  </div>
                  <HealthBadge checks={radarrHealth} label="Radarr" />
                </div>
                <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
                  <span>
                    <HardDrive size={10} className="inline mr-1" />
                    {radarrFreeSpace ? formatBytes(radarrFreeSpace) : "—"} free
                  </span>
                </div>
              </div>
            )}

            {sabnzbd.enabled && !!sabnzbd.apiKey && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDriveDownload size={14} className="text-[var(--color-sabnzbd)]" />
                    <span className="text-sm font-semibold text-white">SABnzbd</span>
                  </div>
                  {sabSpeed && (
                    <span className="text-xs font-mono text-[var(--color-sabnzbd)]">
                      {sabSpeed}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
                  <span>{sabSlots} item{sabSlots !== 1 ? "s" : ""} in queue</span>
                  {sabQueue?.queue?.timeleft && sabQueue.queue.timeleft !== "0:00:00" && (
                    <span>ETA {sabQueue.queue.timeleft}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Active Queue */}
          <div className="lg:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Active Downloads
              </h2>
              <Link
                href="/queue"
                className="flex items-center gap-1 text-xs text-[var(--color-accent-bright)] hover:text-white transition-colors"
              >
                View all <ArrowRight size={11} />
              </Link>
            </div>

            {allQueueItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock size={28} className="text-[var(--color-text-muted)] mb-2" />
                <p className="text-sm text-[var(--color-text-muted)]">No active downloads</p>
              </div>
            ) : (
              <div>
                {allQueueItems.map((item) => (
                  <QueueRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Disk usage + activity row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Disk Usage */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <HardDrive size={14} className="text-[var(--color-text-muted)]" />
              <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Disk Usage</h2>
            </div>
            {(sonarrDiskLoading || radarrDiskLoading) ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 shimmer rounded" />)}</div>
            ) : allDisks.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)]">No disk data available</p>
            ) : (
              allDisks.map(({ disk, color }, i) => <DiskBar key={i} disk={disk} color={color} />)
            )}
          </div>

          {/* Activity chart */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={14} className="text-[var(--color-text-muted)]" />
              <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Download Activity</h2>
              <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">Last 7 days</span>
            </div>
            <div className="flex items-end gap-1.5 h-24">
              {activityEntries.map(([day, count]) => {
                const isToday = day === now.toISOString().split("T")[0];
                const height = activityMax > 0 ? Math.max((count / activityMax) * 100, count > 0 ? 8 : 0) : 0;
                const shortDay = new Date(day + "T12:00:00").toLocaleDateString("en", { weekday: "short" });
                return (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center" style={{ height: "76px" }}>
                      <motion.div
                        className="w-full rounded-t-sm"
                        style={{ background: isToday ? "var(--color-accent-bright)" : "var(--color-accent)", opacity: count === 0 ? 0.15 : 0.9 }}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        title={`${count} event${count !== 1 ? "s" : ""}`}
                      />
                    </div>
                    <span className={`text-[9px] ${isToday ? "text-[var(--color-accent-bright)] font-bold" : "text-[var(--color-text-muted)]"}`}>{shortDay}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex gap-4 text-xs text-[var(--color-text-muted)]">
              <span><span className="text-white font-semibold">{allHistory.filter(r => r.eventType === "grabbed").length}</span> grabbed</span>
              <span><span className="text-white font-semibold">{allHistory.filter(r => r.eventType === "downloadFolderImported" || r.eventType === "movieFileImported").length}</span> imported</span>
            </div>
          </div>
        </div>

        {/* Quick links row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/sonarr", label: "TV Library", icon: Tv2, color: "var(--color-sonarr)" },
            { href: "/radarr", label: "Movie Library", icon: Film, color: "var(--color-radarr)" },
            { href: "/queue", label: "Downloads", icon: Download, color: "var(--color-accent-bright)" },
            { href: "/settings", label: "Settings", icon: Settings, color: "var(--color-text-secondary)" },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <motion.div
                  whileHover={{ y: -2 }}
                  className="flex items-center gap-3 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-bright)] transition-colors cursor-pointer"
                >
                  <Icon size={16} style={{ color: link.color }} />
                  <span className="text-sm font-medium text-white">{link.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
