"use client";

import { useMemo } from "react";
import axios from "axios";
import { useSettings } from "@/store/settings";

export function useApi() {
  const { sonarr, radarr, sabnzbd, qbittorrent, tmdb } = useSettings();

  // 90 s — release searches hit every indexer in real time and can take 60+ seconds.
  const sonarrApi = useMemo(
    () =>
      axios.create({
        baseURL: "/api/sonarr",
        headers: {
          "x-sonarr-apikey": sonarr.apiKey,
          "x-sonarr-url": sonarr.url,
        },
        timeout: 90000,
      }),
    [sonarr.apiKey, sonarr.url]
  );

  const radarrApi = useMemo(
    () =>
      axios.create({
        baseURL: "/api/radarr",
        headers: {
          "x-radarr-apikey": radarr.apiKey,
          "x-radarr-url": radarr.url,
        },
        timeout: 90000,
      }),
    [radarr.apiKey, radarr.url]
  );

  // SABnzbd uses a single-endpoint API: /api?mode=...&apikey=...
  // We forward requests to our proxy which injects the URL and apikey.
  const sabnzbdApi = useMemo(
    () =>
      axios.create({
        baseURL: "/api/sabnzbd",
        headers: {
          "x-sabnzbd-apikey": sabnzbd.apiKey,
          "x-sabnzbd-url": sabnzbd.url,
        },
        timeout: 20000,
      }),
    [sabnzbd.apiKey, sabnzbd.url]
  );

  // qBittorrent uses cookie-based session auth; the proxy handles login + SID management.
  const qbittorrentApi = useMemo(
    () =>
      axios.create({
        baseURL: "/api/qbittorrent",
        headers: {
          "x-qbt-url": qbittorrent.url,
          "x-qbt-username": qbittorrent.username,
          "x-qbt-password": qbittorrent.password,
        },
        timeout: 20000,
      }),
    [qbittorrent.url, qbittorrent.username, qbittorrent.password]
  );

  const tmdbApi = useMemo(
    () =>
      axios.create({
        baseURL: "/api/tmdb",
        headers: {
          "x-tmdb-apikey": tmdb.apiKey,
        },
        timeout: 15000,
      }),
    [tmdb.apiKey]
  );

  return { sonarrApi, radarrApi, sabnzbdApi, qbittorrentApi, tmdbApi };
}
