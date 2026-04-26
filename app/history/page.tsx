"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Download, CheckCircle2, XCircle, Film, Tv2, Clock,
  ChevronLeft, ChevronRight, Filter, Trash2, RotateCcw, RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/store/settings";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

interface HistoryRecord {
  id: number;
  sourceTitle: string;
  eventType: string;
  date: string;
  quality?: { quality: { name: string } };
  downloadClient?: string;
  indexer?: string;
  data?: { reason?: string; message?: string };
  // Sonarr
  seriesId?: number;
  episodeId?: number;
  series?: { title: string };
  episode?: { seasonNumber: number; episodeNumber: number; title: string };
  // Radarr
  movieId?: number;
  movie?: { title: string; year: number };
}

interface HistoryResponse {
  records: HistoryRecord[];
  totalRecords: number;
}

const EVENT_LABELS: Record<string, string> = {
  grabbed: "Grabbed",
  downloadFolderImported: "Imported",
  downloadImported: "Imported",
  movieFileImported: "Imported",
  downloadFailed: "Failed",
  deletedFiles: "Deleted",
  episodeFileDeleted: "Deleted",
  movieFileDeleted: "Deleted",
  ignored: "Ignored",
};

const EVENT_COLORS: Record<string, string> = {
  grabbed: "text-[var(--color-accent-bright)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30",
  downloadFolderImported: "text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/30",
  downloadImported: "text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/30",
  movieFileImported: "text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/30",
  downloadFailed: "text-[var(--color-danger)] bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30",
  deletedFiles: "text-[var(--color-text-muted)] bg-white/5 border-white/10",
  episodeFileDeleted: "text-[var(--color-text-muted)] bg-white/5 border-white/10",
  movieFileDeleted: "text-[var(--color-text-muted)] bg-white/5 border-white/10",
};

function EventIcon({ type }: { type: string }) {
  if (type.includes("Import") || type.includes("import")) return <CheckCircle2 size={13} className="text-[var(--color-success)] shrink-0" />;
  if (type === "downloadFailed") return <XCircle size={13} className="text-[var(--color-danger)] shrink-0" />;
  if (type === "grabbed") return <Download size={13} className="text-[var(--color-accent-bright)] shrink-0" />;
  return <Clock size={13} className="text-[var(--color-text-muted)] shrink-0" />;
}

const PAGE_SIZE = 25;
type EventFilter = "all" | "grabbed" | "imported" | "failed";

function smartDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function HistoryPage() {
  const [service, setService] = useState<"sonarr" | "radarr">("sonarr");
  const [eventFilter, setEventFilter] = useState<EventFilter>("all");
  const [page, setPage] = useState(1);
  const { sonarr, radarr } = useSettings();
  const { sonarrApi, radarrApi } = useApi();
  const qc = useQueryClient();

  // Sonarr/Radarr v3 history endpoint requires eventType as integer enum:
  // 1=grabbed, 3=downloadFolderImported, 4=downloadFailed
  const eventTypeParam: Record<EventFilter, string> = {
    all: "",
    grabbed: "&eventType=1",
    imported: "&eventType=3",
    failed: "&eventType=4",
  };

  const api = service === "sonarr" ? sonarrApi : radarrApi;
  const enabled = service === "sonarr"
    ? sonarr.enabled && !!sonarr.apiKey
    : radarr.enabled && !!radarr.apiKey;

  const extraInclude = service === "sonarr"
    ? "&includeSeries=true&includeEpisode=true"
    : "&includeMovie=true";

  const retryMutation = useMutation({
    mutationFn: (id: number) => api.post(`/history/failed/${id}`),
    onSuccess: () => {
      toast.success("Marked as failed — searching for replacement…");
      qc.invalidateQueries({ queryKey: ["history", service] });
    },
    onError: () => toast.error("Failed to retry"),
  });
  const retryingId = retryMutation.isPending ? retryMutation.variables : null;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/history/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["history", service] });
    },
    onError: () => toast.error("Failed to delete history record"),
  });

  const { data, isLoading, error } = useQuery<HistoryResponse>({
    queryKey: ["history", service, eventFilter, page],
    queryFn: () =>
      api
        .get(
          `/history?pageSize=${PAGE_SIZE}&page=${page}&sortKey=date&sortDirection=descending${eventTypeParam[eventFilter]}${extraInclude}`
        )
        .then((r) => r.data),
    enabled,
    placeholderData: (prev) => prev,
  });

  const records = data?.records ?? [];
  const total = data?.totalRecords ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const color = service === "sonarr" ? "var(--color-sonarr)" : "var(--color-radarr)";

  function handleServiceChange(s: "sonarr" | "radarr") {
    setService(s);
    setPage(1);
    setEventFilter("all");
  }

  function handleFilterChange(f: EventFilter) {
    setEventFilter(f);
    setPage(1);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="History"
        subtitle={total > 0 ? `${total.toLocaleString()} records` : undefined}
      />

      {/* Sticky toolbar */}
      <div className="sticky top-[4.5rem] z-10 px-6 py-3 glass border-b border-[var(--color-border)]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Service toggle */}
          <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)]">
            {(["sonarr", "radarr"] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleServiceChange(s)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all",
                  service === s ? "text-white" : "text-[var(--color-text-secondary)] hover:text-white"
                )}
                style={service === s ? { background: s === "sonarr" ? "var(--color-sonarr)" : "var(--color-radarr)" } : undefined}
              >
                {s === "sonarr" ? <Tv2 size={11} /> : <Film size={11} />} {s}
              </button>
            ))}
          </div>

          {/* Event type filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-[var(--color-text-muted)]" />
            <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)]">
              {(["all", "grabbed", "imported", "failed"] as EventFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => handleFilterChange(f)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all",
                    eventFilter === f ? "text-white" : "text-[var(--color-text-secondary)] hover:text-white"
                  )}
                  style={eventFilter === f ? { background: color } : undefined}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Pagination summary */}
          {total > 0 && (
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">
              Page {page} of {totalPages} &middot; {total.toLocaleString()} total
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 pt-4 max-w-5xl mx-auto w-full">
        {isLoading && (
          <div className="space-y-1.5">
            {[...Array(10)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <XCircle size={36} className="text-[var(--color-danger)] mb-3" />
            <p className="text-white font-semibold">Could not load history</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Check your connection settings.</p>
          </div>
        )}

        {!isLoading && !error && records.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Clock size={36} className="text-[var(--color-text-muted)] mb-3" />
            <p className="text-white font-semibold">No history records</p>
          </div>
        )}

        {!isLoading && records.length > 0 && (
          <>
            <div className="space-y-px rounded-xl overflow-hidden border border-[var(--color-border)]">
              {records.map((r, idx) => {
                const label = EVENT_LABELS[r.eventType] ?? r.eventType;
                const pillColor = EVENT_COLORS[r.eventType] ?? "text-[var(--color-text-muted)] bg-white/5 border-white/10";
                const title = r.series?.title ?? r.movie?.title ?? r.sourceTitle;
                const sub = r.episode
                  ? `S${String(r.episode.seasonNumber).padStart(2, "0")}E${String(r.episode.episodeNumber).padStart(2, "0")} · ${r.episode.title}`
                  : r.movie
                    ? String(r.movie.year)
                    : r.sourceTitle !== title ? r.sourceTitle : undefined;
                const href = r.seriesId ? `/sonarr/${r.seriesId}` : r.movieId ? `/radarr/${r.movieId}` : null;

                return (
                  <motion.div
                    key={`${r.id}-${idx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.01 }}
                    className="flex items-center gap-3 px-4 py-3 bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] transition-colors"
                  >
                    <EventIcon type={r.eventType} />

                    <div className="flex-1 min-w-0">
                      {href ? (
                        <Link href={href} className="text-sm font-semibold text-white hover:underline truncate block" style={{ color: "inherit" }}>
                          {title}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-white truncate">{title}</p>
                      )}
                      {sub && <p className="text-xs text-[var(--color-text-muted)] truncate">{sub}</p>}
                    </div>

                    {r.quality && (
                      <span className="text-xs text-[var(--color-text-muted)] shrink-0 hidden sm:block">
                        {r.quality.quality.name}
                      </span>
                    )}

                    {r.indexer && (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[var(--color-text-muted)] hidden md:block shrink-0">
                        {r.indexer}
                      </span>
                    )}

                    <span className={cn("text-[10px] px-2 py-0.5 rounded border font-semibold shrink-0", pillColor)}>
                      {label}
                    </span>

                    <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 w-20 text-right" title={new Date(r.date).toLocaleString()}>
                      {smartDate(r.date)}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {r.eventType === "downloadFailed" && (
                        <button
                          onClick={() => retryMutation.mutate(r.id)}
                          disabled={retryMutation.isPending}
                          title="Retry — mark as failed and search again"
                          className="p-1.5 rounded-lg text-[var(--color-warning)] hover:bg-[var(--color-warning)]/10 transition-colors disabled:opacity-40"
                        >
                          {retryingId === r.id
                            ? <RefreshCw size={12} className="animate-spin" />
                            : <RotateCcw size={12} />}
                        </button>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(r.id)}
                        disabled={deleteMutation.isPending}
                        title="Delete this history record"
                        className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={13} /> Prev
              </button>

              {/* Page numbers */}
              <div className="flex gap-1">
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let p: number;
                  if (totalPages <= 7) p = i + 1;
                  else if (page <= 4) p = i + 1;
                  else if (page >= totalPages - 3) p = totalPages - 6 + i;
                  else p = page - 3 + i;
                  return p;
                }).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-semibold transition-colors",
                      p === page ? "text-white" : "text-[var(--color-text-muted)] hover:text-white hover:bg-white/5"
                    )}
                    style={p === page ? { background: color } : undefined}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
