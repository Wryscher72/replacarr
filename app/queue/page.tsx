"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download, Tv2, Film, HardDriveDownload, X, RefreshCw,
  AlertCircle, CheckCircle2, Loader2, Clock, MoreVertical,
  Ban, Zap, Magnet, Pause, Play, Trash2, ArrowUp, ArrowDown,
} from "lucide-react";
import Link from "next/link";
import { useSettings } from "@/store/settings";
import { useApi } from "@/hooks/useApi";
import { Header } from "@/components/layout/Header";
import { formatBytes, cn } from "@/lib/utils";

interface QueueRecord {
  id: number;
  title: string;
  status: string;
  trackedDownloadStatus?: string;
  trackedDownloadState?: string;
  statusMessages?: { title: string; messages: string[] }[];
  errorMessage?: string;
  protocol: string;
  indexer?: string;
  downloadClient?: string;
  size: number;
  sizeleft: number;
  timeleft?: string;
  quality?: { quality: { name: string } };
  seriesId?: number;
  movieId?: number;
}

interface QueueResponse { totalRecords: number; records: QueueRecord[]; }

interface QbtTorrent {
  hash: string;
  name: string;
  state: string;
  size: number;
  dlspeed: number;
  upspeed: number;
  progress: number;
  num_seeds: number;
  num_leechs: number;
  eta: number;
  save_path: string;
  category?: string;
}

interface QbtTransfer {
  dl_info_speed: number;
  up_info_speed: number;
}

function qbtStateLabel(state: string): string {
  const map: Record<string, string> = {
    downloading: "Downloading", stalledDL: "Stalled", uploading: "Seeding",
    pausedDL: "Paused", pausedUP: "Seeding (paused)", queuedDL: "Queued",
    checkingDL: "Checking", checkingUP: "Checking", metaDL: "Fetching meta",
    forcedDL: "Forced DL", error: "Error",
  };
  return map[state] ?? state;
}

function qbtStateColor(state: string): string {
  if (state === "downloading" || state === "forcedDL") return "text-[var(--color-qbittorrent)]";
  if (state === "uploading") return "text-[var(--color-success)]";
  if (state === "error") return "text-[var(--color-danger)]";
  if (state.startsWith("paused")) return "text-[var(--color-warning)]";
  return "text-[var(--color-text-muted)]";
}

function QbtTorrentItem({ torrent, onPause, onResume, onDelete }: {
  torrent: QbtTorrent;
  onPause: (hash: string) => void;
  onResume: (hash: string) => void;
  onDelete: (hash: string) => void;
}) {
  const pct = Math.round(torrent.progress * 100);
  const isPaused = torrent.state.startsWith("paused");
  const isError = torrent.state === "error";
  const accentColor = "var(--color-qbittorrent)";
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
      className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "color-mix(in srgb, var(--color-qbittorrent) 15%, transparent)", border: "1px solid var(--color-qbittorrent)44" }}>
          <Magnet size={14} style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate" title={torrent.name}>{torrent.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className={cn("text-xs font-medium", qbtStateColor(torrent.state))}>{qbtStateLabel(torrent.state)}</span>
            {torrent.category && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-base)] text-[var(--color-text-muted)] uppercase">{torrent.category}</span>}
            <span className="flex items-center gap-0.5 text-[10px] text-[var(--color-text-muted)]">
              <ArrowDown size={9} className="text-[var(--color-success)]" />{(torrent.dlspeed / 1024 / 1024).toFixed(1)} MB/s
            </span>
            <span className="flex items-center gap-0.5 text-[10px] text-[var(--color-text-muted)]">
              <ArrowUp size={9} className="text-[var(--color-warning)]" />{(torrent.upspeed / 1024 / 1024).toFixed(1)} MB/s
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)]">{torrent.num_seeds}S / {torrent.num_leechs}L</span>
            {torrent.eta > 0 && torrent.eta < 8640000 && (
              <span className="text-xs text-[var(--color-text-muted)]">
                ETA: {torrent.eta < 3600 ? `${Math.floor(torrent.eta / 60)}m` : `${Math.floor(torrent.eta / 3600)}h`}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => isPaused ? onResume(torrent.hash) : onPause(torrent.hash)}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition-colors"
            title={isPaused ? "Resume" : "Pause"}
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            onClick={() => onDelete(torrent.hash)}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
            title="Delete torrent"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--color-text-muted)]">{formatBytes(Math.round(torrent.size * torrent.progress))} / {formatBytes(torrent.size)}</span>
          <span className="text-xs font-mono font-semibold" style={{ color: accentColor }}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: accentColor }}
            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
        </div>
      </div>
      {isError && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-[var(--color-danger)]/8 border border-[var(--color-danger)]/20">
          <AlertCircle size={12} className="text-[var(--color-danger)] mt-0.5 shrink-0" />
          <p className="text-xs text-[var(--color-danger)]">Error state — check qBittorrent</p>
        </div>
      )}
    </motion.div>
  );
}

