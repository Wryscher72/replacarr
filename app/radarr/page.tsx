"use client";

import Link from "next/link";
import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Image from "next/image";
import {
  Film,
  Search,
  LayoutGrid,
  List,
  CheckCircle2,
  XCircle,
  Clock,
  HardDrive,
  Star,
  FolderOpen,
  Plus,
  ChevronDown,
  CheckSquare,
  Eye,
  EyeOff,
  SearchCode,
  X,
  Award,
  Settings2,
  Tag,
} from "lucide-react";
import { useSettings } from "@/store/settings";
import { useApi } from "@/hooks/useApi";
import { Header } from "@/components/layout/Header";
import { PosterSizePicker, posterGridClass } from "@/components/ui/PosterSizePicker";
import { formatBytes, formatRuntime, cn } from "@/lib/utils";
import { AddMediaModal } from "@/components/AddMediaModal";
import { MovieDetailModal } from "@/components/MovieDetailModal";

interface RadarrMovie {
  id: number;
  title: string;
  year: number;
  status: string;
  monitored: boolean;
  hasFile: boolean;
  sizeOnDisk: number;
  runtime: number;
  genres: string[];
  overview: string;
  ratings: { imdb?: { value: number }; tmdb?: { value: number } };
  digitalRelease?: string;
  physicalRelease?: string;
  inCinemas?: string;
  images: { coverType: string; remoteUrl: string }[];
  path: string;
  customFormatScore?: number;
  movieFile?: { customFormatScore?: number };
  collection?: { title: string; tmdbId: number };
}

function cfColor(score: number): string {
  if (score >= 1500) return "var(--color-success)";
  if (score >= 0) return "var(--color-warning)";
  return "var(--color-danger)";
}

function StatusBadge({ movie }: { movie: RadarrMovie }) {
  if (movie.hasFile) {
    return (
      <span className="status-pill border text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/30">
        Downloaded
      </span>
    );
  }
  if (movie.monitored) {
    return (
      <span className="status-pill border text-[var(--color-warning)] bg-[var(--color-warning)]/10 border-[var(--color-warning)]/30">
        Missing
      </span>
    );
  }
  return (
    <span className="status-pill border text-[var(--color-muted)] bg-white/5 border-white/10">
      Unmonitored
    </span>
  );
}

