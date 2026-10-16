import { describe, expect, it } from 'vitest'
import { MAX_INSTRUMENTS } from './selection'

/**
 * The cap is the one number that bounds what a load can cost, so it is pinned
 * here rather than left to whatever the UI happens to render. The database
 * enforces the same number with a trigger; if these two disagree, one of them
 * is wrong and the user sees a confusing failure instead of a clear one.
 */
describe('instrument cap', () => {
  it('is five', () => {
    expect(MAX_INSTRUMENTS).toBe(5)
  })
})
