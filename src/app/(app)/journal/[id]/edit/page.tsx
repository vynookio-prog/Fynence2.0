import { notFound } from 'next/navigation'
import { TradeForm } from '@/components/trade-form'
import { getTrade, toLocalInput } from '@/lib/trades/query'

export const dynamic = 'force-dynamic'

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const row = await getTrade(id)
  if (!row) notFound()

  return (
    <TradeForm
      mode="edit"
      values={{
        id: row.id,
        symbol: row.symbol,
        direction: row.direction,
        status: row.status,
        opened_at: toLocalInput(row.opened_at),
        closed_at: toLocalInput(row.closed_at),
        entry_price: row.entry_price ?? '',
        exit_price: row.exit_price ?? '',
        size: row.size ?? '',
        fees: row.fees ?? '0',
        realized_pnl: row.realized_pnl ?? '',
        setup: row.setup ?? '',
        timeframe: row.timeframe ?? '',
        stop_loss: row.stop_loss ?? '',
        take_profit: row.take_profit ?? '',
        exit_reason: row.exit_reason ?? '',
        notes: row.notes ?? '',
        setup_grade: row.setup_grade == null ? '' : String(row.setup_grade),
        execution_quality: row.execution_quality == null ? '' : String(row.execution_quality),
        plan_adherence: row.plan_adherence == null ? '' : row.plan_adherence ? 'yes' : 'no',
        emotion: row.emotion ?? '',
      }}
    />
  )
}
