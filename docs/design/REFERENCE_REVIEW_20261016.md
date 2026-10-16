# Full-pack review and applied color system — 2026-10-16

## Original source recovered, not guessed

The coordinator located the complete existing project reference pack on
`arena/e04204ac-onverse`, at pinned commit
`900f07330f463d26bde0cc1d4bd731945c4fffec`, under
`docs/design/musiconverse-visual-reference-pack/`. It was retrieved via the
GitHub blob API WITHOUT switching, merging or rewriting any branch. All sixteen
blobs (13 originals, overview/contact aid, manifest and guide; 33,442,231 bytes)
were verified against their Git object hashes and saved for inspection at
`/home/user/references/music-on-verse/`. The coordinator actually opened each
original numbered image01–13 individually, and read both supplied Markdown files.
The source manifest is committed as [REFERENCE_PACK_SOURCE.json](REFERENCE_PACK_SOURCE.json):
exact source paths, Git blob IDs, SHA-256 and sizes. Source images are already
available in the project; no duplicate33MB image import is necessary on this branch.

Example source link (substitute any inventory filename):
https://github.com/The-Mhood/onverse/blob/900f07330f463d26bde0cc1d4bd731945c4fffec/docs/design/musiconverse-visual-reference-pack/13-design-language-board.png

The original pack guide's broad04studio-composition recommendation is narrowed by
the owner's newer instruction: **13 shared system,02grounded first-person cosmic,
05/09 editing clarity,04 environment framing ONLY**. This is not permission to
copy a DAW window, create fake track/mixer/plugin/library controls, or pretend
SYLUNE execution exists. The two older, separately named concept-board files in
the pack's historical note were not recovered or compared; they are not01–13.

## Individual inspection and implementation mapping

| Original | Observed and retained | Not implied by this delivery |
|---|---|---|
| 01 cosmic moodboard | Four genuinely different worlds: mineral horizon, dusty ringed planet, violet/rose nebula, teal/amber clouds. Distant light and warm/cool relationships inform low-alpha layers, not a single purple wash. | Four selectable universes or new physical simulation. |
| 02 universe opening | Ground-level rocky foreground, immense distant planet/rim, quiet dark sky, restrained identity. P's local authored horizon art plus slow full-field drift gives a first-person environment behind real controls. | Exact pixel reproduction, a fake enter-studio button, warp movement or a separate launch renderer. |
| 03 studio arrival | Ring/particle paths and a cool-to-warm vanishing point suggest depth and continuity. Independent slow layers and native panel entry/exit retain that continuity at usable speed. | A cinematic game camera or rendered particle field. |
| 04 immersive studio | Environmental framing around a readable work plane only, as required by the owner. | The depicted multitrack arrangement, mixer, record/routing controls or screen-in-screen layout. |
| 05 arrangement | Familiar left-to-right source/ruler/signal hierarchy, stable playhead and aligned dense controls. These inform the single real waveform, transport and output hierarchy. | Tracks, bars/beats, snap or arrangement editing. This engine is one source. |
| 06 mixer | Neutral graphite, aligned numeric controls, restrained green/amber/red signal semantics. Keep semantic colors available and numbers neutral. | Decorative fake meters, bus topology, faders or channel strips. |
| 07 plugin | Clear units, neutral recessed materials, functional band/category colors and readable precision. Real manual offsets keep labels/units and existing engine behavior. | A plugin host, invented EQ graph, fabricated DSP or plugin window. |
| 08 SYLUNE | Teal/rose orbital identity, visibly suggested-versus-applied separation. Preserve the name and unimplemented capability boundary. | AI suggestions, generated plans, credentials/provider requests or execution. |
| 09 detailed editing | Waveform/grid contrast, explicit IN/OUT boundary, clear region and playhead. Real region inputs/export/crop use existing sample-boundary behavior. | Fake handles, fade curves, MIDI, extra lanes or undo. |
| 10 sound library | Mineral neutral list/material hierarchy and sparse warm selection. Source metadata stays scan-friendly. | A library, preset catalog, sounds, search or favorite actions. |
| 11 alternate studio | Cool ring/nebular illumination balanced by restrained amber. Supports the warm/cool light relationship in the actual shared environment. | A new alternate theme or the depicted arrangement/mixer. |
| 12 numbered overview | Checked as navigation/role inventory; originals, not this overview, were used for individual inspection. | A primary palette source. |
| 13 design language | Canonical eight hue anchors, neutral sans, tabular data, materially distinct environment/controls, explicit selected/disabled states, and data labels alongside color. | Copying unsupported illustrated controls or claiming automatic visual/contrast certification. |

