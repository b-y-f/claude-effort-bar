import type { On, TurnStepInput } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

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

// These hooks stand for the engine at a session's start: the model, the environment and the settings.
const startSession = async (
  $: Engine,
  on: On,
  { env = {}, modelSettings }: { env?: Record<string, string>; modelSettings?: Record<string, unknown> },
) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.model', () => ({ value: MODEL }))
  on('settings.read', () => ({ value: modelSettings ? { modelSettings } : {} }))
  mock.env(on, env)
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`before the first message, the bar shows the level saved for the model (${surface})`, async ($, on) => {
    mock.store(on)
    await startSession($, on, { modelSettings: { [MODEL]: { effortLevel: 'medium' } } })

    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ key: 'medium' }))?.props.variant).toBe('primary')
    await ui.unmount()
  })
}

test('before the first message, CLAUDE_CODE_EFFORT_LEVEL wins over the saved level', async ($, on) => {
  mock.store(on)
  await startSession($, on, {
    env: { CLAUDE_CODE_EFFORT_LEVEL: 'low' },
    modelSettings: { [MODEL]: { effortLevel: 'xhigh' } },
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ key: 'low' }))?.props.variant).toBe('primary')
  await ui.unmount()
})

test('with no level saved, a session starts on the level the model started the last one at', async ($, on) => {
  mock.store(on)
  // The next session starts without this one's values; the store stays.
  let isNextSession = false
  on('state.get', { plugin: 'effort-bar', key: 'app' }, (_, e, next) =>
    isNextSession ? { value: { value: undefined, version: 0 } } : next(e),
  )
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  await startSession($, on, {})

  // The model's default goes out with the first message.
  const stream = $.turn.step({ turnId: 't', index: 0, model: MODEL, effort: 'medium', messageCount: 1 })
  for await (const _chunk of stream) {
    // drain
  }

  isNextSession = true
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ key: 'medium' }))?.props.variant).toBe('primary')
  await ui.unmount()
})
