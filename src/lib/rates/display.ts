import { getInsForgeServerClient } from '@/lib/insforge/server'
import { DEFAULT_DISPLAY_CURRENCY, isDisplayCurrency, type DisplayCurrency } from '@/lib/domain/currency'

/**
 * The signed-in user's chosen display currency.
 *
 * Falls back to the default rather than failing: a missing preference should
 * show a total in the default currency, not break the page.
 */
export async function displayCurrency(): Promise<DisplayCurrency> {
  const client = await getInsForgeServerClient()
  const { data: userData } = await client.auth.getCurrentUser()
  if (!userData?.user) return DEFAULT_DISPLAY_CURRENCY

  const { data } = await client.database
    .from('profiles')
    .select('display_currency')
    .eq('id', userData.user.id)
    .limit(1)

  const stored = (data?.[0] as { display_currency?: string | null } | undefined)?.display_currency
  return isDisplayCurrency(stored) ? stored : DEFAULT_DISPLAY_CURRENCY
}
