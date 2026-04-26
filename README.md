# Replacarr

A modern, unified desktop and web frontend for **Sonarr**, **Radarr**, **SABnzbd**, and **qBittorrent** — with a built-in **Discover** feature powered by TMDB.

Built with Next.js 15, React 19, Electron, and TailwindCSS 4.

---

## Features

- **Radarr** — Browse your movie library, manage files, quality profiles, tags, and trigger searches
- **Sonarr** — Browse your TV library by series and episode, manage files and quality profiles
- **SABnzbd** — Monitor active downloads, queue, history, and post-processing
- **qBittorrent** — Monitor torrents, manage categories and tags
- **Discover** — Find new movies and TV shows via TMDB with filters for genre, language, streaming provider, and network
- **Search** — Full TMDB search with instant results
- **Trending** — Today and this week's trending titles
- **System** — Health checks and status across all configured services
- **Wanted** — Missing and cutoff-unmet episodes/movies across Sonarr and Radarr
- Dark theme with per-service accent colours

> All four services are **independently optional** — configure only what you use.

---

## Prerequisites

| Install method | Requirements |
|---|---|
| Docker | Docker 20+ and Docker Compose v2 |
| Electron (desktop) | Windows 10/11 x64 |
| Build from source | Node.js 22+, npm 10+ |

---

## Install

### Docker (recommended)

There is no pre-built image on Docker Hub — you build it locally:

```bash
git clone https://github.com/yourusername/replacarr.git
cd replacarr
docker build -t replacarr:latest .
```

Then create a `docker-compose.yml` (or use the one in the repo) and start it:

```yaml
services:
  replacarr:
    image: replacarr:latest
    container_name: replacarr
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - TZ=UTC
      - SETTINGS_FILE=/data/settings.json
    volumes:
      - replacarr_data:/data

volumes:
  replacarr_data:
```

```bash
docker compose up -d
```

Open `http://localhost:3000` and configure your services in **Settings**.

---

### Electron Desktop App (Windows)

Download the latest release from the [Releases](../../releases) page and extract the zip. Run `Replacarr.exe` directly — no installer needed.

Or build it yourself (requires Node.js 22 and Windows):

```bash
git clone https://github.com/yourusername/replacarr.git
cd replacarr
npm install
npm run electron:build
```

The output will be in `dist-installer/win-unpacked/`. Run `Replacarr.exe` from that folder.

**Settings are stored at:** `%APPDATA%\Replacarr\settings.json`

---

### Local Development

```bash
git clone https://github.com/yourusername/replacarr.git
cd replacarr
npm install
npm run dev              # Next.js dev server at http://localhost:3000
npm run electron:dev     # Electron + Next.js together
```

---

## Configuration

All service URLs and API keys are configured inside the app under **Settings** and saved to `settings.json` automatically. No manual config file editing is required.

If you prefer environment variables (e.g. for Docker secrets or CI), copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

See `.env.example` for all available variables.

### TMDB API Key

The Discover and Search features require a free TMDB v3 API key:

1. Create an account at [themoviedb.org](https://www.themoviedb.org)
2. Go to **Settings → API** and request a free API key (v3 auth)
3. Enter it in Replacarr under **Settings → TMDB**

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, standalone output) |
| UI | React 19, TailwindCSS 4, Framer Motion |
| Desktop | Electron 40 |
| State | Zustand, TanStack Query |
| Icons | Lucide React |
| Notifications | Sonner |
| Language | TypeScript |

---

## License

MIT — see [LICENSE](LICENSE)
