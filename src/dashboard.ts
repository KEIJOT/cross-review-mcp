// src/dashboard.ts - Embedded HTML dashboard for live monitoring

export function getDashboardHTML(port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cross-Review MCP Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0e17; color: #e0e6ed; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #1a1f2e 0%, #0d1117 100%); border-bottom: 1px solid #21262d; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 18px; font-weight: 600; color: #58a6ff; }
  .header .status { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #8b949e; }
  .header .status .dot { width: 8px; height: 8px; border-radius: 50%; background: #3fb950; animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; padding: 20px 24px; }
  .card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 16px; }
  .card .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8b949e; margin-bottom: 4px; }
  .card .value { font-size: 24px; font-weight: 700; color: #f0f6fc; }
  .card .value.cost { color: #3fb950; }
  .section { padding: 0 24px 20px; }
  .section h2 { font-size: 14px; font-weight: 600; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; background: #161b22; border: 1px solid #21262d; border-radius: 8px; overflow: hidden; }
  th { text-align: left; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #8b949e; background: #0d1117; border-bottom: 1px solid #21262d; }
  td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #21262d; }
  tr:last-child td { border-bottom: none; }
  .feed { max-height: 500px; overflow-y: auto; }
  .feed-item { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 14px; margin-bottom: 8px; transition: border-color 0.3s; }
  .feed-item.active { border-color: #58a6ff; }
  .feed-item.new { animation: slideIn 0.3s ease-out; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
  .feed-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .feed-id { font-family: monospace; font-size: 12px; color: #58a6ff; }
  .feed-time { font-size: 11px; color: #8b949e; }
  .feed-type { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #1f2937; color: #79c0ff; }
  .feed-models { display: flex; gap: 6px; flex-wrap: wrap; }
  .model-tag { font-size: 11px; padding: 3px 8px; border-radius: 4px; font-family: monospace; }
  .model-tag.pending { background: #1f2937; color: #8b949e; }
  .model-tag.success { background: #0d2818; color: #3fb950; }
  .model-tag.error { background: #2d1117; color: #f85149; }
  .feed-footer { display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #8b949e; }
  .empty { text-align: center; padding: 40px; color: #484f58; font-size: 14px; }
</style>
</head>
<body>
<div class="header">
  <h1>Cross-Review MCP</h1>
  <div class="status">
    <div class="dot"></div>
    <span id="uptime">Starting...</span>
  </div>
</div>

<div class="grid">
  <div class="card"><div class="label">Total Requests</div><div class="value" id="totalRequests">0</div></div>
  <div class="card"><div class="label">Today's Cost</div><div class="value cost" id="dailyCost">$0.00</div></div>
  <div class="card"><div class="label">Monthly Cost</div><div class="value cost" id="monthlyCost">$0.00</div></div>
  <div class="card"><div class="label">Cache Hit Rate</div><div class="value" id="cacheHitRate">0%</div></div>
  <div class="card"><div class="label">Cache Entries</div><div class="value" id="cacheEntries">0</div></div>
  <div class="card"><div class="label">Active Now</div><div class="value" id="activeRequests">0</div></div>
</div>

<div class="section">
  <h2>Per-Model Stats</h2>
  <table>
    <thead><tr><th>Model</th><th>Requests</th><th>Avg Time</th><th>Tokens (In/Out)</th><th>Errors</th></tr></thead>
    <tbody id="modelTable"><tr><td colspan="5" class="empty">No data yet</td></tr></tbody>
  </table>
</div>

<div class="section">
  <h2>Live Feed</h2>
  <div class="feed" id="feed">
    <div class="empty">Waiting for requests...</div>
  </div>
</div>

<script>
var state = {
  requests: new Map(),
  modelStats: new Map(),
  totalRequests: 0,
  activeCount: 0,
};

function formatUptime(ms) {
  var s = Math.floor(ms / 1000);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (s % 60) + 's';
}

function formatDuration(ms) {
  return ms < 1000 ? ms + 'ms' : (ms / 1000).toFixed(1) + 's';
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function updateCards() {
  setText('totalRequests', state.totalRequests);
  setText('activeRequests', state.activeCount);
}

function updateModelTable() {
  var tbody = document.getElementById('modelTable');
  if (state.modelStats.size === 0) return;
  while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
  state.modelStats.forEach(function(s, id) {
    var avgTime = s.totalTime / (s.requests || 1);
    var tr = document.createElement('tr');
    var cells = [id, s.requests, formatDuration(Math.round(avgTime)),
      s.inputTokens.toLocaleString() + ' / ' + s.outputTokens.toLocaleString(), s.errors];
    cells.forEach(function(val) {
      var td = document.createElement('td');
      td.textContent = String(val);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function createEl(tag, className, text) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function renderFeedItem(req) {
  var feed = document.getElementById('feed');
  var emptyEl = feed.querySelector('.empty');
  if (emptyEl) feed.removeChild(emptyEl);

  var item = document.getElementById('req-' + req.requestId);
  var isNew = !item;
  if (!item) {
    item = document.createElement('div');
    item.id = 'req-' + req.requestId;
    item.className = 'feed-item new active';
    feed.prepend(item);
    while (feed.children.length > 20) feed.removeChild(feed.lastChild);
  }

  // Clear existing content
  while (item.firstChild) item.removeChild(item.firstChild);

  // Header row
  var header = createEl('div', 'feed-header');
  header.appendChild(createEl('span', 'feed-id', req.requestId.slice(0, 8)));
  header.appendChild(createEl('span', 'feed-type', req.type || 'general'));
  header.appendChild(createEl('span', 'feed-time', new Date(req.startedAt).toLocaleTimeString()));
  item.appendChild(header);

  // Model tags
  var modelsDiv = createEl('div', 'feed-models');
  (req.models || []).forEach(function(m) {
    var label = m.id + (m.status === 'success' ? ' ' + formatDuration(m.time) : '');
    modelsDiv.appendChild(createEl('span', 'model-tag ' + m.status, label));
  });
  item.appendChild(modelsDiv);

  // Footer
  var footer = createEl('div', 'feed-footer');
  if (req.completed) {
    footer.appendChild(createEl('span', '', formatDuration(req.executionTimeMs)));
    footer.appendChild(createEl('span', '', '$' + (req.totalCost || 0).toFixed(4)));
    item.classList.remove('active');
    setTimeout(function() { item.classList.remove('new'); }, 300);
  } else {
    footer.appendChild(createEl('span', '', 'In progress...'));
  }
  item.appendChild(footer);
}

// Load initial stats
fetch('/api/stats').then(function(r) { return r.json(); }).then(function(data) {
  state.totalRequests = data.totalRequests || 0;
  if (data.costs) {
    setText('dailyCost', data.costs.dailySpend || '$0.00');
    setText('monthlyCost', data.costs.monthlySpend || '$0.00');
  }
  if (data.cache) {
    setText('cacheHitRate', Math.round((data.cache.hitRate || 0) * 100) + '%');
    setText('cacheEntries', String(data.cache.entries || 0));
  }
  updateCards();
  if (data.recentRequests) {
    data.recentRequests.forEach(function(req) { renderFeedItem(req); });
  }
}).catch(function() {});

// SSE live feed
var evtSource = new EventSource('/api/events');

evtSource.addEventListener('request:start', function(e) {
  var data = JSON.parse(e.data);
  state.totalRequests++;
  state.activeCount++;
  var req = {
    requestId: data.requestId,
    startedAt: data.timestamp,
    type: data.type,
    models: data.models.map(function(m) { return { id: m, status: 'pending' }; }),
    completed: false,
  };
  state.requests.set(data.requestId, req);
  renderFeedItem(req);
  updateCards();
});

evtSource.addEventListener('model:complete', function(e) {
  var data = JSON.parse(e.data);
  var req = state.requests.get(data.requestId);
  if (!req) return;
  var model = req.models.find(function(m) { return m.id === data.modelId; });
  if (model) {
    model.status = data.success ? 'success' : 'error';
    model.time = data.executionTimeMs;
  }
  renderFeedItem(req);

  var ms = state.modelStats.get(data.modelId);
  if (!ms) { ms = { requests: 0, totalTime: 0, inputTokens: 0, outputTokens: 0, errors: 0 }; state.modelStats.set(data.modelId, ms); }
  ms.requests++;
  ms.totalTime += data.executionTimeMs;
  ms.inputTokens += data.inputTokens || 0;
  ms.outputTokens += data.outputTokens || 0;
  if (!data.success) ms.errors++;
  updateModelTable();
});

evtSource.addEventListener('request:complete', function(e) {
  var data = JSON.parse(e.data);
  state.activeCount = Math.max(0, state.activeCount - 1);
  var req = state.requests.get(data.requestId);
  if (req) {
    req.completed = true;
    req.executionTimeMs = data.executionTimeMs;
    req.totalCost = data.totalCost;
    renderFeedItem(req);
  }
  updateCards();
  fetch('/api/stats').then(function(r) { return r.json(); }).then(function(d) {
    if (d.costs) {
      setText('dailyCost', d.costs.dailySpend || '$0.00');
      setText('monthlyCost', d.costs.monthlySpend || '$0.00');
    }
    if (d.cache) {
      setText('cacheHitRate', Math.round((d.cache.hitRate || 0) * 100) + '%');
      setText('cacheEntries', String(d.cache.entries || 0));
    }
  }).catch(function() {});
});

setInterval(function() {
  fetch('/api/stats').then(function(r) { return r.json(); }).then(function(d) {
    setText('uptime', 'Up ' + formatUptime(d.uptimeMs || 0));
  }).catch(function() {});
}, 10000);
</script>
</body>
</html>`;
}
