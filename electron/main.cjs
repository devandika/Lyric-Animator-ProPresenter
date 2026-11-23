const { app, BrowserWindow, ipcMain, screen, Menu, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");

// Keep renderer timers, ProPresenter polling/stream, and animations at full speed even when ProPresenter has window focus
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.commandLine.appendSwitch("enable-accelerated-video-decode");
app.commandLine.appendSwitch("enable-gpu-rasterization");

const APP_PNG_ICON_PATH = path.join(__dirname, "assets/app-icon.png");
const APP_ICON_PATH = path.join(
  __dirname,
  process.platform === "win32" ? "assets/app-icon.ico" : "assets/app-icon.png"
);
const { getWindowsDisplays, forceWindowTopMost } = require("./windowsDisplays.cjs");
const {
  resolveSlideTheme,
  resolveMediaItem,
  getDefaultScreenUuid,
  getMediaTransition,
  getLayerTransitions,
  getMediaCatalog
} = require("./propresenterThemeParser.cjs");
const { remoteControlServer } = require("./remoteServer.cjs");
const {
  startProPresenterDiscovery,
  stopProPresenterDiscovery,
  getDiscoveredDevices,
  testProPresenterEndpoint
} = require("./networkDiscovery.cjs");

let mainWindow = null;
let projectorWindow = null;
let livePopoutWindow = null;
let hasCheckedStartupUpdate = false;
let currentUpdateState = {
  status: "idle", // idle | checking | available | not-available | downloading | downloaded | error
  currentVersion: app.getVersion(),
  isPackaged: app.isPackaged,
  version: "",
  releaseNotes: "",
  releaseDate: "",
  progress: null,
  error: "",
  source: "startup" // startup | manual
};

function normalizeReleaseNotes(rawNotes) {
  if (!rawNotes) return "";
  if (Array.isArray(rawNotes)) {
    return rawNotes
      .map((entry) => {
        if (!entry) return "";
        const ver = entry.version ? `v${entry.version}\n` : "";
        const note = normalizeReleaseNotes(entry.note || "");
        return `${ver}${note}`.trim();
      })
      .filter(Boolean)
      .join("\n\n");
  }
  const str = String(rawNotes);
  // Convert basic HTML from GitHub Releases API to clean readable plain text
  return str
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function broadcastUpdateState(patch = {}) {
  currentUpdateState = {
    ...currentUpdateState,
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    ...patch
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send("update-status", currentUpdateState);
    } catch (_) {}
  }
  return currentUpdateState;
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("checking-for-update", () => {
  broadcastUpdateState({
    status: "checking",
    error: "",
    progress: null
  });
});

autoUpdater.on("update-available", (info) => {
  broadcastUpdateState({
    status: "available",
    version: String(info?.version || ""),
    releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
    releaseDate: String(info?.releaseDate || ""),
    progress: null,
    error: ""
  });
});

autoUpdater.on("update-not-available", (info) => {
  broadcastUpdateState({
    status: "not-available",
    version: String(info?.version || app.getVersion()),
    releaseNotes: "",
    releaseDate: "",
    progress: null,
    error: ""
  });
});

autoUpdater.on("download-progress", (progressObj) => {
  broadcastUpdateState({
    status: "downloading",
    progress: {
      percent: Math.max(0, Math.min(100, Math.round(Number(progressObj?.percent) || 0))),
      bytesPerSecond: Number(progressObj?.bytesPerSecond) || 0,
      transferred: Number(progressObj?.transferred) || 0,
      total: Number(progressObj?.total) || 0
    },
    error: ""
  });
});

autoUpdater.on("update-downloaded", (info) => {
  broadcastUpdateState({
    status: "downloaded",
    version: String(info?.version || currentUpdateState.version || ""),
    releaseNotes: normalizeReleaseNotes(info?.releaseNotes) || currentUpdateState.releaseNotes || "",
    releaseDate: String(info?.releaseDate || currentUpdateState.releaseDate || ""),
    progress: {
      percent: 100,
      bytesPerSecond: 0,
      transferred: currentUpdateState.progress?.total || 0,
      total: currentUpdateState.progress?.total || 0
    },
    error: ""
  });
});

autoUpdater.on("error", (err) => {
  broadcastUpdateState({
    status: "error",
    error: err?.message || "Gagal memeriksa atau mengunduh pembaruan."
  });
});

async function runUpdateCheck(source = "manual") {
  if (!app.isPackaged) {
    const devMsg =
      "Auto-update hanya aktif pada versi aplikasi hasil build (packaged / installer).";
    if (source === "manual") {
      broadcastUpdateState({
        status: "error",
        source,
        error: devMsg
      });
    }
    return { ok: false, isDev: true, error: devMsg };
  }

  try {
    broadcastUpdateState({
      status: "checking",
      source,
      error: ""
    });
    const result = await autoUpdater.checkForUpdates();
    return { ok: true, version: result?.updateInfo?.version || "" };
  } catch (err) {
    const msg = err?.message || "Gagal menghubungi server GitHub Releases.";
    broadcastUpdateState({
      status: "error",
      source,
      error: msg
    });
    return { ok: false, error: msg };
  }
}
let currentProfileMenuState = {
  activeProfileId: "default",
  profiles: [{ id: "default", name: "Ibadah Raya" }],
  savedSongs: []
};

function sendProfileMenuAction(action) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send("profile-menu-action", action);
    } catch (_) {}
  }
}

