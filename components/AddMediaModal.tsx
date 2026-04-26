"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Search, Plus, CheckCircle2, Loader2, Tv2, Film, FolderOpen,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/store/settings";
import { cn } from "@/lib/utils";

interface RootFolder { id: number; path: string; }
interface QualityProfile { id: number; name: string; }

interface SonarrLookupResult {
  tvdbId: number;
  title: string;
  year: number;
  overview?: string;
  network?: string;
  status: string;
  remotePoster?: string;
  images?: { coverType: string; remoteUrl: string }[];
}
interface RadarrLookupResult {
  tmdbId: number;
  imdbId?: string;
  title: string;
  year: number;
  overview?: string;
  studio?: string;
  remotePoster?: string;
  images?: { coverType: string; remoteUrl: string }[];
}

type LookupResult = (SonarrLookupResult | RadarrLookupResult) & {
  _poster?: string;
};

function getPoster(r: LookupResult): string | undefined {
  if (r.remotePoster) return r.remotePoster;
  return r.images?.find((i) => i.coverType === "poster")?.remoteUrl;
}
function getId(r: LookupResult, service: "sonarr" | "radarr"): number {
  if (service === "sonarr") return (r as SonarrLookupResult).tvdbId;
  return (r as RadarrLookupResult).tmdbId;
}

interface Props {
  service: "sonarr" | "radarr";
  onClose: () => void;
}

