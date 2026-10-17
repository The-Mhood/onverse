import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8')
test('real entry composes one shared shell and one environment; destinations opt out of duplicated ownership', () => {
  const main = read('src/main.js')
  assert.equal((main.match(/const environment = mountEnvironmentMotion/g) || []).length, 1)
  assert.match(main, /manageEnvironment: false/); assert.match(main, /navigation: false/); assert.match(main, /lifecycle\.navigate\("opening"\)/)
  assert.match(main, /shell\.captureScroll\(\)/); assert.match(main, /event\.persisted/)
})
test('Sylune is one persistent truthful unavailable presentation, with no fake provider or execution', () => {
  const shell = read('src/ui/shell/applicationShell.js')
  assert.match(shell, /Not connected/); assert.match(shell, /static application help, not an AI response/)
  assert.doesNotMatch(shell, /fetch\(|localStorage|eval\(|new Function|setInterval/)
  assert.match(shell, /aria-expanded/); assert.match(shell, /events\.abort\(\)/); assert.match(shell, /cancelAnimationFrame/)
})
