-- Risk amount: the money the user deliberately put at risk on a trade.
--
-- This is a recorded figure, not a derived one. It is NOT computed as
-- (entry - stop) * size, because that would invent a monetary loss the user
-- never recorded and would require assuming a contract multiplier and a
-- currency conversion. R multiple is computed from prices; risk amount is
-- what the user typed and stays independent of it.

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS risk_amount numeric(20,8) CHECK (risk_amount IS NULL OR risk_amount > 0);

-- A stop loss on the wrong side of entry cannot produce a meaningful R,
-- so the constraint documents the intent at the database boundary.
ALTER TABLE public.trades
  ADD CONSTRAINT trades_stop_side_check CHECK (
    stop_loss IS NULL
    OR (direction = 'long'  AND stop_loss < entry_price)
    OR (direction = 'short' AND stop_loss > entry_price)
  );

ALTER TABLE public.trades
  ADD CONSTRAINT trades_target_side_check CHECK (
    take_profit IS NULL
    OR (direction = 'long'  AND take_profit > entry_price)
    OR (direction = 'short' AND take_profit < entry_price)
  );
