-- =====================================================================
-- Migration: Schema Hardening
-- Date: 2026-04-19
-- Author: Hemant Taneja, Hriday Vig, Dhruv Mohapatra
-- Subject: Database Management Systems Lab
--
-- Purpose
-- -------
-- This migration tightens referential integrity, adds CHECK constraints
-- that enforce business rules at the database layer (so they cannot be
-- bypassed by a buggy client), and adds indexes on every foreign-key
-- column and on hot query paths.
--
-- It is idempotent: every statement uses IF NOT EXISTS / DO blocks so
-- it is safe to re-run on an existing database.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Fix foreign keys that were missing ON DELETE behaviour
-- ---------------------------------------------------------------------
-- competition_events.executed_by -> auth.users(id)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'competition_events_executed_by_fkey') THEN
    ALTER TABLE public.competition_events
      DROP CONSTRAINT competition_events_executed_by_fkey;
  END IF;
END $$;

ALTER TABLE public.competition_events
  ADD CONSTRAINT competition_events_executed_by_fkey
  FOREIGN KEY (executed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- margin_warnings.position_id -> positions(id)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'margin_warnings_position_id_fkey') THEN
    ALTER TABLE public.margin_warnings
      DROP CONSTRAINT margin_warnings_position_id_fkey;
  END IF;
END $$;

ALTER TABLE public.margin_warnings
  ADD CONSTRAINT margin_warnings_position_id_fkey
  FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE CASCADE;

-- transactions.asset_id -> assets(id)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'transactions_asset_id_fkey') THEN
    ALTER TABLE public.transactions
      DROP CONSTRAINT transactions_asset_id_fkey;
  END IF;
END $$;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;

-- admin_messages.sender_id -> auth.users(id)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints
             WHERE constraint_name = 'admin_messages_sender_id_fkey') THEN
    ALTER TABLE public.admin_messages
      DROP CONSTRAINT admin_messages_sender_id_fkey;
  END IF;
END $$;

ALTER TABLE public.admin_messages
  ADD CONSTRAINT admin_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;


-- ---------------------------------------------------------------------
-- 2. CHECK constraints (business rules in the database)
-- ---------------------------------------------------------------------
-- Asset prices must be strictly positive
ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_current_price_positive;
ALTER TABLE public.assets
  ADD CONSTRAINT assets_current_price_positive
  CHECK (current_price > 0);

-- Cash balances may never go negative
ALTER TABLE public.portfolios
  DROP CONSTRAINT IF EXISTS portfolios_cash_balance_nonneg;
ALTER TABLE public.portfolios
  ADD CONSTRAINT portfolios_cash_balance_nonneg
  CHECK (cash_balance >= 0);

-- Order quantity must be strictly positive
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_quantity_positive;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_quantity_positive
  CHECK (quantity > 0);

-- Limit / stop-loss orders MUST carry a price; market orders SHOULD NOT
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_price_matches_type;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_price_matches_type
  CHECK (
    (order_type = 'market'    AND price IS NULL)
 OR (order_type = 'limit'     AND price IS NOT NULL AND price > 0)
 OR (order_type = 'stop_loss' AND stop_price IS NOT NULL AND stop_price > 0)
  );

-- Position quantities: long must be > 0, short positions store positive qty too
ALTER TABLE public.positions
  DROP CONSTRAINT IF EXISTS positions_quantity_positive;
ALTER TABLE public.positions
  ADD CONSTRAINT positions_quantity_positive
  CHECK (quantity > 0);

-- Average price must be positive
ALTER TABLE public.positions
  DROP CONSTRAINT IF EXISTS positions_avg_price_positive;
ALTER TABLE public.positions
  ADD CONSTRAINT positions_avg_price_positive
  CHECK (average_price > 0);

-- Transactions must be one of the four canonical sides
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_valid;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_valid
  CHECK (transaction_type IN ('buy','sell','short','cover'));

-- Margin warnings must be one of the recognised levels
ALTER TABLE public.margin_warnings
  DROP CONSTRAINT IF EXISTS margin_warnings_type_valid;
ALTER TABLE public.margin_warnings
  ADD CONSTRAINT margin_warnings_type_valid
  CHECK (warning_type IN (
    'warning','liquidation','margin_call','maintenance_warning'
  ));

-- Round numbers must be 1, 2 or 3 (the format used by the competition)
ALTER TABLE public.competition_rounds
  DROP CONSTRAINT IF EXISTS competition_rounds_number_range;
ALTER TABLE public.competition_rounds
  ADD CONSTRAINT competition_rounds_number_range
  CHECK (round_number BETWEEN 1 AND 3);