function buildAndSetAppMenu() {
  const profiles = Array.isArray(currentProfileMenuState.profiles) && currentProfileMenuState.profiles.length > 0
    ? currentProfileMenuState.profiles
    : [{ id: "default", name: "Ibadah Raya", savedSongs: [] }];
  const activeId = currentProfileMenuState.activeProfileId || profiles[0].id;

  const profileSubmenuItems = profiles.map((p) => {
    const isActive = p.id === activeId;
    const songs = Array.isArray(p.savedSongs) ? p.savedSongs : [];

    const songItems =
      songs.length > 0
        ? [
            ...songs.map((s) => ({
              label: s.label,
              click: () =>
                sendProfileMenuAction({
                  type: "remove-song",
                  profileId: p.id,
                  songKey: s.key
                })
            })),
            { type: "separator" },
            {
              label: "Reset Semua Lagu di Profil Ini",
              click: () =>
                sendProfileMenuAction({
                  type: "clear-songs",
                  profileId: p.id
                })
            }
          ]
        : [
            {
              label: "Belum ada lagu tersimpan",
              enabled: false
            }
          ];

    return {
      label: `${isActive ? "✓ " : "    "}${p.name}`,
      submenu: [
        {
          label: isActive ? "Profil Sedang Aktif" : "Gunakan Profil Ini",
          type: "checkbox",
          checked: isActive,
          click: () => sendProfileMenuAction({ type: "switch", profileId: p.id })
        },
        { type: "separator" },
        ...songItems
      ]
    };
  });

  const template = [
    { role: "fileMenu" },
    { role: "editMenu" },
    { role: "viewMenu" },
    {
      label: "Profil",
      submenu: [
        {
          label: "Simpan...",
          click: () => sendProfileMenuAction({ type: "save" })
        },
        {
          label: "Ganti Nama...",
          click: () => sendProfileMenuAction({ type: "rename" })
        },
        {
          label: "Hapus...",
          enabled: profiles.length > 1,
          click: () => sendProfileMenuAction({ type: "delete" })
        },
        { type: "separator" },
        {
          label: "Impor...",
          click: () => sendProfileMenuAction({ type: "import" })
        },
        {
          label: "Ekspor...",
          click: () => sendProfileMenuAction({ type: "export" })
        },
        { type: "separator" },
        ...profileSubmenuItems
      ]
    },
    { role: "windowMenu" }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function notifyProjectorStatus() {
  const isLive = Boolean(projectorWindow && !projectorWindow.isDestroyed());
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send("projector-status", isLive);
    } catch (_) {}
  }
}

function notifyLivePopoutStatus() {
  const isOpen = Boolean(livePopoutWindow && !livePopoutWindow.isDestroyed());
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send("live-popout-status", isOpen);
    } catch (_) {}
  }
}

