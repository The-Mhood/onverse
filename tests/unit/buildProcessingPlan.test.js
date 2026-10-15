import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildProcessingPlan } from "../../src/domain/processors/buildProcessingPlan.js"

const bandKeys = Object.freeze(["sub", "bass", "low", "mid", "high", "presence", "air"])
const adjustments = (overrides = {}) => ({
  trimDb: 0,
  gluePct: 100,
  width: 0,
  ...overrides,
  band: Object.fromEntries(bandKeys.map((key) => [key, overrides.band?.[key] ?? 0])),
})

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

function closeTo(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} should be close to ${expected}`)
}

describe("buildProcessingPlan — existing controller behavior", () => {
  it("returns null for a missing base plan without reading adjustments", () => {
    assert.equal(buildProcessingPlan(null), null)
    assert.equal(buildProcessingPlan(undefined), null)
  })

  it("preserves a full automatic plan with neutral adjustments", () => {
    const base = {
      targetLufs: -12,
      gain: 1.5,
      compress: { ratio: 2, threshold: -20 },
      eq: [{ k: "bass", gain: -2 }],
      width: 2,
      highpass: 26,
      dehiss: -2,
      ceiling: -1,
      retune: -18,
      dc: true,
    }
    const result = buildProcessingPlan(base, adjustments(), bandKeys)
    assert.deepEqual(result, base)
    assert.notEqual(result, base)
    assert.notEqual(result.eq, base.eq)
    assert.notEqual(result.compress, base.compress)
  })

  it("adds an empty EQ list to a plan with no EQ", () => {
    assert.deepEqual(buildProcessingPlan({}, adjustments(), bandKeys), { eq: [] })
  })

  it("offsets a loudness target instead of changing linear gain", () => {
    const result = buildProcessingPlan({ targetLufs: -12, gain: 2 }, adjustments({ trimDb: 3 }), bandKeys)
    assert.equal(result.targetLufs, -9)
    assert.equal(result.gain, 2)
  })

  it("treats a zero loudness target as present", () => {
    const result = buildProcessingPlan({ targetLufs: 0, gain: 2 }, adjustments({ trimDb: -3 }), bandKeys)
    assert.equal(result.targetLufs, -3)
    assert.equal(result.gain, 2)
  })

  it("converts trim decibels to linear gain when no loudness target exists", () => {
    const result = buildProcessingPlan({ gain: 2 }, adjustments({ trimDb: 6 }), bandKeys)
    closeTo(result.gain, 2 * Math.pow(10, 6 / 20))
    assert.equal(Object.hasOwn(result, "targetLufs"), false)
  })

  it("uses linear gain for a null loudness target and preserves the null", () => {
    const result = buildProcessingPlan({ targetLufs: null }, adjustments({ trimDb: -6 }), bandKeys)
    closeTo(result.gain, Math.pow(10, -6 / 20))
    assert.equal(result.targetLufs, null)
  })

  it("preserves the legacy unity fallback for missing or zero gain when trimming", () => {
    for (const base of [{}, { gain: 0 }]) {
      const result = buildProcessingPlan(base, adjustments({ trimDb: 3 }), bandKeys)
      closeTo(result.gain, Math.pow(10, 3 / 20))
    }
  })

  it("does not introduce or replace gain when trim is neutral", () => {
    assert.equal(Object.hasOwn(buildProcessingPlan({}, adjustments(), bandKeys), "gain"), false)
    assert.equal(buildProcessingPlan({ gain: 0 }, adjustments(), bandKeys).gain, 0)
  })

  it("clamps adjusted linear gain to the existing 0.1–10 limits", () => {
    assert.equal(buildProcessingPlan({ gain: 9 }, adjustments({ trimDb: 6 }), bandKeys).gain, 10)
    assert.equal(buildProcessingPlan({ gain: 0.11 }, adjustments({ trimDb: -6 }), bandKeys).gain, 0.1)
  })

  it("scales compression distance from unity without changing the threshold", () => {
    const base = { compress: { ratio: 3, threshold: -22 } }
    for (const [gluePct, expected] of [[0, 1], [50, 2], [100, 3], [200, 5]]) {
      assert.deepEqual(
        buildProcessingPlan(base, adjustments({ gluePct }), bandKeys).compress,
        { ratio: expected, threshold: -22 },
      )
    }
  })

  it("retains the existing compression ratio floor", () => {
    assert.equal(
      buildProcessingPlan({ compress: { ratio: 0.5, threshold: -20 } }, adjustments(), bandKeys).compress.ratio,
      1,
    )
  })

  it("does not add compression when the automatic plan has none", () => {
    assert.equal(Object.hasOwn(buildProcessingPlan({}, adjustments({ gluePct: 200 }), bandKeys), "compress"), false)
  })

  it("combines existing EQ gains with offsets and clamps adjusted bands", () => {
    const base = { eq: [{ k: "bass", gain: 8 }, { k: "high", gain: -8 }, { k: "air", gain: 2 }] }
    assert.deepEqual(
      buildProcessingPlan(base, adjustments({ band: { bass: 3, high: -3 } }), bandKeys).eq,
      [{ k: "bass", gain: 9 }, { k: "high", gain: -9 }, { k: "air", gain: 2 }],
    )
  })

  it("adds only nonzero new bands in caller-supplied order", () => {
    const result = buildProcessingPlan({}, adjustments({ band: { air: 2, bass: -1 } }), bandKeys)
    assert.deepEqual(result.eq, [{ k: "bass", gain: -1 }, { k: "air", gain: 2 }])
  })

  it("retains an existing EQ entry when its adjusted gain becomes zero", () => {
    assert.deepEqual(
      buildProcessingPlan({ eq: [{ k: "mid", gain: 2 }] }, adjustments({ band: { mid: -2 } }), bandKeys).eq,
      [{ k: "mid", gain: 0 }],
    )
  })

  it("keeps existing EQ order and the last value of duplicate bands", () => {
    const base = { eq: [{ k: "air", gain: 1 }, { k: "bass", gain: 2 }, { k: "air", gain: 3 }] }
    assert.deepEqual(
      buildProcessingPlan(base, adjustments(), bandKeys).eq,
      [{ k: "air", gain: 3 }, { k: "bass", gain: 2 }],
    )
  })

  it("uses only caller-supplied bands for manual offsets, without validating the base chain", () => {
    const result = buildProcessingPlan(
      { eq: [{ k: "air", gain: 2 }] },
      adjustments({ band: { air: 4, bass: 1 } }),
      ["bass"],
    )
    assert.deepEqual(result.eq, [{ k: "air", gain: 2 }, { k: "bass", gain: 1 }])
  })

  it("offsets existing stereo width and clamps it to −6–6 dB", () => {
    assert.equal(buildProcessingPlan({ width: 2 }, adjustments({ width: 1 }), bandKeys).width, 3)
    assert.equal(buildProcessingPlan({ width: 5 }, adjustments({ width: 4 }), bandKeys).width, 6)
    assert.equal(buildProcessingPlan({ width: -5 }, adjustments({ width: -4 }), bandKeys).width, -6)
  })

  it("treats zero width as an existing width setting", () => {
    assert.equal(buildProcessingPlan({ width: 0 }, adjustments({ width: 2 }), bandKeys).width, 2)
  })

  it("adds width only for a nonzero offset when there is no base width", () => {
    assert.equal(Object.hasOwn(buildProcessingPlan({}, adjustments(), bandKeys), "width"), false)
    assert.equal(buildProcessingPlan({}, adjustments({ width: -2 }), bandKeys).width, -2)
    assert.equal(buildProcessingPlan({ width: null }, adjustments(), bandKeys).width, null)
  })

  it("combines all supported manual controls in a single plan", () => {
    const base = {
      targetLufs: -12, gain: 2, compress: { ratio: 3, threshold: -20 },
      eq: [{ k: "bass", gain: -2 }], width: 1, ceiling: -1.5,
    }
    assert.deepEqual(
      buildProcessingPlan(base, adjustments({
        trimDb: -1, gluePct: 50, band: { bass: 1, air: -2 }, width: 2,
      }), bandKeys),
      {
        targetLufs: -13, gain: 2, compress: { ratio: 2, threshold: -20 },
        eq: [{ k: "bass", gain: -1 }, { k: "air", gain: -2 }], width: 3, ceiling: -1.5,
      },
    )
  })

  it("accepts frozen inputs and returns independently mutable nested data", () => {
    const base = deepFreeze({
      targetLufs: -12, compress: { ratio: 2, threshold: -20 },
      eq: [{ k: "bass", gain: -2 }], metadata: { labels: ["automatic"] },
    })
    const tweaks = deepFreeze(adjustments({ band: { bass: 1 } }))
    const result = buildProcessingPlan(base, tweaks, bandKeys)
    result.eq[0].gain = 9
    result.compress.threshold = -10
    result.metadata.labels.push("custom")
    assert.equal(base.eq[0].gain, -2)
    assert.equal(base.compress.threshold, -20)
    assert.deepEqual(base.metadata.labels, ["automatic"])
    assert.equal(tweaks.band.bass, 1)
  })

  it("is repeatable without accumulating offsets or sharing output objects", () => {
    const base = { targetLufs: -12, eq: [{ k: "bass", gain: 1 }] }
    const tweaks = adjustments({ trimDb: 1, band: { bass: 2 } })
    const first = buildProcessingPlan(base, tweaks, bandKeys)
    const second = buildProcessingPlan(base, tweaks, bandKeys)
    assert.deepEqual(first, second)
    assert.equal(second.targetLufs, -11)
    assert.equal(second.eq[0].gain, 3)
    first.eq[0].gain = 8
    assert.equal(second.eq[0].gain, 3)
  })
})
