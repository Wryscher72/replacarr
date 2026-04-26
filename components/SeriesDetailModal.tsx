"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv2, Eye, EyeOff, RefreshCw, Search,
  ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Clock, EyeIcon,
  Volume2, Globe, Award, Layers, Edit3, Check, X, Subtitles,
  Trash2, Tag, FolderOpen, FilePen, Plus,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/store/settings";
import { formatBytes, cn } from "@/lib/utils";
import { ManualSearchModal } from "@/components/ManualSearchModal";
import { SeasonSearchModal } from "@/components/SeasonSearchModal";

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

interface EpisodeFile {
  id: number;
  seriesId: number;
  seasonNumber: number;
  relativePath: string;
  path?: string;
  size: number;
  dateAdded: string;
  releaseGroup?: string;
  sceneName?: string;
  quality: { quality: { id: number; name: string; source: string; resolution: number }; revision: { version: number; real: number } };
  customFormats?: CustomFormat[];
  customFormatScore?: number;
  languages?: { id: number; name: string }[];
  mediaInfo?: MediaInfo;
}

interface Episode {
  id: number;
  title: string;
  episodeNumber: number;
  seasonNumber: number;
  airDateUtc?: string;
  overview?: string;
  monitored: boolean;
  hasFile: boolean;
  episodeFileId?: number;
}

interface SeasonStats { episodeCount: number; episodeFileCount: number; percentOfEpisodes: number; }

type MonitorStrategy = "all" | "future" | "missing" | "existing" | "first" | "latest" | "none";

interface SeriesDetail {
  id: number;
  title: string;
  year: number;
  status: string;
  monitored: boolean;
  monitorNewItems?: "all" | "none";
  overview: string;
  network: string;
  genres: string[];
  path: string;
  qualityProfileId: number;
  tags: number[];
  statistics: {
    seasonCount: number;
    episodeFileCount: number;
    episodeCount: number;
    sizeOnDisk: number;
    percentOfEpisodes: number;
  };
  images: { coverType: string; remoteUrl: string }[];
  seasons: { seasonNumber: number; monitored: boolean; statistics: SeasonStats }[];
}

interface QualityProfile { id: number; name: string; }
interface TagItem { id: number; label: string; }
interface RootFolder { id: number; path: string; freeSpace: number; }

// ─── Helper Components ────────────────────────────────────────────────────────

function EpisodeIcon({ ep }: { ep: Episode }) {
  if (ep.hasFile) return <CheckCircle2 size={13} className="text-[var(--color-success)] shrink-0" />;
  if (!ep.monitored) return <EyeOff size={13} className="text-[var(--color-text-muted)] shrink-0" />;
  const airDate = ep.airDateUtc ? new Date(ep.airDateUtc) : null;
  if (!airDate || airDate > new Date()) return <Clock size={13} className="text-[var(--color-text-muted)] shrink-0" />;
  return <AlertTriangle size={13} className="text-[var(--color-warning)] shrink-0" />;
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-white mt-0.5">{value}</p>
    </div>
  );
}

function ActionBtn({
  icon, label, active, color = "var(--color-sonarr)", onClick, loading,
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
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--color-bg-base)] text-[var(--color-sonarr)] border border-[var(--color-sonarr)]/40">
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

// ─── Episode Row ─────────────────────────────────────────────────────────────

