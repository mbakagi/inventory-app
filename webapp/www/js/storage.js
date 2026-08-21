// Storage module - localStorage wrapper for sessions, settings and user data
const Storage = {
  _prefix: 'st3s_',

  // Settings
  getUserName() {
    return localStorage.getItem(this._prefix + 'user') || '';
  },
  setUserName(name) {
    localStorage.setItem(this._prefix + 'user', name);
  },
  getDepot() {
    return localStorage.getItem(this._prefix + 'depot') || '';
  },
  setDepot(depot) {
    localStorage.setItem(this._prefix + 'depot', depot);
  },

  // Sessions
  getSessions() {
    try {
      const raw = localStorage.getItem(this._prefix + 'sessions');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },
  saveSession(session) {
    const sessions = this.getSessions();
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(this._prefix + 'sessions', JSON.stringify(sessions));
  },
  deleteSession(id) {
    const sessions = this.getSessions().filter(s => s.id !== id);
    localStorage.setItem(this._prefix + 'sessions', JSON.stringify(sessions));
  },

  // Catalog cache (mirror of products.json for offline use)
  getCachedCatalog() {
    try {
      const raw = localStorage.getItem(this._prefix + 'catalog');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
  setCachedCatalog(products) {
    try {
      localStorage.setItem(this._prefix + 'catalog', JSON.stringify(products));
    } catch (e) {
      // localStorage full - ignore
    }
  },

  // Favorites (pinned products)
  getFavorites() {
    try {
      const raw = localStorage.getItem(this._prefix + 'favorites');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },
  setFavorites(list) {
    localStorage.setItem(this._prefix + 'favorites', JSON.stringify(list));
  },
  isFavorite(ref) {
    return this.getFavorites().includes(ref);
  },
  toggleFavorite(ref) {
    const list = this.getFavorites();
    const i = list.indexOf(ref);
    if (i >= 0) list.splice(i, 1);
    else list.push(ref);
    this.setFavorites(list);
    return i < 0; // true if now favorited
  },

  // Stock adjustments (audit trail)
  getAdjustments() {
    try {
      const raw = localStorage.getItem(this._prefix + 'adjustments');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },
  addAdjustments(entries) {
    const list = this.getAdjustments();
    for (const e of entries) list.unshift(e);
    if (list.length > 500) list.length = 500;
    localStorage.setItem(this._prefix + 'adjustments', JSON.stringify(list));
  },

  // Migrate a product reference across all stored data
  migrateRef(oldRef, newRef) {
    const sessions = this.getSessions();
    let changed = false;
    for (const s of sessions) {
      for (const e of s.entries) {
        if (e.ref === oldRef) { e.ref = newRef; changed = true; }
      }
    }
    if (changed) localStorage.setItem(this._prefix + 'sessions', JSON.stringify(sessions));

    const favs = this.getFavorites();
    const fi = favs.indexOf(oldRef);
    if (fi >= 0) { favs[fi] = newRef; this.setFavorites(favs); }

    const adj = this.getAdjustments();
    let aChanged = false;
    for (const a of adj) {
      if (a.ref === oldRef) { a.ref = newRef; aChanged = true; }
    }
    if (aChanged) localStorage.setItem(this._prefix + 'adjustments', JSON.stringify(adj));
  }
};
