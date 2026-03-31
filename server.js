/**
 * SidePad - Server
 * 
 * Turn any tablet into a wireless second monitor.
 * Captures the desktop screen and streams it over WebSocket to a tablet browser.
 * Receives touch input from the tablet and translates to mouse events.
 * 
 * Works on Windows, macOS, and Linux.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const screenshot = require('screenshot-desktop');
const sharp = require('sharp');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// -------------------------------------------------------------------
// Configuration
// -------------------------------------------------------------------
const CONFIG = {
  port: parseInt(process.env.PORT) || 8080,
  quality: parseInt(process.env.QUALITY) || 80,
  fps: parseInt(process.env.FPS) || 15,
  scaleWidth: parseInt(process.env.SCALE_W) || 0,   // 0 = auto-detect from screen
  scaleHeight: parseInt(process.env.SCALE_H) || 0,  // 0 = auto-detect from screen
};

// Parse CLI arguments
const args = process.argv.slice(2);
args.forEach((arg, i) => {
  if (arg === '--port' && args[i + 1]) CONFIG.port = parseInt(args[i + 1]);
  if (arg === '--quality' && args[i + 1]) CONFIG.quality = parseInt(args[i + 1]);
  if (arg === '--fps' && args[i + 1]) CONFIG.fps = parseInt(args[i + 1]);
  if (arg === '--width' && args[i + 1]) CONFIG.scaleWidth = parseInt(args[i + 1]);
  if (arg === '--height' && args[i + 1]) CONFIG.scaleHeight = parseInt(args[i + 1]);
});

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  SidePad - Turn any tablet into a second monitor
  ================================================

  Usage:
    npx sidepad                        Start with defaults
    npx sidepad --port 9090            Custom port
    npx sidepad --quality 70 --fps 20  Better quality, higher FPS

  Options:
    --port <n>      Server port (default: 8080)
    --quality <n>   JPEG quality 1-100 (default: 80)
    --fps <n>       Target framerate (default: 15)
    --width <n>     Stream width in px (default: auto-detect)
    --height <n>    Stream height in px (default: auto-detect)
    -h, --help      Show this help

  Then open http://<your-pc-ip>:8080 on your tablet's browser.
  `);
  process.exit(0);
}

// -------------------------------------------------------------------
// Platform-agnostic input simulation (no native deps needed)
// -------------------------------------------------------------------
const platform = os.platform();

function simulateMouseMove(x, y) {
  if (platform === 'win32') {
    // Use PowerShell with .NET to move cursor
    const ps = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class Cursor{[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);}';[Cursor]::SetCursorPos(${x},${y})`;
    exec(`powershell -Command "${ps}"`, { windowsHide: true });
  } else if (platform === 'linux') {
    exec(`xdotool mousemove ${x} ${y}`);
  } else if (platform === 'darwin') {
    // macOS - use cliclick if available
    exec(`cliclick m:${x},${y}`);
  }
}

function simulateMouseClick(x, y, button = 'left') {
  if (platform === 'win32') {
    const ps = `
Add-Type -TypeDefinition '
using System;
using System.Runtime.InteropServices;
public class Mouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, int dwExtraInfo);
}';
[Mouse]::SetCursorPos(${x},${y});
[Mouse]::mouse_event(0x0002,0,0,0,0);
[Mouse]::mouse_event(0x0004,0,0,0,0);`;
    exec(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, { windowsHide: true });
  } else if (platform === 'linux') {
    exec(`xdotool mousemove ${x} ${y} click 1`);
  } else if (platform === 'darwin') {
    exec(`cliclick c:${x},${y}`);
  }
}

function simulateScroll(deltaY) {
  if (platform === 'win32') {
    const amount = deltaY > 0 ? -120 : 120;
    const ps = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class Mouse{[DllImport("user32.dll")]public static extern void mouse_event(uint f,int x,int y,uint d,int e);}';[Mouse]::mouse_event(0x0800,0,0,${amount},0)`;
    exec(`powershell -Command "${ps}"`, { windowsHide: true });
  } else if (platform === 'linux') {
    const btn = deltaY > 0 ? 5 : 4;
    exec(`xdotool click ${btn}`);
  }
}

// Cache screen dimensions
let screenDimensions = { width: 1920, height: 1080 };

async function detectScreenSize() {
  if (platform === 'win32') {
    exec('powershell -Command "Add-Type -AssemblyName System.Windows.Forms;$s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;Write-Output \\"$($s.Width)x$($s.Height)\\""', 
      { windowsHide: true }, 
      (err, stdout) => {
        if (!err && stdout.trim()) {
          const [w, h] = stdout.trim().split('x').map(Number);
          if (w && h) screenDimensions = { width: w, height: h };
          console.log(`[SCREEN] Detected: ${screenDimensions.width}x${screenDimensions.height}`);
        }
      }
    );
  } else if (platform === 'linux') {
    exec("xdpyinfo | grep dimensions | awk '{print $2}'", (err, stdout) => {
      if (!err && stdout.trim()) {
        const [w, h] = stdout.trim().split('x').map(Number);
        if (w && h) screenDimensions = { width: w, height: h };
      }
    });
  } else if (platform === 'darwin') {
    exec("system_profiler SPDisplaysDataType | grep Resolution", (err, stdout) => {
      if (!err && stdout.trim()) {
        const match = stdout.match(/(\d+)\s*x\s*(\d+)/);
        if (match) screenDimensions = { width: parseInt(match[1]), height: parseInt(match[2]) };
      }
    });
  }
}

// -------------------------------------------------------------------
// Express + WebSocket setup
// -------------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'client')));

app.get('/api/config', (req, res) => {
  const effectiveWidth = CONFIG.scaleWidth || screenDimensions.width;
  const effectiveHeight = CONFIG.scaleHeight || screenDimensions.height;
  res.json({
    ...CONFIG,
    scaleWidth: effectiveWidth,
    scaleHeight: effectiveHeight,
    hostname: os.hostname(),
    platform: os.platform(),
    screenWidth: screenDimensions.width,
    screenHeight: screenDimensions.height,
    inputEnabled: true,
  });
});

app.get('/api/displays', async (req, res) => {
  try {
    const displays = await screenshot.listDisplays();
    res.json(displays);
  } catch (err) {
    res.json([{ id: 0, name: 'Primary Display' }]);
  }
});

// -------------------------------------------------------------------
// WebSocket - streaming + input
// -------------------------------------------------------------------
let activeClients = new Set();
let isCapturing = false;
let captureTimeout = null;
let frameCount = 0;
let lastFpsTime = Date.now();
let measuredFps = 0;
let selectedDisplayId = 0;  // Which display to capture (0 = primary, 1+ = extended)

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[CONNECT] Tablet connected from ${ip}`);
  activeClients.add(ws);

  ws.send(JSON.stringify({
    type: 'welcome',
    config: CONFIG,
    screen: screenDimensions,
  }));

  if (!isCapturing) startCapture();

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(msg);
    } catch {}
  });

  ws.on('close', () => {
    console.log(`[DISCONNECT] Tablet from ${ip}`);
    activeClients.delete(ws);
    if (activeClients.size === 0) stopCapture();
  });

  ws.on('error', () => activeClients.delete(ws));
});

function handleMessage(msg) {
  const sx = screenDimensions.width;
  const sy = screenDimensions.height;

  switch (msg.type) {
    case 'click': {
      const x = Math.round(msg.x * sx);
      const y = Math.round(msg.y * sy);
      simulateMouseClick(x, y);
      break;
    }
    case 'move': {
      const x = Math.round(msg.x * sx);
      const y = Math.round(msg.y * sy);
      simulateMouseMove(x, y);
      break;
    }
    case 'scroll': {
      simulateScroll(msg.deltaY);
      break;
    }
    case 'config-update': {
      if (msg.quality) CONFIG.quality = Math.max(10, Math.min(100, msg.quality));
      if (msg.fps) {
        CONFIG.fps = Math.max(1, Math.min(60, msg.fps));
        if (isCapturing) { stopCapture(); startCapture(); }
      }
      console.log(`[CONFIG] Quality=${CONFIG.quality}, FPS=${CONFIG.fps}`);
      broadcast(JSON.stringify({ type: 'config-updated', config: CONFIG }));
      break;
    }
    case 'select-display': {
      const newId = parseInt(msg.displayId) || 0;
      if (newId !== selectedDisplayId) {
        selectedDisplayId = newId;
        console.log(`[DISPLAY] Switched to display ${selectedDisplayId}`);
      }
      break;
    }
    case 'ping': {
      broadcast(JSON.stringify({ type: 'pong', ts: Date.now() }));
      break;
    }
  }
}

function broadcast(data, opts) {
  for (const client of activeClients) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(data, opts); } catch {}
    }
  }
}

// -------------------------------------------------------------------
// Screen capture loop
// -------------------------------------------------------------------
async function captureFrame() {
  if (!isCapturing || activeClients.size === 0) return;

  try {
    const imgBuffer = await screenshot({ format: 'png', screen: selectedDisplayId });

    const effectiveWidth = CONFIG.scaleWidth || screenDimensions.width;
    const effectiveHeight = CONFIG.scaleHeight || screenDimensions.height;

    const frame = await sharp(imgBuffer)
      .resize(effectiveWidth, effectiveHeight, {
        fit: 'fill',
        kernel: 'lanczos3',
      })
      .jpeg({ quality: CONFIG.quality, mozjpeg: true })
      .toBuffer();

    broadcast(frame, { binary: true });

    // FPS counter
    frameCount++;
    const now = Date.now();
    if (now - lastFpsTime >= 3000) {
      measuredFps = Math.round(frameCount / ((now - lastFpsTime) / 1000));
      frameCount = 0;
      lastFpsTime = now;
      broadcast(JSON.stringify({ type: 'stats', fps: measuredFps, clients: activeClients.size }));
    }
  } catch (err) {
    if (!err.message.includes('EPIPE')) {
      console.error('[CAPTURE]', err.message);
    }
  }

  if (isCapturing) {
    captureTimeout = setTimeout(captureFrame, Math.round(1000 / CONFIG.fps));
  }
}

function startCapture() {
  if (isCapturing) return;
  isCapturing = true;
  const ew = CONFIG.scaleWidth || screenDimensions.width;
  const eh = CONFIG.scaleHeight || screenDimensions.height;
  console.log(`[STREAM] Capturing at ${CONFIG.fps} FPS, quality ${CONFIG.quality}%, ${ew}x${eh}`);
  captureFrame();
}

function stopCapture() {
  isCapturing = false;
  if (captureTimeout) { clearTimeout(captureTimeout); captureTimeout = null; }
  console.log('[STREAM] Stopped (no tablets connected)');
}

// Detect screen size first, then start server
async function startServer() {
  await new Promise((resolve) => {
    detectScreenSize();
    setTimeout(resolve, 500); // Give detection a moment
  });

  server.listen(CONFIG.port, '0.0.0.0', () => {
  const addrs = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const a of iface) {
      if (a.family === 'IPv4' && !a.internal) addrs.push(a.address);
    }
  }

  console.log('');
  console.log('  ┌─────────────────────────────────────────────────┐');
  console.log('  │                                                 │');
  console.log('  │   ◆  SidePad  ─  Second Monitor for Tablets     │');
  console.log('  │                                                 │');
  console.log('  ├─────────────────────────────────────────────────┤');
  console.log('  │                                                 │');
  console.log('  │   Open this URL on your tablet browser:         │');
  console.log('  │                                                 │');
  addrs.forEach(addr => {
    const url = `http://${addr}:${CONFIG.port}`;
    const pad = ' '.repeat(Math.max(0, 47 - url.length));
    console.log(`  │     → ${url}${pad}│`);
  });
  console.log('  │                                                 │');
  const ew = CONFIG.scaleWidth || screenDimensions.width;
  const eh = CONFIG.scaleHeight || screenDimensions.height;
  console.log(`  │   Quality: ${CONFIG.quality}%  ·  FPS: ${CONFIG.fps}  ·  ${ew}x${eh}${' '.repeat(Math.max(0, 17 - String(ew).length - String(eh).length - String(CONFIG.quality).length - String(CONFIG.fps).length))}│`);
  console.log('  │                                                 │');
  console.log('  │   Tip: Swipe down from top on tablet for       │');
  console.log('  │   settings panel (quality, FPS, latency)        │');
  console.log('  │                                                 │');
  console.log('  └─────────────────────────────────────────────────┘');
  console.log('');
  });
}

startServer();

process.on('SIGINT', () => { stopCapture(); server.close(); process.exit(0); });
process.on('SIGTERM', () => { stopCapture(); server.close(); process.exit(0); });
