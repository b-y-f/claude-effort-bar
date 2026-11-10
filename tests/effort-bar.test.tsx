import type { PromptOrigin, RenderSurface, TurnStepInput } from 'claude-code'
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

test('a pick stays when the model changes, though Claude Code sends the new model its own level', async ($, on) => {
  const OTHER = 'claude-fable-5-2'
  const sent: string[] = []
  on('turn.step', async function* (_, e) {
    sent.push(`${e.model} ${e.effort}`)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  const send = async (model: string, effort: TurnStepInput['effort']) => {
    const stream = $.turn.step({ turnId: 't', index: 0, model, effort, messageCount: 1 })
    for await (const _chunk of stream) {
      // drain
    }
    return stream.result
  }

  await send(MODEL, 'xhigh')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'max' })
  // The person ran /model: Claude Code keeps a level per model, and this one's is medium.
  await send(OTHER, 'medium')
  await send(OTHER, 'medium')
  expect((await ui.find({ key: 'max' }))?.props.variant).toBe('primary')
  // Then /effort high on that model: a level changed in Claude Code itself still takes over.
  await send(OTHER, 'high')

  expect(sent).toEqual([`${MODEL} xhigh`, `${OTHER} max`, `${OTHER} max`, `${OTHER} high`])
  expect((await ui.find({ key: 'high' }))?.props.variant).toBe('primary')
  await ui.unmount()
})

for (const [surface, origin] of [
  ['terminal', 'composer'],
  ['desktop', 'sdk'],
] as const) {
  test(`a typed message waits until a level is highlighted (${surface})`, async ($, on) => {
    // These hooks stand for the engine: where the session draws, and the prompt entering.
    const entered: string[] = []
    on('session.surfaces', () => ({ value: [surface] }))
    on('prompt.submit', (_, e) => (entered.push(e.text), { text: e.text }))
    const submit = () => $.prompt.submit({ text: 'hi', wait: false, origin: { kind: origin } })

    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.findAll({ type: 'Button' })).filter(button => button.props.variant === 'primary')).toEqual([])

    expect((await submit()).drop).toBeDefined()

    await ui.press({ key: 'high' })
    expect((await submit()).text).toBe('hi')
    expect(entered).toEqual(['hi'])
    await ui.unmount()
  })
}

test('what the person does not type at the bar goes out with no level highlighted', async ($, on) => {
  let surfaces: RenderSurface[] = ['terminal']
  const entered: string[] = []
  on('session.surfaces', () => ({ value: surfaces }))
  on('prompt.submit', (_, e) => (entered.push(e.text), { text: e.text }))
  const submit = (text: string, origin: PromptOrigin, command?: { name: string; args: string }) =>
    $.prompt.submit({ text, wait: false, origin, ...(command ? { command } : {}) })

  await submit('task done', { kind: 'task-notification' })
  await submit('/review', { kind: 'composer' }, { name: 'review', args: '' })
  // A `claude -p` run draws nowhere.
  surfaces = []
  await submit('from -p', { kind: 'sdk' })

  expect(entered).toEqual(['task done', '/review', 'from -p'])
})
