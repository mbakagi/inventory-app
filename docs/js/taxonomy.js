// Taxonomy module - manages brands and categories in localStorage
const Taxonomy = {
  _prefix: 'st3s_tax_',

  // Brands
  getBrands() {
    try {
      const raw = localStorage.getItem(this._prefix + 'brands');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  },
  addBrand(name) {
    const b = name.trim();
    if (!b) return;
    const brands = this.getBrands();
    if (!brands.includes(b)) {
      brands.push(b);
      brands.sort();
      localStorage.setItem(this._prefix + 'brands', JSON.stringify(brands));
    }
  },
  removeBrand(name) {
    const brands = this.getBrands().filter(b => b !== name);
    localStorage.setItem(this._prefix + 'brands', JSON.stringify(brands));
  },

  // Categories (tree)
  getNodes() {
    try {
      const raw = localStorage.getItem(this._prefix + 'nodes');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  },
  _saveNodes(nodes) {
    localStorage.setItem(this._prefix + 'nodes', JSON.stringify(nodes));
  },
  addNode(parentId, name) {
    const n = name.trim();
    if (!n) return;
    const nodes = this.getNodes();
    nodes.push({ id: Date.now().toString(), parent: parentId || '', name: n });
    this._saveNodes(nodes);
  },
  renameNode(id, name) {
    const n = name.trim();
    if (!n) return;
    const nodes = this.getNodes();
    const node = nodes.find(x => x.id === id);
    if (node) { node.name = n; this._saveNodes(nodes); }
  },
  removeNode(id) {
    const toRemove = new Set([id]);
    let changed = true;
    const nodes = this.getNodes();
    while (changed) {
      changed = false;
      for (const n of nodes) {
        if (toRemove.has(n.parent) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          changed = true;
        }
      }
    }
    this._saveNodes(nodes.filter(n => !toRemove.has(n.id)));
  },
  childrenOf(parentId) {
    return this.getNodes().filter(n => n.parent === (parentId || '')).sort((a, b) => a.name.localeCompare(b.name));
  },
  getRoots() {
    return this.childrenOf('');
  }
};