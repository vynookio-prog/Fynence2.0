import { describe, expect, it } from 'vitest'
import { FREE_TIER, checkBudget } from './ingest'

/**
 * The budget check is the one part of ingestion that is pure, so it is the one
 * part that can be pinned exactly. It matters because the free plan is 8
 * credits/minute and every call costs at least one: a check that is merely
 * "close enough" produces a 429, and a 429 is not a normal condition to design
 * around.
 */

describe('checkBudget', () => {
  it('allows a fetch with the full quota unused', () => {
    const result = checkBudget({ usedThisMinute: 0, usedToday: 0 }, 1)

    expect(result.allowed).toBe(true)
    if (result.allowed) {
      expect(result.remainingThisMinute).toBe(FREE_TIER.creditsPerMinute - 1)
      expect(result.remainingToday).toBe(FREE_TIER.creditsPerDay - 1)
    }
  })

  it('refuses when the per-minute limit is exactly reached', () => {
    const result = checkBudget({ usedThisMinute: FREE_TIER.creditsPerMinute, usedToday: 8 }, 1)

    expect(result.allowed).toBe(false)
    // The message must name the per-minute limit, not the daily one, or the
    // user waits until tomorrow for a problem that clears in a moment.
    if (!result.allowed) expect(result.reason).toContain('per menit')
  })

  it('refuses when the request would exceed the per-minute limit', () => {
    const result = checkBudget({ usedThisMinute: FREE_TIER.creditsPerMinute - 1, usedToday: 100 }, 5)

    expect(result.allowed).toBe(false)
  })

  it('allows the last affordable request', () => {
    const result = checkBudget({ usedThisMinute: FREE_TIER.creditsPerMinute - 1, usedToday: 100 }, 1)

    expect(result.allowed).toBe(true)
  })

  it('refuses a daily exhaustion and names the daily limit', () => {
    const result = checkBudget({ usedThisMinute: 0, usedToday: FREE_TIER.creditsPerDay }, 1)

    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.reason).toContain('harian')
  })

  it('treats the daily limit as binding even when the minute is clear', () => {
    const result = checkBudget({ usedThisMinute: 0, usedToday: FREE_TIER.creditsPerDay - 1 }, 2)

    expect(result.allowed).toBe(false)
    if (!result.allowed) expect(result.reason).toContain('harian')
  })

  it('does not report negative headroom when over budget', () => {
    // Tracking lag can make the log read higher than the true spend. The
    // answer must still be a refusal, not a negative allowance.
    const result = checkBudget({ usedThisMinute: 20, usedToday: 20 }, 1)

    expect(result.allowed).toBe(false)
  })

  it('uses the published free-tier limits, not invented ones', () => {
    expect(FREE_TIER.creditsPerMinute).toBe(8)
    expect(FREE_TIER.creditsPerDay).toBe(800)
  })
})
