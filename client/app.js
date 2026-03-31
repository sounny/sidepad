/**
 * SidePad - Client Application
 * 
 * Connects to the SidePad server via WebSocket, receives JPEG frames,
 * renders them on a fullscreen Canvas, and forwards touch/mouse input
 * back to the server for cursor control.
 */

// ---- State ----
let ws = null;
let canvas = null;
let ctx = null;
let config = {};
let screenDims = { width: 1920, height: 1080 };
let isConnected = false;
let touchEnabled = true;
let settingsOpen = false;
let latency = 0;
let pingInterval = null;
let lastPingTime = 0;
let reconnectAttempts = 0;
const MAX_RECONNECT = 10;
let wakeLock = null;  // Screen Wake Lock to prevent tablet sleep

// ---- DOM refs ----
const connectScreen = document.getElementById('connect-screen');
const viewerScreen = document.getElementById('viewer-screen');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const statusDetail = document.getElementById('status-detail');
const infoServer = document.getElementById('info-server');
const infoResolution = document.getElementById('info-resolution');
const infoLatency = document.getElementById('info-latency');
const hudFps = document.getElementById('hud-fps');
const hudLatency = document.getElementById('hud-latency');
const settingsPanel = document.getElementById('settings-panel');
const qualitySlider = document.getElementById('quality-slider');
const fpsSlider = document.getElementById('fps-slider');
const qualityValue = document.getElementById('quality-value');
const fpsValue = document.getElementById('fps-value');
const touchToggle = document.getElementById('touch-toggle');

// ---- Initialize ----
document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('display-canvas');
  ctx = canvas.getContext('2d');

  // Fetch initial config
  fetchConfig();

  // Fetch available displays
  fetchDisplays();

  // Setup settings controls
  setupControls();

  // Setup touch/mouse input
  setupInput();

  // Setup settings panel gesture
  setupSettingsPanelGesture();

  // Listen for fullscreen changes to update icon
  document.addEventListener('fullscreenchange', updateFullscreenIcon);
  document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
});

async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    config = data;
    screenDims = { width: data.screenWidth || 1920, height: data.screenHeight || 1080 };

    infoServer.textContent = data.hostname || location.hostname;
    infoResolution.textContent = `${data.scaleWidth}x${data.scaleHeight}`;

    qualitySlider.value = data.quality;
    fpsSlider.value = data.fps;
    qualityValue.textContent = `${data.quality}%`;
    fpsValue.textContent = `${data.fps} FPS`;

    setStatus('ready', 'Ready to connect', `Server found at ${location.host}`);
  } catch {
    setStatus('error', 'Server not found', 'Make sure SidePad is running on your PC');
  }
}

async function fetchDisplays() {
  try {
    const res = await fetch('/api/displays');
    const displays = await res.json();
    const selector = document.getElementById('display-selector');
    if (!selector || !Array.isArray(displays)) return;

    selector.innerHTML = '';
    displays.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.id !== undefined ? d.id : i;
      const name = d.name || `Display ${i + 1}`;
      const size = d.width && d.height ? ` (${d.width}x${d.height})` : '';
      opt.textContent = `${name}${size}`;
      // If there is more than 1 display, default to the second one (likely the virtual/extended display)
      if (displays.length > 1 && i === 1) opt.selected = true;
      selector.appendChild(opt);
    });

    // Show the display selector section
    const displaySection = document.getElementById('display-section');
    if (displaySection && displays.length > 1) {
      displaySection.style.display = 'block';
    }
  } catch {
    // Ignore, single display fallback
  }
}

// ---- Fullscreen ----
function goFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {});
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen();
  } else if (el.msRequestFullscreen) {
    el.msRequestFullscreen();
  }
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
}

function toggleFullscreen() {
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  if (isFs) {
    exitFullscreen();
  } else {
    goFullscreen();
  }
}

function updateFullscreenIcon() {
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  const expand = document.getElementById('fs-icon-expand');
  const shrink = document.getElementById('fs-icon-shrink');
  if (expand && shrink) {
    expand.style.display = isFs ? 'none' : '';
    shrink.style.display = isFs ? '' : 'none';
  }
}

function connectAndFullscreen() {
  goFullscreen();
  setTimeout(() => connect(), 300);
}

