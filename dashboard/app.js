// Token Radar — dashboard logic. Static page: all data comes from the
// window.RADAR object that data.js (written by main.ts) defines. No network,
// no fetches, no imports: the page works from local files alone.
(function () {
  'use strict';
  var DATA = window.RADAR || { rows: [], live: [], as_of: '', floor_usd: 0, global_median: 0 };
  var rows = DATA.rows || [];
  var live = DATA.live || [];

  function $(id) { return document.getElementById(id); }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function pct(x) {
    if (x === null || x === undefined) return '—';
    return (x > 0 ? '+' : '') + x.toFixed(2) + '%';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ------------------------------------------------------------ meta + filters
  var watchCount = rows.filter(function (r) { return r.watchlist; }).length;
  $('meta').innerHTML =
    'snapshot <b>' + esc(DATA.as_of) + '</b> · ' + rows.length + ' rows · watchlist ' +
    watchCount + ' · floor ' + money(DATA.floor_usd) +
    ' · global peer median <b>' + DATA.global_median.toFixed(3) + '×</b>';
  $('asof').textContent = DATA.as_of;
  $('tab-note').textContent = rows.length + ' ranked · ' + live.length + ' live-token peers shown separately';

  var cats = [];
  rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
  cats.sort().forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('cat').appendChild(o);
  });
  var chains = [];
  rows.forEach(function (r) { (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); }); });
  chains.sort().forEach(function (c) {
    var o = document.createElement('option');
    o.value = c; o.textContent = c;
    $('chain').appendChild(o);
  });

  // ------------------------------------------------------------ state + render
  var state = { q: '', cat: '', chain: '', sort: 'rank', tab: 'board' };
  var SORTS = {
    rank: function (a, b) { return a.rank - b.rank; },
    name: function (a, b) { return a.name < b.name ? -1 : 1; },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
    change: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
    age: function (a, b) { return b.age_days - a.age_days; },
    implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
    multiple: function (a, b) { return b.category_multiple - a.category_multiple; },
  };

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    return rows.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(SORTS[state.sort]);
  }

  function changeCell(x) {
    if (x === null || x === undefined) return '<td class="num">—</td>';
    var cls = x > 0 ? 'pos' : x < 0 ? 'neg' : '';
    return '<td class="num ' + cls + '">' + pct(x) + '</td>';
  }

  function renderBoard() {
    var list = visibleRows();
    var html = list.map(function (r) {
      var top = r.rank <= 3 ? ' class="top3"' : '';
      return '<tr data-slug="' + esc(r.slug) + '"' + top + '>' +
        '<td class="rank">' + r.rank + '</td>' +
        '<td class="name">' + esc(r.name) + (r.watchlist ? '<span class="wl">WATCH</span>' : '') + '</td>' +
        '<td class="cat">' + esc(r.category || '—') + '</td>' +
        '<td>' + esc((r.chains || []).slice(0, 3).join(', ')) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        changeCell(r.change_7d) +
        '<td class="num">' + r.age_days + 'd</td>' +
        '<td class="num imp">' + money(r.implied_value_usd) + '</td>' +
        '<td class="num">' + r.category_multiple.toFixed(3) + '×</td></tr>';
    }).join('');
    $('rows').innerHTML = html;
    $('empty').hidden = list.length > 0;
    $('count').textContent = list.length + ' of ' + rows.length + ' shown';
  }

  function renderLive() {
    $('live-rows').innerHTML = live.map(function (p, i) {
      return '<tr><td class="rank">' + (i + 1) + '</td>' +
        '<td class="name">' + esc(p.name) + '</td>' +
        '<td class="cat">' + esc(p.category || '—') + '</td>' +
        '<td class="num">' + money(p.tvl_usd) + '</td>' +
        '<td class="num">' + money(p.mcap_usd) + '</td>' +
        '<td class="num">' + p.multiple.toFixed(3) + '×</td></tr>';
    }).join('');
  }

  function setTab(tab) {
    state.tab = tab;
    $('tab-board').classList.toggle('active', tab === 'board');
    $('tab-live').classList.toggle('active', tab === 'live');
    $('board').hidden = tab !== 'board';
    $('live').hidden = tab !== 'live';
    $('toolbar').style.display = tab === 'board' ? '' : 'none';
    $('empty').hidden = true;
    if (tab === 'live') renderLive();
    else renderBoard();
  }

  // ------------------------------------------------------------ detail drawer
  function openDetail(slug) {
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) { r = rows[i]; break; }
    if (!r) return;
    $('d-name').textContent = '#' + r.rank + ' ' + r.name;
    $('d-sub').textContent = (r.category || 'Uncategorized') + ' · ' +
      (r.chains || []).join(', ') + (r.watchlist ? ' · on the watchlist' : ' · below the floor');
    var facts = [
      ['TVL', money(r.tvl_usd)],
      ['7d change', pct(r.change_7d)],
      ['Age with no token', r.age_days + ' days'],
      ['Implied value', money(r.implied_value_usd)],
      ['Peer multiple', r.category_multiple.toFixed(4) + '× (' + r.peer_count +
        (r.peer_count === 1 ? ' live peer' : ' live peers') +
        (r.raw_category_median !== null ? ', raw median ' + r.raw_category_median.toFixed(3) + '×' : ', global median') + ')'],
      ['Growth ×', r.growth_multiplier.toFixed(3)],
      ['Maturity ×', r.maturity_multiplier.toFixed(3)],
      ['Chains ×', r.chain_multiplier.toFixed(2)],
    ];
    $('d-facts').innerHTML = facts.map(function (f) {
      return '<dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd>';
    }).join('');
    $('d-math').textContent =
      money(r.tvl_usd) + ' × ' + r.category_multiple.toFixed(4) + ' × ' +
      r.growth_multiplier.toFixed(3) + ' × ' + r.maturity_multiplier.toFixed(3) + ' × ' +
      r.chain_multiplier.toFixed(2) + ' = ' + money(r.implied_value_usd) + '.';
    var recomputed = Math.round(
      r.tvl_usd * r.category_multiple * r.growth_multiplier *
      r.maturity_multiplier * r.chain_multiplier,
    );
    var diff = Math.abs(recomputed - r.implied_value_usd);
    var check = $('d-check');
    if (diff <= 1) {
      check.textContent = '✓ Recomputing from these figures gives ' + money(recomputed) +
        ' — it matches the board value.';
      check.className = 'd-check ok';
    } else {
      check.textContent = 'Note: recomputing gives ' + money(recomputed) +
        ', which differs from the board value by ' + money(diff) + '.';
      check.className = 'd-check bad';
    }
    $('d-farm').innerHTML = r.farm_steps.map(function (s) {
      return '<li>' + esc(s) + '</li>';
    }).join('');
    $('drawer').hidden = false;
  }

  function closeDetail() {
    $('drawer').hidden = true;
    if (location.hash.indexOf('#p=') === 0) history.replaceState(null, '', location.pathname);
  }

  // ------------------------------------------------------------ wiring
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) {
      openDetail(tr.getAttribute('data-slug'));
      history.replaceState(null, '', '#p=' + tr.getAttribute('data-slug'));
    }
  });
  $('close').addEventListener('click', closeDetail);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });
  $('q').addEventListener('input', function () { state.q = this.value; renderBoard(); });
  $('cat').addEventListener('change', function () { state.cat = this.value; renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = this.value; renderBoard(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; renderBoard(); });
  $('tab-board').addEventListener('click', function () { setTab('board'); });
  $('tab-live').addEventListener('click', function () { setTab('live'); });
  Array.prototype.forEach.call(document.querySelectorAll('#board th[data-k]'), function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-k');
      state.sort = k;
      $('sort').value = k;
      renderBoard();
    });
  });

  // Deep links: #p=<slug> opens a protocol, #category=<name> filters the board.
  var hash = location.hash || '';
  if (hash.indexOf('#p=') === 0) openDetail(decodeURIComponent(hash.slice(3)));
  if (hash.indexOf('#category=') === 0) {
    var cat = decodeURIComponent(hash.slice(10));
    state.cat = cat;
    $('cat').value = cat;
  }
  renderBoard();
})();
