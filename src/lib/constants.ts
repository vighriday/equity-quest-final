// Shared constants for EquityQuest platform
// All financial/competition constants in one place to prevent mismatches

export const STARTING_CAPITAL = 500000; // ₹5,00,000

export const TRANSACTION_FEE_RATE = 0.001; // 0.1% per trade

export const MARGIN = {
  INITIAL_RATE: 0.25, // 25% initial margin for short positions
  MAINTENANCE_RATE: 0.15, // 15% maintenance margin
  WARNING_RATE: 0.18, // 18% margin call warning
} as const;

export const CIRCUIT_LIMITS = {
  EQUITY: 0.10, // ±10% for stocks
  COMMODITY: 0.06, // ±6% for commodities
} as const;

export const SCORING = {
  PNL_WEIGHT: 0.70, // 70% portfolio P&L
  SORTINO_WEIGHT: 0.30, // 30% Sortino Ratio
} as const;

export const ORDER_COOLDOWN_MS = 2000; // 2 second cooldown between orders

export const PRICE_NOISE = {
  MIN_INTERVAL_MS: 3000, // 3 seconds minimum between noise updates
  MAX_INTERVAL_MS: 5000, // 5 seconds maximum
  MIN_FLUCTUATION: -0.005, // -0.5%
  MAX_FLUCTUATION: 0.005, // +0.5%
} as const;

export const TEAM = {
  MAX_MEMBERS: 5,
} as const;
