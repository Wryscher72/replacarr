"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film, Eye, EyeOff, RefreshCw, Search,
  Star, Clock, HardDrive, CheckCircle2, Calendar,
  Volume2, Globe, Award, Layers, Edit3, Check, X, Bookmark,
  Trash2, Tag, FolderOpen, FilePen, Plus,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/store/settings";
import { formatBytes, formatRuntime, cn } from "@/lib/utils";
import { ManualSearchModal } from "@/components/ManualSearchModal";

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CustomFormat { id: number; name: string; }

interface MediaInfo {
  videoCodec?: string;
  videoFps?: number;
  videoDynamicRange?: string;
  videoDynamicRangeType?: string;
  audioBitrate?: number;
  audioChannels?: number;
  audioCodec?: string;
  audioLanguages?: string;
  subtitles?: string;
  resolution?: string;
  runTime?: string;
  scanType?: string;
}

interface MovieFile {
  id: number;
  relativePath: string;
  path?: string;
  size: number;
  dateAdded: string;
  sceneName?: string;
  releaseGroup?: string;
  edition?: string;
  quality: { quality: { id: number; name: string; source: string; resolution: number }; revision: { version: number; real: number } };
  customFormats?: CustomFormat[];
  customFormatScore?: number;
  languages?: { id: number; name: string }[];
  mediaInfo?: MediaInfo;
}

interface MovieDetail {
  id: number;
  title: string;
  year: number;
  status: string;
  monitored: boolean;
  hasFile: boolean;
  overview: string;
  genres: string[];
  runtime: number;
  sizeOnDisk: number;
  path: string;
  rootFolderPath?: string;
  studio?: string;
  certification?: string;
  inCinemas?: string;
  digitalRelease?: string;
  physicalRelease?: string;
  qualityProfileId: number;
  customFormats?: CustomFormat[];
  customFormatScore?: number;
  originalLanguage?: { id: number; name: string };
  tags?: number[];
  collection?: { title: string; tmdbId: number };
  ratings: { imdb?: { value: number }; tmdb?: { value: number } };
  images: { coverType: string; remoteUrl: string }[];
  movieFile?: MovieFile;
}

interface QualityProfile { id: number; name: string; }
interface TagItem { id: number; label: string; }
interface RootFolder { id: number; path: string; freeSpace: number; }

// ─── Helper Components ────────────────────────────────────────────────────────

function Stat({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-white mt-0.5 flex items-center gap-1">
        {icon}{value}
      </p>
    </div>
  );
}

function ActionBtn({
  icon, label, active, color = "var(--color-radarr)", onClick, loading,
}: {
  icon: React.ReactNode; label: string; active?: boolean;
  color?: string; onClick: () => void; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60",
        active ? "text-white" : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-white hover:border-[var(--color-border-bright)]"
      )}
      style={active ? { background: `${color}22`, borderColor: `${color}66`, color } : undefined}
    >
      {loading ? <RefreshCw size={12} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

function QualityBadge({ name, revision }: { name: string; revision?: { version: number; real: number } }) {
  const isProper = revision && revision.version > 1;
  const isReal = revision && revision.real > 0;
  return (
    <span className="flex items-center gap-1">
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--color-bg-base)] text-[var(--color-radarr)] border border-[var(--color-radarr)]/40">
        {name}
      </span>
      {isProper && <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/30">PROPER</span>}
      {isReal && <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-[var(--color-warning)]/15 text-[var(--color-warning)] border border-[var(--color-warning)]/30">REAL</span>}
    </span>
  );
}

function CfScoreBadge({ score }: { score: number }) {
  const color = score >= 0 ? "var(--color-success)" : "var(--color-danger)";
  return (
    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--color-bg-base)] border"
      style={{ color, borderColor: `${color}55` }}>
      <Award size={10} />
      {score >= 0 ? "+" : ""}{score}
    </span>
  );
}

function VideoCodecBadge({ codec }: { codec: string }) {
  if (!codec) return null;
  const short = codec.replace(/\s+/g, "").toUpperCase();
  return (
    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/35">
      {short}
    </span>
  );
}

