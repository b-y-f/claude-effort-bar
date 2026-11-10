export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

declare module 'claude-code' {
  interface PluginState {
    'effort-bar': {
      /** The level picked on the bar; null follows Claude Code's own setting. */
      pick: Effort | null
      /** The level Claude Code itself sent on its latest main-thread request. */
      app: Effort | null
      /** The model that request named: Claude Code keeps a level per model. */
      model: string | null
    }
  }
}
