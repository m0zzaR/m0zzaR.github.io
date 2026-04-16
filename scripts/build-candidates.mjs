#!/usr/bin/env node
// Fetches Russell 3000 fundamentals via Financial Modeling Prep, applies the Mayer
// gate, computes the composite 10x score, and writes data/candidates.json.
//
// Env: FMP_API_KEY (required for live builds). MAX_TICKERS caps the number of
// tickers probed per run to stay under the free-tier 250 req/day budget.
//
// Runs on Node 20+ (built-in fetch). No dependencies.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const API_KEY = process.env.FMP_API_KEY;
const MAX_TICKERS = Number(process.env.MAX_TICKERS || 120);
const BASE = 'https://financialmodelingprep.com/api';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'data', 'candidates.json');

// ---- Mayer gate thresholds (from 100 Baggers, Mayer 2015) -------------------
const GATE = {
  marketCapMax: 5_000_000_000,
  marketCapMin: 100_000_000,
  roicMin: 0.15,
  revCagrMin: 0.10,
  epsCagrMin: 0.15,
  debtEquityMax: 0.60,
  insiderMin: 0.05,
};

// ---- Utility ----------------------------------------------------------------
const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

async function fmp(path, params = {}) {
  if (!API_KEY) throw new Error('FMP_API_KEY not set');
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('apikey', API_KEY);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

// ---- Scoring ----------------------------------------------------------------
// Each sub-score is 0-100, then weighted. Weights sum to 1.0.
function scoreGrowth({ revCagr, epsCagr }) {
  const rev = clamp((revCagr / 0.30) * 100);
  const eps = clamp((epsCagr / 0.40) * 100);
  return (rev + eps) / 2;
}

function scoreQuality({ roic, roe, grossMargin }) {
  const r = clamp((roic / 0.30) * 100);
  const e = clamp((roe / 0.30) * 100);
  const g = clamp(((grossMargin - 0.20) / 0.60) * 100);
  return (r + e + g) / 3;
}

function scoreReinvestment({ roic, retention }) {
  const flywheel = roic * retention;
  return clamp((flywheel / 0.25) * 100);
}

function scoreMultipleHeadroom({ pe, sectorMedianPe }) {
  if (!pe || pe <= 0 || !sectorMedianPe) return 50;
  const delta = (sectorMedianPe - pe) / sectorMedianPe;
  return clamp(50 + delta * 100);
}

function scoreSize({ marketCap }) {
  if (!marketCap) return 0;
  const lo = Math.log10(1e8);
  const hi = Math.log10(5e9);
  const t = (hi - Math.log10(marketCap)) / (hi - lo);
  return clamp(20 + t * 80);
}

function scoreInsider({ insider }) {
  return clamp(insider * 400);
}

function composite(s) {
  return Math.round(
    s.growth * 0.30 +
    s.quality * 0.25 +
    s.reinvestment * 0.20 +
    s.headroom * 0.10 +
    s.size * 0.10 +
    s.insider * 0.05
  );
}

function passesGate(r) {
  return (
    r.marketCap >= GATE.marketCapMin &&
    r.marketCap <= GATE.marketCapMax &&
    r.roic >= GATE.roicMin &&
    r.revCagr >= GATE.revCagrMin &&
    r.epsCagr >= GATE.epsCagrMin &&
    r.debtEquity <= GATE.debtEquityMax &&
    r.insider >= GATE.insiderMin
  );
}

// ---- Pipeline ---------------------------------------------------------------
async function fetchUniverse() {
  // Screener cuts ~95% of the universe server-side, spending 1 request.
  const rows = await fmp('/v3/stock-screener', {
    marketCapMoreThan: GATE.marketCapMin,
    marketCapLowerThan: GATE.marketCapMax,
    country: 'US',
    isEtf: 'false',
    isFund: 'false',
    isActivelyTrading: 'true',
    volumeMoreThan: 100_000,
    limit: 3000,
  });
  // Smallest caps first — Mayer's study found median market cap ~$500M.
  // That's where 10x runway lives, so we sample the bottom of the <$5B band.
  return rows.sort((a, b) => a.marketCap - b.marketCap).slice(0, MAX_TICKERS);
}

async function enrich(ticker) {
  const [metrics, growth, profile] = await Promise.all([
    fmp(`/v3/key-metrics-ttm/${ticker}`).catch(() => []),
    fmp(`/v3/financial-growth/${ticker}`, { period: 'annual', limit: 5 }).catch(() => []),
    fmp(`/v3/profile/${ticker}`).catch(() => []),
  ]);
  const km = metrics[0] || {};
  const g5 = growth.slice(0, 5);
  const avg = (k) => g5.length ? g5.reduce((s, r) => s + num(r[k]), 0) / g5.length : 0;
  const p = profile[0] || {};

  return {
    ticker,
    name: p.companyName || ticker,
    sector: p.sector || 'Unknown',
    marketCap: num(p.mktCap || km.marketCapTTM),
    roic: num(km.roicTTM),
    roe: num(km.roeTTM),
    grossMargin: num(km.grossProfitMarginTTM),
    debtEquity: num(km.debtToEquityTTM),
    pe: num(km.peRatioTTM),
    revCagr: avg('revenueGrowth'),
    epsCagr: avg('epsgrowth'),
    retention: clamp(1 - num(km.payoutRatioTTM), 0, 1),
    insider: num(p.insiderOwnership) || 0,
  };
}

function sectorMedianPE(rows) {
  const by = new Map();
  for (const r of rows) {
    if (!r.pe || r.pe <= 0) continue;
    if (!by.has(r.sector)) by.set(r.sector, []);
    by.get(r.sector).push(r.pe);
  }
  const out = new Map();
  for (const [s, arr] of by) {
    arr.sort((a, b) => a - b);
    out.set(s, arr[Math.floor(arr.length / 2)]);
  }
  return out;
}

async function main() {
  console.log(`[build] FMP key=${API_KEY ? 'present' : 'MISSING'}, cap=${MAX_TICKERS}`);
  const universe = await fetchUniverse();
  console.log(`[build] universe after screener: ${universe.length}`);

  const rows = [];
  for (const u of universe) {
    try {
      const r = await enrich(u.symbol);
      rows.push(r);
    } catch (e) {
      console.warn(`[build] ${u.symbol}: ${e.message}`);
    }
  }

  const survivors = rows.filter(passesGate);
  const medians = sectorMedianPE(rows);

  const scored = survivors.map((r) => {
    const components = {
      growth: scoreGrowth(r),
      quality: scoreQuality(r),
      reinvestment: scoreReinvestment(r),
      headroom: scoreMultipleHeadroom({ pe: r.pe, sectorMedianPe: medians.get(r.sector) }),
      size: scoreSize(r),
      insider: scoreInsider(r),
    };
    return { ...r, components, score: composite(components) };
  }).sort((a, b) => b.score - a.score);

  const payload = {
    generatedAt: new Date().toISOString(),
    universeSize: rows.length,
    survivorCount: scored.length,
    gate: GATE,
    weights: { growth: 0.30, quality: 0.25, reinvestment: 0.20, headroom: 0.10, size: 0.10, insider: 0.05 },
    candidates: scored,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2));
  console.log(`[build] wrote ${scored.length} candidates to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
