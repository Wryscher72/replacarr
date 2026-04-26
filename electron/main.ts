import { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, utilityProcess, ipcMain } from "electron";
import type { UtilityProcess } from "electron";
import * as path from "path";
import * as http from "http";
import * as net from "net";
import * as fs from "fs";

const isDev = !app.isPackaged;
let PORT = 3000;
let APP_URL = `http://127.0.0.1:${PORT}`;

let mainWindow: BrowserWindow | null = null;
let loadingWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let nextServer: UtilityProcess | null = null;
let isQuitting = false;

// ── Settings file (IPC) ─────────────────────────────────────────────────────────
const settingsPath = path.join(app.getPath("userData"), "settings.json");

ipcMain.handle("settings-get", () => {
  try {
    if (fs.existsSync(settingsPath)) {
      return fs.readFileSync(settingsPath, "utf-8");
    }
  } catch (e) {
    log("settings-get error: " + e);
  }
  return null;
});

ipcMain.handle("settings-set", (_event: Electron.IpcMainInvokeEvent, data: string) => {
  try {
    if (data) {
      fs.writeFileSync(settingsPath, data, "utf-8");
    }
  } catch (e) {
    log("settings-set error: " + e);
  }
});

// ── Log file ──────────────────────────────────────────────────────────────────
const logPath = path.join(app.getPath("userData"), "replacarr.log");
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(msg);
  try { fs.appendFileSync(logPath, line); } catch { /* ignore */ }
}

// ── Single instance lock ───────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ── Find a free port ──────────────────────────────────────────────────────────
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
    srv.on("error", reject);
  });
}

// ── Wait for Next.js to be ready ──────────────────────────────────────────────

function waitForServer(maxAttempts = 80): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function check() {
      attempts++;
      const req = http.get(APP_URL, () => {
        req.destroy();
        resolve();
      });
      req.on("error", () => {
        if (attempts >= maxAttempts) {
          reject(new Error(`Next.js server did not respond after ${maxAttempts * 500 / 1000}s`));
        } else {
          setTimeout(check, 500);
        }
      });
      req.setTimeout(1000, () => req.destroy());
      req.end();
    }
    check();
  });
}

// ── Loading window ────────────────────────────────────────────────────────────
function createLoadingWindow() {
  loadingWindow = new BrowserWindow({
    width: 400,
    height: 220,
    frame: false,
    resizable: false,
    center: true,
    backgroundColor: "#0f1117",
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin:0;padding:0;box-sizing:border-box }
    body { font-family:-apple-system,'Segoe UI',sans-serif;background:#0f1117;color:#e2e8f0;
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      height:100vh;gap:20px;-webkit-app-region:drag }
    h1 { font-size:24px;font-weight:700 }
    p  { font-size:13px;color:#94a3b8 }
    .spinner { width:32px;height:32px;border:3px solid #1e293b;border-top-color:#6366f1;
      border-radius:50%;animation:spin 0.8s linear infinite }
    @keyframes spin { to { transform:rotate(360deg) } }
  </style></head><body>
    <div class="spinner"></div><h1>Replacarr</h1><p>Starting server, please wait…</p>
  </body></html>`;

  loadingWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  loadingWindow.once("ready-to-show", () => loadingWindow?.show());
}

// ── Spawn Next.js standalone server (production only) ─────────────────────────

async function startNextServer() {
  PORT = await getFreePort();
  APP_URL = `http://127.0.0.1:${PORT}`;
  log(`Using port ${PORT}`);

  const serverScript = path.join(process.resourcesPath, "standalone", "server.js");
  log(`Server script: ${serverScript}`);

  if (!fs.existsSync(serverScript)) {
    throw new Error(`server.js not found at:\n${serverScript}\n\nresourcesPath: ${process.resourcesPath}`);
  }

  // utilityProcess.fork() runs the script in a plain Node.js environment,
  // bypassing Electron app initialization (avoids single-instance lock conflict).
  nextServer = utilityProcess.fork(serverScript, [], {
    cwd: path.dirname(serverScript),
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
    },
    stdio: "pipe",
  });

  nextServer.stdout?.on("data", (d: Buffer) => log("[next] " + d.toString().trim()));
  nextServer.stderr?.on("data", (d: Buffer) => log("[next:err] " + d.toString().trim()));
  nextServer.on("exit", (code) => log(`[next] exited with code ${code ?? "?"}` ));

  await waitForServer();
  log("Server ready");
}

// ── BrowserWindow ─────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0f1117",
    show: false,
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.once("ready-to-show", () => {
    loadingWindow?.close();
    loadingWindow = null;
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Hide to tray instead of quitting on close
  mainWindow.on("close", (e) => {
    if (!isQuitting && tray) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── System tray ───────────────────────────────────────────────────────────────

function getIconPath(): string {
  return isDev
    ? path.join(__dirname, "..", "public", "favicon.ico")
    : path.join(process.resourcesPath, "standalone", "public", "favicon.ico");
}

function createTray() {
  let icon: Electron.NativeImage;
  try {
    icon = nativeImage.createFromPath(getIconPath());
  } catch {
    icon = nativeImage.createEmpty();
  }
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("Replacarr");

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open Replacarr",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      { type: "separator" },
      {
        label: "Show log file",
        click: () => shell.openPath(logPath),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ])
  );

  tray.on("click", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus();
    } else {
      mainWindow?.show();
    }
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.on("ready", async () => {
  log("App ready, isPackaged=" + app.isPackaged);
  createLoadingWindow();

  try {
    if (!isDev) {
      await startNextServer();
    }
    createWindow();
    createTray();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log("FATAL: " + msg);
    loadingWindow?.close();
    dialog.showErrorBox("Replacarr failed to start", msg + `\n\nLog: ${logPath}`);
    app.quit();
  }
});

// Stay resident in the tray
app.on("window-all-closed", () => {
  // Intentionally empty — kept alive by tray
});

app.on("activate", () => {
  mainWindow?.show();
});

app.on("before-quit", () => {
  isQuitting = true;
  nextServer?.kill();
});
