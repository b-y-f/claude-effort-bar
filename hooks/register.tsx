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
// The level the latest message went out at; null until one has, and on a model that takes none.
const latest = atom({ plugin: 'effort-bar', key: 'latest' } as const, null)
// Whether a prompt entered the running turn since its latest request, which the next one then carries.
const entered = atom({ plugin: 'effort-bar', key: 'entered' } as const, false)

const isLevel = (value: unknown): value is Effort => LEVELS.includes(value as Effort)

export const register: Register = on => {
  on('prompt.submit', async ($, e, next) => {
    if (e.turnId !== undefined && !e.command) await update($, entered, () => true)
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
    // Subagents keep what Claude Code sends.
    if (e.agentId !== undefined) return yield* next(e)
    // So does a model that takes no effort level, and then no level went out.
    if (!isLevel(sent)) {
      if ((await read($, latest)) !== null) await update($, latest, () => null)
      return yield* next(e)
    }

    const seen = await read($, app)
    const isSameModel = (await read($, model)) === e.model
    if (seen !== sent || !isSameModel) {
      await update($, app, () => sent)
      await update($, model, () => e.model)
      // A level changed in Claude Code itself (/effort, the /model slider) wins over the bar's pick. One that
      // changed with the model is only the new model's own level, so the pick stays.
      if (seen !== sent && isSameModel) await update($, pick, () => null)
    }

    const picked = await read($, pick)
    const level = picked ?? sent
    // A level stands from one message to the next: a request that carries only tool results goes out at the
    // level its message did. So what went out changes with a turn's first request, or one a prompt entered before.
    if (e.index === 0 || (await read($, entered))) {
      await update($, entered, () => false)
      const before = await read($, latest)
      if (before !== level) {
        await update($, latest, () => level)
        const cause = picked === null ? "Claude Code's own level" : 'picked on the bar'
        if (before !== null) $.ui.log(`Effort changed from ${before} to ${level} (${cause}).`)
      }
    }

    return yield* next(picked === null ? e : { ...e, effort: level })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const current = (await read($, pick)) ?? (await read($, app))
    const went = await read($, latest)

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
        {went !== null && <Text dimColor>{`· last message: ${went}`}</Text>}
      </Box>
    )
  })
}
