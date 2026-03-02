// NIFTY 50 stocks and commodities with yFinance tickers
export const nifty50Assets = [
  // Banking & Financial Services
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Banking", yfinance_ticker: "HDFCBANK.NS" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Banking", yfinance_ticker: "ICICIBANK.NS" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Banking", yfinance_ticker: "SBIN.NS" },
  { symbol: "AXISBANK", name: "Axis Bank Ltd", sector: "Banking", yfinance_ticker: "AXISBANK.NS" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd", sector: "Banking", yfinance_ticker: "KOTAKBANK.NS" },
  { symbol: "INDUSINDBK", name: "IndusInd Bank Ltd", sector: "Banking", yfinance_ticker: "INDUSINDBK.NS" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", sector: "Financial Services", yfinance_ticker: "BAJFINANCE.NS" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv Ltd", sector: "Financial Services", yfinance_ticker: "BAJAJFINSV.NS" },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance Co Ltd", sector: "Financial Services", yfinance_ticker: "HDFCLIFE.NS" },
  { symbol: "SBILIFE", name: "SBI Life Insurance Co Ltd", sector: "Financial Services", yfinance_ticker: "SBILIFE.NS" },

  // Information Technology
  { symbol: "TCS", name: "Tata Consultancy Services Ltd", sector: "IT", yfinance_ticker: "TCS.NS" },
  { symbol: "INFY", name: "Infosys Ltd", sector: "IT", yfinance_ticker: "INFY.NS" },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd", sector: "IT", yfinance_ticker: "HCLTECH.NS" },
  { symbol: "WIPRO", name: "Wipro Ltd", sector: "IT", yfinance_ticker: "WIPRO.NS" },
  { symbol: "TECHM", name: "Tech Mahindra Ltd", sector: "IT", yfinance_ticker: "TECHM.NS" },
  { symbol: "LTIM", name: "LTI Mindtree Ltd", sector: "IT", yfinance_ticker: "LTIM.NS" },

  // Oil & Gas
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Oil & Gas", yfinance_ticker: "RELIANCE.NS" },
  { symbol: "ONGC", name: "Oil & Natural Gas Corp Ltd", sector: "Oil & Gas", yfinance_ticker: "ONGC.NS" },
  { symbol: "BPCL", name: "Bharat Petroleum Corp Ltd", sector: "Oil & Gas", yfinance_ticker: "BPCL.NS" },
  { symbol: "IOC", name: "Indian Oil Corp Ltd", sector: "Oil & Gas", yfinance_ticker: "IOC.NS" },

  // Automobile
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd", sector: "Automobile", yfinance_ticker: "MARUTI.NS" },
  { symbol: "M&M", name: "Mahindra & Mahindra Ltd", sector: "Automobile", yfinance_ticker: "M&M.NS" },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Automobile", yfinance_ticker: "TATAMOTORS.NS" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd", sector: "Automobile", yfinance_ticker: "BAJAJ-AUTO.NS" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd", sector: "Automobile", yfinance_ticker: "HEROMOTOCO.NS" },
  { symbol: "EICHERMOT", name: "Eicher Motors Ltd", sector: "Automobile", yfinance_ticker: "EICHERMOT.NS" },

  // FMCG
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", sector: "FMCG", yfinance_ticker: "HINDUNILVR.NS" },
  { symbol: "ITC", name: "ITC Ltd", sector: "FMCG", yfinance_ticker: "ITC.NS" },
  { symbol: "NESTLEIND", name: "Nestle India Ltd", sector: "FMCG", yfinance_ticker: "NESTLEIND.NS" },
  { symbol: "BRITANNIA", name: "Britannia Industries Ltd", sector: "FMCG", yfinance_ticker: "BRITANNIA.NS" },
  { symbol: "DABUR", name: "Dabur India Ltd", sector: "FMCG", yfinance_ticker: "DABUR.NS" },

  // Pharmaceuticals
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd", sector: "Pharmaceuticals", yfinance_ticker: "SUNPHARMA.NS" },
  { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories Ltd", sector: "Pharmaceuticals", yfinance_ticker: "DRREDDY.NS" },
  { symbol: "CIPLA", name: "Cipla Ltd", sector: "Pharmaceuticals", yfinance_ticker: "CIPLA.NS" },
  { symbol: "DIVISLAB", name: "Divi's Laboratories Ltd", sector: "Pharmaceuticals", yfinance_ticker: "DIVISLAB.NS" },

  // Telecom
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", sector: "Telecom", yfinance_ticker: "BHARTIARTL.NS" },

  // Metals & Mining
  { symbol: "TATASTEEL", name: "Tata Steel Ltd", sector: "Metals", yfinance_ticker: "TATASTEEL.NS" },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd", sector: "Metals", yfinance_ticker: "JSWSTEEL.NS" },
  { symbol: "HINDALCO", name: "Hindalco Industries Ltd", sector: "Metals", yfinance_ticker: "HINDALCO.NS" },
  { symbol: "COALINDIA", name: "Coal India Ltd", sector: "Mining", yfinance_ticker: "COALINDIA.NS" },

  // Power & Utilities
  { symbol: "NTPC", name: "NTPC Ltd", sector: "Power", yfinance_ticker: "NTPC.NS" },
  { symbol: "POWERGRID", name: "Power Grid Corp of India Ltd", sector: "Power", yfinance_ticker: "POWERGRID.NS" },

  // Cement
  { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd", sector: "Cement", yfinance_ticker: "ULTRACEMCO.NS" },
  { symbol: "SHREECEM", name: "Shree Cement Ltd", sector: "Cement", yfinance_ticker: "SHREECEM.NS" },

  // Construction & Infrastructure
  { symbol: "LT", name: "Larsen & Toubro Ltd", sector: "Construction", yfinance_ticker: "LT.NS" },
  { symbol: "ADANIPORTS", name: "Adani Ports & Special Economic Zone Ltd", sector: "Infrastructure", yfinance_ticker: "ADANIPORTS.NS" },

  // Consumer Durables
  { symbol: "TITAN", name: "Titan Company Ltd", sector: "Consumer Durables", yfinance_ticker: "TITAN.NS" },

  // Media & Entertainment
  { symbol: "ZEEL", name: "Zee Entertainment Enterprises Ltd", sector: "Media", yfinance_ticker: "ZEEL.NS" },

  // Chemicals
  { symbol: "UPL", name: "UPL Ltd", sector: "Chemicals", yfinance_ticker: "UPL.NS" },

  // Real Estate
  { symbol: "DLF", name: "DLF Ltd", sector: "Real Estate", yfinance_ticker: "DLF.NS" },

  // Airlines
  { symbol: "INDIGO", name: "InterGlobe Aviation Ltd", sector: "Airlines", yfinance_ticker: "INDIGO.NS" },

  // Commodities
  { symbol: "GOLD", name: "Gold", sector: "Commodities", yfinance_ticker: "GC=F" },
  { symbol: "SILVER", name: "Silver", sector: "Commodities", yfinance_ticker: "SI=F" },
  { symbol: "CRUDE", name: "Crude Oil", sector: "Commodities", yfinance_ticker: "CL=F" },
  { symbol: "COPPER", name: "Copper", sector: "Commodities", yfinance_ticker: "HG=F" },
  { symbol: "STEEL", name: "Steel", sector: "Commodities", yfinance_ticker: "SLX" },
  { symbol: "ALUMINUM", name: "Aluminum", sector: "Commodities", yfinance_ticker: "ALI=F" },

  // Index
  { symbol: "NIFTY", name: "Nifty 50", sector: "Index", yfinance_ticker: "^NSEI" }
];

// Sector mapping for easy filtering
export const sectors = [
  "Banking",
  "Financial Services", 
  "IT",
  "Oil & Gas",
  "Automobile",
  "FMCG",
  "Pharmaceuticals",
  "Telecom",
  "Metals",
  "Mining",
  "Power",
  "Cement",
  "Construction",
  "Infrastructure",
  "Consumer Durables",
  "Media",
  "Chemicals",
  "Real Estate",
  "Airlines",
  "Commodities",
  "Index"
];

// Blue-chip stocks for Black Swan recovery
export const blueChipStocks = [
  "RELIANCE",
  "HINDUNILVR", 
  "INFY",
  "TCS",
  "HDFCBANK",
  "ICICIBANK",
  "ITC",
  "BHARTIARTL"
];