function resolveElectronDisplayForWindows(winDisp) {
  const electronDisplays = screen.getAllDisplays();
  if (!winDisp) {
    return electronDisplays[electronDisplays.length - 1] || screen.getPrimaryDisplay();
  }
  const centerPhys = {
    x: winDisp.x + Math.floor(winDisp.width / 2),
    y: winDisp.y + Math.floor(winDisp.height / 2)
  };
  try {
    const dipPt = screen.screenToDipPoint(centerPhys);
    return screen.getDisplayNearestPoint(dipPt);
  } catch (_) {
    return (
      electronDisplays[winDisp.index] ||
      electronDisplays[electronDisplays.length - 1] ||
      screen.getPrimaryDisplay()
    );
  }
}

let isNativeDialogOpen = false;

function enforceAlwaysOnTop(win) {
  if (!win || win.isDestroyed() || win.isMinimized() || isNativeDialogOpen) return;
  try {
    win.setAlwaysOnTop(true, "screen-saver", 1);
    if (typeof win.setVisibleOnAllWorkspaces === "function") {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    if (process.platform === "win32" && typeof win.getNativeWindowHandle === "function") {
      forceWindowTopMost(win.getNativeWindowHandle());
    }
  } catch (_) {
    try {
      win.setAlwaysOnTop(true, "screen-saver");
    } catch (__) {}
  }
}

function attachAlwaysOnTopGuards(win) {
  enforceAlwaysOnTop(win);
  win.on("ready-to-show", () => enforceAlwaysOnTop(win));
  win.on("show", () => enforceAlwaysOnTop(win));
  win.on("restore", () => enforceAlwaysOnTop(win));
  win.on("blur", () => {
    setTimeout(() => enforceAlwaysOnTop(win), 40);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 520,
    minHeight: 520,
    alwaysOnTop: true,
    title: "ProPresenter Lyric Animator",
    icon: APP_ICON_PATH,
    backgroundColor: "#0d0f12",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  attachAlwaysOnTopGuards(mainWindow);

  mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

  // Automatically check for updates once on initial startup (production/packaged builds only)
  mainWindow.webContents.once("did-finish-load", () => {
    if (!hasCheckedStartupUpdate && app.isPackaged) {
      hasCheckedStartupUpdate = true;
      setTimeout(() => {
        runUpdateCheck("startup").catch(() => {});
      }, 1500);
    }
  });

  // Press F12 to toggle DevTools when debugging is needed
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.webContents.on("render-process-gone", (event, details) => {
    console.warn("Renderer gone:", details);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (projectorWindow && !projectorWindow.isDestroyed()) {
      projectorWindow.close();
    }
    if (livePopoutWindow && !livePopoutWindow.isDestroyed()) {
      livePopoutWindow.close();
    }
  });
}

function openProjectorOnDisplay(displayIndex = 1) {
  let targetDisplay = null;
  if (process.platform === "win32") {
    try {
      const winDisplays = getWindowsDisplays();
      if (winDisplays.length > 0) {
        const chosenWin =
          winDisplays[displayIndex] || winDisplays[winDisplays.length - 1] || winDisplays[0];
        targetDisplay = resolveElectronDisplayForWindows(chosenWin);
      }
    } catch (_) {}
  }
  if (!targetDisplay) {
    const electronDisplays = screen.getAllDisplays();
    targetDisplay =
      electronDisplays[displayIndex] ||
      electronDisplays[electronDisplays.length - 1] ||
      screen.getPrimaryDisplay();
  }
  const { x, y, width, height } = targetDisplay.bounds;

  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.setFullScreen(false);
    projectorWindow.setBounds({ x, y, width, height });
    // Re-apply bounds once for Windows mixed-DPI monitors before entering fullscreen
    projectorWindow.setBounds({ x, y, width, height });
    projectorWindow.setFullScreen(true);
    projectorWindow.show();
    projectorWindow.focus();
    notifyProjectorStatus();
    return;
  }

  projectorWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    title: "Lyric Projector Output",
    icon: APP_ICON_PATH,
    frame: false,
    fullscreen: false,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  projectorWindow.webContents.setBackgroundThrottling(false);
  projectorWindow.setBounds({ x, y, width, height });
  projectorWindow.setBounds({ x, y, width, height });
  projectorWindow.setFullScreen(true);
  projectorWindow.show();

  projectorWindow.loadFile(path.join(__dirname, "../dist/index.html"), {
    query: { mode: "projector" }
  });

  projectorWindow.on("closed", () => {
    projectorWindow = null;
    notifyProjectorStatus();
  });

  notifyProjectorStatus();
}

function openLivePopoutWindow(bounds = {}) {
  const targetW = Math.max(240, Math.round(Number(bounds?.width) || 720));
  const targetH = Math.max(135, Math.round(Number(bounds?.height) || 405));

  let targetX;
  let targetY;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const contentBounds = mainWindow.getContentBounds();
    const rawX = Math.round(contentBounds.x + (Number(bounds?.left) || 0) + 24);
    const rawY = Math.round(contentBounds.y + (Number(bounds?.top) || 0) + 24);
    const disp = screen.getDisplayNearestPoint({ x: rawX, y: rawY });
    const wa = disp?.workArea || { x: 0, y: 0, width: 1920, height: 1080 };
    targetX = Math.max(wa.x, Math.min(rawX, wa.x + wa.width - targetW - 16));
    targetY = Math.max(wa.y, Math.min(rawY, wa.y + wa.height - targetH - 40));
  }

  if (livePopoutWindow && !livePopoutWindow.isDestroyed()) {
    livePopoutWindow.setContentSize(targetW, targetH);
    if (typeof targetX === "number" && typeof targetY === "number") {
      livePopoutWindow.setPosition(targetX, targetY);
    }
    livePopoutWindow.show();
    livePopoutWindow.focus();
    notifyLivePopoutStatus();
    return;
  }

  livePopoutWindow = new BrowserWindow({
    x: targetX,
    y: targetY,
    width: targetW,
    height: targetH,
    useContentSize: true,
    minWidth: 240,
    minHeight: 135,
    resizable: true,
    maximizable: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: "Live Program Preview",
    icon: APP_ICON_PATH,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

  livePopoutWindow.setMenuBarVisibility(false);
  livePopoutWindow.setMenu(null);
  attachAlwaysOnTopGuards(livePopoutWindow);

  livePopoutWindow.webContents.setBackgroundThrottling(false);

  livePopoutWindow.loadFile(path.join(__dirname, "../dist/index.html"), {
    query: { mode: "live-popout" }
  });

  livePopoutWindow.on("closed", () => {
    livePopoutWindow = null;
    notifyLivePopoutStatus();
  });

  notifyLivePopoutStatus();
}

// IPC Handlers: Direct Windows Display Resolution
ipcMain.handle("get-screens", () => {
  try {
    const winDisplays = getWindowsDisplays();
    if (winDisplays.length > 0) {
      return winDisplays.map((d) => ({
        id: d.deviceName,
        index: d.index,
        label: `Layar ${d.index + 1} (${d.width}x${d.height})`,
        width: d.width,
        height: d.height,
        hz: d.hz,
        isPrimary: d.isPrimary,
        monitorName: d.monitorName
      }));
    }
  } catch (err) {
    console.warn("Windows Win32 display query failed, using Electron fallback:", err);
  }

  const displays = screen.getAllDisplays();
  const primaryId = screen.getPrimaryDisplay().id;
  return displays.map((d, index) => {
    const scale = d.scaleFactor || 1;
    const width = Math.round(d.bounds.width * scale);
    const height = Math.round(d.bounds.height * scale);
    return {
      id: d.id,
      index,
      label: `Layar ${index + 1} (${width}x${height})`,
      width,
      height,
      isPrimary: d.id === primaryId
    };
  });
});

ipcMain.handle("get-projector-status", () => {
  return Boolean(projectorWindow && !projectorWindow.isDestroyed());
});

ipcMain.on("launch-projector", (event, displayIndex) => {
  openProjectorOnDisplay(displayIndex);
});

ipcMain.on("close-projector", () => {
  if (projectorWindow && !projectorWindow.isDestroyed()) {
    projectorWindow.close();
  }
  notifyProjectorStatus();
});

ipcMain.handle("get-live-popout-status", () => {
  return Boolean(livePopoutWindow && !livePopoutWindow.isDestroyed());
});

ipcMain.on("launch-live-popout", (_event, bounds) => {
  openLivePopoutWindow(bounds);
});

ipcMain.on("close-live-popout", () => {
  if (livePopoutWindow && !livePopoutWindow.isDestroyed()) {
    livePopoutWindow.close();
  }
  notifyLivePopoutStatus();
});

// IPC Handlers: ProPresenter Theme, Presentation & Media Resolution
ipcMain.handle("resolve-slide-theme", (_event, payload) => {
  try {
    return resolveSlideTheme(payload);
  } catch (err) {
    console.warn("resolve-slide-theme failed:", err);
    return null;
  }
});

ipcMain.handle("resolve-media-item", (_event, payload) => {
  try {
    return resolveMediaItem(payload);
  } catch (err) {
    console.warn("resolve-media-item failed:", err);
    return null;
  }
});

ipcMain.handle("get-default-pro-screen", (_event, payload) => {
  try {
    return getDefaultScreenUuid(payload);
  } catch (_) {
    return "";
  }
});

ipcMain.handle("get-media-transition", (_event, payload) => {
  try {
    return getMediaTransition(payload);
  } catch (_) {
    return { type: "dissolve", name: "Dissolve", durationSeconds: 0.5, direction: "left", source: "default" };
  }
});

ipcMain.handle("get-layer-transitions", (_event, payload) => {
  try {
    return getLayerTransitions(payload);
  } catch (_) {
    const fallback = { type: "dissolve", name: "Dissolve", durationSeconds: 0.5, direction: "left", source: "default" };
    return { media: fallback, slide: fallback };
  }
});

ipcMain.handle("select-propresenter-folder", async () => {
  isNativeDialogOpen = true;
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Pilih Folder Data / Workspace ProPresenter",
      properties: ["openDirectory"]
    });
    if (canceled || !filePaths || filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
    return { ok: true, folderPath: filePaths[0] };
  } catch (err) {
    return { ok: false, error: err?.message || "Gagal memilih folder ProPresenter." };
  } finally {
    isNativeDialogOpen = false;
    enforceAlwaysOnTop(mainWindow);
  }
});

ipcMain.handle("get-media-catalog", (_event, payload) => {
  try {
    return getMediaCatalog(payload);
  } catch (_) {
    return [];
  }
});

// Mobile Web Remote Control IPC Handlers
ipcMain.handle("get-remote-info", async () => {
  try {
    return await remoteControlServer.getRemoteInfo();
  } catch (err) {
    console.warn("get-remote-info failed:", err);
    return null;
  }
});

ipcMain.handle("get-qr-for-url", async (_event, targetUrl) => {
  try {
    return await remoteControlServer.getQrForUrl(targetUrl);
  } catch (err) {
    console.warn("get-qr-for-url failed:", err);
    return "";
  }
});

ipcMain.on("sync-remote-state", (_event, state) => {
  try {
    remoteControlServer.updateDesktopState(state);
  } catch (err) {
    console.warn("sync-remote-state failed:", err);
  }
});

// ProPresenter Auto-Discovery & Connection Check
ipcMain.on("start-propresenter-discovery", () => {
  startProPresenterDiscovery((devices) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("discovered-propresenter-devices", devices);
    }
  });
});

