"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

// ---------------------------------------------------------------------------
// Storage engine: uses Electron's file-based IPC when running in the desktop
// app, falls back to localStorage in browser / dev mode.
// This prevents settings from being lost when the dynamic port changes between
// runs (localStorage is origin-bound to http://127.0.0.1:PORT).
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    electronSettings?: {
      get: () => Promise<string | null>;
      set: (data: string) => Promise<void>;
    };
  }
}

// ---------------------------------------------------------------------------
// Server-file storage: calls /api/settings which persists to a JSON file on
// the server (Docker volume).  Falls back to localStorage when the API is
// unavailable (e.g. plain `next dev` without a /data dir configured).
// ---------------------------------------------------------------------------
const serverFileStorage: StateStorage = {
  getItem: async (_name: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return localStorage.getItem(_name);
      return await res.text();
    } catch {
      return localStorage.getItem(_name);
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        body: value,
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("api failed");
    } catch {
      localStorage.setItem(_name, value);
    }
  },
  removeItem: async (_name: string): Promise<void> => {
    try {
      const res = await fetch("/api/settings", { method: "DELETE" });
      if (!res.ok) throw new Error("api failed");
    } catch {
      localStorage.removeItem(_name);
    }
  },
};

const electronRawStorage: StateStorage = {
  getItem: async (_name: string): Promise<string | null> => {
    if (typeof window !== "undefined" && window.electronSettings) {
      return window.electronSettings.get();
    }
    return serverFileStorage.getItem(_name);
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    if (typeof window !== "undefined" && window.electronSettings) {
      await window.electronSettings.set(value);
      return;
    }
    await serverFileStorage.setItem(_name, value);
  },
  removeItem: async (_name: string): Promise<void> => {
    if (typeof window !== "undefined" && window.electronSettings) {
      await window.electronSettings.set("");
      return;
    }
    await serverFileStorage.removeItem(_name);
  },
};

export interface ServiceConfig {
  url: string;
  apiKey: string;
  enabled: boolean;
}

export interface SabnzbdConfig {
  url: string;
  apiKey: string;
  enabled: boolean;
}

export interface QbittorrentConfig {
  url: string;
  username: string;
  password: string;
  enabled: boolean;
}

export interface TmdbConfig {
  apiKey: string;
}

export type PosterSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface Settings {
  sonarr: ServiceConfig;
  radarr: ServiceConfig;
  sabnzbd: SabnzbdConfig;
  qbittorrent: QbittorrentConfig;
  tmdb: TmdbConfig;
  theme: {
    accentColor: "purple" | "cyan" | "green" | "orange" | "pink";
    compactMode: boolean;
  };
  library: {
    sonarrPosterSize: PosterSize;
    radarrPosterSize: PosterSize;
    cardFontSize: "xs" | "sm" | "md" | "lg";
  };
}

interface SettingsStore extends Settings {
  setSonarr: (config: Partial<ServiceConfig>) => void;
  setRadarr: (config: Partial<ServiceConfig>) => void;
  setSabnzbd: (config: Partial<SabnzbdConfig>) => void;
  setQbittorrent: (config: Partial<QbittorrentConfig>) => void;
  setTmdb: (config: Partial<TmdbConfig>) => void;
  setTheme: (theme: Partial<Settings["theme"]>) => void;
  setLibrary: (lib: Partial<Settings["library"]>) => void;
  isConfigured: () => boolean;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({      sonarr: {
        url: "http://localhost:8989",
        apiKey: "",
        enabled: true,
      },
      radarr: {
        url: "http://localhost:7878",
        apiKey: "",
        enabled: true,
      },
      sabnzbd: {
        url: "http://localhost:8080/sabnzbd",
        apiKey: "",
        enabled: true,
      },
      qbittorrent: {
        url: "http://localhost:8080",
        username: "admin",
        password: "",
        enabled: false,
      },
      tmdb: {
        apiKey: "",
      },
      theme: {
        accentColor: "purple",
        compactMode: false,
      },
      library: {
        sonarrPosterSize: "md",
        radarrPosterSize: "md",
        cardFontSize: "sm",
      },
      setSonarr: (config) =>
        set((state) => ({
          sonarr: { ...state.sonarr, ...config },
        })),
      setRadarr: (config) =>
        set((state) => ({
          radarr: { ...state.radarr, ...config },
        })),
      setSabnzbd: (config) =>
        set((state) => ({
          sabnzbd: { ...state.sabnzbd, ...config },
        })),
      setQbittorrent: (config) =>
        set((state) => ({
          qbittorrent: { ...state.qbittorrent, ...config },
        })),
      setTmdb: (config) =>
        set((state) => ({
          tmdb: { ...state.tmdb, ...config },
        })),
      setTheme: (theme) =>
        set((state) => ({
          theme: { ...state.theme, ...theme },
        })),
      setLibrary: (lib) =>
        set((state) => ({
          library: { ...state.library, ...lib },
        })),
      isConfigured: () => {
        const { sonarr, radarr, sabnzbd, qbittorrent } = get();
        return (
          (sonarr.enabled && !!sonarr.apiKey) ||
          (radarr.enabled && !!radarr.apiKey) ||
          (sabnzbd.enabled && !!sabnzbd.apiKey) ||
          (qbittorrent.enabled && !!qbittorrent.password)
        );
      },
    }),
    {
      name: "replacarr-settings",
      storage: createJSONStorage(() => electronRawStorage),
    }
  )
);
