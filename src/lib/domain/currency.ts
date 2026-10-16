import Decimal from 'decimal.js'

/**
 * Currency conversion for display.
 *
 * The rule this module exists to protect: conversion changes how a figure is
 * SHOWN, never what was RECORDED. A trade's P&L is what the user entered. If a
 * portfolio total moved because a daily rate moved, the app would be quietly
 * rewriting history and the user would have no way to tell.
 *
 * So every function here takes an already-recorded amount and returns a
 * display value. Nothing here writes, and nothing here recomputes a trade
 * result.
 *
 * All arithmetic goes through decimal.js. Money is never a float.
 */

/** Currencies the app will convert between. Kept small and deliberate. */
export const DISPLAY_CURRENCIES = ['IDR', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'AUD'] as const
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]

export const DEFAULT_DISPLAY_CURRENCY: DisplayCurrency = 'IDR'

export function isDisplayCurrency(value: unknown): value is DisplayCurrency {
  return typeof value === 'string' && (DISPLAY_CURRENCIES as readonly string[]).includes(value)
}

/** Decimal places a currency is conventionally shown with. */
const MINOR_UNITS: Record<string, number> = {
  IDR: 0,
  JPY: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  SGD: 2,
  AUD: 2,
}

export function minorUnits(currency: string): number {
  return MINOR_UNITS[currency] ?? 2
}

export type RateLookup = {
  /** Rate for one unit of `base` expressed in `quote`. */
  rate: string
  /** The rate's effective date, which is what must be shown alongside it. */
  rateDate: string
}

/** Key used to store and look up a pair. Direction is significant. */
export function pairKey(base: string, quote: string): string {
  return `${base.toUpperCase()}:${quote.toUpperCase()}`
}

/**
 * Resolves a conversion, including the inverse case.
 *
 * Rates are stored in one direction, but a portfolio may need the other. Rather
 * than storing both directions and risking them disagreeing, the inverse is
 * derived here from the stored rate.
 */
export function resolveRate(
  rates: Map<string, RateLookup>,
  from: string,
  to: string,
): RateLookup | null {
  const source = from.toUpperCase()
  const target = to.toUpperCase()

  if (source === target) {
    return { rate: '1', rateDate: '' }
  }

  const direct = rates.get(pairKey(source, target))
  if (direct) return direct

  const inverse = rates.get(pairKey(target, source))
  if (inverse) {
    const value = new Decimal(inverse.rate)
    if (value.isZero()) return null
    return { rate: new Decimal(1).div(value).toString(), rateDate: inverse.rateDate }
  }

  return null
}

export type ConvertedAmount = {
  /** The converted value, as a string. Never a float. */
  amount: string
  /** Currency it was converted from. */
  from: string
  /** Currency it is shown in. */
  to: string
  /** Rate applied, so the number can be checked rather than trusted. */
  rate: string
  /** The rate's effective date, not the date of the request. */
  rateDate: string
}

/**
 * Converts an amount for display. Returns null when no rate is available, so a
 * caller renders an unavailable state instead of an unconverted number wearing
 * the wrong currency symbol.
 */
export function convertForDisplay(
  amount: string,
  from: string,
  to: string,
  rates: Map<string, RateLookup>,
): ConvertedAmount | null {
  const source = from.toUpperCase()
  const target = to.toUpperCase()

  const lookup = resolveRate(rates, source, target)
  if (!lookup) return null

  try {
    const converted = new Decimal(amount).times(new Decimal(lookup.rate))
    return {
      amount: converted.toFixed(minorUnits(target)),
      from: source,
      to: target,
      rate: lookup.rate,
      rateDate: lookup.rateDate,
    }
  } catch {
    return null
  }
}

export type PortfolioTotal = {
  total: string
  currency: string
  /** True when every input converted, so the total is trustworthy. */
  complete: boolean
  /** Currencies that could not be converted, so the shortfall is visible. */
  missing: string[]
  /** Distinct rate dates used. More than one means the total mixes dates. */
  rateDates: string[]
}

/**
 * Sums amounts recorded in different currencies for display in one.
 *
 * Partial conversion is reported rather than hidden. A total that silently
 * omits the amounts it could not convert is worse than one that says so: the
 * user would read it as complete.
 */
export function sumForDisplay(
  amounts: { amount: string; currency: string }[],
  target: string,
  rates: Map<string, RateLookup>,
): PortfolioTotal {
  const currency = target.toUpperCase()
  let total = new Decimal(0)
  const missing = new Set<string>()
  const rateDates = new Set<string>()

  for (const entry of amounts) {
    const converted = convertForDisplay(entry.amount, entry.currency, currency, rates)
    if (!converted) {
      missing.add(entry.currency.toUpperCase())
      continue
    }
    total = total.plus(new Decimal(converted.amount))
    if (converted.rateDate) rateDates.add(converted.rateDate)
  }

  return {
    total: total.toFixed(minorUnits(currency)),
    currency,
    complete: missing.size === 0,
    missing: [...missing].sort(),
    rateDates: [...rateDates].sort(),
  }
}
