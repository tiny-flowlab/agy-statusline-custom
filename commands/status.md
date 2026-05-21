---
description: "Analyze and report the current session's detailed resource usage, context state, and subagent activity."
---

Analyze the current session's resource consumption, context window state, and subagent activity, then present the results as a well-formatted markdown table.

## 📊 Session Resource & Context Report

Include the following in your report:

- **Active Model**: The model currently in use (name and variant)
- **Token Usage**: Cumulative input/output token counts and context window utilization (`total_input_tokens`, `total_output_tokens`, `context_window_size`)
- **Cost Estimate**: Estimated session cost and 5-hour cumulative cost based on current token usage
- **Subagents & Tasks**: Number of active background subagents and the task completion rate from `task.md` (%)
- **Context Remaining**: Remaining context window capacity (%)

Present the report in a professional, clear markdown table so the user can assess system load and progress at a glance.
