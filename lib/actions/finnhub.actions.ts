'use server';

import { getDateRange, validateArticle, formatArticle } from '@/lib/utils';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
const NEXT_PUBLIC_FINNHUB_API_KEY = process.env.NEXT_PUBLIC_FINNHUB_API_KEY || '';

async function fetchJSON<T>(url: string, revalidateSeconds?: number): Promise<T> {
  const headers: HeadersInit = { 'X-Finnhub-Token': NEXT_PUBLIC_FINNHUB_API_KEY };
  const init: RequestInit & { next?: { revalidate?: number } } = revalidateSeconds
    ? { headers, cache: 'force-cache', next: { revalidate: revalidateSeconds } }
    : { headers, cache: 'no-store' };

  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Finnhub error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function getNews(symbols?: string[]): Promise<MarketNewsArticle[]> {
  try {
    // If key is missing, still attempt but will likely fail; handled by catch
    const { from, to } = getDateRange(5);

    const cleaned = Array.isArray(symbols)
      ? Array.from(
          new Set(
            symbols
              .map((s) => (typeof s === 'string' ? s.trim().toUpperCase() : ''))
              .filter(Boolean)
          )
        )
      : [];

    // Helper to validate and map
    const mapCompanyArticles = (articles: RawNewsArticle[], symbol: string): MarketNewsArticle[] =>
      articles
        .filter((a) => validateArticle(a))
        .map((a, idx) => formatArticle(a, true, symbol, idx));

    if (cleaned.length > 0) {
      // Prefetch all symbol news once
      const bySymbol = new Map<string, MarketNewsArticle[]>();
      await Promise.all(
        cleaned.map(async (sym) => {
          try {
            const url = `${FINNHUB_BASE_URL}/company-news?symbol=${encodeURIComponent(sym)}&from=${from}&to=${to}`;
            const articles = await fetchJSON<RawNewsArticle[]>(url, 300);
            bySymbol.set(sym, mapCompanyArticles(articles ?? [], sym));
          } catch (e) {
            console.error(`Error fetching company news for ${sym}:`, e);
            bySymbol.set(sym, []);
          }
        })
      );

      // Round-robin pick up to 6
      const result: MarketNewsArticle[] = [];
      const maxItems = 6;
      let picked = 0;
      let round = 0;
      while (picked < maxItems) {
        let tookInThisRound = false;
        for (const sym of cleaned) {
          const list = bySymbol.get(sym) || [];
          if (round < list.length && result.length < maxItems) {
            result.push(list[round]);
            picked++;
            tookInThisRound = true;
            if (picked >= maxItems) break;
          }
        }
        if (!tookInThisRound) break; // all lists exhausted
        round++;
      }

      // Sort by datetime desc
      result.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
      if (result.length > 0) return result;
      // Fallback to general if empty
    }

    // General market news fallback
    const generalUrl = `${FINNHUB_BASE_URL}/news?category=general`;
    const generalArticles = await fetchJSON<RawNewsArticle[]>(generalUrl, 300);

    // Dedup by id/url/headline and take top 6 valid
    const seen = new Set<string>();
    const deduped: MarketNewsArticle[] = [];
    for (const a of generalArticles || []) {
      if (!validateArticle(a)) continue;
      const key = `${a.id}|${a.url}|${a.headline}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(formatArticle(a, false));
      if (deduped.length >= 6) break;
    }

    return deduped;
  } catch (err) {
    console.error('Failed to fetch news:', err);
    throw new Error('Failed to fetch news');
  }
}

//export { FINNHUB_BASE_URL, NEXT_PUBLIC_FINNHUB_API_KEY, fetchJSON };
