"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldBan, Tv2, Film, Trash2, RefreshCw, ChevronLeft,
  ChevronRight, CheckSquare, Square, AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/store/settings";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

interface BlocklistRecord {
  id: number;
  sourceTitle: string;
  date: string;
  protocol?: string;
  indexer?: string;
  message?: string;
  quality?: { quality: { name: string } };
  // Sonarr
  seriesId?: number;
  episodeIds?: number[];
  series?: { id: number; title: string };
  episodes?: { id: number; seasonNumber: number; episodeNumber: number; title: string }[];
  // Radarr
  movieId?: number;
  movie?: { id: number; title: string; year: number };
}

interface BlocklistResponse {
  records: BlocklistRecord[];
  totalRecords: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 25;

export default function BlocklistPage() {
  const [tab, setTab] = useState<"sonarr" | "radarr">("sonarr");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { sonarr, radarr } = useSettings();
  const { sonarrApi, radarrApi } = useApi();
  const qc = useQueryClient();

  const api = tab === "sonarr" ? sonarrApi : radarrApi;
  const enabled = tab === "sonarr" ? (sonarr.enabled && !!sonarr.apiKey) : (radarr.enabled && !!radarr.apiKey);

  const { data, isLoading } = useQuery<BlocklistResponse>({
    queryKey: ["blocklist", tab, page],
    queryFn: () =>
      api
        .get(`/blocklist?page=${page}&pageSize=${PAGE_SIZE}&sortKey=date&sortDirection=descending`)
        .then((r) => r.data),
    enabled,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/blocklist/${id}`),
    onSuccess: () => {
      toast.success("Removed from blocklist");
      qc.invalidateQueries({ queryKey: ["blocklist", tab] });
      setSelected((prev) => { const n = new Set(prev); n.delete(deleteMutation.variables as number); return n; });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) =>
      api.delete("/blocklist/bulk", { data: { ids } }),
    onSuccess: (_, ids) => {
      toast.success(`Removed ${ids.length} from blocklist`);
      qc.invalidateQueries({ queryKey: ["blocklist", tab] });
      setSelected(new Set());
    },
  });

  const records = data?.records ?? [];
  const total = data?.totalRecords ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (selected.size === records.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(records.map((r) => r.id)));
    }
  }

  const sonarrEnabled = sonarr.enabled && !!sonarr.apiKey;
  const radarrEnabled = radarr.enabled && !!radarr.apiKey;

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Blocklist"
        subtitle={total > 0 ? `${total} blocked release${total !== 1 ? "s" : ""}` : "Releases blocked from being grabbed"}
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] w-fit">
          {(["sonarr", "radarr"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); setSelected(new Set()); }}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all",
                tab === t ? "text-white" : "text-[var(--color-text-secondary)] hover:text-white"
              )}
              style={tab === t ? {
                background: `color-mix(in srgb, var(--color-${t}) 20%, transparent)`,
                color: `var(--color-${t})`,
                border: `1px solid color-mix(in srgb, var(--color-${t}) 35%, transparent)`,
              } : undefined}
            >
              {t === "sonarr" ? <Tv2 size={14} /> : <Film size={14} />}
              {t === "sonarr" ? "Sonarr" : "Radarr"}
            </button>
          ))}
        </div>

        {/* Not configured */}
        {!enabled && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <ShieldBan size={40} className="text-[var(--color-text-muted)] opacity-40" />
            <p className="text-[var(--color-text-secondary)]">
              {tab === "sonarr" ? "Sonarr" : "Radarr"} is not configured
            </p>
          </div>
        )}

        {/* Toolbar */}
        {enabled && records.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-white transition-colors">
                {selected.size === records.length ? <CheckSquare size={14} /> : <Square size={14} />}
                {selected.size === records.length ? "Deselect all" : "Select all"}
              </button>
              {selected.size > 0 && (
                <button
                  onClick={() => bulkDeleteMutation.mutate([...selected])}
                  disabled={bulkDeleteMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-all disabled:opacity-50"
                >
                  {bulkDeleteMutation.isPending ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  Remove {selected.size} selected
                </button>
              )}
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">
              {total} total · Page {page}/{totalPages}
            </span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 shimmer rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && enabled && records.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <ShieldBan size={40} className="opacity-20" />
            <p className="text-[var(--color-text-secondary)] text-sm">Blocklist is empty</p>
            <p className="text-xs text-[var(--color-text-muted)]">Releases are added here when you blocklist them from the queue</p>
          </div>
        )}

        {/* Records */}
        {!isLoading && records.length > 0 && (
          <div className="space-y-2">
            {records.map((record, idx) => {
              const isSelected = selected.has(record.id);
              const mediaTitle = record.series?.title ?? record.movie?.title ?? "Unknown";
              const mediaYear = record.movie?.year;
              const mediaHref = record.seriesId
                ? `/sonarr/${record.seriesId}`
                : record.movieId
                ? `/radarr/${record.movieId}`
                : null;

              const episodeInfo = record.episodes && record.episodes.length > 0
                ? record.episodes.map((e) => `S${String(e.seasonNumber).padStart(2, "0")}E${String(e.episodeNumber).padStart(2, "0")}`).join(", ")
                : null;

              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors group",
                    isSelected
                      ? "bg-[var(--color-danger)]/8 border-[var(--color-danger)]/20"
                      : "bg-[var(--color-bg-card)] border-[var(--color-border)] hover:border-[var(--color-border-bright)]"
                  )}
                >
                  {/* Checkbox */}
                  <button onClick={() => toggleSelect(record.id)} className="mt-0.5 shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors">
                    {isSelected ? <CheckSquare size={14} className="text-[var(--color-danger)]" /> : <Square size={14} />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Source title */}
                    <p className="text-sm text-white font-medium truncate" title={record.sourceTitle}>
                      {record.sourceTitle}
                    </p>

                    {/* Media + episode */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {mediaHref ? (
                        <Link href={mediaHref} className="text-[var(--color-text-secondary)] hover:text-white transition-colors font-medium">
                          {mediaTitle}{mediaYear ? ` (${mediaYear})` : ""}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-text-secondary)]">{mediaTitle}</span>
                      )}
                      {episodeInfo && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-sonarr)]/10 text-[var(--color-sonarr)] border border-[var(--color-sonarr)]/20">
                          {episodeInfo}
                        </span>
                      )}
                      {record.quality?.quality?.name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-base)] text-slate-300 border border-[var(--color-border)]">
                          {record.quality.quality.name}
                        </span>
                      )}
                      {record.protocol && (
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                          {record.protocol.toUpperCase()}
                        </span>
                      )}
                      {record.indexer && (
                        <span className="text-[10px] text-[var(--color-text-muted)]">{record.indexer}</span>
                      )}
                    </div>

                    {/* Message */}
                    {record.message && (
                      <div className="flex items-start gap-1 text-[10px] text-[var(--color-warning)]">
                        <AlertTriangle size={9} className="mt-0.5 shrink-0" />
                        <span className="truncate">{record.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Date + delete */}
                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {new Date(record.date).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => deleteMutation.mutate(record.id)}
                      disabled={deleteMutation.isPending && deleteMutation.variables === record.id}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-[var(--color-danger)]/15 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all"
                      title="Remove from blocklist"
                    >
                      {deleteMutation.isPending && deleteMutation.variables === record.id
                        ? <RefreshCw size={13} className="animate-spin" />
                        : <Trash2 size={13} />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] disabled:opacity-30 transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm text-[var(--color-text-secondary)]">
              Page <span className="text-white font-semibold">{page}</span> of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] disabled:opacity-30 transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
