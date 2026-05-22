const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Dynamic Path Resolution ────────────────────────────────────────────────
// All paths resolved at runtime — no hardcoded user directories.
const homeDir = os.homedir();
const targetScriptPath = path.join(__dirname, 'status_line.js');

// Antigravity CLI settings.json may live under 'antigravity-cli' or 'antigravity'
const possibleSettingsPaths = [
  path.join(homeDir, '.gemini', 'antigravity-cli', 'settings.json'),
  path.join(homeDir, '.gemini', 'antigravity', 'settings.json'),
];

console.log('─────────────────────────────────────────────────');
console.log('  agy-status-line — Installation');
console.log('─────────────────────────────────────────────────');
console.log(`  Script path : ${targetScriptPath}`);

// Find which settings.json path exists
let settingsPath = null;
for (const p of possibleSettingsPaths) {
  if (fs.existsSync(p)) {
    settingsPath = p;
    break;
  }
}

if (!settingsPath) {
  console.error('\n  ✗ Error: settings.json not found in any of these locations:');
  for (const p of possibleSettingsPaths) {
    console.error(`      ${p}`);
  }
  console.error('\n  Make sure Antigravity CLI is installed and has been run at least once.\n');
  process.exit(1);
}

console.log(`  Settings    : ${settingsPath}`);

try {
  // Read and back up the current settings.json
  const currentContent = fs.readFileSync(settingsPath, 'utf8');
  const backupPath = `${settingsPath}.bak`;
  fs.writeFileSync(backupPath, currentContent, 'utf8');
  console.log(`  Backup      : ${backupPath}`);

  // Parse settings
  const settings = JSON.parse(currentContent);

  // Update statusLine configuration with absolute path to this script
  settings.statusLine = {
    type: 'command',
    command: `node ${targetScriptPath}`,
    enabled: true,
  };

  // Write updated settings back
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');

  console.log('\n  ✓ Installation complete!');
  console.log('  → Run diagnostics to verify configuration health:');
  console.log('    node doctor.js');
  console.log('\n  → Reload your Antigravity CLI session to activate the status line.\n');
  console.log('  Optional: Set a theme via environment variable:');
  console.log('    AGY_STATUS_THEME=aurora    (default — purple/cyan/emerald)');
  console.log('    AGY_STATUS_THEME=cyberpunk (hot-pink/neon/laser-yellow)');
  console.log('    AGY_STATUS_THEME=classic   (purple/cyan/green)');
  console.log('    AGY_STATUS_THEME=minimal   (white/gray monochrome)');
  console.log('─────────────────────────────────────────────────\n');
} catch (e) {
  console.error(`\n  ✗ Installation failed: ${e.message}\n`);
  process.exit(1);
}
