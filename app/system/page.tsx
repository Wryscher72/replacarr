"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Server, Tv2, Film, CheckCircle2, XCircle, AlertTriangle,
  HardDrive, Wifi, WifiOff, Activity, ScrollText, Database,
  RefreshCw, PowerOff, Play, Clock, ArrowUpCircle, HardDriveDownload, Magnet,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/store/settings";
import { Header } from "@/components/layout/Header";
import { formatBytes, cn } from "@/lib/utils";

interface IndexerItem { id: number; name: string; enableRss: boolean; enableAutomaticSearch: boolean; priority: number; }
interface DownloadClient { id: number; name: string; enable: boolean; protocol: string; }
interface HealthItem { type: string; source: string; message: string; wikiUrl?: string; }
interface DiskSpace { path: string; freeSpace: number; totalSpace: number; }
interface StatusInfo { version: string; startTime: string; appName: string; }
interface LogItem { id: number; time: string; level: string; logger: string; message: string; }
interface TaskItem { id: number; name: string; taskName: string; interval: number; lastExecution: string; nextExecution: string; }
interface UpdateItem { version: string; releaseDate: string; installed: boolean; changes?: { new: string[]; fixed: string[] }; }
interface SabnzbdUpdateInfo { status: boolean; lastversion?: string; download?: string; }

function ServiceSection({
  label, color, icon: Icon, children, isLoading,
}: {
  label: string; color: string; icon: React.ElementType;
  children: React.ReactNode; isLoading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]"
        style={{ borderLeftWidth: 3, borderLeftColor: color }}>
        <Icon size={14} style={{ color }} />
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-8 shimmer rounded-lg" />)}
          </div>
        ) : children}
      </div>
    </div>
  );
}

type TabKey = "status" | "tasks" | "indexers" | "clients" | "health" | "logs";

