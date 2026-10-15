import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { analysisService, createAnalysisService } from "../../src/application/analysis/analysisService.js"
import { analyze, analyzeFast } from "../../src/audio/analyzer.js"

const methods = ["analyze", "analyzeFast"]

function makeBuffer() {
  const sampleRate = 48000
  const length = sampleRate / 2
  const channels = [0, 1].map((channel) => Float32Array.from({ length }, (_, frame) => {
    const time = frame / sampleRate
    return 0.3 * Math.sin(2 * Math.PI * 440 * time + channel * 0.2)
      + 0.1 * Math.sin(2 * Math.PI * 80 * time)
  }))
  return Object.freeze({
    length,
    sampleRate,
    numberOfChannels: channels.length,
    getChannelData: (channel) => channels[channel],
  })
}

// Contract tests use controlled engines; parity tests below exercise the actual
// local analyzer. Neither set certifies the underlying measurement accuracy.
for (const method of methods) {
  describe(`analysis service contract: ${method}`, () => {
    it("forwards the exact buffer and callback and returns the engine result", async () => {
      const buffer = makeBuffer()
      const result = { bands: { bass: 2 }, lufs: -12 }
      const progress = []
      const onProgress = (fraction) => progress.push(fraction)
      let calls = 0
      const service = createAnalysisService({
        [method](receivedBuffer, receivedCallback) {
          calls++
          assert.equal(receivedBuffer, buffer)
          assert.equal(receivedCallback, onProgress)
          receivedCallback(0.25)
          receivedCallback(0.75)
          return Promise.resolve(result)
        },
      })

      const pending = service[method](buffer, onProgress)
      assert.ok(pending instanceof Promise)
      assert.equal(await pending, result)
      assert.equal(calls, 1)
      assert.deepEqual(progress, [0.25, 0.75])
    })

    it("allows an omitted progress callback without supplying a replacement", async () => {
      const buffer = makeBuffer()
      const result = { lufs: -12 }
      const service = createAnalysisService({
        [method](receivedBuffer, onProgress) {
          assert.equal(receivedBuffer, buffer)
          assert.equal(onProgress, undefined)
          return result
        },
      })
      assert.equal(await service[method](buffer), result)
    })

    it("propagates asynchronous rejection without changing the error", async () => {
      const failure = new Error("Analysis engine failed")
      const service = createAnalysisService({ [method]: () => Promise.reject(failure) })
      await assert.rejects(service[method](makeBuffer()), (error) => error === failure)
    })

    it("surfaces synchronous engine failures as promise rejections", async () => {
      const failure = new Error("PCM could not be read")
      const service = createAnalysisService({ [method]() { throw failure } })
      const pending = service[method](makeBuffer())
      assert.ok(pending instanceof Promise)
      await assert.rejects(pending, (error) => error === failure)
    })

    it("does not swallow errors thrown by progress callbacks", async () => {
      const failure = new Error("Progress consumer failed")
      const service = createAnalysisService({
        async [method](buffer, onProgress) { onProgress(0.5) },
      })
      await assert.rejects(
        service[method](makeBuffer(), () => { throw failure }),
        (error) => error === failure,
      )
    })

    it("keeps engine method receivers intact", async () => {
      const result = { lufs: -12 }
      const engine = {
        result,
        [method]() { return this.result },
      }
      assert.equal(await createAnalysisService(engine)[method](makeBuffer()), result)
    })

    it("keeps overlapping requests and progress callbacks independent", async () => {
      const pending = []
      const service = createAnalysisService({
        [method](buffer, onProgress) {
          return new Promise((resolve) => pending.push({ buffer, onProgress, resolve }))
        },
      })
      const firstBuffer = makeBuffer()
      const secondBuffer = makeBuffer()
      const firstProgress = []
      const secondProgress = []
      const first = service[method](firstBuffer, (value) => firstProgress.push(value))
      const second = service[method](secondBuffer, (value) => secondProgress.push(value))
      assert.equal(pending[0].buffer, firstBuffer)
      assert.equal(pending[1].buffer, secondBuffer)

      pending[1].onProgress(0.6)
      pending[0].onProgress(0.2)
      const secondResult = { lufs: -10 }
      const firstResult = { lufs: -16 }
      pending[1].resolve(secondResult)
      assert.equal(await second, secondResult)
      pending[0].resolve(firstResult)
      assert.equal(await first, firstResult)
      assert.deepEqual(firstProgress, [0.2])
      assert.deepEqual(secondProgress, [0.6])
    })
  })
}

describe("analysis service with the real local analyzer", () => {
  const directEngine = { analyze, analyzeFast }

  for (const method of methods) {
    it(`${method} preserves real results, progress, PCM, and buffer metadata`, async () => {
      const buffer = makeBuffer()
      const before = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel).slice())
      const directProgress = []
      const serviceProgress = []
      const directResult = await directEngine[method](buffer, (value) => directProgress.push(value))
      const serviceResult = await analysisService[method](buffer, (value) => serviceProgress.push(value))

      assert.deepEqual(serviceResult, directResult)
      assert.deepEqual(serviceProgress, directProgress)
      assert.ok(serviceProgress.length > 0)
      for (const value of serviceProgress) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1)
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        assert.deepEqual(buffer.getChannelData(channel), before[channel])
      }
      assert.equal(buffer.length, 24000)
      assert.equal(buffer.sampleRate, 48000)
      assert.equal(buffer.numberOfChannels, 2)
    })

    it(`${method} works without progress reporting`, async () => {
      const buffer = makeBuffer()
      assert.deepEqual(await analysisService[method](buffer), await directEngine[method](buffer))
    })

    it(`${method} preserves real PCM access errors`, async () => {
      const failure = new Error("Channel data unavailable")
      const buffer = { ...makeBuffer(), getChannelData() { throw failure } }
      await assert.rejects(analysisService[method](buffer), (error) => error === failure)
    })
  }

  it("dispatches full and fast requests to their respective engine methods", async () => {
    const calls = []
    const service = createAnalysisService({
      analyze(buffer) { calls.push(["full", buffer]); return "full result" },
      analyzeFast(buffer) { calls.push(["fast", buffer]); return "fast result" },
    })
    const buffer = makeBuffer()
    assert.equal(await service.analyze(buffer), "full result")
    assert.equal(await service.analyzeFast(buffer), "fast result")
    assert.deepEqual(calls, [["full", buffer], ["fast", buffer]])
  })
})
