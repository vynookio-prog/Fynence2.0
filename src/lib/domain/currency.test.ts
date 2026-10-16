import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DISPLAY_CURRENCY,
  convertForDisplay,
  isDisplayCurrency,
  minorUnits,
  pairKey,
  resolveRate,
  sumForDisplay,
  type RateLookup,
} from './currency'

const rates = (entries: [string, string, string?][]): Map<string, RateLookup> =>
  new Map(entries.map(([pair, rate, date]) => {
    const [base, quote] = pair.split(':')
    return [pairKey(base, quote), { rate, rateDate: date ?? '2026-10-16' }]
  }))

describe('resolveRate', () => {
  it('returns identity for the same currency without needing a stored rate', () => {
    const found = resolveRate(new Map(), 'USD', 'USD')
    expect(found?.rate).toBe('1')
  })

  it('uses a direct rate when stored in the needed direction', () => {
    const found = resolveRate(rates([['USD:IDR', '17967']]), 'USD', 'IDR')
    expect(found?.rate).toBe('17967')
  })

  it('derives the inverse when only the opposite direction is stored', () => {
    // Stored USD->IDR, asked for IDR->USD.
    const found = resolveRate(rates([['USD:IDR', '17967']]), 'IDR', 'USD')
    expect(Number(found!.rate)).toBeCloseTo(1 / 17967, 12)
  })

  it('prefers a direct rate over inverting an inverse one', () => {
    const table = rates([['USD:IDR', '17967'], ['IDR:USD', '0.0000556']])
    const found = resolveRate(table, 'USD', 'IDR')
    // Direct must win, or the two stored rates could disagree silently.
    expect(found?.rate).toBe('17967')
  })

  it('returns null when neither direction exists', () => {
    expect(resolveRate(rates([['USD:EUR', '0.89']]), 'USD', 'IDR')).toBeNull()
  })

  it('refuses to invert a zero rate rather than producing Infinity', () => {
    expect(resolveRate(rates([['USD:IDR', '0']]), 'IDR', 'USD')).toBeNull()
  })

  it('carries the rate date through an inversion', () => {
    const found = resolveRate(rates([['USD:IDR', '17967', '2026-10-15']]), 'IDR', 'USD')
    expect(found?.rateDate).toBe('2026-10-15')
  })
})

describe('convertForDisplay', () => {
  it('converts without losing precision on large amounts', () => {
    const result = convertForDisplay('1234567.89', 'USD', 'IDR', rates([['USD:IDR', '17967']]))
    // 1234567.89 * 17967 = 22181481279.63 exactly, shown at zero decimals for IDR.
    expect(result?.amount).toBe('22181481280')
    expect(result?.from).toBe('USD')
    expect(result?.to).toBe('IDR')
  })

  it('respects each currency minor units', () => {
    // IDR and JPY have no decimals; USD has two.
    expect(convertForDisplay('100', 'IDR', 'IDR', new Map())?.amount).toBe('100')
    expect(minorUnits('IDR')).toBe(0)
    expect(minorUnits('JPY')).toBe(0)
    expect(minorUnits('USD')).toBe(2)
    expect(minorUnits('XYZ')).toBe(2)
  })

  it('returns null instead of an unconverted number when no rate exists', () => {
    // This is the important one: a missing rate must not produce a number that
    // then gets shown with the wrong currency symbol.
    expect(convertForDisplay('100', 'USD', 'IDR', new Map())).toBeNull()
  })

  it('returns null for an unparseable amount rather than NaN', () => {
    expect(convertForDisplay('abc', 'USD', 'IDR', rates([['USD:IDR', '17967']]))).toBeNull()
  })

  it('exposes the rate and its date so the figure can be checked', () => {
    const result = convertForDisplay('10', 'USD', 'IDR', rates([['USD:IDR', '17967', '2026-10-14']]))
    expect(result?.rate).toBe('17967')
    expect(result?.rateDate).toBe('2026-10-14')
  })

  it('handles a negative amount, which is how a loss appears', () => {
    const result = convertForDisplay('-500', 'USD', 'IDR', rates([['USD:IDR', '17967']]))
    expect(result?.amount).toBe('-8983500')
  })
})

describe('sumForDisplay', () => {
  it('sums a single-currency portfolio exactly', () => {
    const total = sumForDisplay(
      [{ amount: '100.50', currency: 'USD' }, { amount: '200.25', currency: 'USD' }],
      'USD',
      new Map(),
    )
    expect(total.total).toBe('300.75')
    expect(total.complete).toBe(true)
  })

  it('converts mixed currencies into one display total', () => {
    const total = sumForDisplay(
      [{ amount: '100', currency: 'USD' }, { amount: '89089', currency: 'EUR' }],
      'IDR',
      rates([['USD:IDR', '17967'], ['EUR:IDR', '20168']]),
    )
    // 100*17967 + 89089*20168 ... EUR amount converted directly.
    expect(total.total).toBe(String(100 * 17967 + 89089 * 20168))
    expect(total.complete).toBe(true)
  })

  it('reports a partial total rather than hiding what it could not convert', () => {
    const total = sumForDisplay(
      [{ amount: '100', currency: 'USD' }, { amount: '50', currency: 'GBP' }],
      'USD',
      rates([['USD:USD', '1']]),
    )
    expect(total.complete).toBe(false)
    expect(total.missing).toEqual(['GBP'])
    // The USD part still counts; the missing part is declared, not swallowed.
    expect(total.total).toBe('100.00')
  })

  it('lists every currency it could not convert', () => {
    const total = sumForDisplay(
      [{ amount: '1', currency: 'GBP' }, { amount: '1', currency: 'JPY' }, { amount: '1', currency: 'CHF' }],
      'USD',
      new Map(),
    )
    expect(total.missing).toEqual(['CHF', 'GBP', 'JPY'])
  })

  it('reports the distinct rate dates used, so a mixed-date total is visible', () => {
    const total = sumForDisplay(
      [{ amount: '1', currency: 'USD' }, { amount: '1', currency: 'EUR' }],
      'IDR',
      rates([['USD:IDR', '17967', '2026-10-16'], ['EUR:IDR', '20168', '2026-10-15']]),
    )
    expect(total.rateDates).toEqual(['2026-10-15', '2026-10-16'])
  })

  it('handles an empty portfolio without inventing a figure', () => {
    const total = sumForDisplay([], 'IDR', new Map())
    expect(total.total).toBe('0')
    expect(total.complete).toBe(true)
  })

  it('does not accumulate float error across many entries', () => {
    const many = Array.from({ length: 100 }, () => ({ amount: '0.10', currency: 'USD' }))
    const total = sumForDisplay(many, 'USD', new Map())
    // Float arithmetic gives 9.99999999999998 here.
    expect(total.total).toBe('10.00')
  })
})

describe('display currency', () => {
  it('defaults to IDR', () => {
    expect(DEFAULT_DISPLAY_CURRENCY).toBe('IDR')
  })

  it('accepts known codes only', () => {
    expect(isDisplayCurrency('USD')).toBe(true)
    expect(isDisplayCurrency('usd')).toBe(false)
    expect(isDisplayCurrency('XYZ')).toBe(false)
    expect(isDisplayCurrency(null)).toBe(false)
    expect(isDisplayCurrency(123)).toBe(false)
  })
})
