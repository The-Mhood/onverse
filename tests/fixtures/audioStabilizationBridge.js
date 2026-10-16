// Test-only entry for native Chromium OfflineAudioContext probes, never imported
// by the application. Exposes the actual modules, not a second DSP implementation.
export { analyze, analyzeFast, quickLufs, buildFixPlan, targetFromFeatures } from '../../src/audio/analyzer.js';
export { masterFix, encodeWav, encodeViaRecorder } from '../../src/audio/processor.js';
export { createWorkbenchController } from '../../src/application/workbench/workbenchController.js';
