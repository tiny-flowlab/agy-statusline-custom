const fs = require('fs');
const path = require('path');
const os = require('os');                        // FIX #1: use os.homedir() instead of hardcoded path
const { execSync } = require('child_process');

// ── Helpers ────────────────────────────────────────────────────────────────

// Calculate actual screen character length excluding ANSI escape codes
function getVisibleLength(str) {
  if (typeof str !== 'string') return 0;
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').length;
}

// Format a dual-aligned (justified left/right) terminal line
function renderSplitLine(left, right, termWidth) {
  const leftLen = getVisibleLength(left);
  const rightLen = getVisibleLength(right);
  const paddingSize = termWidth - leftLen - rightLen;
  if (paddingSize > 0) {
    return left + ' '.repeat(paddingSize) + right;
  }
  return left + ' ' + right;
}

// FIX #4: safe progress bar that never calls .repeat() with NaN/Infinity/<0
function makeProgressBar(percent, size = 6) {
  const safePercent = (isFinite(percent) && percent >= 0) ? Math.min(percent, 100) : 100;
  const filledCount = Math.min(size, Math.max(0, Math.round((safePercent / 100) * size)));
  const emptyCount = size - filledCount;
  return '■'.repeat(filledCount) + '□'.repeat(emptyCount);
}

// Format token count to readable representation (comma separated or compact k/M suffix)
function formatToken(num, compact = false) {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  if (compact) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return num.toString();
  }
  return num.toLocaleString('en-US');
}

// Whether to emit ANSI codes at all (Force color support regardless of isTTY status for piped execution)
const useColor = (process.env.NO_COLOR === undefined);

function ansi(code) {
  return useColor ? code : '';
}

// ── ANSI Theme System ──────────────────────────────────────────────────────

const THEMES = {
  aurora: {
    model:     '\x1b[1m\x1b[38;5;141m',   // Purple (bold)
    label:     '\x1b[1m\x1b[38;5;81m',    // Cyan (bold)
    value:     '\x1b[38;5;121m',           // Emerald Green
    gold:      '\x1b[1m\x1b[38;5;220m',   // Bright Vibrant Gold
    subagents: '\x1b[1m\x1b[38;5;221m',   // Warm Yellow
    activeSub: '\x1b[1m\x1b[38;5;208m',   // Glowing Active Orange
    tasks:     '\x1b[1m\x1b[38;5;147m',   // Soft Lavender
    progress:  '\x1b[1m\x1b[38;5;48m',    // Spring Green
    state:     '\x1b[1m\x1b[38;5;81m',    // Cyan (agent state)
    artifact:  '\x1b[38;5;183m',          // Soft Purple (artifacts)
    divider:   '\x1b[38;5;242m',          // Dark Gray
    ok:        '\x1b[38;5;121m',          // Green
    warn:      '\x1b[38;5;215m',          // Warm Amber
    crit:      '\x1b[38;5;203m',          // Soft Red
  },
  cyberpunk: {
    model:     '\x1b[1m\x1b[38;5;198m',   // Hot Pink
    label:     '\x1b[1m\x1b[38;5;51m',    // Electric Cyan
    value:     '\x1b[38;5;226m',           // Laser Yellow
    gold:      '\x1b[1m\x1b[38;5;220m',   // Cyber Gold
    subagents: '\x1b[1m\x1b[38;5;201m',   // Neon Magenta
    activeSub: '\x1b[1m\x1b[38;5;208m',   // Neon Orange
    tasks:     '\x1b[1m\x1b[38;5;214m',   // Neon Orange
    progress:  '\x1b[1m\x1b[38;5;82m',    // Lime Green
    state:     '\x1b[1m\x1b[38;5;51m',    // Electric Cyan
    artifact:  '\x1b[38;5;213m',          // Pink
    divider:   '\x1b[38;5;245m',          // Mid Gray
    ok:        '\x1b[38;5;82m',
    warn:      '\x1b[38;5;214m',
    crit:      '\x1b[38;5;198m',
  },
  classic: {
    model:     '\x1b[1m\x1b[38;5;141m',
    label:     '\x1b[1m\x1b[38;5;81m',
    value:     '\x1b[38;5;121m',
    gold:      '\x1b[1m\x1b[38;5;220m',
    subagents: '\x1b[1m\x1b[38;5;221m',
    activeSub: '\x1b[1m\x1b[38;5;208m',
    tasks:     '\x1b[1m\x1b[38;5;209m',
    progress:  '\x1b[1m\x1b[38;5;48m',
    state:     '\x1b[1m\x1b[38;5;81m',
    artifact:  '\x1b[38;5;183m',
    divider:   '\x1b[38;5;244m',
    ok:        '\x1b[38;5;121m',
    warn:      '\x1b[38;5;221m',
    crit:      '\x1b[38;5;203m',
  },
  minimal: {
    model:     '\x1b[1m\x1b[37m',
    label:     '\x1b[1m\x1b[37m',
    value:     '\x1b[37m',
    gold:      '\x1b[37m',
    subagents: '\x1b[1m\x1b[37m',
    activeSub: '\x1b[1m\x1b[37m',
    tasks:     '\x1b[1m\x1b[37m',
    progress:  '\x1b[1m\x1b[37m',
    state:     '\x1b[1m\x1b[37m',
    artifact:  '\x1b[37m',
    divider:   '\x1b[90m',
    ok:        '\x1b[37m',
    warn:      '\x1b[37m',
    crit:      '\x1b[37m',
  }
};