interface SabQueueSlot {
  nzo_id: string; filename: string; status: string;
  percentage: string; mb: string; mbleft: string;
  timeleft: string; cat: string;
}

function statusIcon(status: string) {
  const s = status?.toLowerCase();
  if (s === "completed" || s === "imported") return <CheckCircle2 size={14} className="text-[var(--color-success)]" />;
  if (s === "failed" || s === "warning") return <AlertCircle size={14} className="text-[var(--color-danger)]" />;
  if (s === "downloading") return <Loader2 size={14} className="text-[var(--color-accent-bright)] animate-spin" />;
  return <Clock size={14} className="text-[var(--color-text-muted)]" />;
}

function statusColor(status: string) {
  const s = status?.toLowerCase();
  if (s === "completed" || s === "imported") return "text-[var(--color-success)]";
  if (s === "failed" || s === "warning") return "text-[var(--color-danger)]";
  if (s === "downloading") return "text-[var(--color-accent-bright)]";
  return "text-[var(--color-text-muted)]";
}

function ActionMenu({ onGrab, onRemove, onBlocklist }: {
  onGrab: () => void; onRemove: () => void; onBlocklist: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition-colors" title="Actions">
        <MoreVertical size={14} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -4 }} transition={{ duration: 0.1 }}
            className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl z-20 overflow-hidden py-1"
          >
            <button onClick={() => { onGrab(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:text-white hover:bg-white/5 transition-colors">
              <Zap size={12} className="text-[var(--color-accent-bright)]" /> Force Grab
            </button>
            <div className="mx-2 my-1 h-px bg-[var(--color-border)]" />
            <button onClick={() => { onRemove(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:text-white hover:bg-white/5 transition-colors">
              <X size={12} className="text-[var(--color-warning)]" /> Remove
            </button>
            <button onClick={() => { onBlocklist(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors">
              <Ban size={12} /> Remove + Blocklist
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QueueItem({ item, source, onRemove, onBlocklist, onGrab }: {
  item: QueueRecord; source: "sonarr" | "radarr";
  onRemove: (id: number) => void; onBlocklist: (id: number) => void; onGrab: (id: number) => void;
}) {
  const pct = item.size > 0 ? Math.round(((item.size - item.sizeleft) / item.size) * 100) : 0;
  const accentColor = source === "sonarr" ? "var(--color-sonarr)" : "var(--color-radarr)";
  const href = source === "sonarr" && item.seriesId
    ? `/sonarr/${item.seriesId}`
    : source === "radarr" && item.movieId
      ? `/radarr/${item.movieId}`
      : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
      className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)`, border: `1px solid ${accentColor}44` }}>
          {source === "sonarr" ? <Tv2 size={14} style={{ color: accentColor }} /> : <Film size={14} style={{ color: accentColor }} />}
        </div>
        <div className="flex-1 min-w-0">
          {href ? (
            <Link href={href} className="text-sm font-semibold text-white hover:underline truncate block">{item.title}</Link>
          ) : (
            <p className="text-sm font-semibold text-white truncate">{item.title}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              {statusIcon(item.status)}
              <span className={cn("text-xs font-medium capitalize", statusColor(item.status))}>
                {item.trackedDownloadState?.replace(/([A-Z])/g, " $1").toLowerCase().trim() ?? item.status}
              </span>
            </div>
            {item.quality && <span className="text-xs text-[var(--color-text-muted)]">{item.quality.quality.name}</span>}
            {item.protocol && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-base)] text-[var(--color-text-muted)] uppercase">{item.protocol}</span>}
            {item.indexer && <span className="text-xs text-[var(--color-text-muted)]">{item.indexer}</span>}
          </div>
        </div>
        <ActionMenu onGrab={() => onGrab(item.id)} onRemove={() => onRemove(item.id)} onBlocklist={() => onBlocklist(item.id)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--color-text-muted)]">{formatBytes(item.size - item.sizeleft)} / {formatBytes(item.size)}</span>
          <div className="flex items-center gap-3">
            {item.timeleft && <span className="text-xs text-[var(--color-text-muted)]">ETA: {item.timeleft}</span>}
            <span className="text-xs font-mono font-semibold" style={{ color: accentColor }}>{pct}%</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
          <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${accentColor}, var(--color-accent-bright))` }}
            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
        </div>
      </div>

      {item.statusMessages?.map((msg, i) => (
        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-[var(--color-warning)]/8 border border-[var(--color-warning)]/20">
          <AlertCircle size={12} className="text-[var(--color-warning)] mt-0.5 shrink-0" />
          <div>
            {msg.title && <p className="text-xs text-[var(--color-warning)] font-medium">{msg.title}</p>}
            {msg.messages.map((m, j) => <p key={j} className="text-xs text-[var(--color-warning)]/80">{m}</p>)}
          </div>
        </div>
      ))}
      {item.errorMessage && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-[var(--color-danger)]/8 border border-[var(--color-danger)]/20">
          <AlertCircle size={12} className="text-[var(--color-danger)] mt-0.5 shrink-0" />
          <p className="text-xs text-[var(--color-danger)]">{item.errorMessage}</p>
        </div>
      )}
    </motion.div>
  );
}

export default function QueuePage() {
  const { sonarr, radarr, sabnzbd, qbittorrent } = useSettings();
  const { sonarrApi, radarrApi, sabnzbdApi, qbittorrentApi } = useApi();
  const queryClient = useQueryClient();

  const { data: sonarrQueue, isLoading: sonarrLoading } = useQuery<QueueResponse>({
    queryKey: ["sonarr-queue"],
    queryFn: () => sonarrApi.get("/queue?pageSize=100&includeUnknownSeriesItems=true&includeSeries=true").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
    refetchInterval: 8000,
  });

  const { data: radarrQueue, isLoading: radarrLoading } = useQuery<QueueResponse>({
    queryKey: ["radarr-queue"],
    queryFn: () => radarrApi.get("/queue?pageSize=100&includeUnknownMovieItems=true&includeMovie=true").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
    refetchInterval: 8000,
  });

  const { data: sabData, isLoading: sabLoading } = useQuery({
    queryKey: ["sabnzbd-queue"],
    queryFn: () => sabnzbdApi.get("/?mode=queue&output=json").then((r) => r.data),
    enabled: sabnzbd.enabled && !!sabnzbd.apiKey,
    refetchInterval: 5000,
  });

  const sonarrRemove = useMutation({ mutationFn: (id: number) => sonarrApi.delete(`/queue/${id}?removeFromClient=false&blocklist=false`), onSuccess: () => { toast.success("Removed from queue"); queryClient.invalidateQueries({ queryKey: ["sonarr-queue"] }); } });
  const sonarrBlocklist = useMutation({ mutationFn: (id: number) => sonarrApi.delete(`/queue/${id}?removeFromClient=true&blocklist=true`), onSuccess: () => { toast.success("Removed and added to blocklist"); queryClient.invalidateQueries({ queryKey: ["sonarr-queue"] }); } });
  const sonarrGrab = useMutation({ mutationFn: (id: number) => sonarrApi.post("/queue/grab", { ids: [id] }), onSuccess: () => { toast.success("Force grab sent"); setTimeout(() => queryClient.invalidateQueries({ queryKey: ["sonarr-queue"] }), 1500); } });

  const radarrRemove = useMutation({ mutationFn: (id: number) => radarrApi.delete(`/queue/${id}?removeFromClient=false&blocklist=false`), onSuccess: () => { toast.success("Removed from queue"); queryClient.invalidateQueries({ queryKey: ["radarr-queue"] }); } });
  const radarrBlocklist = useMutation({ mutationFn: (id: number) => radarrApi.delete(`/queue/${id}?removeFromClient=true&blocklist=true`), onSuccess: () => { toast.success("Removed and added to blocklist"); queryClient.invalidateQueries({ queryKey: ["radarr-queue"] }); } });
  const radarrGrab = useMutation({ mutationFn: (id: number) => radarrApi.post("/queue/grab", { ids: [id] }), onSuccess: () => { toast.success("Force grab sent"); setTimeout(() => queryClient.invalidateQueries({ queryKey: ["radarr-queue"] }), 1500); } });

  const { data: qbtTorrents, isLoading: qbtLoading } = useQuery<QbtTorrent[]>({
    queryKey: ["qbt-torrents"],
    queryFn: () => qbittorrentApi.get("/torrents/info").then((r) => r.data),
    enabled: qbittorrent.enabled && !!qbittorrent.password,
    refetchInterval: 5000,
  });

  const { data: qbtTransfer } = useQuery<QbtTransfer>({
    queryKey: ["qbt-transfer"],
    queryFn: () => qbittorrentApi.get("/transfer/info").then((r) => r.data),
    enabled: qbittorrent.enabled && !!qbittorrent.password,
    refetchInterval: 5000,
  });

  const qbtPause = useMutation({
    mutationFn: (hash: string) => qbittorrentApi.post("/torrents/pause", `hashes=${hash}`, { headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["qbt-torrents"] }),
  });
  const qbtResume = useMutation({
    mutationFn: (hash: string) => qbittorrentApi.post("/torrents/resume", `hashes=${hash}`, { headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["qbt-torrents"] }),
  });
  const qbtDelete = useMutation({
    mutationFn: (hash: string) => qbittorrentApi.post("/torrents/delete", `hashes=${hash}&deleteFiles=false`, { headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
    onSuccess: () => { toast.success("Torrent deleted"); queryClient.invalidateQueries({ queryKey: ["qbt-torrents"] }); },
  });

  const sabPause = useMutation({
    mutationFn: (nzoId: string) => sabnzbdApi.get(`/?mode=queue&name=pause&value=${nzoId}&output=json`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sabnzbd-queue"] }),
  });
  const sabResume = useMutation({
    mutationFn: (nzoId: string) => sabnzbdApi.get(`/?mode=queue&name=resume&value=${nzoId}&output=json`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sabnzbd-queue"] }),
  });
  const sabDelete = useMutation({
    mutationFn: (nzoId: string) => sabnzbdApi.get(`/?mode=queue&name=delete&value=${nzoId}&output=json`),
    onSuccess: () => { toast.success("Item removed"); queryClient.invalidateQueries({ queryKey: ["sabnzbd-queue"] }); },
  });

  const sonarrItems = sonarrQueue?.records ?? [];
  const radarrItems = radarrQueue?.records ?? [];
  const sabItems: SabQueueSlot[] = sabData?.queue?.slots ?? [];
  const qbtItems: QbtTorrent[] = qbtTorrents ?? [];
  const totalItems = sonarrItems.length + radarrItems.length + sabItems.length + qbtItems.length;
  const isLoading = sonarrLoading || radarrLoading || sabLoading || qbtLoading;

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Download Queue" subtitle={`${totalItems} item${totalItems !== 1 ? "s" : ""} active`} />

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-5">
          <p className="text-xs text-[var(--color-text-muted)]">Auto-refreshes every 8 seconds</p>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["sonarr-queue"] });
              queryClient.invalidateQueries({ queryKey: ["radarr-queue"] });
              queryClient.invalidateQueries({ queryKey: ["sabnzbd-queue"] });
              queryClient.invalidateQueries({ queryKey: ["qbt-torrents"] });
              queryClient.invalidateQueries({ queryKey: ["qbt-transfer"] });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] transition-colors"
          >
            <RefreshCw size={11} /> Refresh
          </button>
        </div>

        {isLoading && <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 shimmer rounded-xl" />)}</div>}

        {!isLoading && totalItems === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center mb-4">
              <Download size={28} className="text-[var(--color-text-muted)]" />
            </div>
            <p className="text-white font-semibold">Queue is empty</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">No active downloads from Sonarr, Radarr, SABnzbd or qBittorrent</p>
          </div>
        )}

        {!isLoading && sonarrItems.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Tv2 size={14} className="text-[var(--color-sonarr)]" />
              <h2 className="text-sm font-semibold text-[var(--color-sonarr)]">Sonarr ({sonarrItems.length})</h2>
            </div>
            <AnimatePresence>
              <div className="space-y-3">
                {sonarrItems.map((item) => (
                  <QueueItem key={item.id} item={item} source="sonarr"
                    onRemove={(id) => sonarrRemove.mutate(id)}
                    onBlocklist={(id) => sonarrBlocklist.mutate(id)}
                    onGrab={(id) => sonarrGrab.mutate(id)}
                  />
                ))}
              </div>
            </AnimatePresence>
          </div>
        )}

        {!isLoading && radarrItems.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Film size={14} className="text-[var(--color-radarr)]" />
              <h2 className="text-sm font-semibold text-[var(--color-radarr)]">Radarr ({radarrItems.length})</h2>
            </div>
            <AnimatePresence>
              <div className="space-y-3">
                {radarrItems.map((item) => (
                  <QueueItem key={item.id} item={item} source="radarr"
                    onRemove={(id) => radarrRemove.mutate(id)}
                    onBlocklist={(id) => radarrBlocklist.mutate(id)}
                    onGrab={(id) => radarrGrab.mutate(id)}
                  />
                ))}
              </div>
            </AnimatePresence>
          </div>
        )}

        {!isLoading && qbtItems.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Magnet size={14} className="text-[var(--color-qbittorrent)]" />
              <h2 className="text-sm font-semibold text-[var(--color-qbittorrent)]">qBittorrent ({qbtItems.length})</h2>
              {qbtTransfer && (
                <div className="ml-auto flex items-center gap-3 text-xs font-mono text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-0.5"><ArrowDown size={10} className="text-[var(--color-success)]" />{(qbtTransfer.dl_info_speed / 1024 / 1024).toFixed(1)} MB/s</span>
                  <span className="flex items-center gap-0.5"><ArrowUp size={10} className="text-[var(--color-warning)]" />{(qbtTransfer.up_info_speed / 1024 / 1024).toFixed(1)} MB/s</span>
                </div>
              )}
            </div>
            <AnimatePresence>
              <div className="space-y-3">
                {qbtItems.map((t) => (
                  <QbtTorrentItem key={t.hash} torrent={t}
                    onPause={(h) => qbtPause.mutate(h)}
                    onResume={(h) => qbtResume.mutate(h)}
                    onDelete={(h) => qbtDelete.mutate(h)}
                  />
                ))}
              </div>
            </AnimatePresence>
          </div>
        )}

        {!isLoading && sabItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HardDriveDownload size={14} className="text-[var(--color-sabnzbd)]" />
              <h2 className="text-sm font-semibold text-[var(--color-sabnzbd)]">SABnzbd ({sabItems.length})</h2>
              {sabData?.queue?.speed && <span className="ml-auto text-xs font-mono text-[var(--color-sabnzbd)]">{sabData.queue.speed}</span>}
            </div>
            <div className="space-y-3">
              {sabItems.map((slot: SabQueueSlot, idx: number) => {
                const pct = parseFloat(slot.percentage) || 0;
                const totalMb = parseFloat(slot.mb) || 0;
                const leftMb = parseFloat(slot.mbleft) || 0;
                const isPaused = slot.status === "Paused";
                return (
                  <motion.div key={slot.nzo_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                    className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-3 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "color-mix(in srgb, var(--color-sabnzbd) 15%, transparent)", border: "1px solid var(--color-sabnzbd)44" }}>
                        <HardDriveDownload size={14} style={{ color: "var(--color-sabnzbd)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{slot.filename}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[var(--color-sabnzbd)]">{slot.status}</span>
                          {slot.cat && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-base)] text-[var(--color-text-muted)] uppercase">{slot.cat}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => isPaused ? sabResume.mutate(slot.nzo_id) : sabPause.mutate(slot.nzo_id)}
                          title={isPaused ? "Resume" : "Pause"}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-sabnzbd)] hover:bg-[var(--color-sabnzbd)]/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          {isPaused ? <Play size={13} /> : <Pause size={13} />}
                        </button>
                        <button
                          onClick={() => sabDelete.mutate(slot.nzo_id)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--color-text-muted)]">{(totalMb - leftMb).toFixed(0)} MB / {totalMb.toFixed(0)} MB</span>
                        <div className="flex items-center gap-3">
                          {slot.timeleft && slot.timeleft !== "0:00:00" && <span className="text-xs text-[var(--color-text-muted)]">ETA: {slot.timeleft}</span>}
                          <span className="text-xs font-mono font-semibold text-[var(--color-sabnzbd)]">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: isPaused ? "var(--color-text-muted)" : "var(--color-sabnzbd)" }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
