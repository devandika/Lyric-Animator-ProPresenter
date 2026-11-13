const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

// Keep renderer timers, ProPresenter polling/stream, and animations at full speed even when ProPresenter has window focus
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");

const APP_PNG_ICON_PATH = path.join(__dirname, "assets/app-icon.png");
const APP_ICON_PATH = path.join(
  __dirname,
  process.platform === "win32" ? "assets/app-icon.ico" : "assets/app-icon.png"
);
const { getWindowsDisplays } = require("./windowsDisplays.cjs");
const {
  resolveSlideTheme,
  resolveMediaItem,
  getDefaultScreenUuid,
  getMediaTransition,
  getLayerTransitions,
  getMediaCatalog
} = require("./propresenterThemeParser.cjs");
const { remoteControlServer } = require("./remoteServer.cjs");

let mainWindow = null;
let projectorWindow = null;
let livePopoutWindow = null;

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

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.on("restore", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, "floating");
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));

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
    title: "Lyric Projector Output",
    icon: APP_ICON_PATH,
    frame: false,
    fullscreen: true,
    backgroundColor: "#000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  });

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
  livePopoutWindow.setAlwaysOnTop(true, "floating");
  livePopoutWindow.on("restore", () => {
    if (livePopoutWindow && !livePopoutWindow.isDestroyed()) {
      livePopoutWindow.setAlwaysOnTop(true, "floating");
    }
  });

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

ipcMain.handle("get-default-pro-screen", () => {
  try {
    return getDefaultScreenUuid();
  } catch (_) {
    return "";
  }
});

ipcMain.handle("get-media-transition", () => {
  try {
    return getMediaTransition();
  } catch (_) {
    return { type: "dissolve", name: "Dissolve", durationSeconds: 0.5, direction: "left", source: "default" };
  }
});

ipcMain.handle("get-layer-transitions", () => {
  try {
    return getLayerTransitions();
  } catch (_) {
    const fallback = { type: "dissolve", name: "Dissolve", durationSeconds: 0.5, direction: "left", source: "default" };
    return { media: fallback, slide: fallback };
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

if (process.platform === "win32") {
  app.setAppUserModelId("com.lyricanimator.propresenter");
}

app.whenReady().then(() => {
  if (process.platform === "darwin" && app.dock?.setIcon) {
    try {
      app.dock.setIcon(APP_PNG_ICON_PATH);
    } catch (_) {}
  }
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
  remoteControlServer.close();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