ipcMain.on("stop-propresenter-discovery", () => {
  stopProPresenterDiscovery();
});

ipcMain.handle("get-discovered-propresenter-devices", () => {
  return getDiscoveredDevices();
});

ipcMain.handle("test-propresenter-connection", async (_event, payload) => {
  const host = payload?.host || "127.0.0.1";
  const port = Number(payload?.port) || 50001;
  return await testProPresenterEndpoint(host, port, 1000);
});

// OBS-style Profil Acara Menu IPC Handlers
ipcMain.on("sync-profile-menu", (_event, payload) => {
  if (payload && Array.isArray(payload.profiles)) {
    currentProfileMenuState = {
      activeProfileId: payload.activeProfileId || "default",
      profiles: payload.profiles.map((p) => ({
        id: String(p.id),
        name: String(p.name || "Profil"),
        savedSongs: Array.isArray(p.savedSongs)
          ? p.savedSongs.map((s) => ({
              key: String(s.key || ""),
              label: String(s.label || "")
            }))
          : []
      }))
    };
    buildAndSetAppMenu();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const active = currentProfileMenuState.profiles.find(
        (p) => p.id === currentProfileMenuState.activeProfileId
      );
      if (active) {
        mainWindow.setTitle(`ProPresenter Lyric Animator — Profil: ${active.name}`);
      }
    }
  }
});

