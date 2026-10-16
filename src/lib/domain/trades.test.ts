import type { Trade } from './trades'
import { calculateAnalytics, realizedNetPnl } from './trades'
import { describe, expect, it } from 'vitest'
const trade=(values:Partial<Trade>):Trade=>({id:'t1',symbol:'EURUSD',direction:'long',status:'closed',openedAt:'2026-01-01T00:00:00Z',closedAt:'2026-01-01T01:00:00Z',entryPrice:'1.1',exitPrice:'1.2',size:'1',fees:'2',realizedPnl:'12',...values})
describe('trade analytics',()=>{
 it('subtracts fees from manually recorded realized result',()=>expect(realizedNetPnl(trade({realizedPnl:'12',fees:'2'}))?.toFixed(2)).toBe('10.00'))
 it('never counts open trades as realized',()=>expect(realizedNetPnl(trade({status:'open',closedAt:null,exitPrice:null,realizedPnl:null}))).toBeNull())
 it('returns empty metrics when no closed records',()=>expect(calculateAnalytics([])).toMatchObject({closedCount:0,openCount:0,netPnl:'0.00',winRate:null,expectancy:null}))
 it('uses net P&L for win rate, expectancy and trade count',()=>{const a=trade({id:'1',realizedPnl:'10',fees:'2'});const b=trade({id:'2',realizedPnl:'-8',fees:'1'});const m=calculateAnalytics([a,b]);expect(m.netPnl).toBe('-1.00');expect(m.winRate).toBe(50);expect(m.expectancy).toBe('-0.50')})
})
