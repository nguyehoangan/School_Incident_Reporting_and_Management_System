// Thời gian theo giờ Việt Nam (UTC+7), không phụ thuộc múi giờ của máy chủ (BR-13).
const LECH_VN_MS = 7 * 60 * 60 * 1000;
const MOT_NGAY_MS = 24 * 60 * 60 * 1000;
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

// 'YYYY-MM-DD HH:mm:ss' -> giá trị cho <input type="datetime-local"> ('YYYY-MM-DDTHH:mm')
function choONhapGio(chuoi) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(chuoi || '');
  return m ? `${m[1]}T${m[2]}` : '';
}

// Giá trị từ <input type="datetime-local"> (giờ VN) -> 'YYYY-MM-DD HH:mm:00', sai định dạng -> null
function tuONhapGio(giaTri) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?$/.exec(String(giaTri || '').trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const kiemTra = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  if (kiemTra.getUTCMonth() !== +mo - 1 || kiemTra.getUTCDate() !== +d || +h > 23 || +mi > 59) return null;
  return `${y}-${mo}-${d} ${h}:${mi}:00`;
}

// Thứ trong tuần theo giờ VN (0 = Chủ nhật, 6 = Thứ Bảy)
const thuVN = (date) => new Date(date.getTime() + LECH_VN_MS).getUTCDay();

// BR-06 – hạn kiểm tra mặc định theo QT.06 mục 2.2:
//   Khẩn cấp   = cuối ngày giao (23:59);
//   Bình thường = 01 ngày làm việc sau thời điểm giao, bỏ qua thứ Bảy, Chủ nhật.
function hanKiemTraMacDinh(thoiGianGiao, mucDo) {
  if (mucDo === 'KHAN_CAP') return thoiGianGiao.slice(0, 10) + ' 23:59:00';
  let ngay = new Date(docGioVN(thoiGianGiao).getTime() + MOT_NGAY_MS);
  while (thuVN(ngay) === 0 || thuVN(ngay) === 6) ngay = new Date(ngay.getTime() + MOT_NGAY_MS);
  return gioVN(ngay).slice(0, 16) + ':00';
}

module.exports = { gioVN, docGioVN, dinhDang, choONhapGio, tuONhapGio, thuVN, hanKiemTraMacDinh };