export function AddMediaModal({ service, onClose }: Props) {
  const isSonarr = service === "sonarr";
  const color = isSonarr ? "var(--color-sonarr)" : "var(--color-radarr)";
  const { sonarr, radarr } = useSettings();
  const { sonarrApi, radarrApi } = useApi();
  const api = isSonarr ? sonarrApi : radarrApi;
  const qc = useQueryClient();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<LookupResult | null>(null);
  const [rootFolderId, setRootFolderId] = useState<number | null>(null);
  const [qualityProfileId, setQualityProfileId] = useState<number | null>(null);
  const [monitored, setMonitored] = useState(true);
  const [added, setAdded] = useState(false);

  // Debounce search
  const handleQueryChange = useCallback((val: string) => {
    setQuery(val);
    const t = setTimeout(() => setDebouncedQuery(val), 400);
    return () => clearTimeout(t);
  }, []);

  // Lookup
  const { data: results, isFetching } = useQuery<LookupResult[]>({
    queryKey: [service + "-lookup", debouncedQuery],
    queryFn: () =>
      api
        .get(`/${isSonarr ? "series" : "movie"}/lookup?term=${encodeURIComponent(debouncedQuery)}`)
        .then((r) => r.data),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
  });

  const { data: rootFolders } = useQuery<RootFolder[]>({
    queryKey: [service + "-rootfolders"],
    queryFn: () => api.get("/rootfolder").then((r) => r.data),
    enabled: !!selected,
  });

  const { data: qualityProfiles } = useQuery<QualityProfile[]>({
    queryKey: [service + "-qualityprofiles"],
    queryFn: () => api.get("/qualityprofile").then((r) => r.data),
    enabled: !!selected,
  });

  // Set defaults when data arrives
  if (rootFolders && rootFolders.length > 0 && rootFolderId === null) {
    setRootFolderId(rootFolders[0].id);
  }
  if (qualityProfiles && qualityProfiles.length > 0 && qualityProfileId === null) {
    setQualityProfileId(qualityProfiles[0].id);
  }

  const addMutation = useMutation({
    mutationFn: () => {
      if (!selected || !rootFolderId || !qualityProfileId) throw new Error("missing fields");
      const rf = rootFolders!.find((r) => r.id === rootFolderId)!;
      if (isSonarr) {
        const s = selected as SonarrLookupResult;
        return sonarrApi.post("/series", {
          tvdbId: s.tvdbId,
          title: s.title,
          qualityProfileId,
          rootFolderPath: rf.path,
          monitored,
          seasonFolder: true,
          addOptions: { searchForMissingEpisodes: monitored, monitor: "all" },
        });
      } else {
        const m = selected as RadarrLookupResult;
        return radarrApi.post("/movie", {
          tmdbId: m.tmdbId,
          title: m.title,
          qualityProfileId,
          rootFolderPath: rf.path,
          monitored,
          addOptions: { searchForMovie: monitored },
        });
      }
    },
    onSuccess: () => {
      toast.success(`${selected?.title ?? (isSonarr ? "Series" : "Movie")} added to library`);
      setAdded(true);
      qc.invalidateQueries({ queryKey: [isSonarr ? "sonarr-series" : "radarr-movies"] });
      setTimeout(onClose, 1500);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative z-10 w-full max-w-xl max-h-[85vh] flex flex-col glass rounded-2xl border border-[var(--color-border)] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            {isSonarr ? (
              <Tv2 size={16} style={{ color }} />
            ) : (
              <Film size={16} style={{ color }} />
            )}
            <span className="font-semibold text-white">
              Add {isSonarr ? "Series" : "Movie"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Search input */}
          <div className="p-4 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                autoFocus
                type="text"
                placeholder={isSonarr ? "Search for a TV show…" : "Search for a movie…"}
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm focus:outline-none transition-colors"
                style={{ "--tw-ring-color": color } as React.CSSProperties}
              />
              {isFetching && (
                <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--color-text-muted)]" />
              )}
            </div>
          </div>

          {/* Results */}
          {!selected && results && results.length > 0 && (
            <div className="divide-y divide-[var(--color-border)]">
              {results.slice(0, 8).map((r, i) => {
                const poster = getPoster(r);
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="relative w-10 h-14 rounded-lg overflow-hidden bg-[var(--color-bg-base)] flex-shrink-0">
                      {poster ? (
                        <Image src={poster} alt={r.title} fill className="object-cover" sizes="40px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {isSonarr ? <Tv2 size={16} className="text-[var(--color-text-muted)]" /> : <Film size={16} className="text-[var(--color-text-muted)]" />}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{r.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {r.year}
                        {"network" in r && r.network ? ` · ${r.network}` : ""}
                        {"studio" in r && r.studio ? ` · ${r.studio}` : ""}
                      </p>
                      {r.overview && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">
                          {r.overview}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {!selected && debouncedQuery.length >= 2 && !isFetching && (!results || results.length === 0) && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-[var(--color-text-muted)] text-sm">No results found for &quot;{debouncedQuery}&quot;</p>
            </div>
          )}

          {/* Selected — show add form */}
          {selected && (
            <div className="p-4 space-y-4">
              {/* Selected item header */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-base)] border border-[var(--color-border)]">
                <div className="relative w-10 h-14 rounded-lg overflow-hidden bg-[var(--color-bg-card)] flex-shrink-0">
                  {getPoster(selected) ? (
                    <Image src={getPoster(selected)!} alt={selected.title} fill className="object-cover" sizes="40px" />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{selected.title}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{selected.year}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs text-[var(--color-text-muted)] hover:text-white underline"
                >
                  Change
                </button>
              </div>

              {/* Root folder */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                  <FolderOpen size={12} /> Root Folder
                </label>
                <select
                  value={rootFolderId ?? ""}
                  onChange={(e) => setRootFolderId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-sm outline-none"
                >
                  {rootFolders?.map((rf) => (
                    <option key={rf.id} value={rf.id}>{rf.path}</option>
                  ))}
                </select>
              </div>

              {/* Quality profile */}
              <div>
                <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
                  Quality Profile
                </label>
                <select
                  value={qualityProfileId ?? ""}
                  onChange={(e) => setQualityProfileId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-sm outline-none"
                >
                  {qualityProfiles?.map((qp) => (
                    <option key={qp.id} value={qp.id}>{qp.name}</option>
                  ))}
                </select>
              </div>

              {/* Monitored toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">Monitored</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {isSonarr ? "Search for missing episodes automatically" : "Search for the movie automatically"}
                  </p>
                </div>
                <button
                  onClick={() => setMonitored(!monitored)}
                  className={cn(
                    "relative w-11 h-6 rounded-full overflow-hidden transition-colors duration-200",
                    monitored ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-input)] border border-[var(--color-border)]"
                  )}
                >
                  <span className={cn(
                    "absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200",
                    monitored ? "translate-x-[22px]" : "translate-x-0.5"
                  )} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {selected && (
          <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || added || !rootFolderId || !qualityProfileId}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: color }}
            >
              {added ? (
                <><CheckCircle2 size={14} /> Added!</>
              ) : addMutation.isPending ? (
                <><Loader2 size={14} className="animate-spin" /> Adding…</>
              ) : (
                <><Plus size={14} /> Add {isSonarr ? "Series" : "Movie"}</>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
