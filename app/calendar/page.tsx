"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Tv2, Film, ChevronLeft, ChevronRight, Search, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useSettings } from "@/store/settings";
import { useApi } from "@/hooks/useApi";
import { Header } from "@/components/layout/Header";
import { formatDate, cn } from "@/lib/utils";

interface CalendarEpisode {
  id: number;
  title: string;
  airDateUtc: string;
  hasFile: boolean;
  monitored: boolean;
  overview?: string;
  series?: { title: string };
  seriesId?: number;
  seasonNumber: number;
  episodeNumber: number;
}

interface CalendarMovie {
  id: number;
  title: string;
  inCinemas?: string;
  digitalRelease?: string;
  physicalRelease?: string;
  hasFile: boolean;
  monitored: boolean;
  overview?: string;
  year: number;
}

type ServiceFilter = "all" | "sonarr" | "radarr";
type RangeDays = 7 | 14 | 30;

function getWindow(offsetDays: number, rangeDays: RangeDays) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offsetDays);
  const end = new Date(start);
  end.setDate(end.getDate() + rangeDays);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function fmtWindowLabel(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const sameYear = s.getFullYear() === e.getFullYear();
  const sLabel = s.toLocaleDateString(undefined, { ...opts, year: sameYear ? undefined : "numeric" });
  const eLabel = e.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  return `${sLabel} — ${eLabel}`;
}

function groupByDate<T>(items: T[], dateKey: (item: T) => string | undefined) {
  const groups: Record<string, T[]> = {};
  for (const item of items) {
    const date = dateKey(item);
    if (!date) continue;
    const day = date.split("T")[0];
    if (!groups[day]) groups[day] = [];
    groups[day].push(item);
  }
  return groups;
}

