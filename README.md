# agy-status-line

> A rich, 3-line terminal status bar plugin for [Antigravity CLI](https://github.com/antigravity), delivering real-time Gemini usage analytics, 5-hour sliding window cost tracking, active subagent monitoring, and context window visualization — all in a beautiful, ANSI-colored, split-justified dashboard.

---

## ✨ Features

- **3-Line Dashboard** — Organized display split across work status, model/cost, and token metrics
- **5-Hour Sliding Window Cost Tracker** — Persists and recalculates cumulative token usage and cost across a true 5-hour rolling window
- **New Session Reset** — Automatically starts fresh at $0.00 whenever you start a brand new Antigravity session
- **Diagnostics Doctor Tool** — Includes a `node doctor.js` command to check environment health, config sanity, and file permissions
- **Multi-Session Aware** — Each session tracked independently via UUID; no double-counting when switching between sessions
- **Active Subagent Counter** — Detects running subagents by parsing the live conversation transcript
- **Task.md Progress** — Shows real-time checklist completion % from the current conversation's `task.md`
- **Context Window Utilization** — Displays real token counts vs. window size with dynamic color thresholds
- **4 Built-in Themes** — `aurora`, `cyberpunk`, `classic`, `minimal`
- **Responsive Layout** — Adapts to terminal width (Wide ≥120, Medium ≥95, Narrow <95 columns)
- **Force Color Output** — ANSI colors always rendered even in piped/hooked execution contexts

---

## 📸 Preview

```
🧠 Thinking [Google AI Enterprise]          ⏳ Subagents: 0 | ⚙️ Tasks: 0 | 🎨 Art: 4 | 🎯 Progress: 80%
🤖 [Gemini 2.5 Flash]                                         💵 $1.18 (5h: $7.28 [4h 53m left])
📥 In:120.5k (+5.2k / 5h:938k) | 📤 Out:45k (+1.2k / 5h:578k) | ⚡ Cache:50k (+50k / 5h:4.5M)    🧠 Ctx: 165.5k/2.1M (7.9%)
```

> Colors are rendered in your terminal via ANSI escape codes. The preview above is a plain-text representation.

---

## 📋 Requirements & Antigravity CLI Installation

- **Node.js** `>=18.0.0`
- **[Antigravity CLI](https://github.com/antigravity)** — installed and configured
- A Gemini API session actively running via Antigravity CLI

### How to Install Antigravity CLI
If you haven't installed Antigravity CLI yet, install it globally using `npm`:
```bash
npm install -g antigravity-cli
```
Or, if installing directly from the official source repository:
```bash
git clone https://github.com/antigravity/cli.git
cd cli
npm install -g .
```

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/tiny/agy-status-line.git
cd agy-status-line
```

### 2. Run the installer

```bash
node install.js
```

The installer:
- Automatically detects your Antigravity CLI `settings.json` location (`~/.gemini/antigravity-cli/` or `~/.gemini/antigravity/`)
- Creates a backup of your existing settings (`settings.json.bak`)
- Injects the `statusLine` configuration pointing to `status_line.js`

### 3. Run Diagnostics (Optional but Recommended)

Verify your environment configuration and permissions:
```bash
node doctor.js
```

This diagnostic script checks Node.js compatibility, settings structure, absolute paths, and terminal rendering capabilities.

### 4. Restart your session

Reload or start a new Antigravity CLI session. The 3-line status bar will appear at the bottom of your terminal on every agent step.

---

## 🎨 Themes

Set the `AGY_STATUS_THEME` environment variable before running Antigravity CLI:

| Theme | Colors | Description |
|---|---|---|
| `aurora` *(default)* | Purple / Cyan / Emerald | DeepMind Aurora palette |
| `cyberpunk` | Hot-Pink / Neon Cyan / Laser Yellow | High-contrast cyberpunk |
| `classic` | Purple / Cyan / Green | Clean classic terminal style |
| `minimal` | White / Gray | Monochrome, distraction-free |

```bash
# Example — set in your shell profile (.bashrc / .zshrc):
export AGY_STATUS_THEME=cyberpunk
```

---

## 📐 Layout Structure

### Line 1 — Work Status & Billing Plan
```
{state_emoji} {AgentState} [{BillingPlan}]         ⏳ Subagents | ⚙️ Tasks | 🎨 Artifacts | 🎯 Progress%
```

### Line 2 — Model & Cost
```
🤖 [{ModelName}]                                   💵 ${sessionCost} (5h: ${cumulativeCost} [Xh Xm left])
```

### Line 3 — Token & Context
```
📥 In:{input} (+{delta} / 5h:{cum}) | 📤 Out:{output} (+{delta} / 5h:{cum}) | ⚡ Cache:{cache} (+{delta} / 5h:{cum})    🧠 Ctx: {used}/{total} ({pct}%)
```

**Split-Justified**: Each line uses ANSI-aware padding to align content flush against both the left and right terminal margins.

---

## 📊 5-Hour Cumulative Tracking

Gemini API usage resets on a **5-hour rolling window**. This plugin:

1. Persists token deltas to `session_state.json` (excluded from git)
2. Aggregates usage across **all active sessions** into a global `global_cumulative` counter
3. Automatically resets the window after 5 hours
4. Displays remaining time until next reset: `[4h 53m left]`
5. **Self-Healing & Idempotency** — Automatically heals legacy or mathematically corrupted session states, and uses step signature deduplication to prevent double-counting of token usage.

### Cost Formula (Gemini 3 Series)

Pricing is dynamically selected based on the active model and context size:

| Model | Input Rate (per 1M) | Output Rate (per 1M) | Cache Read (per 1M) |
|---|---|---|---|
| **Gemini 3.5 Flash** (Medium / High) | $1.50 | $9.00 | $0.15 |
| **Gemini 3.1 Pro** (Context ≤ 200k) | $2.00 | $12.00 | $0.20 |
| **Gemini 3.1 Pro** (Context > 200k) | $4.00 | $18.00 | $0.40 |
| **Gemini 3.1 Flash** (Flash-Lite) | $0.25 | $1.50 | $0.025 |

---

## 🔧 Advanced Options

### Disable colors

```bash
NO_COLOR=1 node status_line.js
```

### Debug mode

```bash
DEBUG=1 node status_line.js < stdin.log
```

Prints parsing errors and file-read issues to `stderr`.

### Manual test

```bash
echo '{
  "session_id": "your-session-uuid",
  "model": { "display_name": "Gemini 2.5 Flash" },
  "plan_tier": "Google AI Enterprise",
  "agent_state": "thinking",
  "artifact_count": 3,
  "context_window": {
    "total_input_tokens": 50000,
    "total_output_tokens": 12000,
    "context_window_size": 2097152,
    "remaining_percentage": 96.8,
    "current_usage": {
      "input_tokens": 4200,
      "output_tokens": 800,
      "cache_read_input_tokens": 30000
    }
  },
  "terminal_width": 120
}' | node status_line.js
```

---

## 📁 File Structure

```
agy-status-line/
├── status_line.js              # Main status bar renderer
├── install.js                  # Portable one-shot installer
├── doctor.js                   # Diagnostics and configuration health check
├── plugin.json                 # Plugin metadata
├── session_state.example.json  # Example structure for session_state.json
├── LICENSE                     # MIT License
├── README.md                   # This file
├── .gitignore
├── commands/
│   └── status.md               # /status slash command definition
└── skills/
    └── status_line_plugin/
        └── SKILL.md            # Skill definition for Antigravity CLI
```

> `session_state.json` is created automatically at runtime and is excluded from git (`.gitignore`). It stores your local usage accumulations only.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-improvement`
3. Commit your changes: `git commit -m 'feat: add my improvement'`
4. Push: `git push origin feature/my-improvement`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 한국어 안내 (Korean)

이 플러그인은 Antigravity CLI의 터미널 하단에 3줄짜리 상태 대시보드를 표시합니다.

- **1줄**: 에이전트 작업 상태 + 구글 요금제 (좌측) / 서브에이전트·태스크·아티팩트·진행률 (우측)
- **2줄**: 모델명 (좌측) / 세션 비용 + 최근 5시간 누적 비용 + 남은 리셋 시간 (우측)
- **3줄**: 토큰 사용량 상세 — In/Out/Cache (좌측) / 컨텍스트 점유율 (우측)

### 핵심 기능
- **새 세션 리셋**: 새로운 터미널 창을 열어 `agy`를 구동하고 새 세션 UUID로 진입하면, 누적 비용과 이력이 깨끗하게 `$0.00`으로 자동 초기화됩니다.
- **실시간 5시간 슬라이딩 윈도우**: 하루 블록이 쪼개지지 않고, 정확히 "현재 시점으로부터 5시간 이내"에 소비한 토큰만 동적으로 필터링하여 합산 및 모니터링합니다. 5시간을 초과한 과거 사용량은 자동으로 제외됩니다.
- **자가 진단 기능**: `node doctor.js`를 통해 설정, 스크립트 경로 유효성, 상태 파일 권한, TTY 지원 상황을 한눈에 확인할 수 있습니다.

### 설치 및 확인

```bash
# 1. 플러그인 리포지토리 복제
git clone https://github.com/tiny/agy-status-line.git
cd agy-status-line

# 2. 자동 설치 프로그램 실행
node install.js

# 3. 환경 자가 진단 실행
node doctor.js
```
