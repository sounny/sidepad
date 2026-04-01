# SidePad

**Turn any tablet into a wireless second monitor for your PC.**

An open-source alternative to Apple Sidecar, Duet Display, and Spacedesk. Works great with Amazon Fire tablets, iPads, Android tablets, or even old phones. No special drivers needed, just Node.js and a browser.

---

## How It Works

```
┌──────────────┐         Wi-Fi / LAN          ┌──────────────┐
│    Your PC   │  ──── WebSocket stream ────>  │  Your Tablet │
│  (server.js) │  <──── touch/click input ──── │   (browser)  │
└──────────────┘                               └──────────────┘
```

1. **SidePad Server** runs on your PC and captures the screen
2. Frames are compressed (JPEG with mozjpeg) and streamed over WebSocket
3. Your tablet opens the web UI in any browser (no app install needed)
4. Touch input on the tablet is forwarded back as mouse events
5. **Fullscreen mode** with one tap for an immersive experience

## Features

- **Zero tablet install**: works in any browser (Silk, Chrome, Safari)
- **Fullscreen mode**: "Connect & Go Fullscreen" button, plus an on-screen toggle
- **Display selector**: choose which monitor to stream (for extended desktop setups)
- **Live settings**: adjust quality and FPS in real time from the tablet
- **Screen wake lock**: keeps the tablet awake during streaming
- **Touch forwarding**: tap and drag on the tablet to control your PC
- **Cross-platform**: Windows, macOS, and Linux

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or later
- A tablet with a modern browser (Fire Tablet Silk, Chrome, Safari, etc.)
- Both devices on the same Wi-Fi / LAN

### Install & Run

```bash
# Clone the repo
git clone https://github.com/sounny/sidepad.git
cd sidepad

# Install dependencies
npm install

# Start the server
npm start
```

The server will display your local IP address:

```
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │   ◆  SidePad  ─  Second Monitor for Tablets     │
  │                                                 │
  ├─────────────────────────────────────────────────┤
  │                                                 │
  │   Open this URL on your tablet browser:         │
  │                                                 │
  │     → http://192.168.1.42:8080                  │
  │                                                 │
  │   Quality: 80%  ·  FPS: 15  ·  1440x900      │
  │                                                 │
  └─────────────────────────────────────────────────┘
```

**Open that URL on your tablet's browser.** That's it!

## Extended Desktop (Not Just Mirroring)

To use SidePad as a **true second monitor** where you can drag windows between screens, you need a virtual display. SidePad includes an automated setup:

```bash
npm run setup-display
```

This will install the free, open-source [Virtual Display Driver](https://github.com/VirtualDrivers/Virtual-Display-Driver) via winget. After installation:

1. Open **Windows Settings > Display**
2. Find the new virtual display
3. Select **"Extend these displays"**
4. Run `npm start` and select the virtual display from the dropdown on the tablet
5. Drag windows from your main monitor to the tablet!

> **Tip:** Set the virtual display resolution to match your tablet (e.g., 1280x800 for a typical 10" tablet).

### macOS / Linux
- **macOS**: Use built-in display arrangement in System Preferences, or AirPlay
- **Linux**: Use `xrandr` to create a virtual output

## Amazon Fire Tablet Tips

### Stay Awake (Important!)
Fire tablets will turn off the screen after a period of inactivity. To prevent this:

1. Go to **Settings > Device Options**
2. Tap **"Serial Number" 7 times** to enable Developer Options
3. Go back and tap **Developer Options**
4. Enable **"Stay Awake"** (keeps screen on while charging)
5. Plug in the tablet while using SidePad

SidePad also uses software-based keep-awake techniques (Wake Lock API, audio playback, synthetic events) as a backup, but the Developer Options method is the most reliable.

### Browser Tips
- Open the **Silk Browser** and enter the URL shown by the server
- Tap **"Connect & Go Fullscreen"** for the best experience
- Swipe down from the top to access quality/FPS settings
- Swipe up to dismiss the settings panel

## Options

You can configure SidePad with environment variables:

```bash
# Custom port
PORT=9090 npm start

# Better quality (uses more bandwidth)
QUALITY=90 npm start

# Higher frame rate
FPS=25 npm start

# Custom resolution
SCALE_W=1280 SCALE_H=800 npm start

# Combine options
PORT=9090 QUALITY=90 FPS=20 npm start
```

Or adjust quality and FPS **live from the tablet**:
- **Swipe down from the top** of the screen to open the settings panel
- Or use a **three-finger tap** to toggle settings
- Press **F** on a connected keyboard for fullscreen toggle

## Platform Support

| Platform | Screen Capture | Mouse Forwarding |
|----------|---------------|-----------------|
| Windows  | ✅ | ✅ (via PowerShell) |
| macOS    | ✅ | ✅ (via cliclick*) |
| Linux    | ✅ | ✅ (via xdotool*) |

*Install `cliclick` (macOS: `brew install cliclick`) or `xdotool` (Linux: `sudo apt install xdotool`) for touch-to-mouse input forwarding.

## Project Structure

```
sidepad/
├── server.js               # Node.js server (capture + stream + input)
├── client/
│   ├── index.html          # Tablet web UI
│   ├── style.css           # Dark theme styling
│   └── app.js              # WebSocket client + canvas renderer
├── scripts/
│   └── setup-display.js    # Virtual display driver installer
├── package.json
├── .gitignore
├── LICENSE                 # MIT
└── README.md
```

## How It Compares

| Feature | SidePad | Duet Display | Spacedesk | Apple Sidecar |
|---------|---------|-------------|-----------|---------------|
| Price | **Free** | $4.99/mo | Free | Free |
| Open Source | **Yes** | No | No | No |
| Cross-platform | **Yes** | Yes | Windows only | Apple only |
| No app install on tablet | **Yes** | No | No | No |
| Touch input | **Yes** | Yes | Yes | Yes |
| Fullscreen mode | **Yes** | Yes | Yes | Yes |
| Extended desktop | **Yes*** | Auto | Auto | Auto |

*Requires one-time virtual display driver setup via `npm run setup-display`

## Contributing

Contributions are welcome! Here are some areas that could use help:

- [ ] WebRTC streaming for lower latency
- [ ] Hardware-accelerated encoding (NVENC, QuickSync)
- [ ] Drag-and-drop file transfer
- [ ] Stylus/pen pressure support
- [ ] Electron wrapper for system tray icon
- [ ] Auto-install virtual display driver on first run

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**Made by [Sounny](https://sounny.github.io)** ☕
