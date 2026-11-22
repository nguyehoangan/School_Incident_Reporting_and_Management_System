// Thời gian theo giờ Việt Nam (UTC+7), không phụ thuộc múi giờ của máy chủ (BR-13).
const LECH_VN_MS = 7 * 60 * 60 * 1000;
const hai = (n) => String(n).padStart(2, '0');

// Date -> 'YYYY-MM-DD HH:mm:ss' (giờ Việt Nam) để lưu CSDL
function gioVN(date = new Date()) {
  const d = new Date(date.getTime() + LECH_VN_MS);
  return `${d.getUTCFullYear()}-${hai(d.getUTCMonth() + 1)}-${hai(d.getUTCDate())} ` +
    `${hai(d.getUTCHours())}:${hai(d.getUTCMinutes())}:${hai(d.getUTCSeconds())}`;
}

// 'YYYY-MM-DD HH:mm:ss' (giờ VN) -> Date
function docGioVN(chuoi) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(chuoi || '');
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s) - LECH_VN_MS);
}

// Hiển thị dạng dd/mm/yyyy HH:mm
function dinhDang(chuoi) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(chuoi || '');
  if (!m) return '';
  const [, y, mo, d, h, mi] = m;
  return h === undefined ? `${d}/${mo}/${y}` : `${d}/${mo}/${y} ${h}:${mi}`;
}

module.exports = { gioVN, docGioVN, dinhDang };
