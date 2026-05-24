const fs = require('fs');
const path = require('path');
const os = require('os');                        // FIX #1: use os.homedir() instead of hardcoded path
const { execSync } = require('child_process');

async function fetchRealQuota(activeModelId, projectId) {
  const homeDir = os.homedir() || os.tmpdir() || '';
  const tokenPath = path.join(homeDir, '.gemini', 'antigravity-cli', 'antigravity-oauth-token');

  if (!fs.existsSync(tokenPath)) {
    if (process.env.DEBUG) process.stderr.write(`[status_line] Token file not found at ${tokenPath}\n`);
    return null;
  }

  let tokenData;
  try {
    const fileContent = fs.readFileSync(tokenPath, 'utf8');
    tokenData = JSON.parse(fileContent);
  } catch (err) {
    if (process.env.DEBUG) process.stderr.write(`[status_line] Failed to parse token: ${err.message}\n`);
    return null;
  }

  if (!tokenData || !tokenData.token || !tokenData.token.access_token) {
    if (process.env.DEBUG) process.stderr.write(`[status_line] No access token in token file\n`);
    return null;
  }

  const accessToken = tokenData.token.access_token;
  let pId = projectId || process.env.ANTIGRAVITY_PROJECT_ID || 'shaped-array-sg251';
  let projectField = pId;
  if (pId && !pId.startsWith('projects/')) {
    projectField = `projects/${pId}`;
  }

  const url = 'https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota';
  
  if (process.env.DEBUG) {
    process.stderr.write(`[status_line] Querying retrieveUserQuota for project: ${projectField}\n`);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ project: projectField }),
      signal: AbortSignal.timeout(1200)
    });

    if (!response.ok) {
      if (process.env.DEBUG) process.stderr.write(`[status_line] retrieveUserQuota HTTP error: ${response.status}\n`);
      return null;
    }

    const data = await response.json();
    if (!data || !data.buckets || !Array.isArray(data.buckets)) {
      if (process.env.DEBUG) process.stderr.write(`[status_line] Invalid quota response format\n`);
      return null;
    }

    const model = (activeModelId || '').toLowerCase();
    const getVersion = (str) => {
      const match = str.match(/(\d+(?:\.\d+)?)/);
      return match ? parseFloat(match[1]) : null;
    };
    const activeVer = getVersion(model);

    let bucket = null;

    // 1. Precise match with version guard
    bucket = data.buckets.find(b => {
      const bId = b.modelId.toLowerCase();
      const nameMatch = model.includes(bId) || bId.includes(model);
      if (!nameMatch) return false;
      if (activeVer) {
        const bVer = getVersion(bId);
        if (bVer && bVer !== activeVer) return false;
      }
      return true;
    });

    // 2. Version-aligned type fallback (flash vs pro)
    if (!bucket) {
      if (model.includes('flash')) {
        bucket = data.buckets.find(b => {
          const bId = b.modelId.toLowerCase();
          if (!bId.includes('flash')) return false;
          if (activeVer) {
            const bVer = getVersion(bId);
            if (bVer && bVer !== activeVer) return false;
          }
          return true;
        });
      } else if (model.includes('pro')) {
        bucket = data.buckets.find(b => {
          const bId = b.modelId.toLowerCase();
          if (!bId.includes('pro')) return false;
          if (activeVer) {
            const bVer = getVersion(bId);
            if (bVer && bVer !== activeVer) return false;
          }
          return true;
        });
      }
    }

    // 3. Absolute fallback only if model is unversioned
    if (!bucket && !activeVer) {
      bucket = data.buckets.find(b => b.modelId === 'gemini-3.1-pro-preview') || data.buckets[0];
    }

    if (bucket) {
      if (process.env.DEBUG) {
        process.stderr.write(`[status_line] Matched bucket: ${bucket.modelId}, remainingFraction: ${bucket.remainingFraction}\n`);
      }
      return {
        remainingFraction: Number.isFinite(bucket.remainingFraction) ? bucket.remainingFraction : 1.0,
        resetTime: bucket.resetTime || ''
      };
    }
  } catch (err) {
    if (process.env.DEBUG) process.stderr.write(`[status_line] Error in fetchRealQuota: ${err.message}\n`);
  }

  return null;
}

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