// Agent state → emoji map
const STATE_EMOJI = {
  thinking:  '🧠',
  reviewing: '🔍',
  executing: '⚡',
  planning:  '📝',
  idle:      '💤',
};

// ── Main ───────────────────────────────────────────────────────────────────

let inputData = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', chunk => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  // ── 1. Parse JSON input ──────────────────────────────────────────────────
  let data = {};
  try {
    if (inputData.trim()) {
      const parsed = JSON.parse(inputData);
      // FIX #2: guard against JSON.parse("null") returning null (not an object)
      data = (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    }
  } catch (e) {
    // Fail-safe: keep data = {}
    if (process.env.DEBUG) process.stderr.write(`[status_line] JSON parse error: ${e.message}\n`);
  }

  const themeName = (process.env.AGY_STATUS_THEME || 'aurora').toLowerCase();
  const theme = Object.prototype.hasOwnProperty.call(THEMES, themeName) ? THEMES[themeName] : THEMES.aurora;
  const reset = ansi('\x1b[0m');
  const t = {}; // convenience wrapper applying ansi() gate to each theme color
  for (const [k, v] of Object.entries(theme)) t[k] = ansi(v);

  // ── 2. Model name ────────────────────────────────────────────────────────
  let modelName = 'Gemini';
  if (data.model && data.model.display_name) {
    modelName = data.model.display_name;
  } else if (data.model && data.model.id) {
    modelName = data.model.id;
  }

  // ── 3. Agent state & Artifact count (NEW: from stdin fields) ─────────────
  const rawState = (typeof data.agent_state === 'string' ? data.agent_state : 'idle').toLowerCase();
  const stateEmoji = STATE_EMOJI[rawState] || '🤖';
  const stateLabel = rawState.charAt(0).toUpperCase() + rawState.slice(1);
  const artifactCount = Number.isFinite(data.artifact_count) ? data.artifact_count : 0;

  // ── 4. Token consumption ─────────────────────────────────────────────────
  let totalInput = 0;
  let totalOutput = 0;
  let currentInput = 0;
  let currentOutput = 0;
  let cacheHit = 0;
  let totalWindow = 1048576;
  let remainingPercent = 100;
  let realContextUsed = 0;
  let realContextUsedPercent = 0;

  if (data.context_window) {
    totalInput  = data.context_window.total_input_tokens  || 0;
    totalOutput = data.context_window.total_output_tokens || 0;
    totalWindow = data.context_window.context_window_size || totalWindow;

    if (data.context_window.current_usage) {
      currentInput  = data.context_window.current_usage.input_tokens || 0;
      currentOutput = data.context_window.current_usage.output_tokens || 0;
      cacheHit      = data.context_window.current_usage.cache_read_input_tokens || 0;
    }

    let cacheCreation = 0;
    if (data.context_window.current_usage) {
      cacheCreation = data.context_window.current_usage.cache_creation_input_tokens || 0;
    }

    // Prioritize the platform-provided Google API Quota percentages
    let hasPlatformPercentage = false;
    if (typeof data.context_window.remaining_percentage === 'number' && isFinite(data.context_window.remaining_percentage)) {
      remainingPercent = data.context_window.remaining_percentage;
      hasPlatformPercentage = true;
    } else if (typeof data.context_window.used_percentage === 'number' && isFinite(data.context_window.used_percentage)) {
      remainingPercent = 100 - data.context_window.used_percentage;
      hasPlatformPercentage = true;
    }

    // Fallback only if platform values are completely missing
    if (!hasPlatformPercentage) {
      const safeWindow = totalWindow > 0 ? totalWindow : 1048576;
      const activeWindowTokens = currentInput + currentOutput + cacheHit + cacheCreation;
      const usedPercent = (activeWindowTokens / safeWindow) * 100;
      remainingPercent = 100 - usedPercent;
    }

    // Calculate real context usage metrics
    realContextUsed = totalInput + totalOutput;
    const safeWindow = totalWindow > 0 ? totalWindow : 1048576;
    realContextUsedPercent = (realContextUsed / safeWindow) * 100;
    if (!isFinite(realContextUsedPercent)) realContextUsedPercent = 0;
    realContextUsedPercent = Math.max(0, Math.min(100, realContextUsedPercent));

    // FIX #3: clamp remainingPercent so toFixed() / repeat() never see NaN or Infinity
    if (!isFinite(remainingPercent)) remainingPercent = 100;
    remainingPercent = Math.max(0, Math.min(100, remainingPercent));
  }

  // Load session state to accumulate usage
  let accumulatedCache = 0;
  let globalCumInput = 0;
  let globalCumOutput = 0;
  let globalCumCache = 0;
  let timeRemainingStr = '5h 00m';

  const sessionId = data.session_id || data.conversation_id || '';
  if (sessionId) {
    const statePath = path.join(__dirname, 'session_state.json');
    let state = {
      sessions: {},
      global_cumulative: {
        window_start_time: Date.now(),
        input_tokens: 0,
        output_tokens: 0,
        cache_tokens: 0
      }
    };
    
    try {
      if (fs.existsSync(statePath)) {
        const fileContent = fs.readFileSync(statePath, 'utf8');
        const parsedState = JSON.parse(fileContent);
        if (parsedState && typeof parsedState === 'object') {
          state = { ...state, ...parsedState };
        }
      }
    } catch (err) {
      if (process.env.DEBUG) process.stderr.write(`[status_line] Failed to read session state: ${err.message}\n`);
    }

    const currentTime = Date.now();

    // ── Fixed Hourly Anchor System ──────────────────────────────────────────
    // Anchors daily reset blocks to exact user-expected hours.
    // 00:00 - 04:00 (4h) | 04:00 - 09:00 (5h) | 09:00 - 14:00 (5h) | 14:00 - 19:00 (5h) | 19:00 - 00:00 (5h)
    function getAnchorStartTime(ms) {
      const d = new Date(ms);
      const hours = d.getHours();
      const anchors = [0, 4, 9, 14, 19];
      let matchedHour = 0;
      for (let i = anchors.length - 1; i >= 0; i--) {
        if (hours >= anchors[i]) {
          matchedHour = anchors[i];
          break;
        }
      }
      const anchorDate = new Date(ms);
      anchorDate.setHours(matchedHour, 0, 0, 0);
      return anchorDate.getTime();
    }

    function getNextAnchorTime(currentAnchorMs) {
      const d = new Date(currentAnchorMs);
      const hour = d.getHours();
      const nextMap = { 0: 4, 4: 9, 9: 14, 14: 19, 19: 24 };
      const nextHour = nextMap[hour] !== undefined ? nextMap[hour] : (hour + 5);
      
      const nextDate = new Date(currentAnchorMs);
      if (nextHour === 24) {
        nextDate.setDate(nextDate.getDate() + 1);
        nextDate.setHours(0, 0, 0, 0);
      } else {
        nextDate.setHours(nextHour, 0, 0, 0);
      }
      return nextDate.getTime();
    }

    const currentAnchorStart = getAnchorStartTime(currentTime);
    const nextAnchorStart = getNextAnchorTime(currentAnchorStart);

    if (!state.global_cumulative) {
      state.global_cumulative = {
        window_start_time: currentAnchorStart,
        input_tokens: 0,
        output_tokens: 0,
        cache_tokens: 0
      };
    }

    // Reset window if stored start time does not match current anchor block start
    if (state.global_cumulative.window_start_time !== currentAnchorStart) {
      state.global_cumulative.window_start_time = currentAnchorStart;
      state.global_cumulative.input_tokens = 0;
      state.global_cumulative.output_tokens = 0;
      state.global_cumulative.cache_tokens = 0;
    }

    const timeRemainingMs = Math.max(0, nextAnchorStart - currentTime);
    const remHours = Math.floor(timeRemainingMs / (60 * 60 * 1000));
    const remMinutes = Math.floor((timeRemainingMs % (60 * 60 * 1000)) / (60 * 1000));
    timeRemainingStr = `${remHours}h ${remMinutes}m`;

    if (!state.sessions) {
      state.sessions = {};
    }

    // Migrate from single session format if exists
    if (state.session_id && !state.sessions[state.session_id]) {
      state.sessions[state.session_id] = {
        accumulated_cache_read_tokens: state.accumulated_cache_read_tokens || 0,
        last_total_input: state.last_total_input || 0,
        last_total_output: state.last_total_output || 0,
        last_current_input: state.last_current_input || -1,
        last_current_output: state.last_current_output || -1
      };
      delete state.session_id;
      delete state.accumulated_cache_read_tokens;
      delete state.last_total_input;
      delete state.last_total_output;
      delete state.last_current_input;
      delete state.last_current_output;
    }

    if (!state.sessions[sessionId]) {
      state.sessions[sessionId] = {
        accumulated_cache_read_tokens: 0,
        last_total_input: 0,
        last_total_output: 0,
        last_current_input: -1,
        last_current_output: -1,
        // Monotonically-increasing display counters — immune to context compaction dips
        display_input: 0,
        display_output: 0
      };
    }

    const sessionState = state.sessions[sessionId];

    // Ensure display counters exist for migrated sessions
    if (sessionState.display_input === undefined) sessionState.display_input = sessionState.last_total_input || 0;
    if (sessionState.display_output === undefined) sessionState.display_output = sessionState.last_total_output || 0;

    // Calculate deltas — only positive deltas are recorded
    // total_input_tokens can DROP during context compaction; we track last seen and
    // only add the positive diff to our monotonic display counter.
    let deltaInput = 0;
    let deltaOutput = 0;
    let deltaCache = 0;

    if (totalInput >= sessionState.last_total_input) {
      deltaInput = totalInput - sessionState.last_total_input;
    }
    // Always update last_total_input (even on drops) so next positive delta is relative
    sessionState.last_total_input = totalInput;

    if (totalOutput >= sessionState.last_total_output) {
      deltaOutput = totalOutput - sessionState.last_total_output;
    }
    sessionState.last_total_output = totalOutput;

    // Accumulate into monotonic display counters
    sessionState.display_input += deltaInput;
    sessionState.display_output += deltaOutput;

    if (sessionState.last_current_input !== currentInput || sessionState.last_current_output !== currentOutput) {
      deltaCache = cacheHit;
      sessionState.accumulated_cache_read_tokens += cacheHit;
      sessionState.last_current_input = currentInput;
      sessionState.last_current_output = currentOutput;
    }

    // Update global cumulative counters
    state.global_cumulative.input_tokens += deltaInput;
    state.global_cumulative.output_tokens += deltaOutput;
    state.global_cumulative.cache_tokens += deltaCache;

    // Save back to file
    try {
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      if (process.env.DEBUG) process.stderr.write(`[status_line] Failed to write session state: ${err.message}\n`);
    }

    // Use monotonic display values for rendering (stable, never decreases)
    totalInput = sessionState.display_input;
    totalOutput = sessionState.display_output;

    accumulatedCache = sessionState.accumulated_cache_read_tokens;
    globalCumInput = state.global_cumulative.input_tokens;
    globalCumOutput = state.global_cumulative.output_tokens;
    globalCumCache = state.global_cumulative.cache_tokens;
  } else {
    accumulatedCache = cacheHit;
    globalCumInput = totalInput;
    globalCumOutput = totalOutput;
    globalCumCache = cacheHit;
  }

  // ── Model-Aware Pricing ──────────────────────────────────────────────────
  // Rates per token (USD). Source: Google AI Studio & Vertex AI pricing (2026).
  function getPricing(modelId, displayName, contextTokens) {
    const id = (modelId || displayName || '').toLowerCase();
    
    // 1. Gemini 3.1 Pro (tiered pricing based on context length)
    if (id.includes('3.1') && id.includes('pro')) {
      const isOver200k = (contextTokens || 0) > 200000;
      if (isOver200k) {
        return { input: 4.00 / 1e6, output: 18.00 / 1e6, cache: 0.40 / 1e6 };
      } else {
        return { input: 2.00 / 1e6, output: 12.00 / 1e6, cache: 0.20 / 1e6 };
      }
    }
    
    // 2. Gemini 3.1 Flash
    if (id.includes('3.1') && id.includes('flash')) {
      return { input: 0.25 / 1e6, output: 1.50 / 1e6, cache: 0.025 / 1e6 };
    }
    
    // 3. Gemini 3.5 Flash (both Medium and High reasoning levels)
    if (id.includes('3.5') && id.includes('flash')) {
      return { input: 1.50 / 1e6, output: 9.00 / 1e6, cache: 0.15 / 1e6 };
    }
    
    // Default fallback: Gemini 3.5 Flash rates
    return { input: 1.50 / 1e6, output: 9.00 / 1e6, cache: 0.15 / 1e6 };
  }

  const modelId = (data.model && data.model.id) || '';
  const pricing = getPricing(modelId, modelName, realContextUsed);

  // Session cost (using monotonic display totals)
  const inputCost = totalInput * pricing.input;
  const outputCost = totalOutput * pricing.output;
  const cacheCost = accumulatedCache * pricing.cache;
  const totalCost = inputCost + outputCost + cacheCost;

  // 5-hour cumulative cost
  const cumInputCost = globalCumInput * pricing.input;
  const cumOutputCost = globalCumOutput * pricing.output;
  const cumCacheCost = globalCumCache * pricing.cache;
  const cumulativeCost = cumInputCost + cumOutputCost + cumCacheCost;

  const formattedCostWide = `${t.value}$${totalCost.toFixed(2)}${reset} ${t.divider}(5h:${reset} ${t.gold}$${cumulativeCost.toFixed(2)}${reset} ${t.divider}[${timeRemainingStr} left])${reset}`;
  const formattedCostMed  = `${t.value}$${totalCost.toFixed(2)}${reset} ${t.divider}(5h:${reset} ${t.gold}$${cumulativeCost.toFixed(2)}${reset}${t.divider})${reset}`;
  const formattedCostNarr = `${t.value}$${totalCost.toFixed(2)}${reset} ${t.divider}(5h:${reset} ${t.gold}$${cumulativeCost.toFixed(1)}${reset}${t.divider})${reset}`;

  // Quota remaining color: green → yellow → red as remaining shrinks
  let ctxColor = t.ok;
  if (remainingPercent < 20) {
    ctxColor = t.crit;
  } else if (remainingPercent < 50) {
    ctxColor = t.warn;
  }

  // Real Context occupancy color: green → yellow → red as used grows
  let realCtxColor = t.ok;
  if (realContextUsedPercent >= 80) {
    realCtxColor = t.crit;
  } else if (realContextUsedPercent >= 50) {
    realCtxColor = t.warn;
  }

  const progressBarStr = makeProgressBar(remainingPercent, 6);

  // ── 5. Process tree & subagents & background tasks ───────────────────────
  let subagentCount = 0;
  let taskCount = 0;

  // Track active subagents by parsing the JSONL transcript file
  let transcriptPath = (typeof data.transcript_path === 'string') ? data.transcript_path : '';
  const homeDir = os.homedir() || os.tmpdir() || '';
  const convId = (typeof data.conversation_id === 'string' && /^[a-f0-9-]+$/i.test(data.conversation_id)) ? data.conversation_id : '';

  // Sanitize transcriptPath to prevent directory traversal and arbitrary file reads
  if (transcriptPath) {
    const resolvedPath = path.resolve(transcriptPath);
    const allowedPrefix1 = path.join(homeDir, '.gemini/antigravity/');
    const allowedPrefix2 = path.join(homeDir, '.gemini/antigravity-cli/');
    const allowedPrefix3 = os.tmpdir();
    if (!resolvedPath.startsWith(allowedPrefix1) && !resolvedPath.startsWith(allowedPrefix2) && !resolvedPath.startsWith(allowedPrefix3)) {
      transcriptPath = '';
    }
  }

  if (transcriptPath && !fs.existsSync(transcriptPath)) {
    // Try replacing antigravity with antigravity-cli
    if (transcriptPath.includes('.gemini/antigravity/')) {
      const alt = transcriptPath.replace('.gemini/antigravity/', '.gemini/antigravity-cli/');
      if (fs.existsSync(alt)) {
        transcriptPath = alt;
      }
    } else if (transcriptPath.includes('.gemini/antigravity-cli/')) {
      const alt = transcriptPath.replace('.gemini/antigravity-cli/', '.gemini/antigravity/');
      if (fs.existsSync(alt)) {
        transcriptPath = alt;
      }
    }
  }

  // If still not resolved or empty, try constructing from conversation_id
  if ((!transcriptPath || !fs.existsSync(transcriptPath)) && convId) {
    const possibleTranscriptPaths = [
      path.join(homeDir, `.gemini/antigravity-cli/brain/${convId}/.system_generated/logs/transcript.jsonl`),
      path.join(homeDir, `.gemini/antigravity/brain/${convId}/.system_generated/logs/transcript.jsonl`),
    ];
    for (const p of possibleTranscriptPaths) {
      if (fs.existsSync(p)) {
        transcriptPath = p;
        break;
      }
    }
  }

  if (transcriptPath && fs.existsSync(transcriptPath)) {
    try {
      const transcriptContent = fs.readFileSync(transcriptPath, 'utf8');
      const lines = transcriptContent.split('\n');
      const spawned = new Set();
      const completed = new Set();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const step = JSON.parse(line);
          
          // 1. Detect subagent spawning
          if (step.type === 'INVOKE_SUBAGENT' && step.content) {
            const uuidMatches = step.content.match(/"conversationId":\s*"([a-f0-9-]+)"/g);
            if (uuidMatches) {
              for (const match of uuidMatches) {
                const uuidMatch = match.match(/"conversationId":\s*"([a-f0-9-]+)"/);
                if (uuidMatch && uuidMatch[1]) {
                  spawned.add(uuidMatch[1]);
                }
              }
            }
          }
          
          // 2. Detect subagent completion
          if (step.type === 'SYSTEM_MESSAGE' && step.content) {
            // Find sender=UUID block in content
            const senderMatch = step.content.match(/sender=([a-f0-9-]+)/);
            if (senderMatch && senderMatch[1]) {
              const senderUuid = senderMatch[1];
              if (spawned.has(senderUuid)) {
                completed.add(senderUuid);
              }
            }
          }
        } catch (innerErr) {
          // Skip invalid lines
        }
      }

      // Compute active subagents
      subagentCount = 0;
      for (const uuid of spawned) {
        if (!completed.has(uuid)) {
          subagentCount++;
        }
      }
    } catch (e) {
      if (process.env.DEBUG) process.stderr.write(`[status_line] subagent transcript parsing error: ${e.message}\n`);
    }
  }

  // Preserve PPID task checking for non-subagent child tasks
  const parentPid = process.ppid;
  if (parentPid) {
    try {
      const output = execSync('ps -o pid,ppid,cmd -e', { encoding: 'utf8' });
      for (const line of output.trim().split('\n')) {
        const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
        if (!match) continue;
        const pid  = parseInt(match[1], 10);
        const ppid = parseInt(match[2], 10);
        const cmd  = match[3];
        if (ppid !== parentPid || pid === process.pid) continue;
        if (cmd.includes('status_line') || cmd.includes('ps -o') || cmd.includes('grep')) continue;
        if (cmd.includes('agy') || cmd.includes('antigravity')) {
          // Obsolete subagent counting via OS PPID ignored. Subagents counted via transcript.
        } else {
          taskCount++;
        }
      }
    } catch (e) {
      if (process.env.DEBUG) process.stderr.write(`[status_line] ps error: ${e.message}\n`);
    }
  }

  // ── 6. task.md checklist progress ────────────────────────────────────────
  let progress = 0;
  if (convId) {
    const homeDir = os.homedir() || os.tmpdir() || '';
    const possiblePaths = [
      path.join(homeDir, `.gemini/antigravity-cli/brain/${convId}/task.md`),
      path.join(homeDir, `.gemini/antigravity/brain/${convId}/task.md`),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const lines = fs.readFileSync(p, 'utf8').split('\n');
          let taskTotal = 0, taskCompleted = 0;
          for (const line of lines) {
            // Safe and accurate checklist item parsing (only matching valid checkbox formats)
            const match = line.match(/^\s*- \[( |\/|x|X)\]/);
            if (!match) continue;
            taskTotal++;
            if (match[1].toLowerCase() === 'x') {
              taskCompleted++;
            }
          }
          if (taskTotal > 0) {
            progress = Math.round((taskCompleted / taskTotal) * 100);
          }
        } catch (e) {
          if (process.env.DEBUG) process.stderr.write(`[status_line] task.md error: ${e.message}\n`);
        }
        break;
      }
    }
  }

  // ── 7. Build themed status pieces ────────────────────────────────────────
  const pStr = `${t.divider}|${reset}`;

  const planTier = data.plan_tier || 'Google AI Pro';
  const compactPlan = planTier.replace(/Google\s+/gi, '');

  // Subagents active state glowing orange color mapping
  const subColor = subagentCount > 0 ? t.activeSub : t.subagents;

  // Task & Activity Elements (Line 1 Right)
  const pieceSubagents = `⏳ ${subColor}Subagents:${reset} ${t.value}${subagentCount}${reset}`;
  const pieceTasks     = `⚙️ ${t.tasks}Tasks:${reset} ${t.value}${taskCount}${reset}`;
  const pieceArtifacts = `🎨 ${t.artifact}Art:${reset} ${t.value}${artifactCount}${reset}`;
  const pieceProgress  = `🎯 ${t.progress}Progress:${reset} ${t.value}${progress}%${reset}`;

  const pieceSubMedium = `⏳ ${subColor}Sub:${reset}${t.value}${subagentCount}${reset}`;
  const pieceTskMedium = `⚙️ ${t.tasks}Tsk:${reset}${t.value}${taskCount}${reset}`;
  const pieceArtMedium = `🎨 ${t.artifact}Art:${reset}${t.value}${artifactCount}${reset}`;
  const piecePrgMedium = `🎯 ${t.progress}Prog:${reset}${t.value}${progress}%${reset}`;

  // Token Detailed Metrics (Line 3 Left)
  const tIn    = `${t.label}In:${reset}${t.value}${formatToken(totalInput, true)} ${t.divider}(+${formatToken(currentInput, true)}, 5h:${formatToken(globalCumInput, true)})${reset}`;
  const tOut   = `${t.label}Out:${reset}${t.value}${formatToken(totalOutput, true)} ${t.divider}(+${formatToken(currentOutput, true)}, 5h:${formatToken(globalCumOutput, true)})${reset}`;
  const tCache = `${t.label}Cache:${reset}${t.value}${formatToken(cacheHit, true)} ${t.divider}(5h:${formatToken(globalCumCache, true)})${reset}`;
  
  // Context Utilization Only (Removed dynamic progress bar and Ctx Rem)
  const tCtx   = `🧠 ${t.label}Ctx:${reset} ${realCtxColor}${formatToken(realContextUsed, true)}/${formatToken(totalWindow, true)} (${realContextUsedPercent.toFixed(1)}%)${reset}`;

  // ── 8. Responsive Layout (Three-Line Dashboard with Reorganized Splits) ──
  const termWidth = data.terminal_width || process.stdout.columns || 120;
  let line1 = '';
  let line2 = '';
  let line3 = '';

  if (termWidth >= 120) {
    // Line 1: State & Plan Tier (Left) <---> Task Progress (Right)
    const l1Left = `${stateEmoji} ${t.state}${stateLabel}${reset} ${t.divider}[${reset}${t.tasks}${planTier}${reset}${t.divider}]${reset}`;
    const l1Right = [pieceSubagents, pieceTasks, pieceArtifacts, pieceProgress].join(` ${pStr} `);
    line1 = renderSplitLine(l1Left, l1Right, termWidth);

    // Line 2: Model Name (Left) <---> Cost Statistics (Right)
    const l2Left = `🤖 [${t.model}${modelName}${reset}]`;
    const l2Right = `💵 ${formattedCostWide}`;
    line2 = renderSplitLine(l2Left, l2Right, termWidth);

    // Line 3: Tokens Stats (Left) <---> Context Usage (Right)
    const l3Left = [`📥 ${tIn}`, `📤 ${tOut}`, `⚡ ${tCache}`].join(` ${pStr} `);
    const l3Right = tCtx;
    line3 = renderSplitLine(l3Left, l3Right, termWidth);

  } else if (termWidth >= 95) {
    // Line 1: State & Compact Plan (Left) <---> Compact Progress (Right)
    const l1Left = `${stateEmoji} ${t.state}${stateLabel}${reset} ${t.divider}[${reset}${t.tasks}${compactPlan}${reset}${t.divider}]${reset}`;
    const l1Right = [pieceSubMedium, pieceTskMedium, pieceArtMedium, piecePrgMedium].join(` ${pStr} `);
    line1 = renderSplitLine(l1Left, l1Right, termWidth);

    // Line 2: Model Name (Left) <---> Medium Cost (Right)
    const l2Left = `🤖 [${t.model}${modelName}${reset}]`;
    const l2Right = `💵 ${formattedCostMed}`;
    line2 = renderSplitLine(l2Left, l2Right, termWidth);

    // Line 3: Compact Tokens (Left) <---> Compact Context Usage (Right)
    const compactIn  = `${t.label}In:${reset}${t.value}${formatToken(totalInput, true)}${t.divider}(5h:${formatToken(globalCumInput, true)})${reset}`;
    const compactOut = `${t.label}Out:${reset}${t.value}${formatToken(totalOutput, true)}${t.divider}(5h:${formatToken(globalCumOutput, true)})${reset}`;
    const compactC   = `${t.label}Cache:${reset}${t.value}${formatToken(cacheHit, true)}${t.divider}(5h:${formatToken(globalCumCache, true)})${reset}`;
    const compactCtx = `🧠 ${t.label}Ctx:${reset}${realCtxColor}${realContextUsedPercent.toFixed(0)}%${reset}`;

    const l3Left = [`📥 ${compactIn}`, `📤 ${compactOut}`, `⚡ ${compactC}`].join(` ${pStr} `);
    const l3Right = compactCtx;
    line3 = renderSplitLine(l3Left, l3Right, termWidth);

  } else {
    // Narrow Layout: Reorganized alignment
    const l1Left = `${stateEmoji} ${t.state}${stateLabel.substring(0, 7)}${reset} ${t.divider}[${reset}${t.tasks}${compactPlan.substring(0, 8)}${reset}${t.divider}]${reset}`;
    const l1Right = [`⏳${subColor}${subagentCount}${reset}`, `⚙️${t.value}${taskCount}${reset}`, `🎯${t.progress}${progress}%${reset}`].join(` ${pStr} `);
    line1 = renderSplitLine(l1Left, l1Right, termWidth);

    const l2Left = `🤖 [${t.model}${modelName.substring(0, 10)}${reset}]`;
    const l2Right = `💵 ${formattedCostNarr}`;
    line2 = renderSplitLine(l2Left, l2Right, termWidth);

    const l3Left = [`📥${t.value}${formatToken(totalInput, true)}${reset}`, `📤${t.value}${formatToken(totalOutput, true)}${reset}`, `⚡${t.value}${formatToken(cacheHit, true)}${reset}`].join(` ${pStr} `);
    const l3Right = `🧠${realCtxColor}${realContextUsedPercent.toFixed(0)}%${reset}`;
    line3 = renderSplitLine(l3Left, l3Right, termWidth);
  }

  process.stdout.write(line1 + '\n' + line2 + '\n' + line3 + '\n');
});
