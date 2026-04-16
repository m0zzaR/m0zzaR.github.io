#!/usr/bin/env node
// One-shot script to generate a demo data/candidates.json using the SAME
// scoring formulas as build-candidates.mjs, seeded with hand-curated
// approximate fundamentals for ~20 well-known small/mid-cap compounders.
//
// This gives the UI something to render until the real build runs with an
// FMP_API_KEY. The `demo: true` flag in the payload triggers a banner.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..', 'data', 'candidates.json');

const GATE = {
  marketCapMax: 5_000_000_000,
  marketCapMin: 100_000_000,
  roicMin: 0.15,
  revCagrMin: 0.10,
  epsCagrMin: 0.15,
  debtEquityMax: 0.60,
  insiderMin: 0.05,
};

const clamp = (x, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

const scoreGrowth = ({ revCagr, epsCagr }) =>
  (clamp((revCagr / 0.30) * 100) + clamp((epsCagr / 0.40) * 100)) / 2;
const scoreQuality = ({ roic, roe, grossMargin }) =>
  (clamp((roic / 0.30) * 100) + clamp((roe / 0.30) * 100) + clamp(((grossMargin - 0.20) / 0.60) * 100)) / 3;
const scoreReinvestment = ({ roic, retention }) => clamp(((roic * retention) / 0.25) * 100);
const scoreMultipleHeadroom = ({ pe, sectorMedianPe }) => {
  if (!pe || pe <= 0 || !sectorMedianPe) return 50;
  return clamp(50 + ((sectorMedianPe - pe) / sectorMedianPe) * 100);
};
const scoreSize = ({ marketCap }) => {
  if (!marketCap) return 0;
  const lo = Math.log10(1e8), hi = Math.log10(5e9);
  const t = (hi - Math.log10(marketCap)) / (hi - lo);
  return clamp(20 + t * 80);
};
const scoreInsider = ({ insider }) => clamp(insider * 400);

const composite = (s) => Math.round(
  s.growth * 0.30 + s.quality * 0.25 + s.reinvestment * 0.20 +
  s.headroom * 0.10 + s.size * 0.10 + s.insider * 0.05
);

// ~20 candidates with rough public-knowledge fundamentals. Purely illustrative.
// Numbers are approximated to match each company's general profile. These are
// NOT live fundamentals — the weekly GH Action replaces this dataset with real
// data once FMP_API_KEY is configured.
const seed = [
  { ticker: 'KNSL', name: 'Kinsale Capital Group',      sector: 'Financial Services', marketCap: 4_700_000_000, roic: 0.24, roe: 0.28, grossMargin: 0.78, debtEquity: 0.10, pe: 32, revCagr: 0.38, epsCagr: 0.42, retention: 0.95, insider: 0.08 },
  { ticker: 'AAON', name: 'AAON, Inc.',                 sector: 'Industrials',        marketCap: 4_200_000_000, roic: 0.22, roe: 0.24, grossMargin: 0.33, debtEquity: 0.05, pe: 38, revCagr: 0.21, epsCagr: 0.28, retention: 0.80, insider: 0.12 },
  { ticker: 'WING', name: 'Wingstop Inc.',              sector: 'Consumer Cyclical',  marketCap: 3_900_000_000, roic: 0.35, roe: 0.45, grossMargin: 0.55, debtEquity: 0.55, pe: 55, revCagr: 0.27, epsCagr: 0.33, retention: 0.60, insider: 0.06 },
  { ticker: 'MEDP', name: 'Medpace Holdings',           sector: 'Healthcare',         marketCap: 3_600_000_000, roic: 0.42, roe: 0.55, grossMargin: 0.30, debtEquity: 0.08, pe: 22, revCagr: 0.22, epsCagr: 0.30, retention: 1.00, insider: 0.15 },
  { ticker: 'ENSG', name: 'The Ensign Group',           sector: 'Healthcare',         marketCap: 3_400_000_000, roic: 0.17, roe: 0.21, grossMargin: 0.26, debtEquity: 0.40, pe: 20, revCagr: 0.18, epsCagr: 0.22, retention: 0.92, insider: 0.09 },
  { ticker: 'NVEE', name: 'NV5 Global',                 sector: 'Industrials',        marketCap: 1_400_000_000, roic: 0.16, roe: 0.18, grossMargin: 0.28, debtEquity: 0.35, pe: 18, revCagr: 0.20, epsCagr: 0.19, retention: 1.00, insider: 0.11 },
  { ticker: 'SPSC', name: 'SPS Commerce',               sector: 'Technology',         marketCap: 2_800_000_000, roic: 0.18, roe: 0.19, grossMargin: 0.66, debtEquity: 0.02, pe: 42, revCagr: 0.17, epsCagr: 0.21, retention: 1.00, insider: 0.07 },
  { ticker: 'HCI',  name: 'HCI Group',                  sector: 'Financial Services', marketCap: 1_100_000_000, roic: 0.19, roe: 0.33, grossMargin: 0.40, debtEquity: 0.45, pe: 10, revCagr: 0.14, epsCagr: 0.25, retention: 0.70, insider: 0.19 },
  { ticker: 'TREX', name: 'Trex Company',               sector: 'Industrials',        marketCap: 4_900_000_000, roic: 0.26, roe: 0.28, grossMargin: 0.42, debtEquity: 0.15, pe: 28, revCagr: 0.13, epsCagr: 0.17, retention: 1.00, insider: 0.06 },
  { ticker: 'LNTH', name: 'Lantheus Holdings',          sector: 'Healthcare',         marketCap: 4_300_000_000, roic: 0.28, roe: 0.36, grossMargin: 0.61, debtEquity: 0.38, pe: 16, revCagr: 0.31, epsCagr: 0.48, retention: 1.00, insider: 0.05 },
  { ticker: 'BRBR', name: 'BellRing Brands',            sector: 'Consumer Defensive', marketCap: 4_800_000_000, roic: 0.45, roe: 0.60, grossMargin: 0.34, debtEquity: 0.55, pe: 30, revCagr: 0.22, epsCagr: 0.36, retention: 1.00, insider: 0.07 },
  { ticker: 'REVG', name: 'REV Group',                  sector: 'Industrials',        marketCap: 1_500_000_000, roic: 0.16, roe: 0.22, grossMargin: 0.15, debtEquity: 0.48, pe: 12, revCagr: 0.12, epsCagr: 0.19, retention: 0.85, insider: 0.10 },
  { ticker: 'MODG', name: 'Topgolf Callaway Brands',    sector: 'Consumer Cyclical',  marketCap: 2_000_000_000, roic: 0.08, roe: 0.09, grossMargin: 0.33, debtEquity: 0.55, pe: 24, revCagr: 0.18, epsCagr: 0.05, retention: 1.00, insider: 0.08 }, // fails gate (ROIC, EPS)
  { ticker: 'OLLI', name: "Ollie's Bargain Outlet",     sector: 'Consumer Defensive', marketCap: 4_600_000_000, roic: 0.16, roe: 0.17, grossMargin: 0.41, debtEquity: 0.02, pe: 26, revCagr: 0.13, epsCagr: 0.18, retention: 1.00, insider: 0.08 },
  { ticker: 'SITE', name: 'SiteOne Landscape Supply',   sector: 'Industrials',        marketCap: 4_100_000_000, roic: 0.15, roe: 0.18, grossMargin: 0.34, debtEquity: 0.58, pe: 34, revCagr: 0.17, epsCagr: 0.20, retention: 1.00, insider: 0.06 },
  { ticker: 'FIX',  name: 'Comfort Systems USA',        sector: 'Industrials',        marketCap: 4_500_000_000, roic: 0.30, roe: 0.35, grossMargin: 0.21, debtEquity: 0.15, pe: 18, revCagr: 0.23, epsCagr: 0.38, retention: 0.95, insider: 0.06 },
  { ticker: 'IBP',  name: 'Installed Building Products', sector: 'Industrials',       marketCap: 3_100_000_000, roic: 0.19, roe: 0.48, grossMargin: 0.32, debtEquity: 0.59, pe: 14, revCagr: 0.18, epsCagr: 0.30, retention: 0.80, insider: 0.09 },
  { ticker: 'PLMR', name: 'Palomar Holdings',           sector: 'Financial Services', marketCap: 1_700_000_000, roic: 0.21, roe: 0.23, grossMargin: 0.55, debtEquity: 0.12, pe: 22, revCagr: 0.42, epsCagr: 0.35, retention: 1.00, insider: 0.14 },
  { ticker: 'PGNY', name: 'Progyny, Inc.',              sector: 'Healthcare',         marketCap: 1_400_000_000, roic: 0.18, roe: 0.19, grossMargin: 0.22, debtEquity: 0.00, pe: 28, revCagr: 0.48, epsCagr: 0.30, retention: 1.00, insider: 0.06 },
  { ticker: 'WEX',  name: 'WEX Inc.',                   sector: 'Technology',         marketCap: 4_800_000_000, roic: 0.12, roe: 0.14, grossMargin: 0.64, debtEquity: 0.95, pe: 15, revCagr: 0.14, epsCagr: 0.17, retention: 1.00, insider: 0.03 }, // fails gate (D/E, insider, ROIC)
];

const passes = (r) => (
  r.marketCap >= GATE.marketCapMin && r.marketCap <= GATE.marketCapMax &&
  r.roic >= GATE.roicMin && r.revCagr >= GATE.revCagrMin &&
  r.epsCagr >= GATE.epsCagrMin && r.debtEquity <= GATE.debtEquityMax &&
  r.insider >= GATE.insiderMin
);

const survivors = seed.filter(passes);

const bySector = new Map();
for (const r of seed) {
  if (!r.pe) continue;
  if (!bySector.has(r.sector)) bySector.set(r.sector, []);
  bySector.get(r.sector).push(r.pe);
}
const medians = new Map(
  [...bySector.entries()].map(([s, arr]) => {
    arr.sort((a, b) => a - b);
    return [s, arr[Math.floor(arr.length / 2)]];
  })
);

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
  demo: true,
  universeSize: seed.length,
  survivorCount: scored.length,
  gate: GATE,
  weights: { growth: 0.30, quality: 0.25, reinvestment: 0.20, headroom: 0.10, size: 0.10, insider: 0.05 },
  candidates: scored,
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(payload, null, 2));
console.log(`[seed] wrote ${scored.length} demo candidates to ${OUT}`);
