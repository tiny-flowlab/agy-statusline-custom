---
name: status-line-plugin
description: Rich 3-line terminal status bar for Antigravity CLI showing model info, billing plan, real-time token usage, 5-hour cumulative cost tracking, active subagents, task progress, and context utilization with split-justified layout and ANSI themes.
---

# Status Line Plugin Skill

This skill configures the Antigravity CLI terminal status bar renderer powered by `status_line.js`.

## Layout Overview

The status bar renders as 3 lines, each split-justified (left and right aligned to terminal margins):

### Line 1 — Work Status & Billing Plan
```
{emoji} {AgentState} [{BillingPlan}]         ⏳ Subagents:{n} | ⚙️ Tasks:{n} | 🎨 Art:{n} | 🎯 Progress:{n}%
```

### Line 2 — Model & Cost
```
🤖 [{ModelName}]                             💵 ${session} (5h: ${cumulative} [Xh Xm left])
```

### Line 3 — Token & Context
```
📥 In:{input} (+{delta} / 5h:{cum}) | 📤 Out:{output} (+{delta} / 5h:{cum}) | ⚡ Cache:{cache} (+{delta} / 5h:{cum})    🧠 Ctx: {used}/{total} ({pct}%)
```

## Field Reference

| Field | Description |
|---|---|
| `{emoji}` | Agent state emoji: 🧠 thinking / 🔍 reviewing / ⚡ executing / 📝 planning / 💤 idle |
| `{AgentState}` | Current agent state text label |
| `{BillingPlan}` | Google billing plan tier (e.g. `Google AI Enterprise`) |
| `🤖 {ModelName}` | Active model display name (e.g. `Gemini 2.5 Flash`) |
| `💵 ${session}` | Estimated cost for current session (emerald green) |
| `5h: ${cumulative}` | Cumulative cost across all sessions in the 5-hour window (vibrant gold) |
| `[Xh Xm left]` | Time remaining until the 5-hour usage window resets |
| `⏳ Subagents` | Number of active subagents detected via transcript parsing |
| `⚙️ Tasks` | Number of active background tasks (PPID-based) |
| `🎨 Art` | Count of artifacts generated in this conversation |
| `🎯 Progress` | task.md checklist completion percentage |
| `📥 In` | Current session cumulative input token count (+ current step delta / 5h cumulative total) |
| `📤 Out` | Current session cumulative output token count (+ current step delta / 5h cumulative total) |
| `⚡ Cache` | Current session cumulative cache-read token count (+ current step delta / 5h cumulative total) |
| `🧠 Ctx` | Context window utilization: used tokens / total size (%) |

## Color Behavior

| Element | Color Logic |
|---|---|
| Model name | Bold purple/violet (theme-specific) |
| Session cost | Emerald green |
| Cumulative 5h cost | Vibrant gold `\x1b[38;5;220m` |
| Active subagents (>0) | Glowing orange `\x1b[38;5;208m` |
| Context utilization | Green → Amber → Crimson based on usage level |

## Themes

Set via `AGY_STATUS_THEME` environment variable:

| Value | Description |
|---|---|
| `aurora` (default) | Purple / Cyan / Emerald — DeepMind palette |
| `cyberpunk` | Hot-Pink / Neon Cyan / Laser Yellow |
| `classic` | Purple / Cyan / Green |
| `minimal` | White / Gray monochrome |

```bash
AGY_STATUS_THEME=cyberpunk node status_line.js
```

## NO_COLOR & Debug

```bash
NO_COLOR=1 node status_line.js        # Disable all ANSI colors
DEBUG=1 node status_line.js           # Print parse errors to stderr
```

## Slash Commands

- `/status` — Manually trigger a detailed resource usage report (token counts, context state, subagent status) as a formatted markdown table in chat.

## Installation & Diagnostics

```bash
# 1. Clone repository
git clone https://github.com/tiny/agy-status-line.git
cd agy-status-line

# 2. Run installer
node install.js

# 3. Run self-diagnostics
node doctor.js
```

The installer auto-detects `~/.gemini/antigravity-cli/settings.json` or `~/.gemini/antigravity/settings.json`, creates a backup, and registers the status line command. Use `doctor.js` to ensure the installation succeeded.
