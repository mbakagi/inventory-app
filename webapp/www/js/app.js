// Main application controller
const App = {
  currentScreen: 'home',
  entries: {},
  lastScanned: '',
  currentSessionId: null,
  _undoStack: [],
  _batchMode: false,
  _darkMode: false,
  _searchTimer: null,
  _brandCache: {},

  async init() {
    this._darkMode = localStorage.getItem('st3s_dark') === '1';
    if (this._darkMode) document.body.classList.add('dark');
    await Catalog.load();
    document.getElementById('catalogCount').textContent = `${Catalog.products.length} products`;
    this._updateSetupDisplay();
    Scanner.init((code) => this._onBarcode(code));
    this._bindEvents();
    this.navigate('home');
  },

  _bindEvents() {
    document.querySelectorAll('.action-card').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.screen));
    });
    document.getElementById('backBtn').addEventListener('click', () => this._goBack());
    document.getElementById('menuBtn').addEventListener('click', () => this.navigate('home'));

    // Setup
    document.getElementById('setupBtn').addEventListener('click', () => this._showSetup());
    document.getElementById('setupCancel').addEventListener('click', () => this._hideSetup());
    document.getElementById('setupSave').addEventListener('click', () => this._saveSetup());

    // Count
    document.getElementById('toggleScanner').addEventListener('click', () => this._toggleScanner());
    document.getElementById('ocrBtn').addEventListener('click', () => this._doOCR());
    document.getElementById('saveSession').addEventListener('click', () => this._saveSession());
    document.getElementById('searchInput').addEventListener('input', (e) => this._onSearchInput(e.target.value));
    document.getElementById('searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._onSearchEnter(); }
    });
    document.getElementById('searchInput').addEventListener('focus', () => {
      if (document.getElementById('searchInput').value.trim().length >= 2) this._onSearchInput(document.getElementById('searchInput').value);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#searchInput') && !e.target.closest('#searchDropdown')) {
        const dd = document.getElementById('searchDropdown');
        if (dd) dd.remove();
      }
    });

    // Catalog
    document.getElementById('catalogSearch').addEventListener('input', () => this._renderCatalog());
    document.getElementById('brandFilter').addEventListener('change', () => this._renderCatalog());
    document.getElementById('familyFilter').addEventListener('change', () => this._renderCatalog());

    // Sessions
    document.getElementById('importExcel').addEventListener('click', () => this._importExcel());

    // Session detail
    document.getElementById('exportExcel').addEventListener('click', () => this._exportCurrentSession());
    document.getElementById('exportPdf').addEventListener('click', () => this._exportCurrentSessionPdf());
    document.getElementById('deleteSession').addEventListener('click', () => this._deleteCurrentSession());

    // QR
    document.getElementById('qrClose').addEventListener('click', () => document.getElementById('qrDialog').classList.add('hidden'));

    // Home toolbar
    document.getElementById('backupBtn').addEventListener('click', () => this._backupData());
    document.getElementById('restoreBtn').addEventListener('click', () => this._restoreData());
    document.getElementById('darkModeBtn').addEventListener('click', () => this._toggleDarkMode());

    // Count toolbar
    document.getElementById('undoBtn').addEventListener('click', () => this._undo());
    document.getElementById('batchBtn').addEventListener('click', () => {
      this._batchMode = !this._batchMode;
      document.getElementById('batchBtn').style.background = this._batchMode ? 'var(--primary)' : '';
      document.getElementById('batchBtn').style.color = this._batchMode ? 'white' : '';
      this._toast(this._batchMode ? 'Batch mode ON' : 'Batch mode OFF');
    });
    document.getElementById('printLabelsBtn').addEventListener('click', () => this._printLabels());

    // Taxonomy
    document.getElementById('addBrand').addEventListener('click', () => this._addBrand());
    document.getElementById('addCategory').addEventListener('click', () => this._addCategory());
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
        document.getElementById('tab-' + t.dataset.tab).classList.add('active');
      });
    });
  },

  // --- Navigation ---
  navigate(screen) {
    if (this.currentScreen === 'count' && screen !== 'count') Scanner.stop();
    this.currentScreen = screen;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + screen);
    if (target) target.classList.add('active');

    const backBtn = document.getElementById('backBtn');
    const title = document.getElementById('headerTitle');
    if (screen === 'home') {
      backBtn.classList.add('hidden');
      title.textContent = 'ST3S Inventory';
    } else {
      backBtn.classList.remove('hidden');
      const titles = { count: 'Count Mode', catalog: 'Catalog', sessions: 'Sessions', 'session-detail': 'Session Detail', taxonomy: 'Taxonomy', dashboard: 'Dashboard' };
      title.textContent = titles[screen] || screen;
    }

    if (screen === 'catalog') this._renderCatalog();
    if (screen === 'sessions') this._renderSessions();
    if (screen === 'count') this._renderEntries();
    if (screen === 'taxonomy') { this._renderBrands(); this._renderCategories(); }
    if (screen === 'dashboard') this._renderDashboard();
  },

  _goBack() {
    if (this.currentScreen === 'session-detail') this.navigate('sessions');
    else this.navigate('home');
  },

  // --- Setup ---
  _updateSetupDisplay() {
    document.getElementById('displayName').textContent = Storage.getUserName() || 'Set your name';
    document.getElementById('displayDepot').textContent = Storage.getDepot() ? `Depot: ${Storage.getDepot()}` : 'No depot selected';
  },
  _showSetup() {
    document.getElementById('setupName').value = Storage.getUserName();
    document.getElementById('setupDepot').value = Storage.getDepot();
    document.getElementById('setupDialog').classList.remove('hidden');
  },
  _hideSetup() { document.getElementById('setupDialog').classList.add('hidden'); },
  _saveSetup() {
    Storage.setUserName(document.getElementById('setupName').value.trim());
    Storage.setDepot(document.getElementById('setupDepot').value.trim());
    this._updateSetupDisplay();
    this._hideSetup();
    this._toast('Settings saved');
  },

  // --- Count ---
  _addProduct(product) {
    this._undoStack.push({ action: 'add', ref: product.ref, prev: this.entries[product.ref] ? this.entries[product.ref].count : 0 });
    const existing = this.entries[product.ref];
    if (existing) existing.count++;
    else this.entries[product.ref] = { ref: product.ref, name: product.name, count: 1, timestamp: new Date().toISOString() };
    this.lastScanned = product.ref;
    this._renderEntries();
    if (this._batchMode) {
      this._toast(`+1 ${product.ref}`);
      document.getElementById('searchInput').focus();
    }
  },
  _onBarcode(code) {
    const product = Catalog.findByRef(code);
    if (product) this._addProduct(product);
    else {
      const matches = Fuzzy.match(code, Catalog.products, 1);
      if (matches.length > 0 && matches[0].score >= 85) this._addProduct(matches[0].product);
      else this._toast(`Not found: ${code}`);
    }
  },

  // --- Search (fixed: dropdown instead of auto-add) ---
  _onSearchInput(query) {
    clearTimeout(this._searchTimer);
    const q = query.trim();
    if (q.length < 2) { this._hideSearchDropdown(); return; }
    this._searchTimer = setTimeout(() => {
      const matches = Fuzzy.match(q, Catalog.products, 10).filter(m => m.score >= 70);
      this._showSearchDropdown(matches);
    }, 200);
  },
  _showSearchDropdown(matches) {
    this._hideSearchDropdown();
    if (matches.length === 0) return;
    const input = document.getElementById('searchInput');
    const rect = input.getBoundingClientRect();
    const dd = document.createElement('div');
    dd.id = 'searchDropdown';
    dd.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;width:${rect.width}px;max-height:300px;overflow-y:auto;background:var(--card);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:500;`;
    dd.innerHTML = matches.map(m => `
      <div class="search-result" data-ref="${this._esc(m.product.ref)}" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:0.9rem;">${this._esc(m.product.ref)}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary);">${this._esc(m.product.name)}</div>
        </div>
        <span style="font-size:0.75rem;color:var(--primary);">${m.score}%</span>
      </div>`).join('');
    dd.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        const ref = el.dataset.ref;
        const product = Catalog.findByRef(ref);
        if (product) { this._addProduct(product); document.getElementById('searchInput').value = ''; }
        this._hideSearchDropdown();
      });
    });
    document.body.appendChild(dd);
  },
  _hideSearchDropdown() {
    const dd = document.getElementById('searchDropdown');
    if (dd) dd.remove();
  },
  _onSearchEnter() {
    const q = document.getElementById('searchInput').value.trim();
    if (q.length < 2) return;
    const matches = Fuzzy.match(q, Catalog.products, 1);
    if (matches.length > 0 && matches[0].score >= 85) {
      this._addProduct(matches[0].product);
      document.getElementById('searchInput').value = '';
      this._hideSearchDropdown();
    } else {
      this._toast('No match found');
    }
  },

  // --- Undo ---
  _undo() {
    if (this._undoStack.length === 0) { this._toast('Nothing to undo'); return; }
    const last = this._undoStack.pop();
    if (last.action === 'add') {
      if (last.prev === 0) delete this.entries[last.ref];
      else if (this.entries[last.ref]) this.entries[last.ref].count = last.prev;
    }
    this._renderEntries();
    this._toast('Undone');
  },

  async _toggleScanner() {
    const btn = document.getElementById('toggleScanner');
    if (Scanner.isScanning()) { Scanner.stop(); btn.textContent = 'Start Scanner'; }
    else {
      try { btn.textContent = 'Starting...'; await Scanner.start(); btn.textContent = 'Stop Scanner'; }
      catch (e) { btn.textContent = 'Start Scanner'; this._toast('Camera access denied'); }
    }
  },
  async _doOCR() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { const text = await OCR.recognize(file); this._processOcrText(text); }
      catch (err) { this._toast('OCR failed: ' + err.message); }
    };
    input.click();
  },
  _processOcrText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    let found = false;
    for (const line of lines) {
      const product = Catalog.findByRef(line);
      if (product) { this._addProduct(product); found = true; break; }
      for (const word of line.split(/[\s,;:]+/)) {
        if (word.length < 3) continue;
        const matches = Fuzzy.match(word, Catalog.products, 1);
        if (matches.length > 0 && matches[0].score >= 85) { this._addProduct(matches[0].product); found = true; break; }
      }
      if (found) break;
    }
    if (!found) this._toast('No product reference found in image');
  },
  _renderEntries() {
    const entries = Object.values(this.entries);
    document.getElementById('itemCount').textContent = `${entries.length} items`;
    document.getElementById('totalCount').textContent = `${entries.reduce((s, e) => s + e.count, 0)} total`;
    const ls = document.getElementById('lastScanned');
    if (this.lastScanned) { ls.classList.remove('hidden'); ls.textContent = `Last: ${this.lastScanned}`; }
    else ls.classList.add('hidden');
    document.getElementById('entriesList').innerHTML = entries.map(e => `
      <div class="entry-row">
        <div class="entry-info">
          <div class="entry-ref">${this._esc(e.ref)}</div>
          <div class="entry-name">${this._esc(e.name)}</div>
        </div>
        <div class="entry-qty">
          <button onclick="App._changeQty('${this._esc(e.ref)}', -1)">−</button>
          <span>${e.count}</span>
          <button onclick="App._changeQty('${this._esc(e.ref)}', 1)">+</button>
        </div>
      </div>`).join('');
  },
  _changeQty(ref, delta) {
    const entry = this.entries[ref]; if (!entry) return;
    this._undoStack.push({ action: 'add', ref, prev: entry.count });
    entry.count += delta; if (entry.count <= 0) delete this.entries[ref];
    this._renderEntries();
  },
  async _saveSession() {
    const entries = Object.values(this.entries);
    if (entries.length === 0) { this._toast('No items counted yet'); return; }
    Storage.saveSession({ id: Date.now().toString(), depot: Storage.getDepot() || 'Unknown', user: Storage.getUserName() || 'Unknown', createdAt: new Date().toISOString(), entries });
    this.entries = {}; this.lastScanned = ''; this._undoStack = []; this._renderEntries(); this._toast('Session saved!');
  },

  // --- Catalog ---
  _renderCatalog() {
    const query = document.getElementById('catalogSearch').value;
    const brand = document.getElementById('brandFilter').value;
    const family = document.getElementById('familyFilter').value;
    const results = Catalog.search(query, brand, family);
    const brandSel = document.getElementById('brandFilter');
    const familySel = document.getElementById('familyFilter');
    if (brandSel.options.length <= 1) {
      const allBrands = new Set([...Catalog.getBrands(), ...Taxonomy.getBrands()]);
      [...allBrands].sort().forEach(b => { const o = document.createElement('option'); o.value = b; o.textContent = b; brandSel.appendChild(o); });
      Catalog.getFamilies().forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; familySel.appendChild(o); });
    }
    const limit = 100;
    const shown = results.slice(0, limit);
    document.getElementById('catalogList').innerHTML = shown.map(p => `
      <div class="catalog-item">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="flex:1;" onclick="App._addProductFromCatalog('${this._esc(p.ref)}')">
            <div class="catalog-ref">${this._esc(p.ref)}</div>
            <div class="catalog-name">${this._esc(p.name)}</div>
            <div class="catalog-meta">Qty: ${p.qty || 0} | ${this._esc(p.supplier || '')} | ${Catalog._readableFamily(p.family)}</div>
          </div>
          <button class="btn-sm" onclick="event.stopPropagation();App._showQr('${this._esc(p.ref)}','${this._esc(p.name)}')" title="QR Code">🔲</button>
        </div>
      </div>`).join('');
    if (results.length > limit) document.getElementById('catalogList').innerHTML += `<div style="text-align:center;padding:8px;color:var(--text-secondary)">Showing ${limit} of ${results.length} results.</div>`;
  },
  _addProductFromCatalog(ref) { const p = Catalog.findByRef(ref); if (p) { this._addProduct(p); this.navigate('count'); } },

  // --- QR Code ---
  async _showQr(ref, name) {
    document.getElementById('qrTitle').textContent = name || ref;
    document.getElementById('qrRef').textContent = ref;
    const canvas = document.getElementById('qrCanvas');
    try {
      await QRCode.toCanvas(canvas, ref, { width: 200, margin: 1, color: { dark: '#000', light: '#fff' } });
      document.getElementById('qrDialog').classList.remove('hidden');
    } catch (e) { this._toast('QR generation failed'); }
  },

  // --- Sessions ---
  _renderSessions() {
    const sessions = Storage.getSessions();
    const container = document.getElementById('sessionsList');
    if (sessions.length === 0) { container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-secondary)">No sessions yet</div>'; return; }
    container.innerHTML = sessions.map(s => `
      <div class="session-card" onclick="App._viewSession('${s.id}')">
        <div class="session-title">${this._esc(s.depot)} - ${this._esc(s.user)}</div>
        <div class="session-sub">${new Date(s.createdAt).toLocaleString()} | ${s.entries.length} items | ${s.entries.reduce((t,e) => t + e.count, 0)} counted</div>
        <div class="session-actions">
          <button class="btn-sm" onclick="event.stopPropagation();App._exportSessionById('${s.id}')">📤 Excel</button>
          <button class="btn-sm" onclick="event.stopPropagation();App._exportSessionPdfById('${s.id}')">📄 PDF</button>
          <button class="btn-sm danger" onclick="event.stopPropagation();App._deleteSessionById('${s.id}')">🗑</button>
        </div>
      </div>`).join('');
  },
  _viewSession(id) {
    this.currentSessionId = id;
    const session = Storage.getSessions().find(s => s.id === id); if (!session) return;
    document.getElementById('sessionDetailInfo').innerHTML = `
      <p><strong>Depot:</strong> ${this._esc(session.depot)}</p>
      <p><strong>User:</strong> ${this._esc(session.user)}</p>
      <p><strong>Created:</strong> ${new Date(session.createdAt).toLocaleString()}</p>
      <p><strong>Items:</strong> ${session.entries.length} | <strong>Total:</strong> ${session.entries.reduce((t,e) => t + e.count, 0)}</p>`;
    document.getElementById('sessionDetailEntries').innerHTML = session.entries.map(e => `
      <div class="entry-row"><div class="entry-info"><div class="entry-ref">${this._esc(e.ref)}</div><div class="entry-name">${this._esc(e.name)}</div></div><div class="entry-qty"><span>${e.count}</span></div></div>`).join('');
    this.navigate('session-detail');
  },
  _exportCurrentSession() { const s = Storage.getSessions().find(s => s.id === this.currentSessionId); if (s) Excel.exportSession(s); },
  _exportCurrentSessionPdf() { const s = Storage.getSessions().find(s => s.id === this.currentSessionId); if (s) this._exportPdf(s); },
  _deleteCurrentSession() { if (!confirm('Delete this session?')) return; Storage.deleteSession(this.currentSessionId); this._toast('Session deleted'); this.navigate('sessions'); },
  _exportSessionById(id) { const s = Storage.getSessions().find(s => s.id === id); if (s) Excel.exportSession(s); },
  _exportSessionPdfById(id) { const s = Storage.getSessions().find(s => s.id === id); if (s) this._exportPdf(s); },
  _deleteSessionById(id) { if (!confirm('Delete this session?')) return; Storage.deleteSession(id); this._renderSessions(); this._toast('Session deleted'); },

  // --- PDF Export ---
  _exportPdf(session) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Count Session: ${session.depot}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`User: ${session.user}  |  Date: ${new Date(session.createdAt).toLocaleString()}`, 14, 28);
    doc.text(`Items: ${session.entries.length}  |  Total counted: ${session.entries.reduce((t,e) => t + e.count, 0)}`, 14, 34);
    const headers = [['Reference', 'Name', 'Count']];
    const rows = session.entries.map(e => [e.ref, e.name, String(e.count)]);
    doc.autoTable({ head: headers, body: rows, startY: 40, styles: { fontSize: 8 }, headStyles: { fillColor: [183, 28, 28] } });
    doc.save(`count_${session.depot}_${session.id}.pdf`);
  },

  async _importExcel() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const entries = await Excel.importFile(file);
        if (entries.length === 0) { this._toast('No valid entries found'); return; }
        Storage.saveSession({ id: Date.now().toString(), depot: 'Imported', user: 'Import', createdAt: new Date().toISOString(), entries });
        this._renderSessions(); this._toast(`Imported ${entries.length} entries`);
      } catch (err) { this._toast('Import failed: ' + err.message); }
    };
    input.click();
  },

  // --- Dashboard ---
  _renderDashboard() {
    const sessions = Storage.getSessions();
    const container = document.getElementById('screen-dashboard');
    if (!container) return;

    // Stats
    const totalCounted = sessions.reduce((t, s) => t + s.entries.reduce((a, e) => a + e.count, 0), 0);
    const totalItems = sessions.reduce((t, s) => t + s.entries.length, 0);
    const totalSessions = sessions.length;

    container.innerHTML = `
      <div class="stats-row">
        <div class="stat-card"><strong>${totalSessions}</strong><small>Sessions</small></div>
        <div class="stat-card"><strong>${totalItems}</strong><small>Items</small></div>
        <div class="stat-card"><strong>${totalCounted}</strong><small>Total Counted</small></div>
      </div>
      <div class="card"><canvas id="chartSessions"></canvas></div>
      <div class="card"><canvas id="chartTop"></canvas></div>
      <div class="card" id="varianceReport"></div>
    `;

    // Sessions chart
    const last10 = sessions.slice(0, 10).reverse();
    if (last10.length > 0) {
      new Chart(document.getElementById('chartSessions'), {
        type: 'bar',
        data: {
          labels: last10.map(s => new Date(s.createdAt).toLocaleDateString()),
          datasets: [{
            label: 'Items Counted',
            data: last10.map(s => s.entries.reduce((a, e) => a + e.count, 0)),
            backgroundColor: '#b71c1c'
          }]
        },
        options: { responsive: true, plugins: { title: { display: true, text: 'Recent Sessions' } } }
      });
    }

    // Top products
    const productCounts = {};
    sessions.forEach(s => s.entries.forEach(e => {
      productCounts[e.ref] = (productCounts[e.ref] || 0) + e.count;
    }));
    const top = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (top.length > 0) {
      new Chart(document.getElementById('chartTop'), {
        type: 'bar',
        data: {
          labels: top.map(([ref]) => ref),
          datasets: [{ label: 'Total Counted', data: top.map(([, c]) => c), backgroundColor: '#2e7d32' }]
        },
        options: { indexAxis: 'y', responsive: true, plugins: { title: { display: true, text: 'Top Products' } } }
      });
    }

    // Variance report
    this._renderVariance();
  },

  _renderVariance() {
    const sessions = Storage.getSessions();
    const productCounts = {};
    sessions.forEach(s => s.entries.forEach(e => {
      productCounts[e.ref] = (productCounts[e.ref] || 0) + e.count;
    }));

    const variances = [];
    for (const [ref, counted] of Object.entries(productCounts)) {
      const product = Catalog.findByRef(ref);
      const expected = product ? (product.qty || 0) : 0;
      const diff = counted - expected;
      if (Math.abs(diff) > 0) variances.push({ ref, name: product ? product.name : ref, expected, counted, diff });
    }
    variances.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    const container = document.getElementById('varianceReport');
    if (variances.length === 0) {
      container.innerHTML = '<h3>Variance Report</h3><p style="color:var(--text-secondary)">No discrepancies found</p>';
      return;
    }
    container.innerHTML = `
      <h3>Variance Report</h3>
      <div style="max-height:300px;overflow-y:auto;">
        ${variances.slice(0, 20).map(v => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
            <div>
              <strong>${this._esc(v.ref)}</strong>
              <small style="color:var(--text-secondary)">${this._esc(v.name)}</small>
            </div>
            <div style="text-align:right;">
              <span>Expected: ${v.expected}</span>
              <span style="color:${v.diff > 0 ? 'var(--success)' : 'var(--danger)'};font-weight:700;"> ${v.diff > 0 ? '+' : ''}${v.diff}</span>
            </div>
          </div>`).join('')}
      </div>`;
  },

  // --- Backup/Restore ---
  _backupData() {
    const data = {
      version: 1,
      timestamp: new Date().toISOString(),
      settings: { user: Storage.getUserName(), depot: Storage.getDepot() },
      sessions: Storage.getSessions(),
      taxonomy: { brands: Taxonomy.getBrands(), nodes: Taxonomy.getNodes() },
      catalog: Catalog.products
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `st3s_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this._toast('Backup downloaded');
  },
  async _restoreData() {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.version) throw new Error('Invalid backup file');
        if (data.settings) { Storage.setUserName(data.settings.user || ''); Storage.setDepot(data.settings.depot || ''); }
        if (data.sessions) data.sessions.forEach(s => Storage.saveSession(s));
        if (data.taxonomy) {
          if (data.taxonomy.brands) data.taxonomy.brands.forEach(b => Taxonomy.addBrand(b));
          if (data.taxonomy.nodes) {
            localStorage.setItem('st3s_tax_nodes', JSON.stringify(data.taxonomy.nodes));
          }
        }
        if (data.catalog) { Catalog.products = data.catalog; Storage.setCachedCatalog(data.catalog); }
        this._updateSetupDisplay();
        this._toast('Data restored! Reloading...');
        setTimeout(() => location.reload(), 1500);
      } catch (err) { this._toast('Invalid backup file'); }
    };
    input.click();
  },

  // --- Dark Mode ---
  _toggleDarkMode() {
    this._darkMode = !this._darkMode;
    localStorage.setItem('st3s_dark', this._darkMode ? '1' : '0');
    document.body.classList.toggle('dark', this._darkMode);
    this._toast(this._darkMode ? 'Dark mode on' : 'Dark mode off');
  },

  // --- Print Labels ---
  _printLabels() {
    const entries = Object.values(this.entries);
    if (entries.length === 0) { this._toast('No items to print labels for'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let x = 5, y = 5;
    const w = 60, h = 35;
    let col = 0;
    entries.forEach((e, i) => {
      if (col === 3) { col = 0; x = 5; y += h + 5; }
      if (y > 270) { doc.addPage(); y = 5; x = 5; col = 0; }
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.rect(x, y, w, h);
      doc.setFontSize(7);
      doc.text(e.ref, x + 2, y + 6);
      doc.setFontSize(5);
      doc.text(e.name.substring(0, 30), x + 2, y + 12);
      // QR code
      const qrCanvas = document.createElement('canvas');
      QRCode.toCanvas(qrCanvas, e.ref, { width: 80, margin: 0 }, () => {
        doc.addImage(qrCanvas, 'PNG', x + 30, y + 14, 25, 20);
        if (i === entries.length - 1) doc.save('labels.pdf');
      });
      x += w + 5;
      col++;
    });
    if (entries.length === 0) return;
    setTimeout(() => doc.save('labels.pdf'), 500);
  },

  // --- Taxonomy ---
  _renderBrands() {
    const brands = Taxonomy.getBrands();
    document.getElementById('brandsList').innerHTML = brands.length === 0
      ? '<div style="text-align:center;padding:16px;color:var(--text-secondary)">No custom brands yet</div>'
      : brands.map(b => `<div class="taxonomy-item"><span>${this._esc(b)}</span><button class="btn-sm danger" onclick="App._removeBrand('${this._esc(b)}')">🗑</button></div>`).join('');
  },
  _addBrand() {
    const input = document.getElementById('newBrand');
    Taxonomy.addBrand(input.value);
    input.value = '';
    this._renderBrands();
    this._toast('Brand added');
  },
  _removeBrand(name) { Taxonomy.removeBrand(name); this._renderBrands(); this._toast('Brand removed'); },
  _renderCategories() {
    const roots = Taxonomy.getRoots();
    document.getElementById('categoriesTree').innerHTML = roots.length === 0
      ? '<div style="text-align:center;padding:16px;color:var(--text-secondary)">No categories yet</div>'
      : roots.map(n => this._renderTreeNode(n, 0)).join('');
  },
  _renderTreeNode(node, depth) {
    const children = Taxonomy.childrenOf(node.id);
    const hasChildren = children.length > 0;
    const id = node.id;
    return `
      <div class="tree-node" style="padding-left:${depth * 20 + 8}px">
        <span class="expand">${hasChildren ? '▼' : '·'}</span>
        <span class="name">${this._esc(node.name)}</span>
        <div class="tree-actions">
          <button onclick="App._addSubCategory('${id}')" title="Add sub">+</button>
          <button onclick="App._renameCategory('${id}','${this._esc(node.name)}')" title="Rename">✎</button>
          <button onclick="App._removeCategory('${id}')" title="Delete">🗑</button>
        </div>
      </div>
      ${hasChildren ? `<div class="tree-children open">${children.map(c => this._renderTreeNode(c, depth + 1)).join('')}</div>` : ''}`;
  },
  _addCategory() { const input = document.getElementById('newCategory'); Taxonomy.addNode('', input.value); input.value = ''; this._renderCategories(); this._toast('Category added'); },
  _addSubCategory(parentId) { const name = prompt('Sub-category name:'); if (name && name.trim()) { Taxonomy.addNode(parentId, name.trim()); this._renderCategories(); } },
  _renameCategory(id, oldName) { const name = prompt('New name:', oldName); if (name && name.trim()) { Taxonomy.renameNode(id, name.trim()); this._renderCategories(); } },
  _removeCategory(id) { if (!confirm('Delete this category and all sub-categories?')) return; Taxonomy.removeNode(id); this._renderCategories(); this._toast('Category deleted'); },

  // --- Utilities ---
  _esc(str) { return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, '&#39;'); },
  _toast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg; toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());