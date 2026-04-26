"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useSettings } from "@/store/settings";
import { Header } from "@/components/layout/Header";
import {
  Tv2,
  Film,
  HardDriveDownload,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Save,
  Palette,
  Magnet,
  User,
  Clapperboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionTestResult {
  ok: boolean;
  message: string;
  version?: string;
}

interface ServiceSettingsCardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  glowClass: string;
  url: string;
  apiKey: string;
  enabled: boolean;
  onUrlChange: (v: string) => void;
  onApiKeyChange: (v: string) => void;
  onEnabledChange: (v: boolean) => void;
  testEndpoint: string;
  apiKeyHeader: string;
  urlHeader: string;
  urlPlaceholder?: string;
}

function ServiceSettingsCard({
  title,
  subtitle,
  icon: Icon,
  color,
  glowClass,
  url,
  apiKey,
  enabled,
  onUrlChange,
  onApiKeyChange,
  onEnabledChange,
  testEndpoint,
  apiKeyHeader,
  urlHeader,
  urlPlaceholder = "http://localhost:8989",
}: ServiceSettingsCardProps) {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  async function testConnection() {
    if (!url || !apiKey) {
      setTestResult({ ok: false, message: "URL and API key are required." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(testEndpoint, {
        headers: {
          [apiKeyHeader]: apiKey,
          [urlHeader]: url,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTestResult({
          ok: true,
          message: "Connection successful!",
          version: data.version,
        });
      } else {
        setTestResult({ ok: false, message: `HTTP ${res.status} — check URL and API key.` });
      }
    } catch {
      setTestResult({ ok: false, message: "Could not reach the server. Is it running?" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden",
        !enabled && "opacity-60"
      )}
    >
      {/* Colored top bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />

      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: `${color}22`, border: `1px solid ${color}44` }}
            >
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">{title}</h3>
              <p className="text-[var(--color-text-muted)] text-xs">{subtitle}</p>
            </div>
          </div>

          {/* Enable toggle */}
          <button
            onClick={() => onEnabledChange(!enabled)}
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none",
              enabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-input)]"
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200",
                enabled ? "translate-x-[22px]" : "translate-x-0.5"
              )}
            />
          </button>
        </div>

        <div className="space-y-4">
          {/* URL Field */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
              Server URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder={urlPlaceholder}
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* API Key Field */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="Paste your API key here"
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white transition-colors"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
              Find this in Settings → General → Security inside {title}.
            </p>
          </div>

          {/* Test connection */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={testConnection}
              disabled={testing || !enabled}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                "border text-white",
                testing
                  ? "border-[var(--color-border)] bg-transparent"
                  : "hover:opacity-90 active:scale-95"
              )}
              style={
                !testing
                  ? { background: `${color}22`, borderColor: `${color}66`, color }
                  : undefined
              }
            >
              {testing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <span>⚡</span>
              )}
              Test Connection
            </button>

            {testResult && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  testResult.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                )}
              >
                {testResult.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span>
                  {testResult.message}
                  {testResult.version && (
                    <span className="text-[var(--color-text-muted)] ml-1">
                      (v{testResult.version})
                    </span>
                  )}
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// qBittorrent settings card — uses username/password instead of API key
function QbittorrentSettingsCard() {
  const { qbittorrent, setQbittorrent } = useSettings();
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; version?: string } | null>(null);
  const color = "var(--color-qbittorrent)";

  async function testConnection() {
    if (!qbittorrent.url) {
      setTestResult({ ok: false, message: "URL is required." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/qbittorrent/app/version", {
        headers: {
          "x-qbt-url": qbittorrent.url,
          "x-qbt-username": qbittorrent.username,
          "x-qbt-password": qbittorrent.password,
        },
      });
      if (res.ok) {
        const version = await res.text();
        setTestResult({ ok: true, message: "Connection successful!", version: version.trim() });
      } else if (res.status === 401) {
        setTestResult({ ok: false, message: "Authentication failed. Check username and password." });
      } else {
        setTestResult({ ok: false, message: `HTTP ${res.status} — is qBittorrent running?` });
      }
    } catch {
      setTestResult({ ok: false, message: "Could not reach qBittorrent. Check the URL." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden",
        !qbittorrent.enabled && "opacity-60"
      )}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
              <Magnet size={20} style={{ color }} />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">qBittorrent</h3>
              <p className="text-[var(--color-text-muted)] text-xs">BitTorrent download client</p>
            </div>
          </div>
          <button
            onClick={() => setQbittorrent({ enabled: !qbittorrent.enabled })}
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none",
              qbittorrent.enabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-input)]"
            )}
          >
            <span className={cn("absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200", qbittorrent.enabled ? "translate-x-[22px]" : "translate-x-0.5")} />
          </button>
        </div>

        <div className="space-y-4">
          {/* URL */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Server URL</label>
            <input
              type="url"
              value={qbittorrent.url}
              onChange={(e) => setQbittorrent({ url: e.target.value })}
              placeholder="http://localhost:8080"
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider flex items-center gap-1">
              <User size={11} /> Username
            </label>
            <input
              type="text"
              value={qbittorrent.username}
              onChange={(e) => setQbittorrent({ username: e.target.value })}
              placeholder="admin"
              className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">Password</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={qbittorrent.password}
                onChange={(e) => setQbittorrent({ password: e.target.value })}
                placeholder="Enter qBittorrent password"
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white transition-colors">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">Default credentials are admin / adminadmin in qBittorrent.</p>
          </div>

          {/* Test */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={testConnection}
              disabled={testing || !qbittorrent.enabled}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border text-white",
                testing ? "border-[var(--color-border)] bg-transparent" : "hover:opacity-90 active:scale-95"
              )}
              style={!testing ? { background: `${color}22`, borderColor: `${color}66`, color } : undefined}
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <span>⚡</span>}
              Test Connection
            </button>
            {testResult && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                className={cn("flex items-center gap-1.5 text-sm", testResult.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                {testResult.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span>{testResult.message}{testResult.version && <span className="text-[var(--color-text-muted)] ml-1">(v{testResult.version})</span>}</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// TMDB settings card — API key only (no URL; uses TMDB's public API via proxy)
function TmdbSettingsCard() {
  const { tmdb, setTmdb } = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const color = "var(--color-tmdb)";

  async function testConnection() {
    if (!tmdb.apiKey) {
      setTestResult({ ok: false, message: "API key is required." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/tmdb/configuration", {
        headers: { "x-tmdb-apikey": tmdb.apiKey },
      });
      if (res.ok) {
        setTestResult({ ok: true, message: "Connection successful!" });
      } else {
        setTestResult({ ok: false, message: "Invalid API key — check your TMDB account." });
      }
    } catch {
      setTestResult({ ok: false, message: "Could not reach TMDB API." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
            <Clapperboard size={20} style={{ color }} />
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">TMDB</h3>
            <p className="text-[var(--color-text-muted)] text-xs">The Movie Database — powers Discover &amp; Search</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">API Key (v3)</label>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={tmdb.apiKey}
                onChange={(e) => setTmdb({ apiKey: e.target.value })}
                placeholder="Paste your TMDB API key"
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[var(--color-bg-input)] border border-[var(--color-border)] text-white placeholder-[var(--color-text-muted)] text-sm font-mono focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-white transition-colors">
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
              Get a free key at{" "}
              <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer" className="underline hover:text-white">
                themoviedb.org/settings/api
              </a>
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={testConnection}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border hover:opacity-90 active:scale-95"
              style={!testing ? { background: `${color}22`, borderColor: `${color}66`, color } : undefined}
            >
              {testing ? <Loader2 size={14} className="animate-spin" /> : <span>⚡</span>}
              Test Connection
            </button>
            {testResult && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                className={`flex items-center gap-1.5 text-sm ${testResult.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                {testResult.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span>{testResult.message}</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const accentColors = [
  { label: "Cyan",   value: "cyan"   as const, css: "#06b6d4" },
  { label: "Green",  value: "green"  as const, css: "#10b981" },
  { label: "Orange", value: "orange" as const, css: "#f97316" },
  { label: "Pink",   value: "pink"   as const, css: "#ec4899" },
];

export default function SettingsPage() {
  const settings = useSettings();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    // Settings auto-persist via Zustand persist middleware
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Settings" subtitle="Configure your Sonarr, Radarr, SABnzbd & qBittorrent connections" />

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Connection banner if not configured */}
        {!settings.isConfigured() && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-accent-glow)] border border-[var(--color-accent)] text-sm"
          >
            <span className="text-xl">🚀</span>
            <div>
              <p className="text-white font-semibold">Welcome to Replacarr!</p>
              <p className="text-[var(--color-text-secondary)] mt-0.5">
                Enter your Sonarr and/or Radarr connection details below and click{" "}
                <strong>Test Connection</strong> to get started.
              </p>
            </div>
          </motion.div>
        )}

        {/* Service cards */}
        <ServiceSettingsCard
          title="Sonarr"
          subtitle="TV Shows & Series management"
          icon={Tv2}
          color="var(--color-sonarr)"
          glowClass="glow-sonarr"
          url={settings.sonarr.url}
          apiKey={settings.sonarr.apiKey}
          enabled={settings.sonarr.enabled}
          onUrlChange={(v) => settings.setSonarr({ url: v })}
          onApiKeyChange={(v) => settings.setSonarr({ apiKey: v })}
          onEnabledChange={(v) => settings.setSonarr({ enabled: v })}
          testEndpoint="/api/sonarr/system/status"
          apiKeyHeader="x-sonarr-apikey"
          urlHeader="x-sonarr-url"
          urlPlaceholder="http://localhost:8989"
        />

        <ServiceSettingsCard
          title="Radarr"
          subtitle="Movies management"
          icon={Film}
          color="var(--color-radarr)"
          glowClass="glow-radarr"
          url={settings.radarr.url}
          apiKey={settings.radarr.apiKey}
          enabled={settings.radarr.enabled}
          onUrlChange={(v) => settings.setRadarr({ url: v })}
          onApiKeyChange={(v) => settings.setRadarr({ apiKey: v })}
          onEnabledChange={(v) => settings.setRadarr({ enabled: v })}
          testEndpoint="/api/radarr/system/status"
          apiKeyHeader="x-radarr-apikey"
          urlHeader="x-radarr-url"
          urlPlaceholder="http://localhost:7878"
        />

        <ServiceSettingsCard
          title="SABnzbd"
          subtitle="Usenet download client"
          icon={HardDriveDownload}
          color="var(--color-sabnzbd)"
          glowClass="glow-sabnzbd"
          url={settings.sabnzbd.url}
          apiKey={settings.sabnzbd.apiKey}
          enabled={settings.sabnzbd.enabled}
          onUrlChange={(v) => settings.setSabnzbd({ url: v })}
          onApiKeyChange={(v) => settings.setSabnzbd({ apiKey: v })}
          onEnabledChange={(v) => settings.setSabnzbd({ enabled: v })}
          testEndpoint="/api/sabnzbd/?mode=version&output=json"
          apiKeyHeader="x-sabnzbd-apikey"
          urlHeader="x-sabnzbd-url"
          urlPlaceholder="http://localhost:8080/sabnzbd"
        />

        <QbittorrentSettingsCard />

        <TmdbSettingsCard />

        {/* Theme settings */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--color-accent-glow)] border border-[var(--color-accent)]">
              <Palette size={20} className="text-[var(--color-accent-bright)]" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">Appearance</h3>
              <p className="text-[var(--color-text-muted)] text-xs">Customize the UI theme</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                Accent Color
              </label>
              <div className="flex gap-3">
                {accentColors.map((ac) => (
                  <button
                    key={ac.value}
                    onClick={() => settings.setTheme({ accentColor: ac.value })}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                      settings.theme.accentColor === ac.value
                        ? "border-white text-white"
                        : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-bright)]"
                    )}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: ac.css }}
                    />
                    {ac.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Compact Mode</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Reduce spacing for denser information display
                </p>
              </div>
              <button
                onClick={() =>
                  settings.setTheme({ compactMode: !settings.theme.compactMode })
                }
                className={cn(
                  "relative w-11 h-6 rounded-full transition-colors duration-200",
                  settings.theme.compactMode
                    ? "bg-[var(--color-accent)]"
                    : "bg-[var(--color-bg-input)] border border-[var(--color-border)]"
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200",
                    settings.theme.compactMode ? "translate-x-[22px]" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Save footer */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <p className="text-xs text-[var(--color-text-muted)]">
            Settings are automatically saved to your browser&apos;s local storage.
          </p>
          <motion.button
            onClick={handleSave}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all",
              saved
                ? "bg-[var(--color-success)] text-white"
                : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-bright)] text-white"
            )}
          >
            {saved ? (
              <>
                <CheckCircle2 size={15} />
                Saved!
              </>
            ) : (
              <>
                <Save size={15} />
                Save Settings
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
