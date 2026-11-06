export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

declare module 'claude-code' {
  interface PluginState {
    'effort-bar': {
      /** The level picked on the bar; null follows Claude Code's own setting. */
      pick: Effort | null
      /** The level Claude Code itself sent on its latest main-thread request. */
      app: Effort | null
      /** Until that first request: the level Claude Code starts the session at, from its environment, settings or last session. */
      start: Effort | null
    }
  }
}
