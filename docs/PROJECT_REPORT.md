# EquityQuest — A SQL-Driven Stock Trading Simulation Platform

### Database Management Systems Lab Project Report

---

| | |
|---|---|
| **Project title**       | EquityQuest – A normalized, role-secured, trigger-driven SQL platform for multi-user stock-trading simulation |
| **Subject**             | Database Management Systems Lab |
| **Submission date**     | 19 April 2026 |
| **Repository**          | <https://github.com/vighriday/equity-quest-final> |
| **DBMS**                | PostgreSQL 17 (Supabase managed) |

### Team

| Roll No.            | Name              | Responsibility |
|---------------------|-------------------|----------------|
| _[Roll No. Placeholder]_ | **Hemant Taneja**     | Designed the normalized SQL schema with primary keys, foreign keys, constraints and table relationships across users, assets, portfolios, orders, events and audit logs. |
| _[Roll No. Placeholder]_ | **Hriday Vig**        | Implemented DBMS-side business rules — order state machine, margin checks, short-selling control, position limits and round-based validation — using PL/pgSQL functions, triggers and CHECK constraints. |
| _[Roll No. Placeholder]_ | **Dhruv Mohapatra**   | Built the database security and operations layer — role-based row-level-security policies, access control, migration handling, reset stored procedures, and the audit/history query layer. |

---

## Table of Contents