export default function SystemPage() {
  const [tab, setTab] = useState<TabKey>("status");
  const [serviceFilter, setServiceFilter] = useState<"sonarr" | "radarr">("sonarr");
  const [confirmShutdown, setConfirmShutdown] = useState<"sonarr" | "radarr" | null>(null);
  const { sonarr, radarr, sabnzbd, qbittorrent } = useSettings();
  const { sonarrApi, radarrApi, sabnzbdApi, qbittorrentApi } = useApi();
  const queryClient = useQueryClient();

  // Status
  const { data: sonarrStatus, isLoading: sonarrStatusLoading } = useQuery<StatusInfo>({
    queryKey: ["sonarr-status"],
    queryFn: () => sonarrApi.get("/system/status").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });
  const { data: radarrStatus, isLoading: radarrStatusLoading } = useQuery<StatusInfo>({
    queryKey: ["radarr-status"],
    queryFn: () => radarrApi.get("/system/status").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  // Disk
  const { data: sonarrDisk } = useQuery<DiskSpace[]>({
    queryKey: ["sonarr-disk"],
    queryFn: () => sonarrApi.get("/diskspace").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });
  const { data: radarrDisk } = useQuery<DiskSpace[]>({
    queryKey: ["radarr-disk"],
    queryFn: () => radarrApi.get("/diskspace").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  // Available updates
  const { data: sonarrUpdates } = useQuery<UpdateItem[]>({
    queryKey: ["sonarr-updates"],
    queryFn: () => sonarrApi.get("/update").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });
  const { data: radarrUpdates } = useQuery<UpdateItem[]>({
    queryKey: ["radarr-updates"],
    queryFn: () => radarrApi.get("/update").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const sonarrPendingUpdate = sonarrUpdates?.find((u) => !u.installed);
  const radarrPendingUpdate = radarrUpdates?.find((u) => !u.installed);

  // SABnzbd status
  const { data: sabVersion } = useQuery<{ version: string }>({
    queryKey: ["sab-version"],
    queryFn: () => sabnzbdApi.get("", { params: { mode: "version" } }).then((r) => r.data),
    enabled: sabnzbd.enabled && !!sabnzbd.apiKey,
  });
  const { data: sabUpdate } = useQuery<SabnzbdUpdateInfo>({
    queryKey: ["sab-update"],
    queryFn: () => sabnzbdApi.get("", { params: { mode: "check_newstuff" } }).then((r) => r.data),
    enabled: sabnzbd.enabled && !!sabnzbd.apiKey,
    staleTime: 10 * 60 * 1000,
  });

  // qBittorrent status
  const { data: qbtVersion } = useQuery<string>({
    queryKey: ["qbt-version"],
    queryFn: () => qbittorrentApi.get("/api/v2/app/version").then((r) => r.data),
    enabled: qbittorrent.enabled && !!qbittorrent.url,
  });

  // Health
  const { data: sonarrHealth } = useQuery<HealthItem[]>({
    queryKey: ["sonarr-health"],
    queryFn: () => sonarrApi.get("/health").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });
  const { data: radarrHealth } = useQuery<HealthItem[]>({
    queryKey: ["radarr-health"],
    queryFn: () => radarrApi.get("/health").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  // Indexers
  const { data: sonarrIndexers, isLoading: sonarrIdxLoading } = useQuery<IndexerItem[]>({
    queryKey: ["sonarr-indexers"],
    queryFn: () => sonarrApi.get("/indexer").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });
  const { data: radarrIndexers, isLoading: radarrIdxLoading } = useQuery<IndexerItem[]>({
    queryKey: ["radarr-indexers"],
    queryFn: () => radarrApi.get("/indexer").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  // Download clients
  const { data: sonarrClients, isLoading: sonarrCliLoading } = useQuery<DownloadClient[]>({
    queryKey: ["sonarr-clients"],
    queryFn: () => sonarrApi.get("/downloadclient").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });
  const { data: radarrClients, isLoading: radarrCliLoading } = useQuery<DownloadClient[]>({
    queryKey: ["radarr-clients"],
    queryFn: () => radarrApi.get("/downloadclient").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  // Logs
  const { data: sonarrLogs, isLoading: sonarrLogLoading } = useQuery<{ records: LogItem[] }>({
    queryKey: ["sonarr-logs"],
    queryFn: () => sonarrApi.get("/log?pageSize=50&sortKey=time&sortDirection=descending").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey && tab === "logs",
  });
  const { data: radarrLogs, isLoading: radarrLogLoading } = useQuery<{ records: LogItem[] }>({
    queryKey: ["radarr-logs"],
    queryFn: () => radarrApi.get("/log?pageSize=50&sortKey=time&sortDirection=descending").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey && tab === "logs",
  });

  // Tasks
  const { data: sonarrTasks, isLoading: sonarrTasksLoading } = useQuery<TaskItem[]>({
    queryKey: ["sonarr-tasks"],
    queryFn: () => sonarrApi.get("/system/task").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey && tab === "tasks",
  });
  const { data: radarrTasks, isLoading: radarrTasksLoading } = useQuery<TaskItem[]>({
    queryKey: ["radarr-tasks"],
    queryFn: () => radarrApi.get("/system/task").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey && tab === "tasks",
  });

  // Restart / Shutdown mutations
  const sonarrRestart = useMutation({
    mutationFn: () => sonarrApi.post("/system/restart"),
    onSuccess: () => toast.success("Sonarr restarting…"),
    onError: () => toast.error("Failed to restart Sonarr"),
  });
  const radarrRestart = useMutation({
    mutationFn: () => radarrApi.post("/system/restart"),
    onSuccess: () => toast.success("Radarr restarting…"),
    onError: () => toast.error("Failed to restart Radarr"),
  });
  const sonarrShutdown = useMutation({
    mutationFn: () => sonarrApi.post("/system/shutdown"),
    onSuccess: () => { toast.success("Sonarr is shutting down"); setConfirmShutdown(null); },
    onError: () => toast.error("Failed to shut down Sonarr"),
  });
  const radarrShutdown = useMutation({
    mutationFn: () => radarrApi.post("/system/shutdown"),
    onSuccess: () => { toast.success("Radarr is shutting down"); setConfirmShutdown(null); },
    onError: () => toast.error("Failed to shut down Radarr"),
  });

  // Apply update mutations
  const sonarrApplyUpdate = useMutation({
    mutationFn: () => sonarrApi.post("/command", { name: "ApplicationUpdate" }),
    onSuccess: () => { toast.success("Sonarr update started — it will restart when complete"); queryClient.invalidateQueries({ queryKey: ["sonarr-updates"] }); },
    onError: () => toast.error("Failed to start Sonarr update"),
  });
  const radarrApplyUpdate = useMutation({
    mutationFn: () => radarrApi.post("/command", { name: "ApplicationUpdate" }),
    onSuccess: () => { toast.success("Radarr update started — it will restart when complete"); queryClient.invalidateQueries({ queryKey: ["radarr-updates"] }); },
    onError: () => toast.error("Failed to start Radarr update"),
  });

  // Run task mutation
  const sonarrRunTask = useMutation({
    mutationFn: (taskName: string) => sonarrApi.post("/command", { name: taskName }),
    onSuccess: (_, taskName) => { toast.success(`Sonarr: ${taskName} triggered`); queryClient.invalidateQueries({ queryKey: ["sonarr-tasks"] }); },
    onError: () => toast.error("Failed to run task"),
  });
  const radarrRunTask = useMutation({
    mutationFn: (taskName: string) => radarrApi.post("/command", { name: taskName }),
    onSuccess: (_, taskName) => { toast.success(`Radarr: ${taskName} triggered`); queryClient.invalidateQueries({ queryKey: ["radarr-tasks"] }); },
    onError: () => toast.error("Failed to run task"),
  });

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "status", label: "Status", icon: Server },
    { key: "health", label: "Health", icon: Activity },
    { key: "tasks", label: "Tasks", icon: Clock },
    { key: "indexers", label: "Indexers", icon: Database },
    { key: "clients", label: "Download Clients", icon: HardDrive },
    { key: "logs", label: "Logs", icon: ScrollText },
  ];

  const allHealth = [...(sonarrHealth ?? []), ...(radarrHealth ?? [])];
  const healthErrors = allHealth.filter((h) => h.type === "error").length;
  const healthWarnings = allHealth.filter((h) => h.type === "warning").length;

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="System"
        subtitle={
          healthErrors > 0
            ? `${healthErrors} error${healthErrors !== 1 ? "s" : ""}`
            : healthWarnings > 0
              ? `${healthWarnings} warning${healthWarnings !== 1 ? "s" : ""}`
              : "All services healthy"
        }
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Tab bar */}
        <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] w-fit">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize",
                tab === key
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-secondary)] hover:text-white"
              )}
            >
              <Icon size={12} /> {label}
              {key === "health" && healthErrors > 0 && (
                <span className="bg-[var(--color-danger)] text-white text-[10px] px-1.5 rounded-full">{healthErrors}</span>
              )}
              {key === "health" && healthErrors === 0 && healthWarnings > 0 && (
                <span className="bg-[var(--color-warning)] text-black text-[10px] px-1.5 rounded-full">{healthWarnings}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Status ── */}
        {tab === "status" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sonarr.enabled && !!sonarr.apiKey && (
              <ServiceSection label="Sonarr" color="var(--color-sonarr)" icon={Tv2} isLoading={sonarrStatusLoading}>
                <div className="space-y-3">
                  {sonarrStatus ? (
                    <>
                      <Row label="Version" value={sonarrStatus.version} />
                      <Row label="Start Time" value={new Date(sonarrStatus.startTime).toLocaleString()} />
                    </>
                  ) : <p className="text-sm text-[var(--color-danger)]">Offline</p>}
                  {sonarrPendingUpdate && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle size={13} className="text-[var(--color-warning)] shrink-0" />
                        <span className="text-xs text-[var(--color-warning)] font-semibold">{sonarrPendingUpdate.version} available</span>
                      </div>
                      <button onClick={() => sonarrApplyUpdate.mutate()} disabled={sonarrApplyUpdate.isPending}
                        className="text-[10px] font-semibold px-2 py-1 rounded-md bg-[var(--color-warning)] text-black hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap">
                        {sonarrApplyUpdate.isPending ? "Updating…" : "Apply Update"}
                      </button>
                    </div>
                  )}
                  {sonarrDisk?.map((d) => (
                    <DiskBar key={d.path} disk={d} />
                  ))}
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                    <button onClick={() => sonarrRestart.mutate()} disabled={sonarrRestart.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-sonarr)]/15 text-[var(--color-sonarr)] hover:bg-[var(--color-sonarr)]/25 disabled:opacity-50 transition-colors">
                      <RefreshCw size={11} className={sonarrRestart.isPending ? "animate-spin" : ""} />
                      {sonarrRestart.isPending ? "Restarting…" : "Restart"}
                    </button>
                    {confirmShutdown === "sonarr" ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[var(--color-warning)]">Shut down Sonarr?</span>
                        <button onClick={() => sonarrShutdown.mutate()} disabled={sonarrShutdown.isPending}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-[var(--color-danger)] text-white hover:opacity-90 disabled:opacity-50">
                          Yes
                        </button>
                        <button onClick={() => setConfirmShutdown(null)} className="px-2 py-1 rounded-lg text-xs text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-white">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmShutdown("sonarr")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20 transition-colors">
                        <PowerOff size={11} /> Shutdown
                      </button>
                    )}
                  </div>
                </div>
              </ServiceSection>
            )}
            {radarr.enabled && !!radarr.apiKey && (
              <ServiceSection label="Radarr" color="var(--color-radarr)" icon={Film} isLoading={radarrStatusLoading}>
                <div className="space-y-3">
                  {radarrStatus ? (
                    <>
                      <Row label="Version" value={radarrStatus.version} />
                      <Row label="Start Time" value={new Date(radarrStatus.startTime).toLocaleString()} />
                    </>
                  ) : <p className="text-sm text-[var(--color-danger)]">Offline</p>}
                  {radarrPendingUpdate && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle size={13} className="text-[var(--color-warning)] shrink-0" />
                        <span className="text-xs text-[var(--color-warning)] font-semibold">{radarrPendingUpdate.version} available</span>
                      </div>
                      <button onClick={() => radarrApplyUpdate.mutate()} disabled={radarrApplyUpdate.isPending}
                        className="text-[10px] font-semibold px-2 py-1 rounded-md bg-[var(--color-warning)] text-black hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap">
                        {radarrApplyUpdate.isPending ? "Updating…" : "Apply Update"}
                      </button>
                    </div>
                  )}
                  {radarrDisk?.map((d) => (
                    <DiskBar key={d.path} disk={d} />
                  ))}
                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                    <button onClick={() => radarrRestart.mutate()} disabled={radarrRestart.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-radarr)]/15 text-[var(--color-radarr)] hover:bg-[var(--color-radarr)]/25 disabled:opacity-50 transition-colors">
                      <RefreshCw size={11} className={radarrRestart.isPending ? "animate-spin" : ""} />
                      {radarrRestart.isPending ? "Restarting…" : "Restart"}
                    </button>
                    {confirmShutdown === "radarr" ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[var(--color-warning)]">Shut down Radarr?</span>
                        <button onClick={() => radarrShutdown.mutate()} disabled={radarrShutdown.isPending}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-[var(--color-danger)] text-white hover:opacity-90 disabled:opacity-50">
                          Yes
                        </button>
                        <button onClick={() => setConfirmShutdown(null)} className="px-2 py-1 rounded-lg text-xs text-[var(--color-text-muted)] border border-[var(--color-border)] hover:text-white">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmShutdown("radarr")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20 transition-colors">
                        <PowerOff size={11} /> Shutdown
                      </button>
                    )}
                  </div>
                </div>
              </ServiceSection>
            )}
            {sabnzbd.enabled && !!sabnzbd.apiKey && (
              <ServiceSection label="SABnzbd" color="var(--color-sabnzbd)" icon={HardDriveDownload}>
                <div className="space-y-3">
                  {sabVersion?.version
                    ? <Row label="Version" value={sabVersion.version} />
                    : <p className="text-sm text-[var(--color-danger)]">Offline</p>}
                  {sabUpdate?.status && sabUpdate.lastversion && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle size={13} className="text-[var(--color-warning)] shrink-0" />
                        <span className="text-xs text-[var(--color-warning)] font-semibold">{sabUpdate.lastversion} available</span>
                      </div>
                      <a href={sabUpdate.download ?? "https://sabnzbd.org"} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] font-semibold px-2 py-1 rounded-md bg-[var(--color-warning)] text-black hover:opacity-90 transition-opacity whitespace-nowrap">
                        Download
                      </a>
                    </div>
                  )}
                </div>
              </ServiceSection>
            )}
            {qbittorrent.enabled && !!qbittorrent.url && (
              <ServiceSection label="qBittorrent" color="var(--color-qbittorrent)" icon={Magnet}>
                <div className="space-y-3">
                  {qbtVersion
                    ? <Row label="Version" value={qbtVersion} />
                    : <p className="text-sm text-[var(--color-danger)]">Offline</p>}
                  <p className="text-xs text-[var(--color-text-muted)]">Update check not available via API — use the qBittorrent web UI to check for updates.</p>
                </div>
              </ServiceSection>
            )}
          </div>
        )}

        {/* ── Tasks ── */}
        {tab === "tasks" && (
          <div>
            <ServiceToggle value={serviceFilter} onChange={setServiceFilter} />
            <div className="mt-4 space-y-2">
              {(serviceFilter === "sonarr" ? sonarrTasksLoading : radarrTasksLoading) && <LoadingSkeleton />}
              {(serviceFilter === "sonarr" ? sonarrTasks : radarrTasks)?.map((task) => {
                const isSonarr = serviceFilter === "sonarr";
                const accentColor = isSonarr ? "var(--color-sonarr)" : "var(--color-radarr)";
                const running = isSonarr ? sonarrRunTask.isPending : radarrRunTask.isPending;
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{task.name}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                        <span>Every {task.interval >= 60 ? `${Math.round(task.interval / 60)}h` : `${task.interval}m`}</span>
                        {task.lastExecution && task.lastExecution !== "0001-01-01T00:00:00Z" && (
                          <span>Last: {new Date(task.lastExecution).toLocaleString()}</span>
                        )}
                        {task.nextExecution && (
                          <span>Next: {new Date(task.nextExecution).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => isSonarr ? sonarrRunTask.mutate(task.taskName) : radarrRunTask.mutate(task.taskName)}
                      disabled={running}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)`, color: accentColor }}
                    >
                      <Play size={10} fill="currentColor" /> Run
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Health ── */}
        {tab === "health" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <HealthSection label="Sonarr" color="var(--color-sonarr)" items={sonarrHealth} />
            <HealthSection label="Radarr" color="var(--color-radarr)" items={radarrHealth} />
          </div>
        )}

        {/* ── Indexers ── */}
        {tab === "indexers" && (
          <div>
            <ServiceToggle value={serviceFilter} onChange={setServiceFilter} />
            <div className="mt-4 space-y-2">
              {(serviceFilter === "sonarr" ? sonarrIndexers : radarrIndexers)?.map((idx) => (
                <motion.div
                  key={idx.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]"
                >
                  <div className={cn("w-2 h-2 rounded-full shrink-0", idx.enableRss ? "bg-[var(--color-success)]" : "bg-[var(--color-text-muted)]")} />
                  <span className="text-sm font-medium text-white flex-1">{idx.name}</span>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    {idx.enableRss && <span className="px-1.5 py-0.5 rounded bg-[var(--color-success)]/10 text-[var(--color-success)]">RSS</span>}
                    {idx.enableAutomaticSearch && <span className="px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent-bright)]">Auto</span>}
                    <span className="font-mono">P{idx.priority}</span>
                  </div>
                </motion.div>
              ))}
              {(serviceFilter === "sonarr" ? sonarrIdxLoading : radarrIdxLoading) && <LoadingSkeleton />}
            </div>
          </div>
        )}

        {/* ── Download Clients ── */}
        {tab === "clients" && (
          <div>
            <ServiceToggle value={serviceFilter} onChange={setServiceFilter} />
            <div className="mt-4 space-y-2">
              {(serviceFilter === "sonarr" ? sonarrClients : radarrClients)?.map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]"
                >
                  {c.enable
                    ? <Wifi size={14} className="text-[var(--color-success)] shrink-0" />
                    : <WifiOff size={14} className="text-[var(--color-text-muted)] shrink-0" />}
                  <span className="text-sm font-medium text-white flex-1">{c.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-[var(--color-text-muted)] uppercase font-mono">
                    {c.protocol}
                  </span>
                </motion.div>
              ))}
              {(serviceFilter === "sonarr" ? sonarrCliLoading : radarrCliLoading) && <LoadingSkeleton />}
            </div>
          </div>
        )}

        {/* ── Logs ── */}
        {tab === "logs" && (
          <div>
            <ServiceToggle value={serviceFilter} onChange={setServiceFilter} />
            <div className="mt-4 space-y-1 font-mono text-xs">
              {(serviceFilter === "sonarr" ? sonarrLogLoading : radarrLogLoading) && <LoadingSkeleton rows={8} />}
              {(serviceFilter === "sonarr" ? sonarrLogs?.records : radarrLogs?.records)?.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2 rounded-lg",
                    log.level === "error" ? "bg-[var(--color-danger)]/8 text-[var(--color-danger)]"
                      : log.level === "warn" ? "bg-[var(--color-warning)]/8 text-[var(--color-warning)]"
                        : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)]"
                  )}
                >
                  <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 pt-0.5 w-16">
                    {new Date(log.time).toLocaleTimeString()}
                  </span>
                  <span className={cn(
                    "shrink-0 w-10 uppercase text-[10px] font-bold",
                    log.level === "error" ? "text-[var(--color-danger)]"
                      : log.level === "warn" ? "text-[var(--color-warning)]"
                        : "text-[var(--color-text-muted)]"
                  )}>{log.level}</span>
                  <span className="flex-1 break-all">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function DiskBar({ disk }: { disk: DiskSpace }) {
  const used = disk.totalSpace - disk.freeSpace;
  const pct = disk.totalSpace > 0 ? (used / disk.totalSpace) * 100 : 0;
  const danger = pct > 90;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[var(--color-text-muted)] truncate max-w-[60%]">{disk.path}</span>
        <span className={danger ? "text-[var(--color-danger)]" : "text-[var(--color-text-muted)]"}>
          {formatBytes(disk.freeSpace)} free
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: danger ? "var(--color-danger)" : "var(--color-accent)",
          }}
        />
      </div>
    </div>
  );
}

function HealthSection({ label, color, items }: { label: string; color: string; items?: HealthItem[] }) {
  if (!items) return null;
  return (
    <ServiceSection label={label} color={color} icon={Activity}>
      {items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-success)]">
          <CheckCircle2 size={14} /> No issues
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((h, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {h.type === "error"
                ? <XCircle size={14} className="text-[var(--color-danger)] shrink-0 mt-0.5" />
                : <AlertTriangle size={14} className="text-[var(--color-warning)] shrink-0 mt-0.5" />}
              <div>
                <p className={h.type === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"}>
                  {h.source}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">{h.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </ServiceSection>
  );
}

function ServiceToggle({ value, onChange }: { value: "sonarr" | "radarr"; onChange: (v: "sonarr" | "radarr") => void }) {
  return (
    <div className="flex gap-1 w-fit p-1 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)]">
      {(["sonarr", "radarr"] as const).map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all",
            value === s
              ? s === "sonarr" ? "bg-[var(--color-sonarr)] text-white" : "bg-[var(--color-radarr)] text-white"
              : "text-[var(--color-text-secondary)] hover:text-white"
          )}
        >
          {s === "sonarr" ? <Tv2 size={11} /> : <Film size={11} />} {s}
        </button>
      ))}
    </div>
  );
}

function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-10 shimmer rounded-xl" />
      ))}
    </div>
  );
}
