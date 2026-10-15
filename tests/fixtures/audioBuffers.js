/**
 * Deterministic PCM fixtures for Node audio tests. No browser decoder, device,
 * randomness, user media, or filesystem asset is involved. The returned object
 * implements only the read interface needed by the real local analyzer.
 */
export function createPcmBuffer(channels, sampleRate = 48000) {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
    throw new RangeError("Fixture sample rate must be a positive integer")
  }
  if (!Array.isArray(channels) || channels.length === 0) {
    throw new TypeError("Fixture must contain at least one channel")
  }
  const length = channels[0].length
  if (!Number.isInteger(length) || length <= 0 || channels.some((channel) => channel.length !== length)) {
    throw new RangeError("Fixture channels must have equal, nonzero lengths")
  }
  const pcm = channels.map((channel) => Float32Array.from(channel))
  return Object.freeze({
    length,
    sampleRate,
    duration: length / sampleRate,
    numberOfChannels: pcm.length,
    getChannelData(channel) {
      if (!Number.isInteger(channel) || channel < 0 || channel >= pcm.length) {
        throw new RangeError("Fixture channel does not exist")
      }
      return pcm[channel]
    },
  })
}

/** A sample-aligned 1 kHz tone at 48 kHz reaches its declared amplitude exactly. */
export function createToneBuffer({
  length = 24000,
  sampleRate = 48000,
  frequencyHz = 1000,
  amplitude = 0.5,
  channelGains = [1, 1],
} = {}) {
  const tone = Float32Array.from({ length }, (_, frame) =>
    amplitude * Math.sin(2 * Math.PI * frequencyHz * frame / sampleRate))
  return createPcmBuffer(channelGains.map((gain) => tone.map((sample) => sample * gain)), sampleRate)
}
