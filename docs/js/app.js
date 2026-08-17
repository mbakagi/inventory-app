// Main application controller
const App = {
  currentScreen: 'home',
  entries: {}, // {ref: {ref, name, count, timestamp}}
  lastScanned: '',
  currentSessionId: null,

  async init() {
    // Load catalog
    await Catalog.load();
    document.getElementById('catalogCount').textContent = `${Catalog.products.length} products`;

    // Load settings
    this._updateSetupDisplay();

    // Init scanner
    Scanner.init((code) => this._onBarcode(code));

    // Bind events
    this._bindEvents();

    // Show home
    this.navigate('home');
  },

  _bindEvents() {
    // Navigation
    document.querySelectorAll('.action-card').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.screen));
    });
    document.getElementById('backBtn').addEventListener('click', () => this._goBack());
    document.getElementById('menuBtn').addEventListener('click', () => this.navigate('home'));

    // Setup
    document.getElementById('setupBtn').addEventListener('click', () => this._showSetup());
    document.getElementById('setupCancel').addEventListener('click', () => this._hideSetup());
    document.getElementById('setupSave').addEventListener('click', () => this._saveSetup());

    // Count screen
    document.getElementById('toggleScanner').addEventListener('click', () => this._toggleScanner());
    document.getElementById('ocrBtn').addEventListener('click', () => this._doOCR());
    document.getElementById('saveSession').addEventListener('click', () => this._saveSession());
    document.getElementById('searchInput').addEventListener('input', (e) => this._onSearch(e.target.value));

    // Catalog screen
    document.getElementById('catalogSearch').addEventListener('input', () => this._renderCatalog());
    document.getElementById('brandFilter').addEventListener('change', () => this._renderCatalog());
    document.getElementById('familyFilter').addEventListener('change', () => this._renderCatalog());

    // Sessions screen
    document.getElementById('importExcel').addEventListener('click', () => this._importExcel());

    // Session detail
    document.getElementById('exportExcel').addEventListener('click', () => this._exportCurrentSession());
    document.getElementById('deleteSession').addEventListener('click', () => this._deleteCurrentSession());
  },

  // --- Navigation ---
  navigate(screen) {
    // Stop scanner if leaving count screen
    if (this.currentScreen === 'count' && screen !== 'count') {
      Scanner.stop();
    }

    this.currentScreen = screen;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById('screen-' + screen);
    if (target) target.classList.add('active');

    // Header
    const backBtn = document.getElementById('backBtn');
    const title = document.getElementById('headerTitle');
    if (screen === 'home') {
      backBtn.classList.add('hidden');
      title.textContent = 'ST3S Inventory';
    } else {
      backBtn.classList.remove('hidden');
      const titles = { count: 'Count Mode', catalog: 'Catalog', sessions: 'Sessions', 'session-detail': 'Session Detail' };
      title.textContent = titles[screen] || screen;
    }

    // Refresh content
    if (screen === 'catalog') this._renderCatalog();
    if (screen === 'sessions') this._renderSessions();
    if (screen === 'count') this._renderEntries();
  },

  _goBack() {
    if (this.currentScreen === 'session-detail') {
      this.navigate('sessions');
    } else {
      this.navigate('home');
    }
  },

  // --- Setup ---
  _updateSetupDisplay() {
    const name = Storage.getUserName();
    const depot = Storage.getDepot();
    document.getElementById('displayName').textContent = name || 'Set your name';
    document.getElementById('displayDepot').textContent = depot ? `Depot: ${depot}` : 'No depot selected';
  },

  _showSetup() {
    document.getElementById('setupName').value = Storage.getUserName();
    document.getElementById('setupDepot').value = Storage.getDepot();
    document.getElementById('setupDialog').classList.remove('hidden');
  },

  _hideSetup() {
    document.getElementById('setupDialog').classList.add('hidden');
  },

  _saveSetup() {
    Storage.setUserName(document.getElementById('setupName').value.trim());
    Storage.setDepot(document.getElementById('setupDepot').value.trim());
    this._updateSetupDisplay();
    this._hideSetup();
    this._toast('Settings saved');
  },

  // --- Count Mode ---
  _addProduct(product) {
    const existing = this.entries[product.ref];
    if (existing) {
      existing.count++;
    } else {
      this.entries[product.ref] = {
        ref: product.ref,
        name: product.name,
        count: 1,
        timestamp: new Date().toISOString()
      };
    }
    this.lastScanned = product.ref;
    this._renderEntries();
  },

  _onBarcode(code) {
    const product = Catalog.findByRef(code);
    if (product) {
      this._addProduct(product);
    } else {
      const matches = Fuzzy.match(code, Catalog.products, 1);
      if (matches.length > 0 && matches[0].score >= 80) {
        this._addProduct(matches[0].product);
      } else {
        this._toast(`Not found: ${code}`);
      }
    }
  },

  _onSearch(query) {
    if (query.trim().length < 2) return;
    const matches = Fuzzy.match(query, Catalog.products, 1);
    if (matches.length > 0 && matches[0].score >= 80) {
      this._addProduct(matches[0].product);
      document.getElementById('searchInput').value = '';
    }
  },

  async _toggleScanner() {
    const btn = document.getElementById('toggleScanner');
    if (Scanner.isScanning()) {
      Scanner.stop();
      btn.textContent = 'Start Scanner';
    } else {
      try {
        btn.textContent = 'Starting...';
        await Scanner.start();
        btn.textContent = 'Stop Scanner';
      } catch (e) {
        btn.textContent = 'Start Scanner';
        this._toast('Camera access denied or not available');
      }
    }
  },

  async _doOCR() {
    // Create file input for camera capture
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await OCR.recognize(file);
        this._processOcrText(text);
      } catch (err) {
        this._toast('OCR failed: ' + err.message);
      }
    };
    input.click();
  },

  _processOcrText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    let found = false;
    for (const line of lines) {
      // Try exact ref match
      const product = Catalog.findByRef(line);
      if (product) {
        this._addProduct(product);
        found = true;
        break;
      }
      // Try fuzzy on each word
      for (const word of line.split(/[\s,;:]+/)) {
        if (word.length < 3) continue;
        const matches = Fuzzy.match(word, Catalog.products, 1);
        if (matches.length > 0 && matches[0].score >= 80) {
          this._addProduct(matches[0].product);
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) this._toast('No product reference found in image');
  },

  _renderEntries() {
    const entries = Object.values(this.entries);
    const container = document.getElementById('entriesList');
    const itemCount = document.getElementById('itemCount');
    const totalCount = document.getElementById('totalCount');
    const lastScanned = document.getElementById('lastScanned');

    itemCount.textContent = `${entries.length} items`;
    totalCount.textContent = `${entries.reduce((s, e) => s + e.count, 0)} total`;

    if (this.lastScanned) {
      lastScanned.classList.remove('hidden');
      lastScanned.textContent = `Last: ${this.lastScanned}`;
    } else {
      lastScanned.classList.add('hidden');
    }

    container.innerHTML = entries.map(e => `
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
      </div>
    `).join('');
  },

  _changeQty(ref, delta) {
    const entry = this.entries[ref];
    if (!entry) return;
    entry.count += delta;
    if (entry.count <= 0) {
      delete this.entries[ref];
    }
    this._renderEntries();
  },

  async _saveSession() {
    const entries = Object.values(this.entries);
    if (entries.length === 0) {
      this._toast('No items counted yet');
      return;
    }
    const session = {
      id: Date.now().toString(),
      depot: Storage.getDepot() || 'Unknown',
      user: Storage.getUserName() || 'Unknown',
      createdAt: new Date().toISOString(),
      entries: entries
    };
    Storage.saveSession(session);
    this.entries = {};
    this.lastScanned = '';
    this._renderEntries();
    this._toast('Session saved!');
  },

  // --- Catalog ---
  _renderCatalog() {
    const query = document.getElementById('catalogSearch').value;
    const brand = document.getElementById('brandFilter').value;
    const family = document.getElementById('familyFilter').value;
    const results = Catalog.search(query, brand, family);

    // Populate filters
    const brandSel = document.getElementById('brandFilter');
    const familySel = document.getElementById('familyFilter');
    if (brandSel.options.length <= 1) {
      Catalog.getBrands().forEach(b => { const o = document.createElement('option'); o.value = b; o.textContent = b; brandSel.appendChild(o); });
      Catalog.getFamilies().forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; familySel.appendChild(o); });
    }

    const container = document.getElementById('catalogList');
    const limit = 100;
    const shown = results.slice(0, limit);
    container.innerHTML = shown.map(p => `
      <div class="catalog-item" onclick="App._addProductFromCatalog('${this._esc(p.ref)}')">
        <div class="catalog-ref">${this._esc(p.ref)}</div>
        <div class="catalog-name">${this._esc(p.name)}</div>
        <div class="catalog-meta">Qty: ${p.qty || 0} | ${this._esc(p.supplier || '')} | ${Catalog._readableFamily(p.family)}</div>
      </div>
    `).join('');
    if (results.length > limit) {
      container.innerHTML += `<div style="text-align:center;padding:8px;color:var(--text-secondary)">Showing ${limit} of ${results.length} results. Refine your search.</div>`;
    }
  },

  _addProductFromCatalog(ref) {
    const product = Catalog.findByRef(ref);
    if (product) {
      this._addProduct(product);
      this.navigate('count');
    }
  },

  // --- Sessions ---
  _renderSessions() {
    const sessions = Storage.getSessions();
    const container = document.getElementById('sessionsList');
    if (sessions.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-secondary)">No sessions yet</div>';
      return;
    }
    container.innerHTML = sessions.map(s => `
      <div class="session-card" onclick="App._viewSession('${s.id}')">
        <div class="session-title">${this._esc(s.depot)} - ${this._esc(s.user)}</div>
        <div class="session-sub">${new Date(s.createdAt).toLocaleString()} | ${s.entries.length} items | ${s.entries.reduce((t,e) => t + e.count, 0)} counted</div>
        <div class="session-actions">
          <button class="btn-sm" onclick="event.stopPropagation();App._exportSessionById('${s.id}')">📤 Export</button>
          <button class="btn-sm danger" onclick="event.stopPropagation();App._deleteSessionById('${s.id}')">🗑</button>
        </div>
      </div>
    `).join('');
  },

  _viewSession(id) {
    this.currentSessionId = id;
    const session = Storage.getSessions().find(s => s.id === id);
    if (!session) return;

    document.getElementById('sessionDetailInfo').innerHTML = `
      <p><strong>Depot:</strong> ${this._esc(session.depot)}</p>
      <p><strong>User:</strong> ${this._esc(session.user)}</p>
      <p><strong>Created:</strong> ${new Date(session.createdAt).toLocaleString()}</p>
      <p><strong>Items:</strong> ${session.entries.length} | <strong>Total:</strong> ${session.entries.reduce((t,e) => t + e.count, 0)}</p>
    `;

    document.getElementById('sessionDetailEntries').innerHTML = session.entries.map(e => `
      <div class="entry-row">
        <div class="entry-info">
          <div class="entry-ref">${this._esc(e.ref)}</div>
          <div class="entry-name">${this._esc(e.name)}</div>
        </div>
        <div class="entry-qty"><span>${e.count}</span></div>
      </div>
    `).join('');

    this.navigate('session-detail');
  },

  _exportCurrentSession() {
    const session = Storage.getSessions().find(s => s.id === this.currentSessionId);
    if (session) Excel.exportSession(session);
  },

  _deleteCurrentSession() {
    if (!confirm('Delete this session?')) return;
    Storage.deleteSession(this.currentSessionId);
    this._toast('Session deleted');
    this.navigate('sessions');
  },

  _exportSessionById(id) {
    const session = Storage.getSessions().find(s => s.id === id);
    if (session) Excel.exportSession(session);
  },

  _deleteSessionById(id) {
    if (!confirm('Delete this session?')) return;
    Storage.deleteSession(id);
    this._renderSessions();
    this._toast('Session deleted');
  },

  async _importExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const entries = await Excel.importFile(file);
        if (entries.length === 0) {
          this._toast('No valid entries found in file');
          return;
        }
        const session = {
          id: Date.now().toString(),
          depot: 'Imported',
          user: 'Import',
          createdAt: new Date().toISOString(),
          entries: entries
        };
        Storage.saveSession(session);
        this._renderSessions();
        this._toast(`Imported ${entries.length} entries`);
      } catch (err) {
        this._toast('Import failed: ' + err.message);
      }
    };
    input.click();
  },

  // --- Utilities ---
  _esc(str) {
    return String(str).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, '&#39;');
  },

  _toast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());