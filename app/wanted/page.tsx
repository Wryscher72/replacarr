"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  BookmarkX, Tv2, Film, Search as SearchIcon,
  RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, TrendingDown,
} from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/store/settings";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

interface MissingEpisode {
  id: number;
  seriesId: number;
  episodeNumber: number;
  seasonNumber: number;
  title: string;
  seriesTitle?: string;
  airDateUtc?: string;
  series?: { title: string; id: number };
  episodeFile?: { quality: { quality: { name: string } } };
}

interface SeriesSummary {
  id: number;
  title: string;
}

interface MissingMovie {
  id: number;
  title: string;
  year: number;
  monitored: boolean;
  hasFile: boolean;
  images: { coverType: string; remoteUrl: string }[];
  inCinemas?: string;
  movieFile?: { quality: { quality: { name: string } } };
}

interface WantedResponse<T> {
  records: T[];
  totalRecords: number;
}

export default function WantedPage() {
  const [tab, setTab] = useState<"sonarr" | "radarr">("sonarr");
  const [sonarrView, setSonarrView] = useState<"missing" | "cutoff">("missing");
  const [radarrView, setRadarrView] = useState<"missing" | "cutoff">("missing");
  const [sonarrPage, setSonarrPage] = useState(1);
  const [radarrPage, setRadarrPage] = useState(1);
  const [sonarrCutoffPage, setSonarrCutoffPage] = useState(1);
  const [radarrCutoffPage, setRadarrCutoffPage] = useState(1);
  const [sonarrSearch, setSonarrSearch] = useState("");
  const [radarrSearch, setRadarrSearch] = useState("");
  const [sonarrCutoffSearch, setSonarrCutoffSearch] = useState("");
  const [radarrCutoffSearch, setRadarrCutoffSearch] = useState("");
  const { sonarr, radarr } = useSettings();
  const { sonarrApi, radarrApi } = useApi();
  const qc = useQueryClient();

  const PAGE_SIZE = 50;

  const {
    data: missingEpisodes,
    isLoading: epLoading,
    error: epError,
  } = useQuery<WantedResponse<MissingEpisode>>({
    queryKey: ["sonarr-wanted", sonarrPage],
    queryFn: () =>
      sonarrApi
        .get(`/wanted/missing?pageSize=${PAGE_SIZE}&page=${sonarrPage}&sortKey=airDateUtc&sortDirection=descending`)
        .then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
    placeholderData: (prev) => prev,
  });

  // Fetch full series list to resolve seriesId → title reliably
  const { data: allSeries } = useQuery<SeriesSummary[]>({
    queryKey: ["sonarr-series"],
    queryFn: () => sonarrApi.get("/series").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });
  const seriesMap = new Map((allSeries ?? []).map((s) => [s.id, s.title]));

  const {
    data: missingMovies,
    isLoading: movLoading,
    error: movError,
  } = useQuery<WantedResponse<MissingMovie>>({
    queryKey: ["radarr-wanted", radarrPage],
    queryFn: () =>
      radarrApi
        .get(`/wanted/missing?pageSize=${PAGE_SIZE}&page=${radarrPage}&sortKey=releaseDate&sortDirection=descending`)
        .then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
    placeholderData: (prev) => prev,
  });

  const {
    data: cutoffEpisodes,
    isLoading: cutoffEpLoading,
  } = useQuery<WantedResponse<MissingEpisode>>({
    queryKey: ["sonarr-cutoff", sonarrCutoffPage],
    queryFn: () =>
      sonarrApi
        .get(`/wanted/cutoff?pageSize=${PAGE_SIZE}&page=${sonarrCutoffPage}&sortKey=airDateUtc&sortDirection=descending`)
        .then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
    placeholderData: (prev) => prev,
  });

  const {
    data: cutoffMovies,
    isLoading: cutoffMovLoading,
  } = useQuery<WantedResponse<MissingMovie>>({
    queryKey: ["radarr-cutoff", radarrCutoffPage],
    queryFn: () =>
      radarrApi
        .get(`/wanted/cutoff?pageSize=${PAGE_SIZE}&page=${radarrCutoffPage}&sortKey=releaseDate&sortDirection=descending`)
        .then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
    placeholderData: (prev) => prev,
  });

  const searchEpisodeMutation = useMutation({
    mutationFn: (episodeId: number) =>
      sonarrApi.post("/command", { name: "EpisodeSearch", episodeIds: [episodeId] }),
    onSuccess: () => {
      toast.success("Episode search queued");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["sonarr-wanted"] }), 2000);
    },
  });

  const searchMovieMutation = useMutation({
    mutationFn: (movieId: number) =>
      radarrApi.post("/command", { name: "MoviesSearch", movieIds: [movieId] }),
    onSuccess: () => {
      toast.success("Movie search queued");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["radarr-wanted"] }), 2000);
    },
  });

  const searchAllSonarrMutation = useMutation({
    mutationFn: () =>
      sonarrApi.post("/command", { name: "MissingEpisodeSearch" }),
    onSuccess: () => toast.success("Searching all missing episodes…"),
  });

  const searchAllRadarrMutation = useMutation({
    mutationFn: () =>
      radarrApi.post("/command", { name: "MissingMoviesSearch" }),
    onSuccess: () => toast.success("Searching all missing movies…"),
  });

  const searchAllCutoffSonarrMutation = useMutation({
    mutationFn: () =>
      sonarrApi.post("/command", { name: "CutOffUnmetEpisodeSearch" }),
    onSuccess: () => toast.success("Searching all cutoff unmet episodes…"),
  });

  const searchAllCutoffRadarrMutation = useMutation({
    mutationFn: () =>
      radarrApi.post("/command", { name: "CutOffUnmetMoviesSearch" }),
    onSuccess: () => toast.success("Searching all cutoff unmet movies…"),
  });

  const episodes = missingEpisodes?.records ?? [];
  const movies = missingMovies?.records ?? [];
  const cutoffEpList = cutoffEpisodes?.records ?? [];
  const cutoffMovList = cutoffMovies?.records ?? [];

  // Client-side search filter
  const filteredEpisodes = sonarrSearch.trim()
    ? episodes.filter((ep) => {
        const q = sonarrSearch.toLowerCase();
        const seriesTitle = (seriesMap.get(ep.seriesId) ?? ep.series?.title ?? "").toLowerCase();
        return seriesTitle.includes(q) || ep.title.toLowerCase().includes(q);
      })
    : episodes;

  const filteredMovies = radarrSearch.trim()
    ? movies.filter((m) => m.title.toLowerCase().includes(radarrSearch.toLowerCase()))
    : movies;

  const filteredCutoffEpisodes = sonarrCutoffSearch.trim()
    ? cutoffEpList.filter((ep) => {
        const q = sonarrCutoffSearch.toLowerCase();
        const seriesTitle = (seriesMap.get(ep.seriesId) ?? ep.series?.title ?? "").toLowerCase();
        return seriesTitle.includes(q) || ep.title.toLowerCase().includes(q);
      })
    : cutoffEpList;

  const filteredCutoffMovies = radarrCutoffSearch.trim()
    ? cutoffMovList.filter((m) => m.title.toLowerCase().includes(radarrCutoffSearch.toLowerCase()))
    : cutoffMovList;

  const sonarrTotalPages = Math.max(1, Math.ceil((missingEpisodes?.totalRecords ?? 0) / PAGE_SIZE));
  const radarrTotalPages = Math.max(1, Math.ceil((missingMovies?.totalRecords ?? 0) / PAGE_SIZE));
  const sonarrCutoffTotalPages = Math.max(1, Math.ceil((cutoffEpisodes?.totalRecords ?? 0) / PAGE_SIZE));
  const radarrCutoffTotalPages = Math.max(1, Math.ceil((cutoffMovies?.totalRecords ?? 0) / PAGE_SIZE));

  function EpisodeRow({ ep, idx, isCutoff }: { ep: MissingEpisode; idx: number; isCutoff: boolean }) {
    return (
      <motion.div
        key={ep.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.02 }}
        className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]"
      >
        {isCutoff
          ? <TrendingDown size={14} className="text-[var(--color-accent)] shrink-0" />
          : <AlertTriangle size={14} className="text-[var(--color-warning)] shrink-0" />}
        <div className="flex-1 min-w-0">
          <Link href={`/sonarr/${ep.seriesId}`} className="text-sm font-semibold text-white hover:text-[var(--color-sonarr)] transition-colors truncate block">
            {seriesMap.get(ep.seriesId) ?? ep.series?.title ?? ep.seriesTitle ?? `Series #${ep.seriesId}`}
          </Link>
          <p className="text-xs text-[var(--color-text-muted)]">
            S{String(ep.seasonNumber).padStart(2, "0")}E{String(ep.episodeNumber).padStart(2, "0")} · {ep.title}
            {ep.airDateUtc && ` · ${new Date(ep.airDateUtc).toLocaleDateString()}`}
          </p>
        </div>
        {isCutoff && ep.episodeFile?.quality?.quality?.name && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] shrink-0">
            {ep.episodeFile.quality.quality.name}
          </span>
        )}
        <button
          onClick={() => searchEpisodeMutation.mutate(ep.id)}
          disabled={searchEpisodeMutation.isPending}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-[var(--color-sonarr)]/40 text-[var(--color-sonarr)] hover:bg-[var(--color-sonarr)]/10 transition-all shrink-0"
        >
          <SearchIcon size={11} /> Search
        </button>
      </motion.div>
    );
  }

  function MovieRow({ movie, idx, isCutoff }: { movie: MissingMovie; idx: number; isCutoff: boolean }) {
    const poster = movie.images?.find((i) => i.coverType === "poster")?.remoteUrl;
    return (
      <motion.div
        key={movie.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.02 }}
        className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]"
      >
        <div className="relative w-8 h-11 rounded-lg overflow-hidden bg-[var(--color-bg-base)] shrink-0">
          {poster ? (
            <Image src={poster} alt={movie.title} fill className="object-cover" sizes="32px" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film size={12} className="text-[var(--color-text-muted)]" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/radarr/${movie.id}`} className="text-sm font-semibold text-white hover:text-[var(--color-radarr)] transition-colors truncate block">
            {movie.title}
          </Link>
          <p className="text-xs text-[var(--color-text-muted)]">
            {movie.year}
            {movie.inCinemas && ` · In Cinemas ${new Date(movie.inCinemas).toLocaleDateString()}`}
          </p>
        </div>
        {isCutoff && movie.movieFile?.quality?.quality?.name && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] shrink-0">
            {movie.movieFile.quality.quality.name}
          </span>
        )}
        <button
          onClick={() => searchMovieMutation.mutate(movie.id)}
          disabled={searchMovieMutation.isPending}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-[var(--color-radarr)]/40 text-[var(--color-radarr)] hover:bg-[var(--color-radarr)]/10 transition-all shrink-0"
        >
          <SearchIcon size={11} /> Search
        </button>
      </motion.div>
    );
  }

  function Pager({ page, totalPages, loading, onPrev, onNext }: {
    page: number; totalPages: number; loading: boolean;
    onPrev: () => void; onNext: () => void;
  }) {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 pt-2">
        <button onClick={onPrev} disabled={page <= 1 || loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={13} /> Prev
        </button>
        <span className="text-xs text-[var(--color-text-muted)]">Page <span className="text-white font-semibold">{page}</span> of {totalPages}</span>
        <button onClick={onNext} disabled={page >= totalPages || loading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          Next <ChevronRight size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Wanted"
        subtitle={
          `${missingEpisodes?.totalRecords ?? 0} missing · ${cutoffEpisodes?.totalRecords ?? 0} cutoff unmet episodes · ${missingMovies?.totalRecords ?? 0} missing · ${cutoffMovies?.totalRecords ?? 0} cutoff unmet movies`
        }
      />

      <div className="flex-1 p-6 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] w-fit">
          <button
            onClick={() => setTab("sonarr")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
              tab === "sonarr" ? "text-white bg-[var(--color-sonarr)]" : "text-[var(--color-text-secondary)] hover:text-white"
            )}
          >
            <Tv2 size={13} /> Sonarr
            {(missingEpisodes?.totalRecords ?? 0) > 0 && (
              <span className="text-xs bg-white/20 px-1.5 rounded-full">{missingEpisodes!.totalRecords.toLocaleString()}</span>
            )}
          </button>
          <button
            onClick={() => setTab("radarr")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all",
              tab === "radarr" ? "text-white bg-[var(--color-radarr)]" : "text-[var(--color-text-secondary)] hover:text-white"
            )}
          >
            <Film size={13} /> Radarr
            {(missingMovies?.totalRecords ?? 0) > 0 && (
              <span className="text-xs bg-white/20 px-1.5 rounded-full">{missingMovies!.totalRecords.toLocaleString()}</span>
            )}
          </button>
        </div>

        {/* ── Sonarr tab ── */}
        {tab === "sonarr" && (
          <div className="space-y-3">
            {/* Missing / Cutoff sub-tabs */}
            <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] w-fit">
              <button
                onClick={() => setSonarrView("missing")}
                className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                  sonarrView === "missing" ? "text-white bg-[var(--color-sonarr)]" : "text-[var(--color-text-secondary)] hover:text-white")}
              >
                <AlertTriangle size={11} /> Missing
                {(missingEpisodes?.totalRecords ?? 0) > 0 && (
                  <span className="bg-white/20 px-1.5 rounded-full">{missingEpisodes!.totalRecords.toLocaleString()}</span>
                )}
              </button>
              <button
                onClick={() => setSonarrView("cutoff")}
                className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                  sonarrView === "cutoff" ? "text-white bg-[var(--color-sonarr)]" : "text-[var(--color-text-secondary)] hover:text-white")}
              >
                <TrendingDown size={11} /> Cutoff Unmet
                {(cutoffEpisodes?.totalRecords ?? 0) > 0 && (
                  <span className="bg-white/20 px-1.5 rounded-full">{cutoffEpisodes!.totalRecords.toLocaleString()}</span>
                )}
              </button>
            </div>

            {/* ─ Missing ─ */}
            {sonarrView === "missing" && (<>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <p className="text-xs text-[var(--color-text-muted)]">{missingEpisodes?.totalRecords ?? 0} total missing</p>
                <button onClick={() => searchAllSonarrMutation.mutate()} disabled={searchAllSonarrMutation.isPending || (missingEpisodes?.totalRecords ?? 0) === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-sonarr)] text-white disabled:opacity-50 transition-all">
                  {searchAllSonarrMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <SearchIcon size={12} />}
                  Search All Missing
                </button>
              </div>
              <div className="relative">
                <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input type="text" value={sonarrSearch} onChange={(e) => setSonarrSearch(e.target.value)} placeholder="Filter by series or episode…"
                  className="w-full pl-8 pr-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-sonarr)] transition-colors" />
              </div>
              {epLoading && <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>}
              {epError && !epLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <XCircle size={40} className="text-[var(--color-danger)] opacity-50 mb-3" />
                  <p className="text-white font-semibold">Could not connect to Sonarr</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Check your connection settings.</p>
                </div>
              )}
              {!epLoading && !epError && episodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <CheckCircle2 size={40} className="text-[var(--color-success)] opacity-50 mb-3" />
                  <p className="text-white font-semibold">No missing episodes!</p>
                  <p className="text-sm text-[var(--color-text-muted)]">All monitored episodes are downloaded.</p>
                </div>
              )}
              {!epLoading && !epError && episodes.length > 0 && filteredEpisodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <SearchIcon size={28} className="text-[var(--color-text-muted)] mb-2" />
                  <p className="text-sm text-[var(--color-text-muted)]">No episodes match your search</p>
                </div>
              )}
              {filteredEpisodes.map((ep, idx) => <EpisodeRow key={ep.id} ep={ep} idx={idx} isCutoff={false} />)}
              <Pager page={sonarrPage} totalPages={sonarrTotalPages} loading={epLoading}
                onPrev={() => setSonarrPage((p) => Math.max(1, p - 1))}
                onNext={() => setSonarrPage((p) => Math.min(sonarrTotalPages, p + 1))} />
            </>)}

            {/* ─ Cutoff Unmet ─ */}
            {sonarrView === "cutoff" && (<>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <p className="text-xs text-[var(--color-text-muted)]">{cutoffEpisodes?.totalRecords ?? 0} total cutoff unmet</p>
                <button onClick={() => searchAllCutoffSonarrMutation.mutate()} disabled={searchAllCutoffSonarrMutation.isPending || (cutoffEpisodes?.totalRecords ?? 0) === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-sonarr)] text-white disabled:opacity-50 transition-all">
                  {searchAllCutoffSonarrMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <SearchIcon size={12} />}
                  Search All Cutoff
                </button>
              </div>
              <div className="relative">
                <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input type="text" value={sonarrCutoffSearch} onChange={(e) => setSonarrCutoffSearch(e.target.value)} placeholder="Filter by series or episode…"
                  className="w-full pl-8 pr-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-sonarr)] transition-colors" />
              </div>
              {cutoffEpLoading && <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>}
              {!cutoffEpLoading && cutoffEpList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <CheckCircle2 size={40} className="text-[var(--color-success)] opacity-50 mb-3" />
                  <p className="text-white font-semibold">All episodes meet cutoff!</p>
                  <p className="text-sm text-[var(--color-text-muted)]">No quality upgrades needed.</p>
                </div>
              )}
              {!cutoffEpLoading && cutoffEpList.length > 0 && filteredCutoffEpisodes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <SearchIcon size={28} className="text-[var(--color-text-muted)] mb-2" />
                  <p className="text-sm text-[var(--color-text-muted)]">No episodes match your search</p>
                </div>
              )}
              {filteredCutoffEpisodes.map((ep, idx) => <EpisodeRow key={ep.id} ep={ep} idx={idx} isCutoff={true} />)}
              <Pager page={sonarrCutoffPage} totalPages={sonarrCutoffTotalPages} loading={cutoffEpLoading}
                onPrev={() => setSonarrCutoffPage((p) => Math.max(1, p - 1))}
                onNext={() => setSonarrCutoffPage((p) => Math.min(sonarrCutoffTotalPages, p + 1))} />
            </>)}
          </div>
        )}

        {/* ── Radarr tab ── */}
        {tab === "radarr" && (
          <div className="space-y-3">
            {/* Missing / Cutoff sub-tabs */}
            <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] w-fit">
              <button
                onClick={() => setRadarrView("missing")}
                className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                  radarrView === "missing" ? "text-white bg-[var(--color-radarr)]" : "text-[var(--color-text-secondary)] hover:text-white")}
              >
                <AlertTriangle size={11} /> Missing
                {(missingMovies?.totalRecords ?? 0) > 0 && (
                  <span className="bg-white/20 px-1.5 rounded-full">{missingMovies!.totalRecords.toLocaleString()}</span>
                )}
              </button>
              <button
                onClick={() => setRadarrView("cutoff")}
                className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                  radarrView === "cutoff" ? "text-white bg-[var(--color-radarr)]" : "text-[var(--color-text-secondary)] hover:text-white")}
              >
                <TrendingDown size={11} /> Cutoff Unmet
                {(cutoffMovies?.totalRecords ?? 0) > 0 && (
                  <span className="bg-white/20 px-1.5 rounded-full">{cutoffMovies!.totalRecords.toLocaleString()}</span>
                )}
              </button>
            </div>

            {/* ─ Missing ─ */}
            {radarrView === "missing" && (<>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <p className="text-xs text-[var(--color-text-muted)]">{missingMovies?.totalRecords ?? 0} total missing</p>
                <button onClick={() => searchAllRadarrMutation.mutate()} disabled={searchAllRadarrMutation.isPending || (missingMovies?.totalRecords ?? 0) === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-radarr)] text-white disabled:opacity-50 transition-all">
                  {searchAllRadarrMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <SearchIcon size={12} />}
                  Search All Missing
                </button>
              </div>
              <div className="relative">
                <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input type="text" value={radarrSearch} onChange={(e) => setRadarrSearch(e.target.value)} placeholder="Filter by title…"
                  className="w-full pl-8 pr-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-radarr)] transition-colors" />
              </div>
              {movLoading && <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>}
              {movError && !movLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <XCircle size={40} className="text-[var(--color-danger)] opacity-50 mb-3" />
                  <p className="text-white font-semibold">Could not connect to Radarr</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Check your connection settings.</p>
                </div>
              )}
              {!movLoading && !movError && movies.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <CheckCircle2 size={40} className="text-[var(--color-success)] opacity-50 mb-3" />
                  <p className="text-white font-semibold">No missing movies!</p>
                  <p className="text-sm text-[var(--color-text-muted)]">All monitored movies are downloaded.</p>
                </div>
              )}
              {!movLoading && !movError && movies.length > 0 && filteredMovies.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <SearchIcon size={28} className="text-[var(--color-text-muted)] mb-2" />
                  <p className="text-sm text-[var(--color-text-muted)]">No movies match your search</p>
                </div>
              )}
              {filteredMovies.map((movie, idx) => <MovieRow key={movie.id} movie={movie} idx={idx} isCutoff={false} />)}
              <Pager page={radarrPage} totalPages={radarrTotalPages} loading={movLoading}
                onPrev={() => setRadarrPage((p) => Math.max(1, p - 1))}
                onNext={() => setRadarrPage((p) => Math.min(radarrTotalPages, p + 1))} />
            </>)}

            {/* ─ Cutoff Unmet ─ */}
            {radarrView === "cutoff" && (<>
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <p className="text-xs text-[var(--color-text-muted)]">{cutoffMovies?.totalRecords ?? 0} total cutoff unmet</p>
                <button onClick={() => searchAllCutoffRadarrMutation.mutate()} disabled={searchAllCutoffRadarrMutation.isPending || (cutoffMovies?.totalRecords ?? 0) === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-radarr)] text-white disabled:opacity-50 transition-all">
                  {searchAllCutoffRadarrMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <SearchIcon size={12} />}
                  Search All Cutoff
                </button>
              </div>
              <div className="relative">
                <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input type="text" value={radarrCutoffSearch} onChange={(e) => setRadarrCutoffSearch(e.target.value)} placeholder="Filter by title…"
                  className="w-full pl-8 pr-4 py-2 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-radarr)] transition-colors" />
              </div>
              {cutoffMovLoading && <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 shimmer rounded-xl" />)}</div>}
              {!cutoffMovLoading && cutoffMovList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <CheckCircle2 size={40} className="text-[var(--color-success)] opacity-50 mb-3" />
                  <p className="text-white font-semibold">All movies meet cutoff!</p>
                  <p className="text-sm text-[var(--color-text-muted)]">No quality upgrades needed.</p>
                </div>
              )}
              {!cutoffMovLoading && cutoffMovList.length > 0 && filteredCutoffMovies.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <SearchIcon size={28} className="text-[var(--color-text-muted)] mb-2" />
                  <p className="text-sm text-[var(--color-text-muted)]">No movies match your search</p>
                </div>
              )}
              {filteredCutoffMovies.map((movie, idx) => <MovieRow key={movie.id} movie={movie} idx={idx} isCutoff={true} />)}
              <Pager page={radarrCutoffPage} totalPages={radarrCutoffTotalPages} loading={cutoffMovLoading}
                onPrev={() => setRadarrCutoffPage((p) => Math.max(1, p - 1))}
                onNext={() => setRadarrCutoffPage((p) => Math.min(radarrCutoffTotalPages, p + 1))} />
            </>)}
          </div>
        )}
      </div>
    </div>
  );
}
