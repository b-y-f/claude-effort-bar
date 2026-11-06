import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Effort } from '../types'

const LEVELS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

// The level picked on the bar; null follows Claude Code's own setting.
const pick = atom({ plugin: 'effort-bar', key: 'pick' } as const, null)
// The level Claude Code itself sends, as seen on its latest main-thread request.
const app = atom({ plugin: 'effort-bar', key: 'app' } as const, null)

const isLevel = (value: unknown): value is Effort => LEVELS.includes(value as Effort)

export const register: Register = on => {
  on('turn.step', async function* ($, e, next) {
    const sent = e.effort
    // Subagents, and models that take no effort level, keep what Claude Code sends.
    if (e.agentId !== undefined || !isLevel(sent)) return yield* next(e)

    const seen = await read($, app)
    if (seen !== sent) {
      await update($, app, () => sent)
      // A level changed in Claude Code itself (/effort, the /model slider) wins over the bar's pick.
      if (seen !== null) await update($, pick, () => null)
    }

    const level = await read($, pick)
    return yield* next(level === null ? e : { ...e, effort: level })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const current = (await read($, pick)) ?? (await read($, app))

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
