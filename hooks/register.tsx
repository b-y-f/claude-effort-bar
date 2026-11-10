import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Effort } from '../types'

const LEVELS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

// The level picked on the bar; null follows Claude Code's own setting.
const pick = atom({ plugin: 'effort-bar', key: 'pick' } as const, null)
// The level Claude Code itself sends, as seen on its latest main-thread request.
const app = atom({ plugin: 'effort-bar', key: 'app' } as const, null)
// The model that request named. Claude Code keeps a level per model, so `app` is this model's.
const model = atom({ plugin: 'effort-bar', key: 'model' } as const, null)

const isLevel = (value: unknown): value is Effort => LEVELS.includes(value as Effort)

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    // Only a message the person types where the bar is drawn waits for a level. Slash commands, background
    // deliveries, the phone and `claude -p` go out as they are.
    const isTyped = e.origin.kind === 'composer' || e.origin.kind === 'sdk'
    if (e.command || e.isMeta || !isTyped) return next(e)
    // Claude Code tells its level only with a request, so until a level is highlighted nobody knows which it is.
    if (((await read($, pick)) ?? (await read($, app))) !== null) return next(e)
    const surfaces = await $.session.surfaces()
    if (!surfaces.includes('terminal') && !surfaces.includes('desktop')) return next(e)

    return { drop: 'Pick an effort level on the bar above the prompt, then send again.' }
  })

  on('turn.step', async function* ($, e, next) {
    const sent = e.effort
    // Subagents, and models that take no effort level, keep what Claude Code sends.
    if (e.agentId !== undefined || !isLevel(sent)) return yield* next(e)

    const seen = await read($, app)
    const isSameModel = (await read($, model)) === e.model
    if (seen !== sent || !isSameModel) {
      await update($, app, () => sent)
      await update($, model, () => e.model)
      // A level changed in Claude Code itself (/effort, the /model slider) wins over the bar's pick. One that
      // changed with the model is only the new model's own level, so the pick stays.
      if (seen !== sent && isSameModel) await update($, pick, () => null)
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
