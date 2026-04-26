"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tv2, Film, ChevronDown, ChevronUp, Award, ArrowUpCircle,
  Scissors, Layers, CheckCircle2, XCircle, Settings2, Users,
  TrendingUp, AlertCircle,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/store/settings";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface QualityDef {
  id: number;
  name: string;
  source?: string;
  resolution?: number;
}

interface QualityItem {
  id?: number;
  quality?: QualityDef;
  items?: QualityItem[];   // group children
  allowed: boolean;
  name?: string;           // group name
}

interface FormatItem {
  format: number;
  name: string;
  score: number;
}

interface QualityProfile {
  id: number;
  name: string;
  upgradeAllowed: boolean;
  cutoff: number;
  items: QualityItem[];
  minFormatScore: number;
  cutoffFormatScore: number;
  formatItems: FormatItem[];
}

interface SonarrSeries {
  id: number;
  title: string;
  qualityProfileId: number;
}

interface RadarrMovie {
  id: number;
  title: string;
  qualityProfileId: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flatten a quality items array to individual QualityDef leaves (allowed only) */
function flattenAllowed(items: QualityItem[]): QualityDef[] {
  const out: QualityDef[] = [];
  for (const item of [...items].reverse()) {
    if (item.items && item.items.length > 0) {
      for (const child of [...item.items].reverse()) {
        if (child.allowed && child.quality) out.push(child.quality);
      }
    } else if (item.allowed && item.quality) {
      out.push(item.quality);
    }
  }
  return out;
}

/** Find the cutoff quality name given the cutoff id */
function cutoffName(items: QualityItem[], cutoffId: number): string {
  for (const item of items) {
    if (item.items) {
      const found = item.items.find((c) => c.quality?.id === cutoffId);
      if (found && found.quality) return found.quality.name;
      // Group cutoff: group id matches
      if (item.id === cutoffId && item.name) return item.name;
    } else if (item.quality?.id === cutoffId) {
      return item.quality.name;
    }
  }
  return `#${cutoffId}`;
}

function scoreColor(score: number) {
  if (score >= 1000) return "var(--color-success)";
  if (score > 0) return "var(--color-warning)";
  if (score < 0) return "var(--color-danger)";
  return "var(--color-text-muted)";
}

// ── Quality Item row ───────────────────────────────────────────────────────────
function QualityRow({
  item,
  cutoffId,
  indent = false,
}: {
  item: QualityItem;
  cutoffId: number;
  indent?: boolean;
}) {
  const isCutoff = item.quality?.id === cutoffId || item.id === cutoffId;

  // Group
  if (item.items && item.items.length > 0) {
    return (
      <div className="mb-0.5">
        <div className={cn(
          "flex items-center gap-2 px-2 py-1 rounded-lg text-[11px]",
          item.allowed ? "bg-white/5" : "opacity-40"
        )}>
          <Layers size={10} className="text-slate-400 shrink-0" />
          <span className="font-semibold text-white">{item.name ?? "Group"}</span>
          {isCutoff && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--color-warning)]/15 text-[var(--color-warning)] border border-[var(--color-warning)]/30">
              CUTOFF
            </span>
          )}
          {!item.allowed && <XCircle size={9} className="ml-auto text-[var(--color-danger)]" />}
        </div>
        <div className="ml-4 mt-0.5 space-y-0.5">
          {[...item.items].reverse().map((child, i) => (
            <QualityRow key={i} item={child} cutoffId={cutoffId} indent />
          ))}
        </div>
      </div>
    );
  }

  if (!item.quality) return null;

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1 rounded text-[11px]",
      item.allowed ? "" : "opacity-35",
      indent ? "ml-2" : ""
    )}>
      {item.allowed
        ? <CheckCircle2 size={9} className="text-[var(--color-success)] shrink-0" />
        : <XCircle size={9} className="text-[var(--color-danger)] shrink-0" />
      }
      <span className={item.allowed ? "text-slate-200" : "text-slate-500"}>
        {item.quality.name}
      </span>
      {item.quality.resolution && item.quality.resolution > 0 && (
        <span className="text-[9px] text-slate-500 font-mono">{item.quality.resolution}p</span>
      )}
      {isCutoff && (
        <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--color-warning)]/15 text-[var(--color-warning)] border border-[var(--color-warning)]/30">
          CUTOFF
        </span>
      )}
    </div>
  );
}