function MovieCard({ movie, selected, onToggle, cfScore }: { movie: RadarrMovie; selected?: boolean; onToggle?: (id: number) => void; cfScore?: number }) {
  const { library } = useSettings();
  const titleSizeClass = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg" }[library.cardFontSize] ?? "text-sm";
  const poster = movie.images.find((i) => i.coverType === "poster")?.remoteUrl;
  const imdbRating = movie.ratings?.imdb?.value;
  const missing = !movie.hasFile && movie.monitored;
  const lowCF = movie.hasFile && cfScore != null && cfScore < 0;

  return (
    <motion.div
      whileHover={{ y: onToggle ? 0 : -4, scale: onToggle ? 1 : 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onClick={onToggle ? () => onToggle(movie.id) : undefined}
      className={cn("group relative rounded-xl border bg-[var(--color-bg-card)] overflow-hidden cursor-pointer transition-all",
        selected ? "border-[var(--color-radarr)] ring-2 ring-[var(--color-radarr)]/30"
        : missing ? "border-[var(--color-warning)]/40"
        : lowCF ? "border-[var(--color-danger)]/30"
        : "border-[var(--color-border)]")}
    >
      {onToggle && (
        <div className={cn("absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
          selected ? "bg-[var(--color-radarr)] border-[var(--color-radarr)]" : "bg-black/40 border-white/50")}>
          {selected && <CheckCircle2 size={10} className="text-white" />}
        </div>
      )}
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden bg-[var(--color-bg-base)]">
        {poster ? (
          <Image
            src={poster}
            alt={movie.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={32} className="text-[var(--color-text-muted)]" />
          </div>
        )}
        {/* Missing overlay */}
        {missing && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1.5 text-[10px] font-bold" style={{ background: "color-mix(in srgb, var(--color-warning) 85%, transparent)", color: "#000" }}>
            <Clock size={9} /> MISSING
          </div>
        )}
        {/* Low CF overlay */}
        {lowCF && (
          <div className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-black/70 backdrop-blur-sm" style={{ color: "var(--color-danger)", border: "1px solid color-mix(in srgb, var(--color-danger) 40%, transparent)" }}>
            <Award size={8} /> CF
          </div>
        )}
        {/* Monitored dot */}
        <div className="absolute top-2 right-2">
          {movie.hasFile ? (
            <div
              className="w-2 h-2 rounded-full bg-[var(--color-success)]"
              style={{ boxShadow: "0 0 6px var(--color-success)" }}
            />
          ) : (
            <div className="w-2 h-2 rounded-full bg-[var(--color-text-muted)]" />
          )}
        </div>
        {/* IMDb rating */}
        {imdbRating && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-semibold text-[var(--color-warning)]">
            <Star size={9} fill="currentColor" />
            {imdbRating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className={cn("font-semibold text-white truncate pr-10", titleSizeClass)}>{movie.title}</h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-400">
            {movie.year} · {formatRuntime(movie.runtime)}
          </span>
        </div>
        <div className="mt-1.5">
          <StatusBadge movie={movie} />
        </div>
        {movie.hasFile && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400">
            <HardDrive size={9} />
            <span>{formatBytes(movie.sizeOnDisk)}</span>
          </div>
        )}
        {/* CF Score — bottom right of info area */}
        {movie.hasFile && cfScore != null && (
          <div className="absolute bottom-2.5 right-2.5 flex flex-col items-end leading-none" title="Custom Format Score">
            <span className="text-[8px] font-semibold tracking-widest uppercase mb-0.5" style={{ color: cfColor(cfScore), opacity: 0.7 }}>CF</span>
            <span className="text-base font-black font-mono" style={{ color: cfColor(cfScore) }}>
              {cfScore}
            </span>
          </div>
        )}

      </div>
    </motion.div>
  );
}

function MovieRow({ movie, selected, onToggle, cfScore }: { movie: RadarrMovie; selected?: boolean; onToggle?: (id: number) => void; cfScore?: number }) {
  const missing = !movie.hasFile && movie.monitored;
  const lowCF = movie.hasFile && cfScore != null && cfScore < 0;
  return (
    <div onClick={onToggle ? () => onToggle(movie.id) : undefined}
      className={cn("flex items-center gap-4 px-4 py-3 rounded-lg border transition-all cursor-pointer",
        selected ? "border-[var(--color-radarr)]/50 bg-[var(--color-radarr)]/5"
        : missing ? "border-[var(--color-warning)]/30 hover:border-[var(--color-warning)]/50 hover:bg-[var(--color-bg-card-hover)]"
        : lowCF ? "border-[var(--color-danger)]/25 hover:border-[var(--color-danger)]/40 hover:bg-[var(--color-bg-card-hover)]"
        : "border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]")}>
      <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-base)] flex items-center justify-center flex-shrink-0">
        {movie.hasFile ? (
          <CheckCircle2 size={14} className="text-[var(--color-success)]" />
        ) : movie.monitored ? (
          <Clock size={14} className="text-[var(--color-warning)]" />
        ) : (
          <XCircle size={14} className="text-[var(--color-text-muted)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{movie.title}</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {movie.year} · {formatRuntime(movie.runtime)}
          {movie.genres?.[0] && ` · ${movie.genres[0]}`}
        </p>
      </div>
      <StatusBadge movie={movie} />
      {lowCF && (
        <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0" style={{ color: "var(--color-danger)", borderColor: "color-mix(in srgb, var(--color-danger) 35%, transparent)", background: "color-mix(in srgb, var(--color-danger) 12%, transparent)" }}>
          <Award size={9} /> LOW CF
        </span>
      )}
      <span className="text-xs text-[var(--color-text-muted)] w-16 text-right flex-shrink-0">
        {movie.hasFile ? formatBytes(movie.sizeOnDisk) : "—"}
      </span>
      {movie.hasFile && cfScore != null ? (
        <span className="text-[10px] font-bold font-mono w-20 text-right flex-shrink-0" style={{ color: cfColor(cfScore) }}>
          {cfScore}
        </span>
      ) : (
        <span className="w-20 flex-shrink-0" />
      )}
    </div>
  );
}

interface RootFolder { id: number; path: string; }

function sortTitle(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, "").trim();
}

function FolderSelect({
  value, onChange, folders, accentColor,
}: {
  value: string;
  onChange: (v: string) => void;
  folders: RootFolder[];
  accentColor: string;
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
  const sorted = [...folders].sort((a, b) => {
    const na = a.path.split(/[\/\\]/).filter(Boolean).pop() ?? a.path;
    const nb = b.path.split(/[\/\\]/).filter(Boolean).pop() ?? b.path;
    return na.localeCompare(nb);
  });
  const selectedLabel =
    value === "all"
      ? "All folders"
      : (folders.find((f) => f.path === value)?.path.split(/[\/\\]/).filter(Boolean).pop() ?? value);
  return (
    <div
      ref={ref}
      className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] cursor-pointer select-none"
      onClick={() => setOpen((v) => !v)}
    >
      <FolderOpen size={13} style={{ color: accentColor }} className="shrink-0" />
      <span className="text-xs text-white whitespace-nowrap">{selectedLabel}</span>
      <ChevronDown size={11} className="text-[var(--color-text-muted)] ml-0.5" />
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-full w-max max-w-xs rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-2xl z-30 overflow-hidden py-1">
          {([{ id: -1, path: "all" } as RootFolder, ...sorted]).map((rf) => {
            const label =
              rf.path === "all"
                ? "All folders"
                : (rf.path.split(/[\/\\]/).filter(Boolean).pop() ?? rf.path);
            const isSelected = value === rf.path;
            return (
              <button
                key={rf.id}
                onClick={(e) => { e.stopPropagation(); onChange(rf.path); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs transition-colors",
                  isSelected
                    ? "font-semibold bg-white/5"
                    : "text-[var(--color-text-secondary)] hover:text-white hover:bg-white/5"
                )}
                style={isSelected ? { color: accentColor } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RadarrPage() {
  const { radarr, library, setLibrary } = useSettings();
  const { radarrApi } = useApi();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "downloaded" | "missing" | "unmonitored">("all");
  const [rootFilter, setRootFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailMovieId, setDetailMovieId] = useState<number | null>(null);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [bulkProfileId, setBulkProfileId] = useState<number | "">("");
  const [bulkRootFolder, setBulkRootFolder] = useState("");
  const [bulkMoveFiles, setBulkMoveFiles] = useState(false);
  const [bulkTagIds, setBulkTagIds] = useState<number[]>([]);
  const [bulkTagApply, setBulkTagApply] = useState<"add" | "remove" | "replace">("add");

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const bulkMonitor = useMutation({
    mutationFn: (monitored: boolean) => radarrApi.put("/movie/editor", { movieIds: [...selectedIds], monitored }),
    onSuccess: (_, monitored) => {
      toast.success(monitored ? `Monitoring ${selectedIds.size} movies` : `Unmonitored ${selectedIds.size} movies`);
      queryClient.invalidateQueries({ queryKey: ["radarr-movies"] });
      setBulkMode(false);
      setSelectedIds(new Set());
    },
  });
  const bulkSearch = useMutation({
    mutationFn: () => radarrApi.post("/command", { name: "MoviesSearch", movieIds: [...selectedIds] }),
    onSuccess: () => {
      toast.success(`Search queued for ${selectedIds.size} movies`);
      setBulkMode(false);
      setSelectedIds(new Set());
    },
  });

  const bulkEdit = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { movieIds: [...selectedIds] };
      if (bulkProfileId !== "") body.qualityProfileId = bulkProfileId;
      if (bulkRootFolder) { body.rootFolderPath = bulkRootFolder; body.moveFiles = bulkMoveFiles; }
      if (bulkTagIds.length > 0) { body.tags = bulkTagIds; body.applyTags = bulkTagApply; }
      return radarrApi.put("/movie/editor", body);
    },
    onSuccess: () => {
      toast.success(`Updated ${selectedIds.size} movies`);
      queryClient.invalidateQueries({ queryKey: ["radarr-movies"] });
      setBulkMode(false); setSelectedIds(new Set()); setShowBulkPanel(false);
      setBulkProfileId(""); setBulkRootFolder(""); setBulkMoveFiles(false); setBulkTagIds([]);
    },
    onError: () => toast.error("Bulk edit failed"),
  });

  const { data: movies, isLoading, error } = useQuery<RadarrMovie[]>({
    queryKey: ["radarr-movies"],
    queryFn: () => radarrApi.get("/movie").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const { data: rootFolders } = useQuery<RootFolder[]>({
    queryKey: ["radarr-rootfolders"],
    queryFn: () => radarrApi.get("/rootfolder").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const { data: qualityProfiles } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["radarr-quality-profiles"],
    queryFn: () => radarrApi.get("/qualityprofile").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const { data: radarrTags } = useQuery<{ id: number; label: string }[]>({
    queryKey: ["radarr-tags"],
    queryFn: () => radarrApi.get("/tag").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const { data: movieFiles } = useQuery<{ movieId: number; customFormatScore: number | null }[]>({
    queryKey: ["radarr-moviefile-scores", movies?.filter((m) => m.hasFile).map((m) => m.id)],
    queryFn: async () => {
      if (!movies || movies.length === 0) return [];
      const withFile = movies.filter((m) => m.hasFile);
      if (withFile.length === 0) return [];
      const CHUNK = 100;
      const results: { movieId: number; customFormatScore: number | null }[] = [];
      for (let i = 0; i < withFile.length; i += CHUNK) {
        const ids = withFile.slice(i, i + CHUNK).map((m) => m.id);
        const params = ids.map((id) => `movieId=${id}`).join("&");
        const r = await radarrApi.get(`/moviefile?${params}`);
        results.push(...(r.data as { movieId: number; customFormatScore: number | null }[]));
      }
      return results;
    },
    enabled: radarr.enabled && !!radarr.apiKey && !!movies && movies.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const cfScores = useMemo(() => {
    const map = new Map<number, number>();
    for (const f of (movieFiles ?? [])) {
      if (f.customFormatScore != null) map.set(f.movieId, f.customFormatScore);
    }
    return map;
  }, [movieFiles]);

  const { filtered, sorted, letterGroups, activeLetters, totalSize } = useMemo(() => {
    const filtered = (movies ?? []).filter((m) => {
      const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "downloaded" && m.hasFile) ||
        (filter === "missing" && m.monitored && !m.hasFile) ||
        (filter === "unmonitored" && !m.monitored);
      const matchesRoot = rootFilter === "all" || m.path.startsWith(rootFilter);
      return matchesSearch && matchesFilter && matchesRoot;
    });

    const sorted = [...filtered].sort((a, b) =>
      sortTitle(a.title).localeCompare(sortTitle(b.title))
    );
    const letterGroups: Map<string, RadarrMovie[]> = new Map();
    for (const m of sorted) {
      const ch = sortTitle(m.title)[0]?.toUpperCase() ?? "#";
      const letter = /[A-Z]/.test(ch) ? ch : "#";
      if (!letterGroups.has(letter)) letterGroups.set(letter, []);
      letterGroups.get(letter)!.push(m);
    }
    const activeLetters = new Set(letterGroups.keys());
    const totalSize = (movies ?? []).reduce((a, m) => a + (m.sizeOnDisk ?? 0), 0);
    return { filtered, sorted, letterGroups, activeLetters, totalSize };
  }, [movies, search, filter, rootFilter]);

  const allAlpha = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Radarr — Movie Library"
        subtitle={movies ? `${movies.length} movies · ${formatBytes(totalSize)}` : undefined}
      />

      {/* Sticky toolbar */}
      <div className="sticky top-[4.5rem] z-10 px-6 py-3 glass border-b border-[var(--color-border)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              type="text"
              placeholder="Search movies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-radarr)] transition-colors"
            />
          </div>

          <div className="flex gap-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-1">
            {(["all", "downloaded", "missing", "unmonitored"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-semibold capitalize transition-all",
                  filter === f
                    ? "bg-[var(--color-radarr)] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-white"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg p-1">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                view === "grid"
                  ? "bg-[var(--color-border-bright)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-white"
              )}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                view === "list"
                  ? "bg-[var(--color-border-bright)] text-white"
                  : "text-[var(--color-text-muted)] hover:text-white"
              )}
            >
              <List size={14} />
            </button>
          </div>

          {/* Poster size — only in grid mode */}
          {view === "grid" && (
            <PosterSizePicker
              value={library.radarrPosterSize}
              onChange={(s) => setLibrary({ radarrPosterSize: s })}
              accentColor="var(--color-radarr)"
            />
          )}

          {/* Card font size */}
          {view === "grid" && (
            <div className="flex items-center gap-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-1 py-0.5">
              {(["xs", "sm", "md", "lg"] as const).map((sz, i) => (
                <button
                  key={sz}
                  onClick={() => setLibrary({ cardFontSize: sz })}
                  title={`Font size: ${sz}`}
                  className={cn("px-1.5 py-0.5 rounded text-white transition-colors", library.cardFontSize === sz ? "bg-[var(--color-radarr)] text-white" : "text-slate-400 hover:text-white")}
                  style={{ fontSize: `${10 + i * 2}px`, lineHeight: 1, fontWeight: 600 }}
                >
                  A
                </button>
              ))}
            </div>
          )}

          {/* Root folder filter */}
          {rootFolders && rootFolders.length > 1 && (
            <FolderSelect
              value={rootFilter}
              onChange={setRootFilter}
              folders={rootFolders}
              accentColor="var(--color-radarr)"
            />
          )}

          {/* Add movie */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
            style={{ background: "var(--color-radarr)", color: "#fff" }}
          >
            <Plus size={14} /> Add
          </button>

          {/* Bulk select toggle */}
          <button
            onClick={() => { setBulkMode((v) => !v); setSelectedIds(new Set()); setShowBulkPanel(false); }}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
              bulkMode ? "bg-[var(--color-radarr)]/20 border-[var(--color-radarr)] text-[var(--color-radarr)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white")}
          >
            <CheckSquare size={13} /> {bulkMode ? "Cancel" : "Select"}
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6 pt-4">
        {/* Results count */}
        {movies && (
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Showing {filtered.length} of {movies.length} movies
          </p>
        )}

        {/* Loading */}
        {isLoading && (
          <div className={cn(
            view === "grid"
              ? `grid gap-4 ${posterGridClass(library.radarrPosterSize)}`
              : "space-y-1"
          )}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[var(--color-border)]">
                {view === "grid" ? (
                  <>
                    <div className="aspect-[2/3] shimmer rounded-t-xl" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 shimmer rounded w-3/4" />
                      <div className="h-2 shimmer rounded w-1/2" />
                    </div>
                  </>
                ) : (
                  <div className="h-14 shimmer rounded-xl" />
                )}
              </div>
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <XCircle size={36} className="text-[var(--color-danger)] mb-3" />
            <p className="text-white font-semibold">Could not connect to Radarr</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Check your connection settings</p>
          </div>
        )}

        {!radarr.apiKey && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock size={36} className="text-[var(--color-text-muted)] mb-3" />
            <p className="text-white font-semibold">Radarr not configured</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Add your Radarr URL and API key in Settings</p>
          </div>
        )}

        {/* Grid / List with letter sections + A-Z bar */}
        {!isLoading && !error && sorted.length > 0 && (
          <div className="flex gap-3 items-start">
            {/* Main content */}
            <div className="flex-1 min-w-0">
              {view === "grid" && (
                <div className="space-y-6">
                  {[...letterGroups.entries()].map(([letter, items]) => (
                    <div key={letter}>
                      <div id={`letter-${letter}`} className="text-xs font-bold uppercase tracking-widest mb-3 pl-2 border-l-2 border-[var(--color-radarr)] text-[var(--color-radarr)]">{letter}</div>
                      <div className={`grid gap-4 ${posterGridClass(library.radarrPosterSize)}`}>
                        {items.map((m) => bulkMode ? (
                          <MovieCard key={m.id} movie={m} selected={selectedIds.has(m.id)} onToggle={toggleSelect} cfScore={cfScores.get(m.id)} />
                        ) : (
                          <div key={m.id} onClick={() => setDetailMovieId(m.id)} className="cursor-pointer"><MovieCard movie={m} cfScore={cfScores.get(m.id)} /></div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {view === "list" && (
                <div className="space-y-0.5">
                  <div className="flex gap-4 px-4 py-2 text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider border-b border-[var(--color-border)]">
                    <div className="w-8" />
                    <div className="flex-1">Title</div>
                    <div className="w-24">Status</div>
                    <div className="w-16 text-right">Size</div>
                    <div className="w-20 text-right">CF Score</div>
                  </div>
                  {[...letterGroups.entries()].map(([letter, items]) => (
                    <div key={letter}>
                      <div id={`letter-${letter}`} className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest border-l-2 border-[var(--color-radarr)] text-[var(--color-radarr)] bg-[var(--color-radarr)]/5">{letter}</div>
                      {items.map((m) => bulkMode ? (
                        <MovieRow key={m.id} movie={m} selected={selectedIds.has(m.id)} onToggle={toggleSelect} cfScore={cfScores.get(m.id)} />
                      ) : (
                        <div key={m.id} onClick={() => setDetailMovieId(m.id)} className="cursor-pointer"><MovieRow movie={m} cfScore={cfScores.get(m.id)} /></div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* A-Z jump bar */}
            <div className="sticky top-36 shrink-0">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden w-9">
                <div className="flex flex-col max-h-[calc(100vh-6rem)] overflow-y-auto">
                  {allAlpha.map((letter, i) => (
                    <div key={letter}>
                      {i === 1 && <div className="mx-1.5 h-px bg-[var(--color-border)]" />}
                      <button
                        onClick={() =>
                          activeLetters.has(letter) &&
                          document.getElementById(`letter-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
                        }
                        className={cn(
                          "w-full h-7 flex items-center justify-center text-[11px] font-bold transition-all",
                          activeLetters.has(letter)
                            ? "text-white hover:bg-[var(--color-radarr)]/20 hover:text-[var(--color-radarr)] cursor-pointer"
                            : "text-[var(--color-text-muted)] opacity-40 cursor-default"
                        )}
                      >
                        {letter}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !error && movies && movies.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search size={32} className="text-[var(--color-text-muted)] mb-3" />
            <p className="text-white font-semibold">No movies match your search</p>
            <button
              onClick={() => { setSearch(""); setFilter("all"); setRootFilter("all"); }}
              className="mt-3 text-sm text-[var(--color-accent-bright)] hover:text-white transition-colors"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {bulkMode && selectedIds.size > 0 && (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-radarr)]/50 shadow-2xl">
            <span className="text-sm font-semibold text-white mr-1">{selectedIds.size} selected</span>
            <button onClick={() => bulkMonitor.mutate(true)} disabled={bulkMonitor.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-success)]/15 text-[var(--color-success)] hover:bg-[var(--color-success)]/25 transition-colors">
              <Eye size={12} /> Monitor
            </button>
            <button onClick={() => bulkMonitor.mutate(false)} disabled={bulkMonitor.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-warning)]/15 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/25 transition-colors">
              <EyeOff size={12} /> Unmonitor
            </button>
            <button onClick={() => bulkSearch.mutate()} disabled={bulkSearch.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-accent)]/15 text-[var(--color-accent-bright)] hover:bg-[var(--color-accent)]/25 transition-colors">
              <SearchCode size={12} /> Search
            </button>
            <button
              onClick={() => setShowBulkPanel((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                showBulkPanel
                  ? "bg-[var(--color-radarr)]/20 border-[var(--color-radarr)] text-[var(--color-radarr)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white"
              )}
            >
              <Settings2 size={12} /> Edit Fields
            </button>
            <button onClick={() => { setSelectedIds(new Set()); setShowBulkPanel(false); }} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white transition-colors">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk edit panel */}
      <AnimatePresence>
        {bulkMode && selectedIds.size > 0 && showBulkPanel && (
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-[5.5rem] left-1/2 -translate-x-1/2 z-50 w-96 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-radarr)]/40 shadow-2xl p-4 space-y-3"
          >
            <p className="text-xs font-semibold text-white">Edit {selectedIds.size} selected movies</p>

            {/* Quality Profile */}
            <div>
              <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block">Quality Profile</label>
              <select
                value={bulkProfileId}
                onChange={(e) => setBulkProfileId(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-sm outline-none"
              >
                <option value="">— No change —</option>
                {qualityProfiles?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Root Folder */}
            <div>
              <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1 block flex items-center gap-1"><Tag size={10} /> Root Folder</label>
              <select
                value={bulkRootFolder}
                onChange={(e) => setBulkRootFolder(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-sm outline-none"
              >
                <option value="">— No change —</option>
                {rootFolders?.map((rf) => <option key={rf.id} value={rf.path}>{rf.path}</option>)}
              </select>
              {bulkRootFolder && (
                <label className="flex items-center gap-2 mt-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer select-none">
                  <input type="checkbox" checked={bulkMoveFiles} onChange={(e) => setBulkMoveFiles(e.target.checked)} />
                  Move existing files to new folder
                </label>
              )}
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Tags</label>
                <select
                  value={bulkTagApply}
                  onChange={(e) => setBulkTagApply(e.target.value as "add" | "remove" | "replace")}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-secondary)] outline-none"
                >
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                  <option value="replace">Replace</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-1">
                {radarrTags?.map((t) => {
                  const active = bulkTagIds.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => setBulkTagIds(active ? bulkTagIds.filter((x) => x !== t.id) : [...bulkTagIds, t.id])}
                      className={cn("text-[10px] px-2 py-0.5 rounded-full border transition-all font-medium",
                        active ? "bg-[var(--color-radarr)]/20 border-[var(--color-radarr)]/50 text-[var(--color-radarr)]" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white")}>
                      {t.label}
                    </button>
                  );
                })}
                {(!radarrTags || radarrTags.length === 0) && <span className="text-xs text-[var(--color-text-muted)] italic">No tags defined</span>}
              </div>
            </div>

            {/* Apply / Cancel */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--color-border)]">
              <button
                onClick={() => { setShowBulkPanel(false); setBulkProfileId(""); setBulkRootFolder(""); setBulkMoveFiles(false); setBulkTagIds([]); }}
                className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-white border border-[var(--color-border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => bulkEdit.mutate()}
                disabled={bulkEdit.isPending || (bulkProfileId === "" && !bulkRootFolder && bulkTagIds.length === 0)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-radarr)] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {bulkEdit.isPending ? "Applying…" : "Apply to selected"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Media Modal */}
      {showAddModal && (
        <AddMediaModal service="radarr" onClose={() => setShowAddModal(false)} />
      )}

      {/* Movie Detail Modal */}
      {detailMovieId !== null && (
        <MovieDetailModal movieId={detailMovieId} onClose={() => setDetailMovieId(null)} />
      )}
    </div>
  );
}