ipcMain.handle("export-profile-file", async (_event, payload) => {
  isNativeDialogOpen = true;
  try {
    const safeName = String(payload?.defaultName || "profil-acara")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Ekspor Profil Acara",
      defaultPath: `${safeName}.json`,
      filters: [{ name: "JSON Profile", extensions: ["json"] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, String(payload?.content || "{}"), "utf8");
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err?.message || "Gagal menyimpan file profil." };
  } finally {
    isNativeDialogOpen = false;
    enforceAlwaysOnTop(mainWindow);
  }
});

ipcMain.handle("import-profile-file", async () => {
  isNativeDialogOpen = true;
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Impor Profil Acara",
      properties: ["openFile"],
      filters: [{ name: "JSON Profile", extensions: ["json"] }]
    });
    if (canceled || !filePaths || filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
    const targetPath = filePaths[0];
    const content = fs.readFileSync(targetPath, "utf8");
    const fileName = path.basename(targetPath, path.extname(targetPath));
    return { ok: true, content, fileName };
  } catch (err) {
    return { ok: false, error: err?.message || "Gagal membaca file profil." };
  } finally {
    isNativeDialogOpen = false;
    enforceAlwaysOnTop(mainWindow);
  }
});

// Auto-Updater IPC Handlers (electron-updater / GitHub Releases)
ipcMain.handle("get-app-version", () => app.getVersion());

