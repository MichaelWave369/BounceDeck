const { app, BrowserWindow, dialog, ipcMain, net, protocol } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEFAULT_LLM_BASE_URL = 'https://api.openai.com/v1';
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus']);
const LIBRARY_VERSION = 1;
const mediaById = new Map();
let libraryLoaded = false;
let libraryState = { version: LIBRARY_VERSION, roots: [], tracks: [], scannedAt: null };

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'bounce-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#090b0d',
    title: 'BounceDeck',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) win.loadURL(devUrl);
  else win.loadURL(pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString());
}

function libraryFile() {
  return path.join(app.getPath('userData'), 'library-v1.json');
}

function idFor(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function rootId(root) {
  return `root-${idFor(normalizeForIdentity(root))}`;
}

function normalizeForIdentity(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function parseTrackName(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath, extension);
  const separator = base.indexOf(' - ');
  if (separator > 0) {
    return {
      artist: base.slice(0, separator).trim(),
      title: base.slice(separator + 3).trim() || base,
      extension: extension.slice(1),
    };
  }
  return { artist: undefined, title: base, extension: extension.slice(1) };
}

function publicLibraryState() {
  return {
    roots: libraryState.roots.map((root) => ({
      id: rootId(root),
      name: path.basename(root) || 'Music folder',
    })),
    tracks: libraryState.tracks.map((track) => ({
      id: track.id,
      name: track.title,
      title: track.title,
      artist: track.artist,
      extension: track.extension,
      source: 'library',
      url: `bounce-media://track/${track.id}`,
    })),
    scannedAt: libraryState.scannedAt,
  };
}

async function ensureLibraryLoaded() {
  if (libraryLoaded) return;
  libraryLoaded = true;
  try {
    const parsed = JSON.parse(await fs.readFile(libraryFile(), 'utf8'));
    if (parsed?.version === LIBRARY_VERSION && Array.isArray(parsed.roots) && Array.isArray(parsed.tracks)) {
      libraryState = {
        version: LIBRARY_VERSION,
        roots: parsed.roots.filter((root) => typeof root === 'string'),
        tracks: parsed.tracks.filter(
          (track) => track && typeof track.id === 'string' && typeof track.path === 'string' && typeof track.title === 'string',
        ),
        scannedAt: typeof parsed.scannedAt === 'number' ? parsed.scannedAt : null,
      };
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') console.warn('BounceDeck library index could not be read.', error);
  }
  rehydrateMediaMap();
}

function rehydrateMediaMap() {
  mediaById.clear();
  for (const track of libraryState.tracks) mediaById.set(track.id, track.path);
}

async function saveLibrary() {
  await fs.mkdir(path.dirname(libraryFile()), { recursive: true });
  await fs.writeFile(libraryFile(), JSON.stringify(libraryState, null, 2), 'utf8');
}

async function scanRoot(root) {
  const found = [];
  const stack = [root];

  while (stack.length) {
    const directory = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      console.warn(`BounceDeck skipped unreadable directory: ${directory}`, error?.message || error);
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const extension = path.extname(entry.name).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(extension)) continue;

      const identity = normalizeForIdentity(fullPath);
      const parsed = parseTrackName(fullPath);
      found.push({
        id: `track-${idFor(identity)}`,
        path: fullPath,
        title: parsed.title,
        artist: parsed.artist,
        extension: parsed.extension,
        rootId: rootId(root),
      });
    }
  }

  return found;
}

async function refreshLibrary() {
  await ensureLibraryLoaded();
  const unique = new Map();
  const validRoots = [];

  for (const root of libraryState.roots) {
    try {
      const stat = await fs.stat(root);
      if (!stat.isDirectory()) continue;
      validRoots.push(root);
      const tracks = await scanRoot(root);
      for (const track of tracks) unique.set(track.id, track);
    } catch {
      // Missing roots are pruned on refresh rather than becoming permanent ghosts.
    }
  }

  libraryState = {
    version: LIBRARY_VERSION,
    roots: validRoots,
    tracks: [...unique.values()].sort((a, b) => {
      const artistCompare = (a.artist || '').localeCompare(b.artist || '');
      return artistCompare || a.title.localeCompare(b.title);
    }),
    scannedAt: Date.now(),
  };
  rehydrateMediaMap();
  await saveLibrary();
  return publicLibraryState();
}

ipcMain.handle('library:get', async () => {
  await ensureLibraryLoaded();
  return publicLibraryState();
});

ipcMain.handle('library:add-folder', async (event) => {
  await ensureLibraryLoaded();
  const owner = BrowserWindow.fromWebContents(event.sender) || undefined;
  const result = await dialog.showOpenDialog(owner, {
    title: 'Add a music folder to BounceDeck',
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return publicLibraryState();

  const selected = path.resolve(result.filePaths[0]);
  if (!libraryState.roots.some((root) => normalizeForIdentity(root) === normalizeForIdentity(selected))) {
    libraryState.roots.push(selected);
  }
  return refreshLibrary();
});

ipcMain.handle('library:refresh', async () => refreshLibrary());

ipcMain.handle('library:clear', async () => {
  await ensureLibraryLoaded();
  libraryState = { version: LIBRARY_VERSION, roots: [], tracks: [], scannedAt: Date.now() };
  rehydrateMediaMap();
  await saveLibrary();
  return publicLibraryState();
});

ipcMain.handle('companion:chat', async (_event, payload) => {
  const model = process.env.BOUNCEDECK_LLM_MODEL;
  if (!model) return { configured: false };

  const baseUrl = (process.env.BOUNCEDECK_LLM_BASE_URL || DEFAULT_LLM_BASE_URL).replace(/\/$/, '');
  const apiKey = process.env.BOUNCEDECK_LLM_API_KEY;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const systemPrompt = [
    'You are the listening companion inside BounceDeck.',
    'The human is listening to music and may talk to you about the current moment.',
    'You do not hear raw audio. You receive track metadata, playback time, and bounded analyzer measurements.',
    'Never claim you literally heard details that are not present in the supplied context.',
    'Be concise, conversational, musically curious, and let the music remain the main event.',
    'When personality is producer, focus on arrangement, dynamics, frequency balance, and production.',
    'When personality is listener, be calm and restrained.',
    'When personality is bro, be playful and enthusiastic without becoming noisy.',
  ].join(' ');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature: 0.8,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('LLM provider returned no message content.');
  return { configured: true, text: text.trim(), model };
});

app.whenReady().then(async () => {
  await ensureLibraryLoaded();
  protocol.handle('bounce-media', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'track') return new Response('Not found', { status: 404 });
    const id = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const filePath = mediaById.get(id);
    if (!filePath) return new Response('Unknown media id', { status: 404 });
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
