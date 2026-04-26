"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pause, Play, Gauge, HardDrive, Clock, Download,
  Trash2, History, Activity, AlertCircle, CheckCircle2,
  Wrench, PackageOpen, ChevronDown, ChevronRight, Loader2, FileCode2,
  RefreshCw, X, RotateCcw, AlertTriangle, Timer, Flag,
  Plus, Link2, Pencil, ArrowDownUp, Server, TriangleAlert,
  BarChart3, GripVertical,
} from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useSettings } from "@/store/settings";
import { Header } from "@/components/layout/Header";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function statusColor(status: string): string {
  if (status === "Downloading") return "text-[var(--color-sabnzbd)]";
  if (status === "Paused") return "text-[var(--color-text-secondary)]";
  if (status === "Failed") return "text-[var(--color-danger)]";
  if (status === "Completed") return "text-[var(--color-success)]";
  return "text-[var(--color-text-muted)]";
}

function statusIcon(status: string) {
  if (status === "Failed") return <AlertCircle size={12} className="text-[var(--color-danger)]" />;
  if (status === "Completed") return <CheckCircle2 size={12} className="text-[var(--color-success)]" />;
  return null;
}

const PP_STAGES = ["Verifying", "Repairing", "Joining", "Unpacking", "Moving", "Running"];

function isPPStage(status: string): boolean {
  return PP_STAGES.some((s) => status.startsWith(s));
}

