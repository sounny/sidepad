/**
 * SidePad - Virtual Display Setup
 * 
 * Automates installation of the Virtual Display Driver so SidePad
 * can extend your desktop (not just mirror it).
 * 
 * Run: npm run setup-display
 */

const { execSync, exec } = require('child_process');
const os = require('os');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

// ANSI colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(msg) { console.log(msg); }
function info(msg) { log(`${c.cyan}[INFO]${c.reset} ${msg}`); }
function success(msg) { log(`${c.green}[OK]${c.reset} ${msg}`); }
function warn(msg) { log(`${c.yellow}[WARN]${c.reset} ${msg}`); }
function error(msg) { log(`${c.red}[ERROR]${c.reset} ${msg}`); }

function isAdmin() {
  try {
    execSync('net session', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function hasWinget() {
  try {
    execSync('winget --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isDriverInstalled() {
  try {
    const result = execSync('pnputil /enum-devices /class Display', { encoding: 'utf8' });
    return result.toLowerCase().includes('virtual display');
  } catch {
    return false;
  }
}

function getDisplayCount() {
  try {
    const result = execSync(
      'powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens.Count"',
      { encoding: 'utf8' }
    );
    return parseInt(result.trim()) || 1;
  } catch {
    return 1;
  }
}

async function main() {
  log('');
  log(`  ${c.bold}${c.magenta}◆  SidePad${c.reset}  ${c.dim}Virtual Display Setup${c.reset}`);
  log(`  ${c.dim}${'─'.repeat(44)}${c.reset}`);
  log('');

  // --- Platform check ---
  if (os.platform() !== 'win32') {
    error('This setup script is for Windows only.');
    log('');
    log(`  On ${c.bold}macOS${c.reset}, you can use AirPlay/Sidecar natively.`);
    log(`  On ${c.bold}Linux${c.reset}, you can use xrandr to create virtual displays.`);
    rl.close();
    process.exit(1);
  }

  // --- Check existing displays ---
  const displayCount = getDisplayCount();
  info(`Detected ${displayCount} display(s) on your system.`);

  if (displayCount > 1) {
    success('You already have multiple displays!');
    log('');
    log(`  You can use SidePad right now to stream your second display.`);
    log(`  Just select it from the ${c.bold}Display to Stream${c.reset} dropdown.`);
    log('');
    const proceed = await ask(`  Do you still want to install a virtual display? (y/N) `);
    if (proceed.toLowerCase() !== 'y') {
      log('');
      info('No changes made. Run SidePad with: npm start');
      rl.close();
      return;
    }
  }

  // --- Check if driver already installed ---
  if (isDriverInstalled()) {
    success('Virtual Display Driver is already installed!');
    log('');
    log(`  ${c.bold}Next steps:${c.reset}`);
    log(`  1. Open ${c.cyan}Windows Settings > Display${c.reset}`);
    log(`  2. Find the virtual display and set it to ${c.bold}"Extend these displays"${c.reset}`);
    log(`  3. Run SidePad: ${c.cyan}npm start${c.reset}`);
    log(`  4. Choose the virtual display from the dropdown`);
    log('');
    rl.close();
    return;
  }

  // --- Install via winget ---
  log('');
  log(`  ${c.bold}What this will do:${c.reset}`);
  log(`  1. Install the free, open-source Virtual Display Driver`);
  log(`     (by VirtualDrivers, ${c.dim}github.com/VirtualDrivers/Virtual-Display-Driver${c.reset})`);
  log(`  2. Create a virtual monitor that Windows treats as real`);
  log(`  3. You then extend your desktop onto it in Display Settings`);
  log('');

  const consent = await ask(`  Ready to install? (Y/n) `);
  if (consent.toLowerCase() === 'n') {
    info('Setup cancelled.');
    rl.close();
    return;
  }

  log('');

  // Check for winget
  if (!hasWinget()) {
    error('winget (Windows Package Manager) is not available.');
    log('');
    log(`  ${c.bold}Manual install:${c.reset}`);
    log(`  1. Download from: ${c.cyan}https://github.com/VirtualDrivers/Virtual-Display-Driver/releases${c.reset}`);
    log(`  2. Extract the zip and run the installer`);
    log(`  3. Then run SidePad: ${c.cyan}npm start${c.reset}`);
    rl.close();
    process.exit(1);
  }

  info('Installing Virtual Display Driver via winget...');
  log(`  ${c.dim}(Windows may show a UAC prompt, please accept it)${c.reset}`);
  log('');

  try {
    execSync('winget install --id=VirtualDrivers.Virtual-Display-Driver -e --accept-package-agreements --accept-source-agreements', {
      stdio: 'inherit',
      timeout: 120000,
    });
    log('');
    success('Virtual Display Driver installed successfully!');
  } catch (err) {
    log('');
    warn('winget install may have prompted for admin rights or encountered an issue.');
    log('');
    log(`  ${c.bold}If it failed, try manually:${c.reset}`);
    log(`  1. Open PowerShell ${c.bold}as Administrator${c.reset}`);
    log(`  2. Run: ${c.cyan}winget install --id=VirtualDrivers.Virtual-Display-Driver -e${c.reset}`);
    log(`  3. Or download from: ${c.cyan}https://github.com/VirtualDrivers/Virtual-Display-Driver/releases${c.reset}`);
    log('');
    rl.close();
    return;
  }

  // --- Post-install instructions ---
  log('');
  log(`  ${c.bold}${c.green}Setup Complete!${c.reset} Now configure your extended desktop:`);
  log('');
  log(`  ${c.bold}Step 1:${c.reset} Right-click your Desktop > ${c.cyan}Display Settings${c.reset}`);
  log(`  ${c.bold}Step 2:${c.reset} Find the new virtual display (it should appear as a new monitor)`);
  log(`  ${c.bold}Step 3:${c.reset} Under "Multiple displays", select ${c.cyan}"Extend these displays"${c.reset}`);
  log(`  ${c.bold}Step 4:${c.reset} Run SidePad: ${c.cyan}npm start${c.reset}`);
  log(`  ${c.bold}Step 5:${c.reset} On the tablet, select the virtual display from the dropdown`);
  log(`  ${c.bold}Step 6:${c.reset} Drag windows from your main monitor to the tablet!`);
  log('');
  log(`  ${c.dim}Tip: Set the virtual display resolution to match your tablet`);
  log(`  (e.g., 1280x800 for a typical 10" tablet)${c.reset}`);
  log('');

  rl.close();
}

main().catch((err) => {
  error(err.message);
  rl.close();
  process.exit(1);
});
