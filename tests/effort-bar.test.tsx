import type { TurnStepInput } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'effort-bar',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const MODEL = 'claude-opus-5-5'

for (const surface of ['terminal', 'desktop'] as const) {
  test(`a level picked on the bar goes out on the next message, model unchanged (${surface})`, async ($, on) => {
    // This hook stands for the engine: it records what each request went out with.
    const sent: string[] = []
    on('turn.step', async function* (_, e) {
      sent.push(`${e.agentId ?? 'main'} ${e.model} ${e.effort}`)
      return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
    })
    const send = async (effort: TurnStepInput['effort'], agentId?: string) => {
      const stream = $.turn.step({ turnId: 't', index: 0, model: MODEL, effort, messageCount: 1, ...(agentId ? { agentId } : {}) })
      for await (const _chunk of stream) {
        // drain
      }
      return stream.result
    }

    await send('xhigh')
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ key: 'xhigh' }))?.props.variant).toBe('primary')

    await ui.press({ key: 'max' })
    expect((await ui.find({ key: 'max' }))?.props.variant).toBe('primary')

    await send('xhigh')
    await send('xhigh', 'a1')
    expect(sent).toEqual([`main ${MODEL} xhigh`, `main ${MODEL} max`, `a1 ${MODEL} xhigh`])
    await ui.unmount()
  })
}

test('a level changed in Claude Code itself takes over from the bar', async ($, on) => {
  const sent: string[] = []
  on('turn.step', async function* (_, e) {
    sent.push(`${e.effort}`)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  const send = async (effort: TurnStepInput['effort']) => {
    const stream = $.turn.step({ turnId: 't', index: 0, model: MODEL, effort, messageCount: 1 })
    for await (const _chunk of stream) {
      // drain
    }
    return stream.result
  }

  await send('xhigh')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'low' })
  await send('xhigh')
  // The person ran /effort high in Claude Code.
  await send('high')
  await send('high')

  expect(sent).toEqual(['xhigh', 'low', 'high', 'high'])
  expect((await ui.find({ key: 'high' }))?.props.variant).toBe('primary')
  await ui.unmount()
})
