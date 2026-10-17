import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mountEnvironmentMotion } from '../../src/ui/presentation/rebuild/environmentMotion.js'

function setup() {
  const targets = []
  function target(extra = {}) {
    const listeners = new Map()
    const t = { ...extra, addEventListener(k, fn) { const a = listeners.get(k) || new Set(); a.add(fn); listeners.set(k, a) },
      removeEventListener(k, fn) { listeners.get(k)?.delete(fn) },
      emit(k, e = {}) { for (const fn of listeners.get(k) || []) fn(e) }, count() { return [...listeners.values()].reduce((n, a) => n + a.size, 0) } }
    targets.push(t); return t
  }
  const reduced = target({ matches: false }), fine = target({ matches: true }), frames = new Map(), values = new Map()
  let seq = 0, now = 0, modal = false
  const doc = target({ hidden: false })
  const win = target({ innerWidth: 1000, innerHeight: 700, matchMedia: q => q.includes('reduced') ? reduced : fine,
    requestAnimationFrame(fn) { const id = ++seq; frames.set(id, fn); return id }, cancelAnimationFrame(id) { frames.delete(id) } })
  const root = target({ dataset: {}, style: { setProperty: (k, v) => values.set(k, v) }, querySelector: () => modal })
  const motion = mountEnvironmentMotion(root, { window: win, document: doc })
  const point = (x = 1000, y = 700, other = {}) => win.emit('pointermove', { clientX: x, clientY: y, pointerType: 'mouse', ...other })
  const settle = () => { for (let i = 0; frames.size && i < 250; i++) { const next = [...frames.values()]; frames.clear(); now += 16; for (const fn of next) fn(now) } assert.equal(frames.size, 0, 'no perpetual JS RAF after the response settles') }
  return { win, doc, reduced, fine, root, frames, values, targets, motion, point, settle, modal(v) { modal = v } }
}

test('environment adapter requires explicit real DOM collaborators', () => {
  assert.throws(() => mountEnvironmentMotion(null, {}), TypeError)
})
test('mount is idle: CSS owns autonomous drift; no animation loop or audio state is created', () => {
  const t = setup(); assert.equal(t.frames.size, 0); assert.equal(t.root.dataset.environmentPaused, 'false'); t.motion.dispose()
})
test('pointer response is bounded, smoothed and stops scheduling when settled', () => {
  const t = setup(); t.point(100000, -100000); assert.equal(t.frames.size, 1); t.settle()
  assert.equal(t.values.get('--mvo-scene-x'), '10.000px'); assert.equal(t.values.get('--mvo-scene-y'), '-7.000px'); t.motion.dispose()
})
test('invalid coordinates and touch never schedule decorative pointer work', () => {
  const t = setup(); t.point(NaN); t.point(100, 100, { pointerType: 'touch' }); assert.equal(t.frames.size, 0); t.motion.dispose()
})
test('touch/unknown devices are ignored even on coarse-primary hardware; an actual secondary mouse works', () => {
  const t = setup(); t.fine.matches = false; t.point(200, 200, { pointerType: 'touch' }); t.point(200, 200, { pointerType: '' }); assert.equal(t.frames.size, 0); assert.equal(t.root.dataset.environmentPaused, 'false');
  t.point(); assert.equal(t.frames.size, 1); t.settle(); t.motion.dispose()
})
test('precise controls and modal content return parallax to neutral', () => {
  const t = setup(); t.point(); t.settle(); t.point(100, 100, { target: { closest: () => ({}) } }); t.settle(); assert.equal(t.values.get('--mvo-scene-x'), '0.000px')
  t.point(); t.settle(); t.modal(true); t.point(); t.settle(); assert.equal(t.values.get('--mvo-scene-y'), '0.000px'); t.motion.dispose()
})
test('reduced motion cancels pending RAF, clears offsets and freezes CSS; toggling back resumes in place', () => {
  const t = setup(); t.point(); t.reduced.matches = true; t.reduced.emit('change'); assert.equal(t.frames.size, 0); assert.equal(t.root.dataset.environmentPaused, 'true'); assert.equal(t.values.get('--mvo-scene-x'), '0.000px')
  t.point(); assert.equal(t.frames.size, 0); t.reduced.matches = false; t.reduced.emit('change'); assert.equal(t.root.dataset.environmentPaused, 'false'); t.point(); assert.equal(t.frames.size, 1); t.motion.dispose()
})
test('hidden documents freeze all CSS work and clear interaction frames, then resume without remount', () => {
  const t = setup(); t.point(); t.doc.hidden = true; t.doc.emit('visibilitychange'); assert.equal(t.frames.size, 0); assert.equal(t.root.dataset.environmentPaused, 'true')
  t.doc.hidden = false; t.doc.emit('visibilitychange'); assert.equal(t.root.dataset.environmentPaused, 'false'); t.motion.dispose()
})
test('blur and focus on controls clear pointer response without touching product controls', () => {
  const t = setup(); t.point(); t.settle(); t.win.emit('blur'); assert.equal(t.values.get('--mvo-scene-x'), '0.000px'); t.point(); t.settle(); t.root.emit('focusin'); t.settle(); assert.equal(t.values.get('--mvo-scene-x'), '0.000px'); t.motion.dispose()
})
test('dispose is idempotent and releases every listener and pending frame, suppressing later work', () => {
  const t = setup(); t.point(); t.motion.dispose(); t.motion.dispose(); assert.equal(t.frames.size, 0); assert.ok(t.targets.every(v => v.count() === 0)); assert.equal(t.root.dataset.environmentPaused, 'true'); t.point(); assert.equal(t.frames.size, 0)
})
