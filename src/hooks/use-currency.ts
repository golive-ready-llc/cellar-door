"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type CurrencyCode = "USD" | "EUR" | "GBP" | "CAD" | "AUD" | "CHF" | "JPY" | "CNY";

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  label: string;
  locale: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "\u20AC", label: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "\u00A3", label: "British Pound", locale: "en-GB" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar", locale: "en-CA" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar", locale: "en-AU" },
  { code: "CHF", symbol: "CHF", label: "Swiss Franc", locale: "de-CH" },
  { code: "JPY", symbol: "\u00A5", label: "Japanese Yen", locale: "ja-JP" },
  { code: "CNY", symbol: "\u00A5", label: "Chinese Yuan", locale: "zh-CN" },
];

const CURRENCY_KEY = "cellar-door-currency";
const RATES_CACHE_KEY = "cellar-door-fx-rates";
const RATES_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Building an Intl formatter costs ~28µs while formatting with a cached one
 * costs ~0.4µs (measured — `toLocaleString` with an options object builds a
 * new one per call). Every list row displays a price, so the formatters are
 * cached per (locale, currency, decimals). Bounded by the currency list.
 */
const priceFormatters = new Map<string, Intl.NumberFormat>();

function priceFormatter(locale: string, code: CurrencyCode, decimals: number): Intl.NumberFormat {
  const key = `${locale}|${code}|${decimals}`;
  let formatter = priceFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    priceFormatters.set(key, formatter);
  }
  return formatter;
}

/** Cached exchange rates relative to USD */
interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

/**
 * Fetch exchange rates via our same-origin proxy (/api/fx-rates), which
 * forwards to frankfurter.app server-side. Fetching the upstream API
 * directly from the browser fails CORS on mycellardoor.app.
 * Caches in localStorage for 24 hours.
 */
async function getExchangeRates(): Promise<Record<string, number>> {
  try {
    const cached = localStorage.getItem(RATES_CACHE_KEY);
    if (cached) {
      const parsed: RatesCache = JSON.parse(cached);
      if (Date.now() - parsed.fetchedAt < RATES_CACHE_TTL) {
        return parsed.rates;
      }
    }
  } catch {
    // ignore parse errors
  }

  try {
    const res = await fetch("/api/fx-rates");
    if (!res.ok) throw new Error("Rate fetch failed");
    const data = await res.json();
    const rates: Record<string, number> = data.rates ?? { USD: 1 };
    const cache: RatesCache = { rates, fetchedAt: Date.now() };
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(cache));
    return rates;
  } catch {
    // Fallback: return rough rates so app doesn't break
    return { USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.53, CHF: 0.88, JPY: 149, CNY: 7.24 };
  }
}

export function useCurrency() {
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>("USD");
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const ratesLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const stored = localStorage.getItem(CURRENCY_KEY) as CurrencyCode | null;
    if (stored && CURRENCIES.find((c) => c.code === stored)) {
      setCurrencyCode(stored);
    }
    // Load exchange rates once
    if (!ratesLoaded.current) {
      ratesLoaded.current = true;
      getExchangeRates().then((r) => {
        if (!cancelled) setRates(r);
      });
    }

    return () => { cancelled = true; };
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyCode(code);
    localStorage.setItem(CURRENCY_KEY, code);
  }, []);

  const info = CURRENCIES.find((c) => c.code === currencyCode)!;

  /**
   * Convert a USD amount to the selected currency and format it.
   * All prices in the DB are stored in USD — this converts on display.
   */
  const formatPrice = useCallback(
    (amountUsd: number, decimals = 0) => {
      const rate = rates[info.code] ?? 1;
      return priceFormatter(info.locale, info.code, decimals).format(amountUsd * rate);
    },
    [info, rates]
  );

  /**
   * Convert an amount from the selected currency back to USD (for saving to DB).
   */
  const toUsd = useCallback(
    (amountLocal: number) => {
      const rate = rates[info.code] ?? 1;
      return rate > 0 ? amountLocal / rate : amountLocal;
    },
    [info, rates]
  );

  return { currencyCode, setCurrency, info, formatPrice, toUsd, rates };
}
