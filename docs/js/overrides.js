// Overrides module - user edits layered over the base catalog (products.json)
// Stored as { refs: { [ref]: patch }, removed: [ref, ...] }
const Overrides = {
  _key: 'st3s_overrides',

  _read() {
    try {
      const raw = localStorage.getItem(this._key);
      const o = raw ? JSON.parse(raw) : {};
      if (!o.refs) o.refs = {};
      if (!Array.isArray(o.removed)) o.removed = [];
      return o;
    } catch (e) {
      return { refs: {}, removed: [] };
    }
  },

  _write(o) {
    localStorage.setItem(this._key, JSON.stringify(o));
  },

  getRefs() {
    return this._read().refs;
  },

  getRemoved() {
    return this._read().removed;
  },

  get(ref) {
    return this.getRefs()[ref] || null;
  },

  set(ref, patch) {
    const o = this._read();
    o.refs[ref] = Object.assign({}, o.refs[ref], patch);
    this._write(o);
  },

  remove(ref) {
    const o = this._read();
    delete o.refs[ref];
    this._write(o);
  },

  addRemoved(ref) {
    const o = this._read();
    if (!o.removed.includes(ref)) o.removed.push(ref);
    this._write(o);
  },

  replaceAll(data) {
    this._write({
      refs: (data && data.refs) || {},
      removed: (data && data.removed) || []
    });
  }
};
