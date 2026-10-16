import { TradeForm } from '@/components/trade-form'
import { listAccounts } from '@/lib/accounts/query'

export const dynamic = 'force-dynamic'

export default async function NewTradePage() {
  const now = new Date().toISOString().slice(0, 16)
  const accounts = await listAccounts()

  return (
    <TradeForm
      mode="create"
      accounts={accounts}
      values={{
        account_id: accounts[0]?.id ?? '',
        symbol: '', direction: 'long', status: 'closed', opened_at: now, closed_at: now,
        entry_price: '', exit_price: '', size: '', fees: '0', realized_pnl: '',
        setup: '', timeframe: '', stop_loss: '', take_profit: '', exit_reason: '',
        notes: '', setup_grade: '', execution_quality: '', plan_adherence: '', emotion: '',
      }}
    />
  )
}
