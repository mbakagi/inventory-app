// Storage module - localStorage wrapper for sessions and settings
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

  // Catalog cache
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
  }
};