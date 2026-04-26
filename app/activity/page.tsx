"use client";

import { useState, memo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Tv2, Film, Download, CheckCircle2, XCircle, Trash2,
  Clock, AlertTriangle, RefreshCw, Bell, BellOff,
  Filter, Loader2, Info, AlertCircle, ShieldAlert,
} from "lucide-react";
import { useSettings } from "@/store/settings";
import { useApi } from "@/hooks/useApi";
import { Header } from "@/components/layout/Header";
import { formatDateTime, cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface HistoryRecord {
  id: number;
  sourceTitle: string;
  eventType: string;
  date: string;
  quality?: { quality: { name: string } };
  downloadClient?: string;
  indexer?: string;
  data?: { reason?: string; message?: string };
  seriesId?: number;
  movieId?: number;
}

interface HistoryResponse {
  totalRecords: number;
  records: HistoryRecord[];
}

interface HealthItem {
  type: string;
  source: string;
  message: string;
  wikiUrl?: string;
}

// ── Event helpers ─────────────────────────────────────────────────────────────
type EventFilter = "all" | "grabbed" | "imported" | "failed" | "deleted";

const FILTER_OPTIONS: { value: EventFilter; label: string }[] = [
  { value: "all", label: "All Events" },
  { value: "grabbed", label: "Grabbed" },
  { value: "imported", label: "Imported" },
  { value: "failed", label: "Failed" },
  { value: "deleted", label: "Deleted" },
];

function eventCategory(type: string): EventFilter {
  const t = type?.toLowerCase();
  if (t === "grabbed") return "grabbed";
  if (t.includes("import")) return "imported";
  if (t.includes("failed")) return "failed";
  if (t.includes("deleted") || t.includes("delete")) return "deleted";
  return "all";
}

function EventIcon({ type }: { type: string }) {
  const cat = eventCategory(type);
  if (cat === "grabbed") return <Download size={13} className="text-[var(--color-accent-bright)] shrink-0" />;
  if (cat === "imported") return <CheckCircle2 size={13} className="text-[var(--color-success)] shrink-0" />;
  if (cat === "failed") return <XCircle size={13} className="text-[var(--color-danger)] shrink-0" />;
  if (cat === "deleted") return <Trash2 size={13} className="text-slate-400 shrink-0" />;
  return <Clock size={13} className="text-slate-500 shrink-0" />;
}

function eventLabel(type: string) {
  const map: Record<string, string> = {
    grabbed: "Grabbed",
    downloadFolderImported: "Imported",
    downloadimported: "Imported",
    movieFileImported: "Imported",
    moviefileimported: "Imported",
    downloadFailed: "Failed",
    downloadfailed: "Failed",
    importFailed: "Import Failed",
    importfailed: "Import Failed",
    episodeFileDeleted: "Deleted",
    movieFileDeleted: "Deleted",
    seriesFolderCreated: "Folder Created",
    ignored: "Ignored",
  };
  return map[type] ?? map[type?.toLowerCase()] ?? type;
}

function eventBadgeClass(type: string) {
  const cat = eventCategory(type);
  if (cat === "grabbed") return "text-[var(--color-accent-bright)] bg-[var(--color-accent)]/15 border-[var(--color-accent)]/30";
  if (cat === "imported") return "text-[var(--color-success)] bg-[var(--color-success)]/15 border-[var(--color-success)]/30";
  if (cat === "failed") return "text-[var(--color-danger)] bg-[var(--color-danger)]/15 border-[var(--color-danger)]/30";
  return "text-slate-400 bg-white/5 border-white/10";
}

// ── Health Alert ──────────────────────────────────────────────────────────────
const HealthAlert = memo(function HealthAlert({ item, source }: { item: HealthItem; source: "sonarr" | "radarr" }) {
  const isError = item.type === "error";
  const isWarning = item.type === "warning";
  const color = isError ? "var(--color-danger)" : isWarning ? "var(--color-warning)" : "var(--color-accent-bright)";
  const Icon = isError ? AlertCircle : isWarning ? AlertTriangle : Info;
  const SIcon = source === "sonarr" ? Tv2 : Film;
  const sColor = source === "sonarr" ? "var(--color-sonarr)" : "var(--color-radarr)";

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl border"
      style={{
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      <Icon size={14} className="mt-0.5 shrink-0" style={{ color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white">{item.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <SIcon size={10} style={{ color: sColor }} />
          <span className="text-[10px] text-slate-400">{item.source}</span>
          {item.wikiUrl && (
            <a href={item.wikiUrl} target="_blank" rel="noopener noreferrer"
              className="text-[10px] text-[var(--color-accent-bright)] hover:underline">
              Wiki ↗
            </a>
          )}
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded"
        style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
        {item.type}
      </span>
    </div>
  );
});

// ── Event Row ─────────────────────────────────────────────────────────────────
const EventRow = memo(function EventRow({ record, source }: { record: HistoryRecord; source: "sonarr" | "radarr" }) {
  const SIcon = source === "sonarr" ? Tv2 : Film;
  const sColor = source === "sonarr" ? "var(--color-sonarr)" : "var(--color-radarr)";
  const detailHref =
    source === "sonarr" && record.seriesId ? `/sonarr/${record.seriesId}`
    : source === "radarr" && record.movieId ? `/radarr/${record.movieId}`
    : null;
  const note = record.data?.reason ?? record.data?.message ?? record.indexer ?? record.downloadClient ?? "";

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]/50 last:border-0 hover:bg-white/2 transition-colors">
      <SIcon size={12} className="shrink-0" style={{ color: sColor }} />
      <EventIcon type={record.eventType} />
      <div className="flex-1 min-w-0">
        {detailHref ? (
          <Link href={detailHref} className="text-sm text-slate-200 hover:text-white truncate block transition-colors">
            {record.sourceTitle}
          </Link>
        ) : (
          <p className="text-sm text-slate-200 truncate">{record.sourceTitle}</p>
        )}
        {note && <p className="text-[10px] text-slate-500 truncate mt-0.5" title={note}>{note}</p>}
      </div>
      <span className={cn(
        "text-[10px] font-semibold px-2 py-0.5 rounded-md border hidden sm:inline whitespace-nowrap",
        eventBadgeClass(record.eventType)
      )}>
        {eventLabel(record.eventType)}
      </span>
      {record.quality && (
        <span className="text-[11px] text-slate-400 font-mono w-16 text-right hidden md:block shrink-0">
          {record.quality.quality.name}
        </span>
      )}
      <span className="text-[11px] text-slate-500 text-right shrink-0 w-28 hidden lg:block">
        {formatDateTime(record.date)}
      </span>
    </div>
  );
});

// ── Page ──────────────────────────────────────────────────────────────────────
const POLL_MS = 30_000;
const PAGE_SIZE = 50;

export default function ActivityPage() {
  const [serviceFilter, setServiceFilter] = useState<"all" | "sonarr" | "radarr">("all");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const { sonarr, radarr } = useSettings();
  const { sonarrApi, radarrApi } = useApi();

  const { data: sonarrHistory, isLoading: sonarrLoading, refetch: refetchSonarr, isFetching: sonarrFetching } =
    useQuery<HistoryResponse>({
      queryKey: ["activity-sonarr-history"],
      queryFn: () => sonarrApi.get("/history?pageSize=100&sortDirection=descending&sortKey=date").then((r) => r.data),
      enabled: sonarr.enabled && !!sonarr.apiKey,
      refetchInterval: POLL_MS,
    });

  const { data: radarrHistory, isLoading: radarrLoading, refetch: refetchRadarr, isFetching: radarrFetching } =
    useQuery<HistoryResponse>({
      queryKey: ["activity-radarr-history"],
      queryFn: () => radarrApi.get("/history?pageSize=100&sortDirection=descending&sortKey=date").then((r) => r.data),
      enabled: radarr.enabled && !!radarr.apiKey,
      refetchInterval: POLL_MS,
    });

  const { data: sonarrHealth } = useQuery<HealthItem[]>({
    queryKey: ["activity-sonarr-health"],
    queryFn: () => sonarrApi.get("/health").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
    refetchInterval: 60_000,
  });

  const { data: radarrHealth } = useQuery<HealthItem[]>({
    queryKey: ["activity-radarr-health"],
    queryFn: () => radarrApi.get("/health").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
    refetchInterval: 60_000,
  });

  const healthAlerts = [
    ...(sonarrHealth ?? []).filter((h) => h.type !== "ok").map((h) => ({ ...h, source: "sonarr" as const })),
    ...(radarrHealth ?? []).filter((h) => h.type !== "ok").map((h) => ({ ...h, source: "radarr" as const })),
  ].sort((a, b) => {
    const order: Record<string, number> = { error: 0, warning: 1, notice: 2 };
    return (order[a.type] ?? 3) - (order[b.type] ?? 3);
  });

  const sonarrItems = (sonarrHistory?.records ?? []).map((r) => ({ ...r, source: "sonarr" as const }));
  const radarrItems = (radarrHistory?.records ?? []).map((r) => ({ ...r, source: "radarr" as const }));
  const merged = [...sonarrItems, ...radarrItems]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filtered = merged.filter((r) => {
    if (serviceFilter !== "all" && r.source !== serviceFilter) return false;
    if (eventFilter !== "all" && eventCategory(r.eventType) !== eventFilter) return false;
    return true;
  });

  const isLoading = sonarrLoading || radarrLoading;
  const isFetching = sonarrFetching || radarrFetching;
  const errorCount = healthAlerts.filter((h) => h.type === "error").length;
  const warningCount = healthAlerts.filter((h) => h.type === "warning").length;

  // Reset visible count whenever filters change
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [serviceFilter, eventFilter]);

  const visibleItems = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Activity" subtitle="Live event log, health alerts, and download history" />

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-4">

        {/* Health Alerts */}
        {healthAlerts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={13} className={errorCount > 0 ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"} />
              <span className="text-xs font-semibold text-white uppercase tracking-wider">Health Alerts</span>
              {errorCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--color-danger)]/20 text-[var(--color-danger)] font-bold border border-[var(--color-danger)]/30">
                  {errorCount} error{errorCount !== 1 ? "s" : ""}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--color-warning)]/20 text-[var(--color-warning)] font-bold border border-[var(--color-warning)]/30">
                  {warningCount} warning{warningCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {healthAlerts.map((h, i) => <HealthAlert key={i} item={h} source={h.source} />)}
          </motion.div>
        )}

        {healthAlerts.length === 0 && !isLoading && (sonarr.enabled || radarr.enabled) && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success)]/8 text-sm">
            <Bell size={13} className="text-[var(--color-success)]" />
            <span className="text-[var(--color-success)] font-semibold">All systems healthy</span>
          </div>
        )}

        {/* Event Log */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-bg-base)]/40">
            <Filter size={12} className="text-slate-400" />
            {/* Service filter */}
            <div className="flex items-center gap-0.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-0.5">
              {(["all", "sonarr", "radarr"] as const).map((svc) => {
                const Icon = svc === "sonarr" ? Tv2 : svc === "radarr" ? Film : null;
                const svcColor = svc === "sonarr" ? "var(--color-sonarr)" : svc === "radarr" ? "var(--color-radarr)" : undefined;
                return (
                  <button key={svc} onClick={() => setServiceFilter(svc)}
                    className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                      serviceFilter === svc ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
                    {Icon && <Icon size={9} style={serviceFilter === svc && svcColor ? { color: svcColor } : {}} />}
                    {svc === "all" ? "All" : svc.charAt(0).toUpperCase() + svc.slice(1)}
                  </button>
                );
              })}
            </div>
            {/* Event filter */}
            <div className="flex items-center gap-0.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-0.5 flex-wrap">
              {FILTER_OPTIONS.map(({ value, label }) => (
                <button key={value} onClick={() => setEventFilter(value)}
                  className={cn("px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all",
                    eventFilter === value ? "bg-white/10 text-white" : "text-slate-400 hover:text-white")}>
                  {label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-slate-400">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</span>
              <button onClick={() => { refetchSonarr(); refetchRadarr(); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors" title="Refresh">
                {isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-base)]/20">
            <div className="w-3" /><div className="w-3" />
            <div className="flex-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Title</div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:block w-20">Event</div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden md:block w-16 text-right">Quality</div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden lg:block w-28 text-right">Date</div>
          </div>

          {isLoading && (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 shimmer rounded-lg" />)}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BellOff size={28} className="text-slate-500 mb-2" />
              <p className="text-sm text-slate-400">No events match the current filter</p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div>
              {visibleItems.map((record) => (
                <EventRow key={`${record.source}-${record.id}`} record={record} source={record.source} />
              ))}
            </div>
          )}

          {!isLoading && hasMore && (
            <div className="flex justify-center px-4 py-3 border-t border-[var(--color-border)]">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-[var(--color-border)] text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                Load More
                <span className="text-slate-500 font-normal">
                  ({filtered.length - visibleCount} remaining)
                </span>
              </button>
            </div>
          )}

          {!isLoading && merged.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-bg-base)]/20 flex items-center gap-4 text-[11px] text-slate-500">
              <span><span className="text-white font-semibold">{merged.filter((r) => r.eventType === "grabbed").length}</span> grabbed</span>
              <span><span className="text-[var(--color-success)] font-semibold">{merged.filter((r) => eventCategory(r.eventType) === "imported").length}</span> imported</span>
              <span><span className="text-[var(--color-danger)] font-semibold">{merged.filter((r) => eventCategory(r.eventType) === "failed").length}</span> failed</span>
              <span className="ml-auto">Auto-refreshes every 30s</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