function HdrBadge({ type }: { type: string }) {
  if (!type || type.toLowerCase() === "none" || type.toLowerCase() === "sdr") return null;
  const isDolby = type.toLowerCase().includes("dolby") || type.toLowerCase().includes("dv");
  return (
    <span className={cn("px-2 py-0.5 rounded text-[11px] font-bold border",
      isDolby ? "bg-blue-500/20 text-blue-300 border-blue-500/35" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/35")}>
      {type.toUpperCase()}
    </span>
  );
}

function AudioBadge({ codec, channels }: { codec?: string; channels?: number }) {
  if (!codec && !channels) return null;
  const label = [codec, channels ? `${channels}ch` : ""].filter(Boolean).join(" ");
  return (
    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
      <Volume2 size={10} /> {label}
    </span>
  );
}

function LanguagePills({ langs }: { langs: { id: number; name: string }[] }) {
  if (!langs || langs.length === 0) return null;
  return (
    <span className="flex items-center gap-1">
      <Globe size={10} className="text-sky-400" />
      {langs.slice(0, 3).map((l) => (
        <span key={l.id} className="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/25">
          {l.name}
        </span>
      ))}
      {langs.length > 3 && <span className="text-[11px] text-slate-400">+{langs.length - 3}</span>}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function MovieDetailModal({ movieId, onClose }: { movieId: number; onClose: () => void }) {
  const id = String(movieId);
  const { radarr } = useSettings();
  const { radarrApi } = useApi();
  const qc = useQueryClient();
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [editingRootFolder, setEditingRootFolder] = useState(false);
  const [selectedRootFolderPath, setSelectedRootFolderPath] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const { data: movie, isLoading } = useQuery<MovieDetail>({
    queryKey: ["radarr-movie-detail", id],
    queryFn: () => radarrApi.get(`/movie/${id}`).then((r) => r.data),
    enabled: !!id && radarr.enabled && !!radarr.apiKey,
  });

  const { data: qualityProfiles } = useQuery<QualityProfile[]>({
    queryKey: ["radarr-qualityprofiles"],
    queryFn: () => radarrApi.get("/qualityprofile").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const { data: tags } = useQuery<TagItem[]>({
    queryKey: ["radarr-tags"],
    queryFn: () => radarrApi.get("/tag").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const { data: rootFolders } = useQuery<RootFolder[]>({
    queryKey: ["radarr-rootfolders"],
    queryFn: () => radarrApi.get("/rootfolder").then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const monitorMutation = useMutation({
    mutationFn: (monitored: boolean) =>
      radarrApi.put(`/movie/${id}`, { ...movie, monitored }),
    onSuccess: (_, monitored) => {
      toast.success(monitored ? "Monitoring enabled" : "Monitoring disabled");
      qc.invalidateQueries({ queryKey: ["radarr-movie-detail", id] });
    },
  });

  const profileMutation = useMutation({
    mutationFn: (qualityProfileId: number) =>
      radarrApi.put(`/movie/${id}`, { ...movie, qualityProfileId }),
    onSuccess: () => {
      toast.success("Quality profile updated");
      qc.invalidateQueries({ queryKey: ["radarr-movie-detail", id] });
      setEditingProfile(false);
    },
  });

  const searchMutation = useMutation({
    mutationFn: () =>
      radarrApi.post("/command", { name: "MoviesSearch", movieIds: [Number(id)] }),
    onSuccess: () => toast.success("Movie search queued"),
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      radarrApi.post("/command", { name: "RefreshMovie", movieId: Number(id) }),
    onSuccess: () => {
      toast.success("Metadata refresh queued");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["radarr-movie-detail", id] }), 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      radarrApi.delete(`/movie/${id}?deleteFiles=${deleteFiles}&addImportListExclusion=false`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["radarr-movies"] });
      onClose();
    },
  });

  const renameMutation = useMutation({
    mutationFn: () =>
      radarrApi.post("/command", { name: "RenameMovie", movieIds: [Number(id)] }),
    onSuccess: () => toast.success("Rename files queued"),
  });

  const rootFolderMutation = useMutation({
    mutationFn: (rootFolderPath: string) =>
      radarrApi.put(`/movie/${id}`, { ...movie, rootFolderPath }, { params: { moveFiles: true } }),
    onSuccess: () => {
      toast.success("Root folder updated — files queued for move");
      setEditingRootFolder(false);
      setSelectedRootFolderPath(null);
      qc.invalidateQueries({ queryKey: ["radarr-movie-detail", id] });
    },
  });

  const tagsMutation = useMutation({
    mutationFn: (tagIds: number[]) =>
      radarrApi.put(`/movie/${id}`, { ...movie, tags: tagIds }),
    onSuccess: () => {
      toast.success("Tags saved");
      setEditingTags(false);
      qc.invalidateQueries({ queryKey: ["radarr-movie-detail", id] });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: number) => radarrApi.delete(`/moviefile/${fileId}`),
    onSuccess: () => {
      toast.success("Movie file deleted");
      qc.invalidateQueries({ queryKey: ["radarr-movie-detail", id] });
      qc.invalidateQueries({ queryKey: ["radarr-movies"] });
    },
    onError: () => toast.error("Failed to delete file"),
  });

  const [confirmDeleteFile, setConfirmDeleteFile] = useState(false);

  const createTagMutation = useMutation({
    mutationFn: (label: string) => radarrApi.post("/tag", { label }),
    onSuccess: async (res) => {
      const newTag: TagItem = res.data;
      await tagsMutation.mutateAsync([...(movie?.tags ?? []), newTag.id]);
      qc.invalidateQueries({ queryKey: ["radarr-tags"] });
      setNewTagLabel("");
    },
    onError: () => toast.error("Failed to create tag"),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (tagId: number) => radarrApi.delete(`/tag/${tagId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["radarr-tags"] }),
    onError: () => toast.error("Failed to delete tag"),
  });

  const poster = movie?.images.find((i) => i.coverType === "poster")?.remoteUrl;
  const fanart = movie?.images.find((i) => i.coverType === "fanart")?.remoteUrl;
  const imdbRating = movie?.ratings?.imdb?.value;
  const tmdbRating = movie?.ratings?.tmdb?.value;
  const currentProfile = qualityProfiles?.find((p) => p.id === movie?.qualityProfileId);
  const mf = movie?.movieFile;

  // Shared overlay wrapper
  const Overlay = ({ children }: { children: React.ReactNode }) => (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-6xl mx-auto my-4 bg-[var(--color-bg-base)] rounded-2xl border border-[var(--color-border)] shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
        {children}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Overlay>
        <div className="p-6 space-y-4">
          <div className="h-56 shimmer rounded-xl" />
          <div className="h-8 shimmer rounded w-1/3" />
          <div className="h-4 shimmer rounded w-2/3" />
        </div>
      </Overlay>
    );
  }

  if (!movie) {
    return (
      <Overlay>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-[var(--color-text-secondary)]">Movie not found.</p>
          <button onClick={onClose} className="text-[var(--color-radarr)] text-sm hover:underline">
            Close
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      {/* Hero */}
      <div className="relative h-64 overflow-hidden">
        {fanart ? (
          <Image src={fanart} alt="" fill className="object-cover" sizes="100vw" priority />
        ) : (
          <div className="w-full h-full bg-[var(--color-bg-card)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-bg-base)] via-[var(--color-bg-base)]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-base)] to-transparent" />

        <div className="absolute bottom-6 left-6 flex items-end gap-5">
          <div className="relative aspect-[2/3] w-28 rounded-xl overflow-hidden border border-[var(--color-border)] shadow-2xl shrink-0">
            {poster ? (
              <Image src={poster} alt={movie.title} fill className="object-cover" sizes="112px" priority />
            ) : (
              <div className="w-full aspect-[2/3] bg-[var(--color-bg-card)] flex items-center justify-center">
                <Film size={24} className="text-[var(--color-text-muted)]" />
              </div>
            )}
          </div>
          <div className="pb-1">
            <h1 className="text-2xl font-bold text-white drop-shadow">{movie.title}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              {movie.genres.slice(0, 3).map((g) => (
                <span key={g} className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/70">{g}</span>
              ))}
              {movie.certification && (
                <span className="text-xs px-2 py-0.5 rounded border border-white/10 bg-white/5 text-white/70">
                  {movie.certification}
                </span>
              )}
              <span className={cn(
                "text-xs px-2 py-0.5 rounded border",
                movie.hasFile
                  ? "text-[var(--color-success)] border-[var(--color-success)]/30 bg-[var(--color-success)]/10"
                  : movie.monitored
                    ? "text-[var(--color-warning)] border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10"
                    : "text-[var(--color-text-muted)] border-white/10 bg-white/5"
              )}>
                {movie.hasFile ? "Downloaded" : movie.monitored ? "Missing" : "Unmonitored"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">

        {/* ─── LEFT SIDEBAR ─── */}
        <aside className="lg:border-r border-[var(--color-border)] p-5 space-y-6">

          {/* Poster */}
          <div className="hidden lg:block mx-auto max-w-[180px]">
            {poster ? (
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-[var(--color-border)] shadow-xl">
                <Image src={poster} alt={movie.title} fill className="object-cover" sizes="180px" />
              </div>
            ) : (
              <div className="w-full aspect-[2/3] bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] flex items-center justify-center">
                <Film size={32} className="text-[var(--color-text-muted)]" />
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {movie.runtime > 0 && (
              <Stat label="Runtime" value={formatRuntime(movie.runtime)} icon={<Clock size={12} />} />
            )}
            {movie.studio && <Stat label="Studio" value={movie.studio} />}
            {imdbRating && (
              <Stat label="IMDb" value={imdbRating.toFixed(1)} icon={<Star size={12} className="text-[var(--color-warning)]" fill="currentColor" />} />
            )}
            {tmdbRating && <Stat label="TMDb" value={tmdbRating.toFixed(1)} />}
            {movie.hasFile && movie.sizeOnDisk > 0 && (
              <Stat label="Size" value={formatBytes(movie.sizeOnDisk)} icon={<HardDrive size={12} />} />
            )}
            {movie.customFormatScore != null && movie.customFormatScore !== 0 && (
              <div>
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">CF Score</p>
                <CfScoreBadge score={movie.customFormatScore} />
              </div>
            )}
            {movie.originalLanguage && (
              <div className="col-span-2">
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Original Language</p>
                <p className="text-sm font-semibold text-white mt-0.5">{movie.originalLanguage.name}</p>
              </div>
            )}
          </div>

          {/* Quality Profile */}
          <div>
            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Quality Profile</p>
            {editingProfile ? (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedProfileId ?? movie.qualityProfileId}
                  onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                  className="flex-1 px-2 py-1 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-xs outline-none"
                >
                  {qualityProfiles?.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button onClick={() => profileMutation.mutate(selectedProfileId ?? movie.qualityProfileId)} disabled={profileMutation.isPending} className="p-1 rounded text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-colors"><Check size={12} /></button>
                <button onClick={() => { setEditingProfile(false); setSelectedProfileId(null); }} className="p-1 rounded text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => { setEditingProfile(true); setSelectedProfileId(movie.qualityProfileId); }} className="flex items-center gap-1 text-sm font-semibold text-white hover:text-[var(--color-radarr)] transition-colors group" title="Click to change quality profile">
                {currentProfile?.name ?? `Profile #${movie.qualityProfileId}`}
                <Edit3 size={14} className="opacity-70 group-hover:opacity-100 text-[var(--color-radarr)]" />
              </button>
            )}
          </div>

          {/* Release dates */}
          {(movie.inCinemas || movie.digitalRelease || movie.physicalRelease) && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Release Dates</p>
              {movie.inCinemas && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)] flex items-center gap-1.5"><Calendar size={11} className="text-[var(--color-radarr)]" /> Cinemas</span>
                  <span className="text-white font-medium">{new Date(movie.inCinemas).toLocaleDateString()}</span>
                </div>
              )}
              {movie.digitalRelease && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)] flex items-center gap-1.5"><Calendar size={11} className="text-[var(--color-radarr)]" /> Digital</span>
                  <span className="text-white font-medium">{new Date(movie.digitalRelease).toLocaleDateString()}</span>
                </div>
              )}
              {movie.physicalRelease && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)] flex items-center gap-1.5"><Calendar size={11} className="text-[var(--color-radarr)]" /> Physical</span>
                  <span className="text-white font-medium">{new Date(movie.physicalRelease).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Root Folder */}
          <div>
            <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
              <FolderOpen size={11} className="text-[var(--color-radarr)]" /> Root Folder
            </p>
            {editingRootFolder ? (
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedRootFolderPath ?? (movie.path ? movie.path.replace(/[/\\][^/\\]+$/, "") : "")}
                  onChange={(e) => setSelectedRootFolderPath(e.target.value)}
                  className="flex-1 px-2 py-1 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-xs outline-none"
                >
                  {rootFolders?.map((rf) => (
                    <option key={rf.id} value={rf.path}>{rf.path}</option>
                  ))}
                </select>
                <button onClick={() => rootFolderMutation.mutate(selectedRootFolderPath ?? "")} disabled={rootFolderMutation.isPending} className="p-1 rounded text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-colors"><Check size={12} /></button>
                <button onClick={() => { setEditingRootFolder(false); setSelectedRootFolderPath(null); }} className="p-1 rounded text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"><X size={12} /></button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingRootFolder(true); setSelectedRootFolderPath(null); }}
                className="flex items-center gap-1 text-xs font-mono text-[var(--color-text-secondary)] hover:text-[var(--color-radarr)] transition-colors group max-w-full"
                title="Click to change root folder"
              >
                <span className="truncate">{movie.rootFolderPath ?? movie.path.replace(/[/\\][^/\\]+$/, "")}</span>
                <Edit3 size={11} className="opacity-70 group-hover:opacity-100 text-[var(--color-radarr)] shrink-0" />
              </button>
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1">
                <Tag size={11} className="text-[var(--color-radarr)]" /> Tags
              </p>
              <button onClick={() => setEditingTags((v) => !v)} className="p-0.5 rounded hover:bg-white/10 transition-colors text-[var(--color-text-muted)] hover:text-white">
                <Edit3 size={11} />
              </button>
            </div>
            {editingTags ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {tags?.map((t) => {
                    const active = (movie.tags ?? []).includes(t.id);
                    return (
                      <div key={t.id} className="flex items-center gap-0.5">
                        <button
                          onClick={() => {
                            const cur = movie.tags ?? [];
                            tagsMutation.mutate(active ? cur.filter((x) => x !== t.id) : [...cur, t.id]);
                          }}
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-l-full border-y border-l transition-all font-medium",
                            active
                              ? "bg-[var(--color-radarr)]/20 border-[var(--color-radarr)]/50 text-[var(--color-radarr)]"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white"
                          )}
                        >
                          {t.label}
                        </button>
                        <button
                          onClick={() => deleteTagMutation.mutate(t.id)}
                          disabled={deleteTagMutation.isPending}
                          title="Delete tag globally"
                          className={cn(
                            "text-[10px] px-1 py-0.5 rounded-r-full border-y border-r transition-all",
                            active
                              ? "border-[var(--color-radarr)]/50 text-[var(--color-radarr)] hover:bg-[var(--color-danger)]/20 hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/50"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                          )}
                        >
                          <X size={8} />
                        </button>
                      </div>
                    );
                  })}
                  {(!tags || tags.length === 0) && <span className="text-xs text-[var(--color-text-muted)] italic">No tags defined</span>}
                </div>
                {/* Create new tag */}
                <form
                  onSubmit={(e) => { e.preventDefault(); if (newTagLabel.trim()) createTagMutation.mutate(newTagLabel.trim()); }}
                  className="flex items-center gap-1"
                >
                  <input
                    value={newTagLabel}
                    onChange={(e) => setNewTagLabel(e.target.value)}
                    placeholder="New tag name"
                    className="flex-1 px-2 py-0.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-[10px] outline-none focus:border-[var(--color-radarr)] min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={!newTagLabel.trim() || createTagMutation.isPending}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--color-radarr)]/20 text-[var(--color-radarr)] border border-[var(--color-radarr)]/40 hover:bg-[var(--color-radarr)]/30 disabled:opacity-40 transition-colors"
                  >
                    <Plus size={10} />
                  </button>
                </form>
                <button onClick={() => setEditingTags(false)} className="text-[10px] text-[var(--color-text-muted)] hover:text-white flex items-center gap-1">
                  <Check size={10} /> Done
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {(movie.tags ?? []).length === 0 && <span className="text-xs text-[var(--color-text-muted)] italic">None</span>}
                {(movie.tags ?? []).map((tid) => {
                  const t = tags?.find((x) => x.id === tid);
                  return (
                    <span key={tid} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-radarr)]/10 text-[var(--color-radarr)] border border-[var(--color-radarr)]/30 font-medium">
                      {t?.label ?? `#${tid}`}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Collection */}
          {movie.collection && (
            <div>
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Collection</p>
              <Link href={`/radarr/collections?highlight=${movie.collection.tmdbId}`} className="text-sm font-semibold text-[var(--color-radarr)] hover:underline">
                {movie.collection.title}
              </Link>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-all"
            >
              <X size={13} /> Close
            </button>
            <ActionBtn icon={movie.monitored ? <Eye size={13} /> : <EyeOff size={13} />} label={movie.monitored ? "Monitored" : "Unmonitored"} active={movie.monitored} onClick={() => monitorMutation.mutate(!movie.monitored)} loading={monitorMutation.isPending} />
            <ActionBtn icon={<RefreshCw size={13} />} label="Refresh" color="var(--color-accent)" onClick={() => refreshMutation.mutate()} loading={refreshMutation.isPending} />
            <ActionBtn icon={<Search size={13} />} label="Search Automatically" onClick={() => searchMutation.mutate()} loading={searchMutation.isPending} />
            <ActionBtn icon={<Search size={13} />} label="Manual Search" color="var(--color-accent)" onClick={() => setShowManualSearch(true)} />
            <ActionBtn icon={<FilePen size={13} />} label="Rename File" color="var(--color-accent)" onClick={() => renameMutation.mutate()} loading={renameMutation.isPending} />
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all mt-2 text-[var(--color-danger)] border-[var(--color-danger)]/30 hover:bg-[var(--color-danger)]/10"
            >
              <Trash2 size={13} /> Delete Movie
            </button>
          </div>

          {/* Overview */}
          {movie.overview && (
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {movie.overview}
            </p>
          )}
        </aside>

        {/* ─── RIGHT PANEL ─── */}
        <main className="p-5 space-y-5 min-w-0">

          {mf ? (
            <>
              {/* Technical badges */}
              <section>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={11} className="text-[var(--color-success)]" /> Downloaded File
                  </p>
                  {!confirmDeleteFile ? (
                    <button
                      onClick={() => setConfirmDeleteFile(true)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[var(--color-danger)] border border-[var(--color-danger)]/30 hover:bg-[var(--color-danger)]/10 transition-colors"
                    >
                      <Trash2 size={10} /> Delete File
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-[var(--color-text-muted)]">Delete file from disk?</span>
                      <button
                        onClick={() => { deleteFileMutation.mutate(mf.id); setConfirmDeleteFile(false); }}
                        disabled={deleteFileMutation.isPending}
                        className="px-2 py-0.5 rounded bg-[var(--color-danger)]/20 text-[var(--color-danger)] border border-[var(--color-danger)]/30 hover:bg-[var(--color-danger)]/30 transition-colors disabled:opacity-50"
                      >
                        {deleteFileMutation.isPending ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button onClick={() => setConfirmDeleteFile(false)} className="px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-colors">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                  <QualityBadge name={mf.quality.quality.name} revision={mf.quality.revision} />
                  {mf.customFormatScore != null && <CfScoreBadge score={mf.customFormatScore} />}
                  {mf.mediaInfo?.videoCodec && <VideoCodecBadge codec={mf.mediaInfo.videoCodec} />}
                  {mf.mediaInfo?.videoDynamicRangeType && <HdrBadge type={mf.mediaInfo.videoDynamicRangeType} />}
                  <AudioBadge codec={mf.mediaInfo?.audioCodec} channels={mf.mediaInfo?.audioChannels} />
                  {mf.edition && (
                    <span className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/35">
                      <Bookmark size={10} /> {mf.edition}
                    </span>
                  )}
                  {mf.releaseGroup && (
                    <span className="ml-auto text-[11px] font-mono text-slate-300 px-2 py-0.5 rounded bg-[var(--color-bg-base)] border border-slate-500/40">
                      {mf.releaseGroup}
                    </span>
                  )}
                </div>
              </section>

              {/* Media Info Grid */}
              {mf.mediaInfo && (
                <section>
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Technical Details</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {mf.mediaInfo.resolution && (
                      <div className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                        <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Resolution</p>
                        <p className="text-sm font-bold text-white mt-1">{mf.mediaInfo.resolution}</p>
                      </div>
                    )}
                    {mf.mediaInfo.videoCodec && (
                      <div className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                        <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Video Codec</p>
                        <p className="text-sm font-bold text-purple-400 mt-1">{mf.mediaInfo.videoCodec}</p>
                      </div>
                    )}
                    {mf.mediaInfo.videoDynamicRangeType && mf.mediaInfo.videoDynamicRangeType !== "None" && (
                      <div className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                        <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">HDR Format</p>
                        <p className="text-sm font-bold text-yellow-400 mt-1">{mf.mediaInfo.videoDynamicRangeType}</p>
                      </div>
                    )}
                    {mf.mediaInfo.videoFps && (
                      <div className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                        <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Frame Rate</p>
                        <p className="text-sm font-bold text-white mt-1">{mf.mediaInfo.videoFps} fps</p>
                      </div>
                    )}
                    {mf.mediaInfo.audioCodec && (
                      <div className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                        <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Audio Codec</p>
                        <p className="text-sm font-bold text-emerald-400 mt-1">{mf.mediaInfo.audioCodec}</p>
                      </div>
                    )}
                    {mf.mediaInfo.audioChannels && (
                      <div className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                        <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Channels</p>
                        <p className="text-sm font-bold text-emerald-400 mt-1">{mf.mediaInfo.audioChannels}ch</p>
                      </div>
                    )}
                    {mf.mediaInfo.audioBitrate && (
                      <div className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                        <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Audio Bitrate</p>
                        <p className="text-sm font-bold text-white mt-1">{Math.round(mf.mediaInfo.audioBitrate / 1000)} kbps</p>
                      </div>
                    )}
                    {mf.mediaInfo.runTime && (
                      <div className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                        <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Run Time</p>
                        <p className="text-sm font-bold text-white mt-1">{mf.mediaInfo.runTime}</p>
                      </div>
                    )}
                    <div className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                      <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">File Size</p>
                      <p className="text-sm font-bold text-white mt-1">{formatBytes(mf.size)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                      <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Date Added</p>
                      <p className="text-sm font-bold text-white mt-1">{new Date(mf.dateAdded).toLocaleDateString()}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Custom Formats (file-level) */}
              {mf.customFormats && mf.customFormats.length > 0 && (
                <section>
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers size={11} className="text-violet-400" /> Custom Formats
                    {mf.customFormatScore != null && <CfScoreBadge score={mf.customFormatScore} />}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {mf.customFormats.map((cf) => (
                      <span key={cf.id} className="px-2.5 py-1 rounded-lg text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                        {cf.name}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Movie-level Custom Formats */}
              {movie.customFormats && movie.customFormats.length > 0 && mf.customFormats?.length === 0 && (
                <section>
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Layers size={11} className="text-violet-400" /> Custom Formats (Movie)
                    {movie.customFormatScore != null && <CfScoreBadge score={movie.customFormatScore} />}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {movie.customFormats.map((cf) => (
                      <span key={cf.id} className="px-2.5 py-1 rounded-lg text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                        {cf.name}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Languages & Subtitles */}
              {((mf.languages && mf.languages.length > 0) || mf.mediaInfo?.subtitles) && (
                <section className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] space-y-3">
                  {mf.languages && mf.languages.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Globe size={10} /> Audio Languages
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {mf.languages.map((l) => (
                          <span key={l.id} className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                            {l.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {mf.mediaInfo?.subtitles && (
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Subtitles</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{mf.mediaInfo.subtitles}</p>
                    </div>
                  )}
                  {movie.originalLanguage && (
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Original Language</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{movie.originalLanguage.name}</p>
                    </div>
                  )}
                </section>
              )}

              {/* Release Info */}
              <section className="p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] space-y-2">
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Release Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-xs">
                  {mf.releaseGroup && (
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text-muted)] w-24 shrink-0">Release Group</span>
                      <span className="text-white font-mono font-semibold">{mf.releaseGroup}</span>
                    </div>
                  )}
                  {mf.edition && (
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text-muted)] w-24 shrink-0">Edition</span>
                      <span className="text-amber-400 font-semibold">{mf.edition}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-text-muted)] w-24 shrink-0">File Size</span>
                    <span className="text-white">{formatBytes(mf.size)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-text-muted)] w-24 shrink-0">Added</span>
                    <span className="text-white">{new Date(mf.dateAdded).toLocaleDateString()}</span>
                  </div>
                </div>
                {mf.sceneName && (
                  <div className="pt-1">
                    <p className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">Scene Name</p>
                    <p className="text-[10px] font-mono text-[var(--color-text-secondary)] break-all">{mf.sceneName}</p>
                  </div>
                )}
                <div className="pt-1 border-t border-[var(--color-border)]">
                  <p className="text-[9px] font-mono text-[var(--color-text-muted)] break-all" title={mf.relativePath}>{mf.relativePath}</p>
                </div>
              </section>
            </>
          ) : (
            /* No file state */
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] flex items-center justify-center">
                <Film size={28} className="text-[var(--color-text-muted)]" />
              </div>
              <p className="text-white font-semibold">No file downloaded</p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {movie.monitored ? "Searching for releases automatically" : "Movie is unmonitored"}
              </p>
              <button
                onClick={() => setShowManualSearch(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-all"
                style={{ background: "color-mix(in srgb, var(--color-radarr) 15%, transparent)", color: "var(--color-radarr)", borderColor: "color-mix(in srgb, var(--color-radarr) 40%, transparent)" }}
              >
                <Search size={12} /> Manual Search
              </button>
            </div>
          )}

          {/* Movie-level custom formats when no file */}
          {!mf && movie.customFormats && movie.customFormats.length > 0 && (
            <section>
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Layers size={11} className="text-violet-400" /> Custom Formats
              </p>
              <div className="flex flex-wrap gap-1.5">
                {movie.customFormats.map((cf) => (
                  <span key={cf.id} className="px-2.5 py-1 rounded-lg text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                    {cf.name}
                  </span>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Delete Confirm Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-sm space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-danger)]/15 border border-[var(--color-danger)]/30 flex items-center justify-center shrink-0">
                  <Trash2 size={16} className="text-[var(--color-danger)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Delete Movie</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{movie.title}</p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deleteFiles}
                  onChange={(e) => setDeleteFiles(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[var(--color-danger)]"
                />
                <span className="text-xs text-[var(--color-text-secondary)]">Also delete movie files from disk</span>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold bg-[var(--color-danger)]/20 hover:bg-[var(--color-danger)]/30 text-[var(--color-danger)] border border-[var(--color-danger)]/30 transition-all disabled:opacity-50"
                >
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual Search Modal */}
      {showManualSearch && movie && (
        <ManualSearchModal
          service="radarr"
          mediaId={movie.id}
          title={movie.title}
          onClose={() => setShowManualSearch(false)}
        />
      )}
    </Overlay>
  );
}
