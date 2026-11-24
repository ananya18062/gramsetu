/* ═══════════════════════════════════════════════════════════════
   GramSetu – app.js
   Navigation, rendering, charts – all vanilla JS
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Helpers ──────────────────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const fmt = {
    inr: (n) =>
      '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }),
    num: (n) => Number(n).toLocaleString('en-IN'),
  };

  /* ── State ────────────────────────────────────────────────── */
  let currentSection = 'dashboard';
  let chartInstances = {}; // keyed by canvas id

  /* ── Nav config ───────────────────────────────────────────── */
  const NAV_ITEMS = [
    { id: 'dashboard',    label: 'Dashboard',          icon: '🏠', badge: null },
    { id: 'market',       label: 'Market Prices',      icon: '📈', badge: null },
    { id: 'groups',       label: 'Farmer Groups',      icon: '👨‍🌾', badge: null },
    { id: 'listings',     label: 'Produce Listings',   icon: '🌾', badge: null },
    { id: 'buyers',       label: 'Buyers',             icon: '🏪', badge: null },
    { id: 'transport',    label: 'Transport Estimator',icon: '🚛', badge: null },
  ];

  const SECTION_META = {
    dashboard: { title: 'Dashboard',            sub: 'Overview of market activity and collective selling' },
    market:    { title: 'Market Prices',         sub: 'Live mandi rates across states – updated daily' },
    groups:    { title: 'Farmer Groups',         sub: 'Registered Kisan Samoohs and their collective capacity' },
    listings:  { title: 'Produce Listings',      sub: 'Active and negotiating produce available for buyers' },
    buyers:    { title: 'Buyers',                sub: 'Verified traders, processors and exporters' },
    transport: { title: 'Transport Estimator',   sub: 'Calculate net proceeds after transport cost for any route' },
  };

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */
  function init() {
    buildSidebar();
    buildNotifications();
    bindTopbar();
    navigateTo(loadLastSection());
  }

  function loadLastSection() {
    try {
      return localStorage.getItem('gs_section') || 'dashboard';
    } catch (_) {
      return 'dashboard';
    }
  }

  function saveSection(id) {
    try { localStorage.setItem('gs_section', id); } catch (_) {}
  }

  /* ══════════════════════════════════════════════════════════
     SIDEBAR BUILD
  ══════════════════════════════════════════════════════════ */
  function buildSidebar() {
    const nav = $('#sidebar-nav');
    if (!nav) return;

    const unread = GS.data.notifications.filter((n) => !n.read).length;

    NAV_ITEMS.forEach((item) => {
      const li = document.createElement('li');
      const badge =
        item.id === 'dashboard' && unread > 0
          ? `<span class="nav-badge">${unread}</span>`
          : '';
      li.innerHTML = `
        <div class="nav-item" data-section="${item.id}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
          ${badge}
        </div>`;
      li.querySelector('.nav-item').addEventListener('click', () => {
        navigateTo(item.id);
        closeSidebar();
      });
      nav.appendChild(li);
    });
  }

  /* ══════════════════════════════════════════════════════════
     NAVIGATION
  ══════════════════════════════════════════════════════════ */
  function navigateTo(id) {
    if (!NAV_ITEMS.find((n) => n.id === id)) id = 'dashboard';
    currentSection = id;
    saveSection(id);

    // Active nav item
    $$('.nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.section === id);
    });

    // Topbar breadcrumb
    const meta = SECTION_META[id];
    const title = $('#topbar-title');
    const sub   = $('#topbar-sub');
    if (title) title.textContent = meta.title;
    if (sub)   sub.textContent   = meta.sub;

    // Render section
    const contentEl = $('#page-content');
    if (!contentEl) return;

    contentEl.innerHTML = '';
    // Fix #12: scroll page-content back to top on every section change
    contentEl.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const renderer = sectionRenderers[id];
    if (renderer) renderer(contentEl);
  }

  /* ══════════════════════════════════════════════════════════
     SECTION RENDERERS
  ══════════════════════════════════════════════════════════ */
  const sectionRenderers = {
    dashboard: renderDashboard,
    market:    renderMarket,
    groups:    renderGroups,
    listings:  renderListings,
    buyers:    renderBuyers,
    transport: renderTransport,
  };

  /* ── DASHBOARD ─────────────────────────────────────────── */
  function renderDashboard(container) {
    const d = GS.data;
    const k = d.kpis;

    const kpiCards = [
      { icon: '👨‍🌾', iconCls: 'green',  value: fmt.num(k.totalFarmersOnboarded), label: 'Farmers Onboarded',      trend: '+12%', trendCls: 'up' },
      { icon: '🤝', iconCls: 'earth',  value: fmt.num(k.activeFarmerGroups),    label: 'Active Kisan Samoohs',   trend: 'stable', trendCls: 'neutral' },
      { icon: '🌾', iconCls: 'green',  value: fmt.num(k.totalProduceQuintals) + ' qtl', label: 'Produce Listed',  trend: '+8%', trendCls: 'up' },
      { icon: '💰', iconCls: 'amber',  value: fmt.inr(k.totalRevenueINR),       label: 'Total Revenue (MTD)',    trend: '+18%', trendCls: 'up' },
      { icon: '📊', iconCls: 'blue',   value: k.avgPricePremium + '%',          label: 'Avg Price Premium',      trend: 'above MSP', trendCls: 'up' },
      { icon: '✅', iconCls: 'green',  value: fmt.num(k.dealsClosed),           label: 'Deals Closed',          trend: '+3 this week', trendCls: 'up' },
      { icon: '🗺️', iconCls: 'earth',  value: k.statsCovered,                  label: 'States Covered',        trend: 'stable', trendCls: 'neutral' },
      { icon: '🏪', iconCls: 'blue',   value: d.buyers.length,                 label: 'Verified Buyers',       trend: 'active', trendCls: 'neutral' },
    ];

    container.innerHTML = `
      <div class="kpi-grid">
        ${kpiCards.map((c) => `
          <div class="kpi-card">
            <div class="kpi-card-header">
              <div class="kpi-icon ${c.iconCls}">${c.icon}</div>
              <span class="kpi-trend ${c.trendCls}">${c.trend}</span>
            </div>
            <div class="kpi-value">${c.value}</div>
            <div class="kpi-label">${c.label}</div>
          </div>`).join('')}
      </div>

      <div class="chart-grid">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3>Price Trend – Last 7 Days</h3>
            <span class="chart-meta">INR / quintal</span>
          </div>
          <div class="chart-wrapper">
            <canvas id="chart-price-trend"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3>Produce by Crop</h3>
            <span class="chart-meta">Quintals listed</span>
          </div>
          <div class="chart-wrapper">
            <canvas id="chart-produce-mix"></canvas>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Recent Market Prices</h3>
          <button class="btn btn-outline btn-sm" onclick="GS.app.go('market')">View All →</button>
        </div>
        <div class="table-wrap">
          ${buildPriceTable(d.marketPrices.slice(0, 5))}
        </div>
      </div>`;

    requestAnimationFrame(() => {
      drawPriceTrendChart('chart-price-trend', d.priceHistory);
      drawProduceMixChart('chart-produce-mix');
    });
  }

  /* ── MARKET INTELLIGENCE (Market Prices section) ──────── */
  function renderMarket(container) {
    const crops   = Object.keys(GS.data.maharashtraComparison);
    const markets = GS.data.maharashtraMarkets;

    container.innerHTML = `
      <!-- Disclaimer banner -->
      <div class="mi-disclaimer" role="note">
        <span class="mi-disclaimer-icon">⚠️</span>
        <span><strong>Demonstration data only.</strong> Verify current mandi prices before selling.
        This tool does not connect to any live government mandi API.</span>
      </div>

      <div class="section-header" style="margin-top:1.25rem">
        <h2>Market Intelligence – Price Comparison</h2>
        <p>Compare indicative crop prices across three Maharashtra APMC mandis</p>
      </div>

      <!-- Crop selector -->
      <div class="card">
        <div class="mi-crop-selector-row">
          <div class="form-group" style="margin:0;flex:0 0 auto">
            <label for="mi-crop-select" style="font-weight:600;font-size:.85rem;margin-bottom:.4rem;display:block">
              Select Crop
            </label>
            <select id="mi-crop-select" class="mi-crop-select">
              ${crops.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="mi-markets-pill-row">
            ${markets.map((m) => `<span class="mi-market-pill">🏪 ${m} APMC</span>`).join('')}
          </div>
        </div>
      </div>

      <!-- Recommendation panel -->
      <div class="mi-recommendation" id="mi-recommendation">
        <div class="mi-rec-icon">💡</div>
        <div class="mi-rec-body">
          <div class="mi-rec-title">Market Recommendation</div>
          <div class="mi-rec-text" id="mi-rec-text">Loading…</div>
        </div>
        <div class="mi-rec-badge-wrap">
          <div class="mi-rec-best-market" id="mi-rec-badge">—</div>
          <div class="mi-rec-badge-label">Best indicative price</div>
        </div>
      </div>

      <!-- Bar chart -->
      <div class="chart-card mt-2">
        <div class="chart-card-header">
          <h3 id="mi-chart-title">Modal Price Comparison – <span id="mi-chart-crop">Wheat</span></h3>
          <span class="chart-meta">₹ per quintal · indicative only</span>
        </div>
        <div class="chart-wrapper" style="height:260px">
          <canvas id="chart-mi-bar"></canvas>
        </div>
      </div>

      <!-- Comparison table -->
      <div class="card mt-2">
        <div class="card-header">
          <h3>Detailed Price Comparison</h3>
          <span class="text-muted" style="font-size:.78rem">All prices in ₹ per quintal</span>
        </div>
        <div class="table-wrap">
          <div id="mi-table-wrap"></div>
        </div>
      </div>

      <!-- General mandi rates (existing data, below the fold) -->
      <div class="card mt-2">
        <div class="card-header">
          <h3>All-India Mandi Snapshot</h3>
          <span class="text-muted" style="font-size:.78rem">${GS.data.marketPrices.length} crops · 24 Nov 2026</span>
        </div>
        <div class="table-wrap">
          ${buildPriceTable(GS.data.marketPrices)}
        </div>
      </div>`;

    // Wire up the dropdown – update everything on change
    const selectEl = $('#mi-crop-select', container);
    selectEl.addEventListener('change', () => updateMarketIntelligence(container, selectEl.value));

    // Initial render
    updateMarketIntelligence(container, crops[0]);
  }

  function updateMarketIntelligence(container, crop) {
    const rows    = GS.data.maharashtraComparison[crop];
    if (!rows) return;

    // Find best market by modal price
    const best    = rows.reduce((a, b) => (b.modalPrice > a.modalPrice ? b : a));

    // Update chart crop label
    const cropLbl = $('#mi-chart-crop', container);
    if (cropLbl) cropLbl.textContent = crop;

    // Update recommendation
    const recText  = $('#mi-rec-text', container);
    const recBadge = $('#mi-rec-badge', container);
    if (recText) {
      recText.textContent =
        `Based on the available sample prices, ${best.market} APMC currently offers the highest ` +
        `indicative price for ${crop} at ${fmt.inr(best.modalPrice)} per quintal.`;
    }
    if (recBadge) recBadge.textContent = best.market + ' APMC';

    // Update table
    const tableWrap = $('#mi-table-wrap', container);
    if (tableWrap) tableWrap.innerHTML = buildMITable(rows, best.market);

    // Update bar chart
    requestAnimationFrame(() => drawMIBarChart('chart-mi-bar', rows, best.market));
  }

  function buildMITable(rows, bestMarket) {
    return `<table>
      <thead><tr>
        <th>Market (APMC)</th>
        <th>Crop</th>
        <th class="text-right">Min Price</th>
        <th class="text-right">Max Price</th>
        <th class="text-right">Modal Price</th>
        <th class="text-center">Last Updated</th>
        <th class="text-center">Status</th>
      </tr></thead>
      <tbody>
        ${rows.map((r) => {
          const isBest = r.market === bestMarket;
          return `<tr class="${isBest ? 'mi-best-row' : ''}">
            <td class="font-bold">
              ${isBest ? '🏆 ' : ''}${r.market} APMC
            </td>
            <td>${r.crop}</td>
            <td class="text-right">${fmt.inr(r.minPrice)}</td>
            <td class="text-right">${fmt.inr(r.maxPrice)}</td>
            <td class="text-right font-bold ${isBest ? 'text-green' : ''}">${fmt.inr(r.modalPrice)}</td>
            <td class="text-center text-muted" style="font-size:.78rem">${r.lastUpdated}</td>
            <td class="text-center">
              ${isBest
                ? `<span class="badge badge-green">Highest Price</span>`
                : `<span class="badge badge-gray">—</span>`}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  function drawMIBarChart(canvasId, rows, bestMarket) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const labels = rows.map((r) => r.market);
    const modalData = rows.map((r) => r.modalPrice);
    const minData   = rows.map((r) => r.minPrice);
    const maxData   = rows.map((r) => r.maxPrice);

    // Highlight best bar in a richer green; others in a muted green
    const barColors = rows.map((r) =>
      r.market === bestMarket ? '#256331' : '#7ecb88'
    );
    const borderColors = rows.map((r) =>
      r.market === bestMarket ? '#1a3a1f' : '#52b85f'
    );

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Modal Price (₹/qtl)',
            data: modalData,
            backgroundColor: barColors,
            borderColor: borderColors,
            borderWidth: 1.5,
            borderRadius: 6,
            order: 1,
          },
          {
            label: 'Min Price (₹/qtl)',
            data: minData,
            backgroundColor: 'rgba(241,163,64,.25)',
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            type: 'line',
            fill: false,
            tension: 0.3,
            pointRadius: 5,
            pointHoverRadius: 7,
            order: 0,
          },
          {
            label: 'Max Price (₹/qtl)',
            data: maxData,
            backgroundColor: 'rgba(59,130,246,.15)',
            borderColor: '#3b82f6',
            borderWidth: 1.5,
            type: 'line',
            fill: false,
            tension: 0.3,
            pointRadius: 5,
            pointHoverRadius: 7,
            order: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { size: 11 }, boxWidth: 12, padding: 12 },
          },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ₹${Number(c.raw).toLocaleString('en-IN')}`,
              afterBody: (items) => {
                const idx = items[0].dataIndex;
                if (rows[idx].market === bestMarket) return ['', '🏆 Highest modal price'];
                return [];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 12, weight: '500' } },
          },
          y: {
            grid: { color: '#f3f4f6' },
            ticks: {
              font: { size: 11 },
              callback: (v) => '₹' + Number(v).toLocaleString('en-IN'),
            },
          },
        },
      },
    });
  }

  function buildPriceTable(prices) {
    if (!prices.length) return `<div class="empty-state"><div class="empty-icon">📭</div><h3>No results found</h3><p>Try adjusting your filters.</p></div>`;
    return `<table>
      <thead><tr>
        <th>Crop</th><th>Variety</th><th>Mandi</th><th>State</th>
        <th class="text-right">Price (₹/qtl)</th>
        <th class="text-right">Range</th>
        <th class="text-center">Trend</th>
      </tr></thead>
      <tbody>
        ${prices.map((p) => {
          const tIcon  = p.trend === 'up' ? '▲' : p.trend === 'down' ? '▼' : '—';
          const tClass = p.trend === 'up' ? 'trend-up' : p.trend === 'down' ? 'trend-down' : 'trend-flat';
          const chg    = p.change !== 0 ? ` (${p.change > 0 ? '+' : ''}${p.change})` : '';
          return `<tr>
            <td class="font-bold">${p.crop}</td>
            <td>${p.variety}</td>
            <td>${p.mandi}</td>
            <td><span class="badge badge-earth">${p.state}</span></td>
            <td class="text-right font-bold">${fmt.inr(p.price)}</td>
            <td class="text-right text-muted" style="font-size:.78rem">${fmt.inr(p.minPrice)} – ${fmt.inr(p.maxPrice)}</td>
            <td class="text-center"><span class="${tClass}">${tIcon}${chg}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  /* ── FARMER GROUPS ─────────────────────────────────────── */
  /* ══════════════════════════════════════════════════════════
     COLLECTIVE SELLING / FARMER GROUPS MODULE
  ══════════════════════════════════════════════════════════ */

  // ── localStorage helpers ────────────────────────────────
  const CS_KEY = 'gs_collective_groups';

  function csLoad() {
    try {
      const raw = localStorage.getItem(CS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  function csSave(groups) {
    try { localStorage.setItem(CS_KEY, JSON.stringify(groups)); } catch (_) {}
  }

  function csGetGroups() {
    // On first load seed from data.js; subsequent loads use localStorage
    let groups = csLoad();
    if (!groups) {
      // Deep-clone seed data so mutations don't corrupt the original
      groups = JSON.parse(JSON.stringify(GS.data.farmerGroups));
      csSave(groups);
    }
    return groups;
  }

  // Derive totals directly from membersList
  function csTotalKg(group)      { return group.membersList.reduce((s, m) => s + m.quantityKg, 0); }
  function csMemberCount(group)  { return group.membersList.length; }
  function csTotalValue(group)   {
    const qtl = csTotalKg(group) / 100;
    return Math.round(qtl * group.expectedPricePerQtl);
  }

  // ── Toast helper ────────────────────────────────────────
  function showToast(msg, type = 'success') {
    let toast = document.getElementById('gs-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'gs-toast';
      document.body.appendChild(toast);
    }
    toast.className = `gs-toast gs-toast-${type} gs-toast-show`;
    toast.textContent = msg;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('gs-toast-show'), 3200);
  }

  // ── Modal helpers ───────────────────────────────────────
  function openModal(html) {
    let backdrop = document.getElementById('gs-modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'gs-modal-backdrop';
      backdrop.className = 'gs-modal-backdrop';
      document.body.appendChild(backdrop);
    }
    backdrop.innerHTML = `<div class="gs-modal" role="dialog" aria-modal="true">${html}</div>`;
    backdrop.classList.add('open');

    // Close on backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    }, { once: true });

    // Fix #4: bind ALL .gs-modal-close elements inside the modal, not just the first
    backdrop.querySelectorAll('.gs-modal-close').forEach((btn) => {
      btn.addEventListener('click', closeModal);
    });
  }

  function closeModal() {
    const backdrop = document.getElementById('gs-modal-backdrop');
    if (backdrop) backdrop.classList.remove('open');
  }

  // ── Field validation helper ─────────────────────────────
  function validateField(input, errorId, msg) {
    const val = input.value.trim();
    const errEl = document.getElementById(errorId);
    if (!val) {
      input.classList.add('input-error');
      if (errEl) errEl.textContent = msg;
      return false;
    }
    input.classList.remove('input-error');
    if (errEl) errEl.textContent = '';
    return true;
  }

  // ── MAIN RENDERER ───────────────────────────────────────
  function renderGroups(container) {
    const groups = csGetGroups();

    container.innerHTML = `
      <div class="section-header">
        <h2>Collective Selling – Farmer Groups</h2>
        <p>Pool your produce with neighbouring farmers to attract larger buyers and better prices</p>
      </div>

      <!-- How it works strip -->
      <div class="cs-how-strip">
        <div class="cs-how-step"><span class="cs-how-num">1</span><span>Join or create a group</span></div>
        <div class="cs-how-arrow">→</div>
        <div class="cs-how-step"><span class="cs-how-num">2</span><span>Contribute your produce</span></div>
        <div class="cs-how-arrow">→</div>
        <div class="cs-how-step"><span class="cs-how-num">3</span><span>Group negotiates collectively</span></div>
        <div class="cs-how-arrow">→</div>
        <div class="cs-how-step"><span class="cs-how-num">4</span><span>Sell at a better price</span></div>
      </div>

      <!-- Toolbar -->
      <div class="filter-bar mb-2">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="group-search" placeholder="Search by name, crop, village…">
        </div>
        <select id="group-crop-filter">
          <option value="">All Crops</option>
          ${[...new Set(groups.map((g) => g.crop))].map((c) => `<option>${c}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="btn-create-group">+ Create New Group</button>
      </div>

      <!-- Cards grid -->
      <div class="group-grid" id="cs-group-grid">
        ${groups.map((g) => buildCSGroupCard(g)).join('')}
      </div>`;

    // ── Filter logic
    const searchEl = $('#group-search', container);
    const cropEl   = $('#group-crop-filter', container);
    const gridEl   = $('#cs-group-grid', container);

    function refilter() {
      const q  = searchEl.value.toLowerCase();
      const cr = cropEl.value;
      const all = csGetGroups();
      const filtered = all.filter((g) => {
        const matchQ  = !q || g.name.toLowerCase().includes(q) ||
                        g.crop.toLowerCase().includes(q) ||
                        g.village.toLowerCase().includes(q);
        const matchCr = !cr || g.crop === cr;
        return matchQ && matchCr;
      });
      gridEl.innerHTML = filtered.length
        ? filtered.map((g) => buildCSGroupCard(g)).join('')
        : `<div class="empty-state"><div class="empty-icon">🔍</div><h3>No groups found</h3><p>Adjust your filters.</p></div>`;
      bindCardActions(gridEl);
    }

    searchEl.addEventListener('input', refilter);
    cropEl.addEventListener('change', refilter);

    // ── Create-group button
    $('#btn-create-group', container).addEventListener('click', () => openCreateGroupModal(container));

    // ── Card action buttons (View Details / Join)
    bindCardActions(gridEl);
  }

  // ── Bind per-card buttons after every grid re-render ───
  function bindCardActions(gridEl) {
    gridEl.querySelectorAll('[data-action="view-group"]').forEach((btn) => {
      btn.addEventListener('click', () => openGroupDetail(btn.dataset.groupId));
    });
    gridEl.querySelectorAll('[data-action="join-group"]').forEach((btn) => {
      btn.addEventListener('click', () => openJoinModal(btn.dataset.groupId));
    });
  }

  // ── GROUP CARD ──────────────────────────────────────────
  function buildCSGroupCard(g) {
    const totalKg  = csTotalKg(g);
    const members  = csMemberCount(g);
    const totalVal = csTotalValue(g);
    const isOpen   = g.status === 'open';
    const statusBadge = isOpen
      ? `<span class="badge badge-green">● Open</span>`
      : `<span class="badge badge-gray">✓ Closed</span>`;

    return `
      <div class="group-card cs-group-card">
        <div class="group-card-top">
          <div class="group-avatar cs-crop-avatar">${cropEmoji(g.crop)}</div>
          <div class="group-info">
            <h4>${g.name}</h4>
            <p>📍 ${g.village}, ${g.district}</p>
            <p style="margin-top:4px">${statusBadge}</p>
          </div>
        </div>

        <div class="group-stats">
          <div class="group-stat">
            <strong>${members}</strong><span>Members</span>
          </div>
          <div class="group-stat">
            <strong>${fmt.num(totalKg)} kg</strong><span>Total Produce</span>
          </div>
          <div class="group-stat">
            <strong>${fmt.inr(g.expectedPricePerQtl)}</strong><span>Exp. Price/qtl</span>
          </div>
          <div class="group-stat">
            <strong>${fmt.inr(totalVal)}</strong><span>Est. Total Value</span>
          </div>
        </div>

        <div class="cs-crop-row">
          <span class="crop-tag" style="font-size:.8rem;padding:4px 10px">${g.crop}</span>
          <span class="text-muted" style="font-size:.75rem">📅 Created ${formatDate(g.createdAt)}</span>
        </div>

        <div class="group-card-footer">
          <button class="btn btn-outline btn-sm" data-action="view-group" data-group-id="${g.id}">
            📋 View Details
          </button>
          ${isOpen
            ? `<button class="btn btn-primary btn-sm" data-action="join-group" data-group-id="${g.id}">
                 + Join Group
               </button>`
            : `<span class="badge badge-earth" style="padding:6px 10px">Closed</span>`}
        </div>
      </div>`;
  }

  function cropEmoji(crop) {
    const map = { Onion:'🧅', Tomato:'🍅', Wheat:'🌾', Maize:'🌽', Soybean:'🫘',
                  Rice:'🌾', Mustard:'🌻', Cotton:'🌿', Potato:'🥔', Sugarcane:'🎋' };
    return map[crop] || '🌱';
  }

  // ── GROUP DETAIL MODAL ──────────────────────────────────
  function openGroupDetail(groupId) {
    const groups = csGetGroups();
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;

    const totalKg  = csTotalKg(g);
    const members  = csMemberCount(g);
    const totalVal = csTotalValue(g);
    const qtl      = (totalKg / 100).toFixed(1);

    const memberRows = g.membersList.map((m, i) => `
      <tr>
        <td>${i + 1}</td>
        <td class="font-bold">${m.name}</td>
        <td>${m.village}</td>
        <td class="text-right">${fmt.num(m.quantityKg)} kg</td>
        <td class="text-right text-green">${fmt.inr(Math.round((m.quantityKg / 100) * g.expectedPricePerQtl))}</td>
        <td class="text-muted" style="font-size:.75rem">${formatDate(m.joinedAt)}</td>
      </tr>`).join('');

    openModal(`
      <div class="gs-modal-header">
        <div>
          <h2 class="gs-modal-title">${cropEmoji(g.crop)} ${g.name}</h2>
          <p class="gs-modal-sub">📍 ${g.village}, ${g.district}, ${g.state}</p>
        </div>
        <button class="gs-modal-close" aria-label="Close">✕</button>
      </div>

      <div class="cs-detail-kpi-row">
        <div class="cs-detail-kpi">
          <strong>${members}</strong><span>Members</span>
        </div>
        <div class="cs-detail-kpi">
          <strong>${fmt.num(totalKg)} kg</strong><span>Total Produce</span>
        </div>
        <div class="cs-detail-kpi">
          <strong>${qtl} qtl</strong><span>In Quintals</span>
        </div>
        <div class="cs-detail-kpi cs-detail-kpi-highlight">
          <strong>${fmt.inr(totalVal)}</strong><span>Est. Total Value</span>
        </div>
      </div>

      <div class="cs-detail-info-row">
        <div class="cs-detail-info-item">
          <span class="cs-detail-info-label">Crop</span>
          <span class="cs-detail-info-value">${g.crop}</span>
        </div>
        <div class="cs-detail-info-item">
          <span class="cs-detail-info-label">Expected Price</span>
          <span class="cs-detail-info-value">${fmt.inr(g.expectedPricePerQtl)} / qtl</span>
        </div>
        <div class="cs-detail-info-item">
          <span class="cs-detail-info-label">Status</span>
          <span class="cs-detail-info-value">${g.status === 'open' ? '● Open for joining' : '✓ Closed'}</span>
        </div>
        <div class="cs-detail-info-item">
          <span class="cs-detail-info-label">Created</span>
          <span class="cs-detail-info-value">${formatDate(g.createdAt)}</span>
        </div>
      </div>

      <h3 class="cs-members-title">👥 Member Contributions</h3>
      <div class="table-wrap" style="max-height:280px;overflow-y:auto">
        <table>
          <thead><tr>
            <th>#</th><th>Farmer Name</th><th>Village</th>
            <th class="text-right">Quantity (kg)</th>
            <th class="text-right">Est. Value</th>
            <th>Joined</th>
          </tr></thead>
          <tbody>${memberRows}</tbody>
        </table>
      </div>

      <div class="gs-modal-footer">
        ${g.status === 'open'
          ? `<button class="btn btn-primary" id="detail-join-btn" data-group-id="${g.id}">
               + Join This Group
             </button>`
          : ''}
        <button class="btn btn-ghost gs-modal-close">Close</button>
      </div>`);

    // Wire join from inside detail
    const joinBtn = document.getElementById('detail-join-btn');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        closeModal();
        setTimeout(() => openJoinModal(groupId), 180);
      });
    }
  }

  // ── JOIN GROUP MODAL ────────────────────────────────────
  function openJoinModal(groupId) {
    const groups = csGetGroups();
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;

    openModal(`
      <div class="gs-modal-header">
        <div>
          <h2 class="gs-modal-title">Join: ${g.name}</h2>
          <p class="gs-modal-sub">Crop: ${g.crop} &nbsp;|&nbsp; ${csMemberCount(g)} members so far</p>
        </div>
        <button class="gs-modal-close" aria-label="Close">✕</button>
      </div>

      <form id="join-form" novalidate>
        <div class="form-group">
          <label for="j-name">Your Full Name <span class="req">*</span></label>
          <input type="text" id="j-name" placeholder="e.g. Ramesh Patil" autocomplete="off">
          <span class="field-error" id="j-name-err"></span>
        </div>
        <div class="form-group">
          <label for="j-village">Village <span class="req">*</span></label>
          <input type="text" id="j-village" placeholder="e.g. Niphad" autocomplete="off">
          <span class="field-error" id="j-village-err"></span>
        </div>
        <div class="form-group">
          <label for="j-qty">Quantity to Contribute (kg) <span class="req">*</span></label>
          <input type="number" id="j-qty" min="1" max="50000" placeholder="e.g. 200">
          <span class="field-error" id="j-qty-err"></span>
        </div>

        <div class="cs-join-preview" id="join-preview" style="display:none">
          <div class="cs-join-preview-row">
            <span>Your contribution</span>
            <strong id="jp-qty">— kg</strong>
          </div>
          <div class="cs-join-preview-row">
            <span>Est. value at group price</span>
            <strong id="jp-val" class="text-green">—</strong>
          </div>
          <div class="cs-join-preview-row">
            <span>New group total</span>
            <strong id="jp-total">—</strong>
          </div>
        </div>

        <div class="gs-modal-footer">
          <button type="submit" class="btn btn-primary">✓ Confirm &amp; Join</button>
          <button type="button" class="btn btn-ghost gs-modal-close">Cancel</button>
        </div>
      </form>`);

    // Live preview while user types quantity
    const qtyEl = document.getElementById('j-qty');
    qtyEl.addEventListener('input', () => {
      const qty = parseFloat(qtyEl.value);
      const preview = document.getElementById('join-preview');
      if (!isNaN(qty) && qty > 0) {
        const estVal   = Math.round((qty / 100) * g.expectedPricePerQtl);
        const newTotal = csTotalKg(g) + qty;
        document.getElementById('jp-qty').textContent   = fmt.num(qty) + ' kg';
        document.getElementById('jp-val').textContent   = fmt.inr(estVal);
        document.getElementById('jp-total').textContent = fmt.num(newTotal) + ' kg';
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
    });

    // Submit
    document.getElementById('join-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const nameEl    = document.getElementById('j-name');
      const villageEl = document.getElementById('j-village');

      const v1 = validateField(nameEl,    'j-name-err',    'Please enter your full name.');
      const v2 = validateField(villageEl, 'j-village-err', 'Please enter your village.');
      const qtyVal = parseFloat(qtyEl.value);
      let v3 = true;
      if (isNaN(qtyVal) || qtyVal <= 0) {
        qtyEl.classList.add('input-error');
        document.getElementById('j-qty-err').textContent = 'Enter a valid quantity in kg.';
        v3 = false;
      } else {
        qtyEl.classList.remove('input-error');
        document.getElementById('j-qty-err').textContent = '';
      }
      if (!v1 || !v2 || !v3) return;

      // Persist
      const allGroups = csGetGroups();
      const target = allGroups.find((x) => x.id === groupId);
      target.membersList.push({
        name:       nameEl.value.trim(),
        village:    villageEl.value.trim(),
        quantityKg: qtyVal,
        joinedAt:   new Date().toISOString().slice(0, 10),
      });
      csSave(allGroups);
      closeModal();

      // Re-render grid
      const gridEl = document.getElementById('cs-group-grid');
      if (gridEl) {
        gridEl.innerHTML = csGetGroups().map((g) => buildCSGroupCard(g)).join('');
        bindCardActions(gridEl);
      }

      showToast(`✅ You joined "${target.name}" successfully! Your ${fmt.num(qtyVal)} kg has been added.`);
    });
  }

  // ── CREATE GROUP MODAL ──────────────────────────────────
  function openCreateGroupModal(pageContainer) {
    const cropOptions = ['Wheat','Onion','Tomato','Soybean','Maize',
                         'Rice','Mustard','Cotton','Potato','Sugarcane','Other'];

    openModal(`
      <div class="gs-modal-header">
        <div>
          <h2 class="gs-modal-title">🌱 Create New Farmer Group</h2>
          <p class="gs-modal-sub">Start a collective selling group for your village</p>
        </div>
        <button class="gs-modal-close" aria-label="Close">✕</button>
      </div>

      <form id="create-group-form" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="cg-name">Group Name <span class="req">*</span></label>
            <input type="text" id="cg-name" placeholder="e.g. Kolhapur Soybean Growers">
            <span class="field-error" id="cg-name-err"></span>
          </div>
          <div class="form-group">
            <label for="cg-crop">Crop <span class="req">*</span></label>
            <select id="cg-crop">
              <option value="">– Select crop –</option>
              ${cropOptions.map((c) => `<option>${c}</option>`).join('')}
            </select>
            <span class="field-error" id="cg-crop-err"></span>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="cg-farmer">Your Name <span class="req">*</span></label>
            <input type="text" id="cg-farmer" placeholder="e.g. Suresh Patil">
            <span class="field-error" id="cg-farmer-err"></span>
          </div>
          <div class="form-group">
            <label for="cg-village">Village <span class="req">*</span></label>
            <input type="text" id="cg-village" placeholder="e.g. Sangamner">
            <span class="field-error" id="cg-village-err"></span>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="cg-qty">Your Initial Quantity (kg) <span class="req">*</span></label>
            <input type="number" id="cg-qty" min="1" placeholder="e.g. 300">
            <span class="field-error" id="cg-qty-err"></span>
          </div>
          <div class="form-group">
            <label for="cg-price">Expected Price per Quintal (₹) <span class="req">*</span></label>
            <input type="number" id="cg-price" min="1" placeholder="e.g. 2200">
            <span class="field-error" id="cg-price-err"></span>
          </div>
        </div>

        <div class="gs-modal-footer">
          <button type="submit" class="btn btn-primary">🌱 Create Group</button>
          <button type="button" class="btn btn-ghost gs-modal-close">Cancel</button>
        </div>
      </form>`);

    document.getElementById('create-group-form').addEventListener('submit', (e) => {
      e.preventDefault();

      const nameEl    = document.getElementById('cg-name');
      const cropEl    = document.getElementById('cg-crop');
      const farmerEl  = document.getElementById('cg-farmer');
      const villageEl = document.getElementById('cg-village');
      const qtyEl     = document.getElementById('cg-qty');
      const priceEl   = document.getElementById('cg-price');

      const v1 = validateField(nameEl,    'cg-name-err',    'Group name is required.');
      const v2 = validateField(cropEl,    'cg-crop-err',    'Please select a crop.');
      const v3 = validateField(farmerEl,  'cg-farmer-err',  'Your name is required.');
      const v4 = validateField(villageEl, 'cg-village-err', 'Village is required.');

      const qtyVal   = parseFloat(qtyEl.value);
      const priceVal = parseFloat(priceEl.value);
      let v5 = true, v6 = true;

      if (isNaN(qtyVal) || qtyVal <= 0) {
        qtyEl.classList.add('input-error');
        document.getElementById('cg-qty-err').textContent = 'Enter a valid quantity.';
        v5 = false;
      } else {
        qtyEl.classList.remove('input-error');
        document.getElementById('cg-qty-err').textContent = '';
      }
      if (isNaN(priceVal) || priceVal <= 0) {
        priceEl.classList.add('input-error');
        document.getElementById('cg-price-err').textContent = 'Enter a valid price.';
        v6 = false;
      } else {
        priceEl.classList.remove('input-error');
        document.getElementById('cg-price-err').textContent = '';
      }
      if (!v1 || !v2 || !v3 || !v4 || !v5 || !v6) return;

      const today   = new Date().toISOString().slice(0, 10);
      const newGroup = {
        id:                 'fg_' + Date.now(),
        name:               nameEl.value.trim(),
        crop:               cropEl.value,
        village:            villageEl.value.trim(),
        district:           villageEl.value.trim(),
        state:              'Maharashtra',
        status:             'open',
        expectedPricePerQtl: priceVal,
        createdAt:          today,
        membersList: [{
          name:       farmerEl.value.trim(),
          village:    villageEl.value.trim(),
          quantityKg: qtyVal,
          joinedAt:   today,
        }],
      };

      const allGroups = csGetGroups();
      allGroups.unshift(newGroup); // newest first
      csSave(allGroups);
      closeModal();

      // Re-render entire groups section
      const gridEl = document.getElementById('cs-group-grid');
      if (gridEl) {
        gridEl.innerHTML = csGetGroups().map((g) => buildCSGroupCard(g)).join('');
        bindCardActions(gridEl);
      }

      // Update crop filter options
      const cropFilter = document.getElementById('group-crop-filter');
      if (cropFilter) {
        const existing = [...cropFilter.options].map((o) => o.value);
        if (!existing.includes(newGroup.crop)) {
          const opt = document.createElement('option');
          opt.value = opt.textContent = newGroup.crop;
          cropFilter.appendChild(opt);
        }
      }

      showToast(`🌱 "${newGroup.name}" created! You are the founding member.`);
    });
  }

  /* buildGroupCard is intentionally omitted — buildCSGroupCard is used directly */

  /* ── PRODUCE LISTINGS ──────────────────────────────────── */
  /* ══════════════════════════════════════════════════════════
     PART A – PRODUCE LISTINGS
  ══════════════════════════════════════════════════════════ */

  const PL_KEY = 'gs_listings';

  function plLoad() {
    try {
      const raw = localStorage.getItem(PL_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    // Seed from data.js on first run
    const seed = JSON.parse(JSON.stringify(GS.data.produceListings));
    plSave(seed);
    return seed;
  }

  function plSave(listings) {
    try { localStorage.setItem(PL_KEY, JSON.stringify(listings)); } catch (_) {}
  }

  function renderListings(container) {
    const CROP_OPTIONS = ['Onion','Tomato','Wheat','Maize','Soybean',
                          'Potato','Rice','Mustard','Sugarcane','Cotton','Other'];

    container.innerHTML = `
      <div class="section-header">
        <h2>Produce Listings</h2>
        <p>Farmers and groups listing available produce for direct buyer discovery</p>
      </div>

      <!-- Toolbar -->
      <div class="filter-bar mb-2">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="pl-search" placeholder="Search crop, farmer, village…">
        </div>
        <select id="pl-crop-filter">
          <option value="">All Crops</option>
          ${CROP_OPTIONS.map((c) => `<option>${c}</option>`).join('')}
        </select>
        <select id="pl-status-filter">
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="negotiating">Negotiating</option>
          <option value="sold">Sold</option>
        </select>
        <button class="btn btn-primary" id="pl-add-btn">+ List Produce</button>
      </div>

      <!-- Listings grid -->
      <div class="listing-grid" id="pl-grid"></div>`;

    // Initial render
    plRenderGrid(container);

    // Filters
    ['pl-search','pl-crop-filter','pl-status-filter'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(id === 'pl-search' ? 'input' : 'change',
                                  () => plRenderGrid(container));
    });

    // Add-listing button
    document.getElementById('pl-add-btn').addEventListener('click', () => openAddListingModal(container));
  }

  function plRenderGrid(container) {
    const listings = plLoad();
    const q   = (document.getElementById('pl-search')?.value  || '').toLowerCase();
    const cr  = document.getElementById('pl-crop-filter')?.value  || '';
    const st  = document.getElementById('pl-status-filter')?.value || '';

    const filtered = listings.filter((l) => {
      const matchQ  = !q  || l.crop.toLowerCase().includes(q) ||
                      l.farmerName.toLowerCase().includes(q) ||
                      l.village.toLowerCase().includes(q);
      const matchCr = !cr || l.crop === cr;
      const matchSt = !st || l.status === st;
      return matchQ && matchCr && matchSt;
    });

    const grid = document.getElementById('pl-grid');
    if (!grid) return;

    if (!filtered.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🌾</div>
        <h3>No listings found</h3>
        <p>Adjust your filters or add a new listing.</p>
      </div>`;
      return;
    }
    grid.innerHTML = filtered.map(buildListingCard).join('');

    // Bind "Find Buyers" buttons
    grid.querySelectorAll('[data-action="find-buyers"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const crop = btn.dataset.crop;
        const qty  = parseInt(btn.dataset.qty, 10);
        const loc  = btn.dataset.loc;
        navigateTo('buyers');
        // Pass context via a small timeout so the buyers section renders first
        setTimeout(() => openBuyerMatchPanel(crop, qty, loc), 80);
      });
    });
  }

  function buildListingCard(l) {
    const statusMap = {
      available:   ['badge-green',  '● Available'],
      negotiating: ['badge-amber',  '◐ Negotiating'],
      sold:        ['badge-gray',   '✓ Sold'],
    };
    const [cls, label] = statusMap[l.status] || ['badge-gray', l.status];
    const qtl      = (l.quantityKg / 100).toFixed(1);
    const totalVal = Math.round((l.quantityKg / 100) * l.pricePerQtl);
    const isActive = l.status !== 'sold';

    return `
      <div class="listing-card">
        <div class="listing-card-header">
          <div>
            <h4>${cropEmoji(l.crop)} ${l.crop}</h4>
            <p>${l.farmerName}</p>
          </div>
          <span class="badge ${cls}">${label}</span>
        </div>
        <div class="listing-card-body">
          <div class="listing-detail-row">
            <span class="ld-label">Quantity</span>
            <span class="ld-value">${fmt.num(l.quantityKg)} kg (${qtl} qtl)</span>
          </div>
          <div class="listing-detail-row">
            <span class="ld-label">Asking Price</span>
            <span class="ld-price">${fmt.inr(l.pricePerQtl)} / qtl</span>
          </div>
          <div class="listing-detail-row">
            <span class="ld-label">Est. Total Value</span>
            <span class="ld-value text-green font-bold">${fmt.inr(totalVal)}</span>
          </div>
          <div class="listing-detail-row">
            <span class="ld-label">Village</span>
            <span class="ld-value">📍 ${l.village}</span>
          </div>
          <div class="listing-detail-row">
            <span class="ld-label">Available From</span>
            <span class="ld-value">📅 ${formatDate(l.availableFrom)}</span>
          </div>
          <div class="listing-detail-row">
            <span class="ld-label">Listed On</span>
            <span class="ld-value text-muted">${formatDate(l.listedAt)}</span>
          </div>
        </div>
        <div class="listing-card-footer">
          ${isActive
            ? `<button class="btn btn-primary btn-sm"
                 data-action="find-buyers"
                 data-crop="${l.crop}"
                 data-qty="${l.quantityKg}"
                 data-loc="${l.village}">
                 🔍 Find Buyers
               </button>`
            : `<span class="badge badge-gray" style="padding:6px 10px">Listing Closed</span>`}
        </div>
      </div>`;
  }

  function openAddListingModal(pageContainer) {
    const CROP_OPTIONS = ['Wheat','Onion','Tomato','Maize','Soybean',
                          'Potato','Rice','Mustard','Sugarcane','Cotton','Other'];
    openModal(`
      <div class="gs-modal-header">
        <div>
          <h2 class="gs-modal-title">🌾 List Your Produce</h2>
          <p class="gs-modal-sub">Add a new listing so buyers can discover your produce</p>
        </div>
        <button class="gs-modal-close" aria-label="Close">✕</button>
      </div>
      <form id="pl-add-form" novalidate>
        <div class="form-row">
          <div class="form-group">
            <label for="pl-farmer">Farmer / Group Name <span class="req">*</span></label>
            <input type="text" id="pl-farmer" placeholder="e.g. Ramesh Patil">
            <span class="field-error" id="pl-farmer-err"></span>
          </div>
          <div class="form-group">
            <label for="pl-crop">Crop <span class="req">*</span></label>
            <select id="pl-crop">
              <option value="">– Select –</option>
              ${CROP_OPTIONS.map((c) => `<option>${c}</option>`).join('')}
            </select>
            <span class="field-error" id="pl-crop-err"></span>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="pl-qty">Quantity (kg) <span class="req">*</span></label>
            <input type="number" id="pl-qty" min="1" placeholder="e.g. 500">
            <span class="field-error" id="pl-qty-err"></span>
          </div>
          <div class="form-group">
            <label for="pl-price">Expected Price per Quintal (₹) <span class="req">*</span></label>
            <input type="number" id="pl-price" min="1" placeholder="e.g. 2200">
            <span class="field-error" id="pl-price-err"></span>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="pl-village">Village / Location <span class="req">*</span></label>
            <input type="text" id="pl-village" placeholder="e.g. Sangamner, Ahmednagar">
            <span class="field-error" id="pl-village-err"></span>
          </div>
          <div class="form-group">
            <label for="pl-avail">Available From <span class="req">*</span></label>
            <input type="date" id="pl-avail" min="${new Date().toISOString().slice(0,10)}">
            <span class="field-error" id="pl-avail-err"></span>
          </div>
        </div>
        <div class="gs-modal-footer">
          <button type="submit" class="btn btn-primary">✓ Submit Listing</button>
          <button type="button" class="btn btn-ghost gs-modal-close">Cancel</button>
        </div>
      </form>`);

    document.getElementById('pl-add-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const farmerEl  = document.getElementById('pl-farmer');
      const cropEl    = document.getElementById('pl-crop');
      const qtyEl     = document.getElementById('pl-qty');
      const priceEl   = document.getElementById('pl-price');
      const villageEl = document.getElementById('pl-village');
      const availEl   = document.getElementById('pl-avail');

      const v1 = validateField(farmerEl,  'pl-farmer-err',  'Farmer / group name required.');
      const v2 = validateField(cropEl,    'pl-crop-err',    'Please select a crop.');
      const v3 = validateField(villageEl, 'pl-village-err', 'Village / location required.');
      const v4 = validateField(availEl,   'pl-avail-err',   'Please select an availability date.');

      const qty   = parseFloat(qtyEl.value);
      const price = parseFloat(priceEl.value);
      let v5 = true, v6 = true;
      if (isNaN(qty) || qty <= 0) {
        qtyEl.classList.add('input-error');
        document.getElementById('pl-qty-err').textContent = 'Enter a valid quantity.';
        v5 = false;
      } else { qtyEl.classList.remove('input-error'); document.getElementById('pl-qty-err').textContent = ''; }
      if (isNaN(price) || price <= 0) {
        priceEl.classList.add('input-error');
        document.getElementById('pl-price-err').textContent = 'Enter a valid price.';
        v6 = false;
      } else { priceEl.classList.remove('input-error'); document.getElementById('pl-price-err').textContent = ''; }

      if (!v1 || !v2 || !v3 || !v4 || !v5 || !v6) return;

      const listings = plLoad();
      const newListing = {
        id:           'pl_' + Date.now(),
        farmerName:   farmerEl.value.trim(),
        crop:         cropEl.value,
        quantityKg:   qty,
        pricePerQtl:  price,
        village:      villageEl.value.trim(),
        availableFrom:availEl.value,
        status:       'available',
        listedAt:     new Date().toISOString().slice(0, 10),
      };
      listings.unshift(newListing);
      plSave(listings);
      closeModal();
      plRenderGrid(pageContainer);
      showToast(`✅ "${cropEl.value}" listing added successfully!`);
    });
  }

  /* ══════════════════════════════════════════════════════════
     PART B – BUYER DISCOVERY
  ══════════════════════════════════════════════════════════ */

  // Returns { score: 0|1|2, label, cls } for a buyer vs a listing context.
  // score 2 = Good Match (crop + qty + location all pass)
  // score 1 = Partial Match (crop + at least one of qty/location passes)
  // score 0 = No Match (crop does not match)
  function matchBuyer(buyer, crop, quantityKg, locationStr) {
    const cropMatch = buyer.crops.includes(crop);
    if (!cropMatch) return { score: 0, label: 'No Match', cls: 'match-none' };

    const qtyMatch = quantityKg > 0 &&
                     quantityKg >= buyer.minQuantityKg &&
                     quantityKg <= buyer.maxQuantityKg;

    const locLower  = (locationStr || '').toLowerCase().trim();
    const buyerDist = (buyer.district || '').toLowerCase();
    const locMatch  = locLower.length > 0 && (
      locLower.includes(buyerDist) ||
      buyerDist.includes(locLower.split(',')[0].trim())
    );

    if (cropMatch && qtyMatch && locMatch) return { score: 2, label: 'Good Match',    cls: 'match-good' };
    if (cropMatch && (qtyMatch || locMatch)) return { score: 1, label: 'Partial Match', cls: 'match-partial' };
    // Crop matches but neither qty nor location — still show as partial
    return { score: 1, label: 'Partial Match', cls: 'match-partial' };
  }

  // State for buyers section: current filter context from "Find Buyers"
  let _buyerCtx = { crop: '', qty: 0, loc: '' };

  function openBuyerMatchPanel(crop, qty, loc) {
    _buyerCtx = { crop, qty, loc };
    // Update the crop filter if the buyers section is already rendered
    const cropFilter = document.getElementById('bd-crop-filter');
    if (cropFilter) {
      cropFilter.value = crop;
      bdRenderGrid();
    }
  }

  function renderBuyers(container) {
    const buyers = GS.data.buyers;
    const allCrops = [...new Set(buyers.flatMap((b) => b.crops))].sort();

    container.innerHTML = `
      <!-- Disclaimer -->
      <div class="mi-disclaimer" style="margin-bottom:1.25rem" role="note">
        <span class="mi-disclaimer-icon">ℹ️</span>
        <span><strong>Sample demonstration data only.</strong> All buyer profiles are fictional and for
        demo purposes. Do not treat indicative prices as real offers.</span>
      </div>

      <div class="section-header">
        <h2>Buyer Discovery</h2>
        <p>Find buyers that match your crop, quantity and location</p>
      </div>

      <!-- Matching controls -->
      <div class="card bd-match-bar mb-2">
        <div class="bd-match-bar-inner">
          <div class="form-group" style="margin:0;flex:1;min-width:140px">
            <label for="bd-crop-filter" style="font-size:.78rem;font-weight:600;margin-bottom:4px;display:block">
              Your Crop
            </label>
            <select id="bd-crop-filter">
              <option value="">All Crops</option>
              ${allCrops.map((c) => `<option${_buyerCtx.crop === c ? ' selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0;flex:1;min-width:130px">
            <label for="bd-qty-input" style="font-size:.78rem;font-weight:600;margin-bottom:4px;display:block">
              Your Quantity (kg)
            </label>
            <input type="number" id="bd-qty-input" min="0" placeholder="e.g. 1000"
              value="${_buyerCtx.qty || ''}">
          </div>
          <div class="form-group" style="margin:0;flex:2;min-width:160px">
            <label for="bd-loc-input" style="font-size:.78rem;font-weight:600;margin-bottom:4px;display:block">
              Your Location
            </label>
            <input type="text" id="bd-loc-input" placeholder="e.g. Nashik"
              value="${_buyerCtx.loc || ''}">
          </div>
          <div class="form-group" style="margin:0;align-self:flex-end">
            <button class="btn btn-primary" id="bd-match-btn">🔍 Find Matches</button>
          </div>
        </div>
        <div class="bd-match-legend">
          <span class="bd-legend-item match-good">🟢 Good Match</span>
          <span class="bd-legend-item match-partial">🟡 Partial Match</span>
          <span class="bd-legend-item match-none">🔴 No Match</span>
        </div>
      </div>

      <!-- Buyer cards -->
      <div class="buyer-grid" id="bd-grid">
        ${buyers.map((b) => buildBuyerCard(b, _buyerCtx.crop, _buyerCtx.qty, _buyerCtx.loc)).join('')}
      </div>`;

    // Bind match button
    document.getElementById('bd-match-btn').addEventListener('click', () => {
      _buyerCtx.crop = document.getElementById('bd-crop-filter').value;
      _buyerCtx.qty  = parseFloat(document.getElementById('bd-qty-input').value) || 0;
      _buyerCtx.loc  = document.getElementById('bd-loc-input').value.trim();
      bdRenderGrid();
    });

    // Live filter on crop dropdown change
    document.getElementById('bd-crop-filter').addEventListener('change', () => {
      _buyerCtx.crop = document.getElementById('bd-crop-filter').value;
      bdRenderGrid();
    });
  }

  function bdRenderGrid() {
    const grid = document.getElementById('bd-grid');
    if (!grid) return;
    const { crop, qty, loc } = _buyerCtx;
    const buyers = GS.data.buyers;

    // Sort: good matches first, then partial, then none
    const sorted = [...buyers].sort((a, b) => {
      const ma = matchBuyer(a, crop, qty, loc).score;
      const mb = matchBuyer(b, crop, qty, loc).score;
      return mb - ma;
    });

    grid.innerHTML = sorted.map((b) => buildBuyerCard(b, crop, qty, loc)).join('');

    // Bind contact buttons
    grid.querySelectorAll('[data-action="contact-buyer"]').forEach((btn) => {
      btn.addEventListener('click', () => openContactModal(btn.dataset.buyerId));
    });
  }

  function buildBuyerCard(b, crop, quantityKg, loc) {
    const { label: matchLabel, cls: matchCls } = (crop)
      ? matchBuyer(b, crop, quantityKg, loc)
      : { label: '', cls: '' };

    const offeredPrice = (crop && b.offeredPriceMap[crop])
      ? `<div class="bd-offered-price">
           <span class="bd-offered-label">Indicative offer for ${crop}</span>
           <span class="bd-offered-value">${fmt.inr(b.offeredPriceMap[crop])} / qtl</span>
         </div>`
      : '';

    const matchBadge = matchLabel
      ? `<span class="bd-match-badge ${matchCls}">${matchLabel}</span>`
      : '';

    const typeIconMap = {
      'wholesaler':   '🥬',
      'processor':    '🏭',
      'trader':       '📦',
      'distributor':  '🚚',
      'food-supply':  '🍱',
    };
    const icon = typeIconMap[b.typeKey] || '🏪';

    return `
      <div class="buyer-card bd-buyer-card${matchCls === 'match-good' ? ' bd-good-match' : ''}">
        <div class="buyer-card-top">
          <div class="buyer-avatar" style="font-size:1.3rem;background:var(--earth-100);color:var(--earth-700)">${icon}</div>
          <div style="flex:1;min-width:0">
            <div class="font-bold" style="font-size:.92rem;margin-bottom:2px">${b.name}</div>
            <div class="text-muted" style="font-size:.73rem">${b.type}</div>
            <div class="text-muted" style="font-size:.73rem">📍 ${b.location}</div>
          </div>
          ${matchBadge}
        </div>

        ${offeredPrice}

        <div class="crop-tags" style="margin:0.6rem 0">
          ${b.crops.map((c) => `<span class="crop-tag${c === crop ? ' crop-tag-highlight' : ''}">${c}</span>`).join('')}
        </div>

        <div class="bd-info-row">
          <span>Min qty</span><span>${fmt.num(b.minQuantityKg)} kg</span>
        </div>
        <div class="bd-info-row">
          <span>Max qty</span><span>${fmt.num(b.maxQuantityKg)} kg</span>
        </div>
        <div class="bd-info-row">
          <span>Deals closed</span><span>✅ ${b.dealsClosed}</span>
        </div>

        <p class="bd-about">${b.about}</p>

        <div class="flex-between" style="margin-top:.85rem">
          <button class="btn btn-outline btn-sm"
            data-action="contact-buyer" data-buyer-id="${b.id}">
            ✉ Contact Buyer
          </button>
          ${matchLabel === 'Good Match'
            ? `<span class="bd-match-badge match-good" style="font-size:.7rem">✓ Recommended</span>`
            : ''}
        </div>
      </div>`;
  }

  function openContactModal(buyerId) {
    const b = GS.data.buyers.find((x) => x.id === buyerId);
    if (!b) return;

    openModal(`
      <div class="gs-modal-header">
        <div>
          <h2 class="gs-modal-title">✉ Contact ${b.name}</h2>
          <p class="gs-modal-sub">${b.type} · ${b.location}</p>
        </div>
        <button class="gs-modal-close" aria-label="Close">✕</button>
      </div>
      <div style="padding:1.25rem 1.5rem">
        <div class="mi-disclaimer" style="margin-bottom:1.1rem">
          <span class="mi-disclaimer-icon">⚠️</span>
          <span>This is a <strong>demo contact form only</strong>. No messages are sent.
          Buyer profiles are fictional sample data.</span>
        </div>
        <form id="contact-form" novalidate>
          <div class="form-row">
            <div class="form-group">
              <label for="ct-name">Your Name <span class="req">*</span></label>
              <input type="text" id="ct-name" placeholder="e.g. Suresh Patil">
              <span class="field-error" id="ct-name-err"></span>
            </div>
            <div class="form-group">
              <label for="ct-crop">Crop</label>
              <input type="text" id="ct-crop" placeholder="e.g. Onion"
                value="${_buyerCtx.crop || ''}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="ct-qty">Quantity (kg)</label>
              <input type="number" id="ct-qty" min="0" placeholder="e.g. 500"
                value="${_buyerCtx.qty || ''}">
            </div>
            <div class="form-group">
              <label for="ct-village">Your Village</label>
              <input type="text" id="ct-village" placeholder="e.g. Nashik"
                value="${_buyerCtx.loc || ''}">
            </div>
          </div>
          <div class="form-group">
            <label for="ct-msg">Message <span class="req">*</span></label>
            <textarea id="ct-msg" rows="3"
              placeholder="Briefly describe your produce, quantity and preferred pickup date…"></textarea>
            <span class="field-error" id="ct-msg-err"></span>
          </div>
          <div class="gs-modal-footer">
            <button type="submit" class="btn btn-primary">📤 Send Enquiry (Demo)</button>
            <button type="button" class="btn btn-ghost gs-modal-close">Cancel</button>
          </div>
        </form>
      </div>`);

    document.getElementById('contact-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const nameEl = document.getElementById('ct-name');
      const msgEl  = document.getElementById('ct-msg');
      const v1 = validateField(nameEl, 'ct-name-err', 'Please enter your name.');
      const v2 = validateField(msgEl,  'ct-msg-err',  'Please enter a message.');
      if (!v1 || !v2) return;
      closeModal();
      showToast(`📤 Enquiry to "${b.name}" recorded (demo). No real message was sent.`);
    });
  }

  /* ── TRANSPORT ESTIMATOR ───────────────────────────────── */
  function renderTransport(container) {
    container.innerHTML = `
      <!-- Explanation -->
      <div class="tc-explain">
        <span class="tc-explain-icon">ℹ️</span>
        <span>This estimate helps farmers compare potential selling proceeds after transportation
        expenses. Actual transport costs and buyer prices may vary.</span>
      </div>

      <div class="section-header" style="margin-top:1.1rem">
        <h2>Transport Cost Estimator</h2>
        <p>Calculate net proceeds after transport for any route and crop quantity</p>
      </div>

      <!-- Calculator card -->
      <div class="card">
        <form id="tc-form" novalidate onsubmit="return false">

          <div class="form-row">
            <div class="form-group">
              <label for="tc-qty">Produce Quantity (kg) <span class="req">*</span></label>
              <input type="number" id="tc-qty" min="1" placeholder="e.g. 1000">
              <span class="field-error" id="tc-qty-err"></span>
            </div>
            <div class="form-group">
              <label for="tc-dist">Distance (km) <span class="req">*</span></label>
              <input type="number" id="tc-dist" min="1" placeholder="e.g. 120">
              <span class="field-error" id="tc-dist-err"></span>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="tc-rate">
                Transport Rate (₹ per km)
                <span class="tc-default-hint">Default: ₹25/km</span>
              </label>
              <input type="number" id="tc-rate" min="1" value="25" placeholder="e.g. 25">
              <span class="field-error" id="tc-rate-err"></span>
            </div>
            <div class="form-group">
              <label for="tc-price">Expected Selling Price (₹ per quintal) <span class="req">*</span></label>
              <input type="number" id="tc-price" min="1" placeholder="e.g. 2200">
              <span class="field-error" id="tc-price-err"></span>
            </div>
          </div>

          <div class="tc-formula-box">
            <div class="tc-formula-title">How it's calculated</div>
            <div class="tc-formula-row">
              <span>Transport Cost</span>
              <span class="tc-formula-eq">= Distance × Rate per km</span>
            </div>
            <div class="tc-formula-row">
              <span>Gross Selling Value</span>
              <span class="tc-formula-eq">= (Quantity ÷ 100) × Price per quintal</span>
            </div>
            <div class="tc-formula-row">
              <span>Estimated Net Proceeds</span>
              <span class="tc-formula-eq">= Gross Selling Value − Transport Cost</span>
            </div>
          </div>

          <button class="btn btn-primary" id="tc-calc-btn" style="margin-top:.25rem">
            🚛 Calculate Estimate
          </button>
        </form>

        <!-- Results panel -->
        <div class="tc-result" id="tc-result">
          <div class="tc-result-grid">
            <div class="tc-result-item tc-result-gross">
              <span class="tc-result-label">Gross Selling Value</span>
              <span class="tc-result-value" id="tc-gross">—</span>
            </div>
            <div class="tc-result-item tc-result-cost">
              <span class="tc-result-label">Transport Cost</span>
              <span class="tc-result-value" id="tc-cost">—</span>
            </div>
            <div class="tc-result-item tc-result-net">
              <span class="tc-result-label">Estimated Net Proceeds</span>
              <span class="tc-result-value" id="tc-net">—</span>
            </div>
            <div class="tc-result-item tc-result-perkg">
              <span class="tc-result-label">Transport Cost per kg</span>
              <span class="tc-result-value" id="tc-perkg">—</span>
            </div>
          </div>
          <div class="tc-net-warn" id="tc-net-warn" style="display:none">
            ⚠️ Transport cost exceeds gross selling value. Consider a closer market or higher price.
          </div>
          <p class="tc-disclaimer">
            Disclaimer: This is an indicative estimate only. Actual transport costs, fuel charges,
            toll fees and buyer prices may vary. Verify rates with your transporter before selling.
          </p>
        </div>
      </div>

      <!-- Reference rates table -->
      <div class="card mt-2">
        <div class="card-header">
          <h3>Sample Route Reference</h3>
          <span class="text-muted" style="font-size:.78rem">Click a row to auto-fill distance</span>
        </div>
        <div class="table-wrap">
          <table id="tc-route-table">
            <thead><tr>
              <th>From</th><th>To</th>
              <th class="text-right">Distance (km)</th>
              <th class="text-right">Rate (₹/km) — illustrative</th>
            </tr></thead>
            <tbody>
              ${GS.data.transportRoutes.map((r) => `
                <tr class="tc-route-row" data-dist="${r.distanceKm}" data-rate="${r.ratePerKmPerTonne}" style="cursor:pointer">
                  <td>${r.from}</td>
                  <td>${r.to}</td>
                  <td class="text-right">${r.distanceKm}</td>
                  <td class="text-right">${r.ratePerKmPerTonne}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    // ── Wire calculate button
    $('#tc-calc-btn', container).addEventListener('click', () => {
      const qtyEl   = $('#tc-qty',   container);
      const distEl  = $('#tc-dist',  container);
      const rateEl  = $('#tc-rate',  container);
      const priceEl = $('#tc-price', container);

      // Clear previous errors
      ['tc-qty','tc-dist','tc-rate','tc-price'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('input-error');
      });
      ['tc-qty-err','tc-dist-err','tc-rate-err','tc-price-err'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
      });

      const qty   = parseFloat(qtyEl.value);
      const dist  = parseFloat(distEl.value);
      const rate  = parseFloat(rateEl.value);
      const price = parseFloat(priceEl.value);

      let valid = true;

      if (isNaN(qty) || qty <= 0) {
        qtyEl.classList.add('input-error');
        document.getElementById('tc-qty-err').textContent = 'Enter a valid quantity greater than 0.';
        valid = false;
      }
      if (isNaN(dist) || dist <= 0) {
        distEl.classList.add('input-error');
        document.getElementById('tc-dist-err').textContent = 'Enter a valid distance greater than 0.';
        valid = false;
      }
      if (isNaN(rate) || rate <= 0) {
        rateEl.classList.add('input-error');
        document.getElementById('tc-rate-err').textContent = 'Enter a valid rate (default is ₹25).';
        valid = false;
      }
      if (isNaN(price) || price <= 0) {
        priceEl.classList.add('input-error');
        document.getElementById('tc-price-err').textContent = 'Enter the expected selling price.';
        valid = false;
      }
      if (!valid) return;

      // ── Formula (per spec)
      // Transport Cost       = Distance × Rate per km
      // Gross Selling Value  = (Quantity in kg / 100) × Price per quintal
      // Net Proceeds         = Gross Selling Value − Transport Cost
      // Cost per kg          = Transport Cost / Quantity
      const transportCost = dist * rate;
      const grossValue    = (qty / 100) * price;
      const netProceeds   = grossValue - transportCost;
      const costPerKg     = transportCost / qty;

      document.getElementById('tc-gross').textContent  = fmt.inr(Math.round(grossValue));
      document.getElementById('tc-cost').textContent   = fmt.inr(Math.round(transportCost));
      document.getElementById('tc-net').textContent    = fmt.inr(Math.round(netProceeds));
      document.getElementById('tc-perkg').textContent  = '₹' + costPerKg.toFixed(2) + ' / kg';

      // Colour net red if negative
      const netEl = document.getElementById('tc-net');
      netEl.style.color = netProceeds < 0 ? 'var(--red-500)' : '';

      const warnEl = document.getElementById('tc-net-warn');
      warnEl.style.display = netProceeds < 0 ? 'block' : 'none';

      const resultEl = $('#tc-result', container);
      resultEl.classList.add('show');
      resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    // ── Clickable reference rows auto-fill distance + rate
    $$('.tc-route-row', container).forEach((row) => {
      row.addEventListener('click', () => {
        $('#tc-dist', container).value = row.dataset.dist;
        $('#tc-rate', container).value = row.dataset.rate;
        // Highlight selected row
        $$('.tc-route-row', container).forEach((r) => r.classList.remove('tc-row-selected'));
        row.classList.add('tc-row-selected');
        $('#tc-dist', container).focus();
        showToast(`📍 Route auto-filled: ${row.dataset.dist} km at ₹${row.dataset.rate}/km`);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     CHARTS
  ══════════════════════════════════════════════════════════ */
  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  function drawPriceTrendChart(canvasId, history) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    const colors = ['#38a047', '#f59e0b', '#3b82f6', '#ef4444'];
    const datasets = Object.entries(history.datasets).map(([label, data], i) => ({
      label,
      data,
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length] + '15',
      borderWidth: 2.5,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0.4,
      fill: false,
    }));

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels: history.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 12, padding: 10 } },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ₹${c.raw.toLocaleString('en-IN')}`,
            },
          },
        },
        scales: {
          x: { grid: { color: '#f3f4f6' }, ticks: { font: { size: 11 } } },
          y: {
            grid: { color: '#f3f4f6' },
            ticks: {
              font: { size: 11 },
              callback: (v) => '₹' + Number(v).toLocaleString('en-IN'),
            },
          },
        },
      },
    });
  }

  function drawProduceMixChart(canvasId, _unused) {
    destroyChart(canvasId);
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    // Always read from localStorage so newly added listings appear immediately
    const listings = plLoad();
    const agg = {};
    listings.forEach((l) => {
      // quantityKg is the current field (old seed used 'quantity' in quintals – guard both)
      const kg = l.quantityKg !== undefined ? l.quantityKg : (l.quantity || 0) * 100;
      agg[l.crop] = (agg[l.crop] || 0) + kg;
    });
    const labels = Object.keys(agg);
    const data   = Object.values(agg).map((v) => Math.round(v / 100)); // display in quintals
    const palette = ['#38a047','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#ec4899'];

    chartInstances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11 }, boxWidth: 12, padding: 8 } },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.label}: ${c.raw} qtl`,
            },
          },
        },
      },
    });
  }

  /* ══════════════════════════════════════════════════════════
     NOTIFICATIONS
  ══════════════════════════════════════════════════════════ */
  function buildNotifications() {
    const listEl = $('#notif-list');
    if (!listEl) return;

    const iconMap = { price: '📈', deal: '🤝', group: '👨‍🌾', transport: '🚛', alert: '⚠️' };
    GS.data.notifications.forEach((n) => {
      const item = document.createElement('div');
      item.className = 'notif-item' + (n.read ? '' : ' unread');
      item.innerHTML = `
        <div class="notif-item-icon ${n.type}">${iconMap[n.type] || '🔔'}</div>
        <div class="notif-item-body">
          <p>${n.message}</p>
          <span>${n.time}</span>
        </div>`;
      item.addEventListener('click', () => {
        n.read = true;
        item.classList.remove('unread');
      });
      listEl.appendChild(item);
    });
  }

  /* ══════════════════════════════════════════════════════════
     TOPBAR BINDINGS
  ══════════════════════════════════════════════════════════ */
  function bindTopbar() {
    // Mobile menu toggle
    const toggleBtn = $('#menu-toggle');
    const sidebar   = $('#sidebar');
    const overlay   = $('#sidebar-overlay');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', closeSidebar);
    }

    // Notification bell — Fix #5: toggle a class on body-level dropdown, not topbar-relative
    const bellBtn  = $('#notif-btn');
    const dropdown = $('#notif-dropdown');
    if (bellBtn && dropdown) {
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.toggle('open');
        // Reposition under the bell on every open
        if (isOpen) {
          const rect = bellBtn.getBoundingClientRect();
          dropdown.style.top  = (rect.bottom + 6) + 'px';
          dropdown.style.right = (window.innerWidth - rect.right) + 'px';
          dropdown.style.left  = 'auto';
        }
        bellBtn.setAttribute('aria-expanded', String(isOpen));
      });
      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && e.target !== bellBtn) {
          dropdown.classList.remove('open');
          bellBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Mark all read
    const markAll = $('#notif-mark-all');
    if (markAll) {
      markAll.addEventListener('click', () => {
        GS.data.notifications.forEach((n) => (n.read = true));
        $$('.notif-item').forEach((el) => el.classList.remove('unread'));
        const dot = $('#notif-dot');
        if (dot) dot.style.display = 'none';
      });
    }
  }

  function closeSidebar() {
    const sidebar = $('#sidebar');
    const overlay = $('#sidebar-overlay');
    if (sidebar)  sidebar.classList.remove('open');
    if (overlay)  overlay.classList.remove('open');
  }

  /* ══════════════════════════════════════════════════════════
     UTILS
  ══════════════════════════════════════════════════════════ */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr; // return raw string if unparseable
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC API (for inline onclick attributes)
  ══════════════════════════════════════════════════════════ */
  window.GS = window.GS || {};
  window.GS.app = { go: navigateTo };

  /* ── Kick off ─────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
