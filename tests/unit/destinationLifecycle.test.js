import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDestinationLifecycle } from '../../src/application/shell/destinationLifecycle.js'
test('shell validates its effect boundary and destination names', () => {
  assert.throws(() => createDestinationLifecycle({})); const host = createDestinationLifecycle({ activate() {} })
  assert.throws(() => host.navigate('fake-service')); assert.equal(host.destination, 'opening')
})
test('navigation pauses outgoing audio before activation, without remounting controllers', () => {
  const calls = [], identity = {}; const host = createDestinationLifecycle({ activate: d => calls.push([d, identity]), pause: [() => calls.push('pauseA'), () => calls.push('pauseB')] })
  for (const d of ['daw','opening','workbench','daw']) assert.equal(host.navigate(d), true)
  assert.equal(host.destination, 'daw'); assert.deepEqual(calls.slice(0, 3), ['pauseA','pauseB',['daw',identity]]); assert.equal(calls.length, 12)
})
test('pause failure prevents activation and still attempts all outgoing pause effects', () => {
  const calls = [], host = createDestinationLifecycle({ activate: () => calls.push('activate'), pause: [() => { calls.push('first'); throw Error('failed') }, () => calls.push('second')] })
  assert.throws(() => host.navigate('daw'), AggregateError); assert.deepEqual(calls, ['first','second']); assert.equal(host.destination, 'opening')
})
test('suspend preserves destination for bfcache and does not dispose retained project', () => {
  let closed = 0; const host = createDestinationLifecycle({ activate() {}, pause: [() => {}], dispose: [() => closed++] })
  host.navigate('daw'); assert.equal(host.suspend(), true); assert.equal(host.destination, 'daw'); assert.equal(closed, 0)
})
test('disposal closes every resource even when cleanup fails; idempotent and blocks late navigation', async () => {
  const calls = [], host = createDestinationLifecycle({ activate() { calls.push('activate') }, pause: [() => calls.push('pause')], dispose: [() => { calls.push('first'); throw Error('failure') }, async () => calls.push('second')] })
  const promise = host.dispose(); assert.equal(host.dispose(), promise); assert.equal(host.navigate('daw'), false); assert.equal(host.suspend(), false)
  await assert.rejects(promise, AggregateError); assert.deepEqual(calls, ['pause','first','second'])
})
test('async close is awaited, rather than claiming resources are closed when only started', async () => {
  let release; const close = new Promise(r => { release = r }); let completed = false
  const host = createDestinationLifecycle({ activate() {}, dispose: [() => close] }); const dispose = host.dispose().then(() => { completed = true })
  await Promise.resolve(); assert.equal(completed, false); release(); await dispose; assert.equal(completed, true)
})
