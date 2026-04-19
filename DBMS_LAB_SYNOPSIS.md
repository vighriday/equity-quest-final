# DBMS LAB SYNOPSIS (ONE PAGE)

## Project Title
EquityQuest: Relational SQL Based Competitive Trading and Portfolio Management System

## Team Details
- Team Name: Team Axiom Ledger
- Student 1: [Name Placeholder] - [Roll No. Placeholder]
- Student 2: [Name Placeholder] - [Roll No. Placeholder]
- Student 3: [Name Placeholder] - [Roll No. Placeholder]

## 1. Abstract
The proposed project, EquityQuest, is a DBMS-oriented multi-user trading simulation platform designed for institutional competition scenarios. The system models real-time order execution, portfolio accounting, margin-aware short selling, event-driven market fluctuations, team participation, and ranked evaluation of users. Unlike basic CRUD projects, this system emphasizes relational integrity, transactional consistency, role-based access control, and analytical reporting. The database layer is designed in generic SQL style and covers operational tables, historical tables, configuration tables, and audit logs. The platform demonstrates practical implementation of DBMS concepts such as normalization, constraints, triggers/functions, controlled state transitions, secure access policies, and query-driven analytics.

## 2. Problem Statement and Need
Conventional academic trading demos fail to enforce strict database constraints for concurrent order updates, position consistency, and risk controls. This creates inconsistent balances, weak auditability, and inaccurate ranking outputs. A robust DBMS-backed design is needed to ensure that each trade, portfolio update, margin check, and event effect is captured deterministically and can be validated by SQL queries.

## 3. Objectives
- Design a normalized relational schema for users, assets, portfolios, positions, orders, events, settings, and history.
- Implement safe order lifecycle handling (pending, processing, executed, failed, cancelled, rejected).
- Enforce business constraints through SQL and service-level validation: position caps, sector exposure caps, short-selling rules, and margin thresholds.
- Maintain complete audit trails for transactions, price changes, warnings, and competition events.
- Generate leaderboard outputs using profit and risk-adjusted performance.

## 4. Proposed SQL Database Design (Complete Coverage)
Major entities: profiles, user_roles, assets, competition_rounds, portfolios, positions, orders, news, messages, team_codes, competition_settings, competition_events, financial_metrics, price_history, price_fluctuation_log, portfolio_history, margin_warnings, admin_messages, transactions.

Key relationships:
- One profile to one portfolio.
- One profile to many positions, orders, transactions, warnings, and messages.
- One asset to many positions, orders, transactions, and price logs.
- One competition round to many competition events.
- One team_code to many profiles.

Integrity and domain constraints:
- Primary keys, foreign keys, and unique constraints (for example, unique asset symbol, unique user-asset position).
- Controlled value domains for role, order type, order status, asset type, round status.
- Numeric precision for money and quantity fields.
- Timestamped history tables for replayability and analytics.

## 5. Core Modules to be Implemented
- Authentication and role module: participant, admin, owner privileges.
- Asset and market data module: stock/commodity master, current and historical price handling.
- Trading engine module: market, limit, and stop-loss order placement and execution.
- Portfolio and position module: cash, holdings, P&L, real-time value recomputation.
- Short-selling and margin module: initial margin, maintenance margin, warning generation, constraint checks.
- Competition module: round management, event scheduling, event execution status.
- Team module: team creation/joining via code and team-wise ranking visibility.
- Communication module: news broadcast, private messages, participant-to-admin messages.
- Admin control module: reset operations, maintenance flags, event triggers, monitoring dashboards.
- Analytics module: leaderboard, transaction history, portfolio history trends, risk-adjusted score.

## 6. DBMS Concepts and SQL Operations Demonstrated
- DDL: schema creation, constraints, indexes, status-domain modeling.
- DML: order insertions, position upserts, portfolio updates, transaction postings.
- Transaction-safe updates for order execution path and post-trade recalculation.
- SQL functions/triggers for auto profile initialization, updated_at handling, and administrative reset operations.
- Policy-driven secure data access for own-data visibility and admin-level control.
- Time-series and log-based analytical queries for scoring and monitoring.

## 7. Business Rules and Validation Logic
- Starting capital initialized to fixed value per participant.
- Transaction fee applied per trade.
- Position limits by asset class and sector concentration constraints.
- Round-wise short-selling enablement policy.
- Margin rules: initial requirement, maintenance threshold, warning threshold.
- Trading halt/event state handling and recovery flow.
- Competition state gating (orders accepted only in valid round status).

## 8. Expected Outputs and Reports
- Live portfolio summary: cash, total value, P&L, percentage return.
- Position-wise and asset-wise exposure reports.
- Order and transaction history with filter/export support.
- Competition leaderboard using weighted score (profitability and risk metric).
- Margin warning report and event execution logs.
- Historical trend report from portfolio_history and price fluctuation logs.

## 9. Hardware and Software Requirements
- Hardware: Standard laptop/desktop (8 GB RAM minimum).
- Software: SQL-compatible RDBMS, modern web stack for client UI, server runtime for business services, version control tools.

## 10. Conclusion
EquityQuest is proposed as an end-to-end DBMS Lab project that integrates schema design, transactional correctness, security, and analytics in one coherent system. It is suitable for academic evaluation because it maps core DBMS theory directly to a realistic multi-table, multi-user, event-driven application and demonstrates comprehensive database engineering rather than basic CRUD implementation.