// ---- Connection ----
function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  // Send selected display to server before connecting
  const selector = document.getElementById('display-selector');
  const selectedDisplay = selector ? parseInt(selector.value) : 0;

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}`;

  setStatus('connecting', 'Connecting...', 'Establishing WebSocket connection');

  ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    isConnected = true;
    reconnectAttempts = 0;
    setStatus('connected', 'Connected', `Streaming from ${config.hostname || 'PC'}`);

    // Keep tablet screen awake
    acquireWakeLock();

    // Tell server which display to capture
    ws.send(JSON.stringify({ type: 'select-display', displayId: selectedDisplay }));

    // Switch to viewer
    setTimeout(() => {
      connectScreen.classList.remove('active');
      viewerScreen.classList.add('active');
      resizeCanvas();
    }, 500);

    // Start ping for latency measurement
    pingInterval = setInterval(() => {
      lastPingTime = Date.now();
      ws.send(JSON.stringify({ type: 'ping' }));
    }, 2000);
  };

  ws.onmessage = (event) => {
    if (typeof event.data === 'string') {
      handleJsonMessage(JSON.parse(event.data));
    } else {
      renderFrame(event.data);
    }
  };

  ws.onclose = () => {
    isConnected = false;
    clearInterval(pingInterval);

    if (reconnectAttempts < MAX_RECONNECT) {
      reconnectAttempts++;
      setStatus('connecting', 'Reconnecting...', `Attempt ${reconnectAttempts}/${MAX_RECONNECT}`);
      setTimeout(connect, 1000 * Math.min(reconnectAttempts, 5));
    } else {
      setStatus('error', 'Disconnected', 'Could not reconnect to server');
      viewerScreen.classList.remove('active');
      connectScreen.classList.add('active');
    }
  };

  ws.onerror = () => {
    setStatus('error', 'Connection error', 'Check if SidePad server is running');
  };
}

function disconnect() {
  reconnectAttempts = MAX_RECONNECT;
  if (ws) ws.close();
  isConnected = false;
  clearInterval(pingInterval);
  releaseWakeLock();
  settingsPanel.classList.remove('open');
  settingsOpen = false;
  viewerScreen.classList.remove('active');
  connectScreen.classList.add('active');
  setStatus('ready', 'Disconnected', 'Tap Connect to start again');
  reconnectAttempts = 0;
  // Exit fullscreen when disconnecting
  exitFullscreen();
}

function handleJsonMessage(msg) {
  switch (msg.type) {
    case 'welcome':
      if (msg.config) {
        config = msg.config;
        qualitySlider.value = config.quality;
        fpsSlider.value = config.fps;
        qualityValue.textContent = `${config.quality}%`;
        fpsValue.textContent = `${config.fps} FPS`;
      }
      if (msg.screen) {
        screenDims = msg.screen;
      }
      break;

    case 'pong':
      latency = Date.now() - lastPingTime;
      infoLatency.textContent = `${latency}ms`;
      hudLatency.textContent = `${latency}ms`;
      break;

    case 'stats':
      hudFps.textContent = `${msg.fps} FPS`;
      break;

    case 'config-updated':
      if (msg.config) config = msg.config;
      break;
  }
}

// ---- Frame Rendering ----
const frameImage = new Image();
let frameReady = true;

frameImage.onload = () => {
  if (ctx && canvas) {
    // Draw image to fill canvas while maintaining aspect ratio
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = frameImage.naturalWidth;
    const ih = frameImage.naturalHeight;

    // Calculate scaling to fill the canvas
    const scaleX = cw / iw;
    const scaleY = ch / ih;
    const scale = Math.min(scaleX, scaleY);

    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(frameImage, dx, dy, dw, dh);
  }
  frameReady = true;
  URL.revokeObjectURL(frameImage.src);
};

function renderFrame(arrayBuffer) {
  if (!frameReady) return;
  frameReady = false;
  const blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
  frameImage.src = URL.createObjectURL(blob);
}

function resizeCanvas() {
  // Use the actual pixel dimensions for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
}

window.addEventListener('resize', () => {
  if (viewerScreen.classList.contains('active')) {
    resizeCanvas();
  }
});

// ---- Touch/Mouse Input Forwarding ----
function setupInput() {
  const el = document.getElementById('display-canvas');

  // Touch events
  el.addEventListener('touchstart', (e) => {
    if (!touchEnabled || !isConnected || settingsOpen) return;
    e.preventDefault();
    const touch = e.touches[0];
    sendInput('click', touch.clientX, touch.clientY);
  }, { passive: false });

  el.addEventListener('touchmove', (e) => {
    if (!touchEnabled || !isConnected || settingsOpen) return;
    e.preventDefault();
    const touch = e.touches[0];
    sendInput('move', touch.clientX, touch.clientY);
  }, { passive: false });

  // Mouse events (for testing on desktop)
  el.addEventListener('click', (e) => {
    if (!touchEnabled || !isConnected || settingsOpen) return;
    sendInput('click', e.clientX, e.clientY);
  });

  el.addEventListener('mousemove', (e) => {
    if (!touchEnabled || !isConnected || settingsOpen) return;
    if (e.buttons === 1) {
      sendInput('move', e.clientX, e.clientY);
    }
  });

  // Scroll
  el.addEventListener('wheel', (e) => {
    if (!touchEnabled || !isConnected) return;
    e.preventDefault();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'scroll', deltaY: e.deltaY }));
    }
  }, { passive: false });
}

function sendInput(type, clientX, clientY) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const x = clientX / window.innerWidth;
  const y = clientY / window.innerHeight;
  ws.send(JSON.stringify({ type, x, y }));
}

// ---- Settings Controls ----
function setupControls() {
  qualitySlider.addEventListener('input', (e) => {
    qualityValue.textContent = `${e.target.value}%`;
  });

  qualitySlider.addEventListener('change', (e) => {
    sendConfigUpdate({ quality: parseInt(e.target.value) });
  });

  fpsSlider.addEventListener('input', (e) => {
    fpsValue.textContent = `${e.target.value} FPS`;
  });

  fpsSlider.addEventListener('change', (e) => {
    sendConfigUpdate({ fps: parseInt(e.target.value) });
  });

  touchToggle.addEventListener('change', (e) => {
    touchEnabled = e.target.checked;
  });
}

function sendConfigUpdate(updates) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'config-update', ...updates }));
  }
}

// ---- Settings Panel Gesture ----
function setupSettingsPanelGesture() {
  let startY = 0;
  let tracking = false;

  document.addEventListener('touchstart', (e) => {
    if (!viewerScreen.classList.contains('active')) return;
    startY = e.touches[0].clientY;
    tracking = true;

    // Three-finger tap to toggle
    if (e.touches.length === 3) {
      e.preventDefault();
      toggleSettings();
      tracking = false;
    }
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!tracking || !viewerScreen.classList.contains('active')) return;
    const deltaY = e.touches[0].clientY - startY;

    // Swipe DOWN from top edge to OPEN
    if (!settingsOpen && startY < 40 && deltaY > 50) {
      toggleSettings();
      tracking = false;
    }

    // Swipe UP to CLOSE
    if (settingsOpen && deltaY < -50) {
      toggleSettings();
      tracking = false;
    }
  });

  document.addEventListener('touchend', () => { tracking = false; startY = 0; });

  // Click handle bar to close
  document.getElementById('settings-handle').addEventListener('click', () => {
    if (settingsOpen) toggleSettings();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsOpen) toggleSettings();
    if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  });
}

function toggleSettings() {
  settingsOpen = !settingsOpen;
  settingsPanel.classList.toggle('open', settingsOpen);
}

// ---- Status Updates ----
function setStatus(state, text, detail) {
  statusIndicator.className = 'status-indicator';
  if (state === 'connected') statusIndicator.classList.add('connected');
  if (state === 'error') statusIndicator.classList.add('error');
  statusText.textContent = text;
  if (detail) statusDetail.textContent = detail;
}

// ---- Prevent zoom & bounce on tablets ----
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// ---- Screen Wake Lock (prevent tablet from sleeping) ----
async function acquireWakeLock() {
  // Always start the NoSleep fallback (audio + timer) for maximum reliability
  startNoSleepFallback();

  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[WakeLock] Screen will stay on');
      wakeLock.addEventListener('release', () => {
        console.log('[WakeLock] Released');
      });
    } else {
      // Fallback: play a tiny invisible video to keep screen on
      startNoSleepFallback();
    }
  } catch (err) {
    console.log('[WakeLock] Could not acquire:', err.message);
    startNoSleepFallback();
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    await wakeLock.release().catch(() => {});
    wakeLock = null;
  }
  stopNoSleepFallback();
}

// Re-acquire wake lock when tab becomes visible again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isConnected) {
    acquireWakeLock();
  }
});

// NoSleep fallback for browsers without Wake Lock API
// Uses Web Audio API + periodic screen interaction to keep Silk/Fire tablet awake
let noSleepInterval = null;
let noSleepAudioCtx = null;

function startNoSleepFallback() {
  if (noSleepInterval) return;

  // Create a silent audio context (keeps CPU active, prevents sleep on many mobile browsers)
  try {
    noSleepAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = noSleepAudioCtx.createOscillator();
    const gain = noSleepAudioCtx.createGain();
    gain.gain.value = 0.001; // Nearly silent
    oscillator.connect(gain);
    gain.connect(noSleepAudioCtx.destination);
    oscillator.start();
    console.log('[NoSleep] Audio context started');
  } catch (e) {
    console.log('[NoSleep] Audio fallback failed:', e.message);
  }

  // Periodically poke the screen to reset the sleep timer
  noSleepInterval = setInterval(() => {
    // Tiny title change forces browser activity
    document.title = document.title.endsWith(' ') ? 'SidePad' : 'SidePad ';

    // Re-request wake lock in case it was released
    if ('wakeLock' in navigator && isConnected && !wakeLock) {
      navigator.wakeLock.request('screen').then(wl => {
        wakeLock = wl;
      }).catch(() => {});
    }
  }, 15000); // Every 15 seconds

  console.log('[NoSleep] Keep-awake timer started');
}

function stopNoSleepFallback() {
  if (noSleepInterval) {
    clearInterval(noSleepInterval);
    noSleepInterval = null;
  }
  if (noSleepAudioCtx) {
    noSleepAudioCtx.close().catch(() => {});
    noSleepAudioCtx = null;
  }
  document.title = 'SidePad';
}
