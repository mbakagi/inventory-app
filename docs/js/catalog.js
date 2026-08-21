// Catalog module - loads and manages product data with a user-editable overrides layer
const Catalog = {
  products: [],   // merged products (base + overrides)
  _base: [],      // raw base catalog (products.json)
  loaded: false,

  async load() {
    let base = null;
    // Fetch from server (network-first so catalog updates propagate)
    try {
      const resp = await fetch('assets/products.json');
      if (resp.ok) {
        const data = await resp.json();
        if (data.length > 0) {
          base = data;
          Storage.setCachedCatalog(data);
        }
      }
    } catch (e) {
      console.warn('Failed to load catalog from server, using cache');
    }
    if (!base) base = Storage.getCachedCatalog() || [];
    this._base = base;
    this.applyOverrides();
    this.loaded = true;
    return this.products;
  },

  // Rebuild this.products from base + overrides
  applyOverrides() {
    const refs = Overrides.getRefs();
    const removed = new Set(Overrides.getRemoved());
    const baseRefs = new Set(this._base.map(p => p.ref));

    const merged = this._base
      .filter(p => !removed.has(p.ref))
      .map(p => {
        const o = refs[p.ref];
        return o ? Object.assign({}, p, o) : p;
      });

    // Include override entries whose ref is not in the base (renamed/added products)
    for (const [ref, o] of Object.entries(refs)) {
      if (!baseRefs.has(ref)) {
        merged.push(Object.assign(
          { ref, name: ref, qty: 0, family: '', sub1: '', sub2: '', sub3: '', supplier: '', alternatives: [] },
          o
        ));
      }
    }
    this.products = merged;
  },

  findByRef(ref) {
    const r = String(ref).trim().toUpperCase();
    return this.products.find(p => String(p.ref).toUpperCase() === r) || null;
  },

  // Save an edit to a product (patch may include a new `ref` to rename)
  saveProduct(currentRef, patch) {
    const newRef = String(patch.ref || currentRef).trim().toUpperCase();
    if (newRef !== String(currentRef).toUpperCase()) {
      return this.renameRef(currentRef, newRef, patch);
    }
    const clean = Object.assign({}, patch);
    Overrides.set(currentRef, clean);
    this.applyOverrides();
    Storage.setCachedCatalog(this.products);
    return this.findByRef(newRef);
  },

  // Rename a reference and migrate all stored data
  renameRef(oldRef, newRef) {
    const current = this.findByRef(oldRef);
    if (!current) return null;
    const target = this.findByRef(newRef);
    if (target && target !== current) {
      const err = new Error(`Reference "${newRef}" already exists`);
      err.collision = true;
      throw err;
    }
    Overrides.remove(oldRef);
    Overrides.addRemoved(oldRef);
    Overrides.set(newRef, Object.assign({}, current, { ref: newRef }));
    Storage.migrateRef(oldRef, newRef);
    this.applyOverrides();
    Storage.setCachedCatalog(this.products);
    return this.findByRef(newRef);
  },

  // Set expected quantity (used by "apply count to stock")
  setQty(ref, qty) {
    const p = this.findByRef(ref);
    if (!p) return;
    Overrides.set(p.ref, { qty: Number(qty) || 0 });
    this.applyOverrides();
    Storage.setCachedCatalog(this.products);
  },

  // Filter + search. `filters` = { family, sub1, sub2, sub3, favOnly }
  search(query, filters) {
    const q = (query || '').trim().toLowerCase();
    const f = filters || {};
    const list = this.products.filter(p => {
      if (f.family && f.family !== this._readableFamily(p.family)) return false;
      if (f.sub1 && (p.sub1 || '') !== f.sub1) return false;
      if (f.sub2 && (p.sub2 || '') !== f.sub2) return false;
      if (f.sub3 && (p.sub3 || '') !== f.sub3) return false;
      if (f.favOnly && !Storage.isFavorite(p.ref)) return false;
      return true;
    });

    if (!q) {
      list.sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
      return list;
    }

    // Substring matches take priority
    const sub = list.filter(p =>
      String(p.ref).toLowerCase().includes(q) ||
      String(p.name).toLowerCase().includes(q) ||
      String(p.supplier || '').toLowerCase().includes(q)
    );
    if (sub.length) return sub;

    // Fuzzy fallback for typos / partial references
    if (q.length >= 2) {
      return Fuzzy.match(q, list, 200).filter(m => m.score >= 55).map(m => m.product);
    }
    return [];
  },

  // Distinct values for a sub-classification field (optionally scoped by other filters)
  getValues(field, filters) {
    const scope = filters ? this.search('', filters) : this.products;
    const set = new Set();
    for (const p of scope) {
      const v = (p[field] || '').trim();
      if (v) set.add(v);
    }
    return [...set].sort();
  },

  getBrands() {
    const set = new Set();
    for (const p of this.products) {
      if (p.sub3) set.add(p.sub3);
      const b = this._detectBrand(p);
      if (b) set.add(b);
      if (p.supplier) set.add(p.supplier);
    }
    return [...set].sort();
  },

  getFamilies() {
    const set = new Set();
    for (const p of this.products) {
      const f = this._readableFamily(p.family);
      if (f) set.add(f);
    }
    return [...set].sort();
  },

  _detectBrand(p) {
    const text = (p.name + ' ' + p.ref).toUpperCase();
    const priority = ['HOCHIKI','PULSAR','FINSECUR','SYCHRONIC','INIM','MATRIX','NUMENS','TRIKDIS','KLAXON','SOCA','SYNAPS','ELFRI','PROSENSE'];
    const secondary = ['DAHUA','HIKVISION','PYRONIX','MIFARE','LEGRAND','HID','APOLLO','BENTEL','ELKRON','TP-LINK','DSC','VISONIC','RISCO','EATON','SATEL','GENT','NOTIFIER','ESSER','FIRECLASS','TELEVES','IKUSI','FRACARRO','KENTEC','C-TEC','KIDDE','ZKTECO','AJAX','PARADOX','COMELIT','FERMAX','AIPHONE','URMET','SOMFY','CAME','FAAC','BFT','NICE','DORMA','GEZE','HONEYWELL','TYCO','VIVOTEK','HANWHA','UNV','AXIS','SYNOLOGY','QNAP','SEAGATE','YEALINK','GRANDSTREAM','PANASONIC','CISCO','UBIQUITI','MIKROTIK','NETGEAR','HUAWEI','PHILIPS','OSRAM','MEAN WELL','TRIAX','XPR','OPTEX','TAKEX','SICURIT','TECNOALARM','VIMAR','BTICINO','DELTA DORE'];
    for (const b of priority) { if (this._wordMatch(text, b)) return b; }
    for (const b of secondary) { if (this._wordMatch(text, b)) return b; }
    return '';
  },

  _wordMatch(text, word) {
    const idx = text.indexOf(word);
    if (idx === -1) return false;
    const before = idx > 0 ? text[idx - 1] : ' ';
    const after = idx + word.length < text.length ? text[idx + word.length] : ' ';
    return !/[A-Z0-9]/.test(before) && !/[A-Z0-9]/.test(after);
  },

  _readableFamily(code) {
    const map = {
      'INCEN':'Incendie','VIDEO':'Vidéosurveillance','RESAU':'Réseau','INTRU':'Intrusion',
      'CONTR':"Contrôle d'accès",'AC-CA':'Badges & Cartes','PO-AU':'Fournitures',
      'CABLE':'Câbles','SERV':'Services','TECH':'Technique','INT':'Interphonie',
      'INTER':'Interphonie','SONO':'Sonorisation'
    };
    const c = (code || '').trim().toUpperCase();
    return map[c] || code || '';
  }
};
