const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors helper (ANSI Escape Codes)
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

const tick = `${colors.green}✓${colors.reset}`;
const cross = `${colors.red}✗${colors.reset}`;
const warning = `${colors.yellow}⚠${colors.reset}`;

console.log(`${colors.bold}${colors.magenta}─────────────────────────────────────────────────${colors.reset}`);
console.log(`  ${colors.bold}${colors.cyan}🩺 agy-status-line — Diagnostic Tool (Doctor)${colors.reset}`);
console.log(`${colors.bold}${colors.magenta}─────────────────────────────────────────────────${colors.reset}\n`);

let hasError = false;
let hasWarning = false;

// 1. Node.js Version Check
const nodeVer = process.version;
const majorVersion = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
if (majorVersion >= 18) {
  console.log(`  ${tick} Node.js Version  : ${colors.green}${nodeVer}${colors.reset} (Supported >=18.0.0)`);
} else {
  console.log(`  ${cross} Node.js Version  : ${colors.red}${nodeVer}${colors.reset} (Unsupported! Please upgrade to Node.js >=18)`);
  hasError = true;
}

// 2. OS Environment Check
console.log(`  ${tick} OS Environment  : ${colors.green}${process.platform} (${os.release()})${colors.reset}`);

// 3. Find Antigravity Settings Path
const homeDir = os.homedir();
const possibleSettingsPaths = [
  path.join(homeDir, '.gemini', 'antigravity-cli', 'settings.json'),
  path.join(homeDir, '.gemini', 'antigravity', 'settings.json'),
];

let settingsPath = null;
for (const p of possibleSettingsPaths) {
  if (fs.existsSync(p)) {
    settingsPath = p;
    break;
  }
}

if (settingsPath) {
  console.log(`  ${tick} Settings Found   : ${colors.green}${settingsPath}${colors.reset}`);
} else {
  console.log(`  ${cross} Settings Found   : ${colors.red}Not Found!${colors.reset}`);
  console.log(`     ${colors.gray}Tried:${colors.reset}`);
  possibleSettingsPaths.forEach(p => console.log(`       - ${p}`));
  hasError = true;
}

// 4. Configuration Check (statusLine in settings.json)
if (settingsPath) {
  try {
    const rawConfig = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(rawConfig);
    
    if (settings.statusLine) {
      const config = settings.statusLine;
      const isEnabled = config.enabled !== false;
      
      if (isEnabled) {
        console.log(`  ${tick} Config Status   : ${colors.green}Enabled${colors.reset}`);
      } else {
        console.log(`  ${warning} Config Status   : ${colors.yellow}Disabled in settings.json${colors.reset}`);
        hasWarning = true;
      }

      if (config.type === 'command') {
        console.log(`  ${tick} Config Type     : ${colors.green}command${colors.reset}`);
      } else {
        console.log(`  ${cross} Config Type     : ${colors.red}${config.type || 'undefined'}${colors.reset} (Must be 'command')`);
        hasError = true;
      }

      const command = config.command || '';
      console.log(`  ${tick} Config Command  : ${colors.gray}${command}${colors.reset}`);
      
      // Parse script path from the command
      const match = command.match(/node\s+["']?([^"']+)["']?/);
      if (match && match[1]) {
        const scriptPath = match[1];
        if (fs.existsSync(scriptPath)) {
          console.log(`  ${tick} Script File     : ${colors.green}Exists (${scriptPath})${colors.reset}`);
          
          // Verify if it is the correct status_line.js file
          const content = fs.readFileSync(scriptPath, 'utf8');
          if (content.includes('global_history') || content.includes('status_line')) {
            console.log(`  ${tick} Script Integrity: ${colors.green}Verified (Status Line code present)${colors.reset}`);
          } else {
            console.log(`  ${warning} Script Integrity: ${colors.yellow}File exists but content verification failed!${colors.reset}`);
            hasWarning = true;
          }
        } else {
          console.log(`  ${cross} Script File     : ${colors.red}File not found at: ${scriptPath}${colors.reset}`);
          hasError = true;
        }
      } else {
        console.log(`  ${cross} Config Command  : ${colors.red}Invalid format!${colors.reset} (Expected: 'node /path/to/status_line.js')`);
        hasError = true;
      }
    } else {
      console.log(`  ${cross} Config Status   : ${colors.red}Missing statusLine property in settings.json!${colors.reset}`);
      console.log(`     ${colors.gray}Run 'node install.js' to inject it automatically.${colors.reset}`);
      hasError = true;
    }
  } catch (err) {
    console.log(`  ${cross} Config Check    : ${colors.red}Failed to read/parse settings.json: ${err.message}${colors.reset}`);
    hasError = true;
  }
}

// 5. Session State File Check (session_state.json)
const statePath = path.join(__dirname, 'session_state.json');
if (fs.existsSync(statePath)) {
  try {
    const rawState = fs.readFileSync(statePath, 'utf8');
    const stateObj = JSON.parse(rawState);
    
    // Check if JSON structure is valid
    if (stateObj && typeof stateObj === 'object') {
      const activeSessionsCount = Object.keys(stateObj.sessions || {}).length;
      console.log(`  ${tick} Session State   : ${colors.green}Valid JSON (${activeSessionsCount} active sessions)${colors.reset}`);
    } else {
      console.log(`  ${cross} Session State   : ${colors.red}Invalid root structure in session_state.json${colors.reset}`);
      hasError = true;
    }
  } catch (err) {
    console.log(`  ${cross} Session State   : ${colors.red}Corrupted JSON! ${err.message}${colors.reset}`);
    console.log(`     ${colors.gray}Self-Healing Tip: You can safely delete '${statePath}' and let it recreate next run.${colors.reset}`);
    hasError = true;
  }
} else {
  console.log(`  ${tick} Session State   : ${colors.gray}Pristine (Will be created dynamically on first run)${colors.reset}`);
}

// 6. Terminal Color & Capability Support
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb';
if (supportsColor) {
  console.log(`  ${tick} Terminal Colors : ${colors.green}Supported & Active${colors.reset}`);
} else {
  console.log(`  ${warning} Terminal Colors : ${colors.yellow}Limited/Uncertain (NO_COLOR or non-TTY detected)${colors.reset}`);
  hasWarning = true;
}

console.log(`\n${colors.bold}${colors.magenta}─────────────────────────────────────────────────${colors.reset}`);

// Final diagnostics result
if (hasError) {
  console.log(`\n  ${colors.bold}${colors.red}✗ Diagnostic Results: FAILED${colors.reset}`);
  console.log(`  ${colors.red}Please address the red ${cross} marks above to fix your status line plugin installation.${colors.reset}\n`);
  process.exit(1);
} else if (hasWarning) {
  console.log(`\n  ${colors.bold}${colors.yellow}⚠ Diagnostic Results: WARNINGS FOUND${colors.reset}`);
  console.log(`  ${colors.yellow}Everything will likely work, but review the yellow ${warning} indicators above.${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n  ${colors.bold}${colors.green}🎉 Diagnostic Results: ALL CHECKS PASSED (OK)${colors.reset}`);
  console.log(`  ${colors.green}Everything is perfectly configured and ready for Antigravity CLI sessions!${colors.reset}\n`);
  process.exit(0);
}
