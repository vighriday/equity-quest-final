# EquityQuest Newbie Guide (Concise but Complete)

## 1) What This Project Is
EquityQuest is a stock trading competition platform.
Users get virtual capital, place trades, manage portfolios, and compete on a leaderboard.
The app supports:
- Real-time price movement
- Market, limit, and stop-loss orders
- Short selling with margin rules
- Team participation
- Admin-controlled rounds/events/resets

In simple words: it is a full trading simulation with database-backed rules and analytics.

## 2) High-Level Architecture
The project has 3 practical layers:
- Frontend (React + TypeScript): pages, UI, forms, live updates
- Service layer (TypeScript business logic): order execution, scoring, price noise, events, reset flows
- Database layer (SQL schema + policies + functions): users, assets, portfolios, orders, history, security rules

Main folders:
- src/pages: route-level screens (Dashboard, Leaderboard, Admin, Team, Transactions, etc.)
- src/components: reusable UI and trading widgets
- src/services: core business logic engines
- supabase/migrations: SQL schema evolution and DB rules
- supabase/functions: serverless jobs/utilities used by the platform

## 3) Main Features (What Exists)
- Authentication and role model (owner/admin/user)
- Asset catalog (NIFTY-like stocks + commodities)
- Portfolio and position tracking
- Order lifecycle management
- Transaction logging and history export
- Margin warning system
- Competition rounds and events
- Black swan shock scenario + temporary trading halt
- Team code based collaboration
- Messaging/news channels
- Weighted leaderboard scoring (P&L + Sortino)
- Admin maintenance/reset controls

## 4) Core Pages and Their Purpose
- Index/Auth: onboarding and login/signup
- Dashboard: place orders, view positions, cash, P&L, market overview
- Leaderboard: rank participants by final score
- TransactionHistory: all orders with filters/pagination/CSV export
- TeamManagement: create/join team and view team standings
- Messages: user messages and tips
- MarketAnalysis: market/sector understanding UI
- Admin: round controls, event trigger, resets, settings, monitoring

## 5) Core Services (Where Logic Lives)
- orderExecution.ts:
  - Validates order rules
  - Checks funds/positions/margins
  - Executes updates to portfolio + positions + transactions
  - Handles user-level locking to avoid conflicting simultaneous orders
- portfolioScoring.ts:
  - Builds performance metrics
  - Computes Sortino ratio
  - Computes final score and ranks
- priceNoiseService.ts:
  - Applies periodic random price movements
  - Logs every fluctuation
- blackSwanEvent.ts:
  - Triggers major crash event
  - Temporarily halts trading
  - Applies partial recovery for selected blue-chip assets
- competitionReset.ts:
  - Granular reset of operational tables and portfolio state
- globalServiceManager.ts:
  - Starts and coordinates background services

## 6) Database Design (Entity Groups)
Identity and access:
- profiles, user_roles

Trading core:
- assets, portfolios, positions, orders, transactions

Competition and config:
- competition_rounds, competition_settings, competition_events, team_codes

History and analytics:
- price_history, price_fluctuation_log, portfolio_history

Alerts and communication:
- margin_warnings, news, messages, admin_messages

## 7) Important Rules Enforced
- Starting capital per user portfolio
- Transaction fee per executed trade
- Position size limits by asset type
- Sector concentration cap
- Short selling allowed only when enabled for round
- Initial and maintenance margin rules
- Competition round status gates order acceptance
- Role-based data permissions and admin-only operations

## 8) Order Lifecycle (Beginner View)
1. User creates an order from Dashboard
2. System stores order as pending
3. Execution engine validates constraints
4. If valid:
   - updates positions
   - updates cash/portfolio values
   - writes transaction log
   - marks order executed
5. If invalid:
   - marks failed/rejected with reason

This guarantees consistent state after each trade.

## 9) How Real-Time Behavior Works
- Asset price updates come from noise/event services
- Frontend listens for DB changes and refreshes UI
- Portfolio and leaderboard values update as data changes
- Margin warnings/events appear automatically based on thresholds

## 10) Admin Control Surface
Admin can:
- Manage competition rounds
- Trigger black swan/event mechanics
- Adjust/reset competition data
- Manage settings (margin, short selling, team size, halt/maintenance)
- Manage assets/news and monitor users

## 11) If You Are New: How to Understand Fast
Read in this order:
1. README.md (overall vision)
2. src/pages/Dashboard.tsx (main user flow)
3. src/services/orderExecution.ts (critical trading logic)
4. supabase/migrations/*.sql (actual DB truth)
5. src/services/portfolioScoring.ts (leaderboard logic)
6. src/pages/Admin.tsx (operations and controls)

## 12) What Makes This a Strong DBMS Project
- Rich relational schema (not a simple CRUD app)
- Strong constraints and controlled status flows
- Security policies and role separation
- Historical/audit tables for traceability
- Transaction-heavy business logic with consistency checks
- Analytical outputs (score, ranking, history trends)

This is a complete database-driven simulation platform, not just a frontend demo.

## 13) 3-Member Contribution Split (Report Ready)
Use this section directly in submission output.

- Student 1: [Name Placeholder] - Database and DBMS Core
  - Designed and evolved relational schema (core + extended tables)
  - Defined keys, relationships, constraints, and status domains
  - Implemented data security model (role access and row-level policies)
  - Created reset and utility DB functions, migration flow, and data integrity rules
  - Prepared SQL-level audit/history structure (transactions, portfolio history, price logs)

- Student 2: [Name Placeholder] - Trading Engine and Business Logic
  - Implemented order execution pipeline (market/limit/stop-loss)
  - Added risk controls: position limits, sector caps, margin checks, short-selling rules
  - Built portfolio recalculation and scoring logic (P&L + Sortino based ranking)
  - Implemented event mechanics (price noise, black swan, trading halt, recovery)
  - Developed competition reset/control services and consistency handling in service layer

- Student 3: [Name Placeholder] - Frontend, UX, and Integration
  - Built user-facing pages (Dashboard, Leaderboard, Team Management, Transactions, Messages, Admin)
  - Connected frontend to database/services with real-time updates and state refresh
  - Implemented trading forms, validation feedback, filters, pagination, and CSV export UX
  - Integrated admin control workflows (event trigger, monitoring, settings operations)
  - Coordinated end-to-end testing flow and documentation for beginner onboarding

Combined team outcome:
- Delivered a full-stack DBMS project with strong schema design, rule-based transaction handling, real-time workflows, and analytics-ready reporting.
