---
description: How to develop, run, and deploy the SidePad dual-monitor tablet application
---

# SidePad Development Workflow

## Project Overview
SidePad turns any tablet (Amazon Fire, iPad, Android) into a wireless second monitor for your PC. It runs a Node.js server on the PC that captures the screen and streams it via WebSocket to a web client on the tablet.

## Architecture
- **Server** (`server.js`): Node.js + Express + WebSocket. Captures screen with `screenshot-desktop`, compresses with `sharp`, streams JPEG frames to connected tablets. Receives touch input and translates to OS mouse events via platform-native commands (PowerShell on Windows, xdotool on Linux, cliclick on macOS).
- **Client** (`client/`): Static HTML/CSS/JS served by Express. Renders frames on a fullscreen Canvas, forwards touch events as normalized coordinates. Settings panel for live quality/FPS tuning.

## Setup

// turbo-all

1. Navigate to the project directory and install dependencies:
```bash
cd "g:\My Drive\dualmonitortablet"
npm install
```

2. Start the development server:
```bash
npm start
```

3. The server will print your local IP address. Open that URL on your tablet's browser (e.g., Silk Browser on Fire Tablet).

## Key Development Commands

- `npm start` - Start the SidePad server
- `npm start -- --port 9090` - Use a custom port
- `npm start -- --quality 70 --fps 25` - Adjust stream quality and framerate
- `npm start -- --help` - View all CLI options

## Configuration Options
All settings can be passed as CLI args or env vars:
- `--port` / `PORT`: Server port (default: 8080)
- `--quality` / `QUALITY`: JPEG quality 1-100 (default: 50)
- `--fps` / `FPS`: Target framerate (default: 15)
- `--width` / `SCALE_W`: Stream width (default: 1024)
- `--height` / `SCALE_H`: Stream height (default: 600)

## File Structure
```
sidepad/
├── server.js           # Main server (capture, stream, input)
├── client/
│   ├── index.html      # Connection screen + viewer UI
│   ├── style.css       # Dark premium theme
│   └── app.js          # WebSocket client, canvas renderer, input handler
├── package.json
├── .gitignore
├── LICENSE
└── README.md
```

## Testing
1. Start the server on your PC
2. Open the URL on your tablet's browser OR on another browser tab for testing
3. You should see the connection screen, then the live desktop stream

## Virtual Display (True Second Monitor)
For an extended desktop (not mirroring), install a virtual display driver:
- **Windows**: Install [Virtual-Display-Driver](https://github.com/itsmikethetech/Virtual-Display-Driver)
- Create a virtual monitor, set to "Extend these displays"
- SidePad streams whatever is on the display

## Troubleshooting
- **Can't connect**: Ensure both devices are on the same Wi-Fi. Check firewall allows port 8080.
- **Laggy stream**: Lower quality (`--quality 30`) or FPS (`--fps 10`)
- **No mouse input**: On macOS install `cliclick` (`brew install cliclick`), on Linux install `xdotool`
- **Fire Tablet Silk browser issues**: Try "Request Desktop Site" from the menu

## Publishing to GitHub
```bash
git init
git add .
git commit -m "Initial release of SidePad"
git remote add origin https://github.com/YOUR_USERNAME/sidepad.git
git push -u origin main
```
