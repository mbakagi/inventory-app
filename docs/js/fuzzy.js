// Fuzzy matching module
const Fuzzy = {
  // Levenshtein distance
  _distance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return dp[a.length][b.length];
  },

  // Match text against products, returns [{product, score}] sorted by score desc
  match(text, products, limit = 5) {
    const t = text.trim().toUpperCase();
    if (!t) return [];
    const results = [];
    for (const p of products) {
      const ref = p.ref.toUpperCase();
      const name = p.name.toUpperCase();
      if (ref === t) { results.push({ product: p, score: 100 }); continue; }
      if (ref.includes(t) && t.length >= 2) { results.push({ product: p, score: 90 }); continue; }
      if (t.includes(ref) && ref.length >= 3) { results.push({ product: p, score: 85 }); continue; }
      if (name.includes(t) && t.length >= 2) { results.push({ product: p, score: 80 }); continue; }
      if (t.length >= 3) {
        const dist = this._distance(ref, t);
        const maxLen = Math.max(ref.length, t.length);
        const score = Math.round((1 - dist / maxLen) * 100);
        if (score >= 60) results.push({ product: p, score });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
};