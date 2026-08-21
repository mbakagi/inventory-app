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
  _toastTimer: null,
  _suppressHash: false,
  _catalogFiltersReady: false,
  _currentQrRef: null,
  _currentQrName: '',
  _labelItems: [],

  async init() {
    this._darkMode = localStorage.getItem('st3s_dark') === '1';
    if (this._darkMode) document.body.classList.add('dark');
    await Catalog.load();
    document.getElementById('catalogCount').textContent = `${Catalog.products.length} products`;
    this._updateSetupDisplay();
    Scanner.init((code) => this._onBarcode(code));
    this._bindEvents();
    if (typeof PWA !== 'undefined') PWA.init();
    const initial = location.hash.replace('#', '');
    this.navigate(initial || 'home');
  },

  _bindEvents() {
    document.querySelectorAll('.action-card').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.screen));
    });
    document.getElementById('backBtn').addEventListener('click', () => this._goBack());
    document.getElementById('menuBtn').addEventListener('click', () => this.navigate('home'));
    window.addEventListener('hashchange', () => {
      if (this._suppressHash) return;
      const h = location.hash.replace('#', '');
      if (h && h !== this.currentScreen) this.navigate(h);
    });

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
    document.getElementById('entriesList').addEventListener('click', (e) => this._onEntryClick(e));

    // Catalog (delegated actions)
    document.getElementById('catalogSearch').addEventListener('input', () => this._renderCatalog());
    document.getElementById('familyFilter').addEventListener('change', () => this._onFamilyChange());
    document.getElementById('sub1Filter').addEventListener('change', () => this._onSub1Change());
    document.getElementById('sub2Filter').addEventListener('change', () => this._onSub2Change());
    document.getElementById('sub3Filter').addEventListener('change', () => this._renderCatalog());
    document.getElementById('favFilter').addEventListener('change', () => this._renderCatalog());
    document.getElementById('catalogPrintLabels').addEventListener('click', () => this._printCatalogLabels());
    document.getElementById('catalogFindReplace').addEventListener('click', () => this._showFindReplace());
    document.getElementById('catalogList').addEventListener('click', (e) => this._onCatalogClick(e));

    // Edit product dialog
    document.getElementById('editProductCancel').addEventListener('click', () => this._hideEditProduct());
    document.getElementById('editProductSave').addEventListener('click', () => this._saveEditProduct());
    document.getElementById('editProductDelete').addEventListener('click', () => this._resetProduct());

    // Find & replace dialog
    document.getElementById('findReplaceCancel').addEventListener('click', () => document.getElementById('findReplaceDialog').classList.add('hidden'));
    document.getElementById('findReplaceInput').addEventListener('input', () => this._previewFindReplace());
    document.getElementById('findReplaceField').addEventListener('change', () => this._previewFindReplace());
    document.getElementById('findReplaceApply').addEventListener('click', () => this._applyFindReplace());

    // Sessions
    document.getElementById('importExcel').addEventListener('click', () => this._importExcel());
    document.getElementById('sessionsList').addEventListener('click', (e) => this._onSessionClick(e));

    // Session detail
    document.getElementById('exportExcel').addEventListener('click', () => this._exportCurrentSession());
    document.getElementById('exportPdf').addEventListener('click', () => this._exportCurrentSessionPdf());
    document.getElementById('applyToStock').addEventListener('click', () => this._applyCurrentSessionToStock());
    document.getElementById('deleteSession').addEventListener('click', () => this._deleteCurrentSession());
    document.getElementById('sessionDetailEntries').addEventListener('click', (e) => this._onSessionEntryClick(e));

    // QR
    document.getElementById('qrClose').addEventListener('click', () => this._hideQr());
    document.getElementById('qrDownload').addEventListener('click', () => this._downloadQr());
    document.getElementById('qrPrintLabel').addEventListener('click', () => {
      if (this._currentQrRef) { const ref = this._currentQrRef; this._hideQr(); this._printSingleLabel(ref, this._currentQrName || ''); }
    });

    // Label Print Dialog
    document.getElementById('labelItemsList').addEventListener('click', (e) => {
      const row = e.target.closest('.label-item-row[data-idx]');
      if (!row) return;
      if (e.target.tagName === 'INPUT') e.preventDefault();
      this._labelToggleItem(parseInt(row.dataset.idx, 10));
    });
    document.getElementById('labelCancel').addEventListener('click', () => this._hideLabelDialog());
    document.getElementById('labelPrint').addEventListener('click', () => this._doPrintLabels());
    document.getElementById('labelSize').addEventListener('change', () => this._onLabelSizeChange());
    document.getElementById('labelW').addEventListener('input', () => this._updateLabelPreview());
    document.getElementById('labelH').addEventListener('input', () => this._updateLabelPreview());
    document.getElementById('labelCols').addEventListener('change', () => this._updateLabelPreview());
    document.getElementById('labelTemplate').addEventListener('change', () => this._updateLabelPreview());
    document.getElementById('labelBorders').addEventListener('change', () => this._updateLabelPreview());
    document.getElementById('labelSelectAll').addEventListener('click', () => this._labelToggleAll(true));
    document.getElementById('labelDeselectAll').addEventListener('click', () => this._labelToggleAll(false));

    // Home toolbar
    document.getElementById('backupBtn').addEventListener('click', () => this._backupData());
    document.getElementById('restoreBtn').addEventListener('click', () => this._restoreData());
    document.getElementById('darkModeBtn').addEventListener('click', () => this._toggleDarkMode());
    document.getElementById('installBtn').addEventListener('click', () => {
      if (typeof PWA !== 'undefined' && PWA.promptInstall()) return;
      this.navigate('manuals');
    });

    // Count toolbar
    document.getElementById('undoBtn').addEventListener('click', () => this._undo());
    document.getElementById('batchBtn').addEventListener('click', () => {
      this._batchMode = !this._batchMode;
      const b = document.getElementById('batchBtn');
      b.classList.toggle('active', this._batchMode);
      this._toast(this._batchMode ? 'Batch mode ON' : 'Batch mode OFF');
    });
    document.getElementById('printLabelsBtn').addEventListener('click', () => this._printLabels());

    // Taxonomy
    document.getElementById('addBrand').addEventListener('click', () => this._addBrand());
    document.getElementById('addCategory').addEventListener('click', () => this._addCategory());
    document.getElementById('brandsList').addEventListener('click', (e) => {
      const btn = e.target.closest('.act-del-brand');
      if (btn) this._removeBrand(btn.dataset.name);
    });
    document.getElementById('categoriesTree').addEventListener('click', (e) => {
      const add = e.target.closest('.act-add');
      const rename = e.target.closest('.act-rename');
      const del = e.target.closest('.act-del');
      if (add) this._addSubCategory(add.dataset.id);
      else if (rename) this._renameCategory(rename.dataset.id);
      else if (del) this._removeCategory(del.dataset.id);
    });

    // Dashboard variance actions (delegated)
    document.getElementById('screen-dashboard').addEventListener('click', (e) => {
      const applyAll = e.target.closest('#varianceApplyAll');
      const applyRow = e.target.closest('[data-vref]');
      if (applyAll) this._applyAllVariance();
      else if (applyRow) this._applyVarianceRow(applyRow.dataset.vref, parseInt(applyRow.dataset.vcount, 10));
    });
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
      const titles = { count: 'Count Mode', catalog: 'Catalog', sessions: 'Sessions', 'session-detail': 'Session Detail', taxonomy: 'Taxonomy', dashboard: 'Dashboard', manuals: 'Manuals & Help' };
      title.textContent = titles[screen] || screen;
    }

    // Update URL hash (deep-linkable + back/forward support)
    this._suppressHash = true;
    const desired = screen === 'home' ? '' : '#' + screen;
    if (location.hash !== desired) {
      try { location.hash = desired; } catch (e) { /* ignore */ }
    }
    this._suppressHash = false;

    if (screen === 'home') this._renderFavorites();
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

  // --- Search (dropdown, no auto-add) ---
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
      <div class="entry-row" data-ref="${this._esc(e.ref)}">
        <div class="entry-info">
          <div class="entry-ref">${this._esc(e.ref)}</div>
          <div class="entry-name">${this._esc(e.name)}</div>
        </div>
        <div class="entry-qty">
          <button class="act-edit" title="Rename">✎</button>
          <button class="qty-minus">−</button>
          <span>${e.count}</span>
          <button class="qty-plus">+</button>
        </div>
      </div>`).join('');
  },
  _onEntryClick(e) {
    const row = e.target.closest('[data-ref]');
    if (!row) return;
    const ref = row.dataset.ref;
    if (e.target.closest('.qty-minus')) this._changeQty(ref, -1);
    else if (e.target.closest('.qty-plus')) this._changeQty(ref, 1);
    else if (e.target.closest('.act-edit')) this._editEntryName(ref);
  },
  _editEntryName(ref) {
    const e = this.entries[ref];
    if (!e) return;
    const name = prompt('Item name:', e.name);
    if (name !== null && name.trim()) { e.name = name.trim(); this._renderEntries(); this._toast('Name updated'); }
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
  _getFilters() {
    return {
      family: document.getElementById('familyFilter').value,
      sub1: document.getElementById('sub1Filter').value,
      sub2: document.getElementById('sub2Filter').value,
      sub3: document.getElementById('sub3Filter').value,
      favOnly: document.getElementById('favFilter').checked
    };
  },
  _ensureCatalogFilters() {
    if (this._catalogFiltersReady) return;
    const famSel = document.getElementById('familyFilter');
    Catalog.getFamilies().forEach(f => { const o = document.createElement('option'); o.value = f; o.textContent = f; famSel.appendChild(o); });
    this._populateSubFilters();
    this._catalogFiltersReady = true;
  },
  _populateSubFilters() {
    const filters = this._getFilters();
    const sub1Sel = document.getElementById('sub1Filter');
    const sub2Sel = document.getElementById('sub2Filter');
    const sub3Sel = document.getElementById('sub3Filter');

    const vals1 = Catalog.getValues('sub1', { family: filters.family });
    this._fillSelect(sub1Sel, vals1, filters.sub1);

    const vals2 = Catalog.getValues('sub2', { family: filters.family, sub1: filters.sub1 });
    this._fillSelect(sub2Sel, vals2, filters.sub2);

    const vals3 = Catalog.getValues('sub3', { family: filters.family, sub1: filters.sub1, sub2: filters.sub2 });
    this._fillSelect(sub3Sel, vals3, filters.sub3);
  },
  _fillSelect(sel, values, keep) {
    sel.innerHTML = '<option value="">All</option>' + values.map(v => `<option value="${this._esc(v)}">${this._esc(v)}</option>`).join('');
    if (keep && values.includes(keep)) sel.value = keep;
  },
  _onFamilyChange() {
    document.getElementById('sub1Filter').value = '';
    document.getElementById('sub2Filter').value = '';
    document.getElementById('sub3Filter').value = '';
    this._populateSubFilters();
    this._renderCatalog();
  },
  _onSub1Change() {
    document.getElementById('sub2Filter').value = '';
    document.getElementById('sub3Filter').value = '';
    this._populateSubFilters();
    this._renderCatalog();
  },
  _onSub2Change() {
    document.getElementById('sub3Filter').value = '';
    this._populateSubFilters();
    this._renderCatalog();
  },
  _renderCatalog() {
    this._ensureCatalogFilters();
    const query = document.getElementById('catalogSearch').value;
    const results = Catalog.search(query, this._getFilters());
    const limit = 100;
    const shown = results.slice(0, limit);
    document.getElementById('catalogResultCount').textContent = `${results.length} products`;
    document.getElementById('catalogList').innerHTML = shown.map(p => {
      const fav = Storage.isFavorite(p.ref);
      const sub3 = p.sub3 || p.supplier || '';
      return `
      <div class="catalog-item" data-ref="${this._esc(p.ref)}">
        <div class="catalog-body">
          <div class="catalog-ref">${this._esc(p.ref)}</div>
          <div class="catalog-name">${this._esc(p.name)}</div>
          <div class="catalog-meta">Qty: ${p.qty || 0}${sub3 ? ' · ' + this._esc(sub3) : ''} · ${this._esc(Catalog._readableFamily(p.family))}</div>
        </div>
        <div class="catalog-actions">
          <button class="btn-sm act-fav${fav ? ' is-fav' : ''}" title="Pin">${fav ? '★' : '☆'}</button>
          <button class="btn-sm act-qr" title="QR Code">🔲</button>
          <button class="btn-sm act-label" title="Print Label">🖨️</button>
          <button class="btn-sm act-edit" title="Edit">✎</button>
        </div>
      </div>`;
    }).join('');
    if (results.length > limit) document.getElementById('catalogList').innerHTML += `<div style="text-align:center;padding:8px;color:var(--text-secondary)">Showing ${limit} of ${results.length} results.</div>`;
  },
  _onCatalogClick(e) {
    const item = e.target.closest('.catalog-item[data-ref]');
    if (!item) return;
    const ref = item.dataset.ref;
    if (e.target.closest('.act-fav')) this._toggleFavorite(ref);
    else if (e.target.closest('.act-qr')) { const p = Catalog.findByRef(ref); if (p) this._showQr(p.ref, p.name); }
    else if (e.target.closest('.act-label')) { const p = Catalog.findByRef(ref); if (p) this._printSingleLabel(p.ref, p.name); }
    else if (e.target.closest('.act-edit')) this._showEditProduct(ref);
    else this._addProductFromCatalog(ref);
  },
  _addProductFromCatalog(ref) { const p = Catalog.findByRef(ref); if (p) { this._addProduct(p); this.navigate('count'); } },

  // --- Favorites ---
  _toggleFavorite(ref) {
    const nowFav = Storage.toggleFavorite(ref);
    this._toast(nowFav ? 'Pinned to favorites' : 'Removed from favorites');
    this._renderCatalog();
    if (this.currentScreen === 'home') this._renderFavorites();
  },
  _renderFavorites() {
    const favs = Storage.getFavorites();
    const section = document.getElementById('favoritesSection');
    const list = document.getElementById('favoritesList');
    if (!section || !list) return;
    const products = favs.map(r => Catalog.findByRef(r)).filter(Boolean);
    if (products.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    list.innerHTML = products.map(p => `
      <button class="fav-chip" data-ref="${this._esc(p.ref)}" title="${this._esc(p.name)}">
        <span class="fav-ref">${this._esc(p.ref)}</span>
        <span class="fav-qty">${p.qty || 0}</span>
      </button>`).join('');
    list.querySelectorAll('.fav-chip').forEach(el => {
      el.addEventListener('click', () => this._addProductFromCatalog(el.dataset.ref));
    });
  },

  // --- Edit Product Dialog ---
  _showEditProduct(ref) {
    const p = Catalog.findByRef(ref);
    if (!p) return;
    this._editProductOriginalRef = ref;
    document.getElementById('editProductRef').value = p.ref;
    document.getElementById('editProductName').value = p.name;
    document.getElementById('editProductSupplier').value = p.supplier || '';
    document.getElementById('editProductQty').value = p.qty || 0;
    document.getElementById('editProductFamily').value = p.family || '';
    document.getElementById('editProductSub1').value = p.sub1 || '';
    document.getElementById('editProductSub3').value = p.sub3 || '';
    document.getElementById('editProductDialog').classList.remove('hidden');
  },
  _hideEditProduct() { document.getElementById('editProductDialog').classList.add('hidden'); },
  _saveEditProduct() {
    const oldRef = this._editProductOriginalRef;
    const patch = {
      ref: document.getElementById('editProductRef').value.trim().toUpperCase(),
      name: document.getElementById('editProductName').value.trim(),
      supplier: document.getElementById('editProductSupplier').value.trim(),
      qty: Number(document.getElementById('editProductQty').value) || 0,
      family: document.getElementById('editProductFamily').value.trim(),
      sub1: document.getElementById('editProductSub1').value.trim(),
      sub3: document.getElementById('editProductSub3').value.trim()
    };
    if (!patch.ref) { this._toast('Reference cannot be empty'); return; }
    try {
      Catalog.saveProduct(oldRef, patch);
      this._hideEditProduct();
      this._renderCatalog();
      this._toast('Product updated');
    } catch (err) {
      if (err.collision) this._toast(err.message);
      else this._toast('Save failed');
    }
  },
  _resetProduct() {
    const ref = this._editProductOriginalRef;
    if (!confirm('Discard all custom edits to this product?')) return;
    Overrides.remove(ref);
    Catalog.applyOverrides();
    Storage.setCachedCatalog(Catalog.products);
    this._hideEditProduct();
    this._renderCatalog();
    this._toast('Product reset to original');
  },

  // --- Find & Replace ---
  _showFindReplace() {
    document.getElementById('findReplaceInput').value = '';
    document.getElementById('findReplaceReplace').value = '';
    document.getElementById('findReplaceCount').textContent = '0';
    document.getElementById('findReplaceDialog').classList.remove('hidden');
  },
  _previewFindReplace() {
    const find = document.getElementById('findReplaceInput').value;
    const count = find ? this._findReplaceMatches().length : 0;
    document.getElementById('findReplaceCount').textContent = String(count);
  },
  _findReplaceMatches() {
    const find = document.getElementById('findReplaceInput').value.toLowerCase();
    const field = document.getElementById('findReplaceField').value;
    if (!find) return [];
    return Catalog.products.filter(p => {
      const text = field === 'ref' ? p.ref : field === 'supplier' ? (p.supplier || '') : p.name;
      return String(text).toLowerCase().includes(find);
    });
  },
  _applyFindReplace() {
    const find = document.getElementById('findReplaceInput').value;
    const replace = document.getElementById('findReplaceReplace').value;
    const field = document.getElementById('findReplaceField').value;
    if (!find) { this._toast('Enter text to find'); return; }
    const matches = this._findReplaceMatches();
    if (matches.length === 0) { this._toast('No matches'); return; }
    if (!confirm(`Replace "${find}" with "${replace}" in ${matches.length} products?`)) return;
    let changed = 0;
    for (const p of matches) {
      const old = p[field] || '';
      const next = String(old).replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replace);
      if (next !== old) {
        const patch = { [field]: next };
        Catalog.saveProduct(p.ref, patch);
        changed++;
      }
    }
    document.getElementById('findReplaceDialog').classList.add('hidden');
    this._renderCatalog();
    this._toast(`Updated ${changed} product(s)`);
  },

  // --- QR Code ---
  async _showQr(ref, name) {
    this._currentQrRef = ref;
    this._currentQrName = name || ref;
    document.getElementById('qrTitle').textContent = name || ref;
    document.getElementById('qrRef').textContent = ref;
    const canvas = document.getElementById('qrCanvas');
    if (typeof QRCode === 'undefined') { this._toast('QR library not loaded (check connection)'); return; }
    try {
      await QRCode.toCanvas(canvas, ref, { width: 280, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
      document.getElementById('qrDialog').classList.remove('hidden');
    } catch (e) { this._toast('QR generation failed: ' + e.message); }
  },
  _hideQr() { document.getElementById('qrDialog').classList.add('hidden'); },
  _downloadQr() {
    const canvas = document.getElementById('qrCanvas');
    if (!this._currentQrRef || !canvas) return;
    try {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR_${this._currentQrRef}.png`;
      a.click();
      this._toast('QR PNG downloaded');
    } catch (e) { this._toast('Download failed'); }
  },

  // --- Sessions ---
  _renderSessions() {
    const sessions = Storage.getSessions();
    const container = document.getElementById('sessionsList');
    if (sessions.length === 0) { container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-secondary)">No sessions yet</div>'; return; }
    container.innerHTML = sessions.map(s => `
      <div class="session-card" data-id="${this._esc(s.id)}">
        <div class="session-title">${this._esc(s.depot)} - ${this._esc(s.user)}</div>
        <div class="session-sub">${new Date(s.createdAt).toLocaleString()} | ${s.entries.length} items | ${s.entries.reduce((t, e) => t + e.count, 0)} counted</div>
        <div class="session-actions">
          <button class="btn-sm act-export">📤 Excel</button>
          <button class="btn-sm act-pdf">📄 PDF</button>
          <button class="btn-sm danger act-del">🗑</button>
        </div>
      </div>`).join('');
  },
  _onSessionClick(e) {
    const card = e.target.closest('.session-card[data-id]');
    if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('.act-export')) this._exportSessionById(id);
    else if (e.target.closest('.act-pdf')) this._exportSessionPdfById(id);
    else if (e.target.closest('.act-del')) this._deleteSessionById(id);
    else this._viewSession(id);
  },
  _viewSession(id) {
    this.currentSessionId = id;
    const session = Storage.getSessions().find(s => s.id === id); if (!session) return;
    document.getElementById('sessionDetailInfo').innerHTML = `
      <p><strong>Depot:</strong> ${this._esc(session.depot)}</p>
      <p><strong>User:</strong> ${this._esc(session.user)}</p>
      <p><strong>Created:</strong> ${new Date(session.createdAt).toLocaleString()}</p>
      <p><strong>Items:</strong> ${session.entries.length} | <strong>Total:</strong> ${session.entries.reduce((t, e) => t + e.count, 0)}</p>`;
    document.getElementById('sessionDetailEntries').innerHTML = session.entries.map(e => `
      <div class="entry-row" data-ref="${this._esc(e.ref)}">
        <div class="entry-info"><div class="entry-ref">${this._esc(e.ref)}</div><div class="entry-name">${this._esc(e.name)}</div></div>
        <div class="entry-qty"><button class="act-edit" title="Rename">✎</button><span>${e.count}</span></div>
      </div>`).join('');
    this.navigate('session-detail');
  },
  _onSessionEntryClick(e) {
    const row = e.target.closest('.entry-row[data-ref]');
    if (!row) return;
    if (e.target.closest('.act-edit')) this._editSessionEntryName(this.currentSessionId, row.dataset.ref);
  },
  _editSessionEntryName(sessionId, ref) {
    const session = Storage.getSessions().find(s => s.id === sessionId);
    if (!session) return;
    const entry = session.entries.find(e => e.ref === ref);
    if (!entry) return;
    const name = prompt('Item name:', entry.name);
    if (name !== null && name.trim()) { entry.name = name.trim(); Storage.saveSession(session); this._viewSession(sessionId); this._toast('Name updated'); }
  },
  _exportCurrentSession() { const s = Storage.getSessions().find(s => s.id === this.currentSessionId); if (s) Excel.exportSession(s); },
  _exportCurrentSessionPdf() { const s = Storage.getSessions().find(s => s.id === this.currentSessionId); if (s) this._exportPdf(s); },
  _deleteCurrentSession() { if (!confirm('Delete this session?')) return; Storage.deleteSession(this.currentSessionId); this._toast('Session deleted'); this.navigate('sessions'); },
  _exportSessionById(id) { const s = Storage.getSessions().find(s => s.id === id); if (s) Excel.exportSession(s); },
  _exportSessionPdfById(id) { const s = Storage.getSessions().find(s => s.id === id); if (s) this._exportPdf(s); },
  _deleteSessionById(id) { if (!confirm('Delete this session?')) return; Storage.deleteSession(id); this._renderSessions(); this._toast('Session deleted'); },

  // --- Apply count to stock ---
  _applyCurrentSessionToStock() {
    const session = Storage.getSessions().find(s => s.id === this.currentSessionId);
    if (!session) return;
    if (!confirm('Update expected stock quantities from this count?')) return;
    this._applyEntriesToStock(session.entries, session.id);
  },
  _applyEntriesToStock(entries, sessionId) {
    const adjustments = [];
    for (const e of entries) {
      const p = Catalog.findByRef(e.ref);
      if (!p) continue;
      const old = Number(p.qty) || 0;
      if (old !== e.count) {
        Catalog.setQty(e.ref, e.count);
        adjustments.push({ ref: e.ref, name: e.name || p.name, oldQty: old, newQty: e.count, sessionId: sessionId || 'manual', at: new Date().toISOString() });
      }
    }
    if (adjustments.length) {
      Storage.addAdjustments(adjustments);
      this._toast(`Stock updated for ${adjustments.length} item(s)`);
    } else {
      this._toast('No changes to apply');
    }
    return adjustments.length;
  },

  // --- PDF Export ---
  _exportPdf(session) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Count Session: ${session.depot}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`User: ${session.user}  |  Date: ${new Date(session.createdAt).toLocaleString()}`, 14, 28);
    doc.text(`Items: ${session.entries.length}  |  Total counted: ${session.entries.reduce((t, e) => t + e.count, 0)}`, 14, 34);
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
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <h3>Variance Report</h3>
        <button class="btn-sm" id="varianceApplyAll">Apply all</button>
      </div>
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
              <button class="btn-sm" data-vref="${this._esc(v.ref)}" data-vcount="${v.counted}">Apply</button>
            </div>
          </div>`).join('')}
      </div>`;
  },
  _applyVarianceRow(ref, counted) {
    const p = Catalog.findByRef(ref);
    if (!p) return;
    const old = Number(p.qty) || 0;
    Catalog.setQty(ref, counted);
    Storage.addAdjustments([{ ref, name: p.name, oldQty: old, newQty: counted, sessionId: 'variance', at: new Date().toISOString() }]);
    this._toast(`${ref} updated to ${counted}`);
    this._renderVariance();
  },
  _applyAllVariance() {
    if (!confirm('Apply all counted quantities to expected stock?')) return;
    const sessions = Storage.getSessions();
    const productCounts = {};
    sessions.forEach(s => s.entries.forEach(e => {
      productCounts[e.ref] = (productCounts[e.ref] || 0) + e.count;
    }));
    const adjustments = [];
    for (const [ref, counted] of Object.entries(productCounts)) {
      const p = Catalog.findByRef(ref);
      if (!p) continue;
      const old = Number(p.qty) || 0;
      if (old !== counted) {
        Catalog.setQty(ref, counted);
        adjustments.push({ ref, name: p.name, oldQty: old, newQty: counted, sessionId: 'variance', at: new Date().toISOString() });
      }
    }
    if (adjustments.length) {
      Storage.addAdjustments(adjustments);
      this._toast(`Applied ${adjustments.length} stock update(s)`);
    } else {
      this._toast('No changes to apply');
    }
    this._renderVariance();
  },

  // --- Backup/Restore ---
  _backupData() {
    const data = {
      version: 2,
      timestamp: new Date().toISOString(),
      settings: { user: Storage.getUserName(), depot: Storage.getDepot() },
      sessions: Storage.getSessions(),
      taxonomy: { brands: Taxonomy.getBrands(), nodes: Taxonomy.getNodes() },
      favorites: Storage.getFavorites(),
      overrides: { refs: Overrides.getRefs(), removed: Overrides.getRemoved() },
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
          if (data.taxonomy.nodes) localStorage.setItem('st3s_tax_nodes', JSON.stringify(data.taxonomy.nodes));
        }
        if (data.favorites) Storage.setFavorites(data.favorites);
        if (data.overrides) Overrides.replaceAll(data.overrides);
        else Overrides.replaceAll(null);
        if (data.catalog) { Catalog._base = data.catalog; Storage.setCachedCatalog(data.catalog); Catalog.applyOverrides(); }
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

  // --- Print Labels (Dialog-based) ---
  _printLabels(items) {
    const source = items || Object.values(this.entries);
    if (source.length === 0) { this._toast('No items to print labels for'); return; }
    this._labelItems = source.map(e => ({ ref: e.ref, name: e.name, selected: true }));
    this._showLabelDialog();
  },

  _showLabelDialog() {
    this._renderLabelItems();
    document.getElementById('labelDialog').classList.remove('hidden');
    this._onLabelSizeChange();
    this._updateLabelPreview();
  },

  _hideLabelDialog() {
    document.getElementById('labelDialog').classList.add('hidden');
  },

  _renderLabelItems() {
    const selected = this._labelItems.filter(i => i.selected).length;
    document.getElementById('labelItemCount').textContent = selected;
    document.getElementById('labelItemsList').innerHTML = this._labelItems.map((item, idx) => `
      <div class="label-item-row" data-idx="${idx}">
        <input type="checkbox" ${item.selected ? 'checked' : ''} data-idx="${idx}">
        <span class="label-item-ref">${this._esc(item.ref)}</span>
        <span class="label-item-name">${this._esc(item.name)}</span>
      </div>`).join('');
  },

  _labelToggleItem(idx) {
    this._labelItems[idx].selected = !this._labelItems[idx].selected;
    this._renderLabelItems();
    this._updateLabelPreview();
  },

  _labelToggleAll(select) {
    this._labelItems.forEach(i => i.selected = select);
    this._renderLabelItems();
    this._updateLabelPreview();
  },

  _onLabelSizeChange() {
    const val = document.getElementById('labelSize').value;
    const custom = document.getElementById('labelCustomSize');
    if (val === 'custom') {
      custom.classList.remove('hidden');
    } else {
      custom.classList.add('hidden');
      const [w, h] = val.split('x').map(Number);
      document.getElementById('labelW').value = w;
      document.getElementById('labelH').value = h;
    }
    this._updateLabelPreview();
  },

  _getLabelDimensions() {
    const w = parseInt(document.getElementById('labelW').value) || 60;
    const h = parseInt(document.getElementById('labelH').value) || 35;
    return { w, h };
  },

  _updateLabelPreview() {
    const canvas = document.getElementById('labelPreviewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w, h } = this._getLabelDimensions();
    const cols = parseInt(document.getElementById('labelCols').value) || 3;
    const template = document.getElementById('labelTemplate').value;
    const borders = document.getElementById('labelBorders').checked;

    const scale = Math.min(160 / w, 90 / h);
    const pw = w * scale;
    const ph = h * scale;
    const px = (180 - pw) / 2;
    const py = (105 - ph) / 2;

    ctx.clearRect(0, 0, 180, 105);
    ctx.fillStyle = '#fff';
    ctx.fillRect(px, py, pw, ph);

    if (borders) {
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, pw, ph);
    }

    ctx.fillStyle = '#333';
    const fontSize = Math.max(5, scale * 3.5);
    ctx.font = `bold ${fontSize}px sans-serif`;

    if (template === 'barcode') {
      // Barcode placeholder (vertical lines)
      ctx.fillStyle = '#333';
      for (let i = 0; i < pw - 8; i += 3) {
        const barH = (i % 6 === 0) ? ph * 0.55 : ph * 0.5;
        ctx.fillRect(px + 4 + i, py + ph * 0.15, 1.5, barH);
      }
      ctx.fillStyle = '#666';
      ctx.font = `${fontSize * 0.7}px sans-serif`;
      ctx.fillText('CODE128', px + 4, py + ph * 0.82);
    } else {
      ctx.fillText('REF-12345', px + 4, py + fontSize + 2);
      ctx.font = `${fontSize * 0.75}px sans-serif`;
      ctx.fillStyle = '#666';
      ctx.fillText('Product name...', px + 4, py + fontSize * 2 + 4);
      if (template !== 'text-only') {
        const qrSize = ph * 0.55;
        const qrX = px + pw - qrSize - 4;
        const qrY = py + (ph - qrSize) / 2;
        ctx.fillStyle = '#ddd';
        ctx.fillRect(qrX, qrY, qrSize, qrSize);
        ctx.fillStyle = '#999';
        ctx.font = `${qrSize * 0.3}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('QR', qrX + qrSize / 2, qrY + qrSize / 2 + qrSize * 0.1);
        ctx.textAlign = 'start';
      }
    }

    ctx.fillStyle = '#999';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${cols} per row · ${w}×${h}mm`, 90, 102);
    ctx.textAlign = 'start';
  },

  async _doPrintLabels() {
    const selected = this._labelItems.filter(i => i.selected);
    if (selected.length === 0) { this._toast('No items selected'); return; }

    const { w, h } = this._getLabelDimensions();
    const cols = parseInt(document.getElementById('labelCols').value) || 3;
    const template = document.getElementById('labelTemplate').value;
    const borders = document.getElementById('labelBorders').checked;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const margin = 5;
    const gap = 3;
    const usableW = pageW - margin * 2;
    const cellW = (usableW - gap * (cols - 1)) / cols;
    const cellH = (cellW / w) * h;

    const qrDataUrls = [];
    const barcodeUrls = [];

    if (template === 'barcode') {
      if (typeof JsBarcode === 'undefined') { this._toast('Barcode library not loaded (check connection)'); return; }
      for (const item of selected) {
        try {
          const c = document.createElement('canvas');
          JsBarcode(c, item.ref, { format: 'CODE128', width: 1, height: 30, displayValue: false, margin: 1 });
          barcodeUrls.push(c.toDataURL('image/png'));
        } catch (e) { barcodeUrls.push(null); }
      }
    } else if (template !== 'text-only') {
      for (const item of selected) {
        try {
          const dataUrl = await QRCode.toDataURL(item.ref, { width: 200, margin: 0, color: { dark: '#000', light: '#fff' } });
          qrDataUrls.push(dataUrl);
        } catch (e) { qrDataUrls.push(null); }
      }
    }

    let col = 0;
    let x = margin;
    let y = margin;

    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];

      if (y + cellH > pageH - margin) {
        doc.addPage();
        y = margin;
        x = margin;
        col = 0;
      }

      if (borders) {
        doc.setDrawColor(180);
        doc.setLineWidth(0.2);
        doc.rect(x, y, cellW, cellH);
      }

      if (template === 'text-only') {
        doc.setFontSize(Math.max(5, cellH * 0.22));
        doc.setTextColor(0);
        doc.text(item.ref, x + 2, y + cellH * 0.3);
        doc.setFontSize(Math.max(3.5, cellH * 0.16));
        doc.setTextColor(100);
        doc.text(item.name.substring(0, 40), x + 2, y + cellH * 0.55);
      } else if (template === 'barcode') {
        if (barcodeUrls[i]) {
          const bh = cellH * 0.45;
          const bw = cellW * 0.85;
          doc.addImage(barcodeUrls[i], 'PNG', x + (cellW - bw) / 2, y + cellH * 0.12, bw, bh);
        }
        doc.setFontSize(Math.max(3.5, cellH * 0.16));
        doc.setTextColor(0);
        doc.text(item.ref, x + 2, y + cellH * 0.68, { maxWidth: cellW - 4 });
        doc.setTextColor(100);
        doc.text(item.name.substring(0, 40), x + 2, y + cellH * 0.82, { maxWidth: cellW - 4 });
      } else if (template === 'qr-only') {
        if (qrDataUrls[i]) {
          const qrSize = Math.min(cellW, cellH) * 0.8;
          const qrX = x + (cellW - qrSize) / 2;
          const qrY = y + (cellH - qrSize) / 2;
          doc.addImage(qrDataUrls[i], 'PNG', qrX, qrY, qrSize, qrSize);
        }
      } else {
        const qrSize = cellH * 0.65;
        const qrX = x + cellW - qrSize - 2;
        const qrY = y + (cellH - qrSize) / 2;
        if (qrDataUrls[i]) {
          doc.addImage(qrDataUrls[i], 'PNG', qrX, qrY, qrSize, qrSize);
        }
        const textW = qrX - x - 4;
        doc.setFontSize(Math.max(5, cellH * 0.22));
        doc.setTextColor(0);
        doc.text(item.ref, x + 2, y + cellH * 0.28, { maxWidth: textW });
        doc.setFontSize(Math.max(3.5, cellH * 0.16));
        doc.setTextColor(100);
        doc.text(item.name.substring(0, 40), x + 2, y + cellH * 0.55, { maxWidth: textW });
      }

      col++;
      if (col >= cols) {
        col = 0;
        x = margin;
        y += cellH + gap;
      } else {
        x += cellW + gap;
      }
    }

    this._hideLabelDialog();
    doc.save('labels.pdf');
    this._toast(`Printed ${selected.length} labels`);
  },

  // --- Catalog Label Printing ---
  _printCatalogLabels() {
    const query = document.getElementById('catalogSearch').value;
    const results = Catalog.search(query, this._getFilters());
    if (results.length === 0) { this._toast('No products to print'); return; }
    this._printLabels(results);
  },

  _printSingleLabel(ref, name) {
    this._printLabels([{ ref, name }]);
  },

  // --- Taxonomy ---
  _renderBrands() {
    const brands = Taxonomy.getBrands();
    document.getElementById('brandsList').innerHTML = brands.length === 0
      ? '<div style="text-align:center;padding:16px;color:var(--text-secondary)">No custom brands yet</div>'
      : brands.map(b => `<div class="taxonomy-item"><span>${this._esc(b)}</span><button class="btn-sm danger act-del-brand" data-name="${this._esc(b)}">🗑</button></div>`).join('');
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
          <button class="act-add" data-id="${this._esc(id)}" title="Add sub">+</button>
          <button class="act-rename" data-id="${this._esc(id)}" title="Rename">✎</button>
          <button class="act-del" data-id="${this._esc(id)}" title="Delete">🗑</button>
        </div>
      </div>
      ${hasChildren ? `<div class="tree-children open">${children.map(c => this._renderTreeNode(c, depth + 1)).join('')}</div>` : ''}`;
  },
  _addCategory() { const input = document.getElementById('newCategory'); Taxonomy.addNode('', input.value); input.value = ''; this._renderCategories(); this._toast('Category added'); },
  _addSubCategory(parentId) { const name = prompt('Sub-category name:'); if (name && name.trim()) { Taxonomy.addNode(parentId, name.trim()); this._renderCategories(); } },
  _renameCategory(id) { const node = Taxonomy.getNodes().find(n => n.id === id); if (!node) return; const name = prompt('New name:', node.name); if (name && name.trim()) { Taxonomy.renameNode(id, name.trim()); this._renderCategories(); } },
  _removeCategory(id) { if (!confirm('Delete this category and all sub-categories?')) return; Taxonomy.removeNode(id); this._renderCategories(); this._toast('Category deleted'); },

  // --- Utilities ---
  _esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
  _toast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg; toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 2500);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
