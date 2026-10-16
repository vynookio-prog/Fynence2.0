import Decimal from 'decimal.js'
export type TradeStatus = 'open'|'closed'
export type Direction = 'long'|'short'
export type Trade = { id:string; symbol:string; direction:Direction; status:TradeStatus; openedAt:string; closedAt?:string|null; entryPrice:string; exitPrice?:string|null; size:string; fees:string; realizedPnl?:string|null; setup?:string|null; timeframe?:string|null; notes?:string|null }
export function realizedNetPnl(trade: Trade): Decimal | null {
 if (trade.status !== 'closed' || trade.realizedPnl == null) return null
 return new Decimal(trade.realizedPnl).minus(trade.fees || '0')
}
export function calculateAnalytics(trades: Trade[]) {
 const closed = trades.map(t=>({trade:t,pnl:realizedNetPnl(t)})).filter((x):x is {trade:Trade;pnl:Decimal}=>x.pnl!==null)
 const wins=closed.filter(x=>x.pnl.gt(0)), losses=closed.filter(x=>x.pnl.lt(0))
 const net=closed.reduce((s,x)=>s.plus(x.pnl),new Decimal(0))
 const grossWin=wins.reduce((s,x)=>s.plus(x.pnl),new Decimal(0)), grossLoss=losses.reduce((s,x)=>s.plus(x.pnl.abs()),new Decimal(0))
 return {closedCount:closed.length,openCount:trades.filter(t=>t.status==='open').length,netPnl:net.toFixed(2),winRate:closed.length?new Decimal(wins.length).div(closed.length).mul(100).toDecimalPlaces(1).toNumber():null,profitFactor:grossLoss.eq(0)?(grossWin.gt(0)?null:null):grossWin.div(grossLoss).toDecimalPlaces(2).toNumber(),averageWin:wins.length?grossWin.div(wins.length).toFixed(2):null,averageLoss:losses.length?grossLoss.div(losses.length).neg().toFixed(2):null,expectancy:closed.length?net.div(closed.length).toFixed(2):null,series:closed.map(({trade,pnl})=>({date:trade.closedAt??trade.openedAt,pnl:pnl.toNumber()}))}
}
