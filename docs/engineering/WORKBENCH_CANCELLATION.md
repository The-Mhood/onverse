# Workbench disposal and active audio work

This note describes the renderer controller's current disposal behavior. It is
not an active-work cancellation API, and no public cancel operation is added.

## Manual tweak rerender

`setTweak()` schedules a 400 ms debounce. `dispose()` clears a still-pending
timer. If `rerenderFixed()` has already entered `audio.masterFix()` or
`analysis.analyzeFast()`, disposal increments the internal tweak epoch. Late
progress callbacks, analysis results, state publication, and playback restart
are ignored; queued follow-up tweaks are discarded, and the active progress
indicator is dismissed. Tests cover both the queued and in-flight cases.

This is logical invalidation only. The processor does not accept an abort signal;
a started `OfflineAudioContext.startRendering()` and any synchronous work already
underway continue until the browser finishes them. Disposal closes the controller's
preview playback context, not the processor's offline render.

## Conversion

`runConvert()` awaits `audio.convert()` and normally publishes the result, starts
the download, and reports completion. If disposal occurs first, a private
conversion epoch suppresses the eventual result, download, error toast, and
post-disposal view updates. The conversion promise itself is not canceled and
receives no abort signal. The controller's busy state is released for disposal;
this is not evidence that the encoder or recorder stopped.

MP3 conversion lazily imports LAME and then performs its encoding loop
synchronously on the main thread. That loop cannot be preempted by a renderer
`pagehide` handler while it is running. Recorder-based AAC/Opus conversion uses a
separate `AudioContext` and `MediaRecorder`; it records the source, waits for its
duration plus 500 ms, then stops and closes that context. The controller has no
handle to stop that recorder on disposal. A late result can be discarded only if
disposal runs before the conversion promise resolves.

## Scope limits

No claim is made that active CPU/render/encode work stops immediately. Initial
Master Fix, import/decode, reference lookup, analysis, and crop operations do not
receive cancellation signals and are not covered by the private tweak/conversion
publication guards. Their cancellation semantics require separate design and
tests; do not infer cancellation from a closed preview context or a hidden UI.
