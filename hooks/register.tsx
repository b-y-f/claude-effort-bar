import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Effort } from '../types'

const LEVELS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

// The level picked on the bar; null follows Claude Code's own setting.
const pick = atom({ plugin: 'effort-bar', key: 'pick' } as const, null)
// The level Claude Code itself sends, as seen on its latest main-thread request.
const app = atom({ plugin: 'effort-bar', key: 'app' } as const, null)
// Until that first request: the level Claude Code starts the session at.
const start = atom({ plugin: 'effort-bar', key: 'start' } as const, null)

const isLevel = (value: unknown): value is Effort => LEVELS.includes(value as Effort)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // Claude Code tells its level only with a request. Before the first one, take it from where Claude Code
    // does: CLAUDE_CODE_EFFORT_LEVEL, then the level saved for the model, then the level the model started
    // the last session at (its default).
    const model = await $.session.model()
    const saved = (await $.settings.read({ key: 'modelSettings' })) as Record<string, { effortLevel?: unknown }> | undefined
    const last = (await $.store.get('started')) as Record<string, unknown> | undefined
    const level = (await $.env.get('CLAUDE_CODE_EFFORT_LEVEL')) || saved?.[model]?.effortLevel || last?.[model]
    await update($, start, () => (isLevel(level) ? level : null))
    return started
  })

  on('turn.step', async function* ($, e, next) {
    const sent = e.effort
    // Subagents, and models that take no effort level, keep what Claude Code sends.
    if (e.agentId !== undefined || !isLevel(sent)) return yield* next(e)

    const seen = await read($, app)
    if (seen !== sent) {
      await update($, app, () => sent)
      if (seen === null) {
        // The session's first request: remember the level this model starts at, for the next session.
        const last = ((await $.store.get('started')) ?? {}) as Record<string, Effort>
        await $.store.set('started', { ...last, [e.model]: sent })
      } else {
        // A level changed in Claude Code itself (/effort, the /model slider) wins over the bar's pick.
        await update($, pick, () => null)
      }
    }

    const level = await read($, pick)
    return yield* next(level === null ? e : { ...e, effort: level })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const current = (await read($, pick)) ?? (await read($, app)) ?? (await read($, start))

    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text dimColor>Effort</Text>
        {LEVELS.map(level =>
          level === current ? (
            <Button key={level} variant="primary" label={level} onPress={() => update($, pick, () => level)} />
          ) : (
            <Button key={level} plain dimColor label={level} onPress={() => update($, pick, () => level)} />
          ),
        )}
      </Box>
    )
  })
}
