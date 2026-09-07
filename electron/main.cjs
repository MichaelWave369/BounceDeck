const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEFAULT_LLM_BASE_URL = 'https://api.openai.com/v1';

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
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadURL(pathToFileURL(path.join(__dirname, '..', 'dist', 'index.html')).toString());
  }
}

ipcMain.handle('companion:chat', async (_event, payload) => {
  const model = process.env.BOUNCEDECK_LLM_MODEL;
  if (!model) {
    return { configured: false };
  }

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
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('LLM provider returned no message content.');
  }

  return { configured: true, text: text.trim(), model };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
