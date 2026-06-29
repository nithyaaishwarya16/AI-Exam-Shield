const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

/** Process names must stay aligned with `src/config/prohibitedApps.ts` (labels + Windows/macOS matching). */
const PROHIBITED = [
  { id: "teams", label: "Microsoft Teams", win: ["teams.exe", "ms-teams.exe"], darwin: ["teams", "msteams", "microsoft teams"] },
  { id: "zoom", label: "Zoom", win: ["zoom.exe"], darwin: ["zoom.us", "zoomopener"] },
  { id: "discord", label: "Discord", win: ["discord.exe"], darwin: ["discord"] },
  { id: "slack", label: "Slack", win: ["slack.exe"], darwin: ["slack"] },
  { id: "skype", label: "Skype", win: ["skype.exe", "skypeapp.exe"], darwin: ["skype"] },
  { id: "anydesk", label: "AnyDesk", win: ["anydesk.exe"], darwin: ["anydesk"] },
  { id: "teamviewer", label: "TeamViewer", win: ["teamviewer.exe"], darwin: ["teamviewer"] },
  { id: "webex", label: "Webex", win: ["ciscocollabhost.exe", "webexhost.exe", "atmgr.exe"], darwin: ["webex", "ciscocollabhost"] },
];

function parseWindowsTasklist(stdout) {
  const images = new Set();
  for (const line of stdout.split(/\r?\n/)) {
    const m = /^"([^"]+)"/.exec(line.trim());
    if (m) images.add(m[1].toLowerCase());
  }
  return images;
}

async function getWindowsRunningImages() {
  const { stdout } = await execFileAsync("tasklist", ["/FO", "CSV", "/NH"], {
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
  });
  return parseWindowsTasklist(stdout);
}

async function getDarwinRunningCommands() {
  const { stdout } = await execFileAsync("ps", ["-A", "-o", "comm="], {
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
  });
  const cmds = [];
  for (const line of stdout.split(/\r?\n/)) {
    const t = line.trim().toLowerCase();
    if (t) cmds.push(t);
  }
  return cmds;
}

async function checkProhibitedProcesses() {
  const platform = process.platform;
  let runningImages = null;
  let darwinCmds = null;

  if (platform === "win32") {
    runningImages = await getWindowsRunningImages();
  } else if (platform === "darwin") {
    darwinCmds = await getDarwinRunningCommands();
  } else {
    return PROHIBITED.map((p) => ({
      id: p.id,
      displayName: p.label,
      running: false,
      matchedExecutable: null,
      note: "Automatic process scan is only supported on Windows and macOS in the desktop app.",
    }));
  }

  return PROHIBITED.map((p) => {
    if (platform === "win32" && runningImages) {
      for (const exe of p.win) {
        if (runningImages.has(exe)) {
          return {
            id: p.id,
            displayName: p.label,
            running: true,
            matchedExecutable: exe,
            note: null,
          };
        }
      }
      return { id: p.id, displayName: p.label, running: false, matchedExecutable: null, note: null };
    }
    if (platform === "darwin" && darwinCmds) {
      for (const cmd of darwinCmds) {
        for (const frag of p.darwin) {
          if (cmd.includes(frag)) {
            return {
              id: p.id,
              displayName: p.label,
              running: true,
              matchedExecutable: cmd,
              note: null,
            };
          }
        }
      }
      return { id: p.id, displayName: p.label, running: false, matchedExecutable: null, note: null };
    }
    return { id: p.id, displayName: p.label, running: false, matchedExecutable: null, note: null };
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:8080";
  if (!app.isPackaged) {
    win.loadURL(devUrl);
    // Detached DevTools spams harmless Autofill.* CDP errors in the terminal; opt in with ELECTRON_OPEN_DEVTOOLS=1
    if (process.env.ELECTRON_OPEN_DEVTOOLS === "1") {
      win.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  ipcMain.handle("examshield:check-prohibited-processes", () => checkProhibitedProcesses());
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