## Palette families and applied semantic roles

P's [REFERENCE-PALETTE.md](../../src/ui/presentation/rebuild/REFERENCE-PALETTE.md)
provides the full family inventory and compatibility cautions from its earlier
inspection. The coordinator independently repeated ImageMagick sRGB quantization
on all thirteen originals (`-resize 240x135! -colors 10 -depth 8`); exact command,
bin counts and approximate colors are in
[REFERENCE_PALETTE_SAMPLES.json](REFERENCE_PALETTE_SAMPLES.json). Quantization is a
visual inventory, not pixel-exact extraction or a contrast/standards certificate.
04/12 were included for inspection/inventory, NOT used as palette authorities.

| Family | Approximate anchors / supporting samples | Source mapping and actual use |
|---|---|---|
| Abyss / graphite / mineral | `#090D17`, `#171F2E`;02`#090E17`,05`#222324`,06`#26292E`,07`#141E2D`,10`#21272A`,11`#202629` | 13canonical foundation,02depth,05/09control hierarchy. `--mvo-space-*`, `--mvo-surface-*`, `--mvo-panel-*`, neutral `--mvo-text-*`. Text remains clear, not haze-colored. |
| Indigo / violet | `#384A81`, `#8668B1`;01`#2A314E`,03`#2E3147`,07`#3B4F8D`,08`#2C3759` | 01/03/07/08/13. Low-alpha distant haze and a reusable harmony identity, NOT a saturated purple work surface or invented MIDI lane. |
| Ion / glacier / mineral blue | `#47BFC0`, `#7CBDD8`;02`#2C4965`,08`#2B4F67`,09`#439390` | 01/02/07–09/11/13. Actual functional action/selection/focus and original-A waveform use canonical Ion/Glacier. Dark supports stay in the environment/materials. |
| Amber / copper / dust | `#D9A66D`;01`#53343D`,02`#483937`,10`#4B4137`,11`#514327` | 01–03/10/11/13. Sparse warm light spill, warnings and processed-B waveform. A/B text and state are explicit; color is never its sole distinction. |
| Rose / dusk / ember | `#C77D91`;01`#5B5263`,03`#44363C`,08`#593B4E` | 01/03/08/10/13. Very low-alpha atmospheric depth; semantic texture/proposal tokens remain available but do not display fictitious assistant proposals. |
| Signal / category | Meter green `#75C76C`, record/peak `#AC4E41`, neutral `#9F9FB1`;13Amber/Glacier/Violet/Ion categories | 05–09/11/13. Central reusable semantic tokens only. This delivery draws an actual peak waveform; it does not invent live track meters or classify one mix as several tracks. |

All host-shell hard-coded palette values were replaced with shared semantic
tokens; the actual canvas reads those same tokens. The composited environment
moves on four independent212/212/158/116second transform/opacity timelines. P's
published six-file7e105a0 delta is preserved exactly; host integration lives in
`src/ui/workbench/**`. Real content identity—not playback ticks—triggers result,
manual-control, reference-form and region entry. The native limits dialog has
real enter/exit opacity/transform/display transitions and restores focus on close.

Panel background materials alone use linear alpha masks/gradient light falloff;
text, focus rings, waveforms and controls remain unmasked/sharp. No blur filter is
used. Reduced motion disables environment and panel motion; reduced transparency
uses solid materials, and forced-colors retains borders/focus. Actual runtime and
performance evidence belongs to the engineering delivery report, not this design
review. Exact reference fidelity and product-owner visual signoff remain distinct
from a working integrated interface.
