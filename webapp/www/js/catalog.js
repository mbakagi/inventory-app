// Catalog module - loads and manages product data
const Catalog = {
  products: [],
  loaded: false,

  async load() {
    // Try cache first
    const cached = Storage.getCachedCatalog();
    if (cached && cached.length > 0) {
      this.products = cached;
      this.loaded = true;
    }
    // Fetch from server
    try {
      const resp = await fetch('assets/products.json');
      if (resp.ok) {
        const data = await resp.json();
        if (data.length > 0) {
          this.products = data;
          this.loaded = true;
          Storage.setCachedCatalog(data);
        }
      }
    } catch (e) {
      console.warn('Failed to load catalog from server, using cache');
    }
    return this.products;
  },

  findByRef(ref) {
    const r = ref.trim().toUpperCase();
    return this.products.find(p => p.ref.toUpperCase() === r) || null;
  },

  search(query, brand, family) {
    const q = query.trim().toLowerCase();
    return this.products.filter(p => {
      if (brand && brand !== this._detectBrand(p)) return false;
      if (family && family !== this._readableFamily(p.family)) return false;
      if (!q) return true;
      return p.ref.toLowerCase().includes(q) ||
             p.name.toLowerCase().includes(q) ||
             (p.supplier || '').toLowerCase().includes(q);
    });
  },

  getBrands() {
    const set = new Set();
    for (const p of this.products) {
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