function ppStageIcon(status: string) {
  if (status.startsWith("Verifying") || status.startsWith("Repairing") || status.startsWith("Joining"))
    return <Wrench size={11} />;
  if (status.startsWith("Unpacking"))
    return <PackageOpen size={11} />;
  if (status.startsWith("Running"))
    return <FileCode2 size={11} />;
  return <Loader2 size={11} className="animate-spin" />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SabnzbdPage() {
  const { sabnzbd } = useSettings();
  const { sabnzbdApi } = useApi();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"queue" | "history" | "postproc" | "stats" | "warnings" | "servers">("queue");
  const [speedLimit, setSpeedLimit] = useState("");
  const [addUrlInput, setAddUrlInput] = useState("");
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [sortField, setSortField] = useState<"avg_age" | "name" | "size">("avg_age");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSourceId = React.useRef<string | null>(null);

  const notConfigured = !sabnzbd.enabled || !sabnzbd.apiKey;

  // Queue
  const {
    data: queueData,
    isLoading: queueLoading,
    isError: queueError,
  } = useQuery({
    queryKey: ["sabnzbd-queue"],
    queryFn: () => sabnzbdApi.get("/?mode=queue&output=json"),
    enabled: !notConfigured,
    refetchInterval: 5000,
    retry: false,
  });

  // History
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["sabnzbd-history"],
    queryFn: () => sabnzbdApi.get("/?mode=history&output=json&limit=50"),
    enabled: !notConfigured && (activeTab === "history" || activeTab === "postproc"),
    refetchInterval: 15000,
    retry: false,
  });

  // Actions
  const pauseMutation = useMutation({
    mutationFn: () => sabnzbdApi.get("/?mode=pause&output=json"),
    onSuccess: () => { toast.success("Queue paused"); qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] }); },
  });

  const resumeMutation = useMutation({
    mutationFn: () => sabnzbdApi.get("/?mode=resume&output=json"),
    onSuccess: () => { toast.success("Queue resumed"); qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (nzoId: string) =>
      sabnzbdApi.get(`/?mode=queue&name=delete&value=${nzoId}&output=json`),
    onSuccess: () => { toast.success("Item deleted"); qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] }); },
  });

  const speedLimitMutation = useMutation({
    mutationFn: (limit: string) =>
      sabnzbdApi.get(`/?mode=config&name=speedlimit&value=${limit}&output=json`),
    onSuccess: () => toast.success("Speed limit set"),
  });

  const deleteHistoryMutation = useMutation({
    mutationFn: (nzoId: string) =>
      sabnzbdApi.get(`/?mode=history&name=delete&value=${nzoId}&output=json`),
    onSuccess: () => { toast.success("History item deleted"); qc.invalidateQueries({ queryKey: ["sabnzbd-history"] }); },
  });

  const retryHistoryMutation = useMutation({
    mutationFn: (nzoId: string) =>
      sabnzbdApi.get(`/?mode=retry&value=${nzoId}&output=json`),
    onSuccess: () => {
      toast.success("Requeued for download");
      qc.invalidateQueries({ queryKey: ["sabnzbd-history"] });
      qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] });
    },
  });

  const clearFailedMutation = useMutation({
    mutationFn: () =>
      sabnzbdApi.get("/?mode=history&name=delete&value=failed&del_files=1&output=json"),
    onSuccess: () => { toast.success("Failed items cleared"); qc.invalidateQueries({ queryKey: ["sabnzbd-history"] }); },
  });

  const clearAllHistoryMutation = useMutation({
    mutationFn: () =>
      sabnzbdApi.get("/?mode=history&name=delete&value=all&del_files=0&output=json"),
    onSuccess: () => { toast.success("History cleared"); qc.invalidateQueries({ queryKey: ["sabnzbd-history"] }); },
  });

  const pauseItemMutation = useMutation({
    mutationFn: (nzoId: string) =>
      sabnzbdApi.get(`/?mode=queue&name=pause&value=${nzoId}&output=json`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] }),
  });

  const resumeItemMutation = useMutation({
    mutationFn: (nzoId: string) =>
      sabnzbdApi.get(`/?mode=queue&name=resume&value=${nzoId}&output=json`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] }),
  });

  const setPriorityMutation = useMutation({
    mutationFn: ({ nzoId, priority }: { nzoId: string; priority: number }) =>
      sabnzbdApi.get(`/?mode=queue&name=priority&value=${nzoId}&extra=${priority}&output=json`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] }),
  });

  const pauseForMutation = useMutation({
    mutationFn: (minutes: number) =>
      sabnzbdApi.get(`/?mode=config&name=set_pause&value=${minutes}&output=json`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] }),
  });

  const addUrlMutation = useMutation({
    mutationFn: (url: string) =>
      sabnzbdApi.get(`/?mode=addurl&name=${encodeURIComponent(url)}&output=json`),
    onSuccess: () => {
      toast.success("NZB URL added to queue");
      setAddUrlInput("");
      setShowAddUrl(false);
      qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] });
    },
    onError: () => toast.error("Failed to add NZB URL"),
  });

  const retryAllMutation = useMutation({
    mutationFn: () => sabnzbdApi.get("/?mode=retry_all&output=json"),
    onSuccess: () => {
      toast.success("Retrying all failed downloads");
      qc.invalidateQueries({ queryKey: ["sabnzbd-history"] });
      qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] });
    },
    onError: () => toast.error("Retry all failed"),
  });

  const markCompletedMutation = useMutation({
    mutationFn: (nzoId: string) =>
      sabnzbdApi.get(`/?mode=history&name=mark_as_completed&value=${nzoId}&output=json`),
    onSuccess: () => {
      toast.success("Marked as completed");
      qc.invalidateQueries({ queryKey: ["sabnzbd-history"] });
    },
    onError: () => toast.error("Failed to mark as completed"),
  });

  const changeCatMutation = useMutation({
    mutationFn: ({ nzoId, cat }: { nzoId: string; cat: string }) =>
      sabnzbdApi.get(`/?mode=change_cat&value=${nzoId}&value2=${encodeURIComponent(cat)}&output=json`),
    onSuccess: () => { toast.success("Category updated"); qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] }); },
    onError: () => toast.error("Failed to change category"),
  });

  const renameMutation = useMutation({
    mutationFn: ({ nzoId, name }: { nzoId: string; name: string }) =>
      sabnzbdApi.get(`/?mode=queue&name=rename&value=${nzoId}&value2=${encodeURIComponent(name)}&output=json`),
    onSuccess: () => { toast.success("Item renamed"); qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] }); },
    onError: () => toast.error("Failed to rename"),
  });

  const sortQueueMutation = useMutation({
    mutationFn: ({ field, dir }: { field: string; dir: string }) =>
      sabnzbdApi.get(`/?mode=queue&name=sort&sort=${field}&dir=${dir}&output=json`),
    onSuccess: () => { toast.success("Queue sorted"); qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] }); },
    onError: () => toast.error("Failed to sort queue"),
  });

  const dragOrderRef = React.useRef<string[] | null>(null);

  const moveMutation = useMutation({
    mutationFn: ({ nzoId, toPos }: { nzoId: string; toPos: number }) =>
      sabnzbdApi.get(`/?mode=switch&value=${nzoId}&value2=${toPos}&output=json`),
    onSettled: () => {
      setDragOrder(null);
      dragOrderRef.current = null;
      setDragOverId(null);
      qc.invalidateQueries({ queryKey: ["sabnzbd-queue"] });
    },
  });

  // Download stats (day/week/month/total)
  const { data: serverStats } = useQuery({
    queryKey: ["sabnzbd-stats"],
    queryFn: () => sabnzbdApi.get("/?mode=server_stats&output=json"),
    enabled: !notConfigured && activeTab === "stats",
    staleTime: 60 * 1000,
  });

  // Warnings
  const { data: warningsData } = useQuery({
    queryKey: ["sabnzbd-warnings"],
    queryFn: () => sabnzbdApi.get("/?mode=warnings&output=json"),
    enabled: !notConfigured && activeTab === "warnings",
    refetchInterval: 30 * 1000,
  });

  // Server status / connections
  const { data: statusData } = useQuery({
    queryKey: ["sabnzbd-server-status"],
    queryFn: () => sabnzbdApi.get("/?mode=status&output=json"),
    enabled: !notConfigured && activeTab === "servers",
    refetchInterval: 10 * 1000,
  });

  // Available categories (for change_cat dropdown)
  const { data: configData } = useQuery({
    queryKey: ["sabnzbd-config"],
    queryFn: () => sabnzbdApi.get("/?mode=get_config&output=json"),
    enabled: !notConfigured,
    staleTime: 5 * 60 * 1000,
  });
  const availableCategories: string[] = (configData?.data?.config?.categories ?? []).map(
    (c: { name: string }) => c.name
  );

  const queue = queueData?.data?.queue;
  const historySlots: SabHistorySlot[] = historyData?.data?.history?.slots ?? [];
  const isPaused = queue?.status === "Paused";
  const ppSlots: SabQueueSlot[] = (queue?.slots ?? []).filter((s: SabQueueSlot) => isPPStage(s.status));

  // ── Not configured ──────────────────────────────────────────────────────────
  if (notConfigured) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="SABnzbd" subtitle="Usenet download client" />
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
          <HardDrive size={48} className="text-[var(--color-sabnzbd)] opacity-50" />
          <h2 className="text-xl font-semibold text-white">SABnzbd not configured</h2>
          <p className="text-[var(--color-text-secondary)] max-w-sm">
            Enter your SABnzbd URL and API key in Settings to get started.
          </p>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (queueError) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="SABnzbd" subtitle="Usenet download client" />
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
          <AlertCircle size={48} className="text-[var(--color-danger)] opacity-70" />
          <h2 className="text-xl font-semibold text-white">Could not reach SABnzbd</h2>
          <p className="text-[var(--color-text-secondary)] max-w-sm">
            Check that SABnzbd is running and your URL / API key are correct.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="SABnzbd"
        subtitle={
          queue
            ? `${queue.noofslots ?? 0} item${(queue.noofslots ?? 0) !== 1 ? "s" : ""} · ${queue.speed || "0 B/s"}`
            : "Usenet download client"
        }
      />
      <div className="flex-1 p-6 space-y-6">

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity size={18} className="text-[var(--color-sabnzbd)]" />}
          label="Speed"
          value={queueLoading ? "—" : (queue?.speed || "0 B/s")}
          glow
        />
        <StatCard
          icon={<Download size={18} className="text-[var(--color-sabnzbd)]" />}
          label="Remaining"
          value={queueLoading ? "—" : (queue?.sizeleft || "0 MB")}
        />
        <StatCard
          icon={<Clock size={18} className="text-[var(--color-sabnzbd)]" />}
          label="Time left"
          value={queueLoading ? "—" : (queue?.timeleft || "0:00:00")}
        />
        <StatCard
          icon={<HardDrive size={18} className="text-[var(--color-sabnzbd)]" />}
          label="Free disk"
          value={
            queueLoading
              ? "—"
              : queue?.diskspace1_norm
              ? `${queue.diskspace1_norm}`
              : "—"
          }
        />
      </div>

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Global pause / resume */}
        <button
          onClick={() => (isPaused ? resumeMutation.mutate() : pauseMutation.mutate())}
          disabled={queueLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all"
          style={{ background: "var(--color-sabnzbd)", color: "#000" }}
        >
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
          {isPaused ? "Resume" : "Pause"}
        </button>

        {/* Pause-for timer presets */}
        {!isPaused && (
          <div className="flex items-center gap-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-2 py-1">
            <Timer size={12} className="text-[var(--color-sabnzbd)] shrink-0" />
            <span className="text-xs text-[var(--color-text-muted)] mr-1">Pause for</span>
            {([15, 30, 60, 180] as const).map((min) => (
              <button
                key={min}
                onClick={() => pauseForMutation.mutate(min)}
                disabled={pauseForMutation.isPending}
                className="px-2 py-0.5 rounded text-[11px] font-semibold text-[var(--color-text-secondary)] hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {min < 60 ? `${min}m` : `${min / 60}h`}
              </button>
            ))}
          </div>
        )}

        {/* Speed limit */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)]">
          <Gauge size={14} className="text-[var(--color-sabnzbd)]" />
          <input
            type="text"
            placeholder="Speed limit (e.g. 5000)"
            value={speedLimit}
            onChange={(e) => setSpeedLimit(e.target.value)}
            className="bg-transparent text-sm text-white placeholder:text-[var(--color-text-muted)] outline-none w-44"
          />
          <button
            onClick={() => { if (speedLimit) speedLimitMutation.mutate(speedLimit); }}
            className="text-xs px-2 py-0.5 rounded bg-[var(--color-sabnzbd)] text-black font-semibold"
          >
            Set
          </button>
        </div>

        {queue && (
          <span className={`text-sm font-mono font-semibold ${statusColor(queue.status)}`}>
            {queue.status}
          </span>
        )}

        {/* Add NZB by URL */}
        <div className="flex items-center gap-2">
          {showAddUrl ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-sabnzbd)]/40">
              <Link2 size={13} className="text-[var(--color-sabnzbd)] shrink-0" />
              <input
                autoFocus
                type="text"
                placeholder="Paste NZB URL…"
                value={addUrlInput}
                onChange={(e) => setAddUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && addUrlInput.trim()) addUrlMutation.mutate(addUrlInput.trim());
                  if (e.key === "Escape") { setShowAddUrl(false); setAddUrlInput(""); }
                }}
                className="bg-transparent text-sm text-white placeholder:text-[var(--color-text-muted)] outline-none w-64"
              />
              <button
                onClick={() => { if (addUrlInput.trim()) addUrlMutation.mutate(addUrlInput.trim()); }}
                disabled={!addUrlInput.trim() || addUrlMutation.isPending}
                className="text-xs px-2 py-0.5 rounded bg-[var(--color-sabnzbd)] text-black font-semibold disabled:opacity-50"
              >
                {addUrlMutation.isPending ? "Adding…" : "Add"}
              </button>
              <button onClick={() => { setShowAddUrl(false); setAddUrlInput(""); }} className="text-[var(--color-text-muted)] hover:text-white">
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddUrl(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white hover:border-[var(--color-sabnzbd)]/50 transition-colors"
            >
              <Plus size={12} /> Add NZB URL
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] w-fit flex-wrap">
        {(["queue", "postproc", "history", "stats", "warnings", "servers"] as const).map((tab) => {
          const labels: Record<string, string> = { queue: "Queue", postproc: "Post-Processing", history: "History", stats: "Stats", warnings: "Warnings", servers: "Servers" };
          const label = labels[tab];
          const badge = tab === "postproc" && ppSlots.length > 0 ? ppSlots.length
            : tab === "warnings" && (warningsData?.data?.warnings?.length ?? 0) > 0 ? warningsData!.data.warnings.length
            : null;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? "text-black"
                  : "text-[var(--color-text-secondary)] hover:text-white"
              }`}
              style={activeTab === tab ? { background: "var(--color-sabnzbd)" } : undefined}
            >
              {label}
              {badge != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${activeTab === tab ? "bg-black/20 text-black" : "bg-[var(--color-sabnzbd)]/20 text-[var(--color-sabnzbd)]"}`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Queue tab ──────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === "queue" && (
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-3"
          >
            {/* Sort controls */}
            {queue?.slots && queue.slots.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-muted)]">Sort by</span>
                {(["avg_age", "name", "size"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      const dir = sortField === f && sortDir === "asc" ? "desc" : "asc";
                      setSortField(f); setSortDir(dir);
                      sortQueueMutation.mutate({ field: f, dir });
                    }}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${sortField === f ? "border-[var(--color-sabnzbd)]/50 text-[var(--color-sabnzbd)] bg-[var(--color-sabnzbd)]/10" : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-white"}`}
                  >
                    <ArrowDownUp size={10} />
                    {f === "avg_age" ? "Age" : f === "name" ? "Name" : "Size"}
                    {sortField === f && <span className="text-[9px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
                  </button>
                ))}
              </div>
            )}

            {queueLoading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />
                ))}
              </div>
            )}

            {!queueLoading && (!queue?.slots || queue.slots.length === 0) && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Download size={40} className="text-[var(--color-sabnzbd)] opacity-30 mb-3" />
                <p className="text-[var(--color-text-secondary)]">Queue is empty</p>
              </div>
            )}

            {(() => {
              const allSlots: SabQueueSlot[] = queue?.slots ?? [];
              const orderedSlots = dragOrder
                ? dragOrder.map((id) => allSlots.find((s) => s.nzo_id === id)).filter(Boolean) as SabQueueSlot[]
                : allSlots;
              return orderedSlots.map((slot, idx) => (
                <QueueItem
                  key={slot.nzo_id}
                  slot={slot}
                  index={idx}
                  isDragOver={dragOverId === slot.nzo_id}
                  availableCategories={availableCategories}
                  onDelete={() => deleteMutation.mutate(slot.nzo_id)}
                  onPause={() => pauseItemMutation.mutate(slot.nzo_id)}
                  onResume={() => resumeItemMutation.mutate(slot.nzo_id)}
                  onSetPriority={(p) => setPriorityMutation.mutate({ nzoId: slot.nzo_id, priority: p })}
                  onChangeCat={(cat) => changeCatMutation.mutate({ nzoId: slot.nzo_id, cat })}
                  onRename={(name) => renameMutation.mutate({ nzoId: slot.nzo_id, name })}
                  onDragStart={() => {
                    dragSourceId.current = slot.nzo_id;
                    const initial = allSlots.map((s) => s.nzo_id);
                    setDragOrder(initial);
                    dragOrderRef.current = initial;
                  }}
                  onDragOver={() => {
                    if (!dragSourceId.current || dragSourceId.current === slot.nzo_id) return;
                    setDragOverId(slot.nzo_id);
                    setDragOrder((prev) => {
                      const order = prev ?? allSlots.map((s) => s.nzo_id);
                      const from = order.indexOf(dragSourceId.current!);
                      const to = order.indexOf(slot.nzo_id);
                      if (from === -1 || to === -1 || from === to) return order;
                      const next = [...order];
                      next.splice(from, 1);
                      next.splice(to, 0, dragSourceId.current!);
                      dragOrderRef.current = next;
                      return next;
                    });
                  }}
                  onDragEnd={() => {
                    if (!dragSourceId.current) return;
                    const order = dragOrderRef.current ?? allSlots.map((s) => s.nzo_id);
                    const newPos = order.indexOf(dragSourceId.current);
                    const origPos = allSlots.findIndex((s) => s.nzo_id === dragSourceId.current);
                    if (newPos !== -1 && newPos !== origPos) {
                      moveMutation.mutate({ nzoId: dragSourceId.current, toPos: newPos });
                    } else {
                      setDragOrder(null);
                      dragOrderRef.current = null;
                      setDragOverId(null);
                    }
                    dragSourceId.current = null;
                  }}
                />
              ));
            })()}
          </motion.div>
        )}

        {/* ── Post-Processing tab ── */}
        {activeTab === "postproc" && (
          <motion.div
            key="postproc"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Active PP jobs from queue */}
            {ppSlots.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Active</p>
                {ppSlots.map((slot, idx) => (
                  <PPQueueItem key={slot.nzo_id} slot={slot} index={idx} />
                ))}
              </div>
            )}
            {ppSlots.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Wrench size={36} className="text-[var(--color-sabnzbd)] opacity-30 mb-3" />
                <p className="text-[var(--color-text-secondary)] text-sm">No items currently post-processing</p>
              </div>
            )}

            {/* Completed / failed from history (those with stage logs) */}
            {historySlots.filter((s) => s.stage_log && s.stage_log.length > 0).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Recent completed</p>
                  <HistoryBulkActions
                    hasHistory={historySlots.length > 0}
                    hasFailed={historySlots.some((s) => s.status === "Failed")}
                    onClearFailed={() => clearFailedMutation.mutate()}
                    onClearAll={() => clearAllHistoryMutation.mutate()}
                    clearFailedPending={clearFailedMutation.isPending}
                    clearAllPending={clearAllHistoryMutation.isPending}
                  />
                </div>
                {historySlots
                  .filter((s) => s.stage_log && s.stage_log.length > 0)
                  .slice(0, 20)
                  .map((slot, idx) => (
                    <HistoryItem
                      key={slot.nzo_id ?? idx}
                      slot={slot}
                      index={idx}
                      showStageLogs
                      onDelete={() => deleteHistoryMutation.mutate(slot.nzo_id)}
                      onRetry={slot.status === "Failed" ? () => retryHistoryMutation.mutate(slot.nzo_id) : undefined}
                    />
                  ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── History tab ── */}
        {activeTab === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-2"
          >
            {historyLoading && (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />
                ))}
              </div>
            )}

            {!historyLoading && historySlots.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <History size={40} className="text-[var(--color-sabnzbd)] opacity-30 mb-3" />
                <p className="text-[var(--color-text-secondary)]">No history yet</p>
              </div>
            )}

            {historySlots.length > 0 && (
              <div className="flex justify-end items-center gap-2">
                {historySlots.some((s) => s.status === "Failed") && (
                  <button
                    onClick={() => retryAllMutation.mutate()}
                    disabled={retryAllMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--color-sabnzbd)]/30 text-[var(--color-sabnzbd)] hover:bg-[var(--color-sabnzbd)]/10 disabled:opacity-50 transition-colors"
                  >
                    {retryAllMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    Retry All Failed
                  </button>
                )}
                <HistoryBulkActions
                  hasHistory={historySlots.length > 0}
                  hasFailed={historySlots.some((s) => s.status === "Failed")}
                  onClearFailed={() => clearFailedMutation.mutate()}
                  onClearAll={() => clearAllHistoryMutation.mutate()}
                  clearFailedPending={clearFailedMutation.isPending}
                  clearAllPending={clearAllHistoryMutation.isPending}
                />
              </div>
            )}

            {historySlots.map((slot, idx) => (
              <HistoryItem
                key={slot.nzo_id ?? idx}
                slot={slot}
                index={idx}
                onDelete={() => deleteHistoryMutation.mutate(slot.nzo_id)}
                onRetry={slot.status === "Failed" ? () => retryHistoryMutation.mutate(slot.nzo_id) : undefined}
                onMarkCompleted={slot.status === "Failed" ? () => markCompletedMutation.mutate(slot.nzo_id) : undefined}
              />
            ))}
          </motion.div>
        )}
        {/* ── Stats tab ── */}
        {activeTab === "stats" && (
          <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <StatsPanel data={serverStats?.data} />
          </motion.div>
        )}

        {/* ── Warnings tab ── */}
        {activeTab === "warnings" && (
          <motion.div key="warnings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-2">
            {(warningsData?.data?.warnings ?? []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 size={36} className="text-[var(--color-success)] opacity-60 mb-3" />
                <p className="text-[var(--color-text-secondary)]">No active warnings</p>
              </div>
            )}
            {(warningsData?.data?.warnings ?? []).map((w: { text: string; type: string; time: number }, i: number) => (
              <div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                w.type === "ERROR"
                  ? "bg-[var(--color-danger)]/8 border-[var(--color-danger)]/25"
                  : "bg-[var(--color-warning)]/8 border-[var(--color-warning)]/25"
              }`}>
                <TriangleAlert size={14} className={`shrink-0 mt-0.5 ${
                  w.type === "ERROR" ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${
                    w.type === "ERROR" ? "text-[var(--color-danger)]" : "text-[var(--color-warning)]"
                  }`}>{w.text}</p>
                  {w.time && <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{new Date(w.time * 1000).toLocaleString()}</p>}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Servers tab ── */}
        {activeTab === "servers" && (
          <motion.div key="servers" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
            <ServersPanel data={statusData?.data} />
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  glow,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`glass rounded-xl p-4 border border-[var(--color-border)] ${
        glow ? "glow-sabnzbd" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-1 text-[var(--color-text-secondary)]">
        {icon}
        <span className="text-xs uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-lg font-bold text-white font-mono">{value}</p>
    </div>
  );
}

interface SabQueueSlot {
  nzo_id: string;
  filename: string;
  status: string;
  percentage: string;
  mb: string;
  mbleft: string;
  timeleft: string;
  cat: string;
  priority: string;
  script?: string;
  pp?: string;
}

// SABnzbd priority values
const PRIORITIES = [
  { value: 2,  label: "Force",  color: "var(--color-danger)" },
  { value: 1,  label: "High",   color: "var(--color-warning)" },
  { value: 0,  label: "Normal", color: "var(--color-text-secondary)" },
  { value: -1, label: "Low",    color: "var(--color-text-muted)" },
] as const;

function priorityLabel(raw: string) {
  const n = parseInt(raw, 10);
  return PRIORITIES.find((p) => p.value === n) ?? PRIORITIES[2];
}

function QueueItem({
  slot,
  index,
  isDragOver,
  availableCategories,
  onDelete,
  onPause,
  onResume,
  onSetPriority,
  onChangeCat,
  onRename,
  onDragStart,
  onDragOver,
  onDragEnd,
}: {
  slot: SabQueueSlot;
  index: number;
  isDragOver: boolean;
  availableCategories: string[];
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
  onSetPriority: (priority: number) => void;
  onChangeCat: (cat: string) => void;
  onRename: (name: string) => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
}) {
  const pct = parseFloat(slot.percentage) || 0;
  const totalMb = parseFloat(slot.mb) || 0;
  const leftMb = parseFloat(slot.mbleft) || 0;
  const doneMb = totalMb - leftMb;
  const isItemPaused = slot.status === "Paused";
  const pri = priorityLabel(slot.priority);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(slot.filename);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(); }}
        onDragEnd={onDragEnd}
        className={`glass rounded-xl p-4 border transition-colors group ${
        isDragOver
          ? "border-[var(--color-sabnzbd)] bg-[var(--color-sabnzbd)]/5"
          : "border-[var(--color-border)]"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Drag handle */}
          <button
            draggable={false}
            className="shrink-0 cursor-grab active:cursor-grabbing p-1 text-[var(--color-text-muted)] hover:text-white transition-colors"
            title="Drag to reorder"
          >
            <GripVertical size={14} />
          </button>

          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { onRename(nameVal); setEditingName(false); }
                  if (e.key === "Escape") { setNameVal(slot.filename); setEditingName(false); }
                }}
                className="flex-1 bg-[var(--color-bg-input)] border border-[var(--color-sabnzbd)]/40 rounded-lg px-2 py-1 text-sm text-white outline-none"
              />
              <button onClick={() => { onRename(nameVal); setEditingName(false); }} className="text-xs px-2 py-1 rounded-md bg-[var(--color-sabnzbd)] text-black font-semibold">Save</button>
              <button onClick={() => { setNameVal(slot.filename); setEditingName(false); }} className="text-xs text-[var(--color-text-muted)] hover:text-white"><X size={13} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-white truncate">{slot.filename}</p>
              <button onClick={() => setEditingName(true)} className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--color-text-muted)] hover:text-white transition-all shrink-0" title="Rename">
                <Pencil size={11} />
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className={`text-xs font-mono ${statusColor(slot.status)}`}>
              {slot.status}
            </span>
            {/* Category pill + change-cat selector */}
            {availableCategories.length > 0 ? (
              <select
                value={slot.cat || ""}
                onChange={(e) => onChangeCat(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-sabnzbd)]/15 text-[var(--color-sabnzbd)] font-mono border border-[var(--color-sabnzbd)]/30 outline-none cursor-pointer"
              >
                {slot.cat && !availableCategories.includes(slot.cat) && (
                  <option value={slot.cat}>{slot.cat}</option>
                )}
                {availableCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : slot.cat && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-sabnzbd)]/15 text-[var(--color-sabnzbd)] font-mono">
                {slot.cat}
              </span>
            )}
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatBytes(doneMb)} / {formatBytes(totalMb)}
            </span>
            {slot.timeleft && slot.timeleft !== "0:00:00" && (
              <span className="text-xs text-[var(--color-text-muted)]">ETA {slot.timeleft}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono text-[var(--color-sabnzbd)] font-semibold">
            {pct.toFixed(0)}%
          </span>

          {/* Priority selector */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Flag size={11} style={{ color: pri.color }} />
            <select
              value={slot.priority}
              onChange={(e) => onSetPriority(parseInt(e.target.value, 10))}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded text-[11px] px-1 py-0.5 outline-none"
              style={{ color: pri.color }}
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value} style={{ color: "white" }}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Per-item pause / resume */}
          <button
            onClick={isItemPaused ? onResume : onPause}
            title={isItemPaused ? "Resume item" : "Pause item"}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-[var(--color-sabnzbd)]/15 text-[var(--color-text-muted)] hover:text-[var(--color-sabnzbd)] transition-all"
          >
            {isItemPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            title="Delete"
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-[var(--color-danger)]/20 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-[var(--color-bg-surface)] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: isItemPaused ? "var(--color-text-muted)" : "var(--color-sabnzbd)" }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      </div>
    </motion.div>
  );
}

interface SabStageLog {
  name: string;
  actions: string[];
}

interface SabHistorySlot {
  nzo_id: string;
  name: string;
  completed: number;
  status: string;
  storage: string;
  bytes: number;
  category: string;
  fail_message?: string;
  stage_log?: SabStageLog[];
}

function PPQueueItem({ slot, index }: { slot: SabQueueSlot; index: number }) {
  const PP_STEPS = [
    { key: "Verifying", label: "Verify" },
    { key: "Repairing", label: "Repair" },
    { key: "Joining", label: "Join" },
    { key: "Unpacking", label: "Unpack" },
    { key: "Moving", label: "Move" },
    { key: "Running", label: "Script" },
  ];
  const currentIdx = PP_STEPS.findIndex((s) => slot.status.startsWith(s.key));

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass rounded-xl p-4 border border-[var(--color-sabnzbd)]/30 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white truncate flex-1">{slot.filename}</p>
        <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: "color-mix(in srgb, var(--color-sabnzbd) 15%, transparent)", color: "var(--color-sabnzbd)", border: "1px solid color-mix(in srgb, var(--color-sabnzbd) 30%, transparent)" }}>
          {ppStageIcon(slot.status)}
          {slot.status}
        </span>
      </div>

      {/* Step pipeline */}
      <div className="flex items-center gap-1">
        {PP_STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} className="flex items-center gap-1 flex-1">
              <div className={`flex-1 h-0.5 rounded-full ${i === 0 ? "hidden" : ""} ${done || active ? "" : "bg-[var(--color-border)]"}`}
                style={done || active ? { background: "var(--color-sabnzbd)" } : undefined} />
              <div className="flex flex-col items-center gap-0.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all ${
                  done ? "border-[var(--color-success)] bg-[var(--color-success)]/20 text-[var(--color-success)]"
                  : active ? "border-[var(--color-sabnzbd)] bg-[var(--color-sabnzbd)]/20 text-[var(--color-sabnzbd)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)]"
                }`}>
                  {done ? <CheckCircle2 size={9} /> : active ? <Loader2 size={9} className="animate-spin" /> : i + 1}
                </div>
                <span className={`text-[9px] font-medium ${
                  done ? "text-[var(--color-success)]" : active ? "text-[var(--color-sabnzbd)]" : "text-[var(--color-text-muted)]"
                }`}>{step.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {slot.cat && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="px-1.5 py-0.5 rounded bg-[var(--color-sabnzbd)]/10 text-[var(--color-sabnzbd)] font-mono">{slot.cat}</span>
          {slot.script && slot.script !== "None" && <span className="flex items-center gap-1"><FileCode2 size={10}/> {slot.script}</span>}
        </div>
      )}
    </motion.div>
  );
}

function HistoryBulkActions({
  hasHistory,
  hasFailed,
  onClearFailed,
  onClearAll,
  clearFailedPending,
  clearAllPending,
}: {
  hasHistory: boolean;
  hasFailed: boolean;
  onClearFailed: () => void;
  onClearAll: () => void;
  clearFailedPending: boolean;
  clearAllPending: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {hasFailed && (
        <button
          onClick={onClearFailed}
          disabled={clearFailedPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-50"
        >
          {clearFailedPending ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
          Clear Failed
        </button>
      )}
      {hasHistory && (
        <button
          onClick={onClearAll}
          disabled={clearAllPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-white hover:border-[var(--color-border-bright)] disabled:opacity-50"
        >
          {clearAllPending ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          Clear All
        </button>
      )}
    </div>
  );
}

function HistoryItem({
  slot,
  index,
  showStageLogs = false,
  onDelete,
  onRetry,
  onMarkCompleted,
}: {
  slot: SabHistorySlot;
  index: number;
  showStageLogs?: boolean;
  onDelete?: () => void;
  onRetry?: () => void;
  onMarkCompleted?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const date = slot.completed ? new Date(slot.completed * 1000) : null;
  const sizeMb = slot.bytes ? slot.bytes / (1024 * 1024) : 0;
  const hasStageLogs = (slot.stage_log?.length ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.02 }}
      className="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden"
    >
      <div
        className={`flex items-center gap-4 px-4 py-3 ${hasStageLogs ? "cursor-pointer hover:bg-white/3 transition-colors" : ""}`}
        onClick={() => hasStageLogs && setExpanded(!expanded)}
      >
        <div className="shrink-0">{statusIcon(slot.status)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{slot.name}</p>
          {slot.fail_message && (
            <p className="text-xs text-[var(--color-danger)]">{slot.fail_message}</p>
          )}
        </div>
        <div className="shrink-0 text-right flex items-center gap-3">
          <div>
            <p className={`text-xs font-mono ${statusColor(slot.status)}`}>{slot.status}</p>
            {sizeMb > 0 && (
              <p className="text-xs text-[var(--color-text-muted)]">{formatBytes(sizeMb)}</p>
            )}
            {date && (
              <p className="text-xs text-[var(--color-text-muted)]">
                {date.toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {onRetry && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetry(); }}
                title="Retry"
                className="p-1.5 rounded-lg hover:bg-[var(--color-sabnzbd)]/15 text-[var(--color-text-muted)] hover:text-[var(--color-sabnzbd)] transition-all"
              >
                <RotateCcw size={13} />
              </button>
            )}
            {onMarkCompleted && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkCompleted(); }}
                title="Mark as completed"
                className="p-1.5 rounded-lg hover:bg-[var(--color-success)]/15 text-[var(--color-text-muted)] hover:text-[var(--color-success)] transition-all"
              >
                <CheckCircle2 size={13} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                title="Remove from history"
                className="p-1.5 rounded-lg hover:bg-[var(--color-danger)]/15 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-all"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {hasStageLogs && (
            <span className="text-[var(--color-text-muted)]">
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
        </div>
      </div>

      {/* Stage log */}
      <AnimatePresence>
        {expanded && hasStageLogs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-3 border-t border-[var(--color-border)]/60 pt-3">
              {slot.stage_log!.map((stage, si) => (
                <div key={si} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{ background: "color-mix(in srgb, var(--color-sabnzbd) 12%, transparent)", color: "var(--color-sabnzbd)" }}>
                      {stage.name}
                    </span>
                  </div>
                  <div className="pl-3 border-l-2 border-[var(--color-border)] space-y-1">
                    {stage.actions.map((action, ai) => {
                      const isErr = /error|fail|warn/i.test(action);
                      const isOk = /ok|success|complete|repair/i.test(action);
                      return (
                        <p key={ai} className={`text-[11px] font-mono leading-relaxed ${
                          isErr ? "text-[var(--color-danger)]"
                          : isOk ? "text-[var(--color-success)]"
                          : "text-slate-300"
                        }`}>
                          {action}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── StatsPanel ────────────────────────────────────────────────────────────────
function StatsPanel({ data }: { data: Record<string, unknown> | undefined }) {
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <BarChart3 size={36} className="text-[var(--color-sabnzbd)] opacity-30 mb-3" />
      <p className="text-[var(--color-text-secondary)]">No stats available</p>
    </div>
  );

  const topKeys = ["day", "week", "month", "total"] as const;
  const serverNames = Object.keys(data).filter((k) => !["day", "week", "month", "total", "server_names"].includes(k));

  return (
    <div className="space-y-6">
      {/* Totals row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {topKeys.map((k) => {
          const val = data[k] as number | undefined;
          return (
            <div key={k} className="glass rounded-xl p-4 border border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-1">{k}</p>
              <p className="text-lg font-bold text-white font-mono">{val != null ? formatBytes(val / (1024 * 1024)) : "—"}</p>
            </div>
          );
        })}
      </div>
      {/* Per-server */}
      {serverNames.map((name) => {
        const sv = data[name] as Record<string, number> | undefined;
        if (!sv) return null;
        return (
          <div key={name} className="glass rounded-xl p-4 border border-[var(--color-border)] space-y-3">
            <div className="flex items-center gap-2">
              <Server size={14} className="text-[var(--color-sabnzbd)]" />
              <p className="text-sm font-semibold text-white">{name}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {topKeys.map((k) => (
                <div key={k} className="rounded-lg bg-[var(--color-bg-input)] px-3 py-2">
                  <p className="text-[10px] text-[var(--color-text-muted)] uppercase">{k}</p>
                  <p className="text-sm font-mono text-white">{sv[k] != null ? formatBytes(sv[k] / (1024 * 1024)) : "—"}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ServersPanel ──────────────────────────────────────────────────────────────
interface SabServerStatus {
  servername: string;
  serveractive: boolean;
  servertotalconn: number;
  serveractiveconn: number;
  serverssl: number;
  serveroptional: number;
  serverbps: string;
  articles_tried?: number;
  articles_success?: number;
}
function ServersPanel({ data }: { data: Record<string, unknown> | undefined }) {
  const servers: SabServerStatus[] = (data as { status?: { servers?: SabServerStatus[] } } | undefined)?.status?.servers ?? [];
  if (servers.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Server size={36} className="text-[var(--color-sabnzbd)] opacity-30 mb-3" />
      <p className="text-[var(--color-text-secondary)]">No server info available</p>
    </div>
  );
  return (
    <div className="space-y-3">
      {servers.map((srv, i) => (
        <div key={i} className="glass rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${srv.serveractive ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]"}`} />
              <p className="text-sm font-medium text-white">{srv.servername}</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
              {!!srv.serverssl && <span className="text-[var(--color-success)]">SSL</span>}
              {!!srv.serveroptional ? <span className="text-[var(--color-text-muted)]">Optional</span> : <span className="text-[var(--color-sabnzbd)]">Required</span>}
              <span>{srv.serveractiveconn} / {srv.servertotalconn} conns</span>
              {srv.serverbps && srv.serverbps.trim() !== "0 " && srv.serverbps.trim() !== "" && (
                <span className="text-[var(--color-sabnzbd)]">{srv.serverbps}</span>
              )}
            </div>
          </div>
          {(srv.articles_tried ?? 0) > 0 && (
            <div className="mt-2 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-sabnzbd)]"
                style={{ width: `${Math.min(100, ((srv.articles_success ?? 0) / srv.articles_tried!) * 100).toFixed(1)}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
