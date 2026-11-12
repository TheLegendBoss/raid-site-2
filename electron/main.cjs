// Desktop shell for RAID SITE 2. Serves the built game from an app:// scheme
// (ES modules will not load from file://) and keeps the save in a real file in
// the user's app-data folder.
const { app, BrowserWindow, ipcMain, protocol, net, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const DIST = path.join(__dirname, '..', 'dist');
const smoke = process.env.RAID_SMOKE === '1';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function savePath() {
  return path.join(app.getPath('userData'), 'save.json');
}

ipcMain.handle('save:read', () => {
  try {
    return fs.readFileSync(savePath(), 'utf8');
  } catch {
    return null;
  }
});

// Write to a temp file then rename, keeping the previous save as save.bak.
ipcMain.handle('save:write', (_e, text) => {
  if (typeof text !== 'string' || text.length > 5_000_000) return;
  const file = savePath();
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, text, 'utf8');
  try {
    if (fs.existsSync(file)) fs.copyFileSync(file, file.replace(/\.json$/, '.bak'));
  } catch {
    /* best effort */
  }
  fs.renameSync(tmp, file);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#05080a',
    title: 'RAID SITE 2',
    autoHideMenuBar: true,
    show: !smoke,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  win.loadURL('app://game/index.html');
  return win;
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const url = new URL(req.url);
    let p = decodeURIComponent(url.pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(DIST, p));
    if (!file.startsWith(DIST)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });

  const win = createWindow();
  if (smoke) runSmoke(win);
});

app.on('window-all-closed', () => app.quit());

// RAID_SMOKE=1: load, check the bridge and the canvas, write a screenshot, exit.
function runSmoke(win) {
  const out = process.env.RAID_SMOKE_OUT || path.join(app.getPath('temp'), 'raid-smoke.png');
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 3) console.log('[page error]', msg);
  });
  setTimeout(async () => {
    try {
      const info = await win.webContents.executeJavaScript(`({
        bridge: typeof window.raidHost,
        canvas: !!document.querySelector('canvas'),
        w: innerWidth, h: innerHeight,
      })`);
      await win.webContents.executeJavaScript(`window.raidHost.writeSave(JSON.stringify({version:1,intel:7,unlocked:[],stash:[]}))`);
      const back = await win.webContents.executeJavaScript(`window.raidHost.readSave()`);
      const img = await win.webContents.capturePage();
      fs.writeFileSync(out, img.toPNG());
      console.log('SMOKE', JSON.stringify(info), 'save roundtrip', back && JSON.parse(back).intel === 7 ? 'ok' : 'FAIL', 'file', fs.existsSync(savePath()));
      app.exit(info.bridge === 'object' && info.canvas ? 0 : 1);
    } catch (err) {
      console.log('SMOKE FAIL', String(err));
      app.exit(1);
    }
  }, 9000);
}