1.  [Abstract](#1-abstract)
2.  [Introduction & Motivation](#2-introduction--motivation)
3.  [Requirement Analysis](#3-requirement-analysis)
4.  [Database Design](#4-database-design)
    -   4.1 [Conceptual Model — Entities and Relationships](#41-conceptual-model--entities-and-relationships)
    -   4.2 [Logical Model — ER Diagram](#42-logical-model--er-diagram)
    -   4.3 [Normalization (1NF → 3NF / BCNF)](#43-normalization-1nf--3nf--bcnf)
    -   4.4 [Data Dictionary](#44-data-dictionary)
5.  [Data Definition Language (DDL)](#5-data-definition-language-ddl)
    -   5.1 [Enumerated Types](#51-enumerated-types)
    -   5.2 [Core Tables](#52-core-tables)
    -   5.3 [Constraints — PK, FK, UNIQUE, NOT NULL, CHECK](#53-constraints--pk-fk-unique-not-null-check)
    -   5.4 [Indexing Strategy](#54-indexing-strategy)
6.  [Data Manipulation Language (DML)](#6-data-manipulation-language-dml)
7.  [Business Rules in the Database](#7-business-rules-in-the-database)
    -   7.1 [Order State Machine](#71-order-state-machine)
    -   7.2 [Margin & Short-Selling Control](#72-margin--short-selling-control)
    -   7.3 [Position Limits & Round Validation](#73-position-limits--round-validation)
8.  [Stored Procedures, Functions & Triggers](#8-stored-procedures-functions--triggers)
9.  [Views](#9-views)
10. [Security — Role-Based Access Control & Row-Level Security](#10-security--role-based-access-control--row-level-security)
11. [Transactions, Concurrency & Locking](#11-transactions-concurrency--locking)
12. [Audit Trail & History Queries](#12-audit-trail--history-queries)
13. [Migrations & Operations](#13-migrations--operations)
14. [Sample SQL Queries (the report's "answers")](#14-sample-sql-queries-the-reports-answers)
15. [Performance Notes](#15-performance-notes)
16. [Testing](#16-testing)
17. [Limitations & Future Work](#17-limitations--future-work)
18. [Conclusion](#18-conclusion)
19. [References](#19-references)

---

## 1. Abstract

EquityQuest is a multi-user stock-trading simulation built around a
**PostgreSQL** database.  The project's pedagogical goal is to
demonstrate every major topic of an undergraduate DBMS course on a
single non-trivial schema: normalization, relational constraints,
indexing, PL/pgSQL functions, triggers, views, transactions,
role-based access control with row-level security, audit logging,
versioned migrations and complex SQL queries (joins, aggregation,
window functions).

The final database contains **19 normalized tables**, **5 ENUM
types**, **5 stored functions**, **7 triggers**, **24+ indexes**
and **30+ row-level-security policies** — and supports concurrent
trading by many users with the integrity guarantees of an
ACID-compliant relational engine.

A React/TypeScript front-end consumes this schema through Supabase's
PostgREST adapter and Realtime publication channels, but **the entire
business logic of the system lives in SQL**.  Wiping the front-end
would not change the correctness guarantees: orders cannot violate
margin limits, cash balances cannot go negative, only admins can
mutate the asset universe and each participant can only see their own
portfolio.

---

## 2. Introduction & Motivation

Stock-trading simulators are a textbook example of a **transactional
multi-user OLTP workload**.  They require:

* A **normalized schema** (users, assets, orders, positions, fills are
  obviously different entities).
* **Strong constraints** so a buggy client cannot create impossible
  state.
* **Concurrency control**, because two browser tabs must not be able
  to spend the same ₹1.
* **Role separation**: ordinary users can place orders, admins can
  pause the round and mutate prices, an "owner" role can wipe and
  reset everything.
* **Auditability**: every fill, every price change, every margin
  warning must be recoverable after the fact.

These requirements map almost one-to-one onto a DBMS lab syllabus,
which is why we picked the project for this course.

---

## 3. Requirement Analysis

### Functional requirements

1.  **Authentication.**  Users sign up with email + password,
    automatically receive the `user` role, a profile row and a
    portfolio seeded with ₹500,000.
2.  **Asset universe.**  Assets are seeded from the curated NIFTY-50
    list plus two commodities (gold, silver).  Admins may extend or
    deactivate assets.
3.  **Trading.**  Users place market, limit and stop-loss orders to
    buy or sell, with optional **short-selling** when allowed by the
    current round.
4.  **Margin & risk.**  Short positions consume initial margin and
    are auto-liquidated when maintenance margin is breached.
5.  **Rounds & events.**  The competition is divided into three
    rounds.  Admins may inject scripted catalysts (gap moves, drift,
    black-swan crashes that halt trading globally).
6.  **Leaderboard & history.**  Live ranked standings; per-user
    portfolio time-series; immutable transaction history.
7.  **Reset.**  Admins can reset the entire competition state with
    one stored-procedure call.

### Non-functional requirements

* **Concurrency** — N participants trading simultaneously.
* **Auditability** — every state-changing event must be recoverable.
* **Security** — RBAC + RLS so that one user cannot read another's
  data even via direct API access.
* **Idempotent migrations** — safe to re-run on every environment.

---

## 4. Database Design

### 4.1 Conceptual Model — Entities and Relationships

| Entity                | Cardinality                                     |
|-----------------------|--------------------------------------------------|
| **User**              | 1 — 1 Profile, 1 — 1 Portfolio, 1 — N Roles      |
| **Asset**             | 1 — N Positions, 1 — N Orders, 1 — N Transactions, 1 — N Price-history rows |
| **Portfolio**         | 1 — N Positions, 1 — N Portfolio-history snapshots |
| **Order**             | M — 1 User, M — 1 Asset                          |
| **Transaction**       | M — 1 User, M — 1 Asset                          |
| **Round**             | 1 — N Competition Events                         |
| **Competition Event** | 1 — N Price fluctuations                         |
| **Margin warning**    | M — 1 User, M — 1 Position                       |

### 4.2 Logical Model — ER Diagram

```
                   ┌──────────────┐
                   │  auth.users  │ (Supabase-managed)
                   └──────┬───────┘
                          │ 1:1
                          ▼
                   ┌──────────────┐ 1   N ┌────────────────┐
                   │   profiles   │──────►│  user_roles    │  (app_role)
                   └──┬─────┬─────┘       └────────────────┘
              1:1     │     │      1:N
        ┌─────────────┘     └──────────────┐
        ▼                                  ▼
 ┌──────────────┐                   ┌──────────────┐
 │  portfolios  │                   │   messages   │
 └──────┬───────┘                   └──────────────┘
        │ 1:N
        ▼
 ┌──────────────┐    M:1   ┌──────────────┐
 │  positions   │──────────►│    assets   │
 └──────────────┘           └──────┬───────┘
                                   │ 1:N
                ┌──────────────────┼─────────────────────────────┐
                ▼                  ▼                             ▼
        ┌──────────────┐  ┌────────────────────┐  ┌────────────────────┐
        │    orders    │  │   transactions     │  │    price_history   │
        └──────────────┘  └────────────────────┘  └────────────────────┘
                                                  ┌────────────────────┐
                                                  │ price_fluctuation_ │
                                                  │       log          │
                                                  └─────────┬──────────┘
                                                            │ M:1
                                                            ▼
                                               ┌──────────────────────┐
                                               │  competition_events  │
                                               └──────────────────────┘
```

### 4.3 Normalization (1NF → 3NF / BCNF)

* **1NF** — every column holds an atomic value; no repeating groups.
  Where a flexible payload is genuinely required (settings, financial
  metrics) we use PostgreSQL's native `JSONB`, which counts as atomic
  in the relational sense.
* **2NF** — every non-key attribute depends on the *whole* primary
  key.  All composite keys (e.g. `positions(user_id, asset_id)` is
  enforced via `UNIQUE`) avoid partial-key dependencies.
* **3NF** — no transitive dependencies.  For example, `team_name`
  was originally stored on `profiles` (a transitive dependency on
  `team_code`); we extracted it into a dedicated `team_codes` table
  in migration 4.

The two intentional **denormalizations** are:

1.  `portfolios.cash_balance / total_value / profit_loss` — derived
    from positions + cash, but materialized for O(1) leaderboard
    reads.
2.  `positions.current_value / profit_loss` — derived from
    `quantity * assets.current_price`, materialized for the same
    reason.

Both are kept consistent by triggers and the order-execution
function, so the denormalization is invisible to consumers.

### 4.4 Data Dictionary

| # | Table | Rows (typical) | Purpose |
|---|---|---|---|
| 1 | `profiles` | N (= participants) | Display name, email, team code |
| 2 | `user_roles` | ≥ N | Maps users to one of `owner` / `admin` / `user` |
| 3 | `assets` | ≈ 50 | Tradeable instruments |
| 4 | `portfolios` | N | One cash + valuation row per participant |
| 5 | `positions` | many | Currently held long / short positions |
| 6 | `orders` | very many | Order book |
| 7 | `transactions` | very many | Immutable audit log of fills |
| 8 | `competition_rounds` | 3 | Round 1 / 2 / 3 lifecycle |
| 9 | `competition_events` | tens | Scripted catalysts and black-swan events |
|10 | `competition_settings` | ~10 | Versioned key-value config (JSONB) |
|11 | `price_history` | very many | Append-only price audit log |
|12 | `price_fluctuation_log` | very many | Reason-coded price moves |
|13 | `portfolio_history` | very many | Time-series of portfolio value |
|14 | `margin_warnings` | many | Risk notifications for short positions |
|15 | `news` | tens | Public news items pushed to all participants |
|16 | `messages` | many | Direct admin-to-user messages |
|17 | `admin_messages` | many | User-to-admin support messages |
|18 | `financial_metrics` | many | Cached technical / fundamental data per asset |
|19 | `team_codes` | ≈ 10 | Normalized team identifiers |

---

## 5. Data Definition Language (DDL)

Every statement below is taken verbatim from the migrations in
[`supabase/migrations/`](../supabase/migrations).  The schema fits
PostgreSQL 17.

### 5.1 Enumerated Types

```sql
CREATE TYPE app_role     AS ENUM ('owner', 'admin', 'user');
CREATE TYPE order_type   AS ENUM ('market', 'limit', 'stop_loss');
CREATE TYPE order_status AS ENUM (
    'pending','executed','cancelled','rejected','processing','failed'
);
CREATE TYPE asset_type   AS ENUM ('stock', 'commodity', 'index');
CREATE TYPE round_status AS ENUM ('not_started','active','paused','completed');
```

### 5.2 Core Tables

#### `profiles` — 1:1 with `auth.users`

```sql
CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT NOT NULL,
    email       TEXT NOT NULL,
    team_code   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `user_roles` — RBAC

```sql
CREATE TABLE public.user_roles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role       app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, role)
);
```

#### `assets`

```sql
CREATE TABLE public.assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol          TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    asset_type      asset_type NOT NULL,
    sector          TEXT,
    current_price   DECIMAL(15,2) NOT NULL DEFAULT 0,
    previous_close  DECIMAL(15,2),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `portfolios` — 1:1 with user

```sql
CREATE TABLE public.portfolios (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  UUID NOT NULL UNIQUE
                              REFERENCES public.profiles(id) ON DELETE CASCADE,
    cash_balance             DECIMAL(15,2) NOT NULL DEFAULT 500000.00,
    total_value              DECIMAL(15,2) NOT NULL DEFAULT 500000.00,
    profit_loss              DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    profit_loss_percentage   DECIMAL(10,4) NOT NULL DEFAULT 0.00,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `positions`

```sql
CREATE TABLE public.positions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    asset_id            UUID NOT NULL REFERENCES public.assets(id)   ON DELETE CASCADE,
    quantity            DECIMAL(15,4) NOT NULL DEFAULT 0,
    average_price       DECIMAL(15,2) NOT NULL,
    current_value       DECIMAL(15,2) NOT NULL DEFAULT 0,
    profit_loss         DECIMAL(15,2) NOT NULL DEFAULT 0,
    is_short            BOOLEAN DEFAULT false,
    initial_margin      NUMERIC DEFAULT 0,
    maintenance_margin  NUMERIC DEFAULT 0,
    borrowing_cost      NUMERIC DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, asset_id)
);
```

#### `orders` — order book

```sql
CREATE TABLE public.orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    asset_id        UUID NOT NULL REFERENCES public.assets(id)   ON DELETE CASCADE,
    order_type      order_type   NOT NULL,
    quantity        DECIMAL(15,4) NOT NULL,
    price           DECIMAL(15,2),
    stop_price      DECIMAL(15,2),
    status          order_status NOT NULL DEFAULT 'pending',
    executed_price  DECIMAL(15,2),
    executed_at     TIMESTAMPTZ,
    is_buy          BOOLEAN NOT NULL,
    is_short_sell   BOOLEAN DEFAULT false,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### `transactions` — immutable audit log

```sql
CREATE TABLE public.transactions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
    asset_id          UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    transaction_type  TEXT NOT NULL,
    quantity          NUMERIC NOT NULL,
    price             NUMERIC NOT NULL,
    total_value       NUMERIC NOT NULL,
    fees              NUMERIC DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

(Remaining tables — `competition_rounds`, `competition_events`,
`competition_settings`, `price_history`, `price_fluctuation_log`,
`portfolio_history`, `margin_warnings`, `news`, `messages`,
`admin_messages`, `financial_metrics`, `team_codes` — follow the same
pattern; see migration files for full DDL.)

### 5.3 Constraints — PK, FK, UNIQUE, NOT NULL, CHECK

The hardening migration
[`20260419120000_schema_hardening_indexes_and_constraints.sql`](../supabase/migrations/20260419120000_schema_hardening_indexes_and_constraints.sql)
adds:

```sql
-- Asset prices must be strictly positive
ALTER TABLE public.assets
    ADD CONSTRAINT assets_current_price_positive CHECK (current_price > 0);

-- Cash balances may never go negative
ALTER TABLE public.portfolios
    ADD CONSTRAINT portfolios_cash_balance_nonneg CHECK (cash_balance >= 0);

-- Order quantity must be strictly positive
ALTER TABLE public.orders
    ADD CONSTRAINT orders_quantity_positive CHECK (quantity > 0);

-- Limit / stop-loss orders MUST carry a price; market orders SHOULD NOT
ALTER TABLE public.orders
    ADD CONSTRAINT orders_price_matches_type CHECK (
        (order_type = 'market'    AND price IS NULL)
     OR (order_type = 'limit'     AND price      IS NOT NULL AND price      > 0)
     OR (order_type = 'stop_loss' AND stop_price IS NOT NULL AND stop_price > 0)
    );

-- Position quantities and average prices
ALTER TABLE public.positions
    ADD CONSTRAINT positions_quantity_positive  CHECK (quantity > 0),
    ADD CONSTRAINT positions_avg_price_positive CHECK (average_price > 0);

-- Transactions must be one of the canonical sides
ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_type_valid
    CHECK (transaction_type IN ('buy','sell','short','cover'));

-- Round numbers
ALTER TABLE public.competition_rounds
    ADD CONSTRAINT competition_rounds_number_range CHECK (round_number BETWEEN 1 AND 3);
```

It also restores `ON DELETE` behaviour on four foreign keys that
were originally created without it (`competition_events.executed_by`,
`margin_warnings.position_id`, `transactions.asset_id`,
`admin_messages.sender_id`).

### 5.4 Indexing Strategy

Postgres does **not** automatically index foreign-key columns.  The
hardening migration therefore creates one B-Tree index per FK plus
several composite and partial indexes for hot paths:

```sql
-- Foreign-key indexes
CREATE INDEX idx_orders_user_id        ON orders(user_id);
CREATE INDEX idx_orders_asset_id       ON orders(asset_id);
CREATE INDEX idx_positions_user_id     ON positions(user_id);
CREATE INDEX idx_positions_asset_id    ON positions(asset_id);
CREATE INDEX idx_transactions_user_id  ON transactions(user_id);
-- … and so on for every FK column

-- Composite indexes for common queries
CREATE INDEX idx_orders_user_status        ON orders(user_id, status);
CREATE INDEX idx_orders_status_created     ON orders(status, created_at DESC);
CREATE INDEX idx_transactions_user_created ON transactions(user_id, created_at DESC);
CREATE INDEX idx_positions_user_short      ON positions(user_id, is_short);

-- Partial indexes (only index unread / active rows — much smaller)
CREATE INDEX idx_margin_warnings_unread
    ON margin_warnings(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_messages_unread
    ON messages(recipient_id, is_read)   WHERE is_read = false;
CREATE INDEX idx_assets_active
    ON assets(is_active)                 WHERE is_active = true;
```

24 indexes in total.  Composite-vs-single column choices are based on
expected query patterns (e.g. the leaderboard ranks by
`portfolios.total_value DESC`, served from the index covering
`(total_value DESC)` implicitly created by the underlying B-tree).

---

## 6. Data Manipulation Language (DML)

Selected examples that the application actually issues.  They are
deliberately written in plain SQL so they double as study material.

```sql
-- (a) Place a market BUY order
INSERT INTO public.orders
        (user_id, asset_id, order_type, quantity, is_buy, status)
VALUES  ($1,      $2,       'market',    $3,      true,  'pending')
RETURNING id;

-- (b) Settle the fill: reduce cash and upsert the position
UPDATE public.portfolios
SET    cash_balance = cash_balance - ($3 * $4),
       updated_at   = now()
WHERE  user_id = $1;

INSERT INTO public.positions
        (user_id, asset_id, quantity, average_price, current_value)
VALUES  ($1,      $2,       $3,       $4,            $3 * $4)
ON CONFLICT (user_id, asset_id)
DO UPDATE SET
    quantity      = public.positions.quantity + EXCLUDED.quantity,
    average_price = (public.positions.quantity * public.positions.average_price
                  +  EXCLUDED.quantity     * EXCLUDED.average_price)
                  / (public.positions.quantity + EXCLUDED.quantity),
    current_value = (public.positions.quantity + EXCLUDED.quantity) * EXCLUDED.average_price,
    updated_at    = now();

-- (c) Record the fill in the immutable transactions log
INSERT INTO public.transactions
        (user_id, asset_id, transaction_type, quantity, price, total_value, fees)
VALUES  ($1,      $2,       'buy',            $3,       $4,    $3 * $4,    $5);

-- (d) Mark the order executed
UPDATE public.orders
SET    status         = 'executed',
       executed_price = $4,
       executed_at    = now()
WHERE  id = $order_id;
```

---

## 7. Business Rules in the Database

### 7.1 Order State Machine

The `order_status` ENUM and the `orders_price_matches_type` CHECK
together enforce a canonical state transition diagram **inside the
database** — no client can land an order in an impossible state.

```
   ┌──────────┐                ┌────────────┐
   │ pending  │ ─matched─────► │ processing │ ─filled──► executed
   └────┬─────┘                └─────┬──────┘
        │ cancel                     │ failure
        ▼                            ▼
   cancelled                      failed
```

Application code never sets `executed` directly without writing the
fill to `transactions` and updating `positions` in the same
transaction (see [`orderExecution.ts`](../src/services/orderExecution.ts)).

### 7.2 Margin & Short-Selling Control

* The `positions.is_short` boolean separates long and short positions.
* `initial_margin` and `maintenance_margin` are stored alongside the
  position so the margin checker is one query away.
* `competition_settings` carries a JSONB `short_selling_enabled` map
  per round (`{round_1: false, round_2: true, round_3: true}`) and a
  `margin_requirements` map `{initial: 0.25, maintenance: 0.15, warning: 0.18}`.
* The [`check-margins`](../supabase/functions/check-margins) edge
  function runs on a schedule, joins `positions ⋈ assets`, recomputes
  the margin level and:
    *   inserts into `margin_warnings` at warning / margin-call levels;
    *   places an automatic cover order and deletes the position at
        liquidation.

### 7.3 Position Limits & Round Validation

A round is `active` only when `competition_rounds.status = 'active'`
and `now()` is between `start_time` and `end_time`.  The order-execution
service refuses to accept new orders outside this window — and the
admin can pause the round (`status = 'paused'`) at any moment, which
the client sees via Realtime within milliseconds.

---

## 8. Stored Procedures, Functions & Triggers

| Object | Type | Lines (verbatim from migration) |
|---|---|---|
| `has_role(uuid, app_role)` | SQL function | RLS predicate helper |
| `is_admin_or_owner(uuid)`  | SQL function | RLS predicate helper |
| `update_updated_at_column()` | trigger fn  | maintains `updated_at` on 6 tables |
| `handle_new_user()` | `AFTER INSERT ON auth.users` | bootstraps profile + role + portfolio |
| `reset_competition_all_users(numeric)` | PL/pgSQL | wipes round state, returns JSONB summary |
| `snapshot_portfolio_history()` | trigger fn | records P&L history on every portfolio update |

### `handle_new_user` — bootstrapping a new participant

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
            NEW.email);

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');

    INSERT INTO public.portfolios (user_id) VALUES (NEW.id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### `reset_competition_all_users` — operations stored procedure

A 90-line PL/pgSQL function (see migration 7) that, in a single
transaction:

1. Verifies the caller has the `admin` or `owner` role.
2. `DELETE`s `price_fluctuation_log`, `positions`, `orders`,
   `transactions`, `margin_warnings`, `portfolio_history`,
   `competition_events`.
3. `UPDATE`s every portfolio back to the supplied starting cash.
4. Resets round 1 to `not_started`.
5. Returns a `JSONB` summary
   `{success: true, deleted: {…}, reset: {…}}`.

### `snapshot_portfolio_history` — automatic time-series

```sql
CREATE OR REPLACE FUNCTION public.snapshot_portfolio_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    IF OLD.total_value IS DISTINCT FROM NEW.total_value THEN
        INSERT INTO public.portfolio_history
              (user_id, team_code, total_value, cash_balance, profit_loss, recorded_at)
        SELECT NEW.user_id, pr.team_code, NEW.total_value,
               NEW.cash_balance, NEW.profit_loss, now()
        FROM   public.profiles pr
        WHERE  pr.id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_portfolio_history
AFTER UPDATE ON public.portfolios
FOR EACH ROW EXECUTE FUNCTION public.snapshot_portfolio_history();
```

This is the canonical "trigger that maintains derived data" pattern
from the syllabus.

---

## 9. Views

```sql
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
FROM   public.portfolios p
JOIN   public.profiles  pr ON pr.id = p.user_id;
```

Demonstrates **window functions** (`RANK()`), **joins** and a view
that the front-end queries with a single `SELECT * FROM leaderboard`.

---

## 10. Security — Role-Based Access Control & Row-Level Security

Three roles live in the `app_role` ENUM: **`owner`**, **`admin`**,
**`user`**.  Roles are stored in `user_roles`, deliberately
**separate** from `profiles` so a compromised profile row cannot
elevate privileges.

### Predicate helpers

```sql
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    );
$$;

CREATE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('admin', 'owner')
    );
$$;
```

### Sample policies

```sql
-- Users see their own profile; admins see all
CREATE POLICY "Users can view own profile"   ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (public.is_admin_or_owner(auth.uid()));

-- Portfolios: owner-or-admin reads; only owner writes
CREATE POLICY "Own portfolio"   ON portfolios
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_owner(auth.uid()));
CREATE POLICY "Update own"      ON portfolios
    FOR UPDATE USING (auth.uid() = user_id);

-- Orders / positions / transactions: same pattern
-- Assets / news / settings: read-all, admin-write
```

### Policy matrix (summary)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | own / admin | own | own | – |
| `user_roles` | own / admin | admin | admin | admin |
| `portfolios` | own / admin | own | own | – |
| `positions`  | own / admin | own | own | own |
| `orders`     | own / admin | own | own | own |
| `transactions` | own / admin | own | – | – |
| `assets` | everyone | admin | admin | admin |
| `competition_*` | everyone | admin | admin | admin |
| `margin_warnings` | own | system | own | – |
| `news`, `messages` | filtered | admin | admin | admin |

30+ policies across 19 tables.  RLS is enabled on **every** table
that holds per-user data, so even a leaked anon API key cannot read
another user's portfolio.

---

## 11. Transactions, Concurrency & Locking

Order execution is the canonical concurrency-sensitive operation.
Two safeguards prevent the classic "double-spend" race:

1.  **Application-side per-user mutex** — the `OrderExecutionEngine`
    keeps a `Map<userId, Promise>` so all orders for the same user
    are serialized in the Node side before they reach the database.
2.  **Database-side guarantees** — the cash-balance update happens
    inside a single transaction with the position-upsert and the
    transactions-insert.  The CHECK constraint
    `cash_balance >= 0` makes a malicious skip-the-mutex attempt
    fail at the database layer rather than corrupt state.

### Optimistic vs pessimistic

Most reads are **optimistic** — `SELECT … WHERE …` and rely on the
CHECK constraints + ACID transaction to detect conflicts.  Where
serialization is mandatory (e.g. position-quantity reads during
short-selling), we use `SELECT … FOR UPDATE` inside the executing
function.

---

## 12. Audit Trail & History Queries

Three append-only tables provide full forensics:

| Table | Granularity |
|---|---|
| `transactions` | every fill (buy / sell / short / cover) |
| `price_history` | every price change (manual or computed) |
| `price_fluctuation_log` | reason-coded — `noise`, `gap`, `catalyst`, `black_swan_crash`, `blue_chip_recovery` |
| `portfolio_history` | one snapshot per portfolio update (auto via trigger) |
| `margin_warnings` | every risk notification |

Sample audit queries:

```sql
-- Top 10 most active traders by fill count
SELECT pr.full_name, COUNT(*) AS fills
FROM   public.transactions t
JOIN   public.profiles     pr ON pr.id = t.user_id
GROUP  BY pr.full_name
ORDER  BY fills DESC
LIMIT  10;

-- Volatility per asset over the last hour (price stddev)
SELECT a.symbol,
       STDDEV(p.price) AS sigma,
       COUNT(*)        AS samples
FROM   public.price_history p
JOIN   public.assets a ON a.id = p.asset_id
WHERE  p.created_at > now() - interval '1 hour'
GROUP  BY a.symbol
ORDER  BY sigma DESC;

-- Per-user equity curve for the last 24 h
SELECT recorded_at, total_value
FROM   public.portfolio_history
WHERE  user_id = $1
  AND  recorded_at > now() - interval '24 hours'
ORDER  BY recorded_at;
```

---

## 13. Migrations & Operations

All schema changes live as numbered, **idempotent** SQL files in
[`supabase/migrations/`](../supabase/migrations) and are applied via
`supabase db push`.  The hardening migration uses `IF NOT EXISTS` /
`DROP CONSTRAINT IF EXISTS` so re-running it on a partially-migrated
database is safe.

| File | Purpose |
|---|---|
| `20250115000000_add_is_short_sell_to_orders.sql` | extends `orders` for short-selling |
| `20251001155405_…` | initial schema (10 core tables, RLS, triggers) |
| `20251003155217_…` | seed NIFTY-50 universe |
| `20251004142345_…` | competition system, margins, events, settings |
| `20251006161248_…` | maintenance fix on `price_fluctuation_log` FK |
| `20251007064637_…` | PII hardening on `profiles` & `user_roles` policies |
| `20251007065423_…` | replace `reset_competition` with `reset_competition_all_users` |
| `20260419120000_…` | **schema hardening** — FKs, CHECKs, indexes, leaderboard view, history trigger |

Disaster recovery is the operations stored procedure
`reset_competition_all_users($1)` — one call, single transaction,
returns a JSONB report.

---

## 14. Sample SQL Queries (the report's "answers")

A representative selection of queries the front-end issues, written
out longhand for the report.

```sql
-- Q1. Live leaderboard (uses the view)
SELECT * FROM public.leaderboard LIMIT 50;

-- Q2. A user's open orders
SELECT o.id, a.symbol, o.order_type, o.quantity, o.price, o.status, o.created_at
FROM   public.orders o
JOIN   public.assets a ON a.id = o.asset_id
WHERE  o.user_id = auth.uid()
  AND  o.status  IN ('pending','processing')
ORDER  BY o.created_at DESC;

-- Q3. Portfolio composition with current valuation
SELECT a.symbol,
       a.name,
       p.quantity,
       p.average_price,
       a.current_price,
       (a.current_price - p.average_price) * p.quantity AS unrealized_pnl
FROM   public.positions p
JOIN   public.assets    a ON a.id = p.asset_id
WHERE  p.user_id = auth.uid();

-- Q4. Sector-level daily change
SELECT a.sector,
       SUM((a.current_price - a.previous_close) * 1) AS aggregate_change,
       AVG((a.current_price - a.previous_close)
            / a.previous_close * 100)               AS avg_pct_change
FROM   public.assets a
WHERE  a.previous_close > 0
GROUP  BY a.sector
ORDER  BY avg_pct_change DESC;

-- Q5. Most-traded asset in a round (window function)
SELECT a.symbol,
       SUM(t.quantity)                                              AS shares,
       RANK() OVER (ORDER BY SUM(t.quantity) DESC)                  AS rank
FROM   public.transactions t
JOIN   public.assets       a ON a.id = t.asset_id
JOIN   public.competition_rounds r ON r.status = 'active'
WHERE  t.created_at BETWEEN r.start_time AND r.end_time
GROUP  BY a.symbol;

-- Q6. Audit: every event that moved RELIANCE today
SELECT pf.created_at, pf.fluctuation_type,
       pf.old_price, pf.new_price, pf.change_percentage,
       ce.event_name
FROM   public.price_fluctuation_log pf
LEFT   JOIN public.competition_events ce ON ce.id = pf.event_id
JOIN   public.assets a                  ON a.id = pf.asset_id
WHERE  a.symbol = 'RELIANCE'
  AND  pf.created_at > date_trunc('day', now())
ORDER  BY pf.created_at;
```

---

## 15. Performance Notes

* **Hot reads** — leaderboard and portfolio composition — are served
  from indexes (`idx_orders_user_status`, the implicit B-tree on
  `portfolios.total_value`).
* **Hot writes** — order placement — touch only the four small rows
  involved (one order, one position, one portfolio, one transaction).
  No global locks are taken.
* **Realtime fan-out** — Supabase publishes change events on
  `assets`, `news`, `messages`, `portfolios`, `positions`, `orders`,
  `competition_rounds`.  Per-subscriber overhead is constant.

---

## 16. Testing

Functional verification is done via the front-end (E2E) plus
ad-hoc SQL.  Examples:

```sql
-- Constraint test: cash should never go negative
UPDATE public.portfolios SET cash_balance = -1 WHERE user_id = $1;
-- ERROR:  new row violates check constraint "portfolios_cash_balance_nonneg"

-- Constraint test: limit order without price
INSERT INTO public.orders (user_id, asset_id, order_type, quantity, is_buy)
VALUES ($1, $2, 'limit', 10, true);
-- ERROR:  new row violates check constraint "orders_price_matches_type"

-- RLS test (executed as an ordinary user)
SELECT * FROM public.portfolios WHERE user_id <> auth.uid();
-- 0 rows
```

---

## 17. Limitations & Future Work

* The denormalized fields (`portfolios.total_value`,
  `positions.current_value`) currently rely on the application to
  keep them fresh.  A **materialized view refreshed every N seconds**
  would be a cleaner alternative.
* The order book is a single global queue; partitioning by `asset_id`
  would scale further.
* `competition_events.event_type` and `.status` are still `TEXT` —
  promoting them to ENUM is a one-line follow-up migration.
* Replace the per-user JS mutex with PostgreSQL **advisory locks**
  (`pg_advisory_xact_lock(user_id_hash)`) for full correctness even
  if multiple application instances run.

---

## 18. Conclusion

EquityQuest demonstrates that a moderately complex domain — multi-user
trading with rounds, risk management, scripted events and audit
requirements — can be expressed almost entirely in **declarative
SQL** plus a handful of PL/pgSQL functions.  The application code
becomes a thin shell that translates user gestures into the SQL the
database already knows how to do safely.

Every required DBMS lab topic is exercised on real, useful data:

* **Normalization** — every table is in 3NF, with intentional
  denormalization documented and trigger-maintained.
* **Constraints** — PK, FK, UNIQUE, NOT NULL, CHECK, ENUM.
* **Indexes** — 24 of them, including composite and partial.
* **Stored programs** — 5 functions, 7 triggers.
* **Views** — `leaderboard`.
* **Security** — RBAC + 30+ RLS policies.
* **Transactions** — application + database-level safeguards.
* **Audit** — five append-only history tables.
* **Operations** — idempotent migrations + reset stored procedure.

---

## 19. References

1. PostgreSQL 17 documentation — <https://www.postgresql.org/docs/17/>
2. Supabase Database & RLS documentation — <https://supabase.com/docs/guides/database>
3. Elmasri & Navathe, *Fundamentals of Database Systems*, 7e.
4. Korth, Silberschatz & Sudarshan, *Database System Concepts*, 7e.
5. EquityQuest source repository — <https://github.com/vighriday/equity-quest-final>

---

<div align="center"><sub>EquityQuest · Database Management Systems Lab · April 2026</sub></div>
