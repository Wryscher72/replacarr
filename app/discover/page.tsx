"use client";

import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Search,
  Star,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Film,
  Tv2,
  Send,
  Loader2,
  AlertCircle,
  X,
  TrendingUp,
  Clapperboard,
  List,
  LayoutGrid,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/store/settings";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TmdbMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
  original_language: string;
  media_type?: "movie";
}

interface TmdbShow {
  id: number;
  name: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
  original_language: string;
  media_type?: "tv";
}

type TmdbItem = (TmdbMovie & { media_type: "movie" }) | (TmdbShow & { media_type: "tv" });

interface TmdbGenre {
  id: number;
  name: string;
}

interface TmdbPageResult<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

interface TmdbItemFull {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  overview: string;
  vote_average: number;
  runtime?: number;
  number_of_seasons?: number;
  genres: TmdbGenre[];
  credits?: {
    cast: { id: number; name: string; character: string; profile_path: string | null }[];
  };
}

interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priorities?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w780";

const MOVIE_GENRES: TmdbGenre[] = [
  { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" }, { id: 80, name: "Crime" }, { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" }, { id: 10751, name: "Family" }, { id: 14, name: "Fantasy" },
  { id: 36, name: "History" }, { id: 27, name: "Horror" }, { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" }, { id: 10749, name: "Romance" }, { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" }, { id: 10752, name: "War" }, { id: 37, name: "Western" },
];

const TV_GENRES: TmdbGenre[] = [
  { id: 10759, name: "Action & Adventure" }, { id: 16, name: "Animation" }, { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" }, { id: 99, name: "Documentary" }, { id: 18, name: "Drama" },
  { id: 10751, name: "Family" }, { id: 10762, name: "Kids" }, { id: 9648, name: "Mystery" },
  { id: 10763, name: "News" }, { id: 10764, name: "Reality" }, { id: 10765, name: "Sci-Fi & Fantasy" },
  { id: 10766, name: "Soap" }, { id: 10767, name: "Talk" }, { id: 10768, name: "War & Politics" },
  { id: 37, name: "Western" },
];

const SORT_OPTIONS = [
  { value: "popularity.desc", label: "Most Popular" },
  { value: "vote_average.desc", label: "Top Rated" },
  { value: "primary_release_date.desc", label: "Newest" },
  { value: "primary_release_date.asc", label: "Oldest" },
];

const COMMON_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "hi", name: "Hindi" },
  { code: "ar", name: "Arabic" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
  { code: "th", name: "Thai" },
];

// Common TV networks for network-of-origin filtering (TV only)
const TV_NETWORKS = [
  { id: 49,   name: "HBO" },
  { id: 2,    name: "ABC" },
  { id: 6,    name: "NBC" },
  { id: 16,   name: "CBS" },
  { id: 19,   name: "Fox" },
  { id: 88,   name: "FX" },
  { id: 174,  name: "AMC" },
  { id: 67,   name: "Showtime" },
  { id: 318,  name: "Starz" },
  { id: 71,   name: "The CW" },
  { id: 2739, name: "Disney+" },
  { id: 453,  name: "Hulu" },
  { id: 2552, name: "Apple TV+" },
  { id: 1024, name: "Amazon" },
  { id: 213,  name: "Netflix" },
  { id: 4,    name: "BBC One" },
  { id: 332,  name: "BBC Two" },
  { id: 56,   name: "ITV" },
  { id: 14,   name: "PBS" },
];

// ---------------------------------------------------------------------------
// Send to Radarr / Sonarr modal
// ---------------------------------------------------------------------------

interface SendModalProps {
  item: TmdbItemFull;
  mediaType: "movie" | "tv";
  onClose: () => void;
}

