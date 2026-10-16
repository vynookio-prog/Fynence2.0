import { TradeForm } from '@/components/trade-form'

export const dynamic = 'force-dynamic'

export default function NewTradePage() {
  const now = new Date().toISOString().slice(0, 16)
  return (
    <TradeForm
      mode="create"
      values={{
        symbol: '', direction: 'long', status: 'closed', opened_at: now, closed_at: now,
        entry_price: '', exit_price: '', size: '', fees: '0', realized_pnl: '',
        setup: '', timeframe: '', stop_loss: '', take_profit: '', exit_reason: '',
        notes: '', setup_grade: '', execution_quality: '', plan_adherence: '', emotion: '',
      }}
    />
  )
}