process.stdin.on('end', async () => {
  try {
    fs.writeFileSync(path.join(__dirname, 'stdin.log'), inputData, 'utf8');
  } catch (err) {}

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

  const activeModelId = (data.model && data.model.id) || '';
  let modelName = 'Gemini';
  if (data.model && data.model.display_name) {
    modelName = data.model.display_name;
  } else if (data.model && data.model.id) {
    modelName = data.model.id;
  }

  let realQuota = null;
  try {
    realQuota = await fetchRealQuota(modelName || activeModelId, process.env.ANTIGRAVITY_PROJECT_ID);
  } catch (err) {
    if (process.env.DEBUG) process.stderr.write(`[status_line] fetchRealQuota failed: ${err.message}\n`);
  }

  let serverQuotaPercent = null;
  if (realQuota !== null) {
    serverQuotaPercent = realQuota.remainingFraction * 100;
  }

  const themeName = (process.env.AGY_STATUS_THEME || 'aurora').toLowerCase();
  const theme = Object.prototype.hasOwnProperty.call(THEMES, themeName) ? THEMES[themeName] : THEMES.aurora;
  const reset = ansi('\x1b[0m');
  const t = {}; // convenience wrapper applying ansi() gate to each theme color
  for (const [k, v] of Object.entries(theme)) t[k] = ansi(v);

  // ── 2. Model name ────────────────────────────────────────────────────────
  // modelName and activeModelId parsed above for fetchRealQuota

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
  let liveQuotaPercent = 100;
  let baseQuotaPercent = 100;

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
    baseQuotaPercent = remainingPercent;
  }

  // Load session state to accumulate usage
  let accumulatedCache = 0;
  let globalCumInput = 0;
  let globalCumOutput = 0;
  let globalCumCache = 0;
  let timeRemainingStr = '5h 00m';

  // Fallbacks for session cumulative metrics (used if sessionId is not present)
  let sessionCumInput = totalInput;
  let sessionCumOutput = totalOutput;
  let sessionCumCache = cacheHit;

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

    // ── 5-Hour Sliding Window & New Session Reset ───────────────────────────
    const fiveHoursAgo = currentTime - (5 * 60 * 60 * 1000); // 5 hours in milliseconds

    if (!state.sessions) {
      state.sessions = {};
    }

    // 1. If this is a brand new session, perform a hard reset for both history and global metrics
    if (!state.sessions[sessionId]) {
      if (process.env.DEBUG) {
        process.stderr.write(`[status_line] New session detected: ${sessionId}. Resetting global history & cumulative metrics.\n`);
      }
      state.global_history = [];
      state.global_cumulative = {
        input_tokens: 0,
        output_tokens: 0,
        cache_tokens: 0
      };
      state.sessions[sessionId] = {
        accumulated_cache_read_tokens: 0,
        last_step_timestamp: 0,
        cumulative_input: 0,
        cumulative_output: 0,
        cumulative_cache: 0,
        display_input: 0,
        display_output: 0,
        last_step_signature: '',
        starting_quota: serverQuotaPercent !== null ? serverQuotaPercent : remainingPercent
      };
    }

    const sessionState = state.sessions[sessionId];
    if (sessionState.starting_quota === undefined || isNaN(sessionState.starting_quota) || (serverQuotaPercent !== null && sessionState.starting_quota === 100)) {
      sessionState.starting_quota = serverQuotaPercent !== null ? serverQuotaPercent : remainingPercent;
    }

    // Ensure session-level cumulative tracking fields are initialized to 0
    if (sessionState.cumulative_input === undefined) sessionState.cumulative_input = 0;
    if (sessionState.cumulative_output === undefined) sessionState.cumulative_output = 0;
    if (sessionState.cumulative_cache === undefined) sessionState.cumulative_cache = 0;

    // ── Real-Time Auto-Calibration from history.jsonl ──────────────────────────
    try {
      const historyPath = '/home/tiny/.gemini/antigravity-cli/history.jsonl';
      if (fs.existsSync(historyPath)) {
        const lines = fs.readFileSync(historyPath, 'utf8').trim().split('\n');
        if (lines.length > 0) {
          const lastLineJson = JSON.parse(lines[lines.length - 1]);
          const lastMsg = lastLineJson.display || '';
          const lastMsgTime = lastLineJson.timestamp || 0;

          // Check if we already processed this message
          if (lastMsgTime && (!sessionState.last_sync_timestamp || sessionState.last_sync_timestamp < lastMsgTime)) {
            // Check for explicit sync command or natural language calibration patterns
            // e.g. "60%" and "2시간 52분" or "2h 52m"
            const percentMatch = lastMsg.match(/(\d+(?:\.\d+)?)%/);
            
            let hours = 0;
            let minutes = 0;
            let timeFound = false;

            if (percentMatch) {
              const targetPercent = parseFloat(percentMatch[1]);
              
              // Try parsing time: "X시간 Y분" or "Xh Ym"
              const fullTimeMatch = lastMsg.match(/(\d+)\s*(?:시간|h)\s*(\d+)\s*(?:분|m)/i);
              if (fullTimeMatch) {
                hours = parseInt(fullTimeMatch[1], 10);
                minutes = parseInt(fullTimeMatch[2], 10);
                timeFound = true;
              } else {
                // Just "X시간" or "Xh"
                const hourMatch = lastMsg.match(/(\d+)\s*(?:시간|h)/i);
                if (hourMatch) {
                  hours = parseInt(hourMatch[1], 10);
                  timeFound = true;
                }
                // Just "Y분" or "Ym"
                const minMatch = lastMsg.match(/(\d+)\s*(?:분|m)/i);
                if (minMatch) {
                  minutes = parseInt(minMatch[1], 10);
                  timeFound = true;
                }
              }

              if (timeFound || lastMsg.includes('usage') || lastMsg.includes('quota') || lastMsg.includes('sync')) {
                const remainingMinutes = (hours * 60) + minutes;
                const remainingMs = remainingMinutes * 60 * 1000;
                
                // Align starting_quota
                sessionState.starting_quota = targetPercent;
                // Reset session-level cumulative counters to start fresh from the calibrated point
                sessionState.cumulative_input = 0;
                sessionState.cumulative_output = 0;
                sessionState.cumulative_cache = 0;
                sessionState.accumulated_cache_read_tokens = 0;
                sessionState.display_input = 0;
                sessionState.display_output = 0;
                
                // Calculate historical load to allow natural aging-out recovery of sliding window
                const safetyLimitDenominator = 10000000;
                const consumedPercent = 100 - targetPercent;
                const dummyTokens = Math.max(0, Math.floor((consumedPercent / 100) * safetyLimitDenominator));

                // Align reset timer in global history
                const targetOldestLogTime = currentTime + remainingMs - (5 * 60 * 60 * 1000);
                state.global_history = [
                  {
                    timestamp: targetOldestLogTime,
                    input: dummyTokens,
                    output: 0,
                    cache: 0
                  }
                ];
                
                sessionState.last_sync_timestamp = lastMsgTime;
                
                if (process.env.DEBUG) {
                  process.stderr.write(`[status_line] Auto-Calibrated Session to ${targetPercent}% and Reset in ${hours}h ${minutes}m!\n`);
                }
                
                // Save updated state immediately
                fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
              }
            } else {
              // Try command parsing: /sync <percent> <time>
              const cmdMatch = lastMsg.match(/^\s*\/(?:sync|calibrate|quota)\s+(\d+(?:\.\d+)?)\s+(\d+)\s*(?:시간|h)\s*(\d+)\s*(?:분|m)/i) ||
                               lastMsg.match(/^\s*\/(?:sync|calibrate|quota)\s+(\d+(?:\.\d+)?)\s+(\d+)\s*(?:시간|h)/i) ||
                               lastMsg.match(/^\s*\/(?:sync|calibrate|quota)\s+(\d+(?:\.\d+)?)\s+(\d+)\s*(?:분|m)/i);
              
              if (cmdMatch) {
                const targetPercent = parseFloat(cmdMatch[1]);
                hours = parseInt(cmdMatch[2] || '0', 10);
                minutes = parseInt(cmdMatch[3] || '0', 10);
                
                // Align starting_quota
                sessionState.starting_quota = targetPercent;
                sessionState.cumulative_input = 0;
                sessionState.cumulative_output = 0;
                sessionState.cumulative_cache = 0;
                sessionState.accumulated_cache_read_tokens = 0;
                sessionState.display_input = 0;
                sessionState.display_output = 0;
                
                const remainingMinutes = (hours * 60) + minutes;
                const remainingMs = remainingMinutes * 60 * 1000;
                const targetOldestLogTime = currentTime + remainingMs - (5 * 60 * 60 * 1000);
                
                // Calculate historical load to allow natural aging-out recovery of sliding window
                const safetyLimitDenominator = 10000000;
                const consumedPercent = 100 - targetPercent;
                const dummyTokens = Math.max(0, Math.floor((consumedPercent / 100) * safetyLimitDenominator));

                state.global_history = [
                  {
                    timestamp: targetOldestLogTime,
                    input: dummyTokens,
                    output: 0,
                    cache: 0
                  }
                ];
                
                sessionState.last_sync_timestamp = lastMsgTime;
                
                fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
              }
            }
          }
        }
      }
    } catch (err) {
      if (process.env.DEBUG) process.stderr.write(`[status_line] Calibration error: ${err.message}\n`);
    }

    // ── Self-Healing / Realignment of legacy corrupted state ─────────────────
    const combinedInputAndCache = (sessionState.cumulative_input || 0) + (sessionState.cumulative_cache || 0);
    if ((sessionState.cumulative_output || 0) > combinedInputAndCache || 
        (sessionState.cumulative_output > 10000 && sessionState.cumulative_input === 0)) {
      if (process.env.DEBUG) {
        process.stderr.write(`[status_line] Legacy corrupted session state detected for ${sessionId}. Aligning to pristine 0.\n`);
      }
      sessionState.cumulative_input = 0;
      sessionState.cumulative_output = 0;
      sessionState.cumulative_cache = 0;
      sessionState.accumulated_cache_read_tokens = 0;
      sessionState.display_input = 0;
      sessionState.display_output = 0;
    }

    // To prevent duplicate additions from the exact same step (idempotency),
    // we track the step's unique context footprint.
    const stepSignature = `${currentInput}-${currentOutput}-${cacheHit}-${totalInput}-${totalOutput}`;
    if (sessionState.last_step_signature !== stepSignature) {
      if (!state.global_history) {
        state.global_history = [];
      }

      // 1. Record step-level raw deltas directly to global history array
      state.global_history.push({
        timestamp: currentTime,
        input: currentInput,
        output: currentOutput,
        cache: cacheHit
      });

      // 2. Pure session-level self-aggregation based on raw deltas
      sessionState.cumulative_input = (sessionState.cumulative_input || 0) + currentInput;
      sessionState.cumulative_output = (sessionState.cumulative_output || 0) + currentOutput;
      sessionState.cumulative_cache = (sessionState.cumulative_cache || 0) + cacheHit;

      // Keep backup helper keys and backwards compatibility fully synchronized
      sessionState.accumulated_cache_read_tokens = sessionState.cumulative_cache;
      sessionState.display_input = sessionState.cumulative_input;
      sessionState.display_output = sessionState.cumulative_output;
      sessionState.last_step_signature = stepSignature;

      // Save back to file
      try {
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
      } catch (err) {
        if (process.env.DEBUG) process.stderr.write(`[status_line] Failed to write session state: ${err.message}\n`);
      }
    }

    accumulatedCache = sessionState.accumulated_cache_read_tokens || 0;
    sessionCumInput = sessionState.cumulative_input || 0;
    sessionCumOutput = sessionState.cumulative_output || 0;
    sessionCumCache = sessionState.cumulative_cache || 0;

    // 3. Filter history to keep only records within the 5-hour rolling window
    if (!state.global_history) {
      state.global_history = [];
    }
    state.global_history = state.global_history.filter(log => log.timestamp >= fiveHoursAgo);

    // 4. Dynamically compute global sums based on the active 5-hour window
    globalCumInput = 0;
    globalCumOutput = 0;
    globalCumCache = 0;

    for (const log of state.global_history) {
      globalCumInput += log.input;
      globalCumOutput += log.output;
      globalCumCache += log.cache;
    }

    // Update global_cumulative object for structure integrity
    state.global_cumulative = {
      input_tokens: globalCumInput,
      output_tokens: globalCumOutput,
      cache_tokens: globalCumCache
    };

    // 4.5. Dynamically compute 1-minute rate-limit quota remaining
    const oneMinuteAgo = currentTime - (60 * 1000);
    const oneMinHistory = state.global_history.filter(log => log.timestamp >= oneMinuteAgo);

    let oneMinInput = 0;
    let oneMinOutput = 0;
    let oneMinCache = 0;
    const oneMinRequests = oneMinHistory.length;

    for (const log of oneMinHistory) {
      oneMinInput += log.input;
      oneMinOutput += log.output;
      oneMinCache += log.cache;
    }
    const oneMinTotalTokens = oneMinInput + oneMinOutput + oneMinCache;

    function getRateLimits(mId, mName, plan) {
      const id = (mId || mName || '').toLowerCase();
      const planStr = (plan || '').toLowerCase();
      const isPaid = planStr.includes('pro') || planStr.includes('enterprise') || planStr.includes('pay');

      // Gemini 3.1 Pro / 3.5 Pro
      if (id.includes('pro')) {
        return isPaid ? { tpm: 10000000, rpm: 1000 } : { tpm: 2000000, rpm: 360 };
      }
      
      // Gemini 3.1 Flash
      if (id.includes('3.1') && id.includes('flash')) {
        return isPaid ? { tpm: 10000000, rpm: 2000 } : { tpm: 4000000, rpm: 15 };
      }
      
      // Gemini 3.5 Flash
      if (id.includes('3.5') && id.includes('flash')) {
        return isPaid ? { tpm: 4000000, rpm: 1000 } : { tpm: 1000000, rpm: 15 };
      }
      
      // Default fallback
      return isPaid ? { tpm: 4000000, rpm: 1000 } : { tpm: 1000000, rpm: 15 };
    }

    const activeModelId = (data.model && data.model.id) || '';
    const activePlan = data.plan_tier || 'Google AI Pro';
    const limits = getRateLimits(activeModelId, modelName, activePlan);

    // 1. Long-term Safety Quota: calculated dynamically from the active 5-hour rolling window
    const safetyLimitDenominator = 10000000; // 10M tokens total safety budget
    const fiveHourTokensUsed = globalCumInput + globalCumOutput;
    let calculatedSafetyQuota = 100 - (fiveHourTokensUsed / safetyLimitDenominator) * 100;
    if (!isFinite(calculatedSafetyQuota)) calculatedSafetyQuota = 100;
    calculatedSafetyQuota = Math.max(0, Math.min(100, calculatedSafetyQuota));

    if (serverQuotaPercent !== null) {
      if (serverQuotaPercent < calculatedSafetyQuota) {
        calculatedSafetyQuota = serverQuotaPercent;
      }
    }

    // 2. Immediate 1-minute Rate Limit Quota (RPM/TPM bottleneck)
    const tpmUsedPercent = (oneMinTotalTokens / limits.tpm) * 100;
    const tpmRemainingPercent = Math.max(0, 100 - tpmUsedPercent);

    const rpmUsedPercent = (oneMinRequests / limits.rpm) * 100;
    const rpmRemainingPercent = Math.max(0, 100 - rpmUsedPercent);
    const minuteQuotaPercent = Math.min(tpmRemainingPercent, rpmRemainingPercent);

    // The final live quota tracks the strictly monotonic-decreasing long-term safety quota
    liveQuotaPercent = calculatedSafetyQuota;
    
    // For backwards compatibility and UI display logic: allow base quota to recover
    const calibratedQuota = (sessionState.starting_quota !== undefined) ? sessionState.starting_quota : 100;
    baseQuotaPercent = Math.max(calibratedQuota, liveQuotaPercent);

    // Save state again after history filter
    try {
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      // Ignored
    }

    // 5. Calculate precise remaining time using fetched ground-truth resetTime if available
    if (realQuota !== null && realQuota.resetTime) {
      try {
        const resetDate = new Date(realQuota.resetTime);
        const timeRemainingMs = Math.max(0, resetDate.getTime() - currentTime);
        const remHours = Math.floor(timeRemainingMs / (60 * 60 * 1000));
        const remMinutes = Math.floor((timeRemainingMs % (60 * 60 * 1000)) / (60 * 1000));
        timeRemainingStr = `${remHours}h ${remMinutes}m`;
      } catch (err) {
        if (process.env.DEBUG) process.stderr.write(`[status_line] Failed to compute reset countdown: ${err.message}\n`);
        timeRemainingStr = '5h 00m';
      }
    } else if (state.global_history.length > 0) {
      const oldestLogTime = state.global_history[0].timestamp;
      const timeRemainingMs = Math.max(0, (oldestLogTime + (5 * 60 * 60 * 1000)) - currentTime);
      const remHours = Math.floor(timeRemainingMs / (60 * 60 * 1000));
      const remMinutes = Math.floor((timeRemainingMs % (60 * 60 * 1000)) / (60 * 1000));
      timeRemainingStr = `${remHours}h ${remMinutes}m`;
    } else {
      timeRemainingStr = '5h 00m';
    }
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
  const inputCost = sessionCumInput * pricing.input;
  const outputCost = sessionCumOutput * pricing.output;
  const cacheCost = sessionCumCache * pricing.cache;
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

  // Live Quota remaining color: green → yellow → red as remaining shrinks
  let quotaColor = t.ok;
  if (liveQuotaPercent < 20) {
    quotaColor = t.crit;
  } else if (liveQuotaPercent < 50) {
    quotaColor = t.warn;
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
  const tIn    = `${t.label}In:${reset}${t.value}${formatToken(sessionCumInput, true)}${reset} ${t.divider}(+${formatToken(currentInput, true)} / 5h:${formatToken(globalCumInput, true)})${reset}`;
  const tOut   = `${t.label}Out:${reset}${t.value}${formatToken(sessionCumOutput, true)}${reset} ${t.divider}(+${formatToken(currentOutput, true)} / 5h:${formatToken(globalCumOutput, true)})${reset}`;
  const tCache = `${t.label}Cache:${reset}${t.value}${formatToken(sessionCumCache, true)}${reset} ${t.divider}(+${formatToken(cacheHit, true)} / 5h:${formatToken(globalCumCache, true)})${reset}`;
  
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

    // Line 2: Model Name & Live Quota (Left) <---> Cost Statistics (Right)
    const l2Left = `🤖 [${t.model}${modelName}${reset} ${t.divider}|${reset} ⚡ ${quotaColor}Quota:${liveQuotaPercent.toFixed(1)}%/${baseQuotaPercent.toFixed(1)}%${reset} ${t.divider}(Reset: ${timeRemainingStr})${reset}]`;
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

    // Line 2: Model Name & Live Quota (Left) <---> Medium Cost (Right)
    const l2Left = `🤖 [${t.model}${modelName}${reset} ${t.divider}|${reset} ⚡ ${quotaColor}Q:${liveQuotaPercent.toFixed(1)}%/${baseQuotaPercent.toFixed(1)}%${reset} ${t.divider}(Rst: ${timeRemainingStr})${reset}]`;
    const l2Right = `💵 ${formattedCostMed}`;
    line2 = renderSplitLine(l2Left, l2Right, termWidth);

    // Line 3: Compact Tokens (Left) <---> Compact Context Usage (Right)
    const compactIn  = `${t.label}In:${reset}${t.value}${formatToken(sessionCumInput, true)}${reset} ${t.divider}(5h:${formatToken(globalCumInput, true)})${reset}`;
    const compactOut = `${t.label}Out:${reset}${t.value}${formatToken(sessionCumOutput, true)}${reset} ${t.divider}(5h:${formatToken(globalCumOutput, true)})${reset}`;
    const compactC   = `${t.label}Cache:${reset}${t.value}${formatToken(sessionCumCache, true)}${reset} ${t.divider}(5h:${formatToken(globalCumCache, true)})${reset}`;
    const compactCtx = `🧠 ${t.label}Ctx:${reset}${realCtxColor}${realContextUsedPercent.toFixed(0)}%${reset}`;

    const l3Left = [`📥 ${compactIn}`, `📤 ${compactOut}`, `⚡ ${compactC}`].join(` ${pStr} `);
    const l3Right = compactCtx;
    line3 = renderSplitLine(l3Left, l3Right, termWidth);

  } else {
    // Narrow Layout: Reorganized alignment
    const l1Left = `${stateEmoji} ${t.state}${stateLabel.substring(0, 7)}${reset} ${t.divider}[${reset}${t.tasks}${compactPlan.substring(0, 8)}${reset}${t.divider}]${reset}`;
    const l1Right = [`⏳${subColor}${subagentCount}${reset}`, `⚙️${t.value}${taskCount}${reset}`, `🎯${t.progress}${progress}%${reset}`].join(` ${pStr} `);
    line1 = renderSplitLine(l1Left, l1Right, termWidth);

    const l2Left = `🤖 [${t.model}${modelName.substring(0, 10)}${reset} ${t.divider}|${reset}⚡${quotaColor}${liveQuotaPercent.toFixed(1)}%/${baseQuotaPercent.toFixed(1)}%${reset} ${t.divider}(${timeRemainingStr})${reset}]`;
    const l2Right = `💵 ${formattedCostNarr}`;
    line2 = renderSplitLine(l2Left, l2Right, termWidth);

    const l3Left = [`📥${t.value}${formatToken(sessionCumInput, true)}${reset}`, `📤${t.value}${formatToken(sessionCumOutput, true)}${reset}`, `⚡${t.value}${formatToken(sessionCumCache, true)}${reset}`].join(` ${pStr} `);
    const l3Right = `🧠${realCtxColor}${realContextUsedPercent.toFixed(0)}%${reset}`;
    line3 = renderSplitLine(l3Left, l3Right, termWidth);
  }

  process.stdout.write(line1 + '\n' + line2 + '\n' + line3 + '\n');
});
