"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Search, Download, ChevronUp, ChevronDown,
  Loader2, AlertCircle, CheckCircle2,
  Award, Globe, Filter, RefreshCw, ShieldAlert,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { formatBytes, cn } from "@/lib/utils";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Release {
  guid: string;
  title: string;
  quality?: { quality: { name: string } };
  size: number;
  indexer: string;
  indexerId: number;
  publishDate: string;
  seeders?: number;
  leechers?: number;
  protocol: "torrent" | "usenet";
  approved: boolean;
  rejections?: string[];
  age?: number;
  customFormats?: { id: number; name: string; score: number }[];
  customFormatScore?: number;
  languages?: { id: number; name: string }[];
  revision?: { version: number; real: number };
  releaseGroup?: string;
}

type SortKey = "title" | "quality" | "size" | "seeders" | "age" | "cfScore";
type SortDir = "asc" | "desc";

interface Props {
  service: "sonarr" | "radarr";
  /** episodeId for Sonarr, movieId for Radarr */
  mediaId: number;
  title: string;
  onClose: () => void;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function qualityLabel(r: Release) {
  return r.quality?.quality?.name ?? "Unknown";
}

function cfColor(score: number) {
  if (score >= 1500) return "var(--color-success)";
  if (score >= 0) return "var(--color-warning)";
  return "var(--color-danger)";
}

export function ManualSearchModal({ service, mediaId, title, onClose }: Props) {
  const { sonarrApi, radarrApi } = useApi();
  const api = service === "sonarr" ? sonarrApi : radarrApi;
  const accentColor = service === "sonarr" ? "var(--color-sonarr)" : "var(--color-radarr)";
  const queryParam = service === "sonarr" ? `episodeId=${mediaId}` : `movieId=${mediaId}`;

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "cfScore", dir: "desc" });
  const [grabbedGuids, setGrabbedGuids] = useState<Set<string>>(new Set());
  const [releaseGroupFilter, setReleaseGroupFilter] = useState<string>("all");
  const [showRejected, setShowRejected] = useState(true);
  const [rowZoom, setRowZoom] = useState(1.0);

  const { data: releases, isLoading, error, refetch, isFetching } = useQuery<Release[]>({
    queryKey: [`${service}-releases`, mediaId],
    queryFn: () => api.get(`/release?${queryParam}`).then((r) => r.data),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const grab = useMutation({
    mutationFn: (r: Release) => api.post("/release", { guid: r.guid, indexerId: r.indexerId }),
    onSuccess: (_, r) => setGrabbedGuids((prev) => new Set(prev).add(r.guid)),
  });

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const releaseGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const r of releases ?? []) {
      if (r.releaseGroup) groups.add(r.releaseGroup);
    }
    return Array.from(groups).sort();
  }, [releases]);

  const filtered = useMemo(() => {
    return (releases ?? []).filter((r) => {
      if (releaseGroupFilter !== "all" && r.releaseGroup !== releaseGroupFilter) return false;
      if (!showRejected && !r.approved) return false;
      return true;
    });
  }, [releases, releaseGroupFilter, showRejected]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "title":   return a.title.localeCompare(b.title) * dir;
        case "quality": return qualityLabel(a).localeCompare(qualityLabel(b)) * dir;
        case "size":    return (a.size - b.size) * dir;
        case "seeders": return ((a.seeders ?? 0) - (b.seeders ?? 0)) * dir;
        case "age":     return ((a.age ?? 0) - (b.age ?? 0)) * dir;
        case "cfScore": return ((a.customFormatScore ?? 0) - (b.customFormatScore ?? 0)) * dir;
        default:        return 0;
      }
    });
  }, [filtered, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sort.key !== k) return <ChevronDown size={10} className="opacity-30" />;
    return sort.dir === "asc"
      ? <ChevronUp size={10} style={{ color: accentColor }} />
      : <ChevronDown size={10} style={{ color: accentColor }} />;
  }

  const totalCount = releases?.length ?? 0;
  const approvedCount = filtered.filter((r) => r.approved).length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full max-w-[95vw] max-h-[90vh] flex flex-col rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl overflow-hidden"
        >
          {/* â”€â”€ Header â”€â”€ */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)] shrink-0">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `color-mix(in srgb, ${accentColor} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)` }}
            >
              <Search size={15} style={{ color: accentColor }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white">Manual Release Search</h2>
              <p className="text-xs text-slate-300 truncate">{title}</p>
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="ml-auto p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              title="Re-search indexers"
            >
              <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* â”€â”€ Filter bar â”€â”€ */}
          {!isLoading && !error && totalCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-5 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-base)]/40 shrink-0">
              {/* Release group filter */}
              {releaseGroups.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Filter size={11} className="text-slate-400" />
                  <select
                    value={releaseGroupFilter}
                    onChange={(e) => setReleaseGroupFilter(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white text-[11px] outline-none transition-colors"
                  >
                    <option value="all">All release groups</option>
                    {releaseGroups.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Show/hide rejected */}
              <button
                onClick={() => setShowRejected((v) => !v)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all",
                  showRejected
                    ? "text-slate-300 border-[var(--color-border)] hover:text-white"
                    : ""
                )}
                style={!showRejected ? { color: accentColor, borderColor: `color-mix(in srgb, ${accentColor} 30%, transparent)`, background: `color-mix(in srgb, ${accentColor} 10%, transparent)` } : undefined}
              >
                {showRejected ? "Hide rejected" : "Show rejected"}
              </button>

              <span className="ml-auto text-[11px] text-slate-300">
                {sorted.length} of {totalCount} releases
              </span>

              {/* Row font size */}
              <div className="flex items-center gap-0.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-1 py-0.5">
                {([0.8, 0.9, 1.0, 1.15] as const).map((z, i) => (
                  <button
                    key={z}
                    onClick={() => setRowZoom(z)}
                    title={`Row size ${["XS","S","M","L"][i]}`}
                    className={cn("px-1.5 py-0.5 rounded transition-colors font-bold leading-none", rowZoom === z ? "text-white" : "text-slate-400 hover:text-white")}
                    style={{ fontSize: `${10 + i * 2}px`, background: rowZoom === z ? `color-mix(in srgb, ${accentColor} 30%, transparent)` : undefined }}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* â”€â”€ Body â”€â”€ */}
          <div className="flex-1 overflow-auto">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={30} className="text-slate-400 animate-spin" />
                <p className="text-sm text-slate-300">Searching indexers...</p>
              </div>
            )}

            {error && !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
                <AlertCircle size={30} className="text-[var(--color-danger)]" />
                <p className="text-sm text-white font-semibold">Search failed</p>
                <p className="text-xs text-slate-300">Could not retrieve releases from indexers</p>
              </div>
            )}

            {!isLoading && !error && sorted.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <Search size={30} className="text-slate-400" />
                <p className="text-sm text-white font-semibold">No releases found</p>
                <p className="text-xs text-slate-300">
                  {totalCount > 0 ? "Try adjusting the filters above" : "No results from any indexer"}
                </p>
              </div>
            )}

            {!isLoading && !error && sorted.length > 0 && (
              <table className="w-full text-xs" style={{ zoom: rowZoom }}>
                <thead className="sticky top-0 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-right w-20">
                      <span className="text-slate-200 font-semibold uppercase tracking-wider">Grab</span>
                    </th>
                    <th className="px-4 py-2.5 text-left">
                      <button onClick={() => toggleSort("title")} className="flex items-center gap-1 text-slate-200 hover:text-white transition-colors font-semibold uppercase tracking-wider">
                        Title <SortIcon k="title" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-left">
                      <button onClick={() => toggleSort("quality")} className="flex items-center gap-1 text-slate-200 hover:text-white transition-colors font-semibold uppercase tracking-wider">
                        Quality <SortIcon k="quality" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-right">
                      <button onClick={() => toggleSort("cfScore")} className="flex items-center gap-1 ml-auto text-slate-200 hover:text-white transition-colors font-semibold uppercase tracking-wider">
                        CF <SortIcon k="cfScore" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-left">
                      <span className="text-slate-200 font-semibold uppercase tracking-wider">Group</span>
                    </th>
                    <th className="px-3 py-2.5 text-left">
                      <span className="text-slate-200 font-semibold uppercase tracking-wider">Lang</span>
                    </th>
                    <th className="px-3 py-2.5 text-right">
                      <button onClick={() => toggleSort("size")} className="flex items-center gap-1 ml-auto text-slate-200 hover:text-white transition-colors font-semibold uppercase tracking-wider">
                        Size <SortIcon k="size" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-left">
                      <span className="text-slate-200 font-semibold uppercase tracking-wider">Indexer</span>
                    </th>
                    <th className="px-3 py-2.5 text-right">
                      <button onClick={() => toggleSort("seeders")} className="flex items-center gap-1 ml-auto text-slate-200 hover:text-white transition-colors font-semibold uppercase tracking-wider">
                        Peers <SortIcon k="seeders" />
                      </button>
                    </th>
                    <th className="px-3 py-2.5 text-right">
                      <button onClick={() => toggleSort("age")} className="flex items-center gap-1 ml-auto text-slate-200 hover:text-white transition-colors font-semibold uppercase tracking-wider">
                        Age <SortIcon k="age" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => {
                    const isGrabbed = grabbedGuids.has(r.guid);
                    const isGrabbing = grab.isPending && grab.variables?.guid === r.guid;
                    const hasRejections = !r.approved && (r.rejections?.length ?? 0) > 0;

                    return (
                      <tr
                        key={r.guid}
                        className={cn(
                          "border-b border-[var(--color-border)]/40 hover:bg-white/3 transition-colors",
                          isGrabbed && "bg-[var(--color-success)]/5",
                          hasRejections && "opacity-75 border-l-2 border-[var(--color-warning)]/40"
                        )}
                      >
                        {/* Grab */}
                        <td className="px-4 py-2.5 text-right">
                          {isGrabbed ? (
                            <span className="flex items-center justify-end gap-1 text-[var(--color-success)] text-[11px] font-semibold whitespace-nowrap">
                              <CheckCircle2 size={11} /> Grabbed
                            </span>
                          ) : hasRejections ? (
                            <button
                              onClick={() => grab.mutate(r)}
                              disabled={isGrabbing || grab.isPending}
                              title={`Force grab despite rejections:\n${r.rejections?.join("\n")}`}
                              className="flex items-center justify-end gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ml-auto disabled:opacity-50"
                              style={{
                                background: "color-mix(in srgb, var(--color-warning) 15%, transparent)",
                                color: "var(--color-warning)",
                                border: "1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)",
                              }}
                            >
                              {isGrabbing ? <Loader2 size={10} className="animate-spin" /> : <ShieldAlert size={10} />}
                              Force
                            </button>
                          ) : (
                            <button
                              onClick={() => grab.mutate(r)}
                              disabled={isGrabbing || grab.isPending}
                              className="flex items-center justify-end gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ml-auto disabled:opacity-50"
                              style={{
                                background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
                                color: accentColor,
                                border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
                              }}
                            >
                              {isGrabbing ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                              Grab
                            </button>
                          )}
                        </td>

                        {/* Title + rejections */}
                        <td className="px-4 py-2.5 max-w-[420px]">
                          <p className="text-white truncate font-medium text-[11px]" title={r.title}>
                            {r.title}
                          </p>
                          {hasRejections && (
                            <p className="text-[10px] text-[var(--color-warning)] mt-0.5 truncate" title={r.rejections?.join(", ")}>
                              âš  {r.rejections?.[0]}
                            </p>
                          )}
                        </td>

                        {/* Quality */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-bg-base)] text-slate-300">
                              {qualityLabel(r)}
                            </span>
                            {r.revision && r.revision.version > 1 && (
                              <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/25">PROPER</span>
                            )}
                            {r.revision && r.revision.real > 0 && (
                              <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-[var(--color-warning)]/15 text-[var(--color-warning)] border border-[var(--color-warning)]/25">REAL</span>
                            )}
                          </div>
                        </td>

                        {/* CF Score */}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {r.customFormatScore != null ? (
                            <div className="relative group/cf inline-flex items-center justify-end">
                              <span
                                className="flex items-center gap-0.5 text-[11px] font-bold font-mono cursor-help"
                                style={{ color: cfColor(r.customFormatScore) }}
                              >
                                <Award size={9} />
                                {r.customFormatScore >= 0 ? "+" : ""}{r.customFormatScore}
                              </span>
                              {r.customFormats && r.customFormats.length > 0 && (
                                <div className="absolute bottom-full right-0 mb-2 w-60 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl z-50 p-2.5 hidden group-hover/cf:block pointer-events-none">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-0.5">Custom Formats</p>
                                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                                    {r.customFormats.map((cf) => (
                                      <div key={cf.id} className="flex items-center justify-between gap-2 px-1 py-0.5 rounded">
                                        <span className="text-[10px] text-slate-200 truncate">{cf.name}</span>
                                        <span className="text-[10px] font-bold font-mono shrink-0" style={{ color: cf.score >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                                          {cf.score >= 0 ? "+" : ""}{cf.score}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-2 pt-1.5 border-t border-[var(--color-border)]/50 flex items-center justify-between px-0.5">
                                    <span className="text-[9px] text-slate-400">Total</span>
                                    <span className="text-[10px] font-bold font-mono" style={{ color: cfColor(r.customFormatScore) }}>
                                      {r.customFormatScore >= 0 ? "+" : ""}{r.customFormatScore}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Release group */}
                        <td className="px-3 py-2.5">
                          {r.releaseGroup ? (
                            <button
                              onClick={() => setReleaseGroupFilter(releaseGroupFilter === r.releaseGroup ? "all" : r.releaseGroup!)}
                              className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors",
                                releaseGroupFilter === r.releaseGroup
                                  ? ""
                                  : "text-slate-200 border-slate-500/40 bg-slate-700/20"
                              )}
                              style={
                                releaseGroupFilter === r.releaseGroup
                                  ? { color: accentColor, borderColor: `color-mix(in srgb, ${accentColor} 30%, transparent)`, background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }
                                  : undefined
                              }
                              title="Click to filter by this group"
                            >
                              {r.releaseGroup}
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Languages */}
                        <td className="px-3 py-2.5">
                          {r.languages && r.languages.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Globe size={9} className="text-slate-400 shrink-0" />
                              <span className="text-[10px] text-slate-300 truncate max-w-[110px]">
                                {r.languages.slice(0, 2).map((l) => l.name).join(", ")}
                                {r.languages.length > 2 ? " +" + (r.languages.length - 2) : ""}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Size */}
                        <td className="px-3 py-2.5 text-right text-slate-200 font-mono whitespace-nowrap">
                          {formatBytes(r.size)}
                        </td>

                        {/* Indexer */}
                        <td className="px-3 py-2.5 text-slate-200 max-w-[160px]">
                          <span className="truncate block" title={r.indexer}>{r.indexer}</span>
                        </td>

                        {/* Seeders */}
                        <td className="px-3 py-2.5 text-right">
                          {r.protocol === "torrent" ? (
                            <span className={cn("font-mono text-[11px]", (r.seeders ?? 0) > 0 ? "text-[var(--color-success)]" : "text-slate-300")}>
                              {r.seeders ?? 0}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[10px]">NZB</span>
                          )}
                        </td>

                        {/* Age */}
                        <td className="px-3 py-2.5 text-right text-slate-200 font-mono whitespace-nowrap">
                          {r.age != null ? `${r.age}d` : "—"}
                        </td>

                        {/* Grab */}
                        <td className="px-4 py-2.5 text-right">
                          {isGrabbed ? (
                            <span className="flex items-center justify-end gap-1 text-[var(--color-success)] text-[11px] font-semibold whitespace-nowrap">
                              <CheckCircle2 size={11} /> Grabbed
                            </span>
                          ) : hasRejections ? (
                            <button
                              onClick={() => grab.mutate(r)}
                              disabled={isGrabbing || grab.isPending}
                              title={`Force grab despite rejections:\n${r.rejections?.join("\n")}`}
                              className="flex items-center justify-end gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ml-auto disabled:opacity-50"
                              style={{
                                background: "color-mix(in srgb, var(--color-warning) 15%, transparent)",
                                color: "var(--color-warning)",
                                border: "1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)",
                              }}
                            >
                              {isGrabbing ? <Loader2 size={10} className="animate-spin" /> : <ShieldAlert size={10} />}
                              Force
                            </button>
                          ) : (
                            <button
                              onClick={() => grab.mutate(r)}
                              disabled={isGrabbing || grab.isPending}
                              className="flex items-center justify-end gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ml-auto disabled:opacity-50"
                              style={{
                                background: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
                                color: accentColor,
                                border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
                              }}
                            >
                              {isGrabbing ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                              Grab
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* â”€â”€ Footer â”€â”€ */}
          {!isLoading && !error && totalCount > 0 && (
            <div className="px-5 py-3 border-t border-[var(--color-border)] shrink-0 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
              <span><span className="text-white font-semibold">{totalCount}</span> total releases</span>
              <span>Â·</span>
              <span><span className="text-slate-300 font-semibold">{approvedCount}</span> approved</span>
              {releaseGroups.length > 0 && (
                <>
                  <span>Â·</span>
                  <span><span className="text-slate-300 font-semibold">{releaseGroups.length}</span> release groups</span>
                </>
              )}
              <span className="ml-auto text-slate-400">Showing {sorted.length} releases</span>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
