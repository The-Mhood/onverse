const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/**
 * @typedef {{ k: string, gain: number }} EqAdjustment
 * @typedef {Object} ProcessingPlan
 * @property {number | null} [targetLufs]
 * @property {number} [gain] Linear gain, not decibels.
 * @property {{ ratio: number, threshold: number }} [compress]
 * @property {EqAdjustment[]} [eq]
 * @property {number | null} [width] Side-signal gain in decibels.
 *
 * @typedef {Object} ProcessingAdjustments
 * @property {number} trimDb Offset from the automatic loudness target.
 * @property {number} gluePct Compression strength; 100 preserves the automatic ratio.
 * @property {Record<string, number>} band EQ gain offsets in decibels.
 * @property {number} width Side-signal gain offset in decibels.
 */

/**
 * Combine an automatic plan with the current manual adjustments without
 * mutating either input. Band keys come from the caller so this domain helper
 * does not depend on the audio taxonomy, the UI, or application state.
 *
 * Preserves the controller's existing plan-building behavior, including JSON
 * copying of the base plan and pass-through processing fields. Inputs must be
 * JSON-compatible plans and finite adjustments from the existing controls.
 * This is not a validator for imported plans or model-generated commands.
 *
 * @param {ProcessingPlan | null | undefined} base
 * @param {ProcessingAdjustments} adjustments
 * @param {readonly string[]} bandKeys Supported manual EQ bands, in display order.
 * @returns {ProcessingPlan | null}
 */
export function buildProcessingPlan(base, adjustments, bandKeys) {
  if (!base) return null
  const plan = JSON.parse(JSON.stringify(base))

  if (plan.targetLufs != null) plan.targetLufs = base.targetLufs + adjustments.trimDb
  else if (adjustments.trimDb) {
    plan.gain = clamp((plan.gain || 1) * Math.pow(10, adjustments.trimDb / 20), 0.1, 10)
  }

  if (plan.compress) {
    const strength = adjustments.gluePct / 100
    plan.compress = {
      ...plan.compress,
      ratio: Math.max(1, 1 + (plan.compress.ratio - 1) * strength),
    }
  }

  const eq = new Map()
  for (const entry of base.eq || []) eq.set(entry.k, entry.gain)
  for (const key of bandKeys) {
    const offset = adjustments.band[key] || 0
    if (offset) eq.set(key, clamp((eq.get(key) || 0) + offset, -9, 9))
  }
  plan.eq = [...eq.entries()].map(([k, gain]) => ({ k, gain }))

  if (base.width != null) plan.width = clamp(base.width + adjustments.width, -6, 6)
  else if (adjustments.width) plan.width = adjustments.width

  return plan
}