function SendModal({ item, mediaType, onClose }: SendModalProps) {
  const { radarrApi, sonarrApi } = useApi();
  const { radarr, sonarr } = useSettings();
  const queryClient = useQueryClient();

  const [selectedFolder, setSelectedFolder] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<number | "">("");

  // Fetch root folders
  const { data: foldersData } = useQuery({
    queryKey: mediaType === "movie" ? ["radarr-rootfolders"] : ["sonarr-rootfolders"],
    queryFn: async () => {
      const api = mediaType === "movie" ? radarrApi : sonarrApi;
      const res = await api.get("/rootfolder");
      return res.data as { id: number; path: string }[];
    },
    enabled: (mediaType === "movie" ? radarr.enabled : sonarr.enabled),
  });

  // Fetch quality profiles
  const { data: profilesData } = useQuery({
    queryKey: mediaType === "movie" ? ["radarr-qualityprofiles"] : ["sonarr-qualityprofiles"],
    queryFn: async () => {
      const api = mediaType === "movie" ? radarrApi : sonarrApi;
      const res = await api.get("/qualityprofile");
      return res.data as { id: number; name: string }[];
    },
    enabled: (mediaType === "movie" ? radarr.enabled : sonarr.enabled),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const folder = selectedFolder || foldersData?.[0]?.path || "";
      const profileId = selectedProfile !== "" ? selectedProfile : profilesData?.[0]?.id;

      if (mediaType === "movie") {
        // Radarr: look up the movie first to get all required fields (title, year, images, etc.)
        const lookupRes = await radarrApi.get("/movie/lookup/tmdb", {
          params: { tmdbId: item.id },
        });
        const movieData = lookupRes.data as Record<string, unknown>;
        await radarrApi.post("/movie", {
          ...movieData,
          qualityProfileId: profileId,
          rootFolderPath: folder,
          monitored: true,
          addOptions: { searchForMovie: true },
        });
      } else {
        // Sonarr: look up the series first — returns tvdbId + all required shape
        const lookupRes = await sonarrApi.get("/series/lookup", {
          params: { term: `tmdb:${item.id}` },
        });
        const results = lookupRes.data as Record<string, unknown>[];
        if (!results || results.length === 0) {
          throw new Error("Series not found in Sonarr lookup. It may not be in the TVDB database yet.");
        }
        const seriesData = results[0];
        await sonarrApi.post("/series", {
          ...seriesData,
          qualityProfileId: profileId,
          rootFolderPath: folder,
          monitored: true,
          seasonFolder: true,
          addOptions: { searchForMissingEpisodes: true },
        });
      }
    },
    onSuccess: () => {
      toast.success(`Added to ${mediaType === "movie" ? "Radarr" : "Sonarr"}!`);
      queryClient.invalidateQueries({
        queryKey: mediaType === "movie" ? ["radarr-movies-ids"] : ["sonarr-series-ids"],
      });
      onClose();
    },
    onError: (err: unknown) => {
      // Check for Axios error with response body
      const axiosErr = err as { response?: { data?: unknown; status?: number } };
      const status = axiosErr?.response?.status;
      const body = axiosErr?.response?.data;

      if (status === 400) {
        // Parse the actual error messages from Radarr/Sonarr
        const messages: string[] = [];
        if (Array.isArray(body)) {
          for (const e of body as { errorMessage?: string; errorCode?: string }[]) {
            if (e.errorMessage) messages.push(e.errorMessage);
          }
        } else if (typeof body === "string") {
          messages.push(body);
        }
        const combined = messages.join(" ").toLowerCase();
        if (combined.includes("already") || combined.includes("exists")) {
          toast.info("Already exists in library");
        } else if (messages.length > 0) {
          toast.error(messages[0]);
        } else {
          toast.error("Request rejected — check Radarr/Sonarr logs.");
        }
      } else if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Failed to add — unknown error.");
      }
    },
  });

  const serviceName = mediaType === "movie" ? "Radarr" : "Sonarr";
  const enabled = mediaType === "movie" ? radarr.enabled : sonarr.enabled;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 shadow-2xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-[var(--color-text-muted)] hover:text-white transition-colors">
          <X size={16} />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            mediaType === "movie" ? "bg-[var(--color-radarr-glow)] border border-[var(--color-radarr)]" : "bg-[var(--color-sonarr-glow)] border border-[var(--color-sonarr)]"
          )}>
            {mediaType === "movie" ? (
              <Film size={18} className="text-[var(--color-radarr)]" />
            ) : (
              <Tv2 size={18} className="text-[var(--color-sonarr)]" />
            )}
          </div>
          <div>
            <h2 className="text-white font-semibold">Send to {serviceName}</h2>
            <p className="text-[var(--color-text-muted)] text-xs truncate max-w-[280px]">
              {item.title ?? item.name}
            </p>
          </div>
        </div>

        {!enabled ? (
          <p className="text-[var(--color-warning)] text-sm">
            {serviceName} is not enabled. Configure it in Settings first.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Root folder */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Root Folder</label>
              <select
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              >
                {foldersData?.map((f) => (
                  <option key={f.id} value={f.path}>{f.path}</option>
                ))}
              </select>
            </div>

            {/* Quality profile */}
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Quality Profile</label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              >
                {profilesData?.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all",
                mediaType === "movie"
                  ? "bg-[var(--color-radarr)] text-white hover:opacity-90"
                  : "bg-[var(--color-sonarr)] text-white hover:opacity-90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {sendMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              Add to {serviceName}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

interface DetailPanelProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
  onClose: () => void;
  onSend: (item: TmdbItemFull) => void;
}

function DetailPanel({ tmdbId, mediaType, onClose, onSend }: DetailPanelProps) {
  const { tmdbApi } = useApi();
  const endpoint = mediaType === "movie"
    ? `/movie/${tmdbId}?append_to_response=credits`
    : `/tv/${tmdbId}?append_to_response=credits`;

  const { data, isLoading } = useQuery<TmdbItemFull>({
    queryKey: ["tmdb-detail", mediaType, tmdbId],
    queryFn: async () => {
      const res = await tmdbApi.get(endpoint);
      return res.data;
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 32 }}
      className="w-full max-w-sm flex-shrink-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden flex flex-col"
    >
      {isLoading || !data ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      ) : (
        <>
          {/* Backdrop */}
          <div className="relative h-40">
            {data.backdrop_path ? (
              <Image
                src={`${BACKDROP_BASE}${data.backdrop_path}`}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="w-full h-full bg-[var(--color-bg-panel)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-card)] to-transparent" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <h2 className="text-white font-bold text-lg leading-snug">{data.title ?? data.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {(data.release_date ?? data.first_air_date) && (
                  <span className="text-[var(--color-text-muted)] text-xs">
                    {(data.release_date ?? data.first_air_date ?? "").slice(0, 4)}
                  </span>
                )}
                {data.runtime && (
                  <span className="text-[var(--color-text-muted)] text-xs flex items-center gap-1">
                    <Clock size={10} /> {data.runtime}m
                  </span>
                )}
                {data.number_of_seasons && (
                  <span className="text-[var(--color-text-muted)] text-xs">
                    {data.number_of_seasons} season{data.number_of_seasons !== 1 ? "s" : ""}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[var(--color-warning)] text-xs">
                  <Star size={10} fill="currentColor" /> {data.vote_average.toFixed(1)}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {data.genres?.slice(0, 4).map((g) => (
                  <span key={g.id} className="px-2 py-0.5 rounded-full bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)]">
                    {g.name}
                  </span>
                ))}
              </div>
            </div>

            {data.overview && (
              <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed line-clamp-6">
                {data.overview}
              </p>
            )}

            {/* Cast */}
            {data.credits?.cast && data.credits.cast.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Cast</p>
                <div className="space-y-2">
                  {data.credits.cast.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      {c.profile_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w45${c.profile_path}`}
                          alt={c.name}
                          width={28}
                          height={28}
                          className="rounded-full object-cover flex-shrink-0"
                          unoptimized
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[var(--color-bg-input)] flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-white text-xs font-medium truncate">{c.name}</p>
                        <p className="text-[var(--color-text-muted)] text-[10px] truncate">{c.character}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-[var(--color-border)] flex gap-2">
            <button
              onClick={() => onSend(data)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all text-white",
                mediaType === "movie"
                  ? "bg-[var(--color-radarr)] hover:opacity-90"
                  : "bg-[var(--color-sonarr)] hover:opacity-90"
              )}
            >
              <Send size={14} />
              Add to {mediaType === "movie" ? "Radarr" : "Sonarr"}
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

interface ResultCardProps {
  item: TmdbMovie | TmdbShow;
  mediaType: "movie" | "tv";
  isSelected: boolean;
  onClick: () => void;
}

function ResultCard({ item, mediaType, isSelected, onClick }: ResultCardProps) {
  const title = "title" in item ? item.title : item.name;
  const date = "release_date" in item ? item.release_date : item.first_air_date;
  const year = date?.slice(0, 4) ?? "—";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative rounded-xl overflow-hidden border cursor-pointer transition-all duration-200",
        isSelected
          ? "border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]"
          : "border-[var(--color-border)] hover:border-[var(--color-border-bright)]"
      )}
      onClick={onClick}
    >
      {/* Poster */}
      <div className="aspect-[2/3] relative bg-[var(--color-bg-panel)]">
        {item.poster_path ? (
          <Image
            src={`${POSTER_BASE}${item.poster_path}`}
            alt={title}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Clapperboard size={32} className="text-[var(--color-text-muted)]" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200" />

        {/* Media type badge */}
        <div className={cn(
          "absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
          mediaType === "movie"
            ? "bg-[var(--color-radarr-glow)] text-[var(--color-radarr)] border border-[var(--color-radarr)]"
            : "bg-[var(--color-sonarr-glow)] text-[var(--color-sonarr)] border border-[var(--color-sonarr)]"
        )}>
          {mediaType === "movie" ? <Film size={9} /> : <Tv2 size={9} />}
          {mediaType === "movie" ? "Movie" : "TV"}
        </div>

        {/* Rating */}
        {item.vote_average > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 text-[10px] text-[var(--color-warning)]">
            <Star size={9} fill="currentColor" />
            {item.vote_average.toFixed(1)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 bg-[var(--color-bg-card)]">
        <p className="text-white text-xs font-semibold truncate leading-snug">{title}</p>
        <p className="text-[var(--color-text-muted)] text-[10px] mt-0.5">{year}</p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Search tab
// ---------------------------------------------------------------------------

interface SearchTabProps {
  onSelect: (id: number, type: "movie" | "tv") => void;
  selectedId: number | null;
  libraryMovieIds: Set<number>;
  libraryShowIds: Set<number>;
}

function SearchTab({ onSelect, selectedId, libraryMovieIds, libraryShowIds }: SearchTabProps) {
  const { tmdbApi } = useApi();
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"movie" | "tv" | "multi">("multi");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<TmdbPageResult<TmdbMovie | TmdbShow | TmdbItem>>({
    queryKey: ["tmdb-search", query, searchType, page],
    queryFn: async () => {
      const endpoint = searchType === "multi" ? "/search/multi" : `/search/${searchType}`;
      const res = await tmdbApi.get(endpoint, {
        params: { query, page, include_adult: false },
      });
      return res.data;
    },
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  });

  const results = (data?.results ?? []).filter((r) => {
    const mt = "media_type" in r
      ? (r as TmdbItem).media_type
      : searchType;
    if (mt !== "movie" && mt !== "tv") return false;
    if (mt === "movie" && libraryMovieIds.has(r.id)) return false;
    if (mt === "tv" && libraryShowIds.has(r.id)) return false;
    return true;
  });

  function getMediaType(item: TmdbMovie | TmdbShow | TmdbItem): "movie" | "tv" {
    if ("media_type" in item) return item.media_type as "movie" | "tv";
    return searchType as "movie" | "tv";
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder="Search movies and TV shows..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>
        <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)]">
          {(["multi", "movie", "tv"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSearchType(t)}
              className={cn(
                "px-3 py-2 text-xs font-semibold transition-colors",
                searchType === t ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-bg-card)] text-[var(--color-text-muted)] hover:text-white"
              )}
            >
              {t === "multi" ? "All" : t === "movie" ? "Movies" : "Shows"}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      {query.trim().length >= 2 && isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm">
          <AlertCircle size={16} /> Failed to fetch results. Check your TMDB API key in Settings.
        </div>
      )}
      {query.trim().length >= 2 && !isLoading && results.length === 0 && (
        <div className="text-center py-12 text-[var(--color-text-muted)]">No results for &ldquo;{query}&rdquo;</div>
      )}
      {query.trim().length < 2 && (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
          <Search size={36} className="mb-3 opacity-30" />
          <p className="text-sm">Type at least 2 characters to search</p>
        </div>
      )}

      {/* Grid */}
      {results.length > 0 && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {results.map((item) => {
              const mt = getMediaType(item);
              return (
                <ResultCard
                  key={item.id}
                  item={item as TmdbMovie | TmdbShow}
                  mediaType={mt}
                  isSelected={selectedId === item.id}
                  onClick={() => onSelect(item.id, mt)}
                />
              );
            })}
          </div>

          {/* Pagination */}
          {(data?.total_pages ?? 1) > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm text-[var(--color-text-muted)]">
                Page {page} of {Math.min(data?.total_pages ?? 1, 500)}
              </span>
              <button onClick={() => setPage((p) => Math.min(p + 1, data?.total_pages ?? 1))} disabled={page >= (data?.total_pages ?? 1)}
                className="w-8 h-8 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discover tab
// ---------------------------------------------------------------------------

interface DiscoverTabProps {
  onSelect: (id: number, type: "movie" | "tv") => void;
  selectedId: number | null;
  libraryMovieIds: Set<number>;
  libraryShowIds: Set<number>;
}

function DiscoverTab({ onSelect, selectedId, libraryMovieIds, libraryShowIds }: DiscoverTabProps) {
  const { tmdbApi } = useApi();
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [genreId, setGenreId] = useState<number | "">("");
  const [sortBy, setSortBy] = useState("popularity.desc");
  const [language, setLanguage] = useState("");
  const [providerId, setProviderId] = useState<number | "">("");
  const [networkId, setNetworkId] = useState<number | "">("");
  const [page, setPage] = useState(1);

  const genres = mediaType === "movie" ? MOVIE_GENRES : TV_GENRES;

  // Fetch streaming providers from TMDB (region US)
  const { data: providersData } = useQuery<TmdbProvider[]>({
    queryKey: ["tmdb-providers", mediaType],
    queryFn: async () => {
      const endpoint = mediaType === "movie" ? "/watch/providers/movie" : "/watch/providers/tv";
      const res = await tmdbApi.get(endpoint, { params: { watch_region: "US", language: "en-US" } });
      const results = (res.data.results ?? []) as TmdbProvider[];
      return results
        .sort((a, b) => (a.display_priorities?.US ?? 999) - (b.display_priorities?.US ?? 999))
        .slice(0, 30);
    },
    staleTime: 3_600_000,
  });

  const { data, isLoading, isError } = useQuery<TmdbPageResult<TmdbMovie | TmdbShow>>({
    queryKey: ["tmdb-discover", mediaType, genreId, sortBy, language, providerId, networkId, page],
    queryFn: async () => {
      const endpoint = mediaType === "movie" ? "/discover/movie" : "/discover/tv";
      const params: Record<string, string | number> = {
        sort_by: sortBy,
        page,
        "vote_count.gte": 50,
      };
      if (genreId !== "") params.with_genres = genreId;
      if (language) params.with_original_language = language;
      if (providerId !== "") {
        params.with_watch_providers = providerId;
        params.watch_region = "US";
      }
      if (networkId !== "" && mediaType === "tv") params.with_networks = networkId;
      const res = await tmdbApi.get(endpoint, { params });
      return res.data;
    },
    staleTime: 60_000,
  });

  function handleMediaTypeChange(t: "movie" | "tv") {
    setMediaType(t);
    setGenreId("");
    setNetworkId("");
    setPage(1);
  }

  const activeFilterCount = [genreId !== "", language !== "", providerId !== "", networkId !== ""].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Row 1: media type + primary filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Media type toggle */}
        <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)]">
          <button
            onClick={() => handleMediaTypeChange("movie")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors",
              mediaType === "movie" ? "bg-[var(--color-radarr)] text-white" : "bg-[var(--color-bg-card)] text-[var(--color-text-muted)] hover:text-white"
            )}
          >
            <Film size={14} /> Movies
          </button>
          <button
            onClick={() => handleMediaTypeChange("tv")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition-colors",
              mediaType === "tv" ? "bg-[var(--color-sonarr)] text-white" : "bg-[var(--color-bg-card)] text-[var(--color-text-muted)] hover:text-white"
            )}
          >
            <Tv2 size={14} /> TV Shows
          </button>
        </div>

        {/* Genre filter */}
        <select
          value={genreId}
          onChange={(e) => { setGenreId(e.target.value === "" ? "" : Number(e.target.value)); setPage(1); }}
          className="px-3 py-2 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        >
          <option value="">All Genres</option>
          {genres.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>

        {/* Language filter */}
        <select
          value={language}
          onChange={(e) => { setLanguage(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        >
          <option value="">Any Language</option>
          {COMMON_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>

        {/* Network filter (TV only) */}
        {mediaType === "tv" && (
          <select
            value={networkId}
            onChange={(e) => { setNetworkId(e.target.value === "" ? "" : Number(e.target.value)); setPage(1); }}
            className="px-3 py-2 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          >
            <option value="">Any Network</option>
            {TV_NETWORKS.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        )}

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-white focus:outline-none focus:border-[var(--color-accent)] transition-colors"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setGenreId(""); setLanguage(""); setProviderId(""); setNetworkId(""); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--color-danger)] border border-[var(--color-danger)]/40 hover:bg-[var(--color-danger)]/10 transition-colors"
          >
            <X size={12} /> Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Row 2: Streaming provider picker */}
      {providersData && providersData.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mr-1">
            {mediaType === "movie" ? "Stream on" : "Available on"}
          </span>
          <button
            onClick={() => { setProviderId(""); setPage(1); }}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold border transition-all",
              providerId === ""
                ? "bg-[var(--color-accent)] text-white border-transparent"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-border-bright)]"
            )}
          >
            Any
          </button>
          {providersData.map((p) => (
            <button
              key={p.provider_id}
              onClick={() => { setProviderId(providerId === p.provider_id ? "" : p.provider_id); setPage(1); }}
              title={p.provider_name}
              className={cn(
                "w-8 h-8 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0",
                providerId === p.provider_id
                  ? "border-[var(--color-accent)] scale-110 shadow-lg"
                  : "border-transparent hover:border-[var(--color-border-bright)] opacity-70 hover:opacity-100"
              )}
            >
              <Image
                src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                alt={p.provider_name}
                width={32}
                height={32}
                className="w-full h-full object-cover"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm">
          <AlertCircle size={16} /> Failed to load. Check your TMDB API key in Settings.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {(data?.results ?? [])
              .filter((item) =>
                mediaType === "movie"
                  ? !libraryMovieIds.has(item.id)
                  : !libraryShowIds.has(item.id)
              )
              .map((item) => (
                <ResultCard
                  key={item.id}
                  item={item as TmdbMovie | TmdbShow}
                  mediaType={mediaType}
                  isSelected={selectedId === item.id}
                  onClick={() => onSelect(item.id, mediaType)}
                />
              ))}
          </div>

          {/* Pagination */}
          {(data?.total_pages ?? 1) > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm text-[var(--color-text-muted)]">
                Page {page} of {Math.min(data?.total_pages ?? 1, 500)}
              </span>
              <button onClick={() => setPage((p) => Math.min(p + 1, data?.total_pages ?? 1))} disabled={page >= (data?.total_pages ?? 1)}
                className="w-8 h-8 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-white disabled:opacity-30 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trending tab
// ---------------------------------------------------------------------------

interface TrendingTabProps {
  onSelect: (id: number, type: "movie" | "tv") => void;
  selectedId: number | null;
  libraryMovieIds: Set<number>;
  libraryShowIds: Set<number>;
}

function TrendingTab({ onSelect, selectedId, libraryMovieIds, libraryShowIds }: TrendingTabProps) {
  const { tmdbApi } = useApi();
  const [window, setWindow] = useState<"day" | "week">("week");

  const { data, isLoading, isError } = useQuery<TmdbPageResult<TmdbItem>>({
    queryKey: ["tmdb-trending", window],
    queryFn: async () => {
      const res = await tmdbApi.get(`/trending/all/${window}`);
      return res.data;
    },
    staleTime: 300_000, // 5 min for trending
  });

  const results = (data?.results ?? []).filter((r) => {
    if (r.media_type !== "movie" && r.media_type !== "tv") return false;
    if (r.media_type === "movie" && libraryMovieIds.has(r.id)) return false;
    if (r.media_type === "tv" && libraryShowIds.has(r.id)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)]">
          {(["day", "week"] as const).map((w) => (
            <button key={w} onClick={() => setWindow(w)}
              className={cn(
                "px-4 py-2 text-sm font-semibold transition-colors capitalize",
                window === w ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-bg-card)] text-[var(--color-text-muted)] hover:text-white"
              )}>
              {w === "day" ? "Today" : "This Week"}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] text-sm">
          <AlertCircle size={16} /> Failed to load trending. Check your TMDB API key in Settings.
        </div>
      )}
      {!isLoading && !isError && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
          {results.map((item) => (
            <ResultCard
              key={item.id}
              item={item as TmdbMovie | TmdbShow}
              mediaType={item.media_type as "movie" | "tv"}
              isSelected={selectedId === item.id}
              onClick={() => onSelect(item.id, item.media_type as "movie" | "tv")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = "trending" | "discover" | "search";

export default function DiscoverPage() {
  const { tmdb, radarr, sonarr } = useSettings();
  const { radarrApi, sonarrApi } = useApi();
  const [activeTab, setActiveTab] = useState<Tab>("trending");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<"movie" | "tv">("movie");
  const [sendItem, setSendItem] = useState<TmdbItemFull | null>(null);
  const [sendType, setSendType] = useState<"movie" | "tv">("movie");

  // Fetch existing library IDs so we can hide already-owned items
  const { data: radarrMovies } = useQuery<{ tmdbId: number }[]>({
    queryKey: ["radarr-movies-ids"],
    queryFn: async () => {
      const res = await radarrApi.get("/movie");
      return res.data;
    },
    enabled: radarr.enabled && !!radarr.apiKey,
    staleTime: 5 * 60_000,
    select: (data) => data.map((m) => ({ tmdbId: m.tmdbId })),
  });

  const { data: sonarrSeries } = useQuery<{ tmdbId: number }[]>({
    queryKey: ["sonarr-series-ids"],
    queryFn: async () => {
      const res = await sonarrApi.get("/series");
      return res.data;
    },
    enabled: sonarr.enabled && !!sonarr.apiKey,
    staleTime: 5 * 60_000,
    select: (data) => data.map((s: { tmdbId?: number }) => ({ tmdbId: s.tmdbId ?? 0 })),
  });

  const libraryMovieIds = new Set<number>(
    (radarrMovies ?? []).map((m) => m.tmdbId).filter(Boolean)
  );
  const libraryShowIds = new Set<number>(
    (sonarrSeries ?? []).map((s) => s.tmdbId).filter(Boolean)
  );

  const handleSelect = useCallback((id: number, type: "movie" | "tv") => {
    setSelectedId((prev) => (prev === id ? null : id));
    setSelectedType(type);
  }, []);

  const handleSend = useCallback((item: TmdbItemFull, type: "movie" | "tv") => {
    setSendItem(item);
    setSendType(type);
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "trending", label: "Trending", icon: TrendingUp },
    { id: "discover", label: "Discover", icon: LayoutGrid },
    { id: "search", label: "Search", icon: List },
  ];

  if (!tmdb.apiKey) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Discover" subtitle="Find new movies and TV shows via TMDB" />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <Clapperboard size={48} className="mx-auto mb-4 text-[var(--color-text-muted)] opacity-40" />
            <h2 className="text-white font-semibold text-lg mb-2">TMDB API Key Required</h2>
            <p className="text-[var(--color-text-muted)] text-sm">
              Add your TMDB API key in <strong>Settings</strong> to start discovering movies and TV shows.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Discover" subtitle="Find new movies and TV shows via TMDB" />

      <div className="flex-1 flex gap-4 p-6 min-h-0">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] w-fit">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                  activeTab === id
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-muted)] hover:text-white"
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "trending" && (
                <TrendingTab onSelect={handleSelect} selectedId={selectedId} libraryMovieIds={libraryMovieIds} libraryShowIds={libraryShowIds} />
              )}
              {activeTab === "discover" && (
                <DiscoverTab onSelect={handleSelect} selectedId={selectedId} libraryMovieIds={libraryMovieIds} libraryShowIds={libraryShowIds} />
              )}
              {activeTab === "search" && (
                <SearchTab onSelect={handleSelect} selectedId={selectedId} libraryMovieIds={libraryMovieIds} libraryShowIds={libraryShowIds} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedId !== null && (
            <DetailPanel
              key={selectedId}
              tmdbId={selectedId}
              mediaType={selectedType}
              onClose={() => setSelectedId(null)}
              onSend={(item) => handleSend(item, selectedType)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Send modal */}
      <AnimatePresence>
        {sendItem && (
          <SendModal
            item={sendItem}
            mediaType={sendType}
            onClose={() => setSendItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
