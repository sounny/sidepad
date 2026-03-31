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
2. Frames are compressed (JPEG) and streamed over WebSocket
3. Your tablet opens the web UI in its browser
4. Touch input on the tablet is forwarded back as mouse events

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or later
- A tablet with a modern browser (Fire Tablet Silk, Chrome, Safari, etc.)
- Both devices on the same Wi-Fi / LAN

### Install & Run

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/sidepad.git
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
  └─────────────────────────────────────────────────┘
```

**Open that URL on your tablet's browser.** That's it!

### Amazon Fire Tablet Tips
- Open the **Silk Browser** and enter the URL
- Tap the **three-dot menu** > **Request Desktop Site** for best results
- For fullscreen: tap the three-dot menu > **Enter Full Screen**

## Options

```bash
# Custom port
npm start -- --port 9090

# Better quality (uses more bandwidth)
npm start -- --quality 70

# Higher frame rate
npm start -- --fps 25

# Custom resolution
npm start -- --width 1280 --height 800

# Combine options
npm start -- --port 9090 --quality 60 --fps 20
```

You can also adjust quality and FPS live from the tablet:
- **Swipe down from the top** of the screen to open the settings panel
- Or use a **three-finger tap** to toggle settings

## Platform Support

| Platform | Screen Capture | Mouse Forwarding |
|----------|---------------|-----------------|
| Windows  | ✅ | ✅ (via PowerShell) |
| macOS    | ✅ | ✅ (via cliclick*) |
| Linux    | ✅ | ✅ (via xdotool*) |

*Install `cliclick` (macOS: `brew install cliclick`) or `xdotool` (Linux: `sudo apt install xdotool`) for touch-to-mouse input forwarding.

## Recommended Setup: Virtual Display

For a true "second monitor" experience (not just mirroring), install a **virtual display driver**:

### Windows
1. Install [Virtual-Display-Driver](https://github.com/itsmikethetech/Virtual-Display-Driver)
2. Create a virtual monitor in Display Settings
3. Set it to "Extend these displays"
4. SidePad will stream that extended display

### macOS / Linux
- macOS: Use the built-in display arrangement in System Preferences
- Linux: Use `xrandr` to create a virtual output

## Project Structure

```
sidepad/
├── server.js           # Node.js server (capture + stream + input)
├── client/
│   ├── index.html      # Tablet web UI
│   ├── style.css       # Dark theme styling
│   └── app.js          # WebSocket client + canvas renderer
├── package.json
├── .gitignore
├── LICENSE             # MIT
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
| Virtual display driver needed | Optional | Auto | Auto | Auto |

## Contributing

Contributions are welcome! Here are some areas that could use help:

- [ ] WebRTC streaming for lower latency
- [ ] Hardware-accelerated encoding (NVENC, QuickSync)
- [ ] Multi-monitor selection UI
- [ ] Drag-and-drop file transfer
- [ ] Stylus/pen pressure support
- [ ] Electron wrapper for system tray icon

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**Made with ☕ by a professor who needed more screen space.**
