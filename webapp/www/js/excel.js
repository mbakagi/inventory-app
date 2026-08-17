// Excel export/import module using SheetJS
const Excel = {
  // Export session to XLSX and trigger download
  exportSession(session) {
    const rows = [['Reference', 'Name', 'Count', 'Timestamp']];
    for (const e of session.entries) {
      rows.push([e.ref, e.name, e.count, e.timestamp || '']);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Count');
    const name = `count_${session.depot}_${session.id}.xlsx`;
    XLSX.writeFile(wb, name);
  },

  // Import XLSX file, returns array of {ref, name, count}
  async importFile(file) {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    const entries = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;
      const ref = String(row[0] || '').trim();
      const name = String(row[1] || '').trim();
      const count = parseInt(row[2]) || 0;
      if (ref) {
        entries.push({ ref, name, count, timestamp: new Date().toISOString() });
      }
    }
    return entries;
  }
};