export default function CalendarPage() {
  const { sonarr, radarr } = useSettings();
  const { sonarrApi, radarrApi } = useApi();
  const [service, setService] = useState<ServiceFilter>("all");
  const [range, setRange] = useState<RangeDays>(7);
  const [offset, setOffset] = useState(0); // days offset from today
  const todayRef = useRef<HTMLDivElement | null>(null);

  const scrollToToday = useCallback(() => {
    todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const { start, end } = useMemo(() => getWindow(offset, range), [offset, range]);

  const goBack = () => setOffset((o) => o - range);
  const goForward = () => setOffset((o) => o + range);
  const goToday = () => setOffset(0);

  const { data: episodes, isLoading: epsLoading } = useQuery<CalendarEpisode[]>({
    queryKey: ["sonarr-calendar", start, end],
    queryFn: () => sonarrApi.get(`/calendar?start=${start}&end=${end}&unmonitored=false&includeSeries=true`).then((r) => r.data),
    enabled: sonarr.enabled && !!sonarr.apiKey,
  });

  const { data: movies, isLoading: moviesLoading } = useQuery<CalendarMovie[]>({
    queryKey: ["radarr-calendar", start, end],
    queryFn: () => radarrApi.get(`/calendar?start=${start}&end=${end}&unmonitored=false`).then((r) => r.data),
    enabled: radarr.enabled && !!radarr.apiKey,
  });

  const episodeGroups = groupByDate(service !== "radarr" ? (episodes ?? []) : [], (e) => e.airDateUtc);
  // Prefer digital > physical > cinemas for relevance
  const movieGroups = groupByDate(service !== "sonarr" ? (movies ?? []) : [],
    (m) => m.digitalRelease ?? m.physicalRelease ?? m.inCinemas);

  const allDates = Array.from(new Set([...Object.keys(episodeGroups), ...Object.keys(movieGroups)])).sort();
  const today = new Date().toISOString().split("T")[0];
  const isLoading = epsLoading || moviesLoading;

  const searchEpisodeMutation = useMutation({
    mutationFn: (id: number) => sonarrApi.post("/command", { name: "EpisodeSearch", episodeIds: [id] }),
    onSuccess: () => toast.success("Searching for episode…"),
    onError: () => toast.error("Search failed"),
  });
  const searchMovieMutation = useMutation({
    mutationFn: (id: number) => radarrApi.post("/command", { name: "MoviesSearch", movieIds: [id] }),
    onSuccess: () => toast.success("Searching for movie…"),
    onError: () => toast.error("Search failed"),
  });
  const searchingEpId = searchEpisodeMutation.isPending ? searchEpisodeMutation.variables : null;
  const searchingMovId = searchMovieMutation.isPending ? searchMovieMutation.variables : null;

  const rangeOptions: { label: string; value: RangeDays }[] = [
    { label: "1 Week", value: 7 },
    { label: "2 Weeks", value: 14 },
    { label: "1 Month", value: 30 },
  ];
  const serviceOptions: { label: string; value: ServiceFilter }[] = [
    { label: "All", value: "all" },
    { label: "Sonarr", value: "sonarr" },
    { label: "Radarr", value: "radarr" },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Calendar" subtitle="Upcoming episodes and releases" />

      <div className="sticky top-[4.5rem] z-10 bg-[var(--color-bg-base)]/90 backdrop-blur border-b border-[var(--color-border)] px-6 py-3">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-3">
          {/* Prev / Today / Next */}
          <div className="flex items-center gap-1">
            <button onClick={goBack}
              className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-border-bright)] transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button onClick={goToday}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                offset === 0
                  ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)]/40 text-[var(--color-accent-bright)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-border-bright)]"
              )}>
              Today
            </button>
            <button onClick={goForward}
              className="p-1.5 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-border-bright)] transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Window label */}
          <span className="text-sm font-semibold text-white">{fmtWindowLabel(start, end)}</span>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Service filter */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
              {serviceOptions.map((opt) => (
                <button key={opt.value} onClick={() => setService(opt.value)}
                  className={cn("px-3 py-1 rounded-lg text-xs font-semibold transition-all", service === opt.value ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-muted)] hover:text-white")}>
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Range picker */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)]">
              {rangeOptions.map((opt) => (
                <button key={opt.value} onClick={() => { setRange(opt.value); setOffset(0); }}
                  className={cn("px-3 py-1 rounded-lg text-xs font-semibold transition-all", range === opt.value ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-muted)] hover:text-white")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                <div className="h-5 shimmer rounded w-32 mb-2" />
                <div className="h-16 shimmer rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && allDates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Calendar size={36} className="text-[var(--color-text-muted)] mb-3" />
            <p className="text-white font-semibold">Nothing scheduled</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">No upcoming content in the selected range</p>
          </div>
        )}

        {!isLoading && allDates.map((date) => {
          const isToday = date === today;
          const isPast = date < today;
          const dayEpisodes = episodeGroups[date] ?? [];
          const dayMovies = movieGroups[date] ?? [];

          return (
            <div
              key={date}
              ref={isToday ? (el) => { todayRef.current = el; } : undefined}
              className="mb-6">

              <div className="flex items-center gap-3 mb-3">
                {isToday && (
                  <div className="w-2 h-2 rounded-full bg-[var(--color-accent-bright)] animate-pulse" />
                )}
                <h2 className={cn("text-sm font-bold", isToday ? "text-[var(--color-accent-bright)]" : isPast ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-secondary)]")}>
                  {isToday ? "Today" : formatDate(date)}
                </h2>
                {isToday && (
                  <span className="status-pill border text-[var(--color-accent-bright)] bg-[var(--color-accent-glow)] border-[var(--color-accent)]">Today</span>
                )}
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <span className="text-xs text-[var(--color-text-muted)]">{dayEpisodes.length + dayMovies.length} item{dayEpisodes.length + dayMovies.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="space-y-2">
                {dayEpisodes.map((ep) => (
                  <Link key={ep.id} href={ep.seriesId ? `/sonarr/${ep.seriesId}` : "#"}
                    className={cn("flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-[var(--color-bg-card-hover)] group",
                      ep.hasFile
                        ? "border-[var(--color-success)]/30 bg-[var(--color-success)]/5 hover:border-[var(--color-success)]/50"
                        : isPast
                          ? "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 hover:border-[var(--color-danger)]/50"
                          : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-sonarr)]/40")}>
                    <Tv2 size={14} className={cn("flex-shrink-0", isPast && !ep.hasFile ? "text-[var(--color-danger)]" : "text-[var(--color-sonarr)]")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-[var(--color-sonarr)] transition-colors">{ep.series?.title ?? "Unknown Series"}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        S{String(ep.seasonNumber).padStart(2, "0")}E{String(ep.episodeNumber).padStart(2, "0")} — {ep.title}
                      </p>
                    </div>
                    {ep.hasFile
                      ? <span className="status-pill border text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/30">On Disk</span>
                      : isPast && !ep.monitored
                        ? <span className="status-pill border text-[var(--color-text-muted)] bg-white/5 border-white/10">Unmonitored</span>
                        : ep.monitored && (
                          <>
                            {isPast && <span className="status-pill border text-[var(--color-danger)] bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30">Missing</span>}
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); searchEpisodeMutation.mutate(ep.id); }}
                              disabled={searchEpisodeMutation.isPending}
                              title="Search for this episode"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-[var(--color-sonarr)]/40 text-[var(--color-sonarr)] hover:bg-[var(--color-sonarr)]/10 transition-all shrink-0 disabled:opacity-50"
                            >
                              {searchingEpId === ep.id ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
                              Grab
                            </button>
                          </>
                        )
                    }
                  </Link>
                ))}
                {dayMovies.map((m) => (
                  <Link key={m.id} href={`/radarr/${m.id}`}
                    className={cn("flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-[var(--color-bg-card-hover)] group",
                      m.hasFile
                        ? "border-[var(--color-success)]/30 bg-[var(--color-success)]/5 hover:border-[var(--color-success)]/50"
                        : isPast
                          ? "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 hover:border-[var(--color-danger)]/50"
                          : "border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-radarr)]/40")}>
                    <Film size={14} className={cn("flex-shrink-0", isPast && !m.hasFile ? "text-[var(--color-danger)]" : "text-[var(--color-radarr)]")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-[var(--color-radarr)] transition-colors">{m.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {m.year}
                        {m.digitalRelease ? " · Digital" : m.physicalRelease ? " · Physical" : m.inCinemas ? " · In Cinemas" : ""}
                      </p>
                    </div>
                    {m.hasFile
                      ? <span className="status-pill border text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/30">On Disk</span>
                      : isPast && !m.monitored
                        ? <span className="status-pill border text-[var(--color-text-muted)] bg-white/5 border-white/10">Unmonitored</span>
                        : m.monitored && (
                          <>
                            {isPast && <span className="status-pill border text-[var(--color-danger)] bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30">Missing</span>}
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); searchMovieMutation.mutate(m.id); }}
                              disabled={searchMovieMutation.isPending}
                              title="Search for this movie"
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-[var(--color-radarr)]/40 text-[var(--color-radarr)] hover:bg-[var(--color-radarr)]/10 transition-all shrink-0 disabled:opacity-50"
                            >
                              {searchingMovId === m.id ? <RefreshCw size={11} className="animate-spin" /> : <Search size={11} />}
                              Grab
                            </button>
                          </>
                        )
                    }
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
