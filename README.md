<div align="center">

# EquityQuest

**A multi-user, real-time stock-trading simulation built on a normalized PostgreSQL schema with row-level security, triggers, stored procedures and live publication channels.**

[![React](https://img.shields.io/badge/React-18.3-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Supabase](https://img.shields.io/badge/Supabase-Edge-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)

</div>

---

## Table of Contents

1.  [What is EquityQuest?](#1-what-is-equityquest)
2.  [DBMS Lab Positioning](#2-dbms-lab-positioning)
3.  [Architecture at a Glance](#3-architecture-at-a-glance)
4.  [Database Layer](#4-database-layer)
    -   [Entity-Relationship Overview](#entity-relationship-overview)
    -   [Tables & Relationships](#tables--relationships)
    -   [Stored Procedures, Triggers & Views](#stored-procedures-triggers--views)
    -   [Row-Level Security (RBAC)](#row-level-security-rbac)
5.  [Application Layer](#5-application-layer)
6.  [Edge Functions (Server-Side Jobs)](#6-edge-functions-server-side-jobs)
7.  [Getting Started](#7-getting-started)
8.  [Project Structure](#8-project-structure)
9.  [Build, Test & Deploy](#9-build-test--deploy)
10. [Team & Contributions](#10-team--contributions)
11. [License](#license)

---

## 1. What is EquityQuest?

**EquityQuest** is a competition-style mock stock-trading platform.  Each
participant starts with a virtual ₹500,000, places **market / limit /
stop-loss** orders against a curated NIFTY-50 universe (plus gold / silver
commodities), and competes across three timed rounds while the platform
injects scripted news catalysts, gap moves and the occasional black-swan
crash that triggers an exchange-wide trading halt.

The platform is **multi-tenant from day one**: every order, position and
portfolio row is scoped to its owner by PostgreSQL **row-level security**,
admins live in a separate role, and an **owner** role exists for the
ultimate kill-switch.  All money-affecting operations are wrapped in
PL/pgSQL functions that enforce business rules **inside the database**
so a malicious or buggy client cannot put the system into an
inconsistent state.

| Domain                     | Surface area                                                                 |
|----------------------------|------------------------------------------------------------------------------|
| Entities (tables)          | **19** normalized to 3NF                                                     |
| Stored procedures / triggers | **5 functions, 7 triggers**                                                |
| RLS policies               | **30+** (owner / admin / user)                                               |
| Edge Functions             | **5** (price noise, event executor, margin checker, yFinance, black-swan)   |
| Realtime channels          | **7 tables** published over WebSockets                                       |
| Frontend pages             | **13**                                                                       |
| Custom components          | **17** (excluding shadcn primitives)                                         |
| Lines of TypeScript        | ~16,000                                                                      |

---

## 2. DBMS Lab Positioning

This repository is also the deliverable for our **Database Management
Systems** lab.  When you read it through that lens, the interesting
parts are:

| DBMS concept                     | Where to look                                                      |
|----------------------------------|--------------------------------------------------------------------|
| ER design & 3NF normalization    | [`docs/PROJECT_REPORT.md`](docs/PROJECT_REPORT.md) §3              |
| DDL (CREATE TABLE, ENUM, INDEX)  | [`supabase/migrations/`](supabase/migrations)                      |
| Constraints (PK / FK / CHECK)    | [`20260419120000_schema_hardening_indexes_and_constraints.sql`](supabase/migrations/20260419120000_schema_hardening_indexes_and_constraints.sql) |
| DML examples                     | [`docs/PROJECT_REPORT.md`](docs/PROJECT_REPORT.md) §6              |
| Stored procedures (PL/pgSQL)     | `reset_competition_all_users`, `snapshot_portfolio_history`        |
| Triggers                         | `update_updated_at_column`, `handle_new_user`, `trg_snapshot_*`    |
| Views                            | `public.leaderboard`                                               |
| Indexing strategy                | hardening migration §3 (24 indexes incl. partial)                  |
| RBAC / RLS                       | initial migration §RLS + hardening §RLS                            |
| Transactions & locks             | [`src/services/orderExecution.ts`](src/services/orderExecution.ts) |
| Realtime / publications          | `ALTER PUBLICATION supabase_realtime ADD TABLE …`                  |

The full report, ready to print/submit, lives at
[**docs/PROJECT_REPORT.md**](docs/PROJECT_REPORT.md).

---

## 3. Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────┐
│                       React 18 / TypeScript                    │
│  pages • components • services (singleton engines) • hooks     │
└─────────────────────────┬──────────────────────────────────────┘
                          │   @supabase/supabase-js
                          ▼
┌────────────────────────────────────────────────────────────────┐
│                    Supabase Gateway (REST + WS)                │
│  Auth • PostgREST • Realtime • Edge Functions (Deno)           │
└─────────────────────────┬──────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────┐
│                       PostgreSQL 17                            │
│   19 tables • 5 enums • 5 functions • 7 triggers • 30+ RLS    │
│   policies • supabase_realtime publication on 7 tables         │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Layer

### Entity-Relationship Overview

```
auth.users ─────► profiles ─────► user_roles            (RBAC)
                     │
                     ├──── portfolios (1:1)
                     │         └── positions ──► assets
                     │
                     ├──── orders ────────────► assets
                     ├──── transactions ──────► assets
                     ├──── messages
                     └──── news (published_by)

assets ─────► price_history
       └────► price_fluctuation_log ──► competition_events
       └────► financial_metrics

competition_rounds   competition_settings    portfolio_history
margin_warnings      admin_messages          team_codes
```

### Tables & Relationships

A complete list lives in `docs/PROJECT_REPORT.md`, §4 (DDL).  Every
table has:

* a UUID primary key (`gen_random_uuid()`),
* `created_at` / `updated_at` columns maintained by the
  `update_updated_at_column()` trigger,
* `ON DELETE CASCADE` for child tables (so removing a user reaps
  their portfolio, positions, orders and transactions atomically),
* a CHECK constraint where a business rule applies (e.g.
  `cash_balance >= 0`, `quantity > 0`,
  `(order_type='limit' AND price IS NOT NULL) OR …`).

### Stored Procedures, Triggers & Views

| Object | Type | Purpose |
|---|---|---|
| `has_role(uuid, app_role)` | SQL function | RLS predicate helper |
| `is_admin_or_owner(uuid)` | SQL function | RLS predicate helper |
| `update_updated_at_column()` | trigger fn | maintains `updated_at` on 6 tables |
| `handle_new_user()` | trigger fn (`AFTER INSERT ON auth.users`) | bootstraps profile + role + portfolio |
| `reset_competition_all_users(starting_cash NUMERIC)` | PL/pgSQL `SECURITY DEFINER` | wipes round state, restores cash, returns JSONB summary |
| `snapshot_portfolio_history()` | trigger fn | auto-records P&L history on every portfolio update |
| `public.leaderboard` | view | live ranked portfolio standings |

### Row-Level Security (RBAC)

Three roles live in `app_role`: **`owner`**, **`admin`**, **`user`**.
RLS policies are written using `is_admin_or_owner(auth.uid())` so
adding a fourth role (e.g. `auditor`) is a one-line change.

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | own / admin all | own | own | – |
| `user_roles` | own / admin all | admin | admin | admin |
| `portfolios` | own / admin all | own | own | – |
| `positions`  | own / admin all | own | own | own |
| `orders`     | own / admin all | own | own | own |
| `transactions` | own / admin all | own | – | – |
| `assets` | everyone | admin | admin | admin |
| `competition_*` | everyone | admin | admin | admin |
| `margin_warnings` | own | system | own (`is_read`) | – |
| `news`, `messages` | filtered | admin | admin | admin |

---

## 5. Application Layer

```
src/
├─ pages/          13 routes (Dashboard, Admin, Auth, Leaderboard, …)
├─ components/     custom React components
├─ components/ui/  shadcn primitives (do not edit)
├─ services/       singleton engines (orderExecution, priceNoise, …)
├─ hooks/          useDebounce, useSupabaseChannel
├─ lib/            constants.ts, utils.ts
├─ data/           static asset universe (NIFTY-50)
└─ integrations/   Supabase client + generated DB types
```

Highlights:

* **`OrderExecutionEngine`** ([src/services/orderExecution.ts](src/services/orderExecution.ts))
  serializes per-user orders behind a `Map<userId, Promise>` mutex,
  validates margin, computes weighted-average entry price for partial
  fills and writes the order, position and transaction in a single
  trip.
* **`PriceNoiseService`** ([src/services/priceNoiseService.ts](src/services/priceNoiseService.ts))
  applies independent ±0.5% random walks to every active asset on
  configurable intervals while honouring per-asset circuit limits.
* **`ErrorBoundary`**, **`LoadingSkeleton`**, **`EmptyState`** and
  **`ConfirmDialog`** are app-wide quality primitives.

---

## 6. Edge Functions (Server-Side Jobs)

Located in [`supabase/functions/`](supabase/functions). Deno runtime,
deployed independently:

| Function | Trigger | Tables touched |
|---|---|---|
| `background-price-noise` | scheduled | `assets`, `price_fluctuation_log` |
| `black-swan-event`       | admin | `assets`, `competition_events`, `competition_settings`, `news`, `price_fluctuation_log` |
| `check-margins`          | scheduled | `positions`, `portfolios`, `margin_warnings`, `orders` |
| `execute-event`          | admin / scheduler | `competition_events`, `assets`, `price_fluctuation_log` |
| `fetch-yfinance-data`    | manual | `assets`, `financial_metrics` |

---

## 7. Getting Started

### Prerequisites

* **Node ≥ 20** (or Bun ≥ 1.1)
* **Supabase project** — free tier is fine
* PostgreSQL extensions: `uuid-ossp`, `pgcrypto` (enabled by default on Supabase)

### Setup

```bash
# 1. Clone
git clone https://github.com/vighriday/equity-quest-final.git
cd equity-quest-final

# 2. Install
npm install     # or:  bun install

# 3. Configure
cp .env.example .env
#   fill in:
#     VITE_SUPABASE_URL
#     VITE_SUPABASE_ANON_KEY        (and PROJECT_ID / PUBLISHABLE_KEY)

# 4. Run migrations against your Supabase project
supabase link --project-ref <your-ref>
supabase db push

# 5. Start the dev server
npm run dev      # http://localhost:8080
```

### One-shot reset

To wipe all competition state (orders, positions, transactions,
margin warnings) and restore everyone to the starting cash:

```sql
SELECT public.reset_competition_all_users(500000);
```

(Only callable by users with the `admin` or `owner` role.)

---

## 8. Project Structure

```
equity-quest-final/
├─ src/
│  ├─ pages/                Route components
│  ├─ components/           App-specific React components
│  ├─ components/ui/        shadcn/ui primitives
│  ├─ services/             Business-logic engines (singletons)
│  ├─ hooks/                Custom React hooks
│  ├─ lib/                  constants.ts, utils.ts
│  ├─ data/                 Static asset universe
│  └─ integrations/supabase Generated types + client
├─ supabase/
│  ├─ migrations/           DDL (versioned, idempotent)
│  └─ functions/            Edge functions (Deno)
├─ docs/
│  └─ PROJECT_REPORT.md     Full DBMS lab report
└─ public/                  Static assets
```

---

## 9. Build, Test & Deploy

```bash
npm run dev       # Vite dev server
npm run build     # production bundle into dist/
npm run lint      # ESLint
npm run preview   # serve production bundle locally
```

Deployment is configured for **Vercel** ([`vercel.json`](vercel.json)).
The `dist/` directory is a fully static SPA; all dynamic behaviour
runs in Supabase.

---

## 10. Team & Contributions

| Member | Role |
|---|---|
| **Hemant Taneja** | Schema design — normalized SQL schema with keys, constraints, table relationships for users, assets, portfolios, orders, events, logs |
| **Hriday Vig** | Business rules — order states, margin checks, short-selling control, position limits, round-based validation |
| **Dhruv Mohapatra** | Security & operations — role policies, access control, migration handling, reset functions, audit/history queries |

---

## License

This project is licensed under the MIT License — see the `LICENSE`
file (or the badge at the top) for details.

---

<div align="center">
  <sub>EquityQuest · Built for the DBMS Lab · 2026</sub>
</div>
