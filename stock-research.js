// 10X Screener — client-side filter / sort / render for data/candidates.json.
// The screener gate is applied server-side (in build-candidates.mjs). On the
// client, users tighten thresholds further to narrow the survivor set.

(function () {
    'use strict';

    const $ = (sel) => document.querySelector(sel);
    const fmtPct = (x) => (x * 100).toFixed(1) + '%';
    const fmtCap = (x) => {
        if (!x) return '—';
        if (x >= 1e9) return '$' + (x / 1e9).toFixed(2) + 'B';
        if (x >= 1e6) return '$' + (x / 1e6).toFixed(0) + 'M';
        return '$' + x.toFixed(0);
    };
    const fmtRatio = (x) => (x || 0).toFixed(2);
    const fmtNum = (x) => (x || 0).toFixed(1);

    const state = {
        payload: null,
        filters: {
            roic: 0.15,
            revCagr: 0.10,
            epsCagr: 0.15,
            marketCap: 5_000_000_000,
            debtEquity: 0.60,
            insider: 0.05,
            score: 0,
            sector: '',
            search: '',
        },
        sort: 'score',
        expanded: new Set(),
    };

    // ---- Metric cell coloring — green if strong, neutral otherwise ----------
    const cellClass = {
        roic:      (v) => v >= 0.25 ? 'cell-good' : v >= 0.15 ? 'cell-mid' : 'cell-weak',
        revCagr:   (v) => v >= 0.20 ? 'cell-good' : v >= 0.10 ? 'cell-mid' : 'cell-weak',
        epsCagr:   (v) => v >= 0.25 ? 'cell-good' : v >= 0.15 ? 'cell-mid' : 'cell-weak',
        debtEquity:(v) => v <= 0.30 ? 'cell-good' : v <= 0.60 ? 'cell-mid' : 'cell-weak',
        insider:   (v) => v >= 0.10 ? 'cell-good' : v >= 0.05 ? 'cell-mid' : 'cell-weak',
    };

    // ---- Render -------------------------------------------------------------
    function renderStats() {
        const p = state.payload;
        $('#stat-universe').textContent = p.universeSize.toLocaleString();
        $('#stat-survivors').textContent = p.survivorCount.toLocaleString();
        const d = new Date(p.generatedAt);
        $('#stat-updated').textContent =
            d.getUTCFullYear() + '-' +
            String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
            String(d.getUTCDate()).padStart(2, '0');
        if (p.demo) $('#demo-banner').hidden = false;
    }

    function populateSectors() {
        const sectors = [...new Set(state.payload.candidates.map((c) => c.sector))].sort();
        const sel = $('#filter-sector');
        for (const s of sectors) {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s.toUpperCase();
            sel.appendChild(opt);
        }
    }

    function applyFilters() {
        const f = state.filters;
        const term = f.search.trim().toLowerCase();
        return state.payload.candidates.filter((c) =>
            c.roic        >= f.roic &&
            c.revCagr     >= f.revCagr &&
            c.epsCagr     >= f.epsCagr &&
            c.marketCap   <= f.marketCap &&
            c.debtEquity  <= f.debtEquity &&
            c.insider     >= f.insider &&
            c.score       >= f.score &&
            (!f.sector || c.sector === f.sector) &&
            (!term || c.ticker.toLowerCase().includes(term) || c.name.toLowerCase().includes(term))
        );
    }

    function sortRows(rows) {
        const key = state.sort;
        const pick = {
            score:     (r) => r.score,
            growth:    (r) => r.components.growth,
            quality:   (r) => r.components.quality,
            roic:      (r) => r.roic,
            marketCap: (r) => -r.marketCap,  // smaller first (more 10x runway)
            insider:   (r) => r.insider,
        }[key] || ((r) => r.score);
        return rows.slice().sort((a, b) => pick(b) - pick(a));
    }

    function renderRow(r) {
        const expanded = state.expanded.has(r.ticker);
        const tr = document.createElement('tr');
        tr.dataset.ticker = r.ticker;
        tr.innerHTML = `
            <td class="col-ticker">${r.ticker}</td>
            <td class="col-name">${escapeHtml(r.name)}</td>
            <td class="col-sector">${escapeHtml(r.sector)}</td>
            <td class="col-num">${fmtCap(r.marketCap)}</td>
            <td class="col-num ${cellClass.roic(r.roic)}">${fmtPct(r.roic)}</td>
            <td class="col-num ${cellClass.revCagr(r.revCagr)}">${fmtPct(r.revCagr)}</td>
            <td class="col-num ${cellClass.epsCagr(r.epsCagr)}">${fmtPct(r.epsCagr)}</td>
            <td class="col-num ${cellClass.debtEquity(r.debtEquity)}">${fmtRatio(r.debtEquity)}</td>
            <td class="col-num ${cellClass.insider(r.insider)}">${fmtPct(r.insider)}</td>
            <td class="col-num">${r.pe ? fmtNum(r.pe) : '—'}</td>
            <td class="col-num col-score">${r.score}</td>
        `;
        tr.addEventListener('click', () => {
            if (state.expanded.has(r.ticker)) state.expanded.delete(r.ticker);
            else state.expanded.add(r.ticker);
            render();
        });
        const rows = [tr];
        if (expanded) rows.push(renderDetail(r));
        return rows;
    }

    function renderDetail(r) {
        const comps = [
            ['GROWTH',       r.components.growth,       0.30],
            ['QUALITY',      r.components.quality,      0.25],
            ['REINVESTMENT', r.components.reinvestment, 0.20],
            ['HEADROOM',     r.components.headroom,     0.10],
            ['SIZE',         r.components.size,         0.10],
            ['INSIDER',      r.components.insider,      0.05],
        ];
        const bars = comps.map(([label, value, weight]) => `
            <div class="score-bar-row">
                <div class="score-bar-label">${label} · ${Math.round(weight * 100)}%</div>
                <div class="score-bar-track"><div class="score-bar-fill" style="width:${Math.min(100, value)}%"></div></div>
                <div class="score-bar-value">${Math.round(value)}</div>
            </div>
        `).join('');

        const tr = document.createElement('tr');
        tr.className = 'detail-row';
        tr.innerHTML = `
            <td colspan="11">
                <div class="detail-grid">
                    <div>
                        <div class="detail-section-title">SCORE BREAKDOWN · ${r.score}/100</div>
                        <div class="score-bars">${bars}</div>
                    </div>
                    <div class="detail-rationale">
                        <div class="detail-section-title">WHY IT SCORED THIS WAY</div>
                        ${rationaleLines(r).map((l) => `<p>${l}</p>`).join('')}
                    </div>
                </div>
            </td>
        `;
        return tr;
    }

    function rationaleLines(r) {
        const lines = [];
        if (r.revCagr >= 0.20 && r.epsCagr >= 0.25) {
            lines.push(`<strong>Twin engines firing.</strong> Revenue ${fmtPct(r.revCagr)} and EPS ${fmtPct(r.epsCagr)} over 5yr — the signature Mayer found in 100-baggers.`);
        } else if (r.revCagr >= 0.10 && r.epsCagr >= 0.15) {
            lines.push(`Growth clears the Mayer gate (rev ${fmtPct(r.revCagr)}, EPS ${fmtPct(r.epsCagr)}) but isn't explosive.`);
        }
        if (r.roic >= 0.25) {
            lines.push(`<strong>Exceptional capital efficiency.</strong> ROIC of ${fmtPct(r.roic)} signals a compounding machine — Mayer's most important single signal.`);
        } else if (r.roic >= 0.15) {
            lines.push(`ROIC of ${fmtPct(r.roic)} clears the 15% floor, suggesting a decent capital-efficient business.`);
        }
        if (r.retention >= 0.9 && r.roic >= 0.15) {
            lines.push(`Retains ${fmtPct(r.retention)} of earnings and redeploys at ${fmtPct(r.roic)} — maximum reinvestment runway.`);
        }
        if (r.insider >= 0.10) {
            lines.push(`Insiders own ${fmtPct(r.insider)} — skin in the game typical of founder-led compounders.`);
        }
        if (r.debtEquity <= 0.30) {
            lines.push(`Debt/equity of ${fmtRatio(r.debtEquity)} leaves balance-sheet flexibility for downturns and reinvestment.`);
        }
        if (r.marketCap < 1.5e9) {
            lines.push(`At ${fmtCap(r.marketCap)}, there's substantial headroom — 10x puts it at ${fmtCap(r.marketCap * 10)}, still a reasonable size.`);
        }
        if (lines.length === 0) {
            lines.push(`Passes the Mayer gate on all hard thresholds but sits in the middle of the composite score distribution.`);
        }
        return lines;
    }

    function render() {
        const filtered = applyFilters();
        const sorted = sortRows(filtered);

        $('#stat-showing').textContent = sorted.length.toLocaleString();

        const body = $('#results-body');
        body.innerHTML = '';
        const empty = $('#empty-state');
        if (sorted.length === 0) {
            empty.hidden = false;
        } else {
            empty.hidden = true;
            const frag = document.createDocumentFragment();
            for (const r of sorted) for (const node of renderRow(r)) frag.appendChild(node);
            body.appendChild(frag);
        }
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
    }

    // ---- Filter binding -----------------------------------------------------
    function bindRange(id, key, toModel, toLabel) {
        const el = $('#filter-' + id);
        const label = document.querySelector(`.filter-value[data-for="${id}"]`);
        const sync = () => {
            const v = Number(el.value);
            state.filters[key] = toModel(v);
            label.textContent = toLabel(v);
            render();
        };
        el.addEventListener('input', sync);
        sync();
    }

    function bindSelect() {
        $('#filter-sector').addEventListener('change', (e) => {
            state.filters.sector = e.target.value;
            render();
        });
    }

    function bindSearch() {
        $('#search-ticker').addEventListener('input', (e) => {
            state.filters.search = e.target.value;
            render();
        });
    }

    function bindSort() {
        $('#sort-select').addEventListener('change', (e) => {
            state.sort = e.target.value;
            render();
        });
    }

    function bindReset() {
        $('#reset-filters').addEventListener('click', () => {
            document.querySelectorAll('.filter-rail input[type=range]').forEach((el) => {
                el.value = el.getAttribute('value') || el.min;
                el.dispatchEvent(new Event('input'));
            });
            $('#filter-sector').value = '';
            state.filters.sector = '';
            $('#search-ticker').value = '';
            state.filters.search = '';
            state.expanded.clear();
            render();
        });
    }

    // ---- Boot ---------------------------------------------------------------
    async function boot() {
        try {
            const res = await fetch('data/candidates.json', { cache: 'no-cache' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            state.payload = await res.json();
        } catch (e) {
            const body = $('#results-body');
            body.innerHTML = `<tr><td colspan="11" style="padding:24px;color:var(--red);">
                Failed to load data/candidates.json (${escapeHtml(e.message)}).
                Run <code>node scripts/seed-demo.mjs</code> or configure the GitHub Action.
            </td></tr>`;
            return;
        }

        renderStats();
        populateSectors();

        bindRange('roic',       'roic',       (v) => v / 100,            (v) => v + '%');
        bindRange('revCagr',    'revCagr',    (v) => v / 100,            (v) => v + '%');
        bindRange('epsCagr',    'epsCagr',    (v) => v / 100,            (v) => v + '%');
        bindRange('marketCap',  'marketCap',  (v) => v * 1_000_000,      (v) => '$' + (v / 1000).toFixed(1) + 'B');
        bindRange('debtEquity', 'debtEquity', (v) => v / 100,            (v) => (v / 100).toFixed(2));
        bindRange('insider',    'insider',    (v) => v / 100,            (v) => v + '%');
        bindRange('score',      'score',      (v) => v,                  (v) => String(v));

        bindSelect();
        bindSearch();
        bindSort();
        bindReset();

        render();
    }

    document.addEventListener('DOMContentLoaded', boot);
})();
