import { SymbolCode, SymbolConfig } from '../types/market';

export const SYMBOL_CONFIGS: Record<string, SymbolConfig> = {
  EURUSD: {
    code: 'EURUSD',
    name: 'EUR/USD - Euro vs US Dollar',
    pipValue: 0.0001,
    tickSize: 0.00001,
    tpoPriceStep: 0.0002,
    defaultSessionStart: '07:00',
    defaultSessionEnd: '16:00',
    timezone: 'UTC',
    basePrice: 1.14710,
    decimalPlaces: 5,
  },
  GBPUSD: {
    code: 'GBPUSD',
    name: 'GBP/USD - British Pound vs US Dollar',
    pipValue: 0.0001,
    tickSize: 0.00001,
    tpoPriceStep: 0.0002, // 2 pips per TPO row
    defaultSessionStart: '08:00',
    defaultSessionEnd: '16:30',
    timezone: 'UTC',
    basePrice: 1.33670,
    decimalPlaces: 5,
  },
  USDJPY: {
    code: 'USDJPY',
    name: 'USD/JPY - US Dollar vs Japanese Yen',
    pipValue: 0.01,
    tickSize: 0.001,
    tpoPriceStep: 0.02,
    defaultSessionStart: '00:00',
    defaultSessionEnd: '09:00',
    timezone: 'UTC',
    basePrice: 163.83,
    decimalPlaces: 3,
  },
  AUDUSD: {
    code: 'AUDUSD',
    name: 'AUD/USD - Australian Dollar vs US Dollar',
    pipValue: 0.0001,
    tickSize: 0.00001,
    tpoPriceStep: 0.0002,
    defaultSessionStart: '00:00',
    defaultSessionEnd: '08:00',
    timezone: 'UTC',
    basePrice: 0.6975,
    decimalPlaces: 5,
  },
  USDCHF: {
    code: 'USDCHF',
    name: 'USD/CHF - US Dollar vs Swiss Franc',
    pipValue: 0.0001,
    tickSize: 0.00001,
    tpoPriceStep: 0.0002,
    defaultSessionStart: '07:00',
    defaultSessionEnd: '16:00',
    timezone: 'UTC',
    basePrice: 0.8194,
    decimalPlaces: 5,
  },
  USDCAD: {
    code: 'USDCAD',
    name: 'USD/CAD - US Dollar vs Canadian Dollar',
    pipValue: 0.0001,
    tickSize: 0.00001,
    tpoPriceStep: 0.0002,
    defaultSessionStart: '12:00',
    defaultSessionEnd: '20:00',
    timezone: 'UTC',
    basePrice: 1.4104,
    decimalPlaces: 5,
  },
  NZDUSD: {
    code: 'NZDUSD',
    name: 'NZD/USD - New Zealand Dollar vs US Dollar',
    pipValue: 0.0001,
    tickSize: 0.00001,
    tpoPriceStep: 0.0002,
    defaultSessionStart: '22:00',
    defaultSessionEnd: '06:00',
    timezone: 'UTC',
    basePrice: 0.5779,
    decimalPlaces: 5,
  },
  GBPJPY: {
    code: 'GBPJPY',
    name: 'GBP/JPY - British Pound vs Japanese Yen',
    pipValue: 0.01,
    tickSize: 0.001,
    tpoPriceStep: 0.04,
    defaultSessionStart: '08:00',
    defaultSessionEnd: '16:30',
    timezone: 'UTC',
    basePrice: 217.72,
    decimalPlaces: 3,
  },
  XAUUSD: {
    code: 'XAUUSD',
    name: 'XAU/USD - Gold Spot vs US Dollar',
    pipValue: 0.1,
    tickSize: 0.01,
    tpoPriceStep: 0.50,
    defaultSessionStart: '00:00',
    defaultSessionEnd: '23:59',
    timezone: 'UTC',
    basePrice: 2420.00,
    decimalPlaces: 2,
  },
  BTCUSD: {
    code: 'BTCUSD',
    name: 'BTC/USD - Bitcoin vs US Dollar',
    pipValue: 1.0,
    tickSize: 0.1,
    tpoPriceStep: 100.0,
    defaultSessionStart: '00:00',
    defaultSessionEnd: '23:59',
    timezone: 'UTC',
    basePrice: 63860.00,
    decimalPlaces: 2,
  },
  ETHUSD: {
    code: 'ETHUSD',
    name: 'ETH/USD - Ethereum vs US Dollar',
    pipValue: 1.0,
    tickSize: 0.01,
    tpoPriceStep: 10.0,
    defaultSessionStart: '00:00',
    defaultSessionEnd: '23:59',
    timezone: 'UTC',
    basePrice: 1913.50,
    decimalPlaces: 2,
  },
};

export const DEFAULT_SYMBOL: SymbolCode = 'GBPUSD';

export function getAvailableSymbols(): SymbolCode[] {
  return Object.keys(SYMBOL_CONFIGS) as SymbolCode[];
}

export function formatPrice(price: number, symbol: SymbolCode = 'GBPUSD'): string {
  const config = SYMBOL_CONFIGS[symbol];
  const decimals = config?.decimalPlaces ?? (symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('XAU') ? 2 : symbol.includes('JPY') ? 3 : 5);
  return price.toFixed(decimals);
}

export function getSymbolConfig(symbol: SymbolCode): SymbolConfig {
  return SYMBOL_CONFIGS[symbol] || {
    code: symbol,
    name: `${symbol} - Asset`,
    pipValue: symbol.includes('BTC') || symbol.includes('ETH') ? 1.0 : symbol.includes('JPY') ? 0.01 : 0.0001,
    tickSize: symbol.includes('BTC') ? 0.1 : symbol.includes('ETH') ? 0.01 : symbol.includes('JPY') ? 0.001 : 0.00001,
    tpoPriceStep: symbol.includes('BTC') ? 100.0 : symbol.includes('ETH') ? 10.0 : symbol.includes('JPY') ? 0.02 : 0.0002,
    defaultSessionStart: '00:00',
    defaultSessionEnd: '23:59',
    timezone: 'UTC',
    basePrice: 1.0000,
    decimalPlaces: symbol.includes('BTC') || symbol.includes('ETH') ? 2 : symbol.includes('JPY') ? 3 : 5,
  };
}