// ── Profile Card ──────────────────────────────────────────────────────────────
function ProfileCard({
  profile,
  usedBy,
  color,
  allProfiles,
  onBulkReassign,
}: {
  profile: QualityProfile;
  usedBy: { id: number; title: string }[];
  color: string;
  allProfiles: QualityProfile[];
  onBulkReassign: (fromId: number, toId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [targetProfileId, setTargetProfileId] = useState<number | "">("");

  const allowedQualities = flattenAllowed(profile.items);
  const cutoff = cutoffName(profile.items, profile.cutoff);
  const positiveFormats = profile.formatItems.filter((f) => f.score > 0);
  const negativeFormats = profile.formatItems.filter((f) => f.score < 0);

  return (
    <motion.div
      layout
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden"
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/3 transition-colors text-left"
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in srgb, ${color} 15%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          <Settings2 size={13} style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{profile.name}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Cutoff: <span className="text-slate-200">{cutoff}</span>
            {" · "}
            <span className="text-slate-200">{allowedQualities.length}</span> qualities
            {profile.formatItems.length > 0 && (
              <> · <span className="text-slate-200">{profile.formatItems.length}</span> formats</>
            )}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mr-2">
          {profile.upgradeAllowed && (
            <div className="flex items-center gap-1 text-[11px]" style={{ color }}>
              <ArrowUpCircle size={11} />
              <span className="hidden sm:inline">Upgrades</span>
            </div>
          )}
          {profile.minFormatScore > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-[var(--color-warning)]">
              <Award size={11} />
              <span className="font-mono">min {profile.minFormatScore}</span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[11px] text-slate-300">
            <Users size={11} />
            <span className="font-semibold">{usedBy.length}</span>
          </div>
        </div>

        {expanded ? (
          <ChevronUp size={14} className="text-slate-400 shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-slate-400 shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[var(--color-border)]"
          >
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Qualities column */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Layers size={10} /> Qualities (best → worst)
                </p>
                <div className="space-y-0.5">
                  {[...profile.items].reverse().map((item, i) => (
                    <QualityRow key={i} item={item} cutoffId={profile.cutoff} />
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Cutoff</span>
                    <span className="font-semibold">{cutoff}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">Upgrades</span>
                    <span className={profile.upgradeAllowed ? "text-[var(--color-success)]" : "text-slate-500"}>
                      {profile.upgradeAllowed ? "Allowed" : "Disabled"}
                    </span>
                  </div>
                  {profile.cutoffFormatScore > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Cutoff CF Score</span>
                      <span className="font-mono">{profile.cutoffFormatScore}</span>
                    </div>
                  )}
                  {profile.minFormatScore > 0 && (
                    <div className="flex justify-between text-slate-300">
                      <span className="text-slate-400">Min CF Score</span>
                      <span className="font-mono">{profile.minFormatScore}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Formats column */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Award size={10} /> Custom Formats
                </p>
                {profile.formatItems.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">No custom formats</p>
                ) : (
                  <div className="space-y-0.5">
                    {positiveFormats.length > 0 && (
                      <>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <TrendingUp size={8} /> Preferred
                        </p>
                        {positiveFormats
                          .sort((a, b) => b.score - a.score)
                          .map((f) => (
                            <div key={f.format} className="flex items-center justify-between px-2 py-1 rounded text-[11px]">
                              <span className="text-slate-200 truncate mr-2">{f.name}</span>
                              <span
                                className="font-mono font-bold text-[10px] shrink-0"
                                style={{ color: scoreColor(f.score) }}
                              >
                                +{f.score}
                              </span>
                            </div>
                          ))}
                      </>
                    )}
                    {negativeFormats.length > 0 && (
                      <>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-1 mt-2 flex items-center gap-1">
                          <Scissors size={8} /> Rejected
                        </p>
                        {negativeFormats
                          .sort((a, b) => a.score - b.score)
                          .map((f) => (
                            <div key={f.format} className="flex items-center justify-between px-2 py-1 rounded text-[11px]">
                              <span className="text-slate-200 truncate mr-2">{f.name}</span>
                              <span className="font-mono font-bold text-[10px] text-[var(--color-danger)]">
                                {f.score}
                              </span>
                            </div>
                          ))}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Used By + Reassign column */}
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Users size={10} /> Used By ({usedBy.length})
                </p>
                {usedBy.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic">Not used by any items</p>
                ) : (
                  <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                    {usedBy.map((item) => (
                      <div key={item.id} className="text-[11px] text-slate-300 px-2 py-1 rounded hover:bg-white/5 truncate">
                        {item.title}
                      </div>
                    ))}
                  </div>
                )}

                {/* Bulk reassign */}
                {usedBy.length > 0 && allProfiles.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                    {!reassigning ? (
                      <button
                        onClick={() => setReassigning(true)}
                        className="w-full text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-slate-300 hover:text-white hover:border-[var(--color-border-bright)] transition-colors"
                      >
                        Bulk Reassign…
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-400">Move all {usedBy.length} items to:</p>
                        <select
                          value={targetProfileId}
                          onChange={(e) => setTargetProfileId(Number(e.target.value) || "")}
                          className="w-full px-2 py-1.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white text-[11px] outline-none focus:border-[var(--color-accent)] transition-colors"
                        >
                          <option value="">Select profile…</option>
                          {allProfiles
                            .filter((p) => p.id !== profile.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (targetProfileId !== "") {
                                onBulkReassign(profile.id, Number(targetProfileId));
                                setReassigning(false);
                                setTargetProfileId("");
                              }
                            }}
                            disabled={targetProfileId === ""}
                            className="flex-1 text-[11px] font-semibold px-2 py-1.5 rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-40 hover:bg-[var(--color-accent-bright)] transition-colors"
                          >
                            Reassign
                          </button>
                          <button
                            onClick={() => { setReassigning(false); setTargetProfileId(""); }}
                            className="px-2 py-1.5 rounded-lg border border-[var(--color-border)] text-slate-400 hover:text-white text-[11px] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProfilesPage() {
  const [service, setService] = useState<"sonarr" | "radarr">("sonarr");
  const { sonarr, radarr } = useSettings();
  const { sonarrApi, radarrApi } = useApi();
  const qc = useQueryClient();

  const api = service === "sonarr" ? sonarrApi : radarrApi;
  const enabled = service === "sonarr"
    ? (sonarr.enabled && !!sonarr.apiKey)
    : (radarr.enabled && !!radarr.apiKey);

  const { data: profiles, isLoading: profilesLoading } = useQuery<QualityProfile[]>({
    queryKey: [service, "qualityprofiles"],
    queryFn: () => api.get("/qualityprofile").then((r) => r.data),
    enabled,
  });

  const { data: series, isLoading: seriesLoading } = useQuery<SonarrSeries[]>({
    queryKey: ["sonarr-series-list"],
    queryFn: () => sonarrApi.get("/series").then((r) => r.data),
    enabled: service === "sonarr" && sonarr.enabled && !!sonarr.apiKey,
    staleTime: 2 * 60 * 1000,
  });

  const { data: movies, isLoading: moviesLoading } = useQuery<RadarrMovie[]>({
    queryKey: ["radarr-movies-list"],
    queryFn: () => radarrApi.get("/movie").then((r) => r.data),
    enabled: service === "radarr" && radarr.enabled && !!radarr.apiKey,
    staleTime: 2 * 60 * 1000,
  });

  // Bulk reassign mutation
  const reassignMutation = useMutation({
    mutationFn: async ({ fromId, toId }: { fromId: number; toId: number }) => {
      const items = service === "sonarr" ? series : movies;
      const toReassign = (items ?? []).filter((i) => i.qualityProfileId === fromId);
      await Promise.all(
        toReassign.map((item) => {
          const endpoint = service === "sonarr" ? `/series/${item.id}` : `/movie/${item.id}`;
          return api.put(endpoint, { ...item, qualityProfileId: toId });
        })
      );
    },
    onSuccess: () => {
      toast.success("Items reassigned");
      qc.invalidateQueries({ queryKey: ["sonarr-series-list"] });
      qc.invalidateQueries({ queryKey: ["radarr-movies-list"] });
    },
  });

  const isLoading = profilesLoading || (service === "sonarr" ? seriesLoading : moviesLoading);
  const items = service === "sonarr" ? series : movies;

  const color = service === "sonarr" ? "var(--color-sonarr)" : "var(--color-radarr)";

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Quality Profiles"
        subtitle="View and manage quality profiles across Sonarr and Radarr"
      />

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-4">

        {/* Service tabs */}
        <div className="flex gap-1 p-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl w-fit">
          {(["sonarr", "radarr"] as const).map((svc) => {
            const Icon = svc === "sonarr" ? Tv2 : Film;
            const svcColor = svc === "sonarr" ? "var(--color-sonarr)" : "var(--color-radarr)";
            const svcEnabled = svc === "sonarr"
              ? (sonarr.enabled && !!sonarr.apiKey)
              : (radarr.enabled && !!radarr.apiKey);
            return (
              <button
                key={svc}
                onClick={() => setService(svc)}
                disabled={!svcEnabled}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40",
                  service === svc
                    ? "text-white"
                    : "text-slate-400 hover:text-white"
                )}
                style={service === svc ? {
                  background: `color-mix(in srgb, ${svcColor} 20%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${svcColor} 40%, transparent)`,
                } : {}}
              >
                <Icon size={13} style={service === svc ? { color: svcColor } : {}} />
                {svc.charAt(0).toUpperCase() + svc.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Summary bar */}
        {!isLoading && profiles && items && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Profiles",
                value: profiles.length,
                icon: Settings2,
                color,
              },
              {
                label: service === "sonarr" ? "Series" : "Movies",
                value: items.length,
                icon: service === "sonarr" ? Tv2 : Film,
                color,
              },
              {
                label: "With Upgrades",
                value: profiles.filter((p) => p.upgradeAllowed).length,
                icon: ArrowUpCircle,
                color: "var(--color-success)",
              },
              {
                label: "With Custom Formats",
                value: profiles.filter((p) => p.formatItems.length > 0).length,
                icon: Award,
                color: "var(--color-warning)",
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 flex items-center gap-3"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${stat.color} 15%, transparent)`,
                    }}
                  >
                    <Icon size={14} style={{ color: stat.color }} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white leading-none">{stat.value}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Not configured */}
        {!enabled && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle size={32} className="text-slate-500 mb-3" />
            <p className="text-white font-semibold">
              {service === "sonarr" ? "Sonarr" : "Radarr"} not configured
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Add your {service === "sonarr" ? "Sonarr" : "Radarr"} connection in Settings
            </p>
          </div>
        )}

        {/* Loading */}
        {enabled && isLoading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 shimmer rounded-xl" />
            ))}
          </div>
        )}

        {/* Profiles list */}
        {enabled && !isLoading && profiles && (
          <div className="space-y-2">
            {profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Settings2 size={32} className="text-slate-500 mb-3" />
                <p className="text-sm text-slate-400">No quality profiles found</p>
              </div>
            ) : (
              profiles.map((profile) => {
                const usedBy = (items ?? []).filter(
                  (i) => i.qualityProfileId === profile.id
                );
                return (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    usedBy={usedBy}
                    color={color}
                    allProfiles={profiles}
                    onBulkReassign={(fromId, toId) =>
                      reassignMutation.mutate({ fromId, toId })
                    }
                  />
                );
              })
            )}
          </div>
        )}

        {/* Reassign in-progress overlay */}
        {reassignMutation.isPending && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl px-8 py-6 text-center">
              <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white font-semibold">Reassigning profiles…</p>
              <p className="text-sm text-slate-400 mt-1">Updating all affected items</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
