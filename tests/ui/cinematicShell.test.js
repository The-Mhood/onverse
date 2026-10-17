// Static boundary regressions complement (not replace) the actual production
// Chromium motion/dialog/audio checks in run-workbench-browser.mjs.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const view = read('src/ui/workbench/workspace.js');
const host = read('src/ui/workbench/workspace.css');
const environment = read('src/ui/presentation/rebuild/environment.css');
const primitives = read('src/ui/presentation/rebuild/workbench.css');
const tokens = read('src/ui/presentation/rebuild/tokens.css');

test('cinematic environment is non-interactive and layered, never an alternate app renderer', () => {
  assert.match(view, /class="environment" aria-hidden="true"/);
  for (const name of ['mvo-nebula-drift', 'mvo-horizon-drift', 'mvo-nearfield-drift']) {
    assert.match(environment, new RegExp('@keyframes ' + name));
  }
  assert.match(host, /@keyframes mvo-deep-space-drift/);
  assert.match(environment, /pointer-events:\s*none/);
  assert.doesNotMatch(environment + host, /(?:backdrop-filter|filter)\s*:\s*blur\(/);
  assert.doesNotMatch(environment, /(?:WebGLRenderer|requestAnimationFrame|setInterval)/);
});

test('all used presentation tokens resolve and waveform consumes the same canonical palette', () => {
  const css = tokens + environment + primitives + host;
  const declared = new Set([...css.matchAll(/(--mvo-[\w-]+)\s*:/g)].map(m => m[1]));
  const used = new Set([...css.matchAll(/var\((--mvo-[\w-]+)/g)].map(m => m[1]));
  assert.deepEqual([...used].filter(name => !declared.has(name)), []);
  assert.match(view, /getPropertyValue\("--mvo-accent-functional"\)/);
  assert.match(view, /getPropertyValue\("--mvo-color-amber"\)/);
  assert.doesNotMatch(host, /#[\da-f]{3,8}\b/i);
});

test('canonical 13-board hue anchors remain centralized, not a monochrome theme', () => {
  for (const [name, hex] of Object.entries({ abyss: '090d17', graphite: '171f2e', indigo: '384a81', violet: '8668b1', 'ion-teal': '47bfc0', glacier: '7cbdd8', amber: 'd9a66d', rose: 'c77d91' })) {
    assert.match(tokens.toLowerCase(), new RegExp(`--mvo-color-${name}:\\s*#${hex}`));
  }
});

test('real content identity drives panel entry, with cleanup instead of playback-tick animation', () => {
  assert.match(view, /s\.analysis && s\.analysis !== previousAnalysis/);
  assert.match(view, /s\.fixed && s\.fixed !== previousFixed/);
  assert.match(view, /previousAnalysis = s\.analysis; previousFixed = s\.fixed/);
  assert.match(view, /on\(root, "animationend"/);
  assert.match(view, /delete event\.target\.dataset\.viewPhase/);
  assert.doesNotMatch(view, /s\.playing[^\n]*reveal\(/);
});

test('native limits panel has real open/close actions, focusable title and modal shortcut guard', () => {
  assert.match(view, /<dialog class="capability-sheet" aria-labelledby="capability-title"/);
  assert.match(view, /id="capability-title" tabindex="-1" autofocus/);
  assert.match(view, /capabilities: \(\) => \{ buttons\.capabilities\.focus\(\{ preventScroll: true \}\); sheet\.showModal\(\)/);
  assert.match(view, /"close-capabilities": \(\) => sheet\.close\(\)/);
  assert.match(view, /if \(sheet\.open \|\| event\.target\.closest/);
  assert.match(view, /if \(sheet\.open\) sheet\.close\(\)/);
  assert.match(host, /display var\(--mvo-motion-panel\) allow-discrete/);
  assert.match(host, /@starting-style/);
});

test('reduced motion disables actual environment and panel motion; only materials are feathered', () => {
  assert.match(environment, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(host, /\.workspace-root > \.environment \{ animation: none !important; transform: none; will-change: auto/);
  assert.match(host, /\.capability-sheet, \.capability-sheet::backdrop \{ transition: none !important/);
  assert.match(view, /matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(host, /\.surface::before,[\s\S]*?mask-image:/);
  assert.match(host, /mask-composite: intersect/);
  assert.match(host, /@media \(prefers-reduced-transparency: reduce\)/);
});

test('original 01–13 references have a reproducible project source and hash inventory', () => {
  const source = JSON.parse(read('docs/design/REFERENCE_PACK_SOURCE.json'));
  assert.equal(source.ref, '900f07330f463d26bde0cc1d4bd731945c4fffec');
  const numbered = source.files.filter(f => /^\d\d-.*\.png$/.test(f.file));
  assert.equal(numbered.length, 13);
  assert.equal(new Set(numbered.map(f => f.file.slice(0, 2))).size, 13);
  for (const file of numbered) {
    assert.match(file.gitBlob, /^[0-9a-f]{40}$/);
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.ok(file.bytes > 1000000);
  }
});

test('independent celestial and near geometry is present, not a single moving wallpaper', () => {
  for (const name of ['stars', 'celestial', 'horizon', 'foreground']) assert.ok(view.includes(`scene-plane scene-${name}`));
  assert.match(environment, /position: fixed/);
  for (const name of ['celestial-plane', 'near-rocks-plane']) assert.ok(environment.includes(`${name}.webp?inline`));
  assert.doesNotMatch(environment, /url\([^\n]*first-person-cosmic-horizon/);
  assert.match(view, /environmentMotion\.dispose\(\)/);
});

test('region handles are wired to real crop operations and expose precise accessible state', () => {
  assert.match(view, /data-region-handle="in" role="slider" aria-label="Region start"/);
  assert.match(view, /data-region-handle="out" role="slider" aria-label="Region end"/);
  assert.match(view, /setPointerCapture\(event\.pointerId\)/);
  assert.match(view, /releasePointerCapture/);
  assert.match(view, /c\.setCrop\(which, value\)/);
  assert.match(view, /aria-valuenow/);
  assert.match(view, /event\.stopPropagation\(\)/);
});