function EpisodeRow({
  ep,
  file,
  seriesTitle,
  onManualSearch,
  onToggleMonitor,
  onDeleteFile,
}: {
  ep: Episode;
  file?: EpisodeFile;
  seriesTitle: string;
  onManualSearch: (episodeId: number, title: string) => void;
  onToggleMonitor: (ep: Episode) => void;
  onDeleteFile: (fileId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const hasFile = ep.hasFile && !!file;

  return (
    <div className="border-b border-[var(--color-border)]/40 last:border-0">
      <div
        className={cn(
          "flex items-start gap-2 px-3 py-2.5 hover:bg-white/3 transition-colors group/ep",
          hasFile && "cursor-pointer"
        )}
        onClick={() => hasFile && setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-1.5 pt-0.5 shrink-0">
          <EpisodeIcon ep={ep} />
          <span className="text-[10px] font-mono text-[var(--color-text-muted)] w-7">
            E{String(ep.episodeNumber).padStart(2, "0")}
          </span>
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white truncate">{ep.title}</span>
            {ep.airDateUtc && (
              <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 ml-auto">
                {new Date(ep.airDateUtc).toLocaleDateString()}
              </span>
            )}
          </div>
          {hasFile && (
            <div className="flex items-center flex-wrap gap-1">
              <QualityBadge name={file.quality.quality.name} revision={file.quality.revision} />
              {file.customFormatScore != null && file.customFormatScore !== 0 && (
                <CfScoreBadge score={file.customFormatScore} />
              )}
              {file.mediaInfo?.videoCodec && <VideoCodecBadge codec={file.mediaInfo.videoCodec} />}
              {file.mediaInfo?.videoDynamicRangeType && (
                <HdrBadge type={file.mediaInfo.videoDynamicRangeType} />
              )}
              <AudioBadge codec={file.mediaInfo?.audioCodec} channels={file.mediaInfo?.audioChannels} />
              {file.languages && file.languages.length > 0 && (
                <span className="flex items-center gap-1">
                  <Globe size={10} className="text-sky-400" />
                  <span className="text-[11px] text-sky-300">
                    {file.languages.slice(0, 2).map(l => l.name).join(" / ")}
                  </span>
                </span>
              )}
              {file.releaseGroup && (
                <span className="text-[11px] font-mono text-slate-300 px-2 py-0.5 rounded bg-[var(--color-bg-base)] border border-slate-500/40">
                  {file.releaseGroup}
                </span>
              )}
              {file.size > 0 && (
                <span className="text-[11px] font-mono text-slate-400 ml-auto">
                  {formatBytes(file.size)}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMonitor(ep); }}
            className="opacity-0 group-hover/ep:opacity-100 flex items-center justify-center w-5 h-5 rounded border transition-all"
            style={ep.monitored
              ? { background: "color-mix(in srgb, var(--color-sonarr) 15%, transparent)", color: "var(--color-sonarr)", borderColor: "color-mix(in srgb, var(--color-sonarr) 35%, transparent)" }
              : { borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
            title={ep.monitored ? "Unmonitor episode" : "Monitor episode"}
          >
            {ep.monitored ? <Eye size={9} /> : <EyeOff size={9} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onManualSearch(ep.id, `${seriesTitle} S${String(ep.seasonNumber).padStart(2, "00")}E${String(ep.episodeNumber).padStart(2, "00")} \u2013 ${ep.title}`);
            }}
            className="opacity-0 group-hover/ep:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all"
            style={{ background: "color-mix(in srgb, var(--color-sonarr) 15%, transparent)", color: "var(--color-sonarr)", border: "1px solid var(--color-sonarr)33" }}
            title="Manual search releases"
          >
            <Search size={9} /> Search
          </button>
          {hasFile ? (
            <div className="text-[var(--color-text-muted)]">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>
          ) : <div className="w-3" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && hasFile && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-3 p-3 rounded-lg bg-[var(--color-bg-base)] border border-[var(--color-border)]/60 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <QualityBadge name={file.quality.quality.name} revision={file.quality.revision} />
                {file.customFormatScore != null && <CfScoreBadge score={file.customFormatScore} />}
                {file.mediaInfo?.videoCodec && <VideoCodecBadge codec={file.mediaInfo.videoCodec} />}
                {file.mediaInfo?.videoDynamicRangeType && <HdrBadge type={file.mediaInfo.videoDynamicRangeType} />}
                <AudioBadge codec={file.mediaInfo?.audioCodec} channels={file.mediaInfo?.audioChannels} />
              </div>

              {file.customFormats && file.customFormats.length > 0 && (
                <div className="flex flex-wrap items-center gap-1">
                  <Layers size={10} className="text-[var(--color-text-muted)]" />
                  {file.customFormats.map((cf) => (
                    <span key={cf.id} className="px-1.5 py-0.5 rounded text-[9px] bg-violet-500/10 text-violet-400 border border-violet-500/20 font-medium">
                      {cf.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {file.languages && <LanguagePills langs={file.languages} />}
                {file.mediaInfo?.subtitles && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                    <Subtitles size={9} /> {file.mediaInfo.subtitles}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px] text-[var(--color-text-muted)]">
                {file.releaseGroup && (
                  <span><span className="text-[var(--color-text-secondary)] font-semibold">Group:</span> {file.releaseGroup}</span>
                )}
                <span><span className="text-[var(--color-text-secondary)] font-semibold">Size:</span> {formatBytes(file.size)}</span>
                <span><span className="text-[var(--color-text-secondary)] font-semibold">Added:</span> {new Date(file.dateAdded).toLocaleDateString()}</span>
                {file.mediaInfo?.resolution && (
                  <span><span className="text-[var(--color-text-secondary)] font-semibold">Res:</span> {file.mediaInfo.resolution}</span>
                )}
              </div>

              <p className="text-[10px] font-mono text-[var(--color-text-muted)] truncate" title={file.relativePath}>
                {file.relativePath}
              </p>

              {/* Delete file */}
              <div className="pt-1 border-t border-[var(--color-border)]/40">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 text-[10px] text-[var(--color-danger)] hover:text-[var(--color-danger)] opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={10} /> Delete this file
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="text-[var(--color-text-muted)]">Delete from disk?</span>
                    <button
                      onClick={() => { onDeleteFile(file.id); setConfirmDelete(false); setExpanded(false); }}
                      className="px-2 py-0.5 rounded bg-[var(--color-danger)]/20 text-[var(--color-danger)] border border-[var(--color-danger)]/30 hover:bg-[var(--color-danger)]/30 transition-colors"
                    >Yes</button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-colors"
                    >Cancel</button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function SeriesDetailModal({ seriesId, onClose }: { seriesId: number; onClose: () => void }) {
  const id = String(seriesId);
  const { sonarr } = useSettings();
  const { sonarrApi } = useApi();
  const qc = useQueryClient();
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(new Set([1]));
  const [manualSearch, setManualSearch] = useState<{ episodeId: number; title: string } | null>(null);
  const [seasonModal, setSeasonModal] = useState<number | null>(null);
  const [searchingSeasons, setSearchingSeasons] = useState<Set<number>>(new Set());
  const [queuedSeasons, setQueuedSeasons] = useState<Set<number>>(new Set());
  const [errorSeasons, setErrorSeasons] = useState<Set<number>>(new Set());
  const [editingProfile, setEditingProfile] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [editingRootFolder, setEditingRootFolder] = useState(false);
  const [selectedRootFolderPath, setSelectedRootFolderPath] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [showMonitorDialog, setShowMonitorDialog] = useState(false);
  const [monitorStrategy, setMonitorStrategy] = useState<MonitorStrategy>("all");
  const [monitorNewItemsSetting, setMonitorNewItemsSetting] = useState<"all" | "none">("all");

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const { data: series, isLoading } = useQuery<SeriesDetail>({
    queryKey: ["sonarr-series-detail", id],
    queryFn: () => sonarrApi.get(`/series/${id}`).then((r) => r.data),
    enabled: !!id && sonarr.enabled && !!sonarr.apiKey,
  });

  const { data: episodes } = useQuery<Episode[]>({
    queryKey: ["sonarr-episodes", id],
    queryFn: () => sonarrApi.get(`/episode?seriesId=${id}`).then((r) => r.data),
    enabled: !!id && sonarr.enabled && !!sonarr.apiKey,
  });

  const { data: episodeFiles } = useQuery<EpisodeFile[]>({
    queryKey: ["sonarr-episodefiles", id],
    queryFn: () => sonarrApi.get(`/episodefile?seriesId=${id}`).then((r) => r.data),
    enabled: !!id && sonarr.enabled && !!sonarr.apiKey,
  });

  const { data: qualityProfiles } = useQuery<QualityProfile[]>({
    queryKey: ["sonarr-qualityprofiles"],
    queryFn: () => sonarrApi.get("/qualityprofile").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });

  const { data: tags } = useQuery<TagItem[]>({
    queryKey: ["sonarr-tags"],
    queryFn: () => sonarrApi.get("/tag").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });

  const { data: rootFolders } = useQuery<RootFolder[]>({
    queryKey: ["sonarr-rootfolders"],
    queryFn: () => sonarrApi.get("/rootfolder").then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });

  const applyMonitorMutation = useMutation({
    mutationFn: async ({ strategy, monitorNewItems }: { strategy: MonitorStrategy; monitorNewItems: "all" | "none" }) => {
      if (!series) throw new Error("No series");
      const now = new Date();
      const realSeasons = series.seasons.filter((s) => s.seasonNumber > 0);
      const realEps = (episodes ?? []).filter((e) => e.seasonNumber > 0);
      const isMonitored = strategy !== "none";

      let updatedSeasons = series.seasons.map((s) => ({ ...s, monitored: false }));
      let monitoredIds: number[] = [];
      let unmonitoredIds: number[] = [];

      switch (strategy) {
        case "all":
          updatedSeasons = series.seasons.map((s) => ({ ...s, monitored: s.seasonNumber > 0 }));
          monitoredIds = realEps.map((e) => e.id);
          break;
        case "future": {
          updatedSeasons = series.seasons.map((s) => ({ ...s, monitored: s.seasonNumber > 0 }));
          const future = realEps.filter((e) => !e.airDateUtc || new Date(e.airDateUtc) > now);
          const aired = realEps.filter((e) => e.airDateUtc && new Date(e.airDateUtc) <= now);
          monitoredIds = future.map((e) => e.id);
          unmonitoredIds = aired.map((e) => e.id);
          break;
        }
        case "missing": {
          updatedSeasons = series.seasons.map((s) => ({ ...s, monitored: s.seasonNumber > 0 }));
          monitoredIds = realEps.filter((e) => !e.hasFile).map((e) => e.id);
          unmonitoredIds = realEps.filter((e) => e.hasFile).map((e) => e.id);
          break;
        }
        case "existing": {
          updatedSeasons = series.seasons.map((s) => ({ ...s, monitored: s.seasonNumber > 0 }));
          monitoredIds = realEps.filter((e) => e.hasFile).map((e) => e.id);
          unmonitoredIds = realEps.filter((e) => !e.hasFile).map((e) => e.id);
          break;
        }
        case "first": {
          const firstNum = Math.min(...realSeasons.map((s) => s.seasonNumber));
          updatedSeasons = series.seasons.map((s) => ({ ...s, monitored: s.seasonNumber === firstNum }));
          monitoredIds = realEps.filter((e) => e.seasonNumber === firstNum).map((e) => e.id);
          unmonitoredIds = realEps.filter((e) => e.seasonNumber !== firstNum).map((e) => e.id);
          break;
        }
        case "latest": {
          const latestNum = Math.max(...realSeasons.map((s) => s.seasonNumber));
          updatedSeasons = series.seasons.map((s) => ({ ...s, monitored: s.seasonNumber === latestNum }));
          monitoredIds = realEps.filter((e) => e.seasonNumber === latestNum).map((e) => e.id);
          unmonitoredIds = realEps.filter((e) => e.seasonNumber !== latestNum).map((e) => e.id);
          break;
        }
        case "none":
          updatedSeasons = series.seasons.map((s) => ({ ...s, monitored: false }));
          unmonitoredIds = realEps.map((e) => e.id);
          break;
      }

      await sonarrApi.put(`/series/${id}`, {
        ...series,
        monitored: isMonitored,
        monitorNewItems,
        seasons: updatedSeasons,
      });

      if (monitoredIds.length > 0)
        await sonarrApi.put("/episode/monitor", { episodeIds: monitoredIds, monitored: true });
      if (unmonitoredIds.length > 0)
        await sonarrApi.put("/episode/monitor", { episodeIds: unmonitoredIds, monitored: false });
    },
    onSuccess: () => {
      toast.success("Monitor strategy applied");
      qc.invalidateQueries({ queryKey: ["sonarr-series-detail", id] });
      qc.invalidateQueries({ queryKey: ["sonarr-episodes", id] });
      setShowMonitorDialog(false);
    },
  });

  const seasonMonitorMutation = useMutation({
    mutationFn: ({ seasonNumber, monitored }: { seasonNumber: number; monitored: boolean }) => {
      if (!series) throw new Error("No series data");
      const updated = {
        ...series,
        seasons: series.seasons.map((s) =>
          s.seasonNumber === seasonNumber ? { ...s, monitored } : s
        ),
      };
      return sonarrApi.put(`/series/${id}`, updated);
    },
    onSuccess: (_, { monitored }) => {
      toast.success(monitored ? "Season monitored" : "Season unmonitored");
      qc.invalidateQueries({ queryKey: ["sonarr-series-detail", id] });
    },
  });

  const profileMutation = useMutation({
    mutationFn: (qualityProfileId: number) =>
      sonarrApi.put(`/series/${id}`, { ...series, qualityProfileId }),
    onSuccess: () => {
      toast.success("Quality profile updated");
      qc.invalidateQueries({ queryKey: ["sonarr-series-detail", id] });
      setEditingProfile(false);
    },
  });

  const searchMutation = useMutation({
    mutationFn: () =>
      sonarrApi.post("/command", { name: "SeriesSearch", seriesId: Number(id) }),
    onSuccess: () => toast.success("Series search queued"),
  });

  const seasonSearchMutation = useMutation({
    mutationFn: (seasonNumber: number) =>
      sonarrApi.post("/command", { name: "SeasonSearch", seriesId: Number(id), seasonNumber }),
    meta: { silent: true },
    onMutate: (seasonNumber) =>
      setSearchingSeasons((prev) => new Set(prev).add(seasonNumber)),
    onSuccess: (_, seasonNumber) => {
      setSearchingSeasons((prev) => { const n = new Set(prev); n.delete(seasonNumber); return n; });
      setQueuedSeasons((prev) => new Set(prev).add(seasonNumber));
      setTimeout(() => setQueuedSeasons((prev) => { const n = new Set(prev); n.delete(seasonNumber); return n; }), 2500);
    },
    onError: (_, seasonNumber) => {
      setSearchingSeasons((prev) => { const n = new Set(prev); n.delete(seasonNumber); return n; });
      setErrorSeasons((prev) => new Set(prev).add(seasonNumber));
      setTimeout(() => setErrorSeasons((prev) => { const n = new Set(prev); n.delete(seasonNumber); return n; }), 3000);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      sonarrApi.post("/command", { name: "RefreshSeries", seriesId: Number(id) }),
    onSuccess: () => {
      toast.success("Metadata refresh queued");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["sonarr-series-detail", id] }), 2000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      sonarrApi.delete(`/series/${id}?deleteFiles=${deleteFiles}&addImportListExclusion=false`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sonarr-series"] });
      onClose();
    },
  });

  const renameMutation = useMutation({
    mutationFn: () =>
      sonarrApi.post("/command", { name: "RenameSeries", seriesIds: [Number(id)] }),
    onSuccess: () => toast.success("Rename files queued"),
  });

  const episodeMonitorMutation = useMutation({
    mutationFn: ({ episodeId, monitored }: { episodeId: number; monitored: boolean }) =>
      sonarrApi.put(`/episode/monitor`, { episodeIds: [episodeId], monitored }),
    meta: { silent: true },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sonarr-episodes", id] }),
  });

  const rootFolderMutation = useMutation({
    mutationFn: (rootFolderPath: string) =>
      sonarrApi.put(`/series/${id}`, { ...series, rootFolderPath }, { params: { moveFiles: true } }),
    onSuccess: () => {
      toast.success("Root folder updated — files queued for move");
      setEditingRootFolder(false);
      setSelectedRootFolderPath(null);
      qc.invalidateQueries({ queryKey: ["sonarr-series-detail", id] });
    },
  });

  const tagsMutation = useMutation({
    mutationFn: (tagIds: number[]) =>
      sonarrApi.put(`/series/${id}`, { ...series, tags: tagIds }),
    onSuccess: () => {
      toast.success("Tags saved");
      setEditingTags(false);
      qc.invalidateQueries({ queryKey: ["sonarr-series-detail", id] });
    },
  });

  const deleteEpisodeFileMutation = useMutation({
    mutationFn: (fileId: number) => sonarrApi.delete(`/episodefile/${fileId}`),
    onSuccess: () => {
      toast.success("Episode file deleted");
      qc.invalidateQueries({ queryKey: ["sonarr-episodefiles", id] });
      qc.invalidateQueries({ queryKey: ["sonarr-episodes", id] });
      qc.invalidateQueries({ queryKey: ["sonarr-series-detail", id] });
    },
    onError: () => toast.error("Failed to delete file"),
  });

  const createTagMutation = useMutation({
    mutationFn: (label: string) => sonarrApi.post("/tag", { label }),
    onSuccess: async (res) => {
      const newTag: { id: number; label: string } = res.data;
      await tagsMutation.mutateAsync([...(series?.tags ?? []), newTag.id]);
      qc.invalidateQueries({ queryKey: ["sonarr-tags"] });
      setNewTagLabel("");
    },
    onError: () => toast.error("Failed to create tag"),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (tagId: number) => sonarrApi.delete(`/tag/${tagId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sonarr-tags"] }),
    onError: () => toast.error("Failed to delete tag"),
  });

  const poster = series?.images.find((i) => i.coverType === "poster")?.remoteUrl;
  const fanart = series?.images.find((i) => i.coverType === "fanart")?.remoteUrl;

  const fileMap = (episodeFiles ?? []).reduce<Record<number, EpisodeFile>>((acc, f) => {
    acc[f.id] = f;
    return acc;
  }, {});

  const currentProfile = qualityProfiles?.find((p) => p.id === series?.qualityProfileId);

  function toggleSeason(n: number) {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }

  const episodesBySeason = (episodes ?? []).reduce<Record<number, Episode[]>>((acc, ep) => {
    (acc[ep.seasonNumber] = acc[ep.seasonNumber] ?? []).push(ep);
    return acc;
  }, {});

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

  if (!series) {
    return (
      <Overlay>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-[var(--color-text-secondary)]">Series not found.</p>
          <button onClick={onClose} className="text-[var(--color-sonarr)] text-sm hover:underline">
            Close
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay>
      {/* Hero */}
      <div className="relative h-56 overflow-hidden">
        {fanart ? (
          <Image src={fanart} alt="" fill className="object-cover" sizes="100vw" priority />
        ) : (
          <div className="w-full h-full bg-[var(--color-bg-card)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-bg-base)] via-[var(--color-bg-base)]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-base)] to-transparent" />

        <div className="absolute bottom-6 left-6 flex items-end gap-5">
          <div className="relative aspect-[2/3] w-24 rounded-xl overflow-hidden border border-[var(--color-border)] shadow-2xl shrink-0">
            {poster ? (
              <Image src={poster} alt={series.title} fill className="object-cover" sizes="96px" priority />
            ) : (
              <div className="w-full aspect-[2/3] bg-[var(--color-bg-card)] flex items-center justify-center">
                <Tv2 size={24} className="text-[var(--color-text-muted)]" />
              </div>
            )}
          </div>
          <div className="pb-1">
            <h1 className="text-2xl font-bold text-white drop-shadow">{series.title}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              {series.genres.slice(0, 3).map((g) => (
                <span key={g} className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/70">{g}</span>
              ))}
              <span className={cn(
                "text-xs px-2 py-0.5 rounded border",
                series.status.toLowerCase() === "continuing"
                  ? "text-[var(--color-success)] border-[var(--color-success)]/30 bg-[var(--color-success)]/10"
                  : "text-[var(--color-text-muted)] border-white/10 bg-white/5"
              )}>
                {series.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">

        {/* ─── LEFT SIDEBAR ─── */}
        <aside className="lg:border-r border-[var(--color-border)] p-5 space-y-6">
          {/* Poster */}
          <div className="relative aspect-[2/3] w-full max-w-[160px] rounded-xl overflow-hidden border border-[var(--color-border)] shadow-xl shrink-0 mx-auto hidden lg:block">
            {poster ? (
              <Image src={poster} alt={series.title} fill className="object-cover" sizes="160px" />
            ) : (
              <div className="w-full aspect-[2/3] bg-[var(--color-bg-card)] flex items-center justify-center">
                <Tv2 size={24} className="text-[var(--color-text-muted)]" />
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <Stat label="Seasons" value={series.statistics.seasonCount} />
            <Stat label="Episodes" value={`${series.statistics.episodeFileCount} / ${series.statistics.episodeCount}`} />
            <Stat label="Progress" value={`${Math.round(series.statistics.percentOfEpisodes)}%`} />
            <Stat label="Size" value={formatBytes(series.statistics.sizeOnDisk)} />

            {/* Quality Profile */}
            <div className="col-span-2">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">Quality Profile</p>
              {editingProfile ? (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedProfileId ?? series.qualityProfileId}
                    onChange={(e) => setSelectedProfileId(Number(e.target.value))}
                    className="flex-1 px-2 py-1 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-xs outline-none"
                  >
                    {qualityProfiles?.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <button onClick={() => profileMutation.mutate(selectedProfileId ?? series.qualityProfileId)} disabled={profileMutation.isPending} className="p-1 rounded text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-colors"><Check size={12} /></button>
                  <button onClick={() => { setEditingProfile(false); setSelectedProfileId(null); }} className="p-1 rounded text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"><X size={12} /></button>
                </div>
              ) : (
                <button onClick={() => { setEditingProfile(true); setSelectedProfileId(series.qualityProfileId); }} className="flex items-center gap-1 text-sm font-semibold text-white hover:text-[var(--color-sonarr)] transition-colors group" title="Click to change quality profile">
                  {currentProfile?.name ?? `Profile #${series.qualityProfileId}`}
                  <Edit3 size={14} className="opacity-70 group-hover:opacity-100 text-[var(--color-sonarr)]" />
                </button>
              )}
            </div>

            {/* Root Folder */}
            <div className="col-span-2">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <FolderOpen size={11} className="text-[var(--color-sonarr)]" /> Root Folder
              </p>
              {editingRootFolder ? (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedRootFolderPath ?? series.path}
                    onChange={(e) => setSelectedRootFolderPath(e.target.value)}
                    className="flex-1 px-2 py-1 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-xs outline-none"
                  >
                    {rootFolders?.map((rf) => (
                      <option key={rf.id} value={rf.path}>{rf.path}</option>
                    ))}
                  </select>
                  <button onClick={() => rootFolderMutation.mutate(selectedRootFolderPath ?? series.path)} disabled={rootFolderMutation.isPending} className="p-1 rounded text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-colors"><Check size={12} /></button>
                  <button onClick={() => { setEditingRootFolder(false); setSelectedRootFolderPath(null); }} className="p-1 rounded text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"><X size={12} /></button>
                </div>
              ) : (
                <button onClick={() => { setEditingRootFolder(true); setSelectedRootFolderPath(series.path); }} className="flex items-center gap-1 text-xs text-white hover:text-[var(--color-sonarr)] transition-colors group font-mono truncate max-w-full" title={series.path}>
                  <span className="truncate">{series.path}</span>
                  <Edit3 size={11} className="shrink-0 opacity-70 group-hover:opacity-100 text-[var(--color-sonarr)]" />
                </button>
              )}
            </div>

            {/* Tags */}
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-1">
                  <Tag size={11} className="text-[var(--color-sonarr)]" /> Tags
                </p>
                <button onClick={() => setEditingTags(!editingTags)} className="text-[10px] text-[var(--color-sonarr)] hover:underline">{editingTags ? "Done" : "Edit"}</button>
              </div>
              {editingTags ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {(tags ?? []).map((t) => {
                      const active = series.tags.includes(t.id);
                      return (
                        <div key={t.id} className="flex items-center gap-0.5">
                          <button
                            onClick={() => {
                              const next = active ? series.tags.filter((x) => x !== t.id) : [...series.tags, t.id];
                              tagsMutation.mutate(next);
                            }}
                            className={cn(
                              "text-[10px] px-2 py-0.5 rounded-l-full border-y border-l transition-all font-medium",
                              active
                                ? "bg-[var(--color-sonarr)]/15 text-[var(--color-sonarr)] border-[var(--color-sonarr)]/40"
                                : "text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-border-bright)]"
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
                                ? "border-[var(--color-sonarr)]/40 text-[var(--color-sonarr)] hover:bg-[var(--color-danger)]/20 hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/50"
                                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                            )}
                          >
                            <X size={8} />
                          </button>
                        </div>
                      );
                    })}
                    {(tags ?? []).length === 0 && <span className="text-[11px] text-[var(--color-text-muted)]">No tags defined</span>}
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
                      className="flex-1 px-2 py-0.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-[10px] outline-none focus:border-[var(--color-sonarr)] min-w-0"
                    />
                    <button
                      type="submit"
                      disabled={!newTagLabel.trim() || createTagMutation.isPending}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--color-sonarr)]/20 text-[var(--color-sonarr)] border border-[var(--color-sonarr)]/40 hover:bg-[var(--color-sonarr)]/30 disabled:opacity-40 transition-colors"
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
                  {series.tags.length === 0 && <span className="text-xs text-[var(--color-text-muted)] italic">None</span>}
                  {series.tags.map((tid) => {
                    const t = tags?.find((x) => x.id === tid);
                    return (
                      <span key={tid} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-sonarr)]/10 text-[var(--color-sonarr)] border border-[var(--color-sonarr)]/30 font-medium">
                        {t?.label ?? `#${tid}`}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-all"
            >
              <X size={13} /> Close
            </button>

            {/* Monitor Strategy Button + Inline Dialog */}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => {
                  setMonitorStrategy(series.monitored ? "all" : "none");
                  setMonitorNewItemsSetting(series.monitorNewItems ?? "all");
                  setShowMonitorDialog((v) => !v);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                  series.monitored
                    ? "text-white border-[var(--color-sonarr)]/60 bg-[var(--color-sonarr)]/15"
                    : "text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-white hover:border-[var(--color-border-bright)]"
                )}
              >
                {series.monitored ? <EyeIcon size={13} /> : <EyeOff size={13} />}
                {series.monitored ? "Monitored" : "Unmonitored"}
                <ChevronDown size={11} className={cn("ml-auto transition-transform", showMonitorDialog && "rotate-180")} />
              </button>

              <AnimatePresence>
                {showMonitorDialog && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Episode Strategy</p>
                        <div className="flex flex-wrap gap-1">
                          {(
                            [
                              { key: "all", label: "All" },
                              { key: "future", label: "Future" },
                              { key: "missing", label: "Missing" },
                              { key: "existing", label: "Existing" },
                              { key: "first", label: "First Season" },
                              { key: "latest", label: "Latest Season" },
                              { key: "none", label: "None" },
                            ] as { key: MonitorStrategy; label: string }[]
                          ).map(({ key, label }) => (
                            <button
                              key={key}
                              onClick={() => setMonitorStrategy(key)}
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full border transition-all font-medium",
                                monitorStrategy === key
                                  ? key === "none"
                                    ? "bg-[var(--color-danger)]/20 border-[var(--color-danger)]/50 text-[var(--color-danger)]"
                                    : "bg-[var(--color-sonarr)]/20 border-[var(--color-sonarr)]/50 text-[var(--color-sonarr)]"
                                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {monitorStrategy !== "none" && (
                        <div>
                          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">New Episodes</p>
                          <div className="flex gap-1">
                            {(["all", "none"] as const).map((v) => (
                              <button
                                key={v}
                                onClick={() => setMonitorNewItemsSetting(v)}
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-full border transition-all font-medium",
                                  monitorNewItemsSetting === v
                                    ? "bg-[var(--color-sonarr)]/20 border-[var(--color-sonarr)]/50 text-[var(--color-sonarr)]"
                                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white"
                                )}
                              >
                                {v === "all" ? "Monitor New" : "Don't Monitor New"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-1.5 pt-0.5">
                        <button
                          onClick={() =>
                            applyMonitorMutation.mutate({
                              strategy: monitorStrategy,
                              monitorNewItems: monitorStrategy === "none" ? "none" : monitorNewItemsSetting,
                            })
                          }
                          disabled={applyMonitorMutation.isPending}
                          className="flex-1 text-[10px] font-semibold py-1 rounded-md bg-[var(--color-sonarr)]/20 hover:bg-[var(--color-sonarr)]/30 text-[var(--color-sonarr)] border border-[var(--color-sonarr)]/30 transition-all disabled:opacity-50"
                        >
                          {applyMonitorMutation.isPending ? "Applying..." : "Apply"}
                        </button>
                        <button
                          onClick={() => setShowMonitorDialog(false)}
                          className="text-[10px] font-semibold px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ActionBtn icon={<RefreshCw size={13} />} label="Refresh" color="var(--color-accent)" onClick={() => refreshMutation.mutate()} loading={refreshMutation.isPending} />
            <ActionBtn icon={<Search size={13} />} label="Search All Missing" onClick={() => searchMutation.mutate()} loading={searchMutation.isPending} />
            <ActionBtn icon={<FilePen size={13} />} label="Rename Files" color="var(--color-accent)" onClick={() => renameMutation.mutate()} loading={renameMutation.isPending} />
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all mt-2 text-[var(--color-danger)] border-[var(--color-danger)]/30 hover:bg-[var(--color-danger)]/10"
            >
              <Trash2 size={13} /> Delete Series
            </button>
          </div>

          {/* Overview */}
          {series.overview && (
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {series.overview}
            </p>
          )}
        </aside>

        {/* ─── RIGHT PANEL ─── */}
        <main className="p-5 space-y-3 min-w-0">
          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-widest">
            Seasons
          </h2>
          {series.seasons
            .filter((s) => s.seasonNumber > 0)
            .sort((a, b) => b.seasonNumber - a.seasonNumber)
            .map((season) => {
              const eps = (episodesBySeason[season.seasonNumber] ?? []).sort(
                (a, b) => a.episodeNumber - b.episodeNumber
              );
              const isExpanded = expandedSeasons.has(season.seasonNumber);
              const pct = season.statistics?.percentOfEpisodes ?? 0;
              const fileCount = season.statistics?.episodeFileCount ?? 0;
              const totalCount = season.statistics?.episodeCount ?? 0;
              const missingCount = totalCount - fileCount;
              const hasMissing = missingCount > 0 && season.monitored;
              const seasonBarColor =
                totalCount === 0 || !season.monitored ? "var(--color-text-muted)"
                : pct >= 100 ? "var(--color-success)"
                : fileCount === 0 ? "var(--color-danger)"
                : pct < 70 ? "var(--color-warning)"
                : "var(--color-sonarr)";

              return (
                <div
                  key={season.seasonNumber}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button
                      onClick={() => toggleSeason(season.seasonNumber)}
                      className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
                    >
                      {isExpanded
                        ? <ChevronDown size={14} className="text-[var(--color-sonarr)] shrink-0" />
                        : <ChevronRight size={14} className="text-[var(--color-text-muted)] shrink-0" />}
                      <span className="text-sm font-semibold text-white">
                        Season {season.seasonNumber}
                      </span>
                      <div className="flex-1 mx-3 h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: seasonBarColor }}
                        />
                      </div>
                      <span className="text-xs font-mono shrink-0" style={{ color: hasMissing ? seasonBarColor : "var(--color-text-muted)" }}>
                        {fileCount} / {totalCount}
                      </span>
                      {hasMissing && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0"
                          style={{ color: seasonBarColor, background: `color-mix(in srgb, ${seasonBarColor} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${seasonBarColor} 35%, transparent)` }}>
                          {missingCount} missing
                        </span>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSeasonModal(season.seasonNumber); }}
                      className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all text-[var(--color-sonarr)] border-[var(--color-sonarr)]/30 bg-[var(--color-sonarr)]/10 hover:bg-[var(--color-sonarr)]/20"
                      title={`Browse releases for Season ${season.seasonNumber}`}
                    >
                      <Search size={9} /> Search
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); seasonSearchMutation.mutate(season.seasonNumber); }}
                      disabled={searchingSeasons.has(season.seasonNumber) || queuedSeasons.has(season.seasonNumber)}
                      className={cn(
                        "shrink-0 flex items-center justify-center w-6 h-6 rounded border transition-all",
                        queuedSeasons.has(season.seasonNumber)
                          ? "text-[var(--color-success)] border-[var(--color-success)]/30 bg-[var(--color-success)]/10"
                          : errorSeasons.has(season.seasonNumber)
                            ? "text-[var(--color-danger)] border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10"
                            : "text-slate-400 border-[var(--color-border)] hover:text-white hover:border-[var(--color-border-bright)] disabled:opacity-40"
                      )}
                      title={queuedSeasons.has(season.seasonNumber) ? "Queued!" : errorSeasons.has(season.seasonNumber) ? "Error" : `Auto-search Season ${season.seasonNumber}`}
                    >
                      {searchingSeasons.has(season.seasonNumber) ? (
                        <RefreshCw size={9} className="animate-spin" />
                      ) : queuedSeasons.has(season.seasonNumber) ? (
                        <Check size={9} />
                      ) : errorSeasons.has(season.seasonNumber) ? (
                        <X size={9} />
                      ) : (
                        <RefreshCw size={9} />
                      )}
                    </button>
                    <button
                      onClick={() => seasonMonitorMutation.mutate({ seasonNumber: season.seasonNumber, monitored: !season.monitored })}
                      disabled={seasonMonitorMutation.isPending}
                      className={cn(
                        "shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all",
                        season.monitored
                          ? "text-[var(--color-sonarr)] border-[var(--color-sonarr)]/30 bg-[var(--color-sonarr)]/10"
                          : "text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-border-bright)]"
                      )}
                      title={season.monitored ? "Click to unmonitor season" : "Click to monitor season"}
                    >
                      {season.monitored ? <Eye size={9} /> : <EyeOff size={9} />}
                      {season.monitored ? "Mon" : "Unmon"}
                    </button>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-[var(--color-border)]">
                          {eps.length === 0 ? (
                            <p className="px-5 py-4 text-sm text-[var(--color-text-muted)]">No episodes yet.</p>
                          ) : (
                            eps.map((ep) => (
                              <EpisodeRow
                                key={ep.id}
                                ep={ep}
                                file={ep.episodeFileId ? fileMap[ep.episodeFileId] : undefined}
                                seriesTitle={series.title}
                                onManualSearch={(episodeId, title) => setManualSearch({ episodeId, title })}
                                onToggleMonitor={(ep) => episodeMonitorMutation.mutate({ episodeId: ep.id, monitored: !ep.monitored })}
                                onDeleteFile={(fileId) => deleteEpisodeFileMutation.mutate(fileId)}
                              />
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
        </main>
      </div>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--color-bg-card)] border border-[var(--color-danger)]/30 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center shrink-0">
                  <Trash2 size={18} className="text-[var(--color-danger)]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Delete Series</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    Are you sure you want to remove <span className="text-white font-semibold">{series?.title}</span> from Sonarr?
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-danger)]/8 border border-[var(--color-danger)]/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteFiles}
                  onChange={(e) => setDeleteFiles(e.target.checked)}
                  className="accent-[var(--color-danger)] w-4 h-4"
                />
                <div>
                  <p className="text-sm font-semibold text-white">Also delete files from disk</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Permanently removes all episode files</p>
                </div>
              </label>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[var(--color-danger)] text-white hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {deleteMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Season Search Modal */}
      {seasonModal !== null && series && (
        <SeasonSearchModal
          seriesId={series.id}
          seriesTitle={series.title}
          seasonNumber={seasonModal}
          onClose={() => setSeasonModal(null)}
        />
      )}

      {/* Episode Manual Search Modal */}
      {manualSearch && (
        <ManualSearchModal
          service="sonarr"
          mediaId={manualSearch.episodeId}
          title={manualSearch.title}
          onClose={() => setManualSearch(null)}
        />
      )}
    </Overlay>
  );
}