ipcMain.handle("get-update-state", () => ({
  ...currentUpdateState,
  currentVersion: app.getVersion(),
  isPackaged: app.isPackaged
}));

ipcMain.handle("check-for-updates", async () => {
  return await runUpdateCheck("manual");
});

ipcMain.handle("download-update", async () => {
  if (!app.isPackaged) {
    return { ok: false, error: "Unduhan update hanya tersedia pada aplikasi yang sudah di-build." };
  }
  try {
    broadcastUpdateState({
      status: "downloading",
      progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: 0 },
      error: ""
    });
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    const msg = err?.message || "Gagal mengunduh file pembaruan.";
    broadcastUpdateState({
      status: "error",
      error: msg
    });
    return { ok: false, error: msg };
  }
});

ipcMain.on("quit-and-install", () => {
  if (!app.isPackaged) return;
  autoUpdater.quitAndInstall(false, true);
});

if (process.platform === "win32") {
  app.setAppUserModelId("com.lyricanimator.propresenter");
}

app.whenReady().then(() => {
  if (process.platform === "darwin" && app.dock?.setIcon) {
    try {
      app.dock.setIcon(APP_PNG_ICON_PATH);
    } catch (_) {}
  }
  buildAndSetAppMenu();
  createMainWindow();

  // Initialize background local HTTP and WebSocket server for smartphone control
  remoteControlServer
    .init({
      onConfigUpdate: (configDelta) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("remote-config-update", configDelta);
        }
      },
      onAction: (action) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("remote-action-trigger", action);
        }
      },
      onClientCountChange: (count) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("remote-client-count", count);
        }
      }
    })
    .then(({ port }) => {
      console.log(`[RemoteServer] Started on port ${port}`);
    })
    .catch((err) => {
      console.warn("[RemoteServer] Failed to initialize:", err);
    });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("will-quit", () => {
  stopProPresenterDiscovery();
  remoteControlServer.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
