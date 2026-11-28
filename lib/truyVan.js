// Tiện ích nhỏ cho route: đọc số id và dựng query string bỏ giá trị rỗng.
const soId = (v) => (/^\d+$/.test(String(Array.isArray(v) ? v[0] : v || '')) ? Number(Array.isArray(v) ? v[0] : v) : null);

const mot = (v) => String(Array.isArray(v) ? v[0] : v === undefined || v === null ? '' : v);

// { a: 'x', b: '', c: 3 } -> 'a=x&c=3'
function chuoiTruyVan(doiTuong) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(doiTuong)) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    p.set(k, String(v));
  }
  return p.toString();
}

module.exports = { soId, mot, chuoiTruyVan };
