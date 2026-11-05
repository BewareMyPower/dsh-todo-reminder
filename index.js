import { randomUUID } from 'node:crypto'

export const name = 'todo-reminder'

const DEFAULT_THRESHOLDS = [10, 30, 60]
const SOURCE_KIND = 'todo-reminder'

function validateThresholds(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('todo-reminder: `thresholds` must be a non-empty list of integers')
  }
  for (const value of values) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`todo-reminder: invalid threshold ${value} — every threshold must be an integer >= 1`)
    }
  }
  if (new Set(values).size !== values.length) {
    throw new Error('todo-reminder: `thresholds` must not contain duplicates')
  }
  return [...values].sort((a, b) => a - b)
}

function reminderMessage(text, calls) {
  return Object.freeze(structuredClone({
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: SOURCE_KIND, form: 'notice', summary: `todo stale × ${calls}` },
    id: randomUUID(),
  }))
}

function unfinishedCount(todos) {
  if (!Array.isArray(todos)) return undefined
  let open = 0
  for (const item of todos) {
    if (!item || item.status !== 'completed') open++
  }
  return open
}

function reminderText(calls, open, first) {
  const items = `${open} unfinished item${open === 1 ? '' : 's'}`
  if (first) {
    return `Your todo list still shows ${items} and has not been updated for ${calls} tool calls. `
      + 'Call todo_write to mark finished items completed and keep the in-progress item accurate, '
      + 'or continue working if the list is already up to date.'
  }
  return `Reminder: the todo list has gone ${calls} consecutive tool calls without an update and still `
    + `records ${items}. Update it now with todo_write unless the recorded state is already accurate.`
}

export function apply(ctx, config) {
  const thresholds = validateThresholds(config?.thresholds ?? DEFAULT_THRESHOLDS)
  const thresholdSet = new Set(thresholds)

  // Agent → { calls: tool calls since the latest todo_write, open: unfinished items it recorded }.
  // An agent that never wrote a list has no entry and is never reminded.
  const states = new WeakMap()

  function observe(exec) {
    if (!exec.agent) return undefined
    if (exec.name === 'todo_write') {
      const state = states.get(exec.agent)
      const open = unfinishedCount(exec.arguments?.todos) ?? state?.open ?? 0
      states.set(exec.agent, { calls: 0, open })
      return undefined
    }
    const state = states.get(exec.agent)
    if (state === undefined) return undefined
    state.calls += 1
    if (!thresholdSet.has(state.calls) || state.open <= 0) return undefined
    return reminderMessage(reminderText(state.calls, state.open, state.calls === thresholds[0]), state.calls)
  }

  ctx.on('tools/post-execute', async (exec, _result, next) => {
    const reminder = observe(exec)
    const downstream = await next()
    if (!reminder) return downstream
    const additionalContexts = [reminder, ...downstream.additionalContexts ?? []]
    if (downstream.kind === 'block') {
      return { kind: 'block', feedback: downstream.feedback, additionalContexts }
    }
    return { ...downstream, additionalContexts }
  })

  ctx.on('agent/pre-step', ({ agent, messages }, next) => {
    if (messages.some(message => message.source.kind === 'user')) states.delete(agent)
    return next()
  })
}
