# agy_status_line_plugin

> A rich, 3-line terminal status bar plugin for [Antigravity CLI](https://github.com/antigravity), delivering real-time Gemini usage analytics, 5-hour cumulative cost tracking, active subagent monitoring, and context window visualization — all in a beautiful, ANSI-colored, split-justified dashboard.

---

## ✨ Features

- **3-Line Dashboard** — Organized display split across work status, model/cost, and token metrics
- **5-Hour Rolling Cost Tracker** — Persists cumulative token usage and cost across all sessions within a 5-hour window (matching Gemini's rate limit cycle)
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
📥 In:120.5k (+5.2k, 5h:938k) | 📤 Out:45k (+1.2k, 5h:578k) | ⚡ Cache:50k (5h:4.5M)    🧠 Ctx: 165.5k/2.1M (7.9%)
```

> Colors are rendered in your terminal via ANSI escape codes. The preview above is a plain-text representation.

---

## 📋 Requirements

- **Node.js** `>=18.0.0`
- **[Antigravity CLI](https://github.com/antigravity)** — installed and configured
- A Gemini API session actively running via Antigravity CLI

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/tiny/agy_status_line_plugin.git
cd agy_status_line_plugin
```

### 2. Run the installer

```bash
node install.js
```

The installer:
- Automatically detects your Antigravity CLI `settings.json` location (`~/.gemini/antigravity-cli/` or `~/.gemini/antigravity/`)
- Creates a backup of your existing settings
- Injects the `statusLine` configuration pointing to `status_line.js`

### 3. Restart your session

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
📥 In:{input} (+{delta}, 5h:{cum}) | 📤 Out:{output} | ⚡ Cache:{cache}    🧠 Ctx: {used}/{total} ({pct}%)
```

**Split-Justified**: Each line uses ANSI-aware padding to align content flush against both the left and right terminal margins.

---

## 📊 5-Hour Cumulative Tracking

Gemini API usage resets on a **5-hour rolling window**. This plugin:

1. Persists token deltas to `session_state.json` (excluded from git)
2. Aggregates usage across **all active sessions** into a global `global_cumulative` counter
3. Automatically resets the window after 5 hours
4. Displays remaining time until next reset: `[4h 53m left]`

### Cost Formula

| Token Type | Rate |
|---|---|
| Input | $1.50 / 1M tokens |
| Output | $9.00 / 1M tokens |
| Cache Read | $0.15 / 1M tokens |

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
agy_status_line_plugin/
├── status_line.js              # Main status bar renderer
├── install.js                  # Portable one-shot installer
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
- **2줄**: 모델명 (좌측) / 세션 비용 + 5시간 누적 비용 + 남은 리셋 시간 (우측)
- **3줄**: 토큰 사용량 상세 — In/Out/Cache (좌측) / 컨텍스트 점유율 (우측)

5시간 단위 누적 사용량은 `session_state.json`에 자동으로 저장·누산되며, 앱 재시작이나 세션 전환 시에도 초기화되지 않습니다.

### 설치

```bash
git clone https://github.com/tiny/agy_status_line_plugin.git
cd agy_status_line_plugin
node install.js
```