-- ---------------------------------------------------------------------
-- 3. Indexes on foreign keys (Postgres does not auto-index FKs)
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_user_id            ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_asset_id           ON public.orders(asset_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_status        ON public.orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created     ON public.orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_positions_user_id         ON public.positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_asset_id        ON public.positions(asset_id);
CREATE INDEX IF NOT EXISTS idx_positions_user_short      ON public.positions(user_id, is_short);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id      ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_asset_id     ON public.transactions(asset_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON public.transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_asset_id    ON public.price_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_price_history_created     ON public.price_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_fluctuation_asset   ON public.price_fluctuation_log(asset_id);
CREATE INDEX IF NOT EXISTS idx_price_fluctuation_event   ON public.price_fluctuation_log(event_id);
CREATE INDEX IF NOT EXISTS idx_price_fluctuation_created ON public.price_fluctuation_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_margin_warnings_user      ON public.margin_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_margin_warnings_position  ON public.margin_warnings(position_id);
CREATE INDEX IF NOT EXISTS idx_margin_warnings_unread    ON public.margin_warnings(user_id, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_messages_recipient        ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender           ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_unread           ON public.messages(recipient_id, is_read)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_news_published_by         ON public.news(published_by);
CREATE INDEX IF NOT EXISTS idx_news_created              ON public.news(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_history_user    ON public.portfolio_history(user_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_competition_events_round  ON public.competition_events(round_number, status);
CREATE INDEX IF NOT EXISTS idx_competition_events_status ON public.competition_events(status);

CREATE INDEX IF NOT EXISTS idx_assets_active             ON public.assets(is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_assets_sector             ON public.assets(sector);

CREATE INDEX IF NOT EXISTS idx_user_roles_user           ON public.user_roles(user_id);


-- ---------------------------------------------------------------------
-- 4. Helper view: current leaderboard
--    (Used by the leaderboard page; keeps SQL out of the client.)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id              AS user_id,
  pr.full_name,
  pr.team_code,
  p.cash_balance,
  p.total_value,
  p.profit_loss,
  p.profit_loss_percentage,
  RANK() OVER (ORDER BY p.total_value DESC) AS rank,
  p.updated_at
FROM public.portfolios p
JOIN public.profiles  pr ON pr.id = p.user_id;

GRANT SELECT ON public.leaderboard TO authenticated;


-- ---------------------------------------------------------------------
-- 5. Trigger: auto-record portfolio_history every time a portfolio
--    row is updated (gives us a free time-series for charts).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.snapshot_portfolio_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only snapshot when the value materially changed
  IF OLD.total_value IS DISTINCT FROM NEW.total_value THEN
    INSERT INTO public.portfolio_history
      (user_id, team_code, total_value, cash_balance, profit_loss, recorded_at)
    SELECT
      NEW.user_id,
      pr.team_code,
      NEW.total_value,
      NEW.cash_balance,
      NEW.profit_loss,
      now()
    FROM public.profiles pr
    WHERE pr.id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_portfolio_history ON public.portfolios;
CREATE TRIGGER trg_snapshot_portfolio_history
AFTER UPDATE ON public.portfolios
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_portfolio_history();


-- ---------------------------------------------------------------------
-- 6. Documentation comments (visible via \d in psql)
-- ---------------------------------------------------------------------
COMMENT ON TABLE  public.profiles            IS 'User profile (1:1 with auth.users)';
COMMENT ON TABLE  public.user_roles          IS 'RBAC: maps users to owner/admin/user roles';
COMMENT ON TABLE  public.assets              IS 'Tradeable instruments (stocks, commodities, indices)';
COMMENT ON TABLE  public.portfolios          IS 'One cash + valuation row per participant';
COMMENT ON TABLE  public.positions           IS 'Currently held long or short positions';
COMMENT ON TABLE  public.orders              IS 'Order book (market, limit, stop_loss)';
COMMENT ON TABLE  public.transactions        IS 'Immutable audit log of executed fills';
COMMENT ON TABLE  public.competition_rounds  IS 'Round-1/2/3 lifecycle';
COMMENT ON TABLE  public.competition_events  IS 'Scripted catalysts and black-swan events';
COMMENT ON TABLE  public.competition_settings IS 'Versioned key/value configuration (JSONB)';
COMMENT ON TABLE  public.price_history       IS 'Append-only price audit log';
COMMENT ON TABLE  public.price_fluctuation_log IS 'Detailed reason-coded price moves';
COMMENT ON TABLE  public.portfolio_history   IS 'Time-series of portfolio value (auto-populated)';
COMMENT ON TABLE  public.margin_warnings     IS 'Risk-management notifications for short positions';
COMMENT ON VIEW   public.leaderboard         IS 'Live ranked portfolio standings';
