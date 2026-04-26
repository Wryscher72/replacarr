"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
// Link kept for the "Back to Library" link in the page body
import {
  Film, Layers, CheckCircle2, Clock, XCircle,
  HardDrive, Search, X, ArrowLeft, Eye, EyeOff, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/store/settings";
import { useApi } from "@/hooks/useApi";
import { Header } from "@/components/layout/Header";
import { formatBytes, formatRuntime, cn } from "@/lib/utils";
import { MovieDetailModal } from "@/components/MovieDetailModal";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CollectionMovie {
  id: number;
  title: string;
  year: number;
  monitored: boolean;
  hasFile: boolean;
  sizeOnDisk: number;
  runtime: number;
  images: { coverType: string; remoteUrl: string }[];
  customFormatScore?: number;
  collection?: { title: string; tmdbId: number };
}

interface CollectionGroup {
  title: string;
  tmdbId: number;
  radarrId?: number;
  monitored?: boolean;
  movies: CollectionMovie[];
  downloaded: number;
  totalSize: number;
}

interface RadarrCollection {
  id: number;
  title: string;
  tmdbId: number;
  monitored: boolean;
  qualityProfileId: number;
}

// ─── CollectionModal ───────────────────────────────────────────────────────────

function CollectionModal({
  group,
  rc,
  onClose,
  onToggleMonitor,
  onSearchMissing,
  monitorPending,
  searchPending,
}: {
  group: CollectionGroup;
  rc?: RadarrCollection;
  onClose: () => void;
  onToggleMonitor?: () => void;
  onSearchMissing?: () => void;
  monitorPending?: boolean;
  searchPending?: boolean;
}) {
  const allDownloaded = group.downloaded === group.movies.length;
  const missingCount = group.movies.filter((m) => !m.hasFile && m.monitored).length;
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.2 }}
        className="relative z-10 w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[var(--color-radarr)]/15">
            <Layers size={18} className="text-[var(--color-radarr)]" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white truncate">{group.title}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className={cn("text-xs font-medium", allDownloaded ? "text-[var(--color-success)]" : "text-[var(--color-text-secondary)]")}>
                {group.downloaded} / {group.movies.length} downloaded
              </span>
              {group.totalSize > 0 && (
                <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                  <HardDrive size={10} /> {formatBytes(group.totalSize)}
                </span>
              )}
              {missingCount > 0 && (
                <span className="text-xs text-[var(--color-warning)]">{missingCount} missing</span>
              )}
            </div>
          </div>

          {/* Actions */}
          {rc && (
            <div className="flex items-center gap-2 shrink-0">
              {missingCount > 0 && onSearchMissing && (
                <button
                  onClick={onSearchMissing}
                  disabled={searchPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                  style={{
                    background: "color-mix(in srgb, var(--color-radarr) 15%, transparent)",
                    color: "var(--color-radarr)",
                    border: "1px solid color-mix(in srgb, var(--color-radarr) 35%, transparent)",
                  }}
                >
                  {searchPending ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
                  Search Missing
                </button>
              )}
              {onToggleMonitor && (
                <button
                  onClick={onToggleMonitor}
                  disabled={monitorPending}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 border",
                    group.monitored
                      ? "text-white border-[var(--color-radarr)]/50 bg-[var(--color-radarr)]/15"
                      : "text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-white",
                  )}
                >
                  {monitorPending ? <RefreshCw size={12} className="animate-spin" /> : group.monitored ? <Eye size={12} /> : <EyeOff size={12} />}
                  {group.monitored ? "Monitored" : "Unmonitored"}
                </button>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Movie grid */}
        <div className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {group.movies
              .slice()
              .sort((a, b) => a.year - b.year || a.title.localeCompare(b.title))
              .map((m) => {
                const poster = m.images.find((i) => i.coverType === "poster")?.remoteUrl;
                const missing = !m.hasFile && m.monitored;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMovieId(m.id)}
                    className={cn(
                      "group relative rounded-xl border overflow-hidden bg-[var(--color-bg-base)] transition-all hover:-translate-y-1 text-left",
                      m.hasFile
                        ? "border-[var(--color-success)]/25"
                        : missing
                        ? "border-[var(--color-warning)]/30"
                        : "border-[var(--color-border)]",
                    )}
                  >
                    <div className="relative aspect-[2/3] overflow-hidden bg-[var(--color-bg-card)]">
                      {poster ? (
                        <Image
                          src={poster}
                          alt={m.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 25vw, 160px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film size={20} className="text-[var(--color-text-muted)]" />
                        </div>
                      )}
                      {/* Status badge */}
                      <div className="absolute top-1.5 right-1.5">
                        {m.hasFile ? (
                          <CheckCircle2 size={12} className="text-[var(--color-success)] drop-shadow" />
                        ) : m.monitored ? (
                          <Clock size={12} className="text-[var(--color-warning)] drop-shadow" />
                        ) : (
                          <XCircle size={12} className="text-[var(--color-text-muted)] drop-shadow" />
                        )}
                      </div>
                      {/* Missing stripe */}
                      {missing && (
                        <div
                          className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1 text-[9px] font-bold"
                          style={{ background: "color-mix(in srgb, var(--color-warning) 85%, transparent)", color: "#000" }}
                        >
                          <Clock size={8} /> MISSING
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-[11px] font-semibold text-white truncate leading-tight">{m.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {m.year}{m.runtime ? ` · ${formatRuntime(m.runtime)}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </motion.div>

      {/* Movie detail sub-modal (z-50, on top of collection modal) */}
      <AnimatePresence>
        {selectedMovieId !== null && (
          <MovieDetailModal
            movieId={selectedMovieId}
            onClose={() => setSelectedMovieId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CollectionCard ────────────────────────────────────────────────────────────

function CollectionCard({ group, onClick }: { group: CollectionGroup; onClick: () => void }) {
  const pct = group.movies.length > 0 ? Math.round((group.downloaded / group.movies.length) * 100) : 0;
  const allDownloaded = group.downloaded === group.movies.length;
  const noneDownloaded = group.downloaded === 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 px-4 py-3 rounded-xl border bg-[var(--color-bg-card)] hover:bg-[var(--color-bg-card-hover)] transition-colors text-left",
        allDownloaded
          ? "border-[var(--color-success)]/30"
          : noneDownloaded
          ? "border-[var(--color-border)]"
          : "border-[var(--color-warning)]/25",
      )}
    >
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
          allDownloaded ? "bg-[var(--color-success)]/15" : noneDownloaded ? "bg-[var(--color-bg-base)]" : "bg-[var(--color-warning)]/15",
        )}
      >
        <Layers
          size={16}
          className={allDownloaded ? "text-[var(--color-success)]" : noneDownloaded ? "text-[var(--color-text-muted)]" : "text-[var(--color-warning)]"}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{group.title}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-[var(--color-text-muted)]">
            {group.movies.length} movie{group.movies.length !== 1 ? "s" : ""}
          </span>
          <span className={cn("text-xs font-medium", allDownloaded ? "text-[var(--color-success)]" : "text-[var(--color-text-secondary)]")}>
            {group.downloaded} / {group.movies.length} downloaded
          </span>
          {group.totalSize > 0 && (
            <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
              <HardDrive size={10} /> {formatBytes(group.totalSize)}
            </span>
          )}
          {group.monitored != null && (
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full border font-medium",
                group.monitored
                  ? "text-[var(--color-radarr)] border-[var(--color-radarr)]/30 bg-[var(--color-radarr)]/10"
                  : "text-[var(--color-text-muted)] border-[var(--color-border)]",
              )}
            >
              {group.monitored ? "Monitored" : "Unmonitored"}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-24 shrink-0 hidden sm:block">
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: allDownloaded ? "var(--color-success)" : pct > 0 ? "var(--color-warning)" : "transparent",
            }}
          />
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 text-right">{pct}%</p>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function CollectionsContent() {
  const { radarr } = useSettings();
  const { radarrApi } = useApi();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const highlightTmdbId = searchParams.get("highlight") ? Number(searchParams.get("highlight")) : null;

  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<CollectionGroup | null>(null);
  const [monitoringId, setMonitoringId] = useState<number | null>(null);
  const [searchingId, setSearchingId] = useState<number | null>(null);

  const { data: movies, isLoading } = useQuery<CollectionMovie[]>({
    queryKey: ["radarr-movies-all"],
    queryFn: () => radarrApi.get("/movie").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const { data: radarrCollections } = useQuery<RadarrCollection[]>({
    queryKey: ["radarr-collections"],
    queryFn: () => radarrApi.get("/collection").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const monitorMutation = useMutation({
    mutationFn: (rc: RadarrCollection) =>
      radarrApi.put(`/collection/${rc.id}`, rc),
    onMutate: (vars) => setMonitoringId(vars.id),
    onSuccess: () => {
      toast.success("Collection updated");
      qc.invalidateQueries({ queryKey: ["radarr-collections"] });
      qc.invalidateQueries({ queryKey: ["radarr-movies-all"] });
    },
    onError: () => toast.error("Failed to update collection"),
    onSettled: () => setMonitoringId(null),
  });

  const searchMutation = useMutation({
    mutationFn: (movieIds: number[]) =>
      radarrApi.post("/command", { name: "MoviesSearch", movieIds }),
    onSuccess: () => toast.success("Search triggered for missing movies"),
    onError: () => toast.error("Failed to trigger search"),
    onSettled: () => setSearchingId(null),
  });

  const { collections, uncollected } = useMemo(() => {
    if (!movies) return { collections: [], uncollected: [] as CollectionMovie[] };
    const map = new Map<number, CollectionGroup>();
    const uncollected: CollectionMovie[] = [];

    for (const m of movies) {
      if (m.collection) {
        const { tmdbId, title } = m.collection;
        if (!map.has(tmdbId)) {
          map.set(tmdbId, { title: title ?? `Collection ${tmdbId}`, tmdbId, movies: [], downloaded: 0, totalSize: 0 });
        }
        const g = map.get(tmdbId)!;
        if (!g.title && title) g.title = title;
        g.movies.push(m);
        if (m.hasFile) { g.downloaded++; g.totalSize += m.sizeOnDisk; }
      } else {
        uncollected.push(m);
      }
    }

    if (radarrCollections) {
      for (const rc of radarrCollections) {
        const g = map.get(rc.tmdbId);
        if (g) { g.radarrId = rc.id; g.monitored = rc.monitored; }
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    return { collections: sorted, uncollected };
  }, [movies, radarrCollections]);

  // Auto-open highlighted collection (from ?highlight= param)
  useEffect(() => {
    if (highlightTmdbId && collections.length > 0) {
      const found = collections.find((c) => c.tmdbId === highlightTmdbId);
      if (found) setActiveGroup(found);
    }
  }, [highlightTmdbId, collections]);

  // Keep modal in sync when monitored state refreshes
  useEffect(() => {
    if (activeGroup) {
      const updated = collections.find((c) => c.tmdbId === activeGroup.tmdbId);
      if (updated) setActiveGroup(updated);
    }
  }, [collections]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCollections = useMemo(() => {
    if (!search.trim()) return collections;
    const q = search.toLowerCase();
    return collections.filter(
      (c) => c.title.toLowerCase().includes(q) || c.movies.some((m) => m.title.toLowerCase().includes(q)),
    );
  }, [collections, search]);

  const totalInCollections = collections.reduce((s, c) => s + c.movies.length, 0);
  const totalDownloaded = collections.reduce((s, c) => s + c.downloaded, 0);
  const totalSize = collections.reduce((s, c) => s + c.totalSize, 0);

  const activeRc = activeGroup ? radarrCollections?.find((c) => c.tmdbId === activeGroup.tmdbId) : undefined;

  const uncollectedGroup: CollectionGroup = {
    title: "No Collection",
    tmdbId: -1,
    movies: uncollected,
    downloaded: uncollected.filter((m) => m.hasFile).length,
    totalSize: uncollected.reduce((s, m) => s + (m.hasFile ? m.sizeOnDisk : 0), 0),
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Collections" subtitle="Radarr" />

      <div className="flex-1 p-5 space-y-5 max-w-7xl w-full mx-auto">

        {/* Back link */}
        <Link href="/radarr" className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-white transition-colors w-fit">
          <ArrowLeft size={13} /> Back to Library
        </Link>

        {/* Summary stats */}
        {!isLoading && movies && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Collections", value: collections.length },
              { label: "In Collections", value: totalInCollections },
              { label: "Downloaded", value: totalDownloaded },
              { label: "Total Size", value: formatBytes(totalSize) },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
                <p className="text-lg font-bold text-white mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search bar */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections or movies…"
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-white placeholder-[var(--color-text-muted)] outline-none focus:border-[var(--color-radarr)]/60 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 shimmer rounded-xl" />
            ))}
          </div>
        )}

        {/* Collections list */}
        {!isLoading && (
          <div className="space-y-2">
            {filteredCollections.length === 0 && (
              <div className="text-center py-16 text-[var(--color-text-muted)] text-sm">
                {search ? "No collections match your search." : "No collections found in Radarr."}
              </div>
            )}
            {filteredCollections.map((group) => (
              <CollectionCard key={group.tmdbId} group={group} onClick={() => setActiveGroup(group)} />
            ))}
          </div>
        )}

        {/* Uncollected movies */}
        {!isLoading && uncollected.length > 0 && !search && (
          <CollectionCard group={uncollectedGroup} onClick={() => setActiveGroup(uncollectedGroup)} />
        )}
      </div>

      {/* Collection detail modal */}
      <AnimatePresence>
        {activeGroup && (
          <CollectionModal
            group={activeGroup}
            rc={activeRc}
            onClose={() => setActiveGroup(null)}
            onToggleMonitor={
              activeRc
                ? () => monitorMutation.mutate({ ...activeRc, monitored: !activeGroup.monitored })
                : undefined
            }
            onSearchMissing={
              activeRc
                ? () => {
                    setSearchingId(activeRc.id);
                    const missingIds = activeGroup.movies
                      .filter((m) => !m.hasFile && m.monitored)
                      .map((m) => m.id);
                    if (missingIds.length > 0) {
                      searchMutation.mutate(missingIds);
                    } else {
                      toast.info("No missing monitored movies in this collection");
                      setSearchingId(null);
                    }
                  }
                : undefined
            }
            monitorPending={monitoringId === activeRc?.id}
            searchPending={searchingId === activeRc?.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RadarrCollectionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col min-h-screen">
          <div className="p-6 space-y-4">
            <div className="h-8 shimmer rounded w-1/4" />
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 shimmer rounded-xl" />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 shimmer rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <CollectionsContent />
    </Suspense>
  );
}
