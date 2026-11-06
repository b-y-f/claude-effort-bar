# claude-effort-bar

A Claude Code mod that adds one row above the prompt for picking the effort level of your next message. The model stays as it is.

```
Effort  low  medium  high  xhigh  max
```

- The level in use is highlighted. Click another one and your next message goes out at that level. It stays there until you click again.
- Only the main conversation changes. Subagents keep their own effort, and your saved default is left alone.
- If you change the level in Claude Code itself (for example with `/effort`), that wins, and the bar moves to it.
- A new session opens with the level Claude Code starts at already highlighted: `CLAUDE_CODE_EFFORT_LEVEL` when it is set, else the level saved for your model, else the level that model started your last session at. A level given with `--effort` shows once your first message goes out, because Claude Code reports it only with a request.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install effort-bar --marketplace b-y-f/claude-effort-bar
```

Answer `y` to add the marketplace, then pick a scope (the user scope is first; press Enter).

From a shell:

```
claude plugin install effort-bar --marketplace b-y-f/claude-effort-bar
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `b-y-f/claude-effort-bar`, then Add plugin.
