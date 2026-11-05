import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, name } from './index.js'

function harness(thresholds) {
  const listeners = {}
  const ctx = { on(event, fn) { ;(listeners[event] ??= []).push(fn) } }
  apply(ctx, { thresholds })
  return listeners
}

async function runCalls(listeners, agent, calls) {
  const out = []
  for (const { name: toolName, args } of calls) {
    const exec = { agent, name: toolName, arguments: args }
    let decision = { kind: 'accept', value: {} }
    for (const listener of listeners['tools/post-execute']) {
      const next = () => Promise.resolve(decision)
      decision = await listener(exec, { isError: false, value: {}, content: [] }, next)
    }
    if (decision.additionalContexts) out.push(decision.additionalContexts)
  }
  return out
}

const write = (todos) => ({ name: 'todo_write', args: { todos } })
const call = (n = 'bash') => ({ name: n, args: {} })
const open = (n) => Array.from({ length: n }, (_, i) => ({ content: `t${i}`, status: 'pending' }))
const done = (n) => Array.from({ length: n }, (_, i) => ({ content: `t${i}`, status: 'completed' }))

test('reminds at thresholds while items remain unfinished', async () => {
  const l = harness([2, 4])
  const agent = {}
  const reminders = await runCalls(l, agent, [
    write(open(3)), call(), call(), call(), call(), call(),
  ])
  assert.equal(reminders.length, 2)
  assert.match(reminders[0][0].content[0].text, /3 unfinished items.*2 tool calls/)
  assert.match(reminders[1][0].content[0].text, /4 consecutive tool calls/)
})

test('silent for never-listed, all-done, and non-agent calls', async () => {
  const l = harness([1])
  const agent = {}
  assert.deepEqual(await runCalls(l, agent, [call(), call()]), [])
  assert.deepEqual(await runCalls(l, agent, [write(done(2)), call(), call()]), [])
  const exec = { name: 'bash', arguments: {} }
  const noAgent = await l['tools/post-execute'][0](exec, {}, () => Promise.resolve({ kind: 'accept' }))
  assert.equal(noAgent.additionalContexts, undefined)
})

test('todo_write restarts the counter and refreshes the unfinished count', async () => {
  const l = harness([2])
  const agent = {}
  const reminders = await runCalls(l, agent, [
    write(open(5)), call(), write(done(5)), call(), call(), call(),
  ])
  assert.equal(reminders.length, 0)
})

test('a user message clears tracked state', async () => {
  const l = harness([2])
  const agent = {}
  await runCalls(l, agent, [write(open(2)), call()])
  for (const listener of l['agent/pre-step']) {
    await listener({ agent, messages: [{ source: { kind: 'user' } }] }, () => Promise.resolve({ kind: 'enter' }))
  }
  const reminders = await runCalls(l, agent, [call(), call(), call()])
  assert.equal(reminders.length, 0)
})

test('invalid thresholds fail at load', () => {
  for (const bad of [[], [0], [1.5], [2, 2], 'x']) {
    assert.throws(() => apply({ on() {} }, { thresholds: bad }), /todo-reminder/)
  }
})

test('name export', () => {
  assert.equal(name, 'todo-reminder')
})
