import { analyze, analyzeFast } from "../../audio/analyzer.js"

/**
 * @typedef {Object} AnalysisBuffer
 * @property {number} length Number of PCM frames per channel.
 * @property {number} sampleRate Frames per second.
 * @property {number} numberOfChannels
 * @property {(channel: number) => Float32Array} getChannelData
 */

/**
 * Application boundary for full analysis and fast post-render measurement.
 *
 * The default engine is the existing local analyzer. Keeping it behind this
 * interface lets callers depend on an analysis service rather than a concrete
 * execution mechanism. It does not move work off the main thread, introduce
 * cancellation, validate measurements, or change the engine's result shapes.
 *
 * Buffers and optional progress callbacks are forwarded unchanged. The service
 * keeps no session state, does not mutate inputs, and propagates failures without
 * wrapping them. Engines implementing this contract must also treat PCM as
 * read-only. Progress remains engine-defined; it is not normalized here.
 *
 * @param {{ analyze: typeof analyze, analyzeFast: typeof analyzeFast }} [engine]
 */
export function createAnalysisService(engine = { analyze, analyzeFast }) {
  return {
    /**
     * @param {AnalysisBuffer} buffer
     * @param {(fraction: number) => void} [onProgress]
     */
    async analyze(buffer, onProgress) {
      return engine.analyze(buffer, onProgress)
    },

    /**
     * @param {AnalysisBuffer} buffer
     * @param {(fraction: number) => void} [onProgress]
     */
    async analyzeFast(buffer, onProgress) {
      return engine.analyzeFast(buffer, onProgress)
    },
  }
}

export const analysisService = createAnalysisService()
