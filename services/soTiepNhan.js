// Q06 – Sổ tiếp nhận thông báo sự cố (mẫu M.02). Chỉ ĐỌC.
// BR-15: sổ không lưu bảng riêng mà truy vấn trực tiếp từ yeu_cau, nên luôn khớp với dữ liệu xử lý.
// Mỗi yêu cầu ĐÃ TIẾP NHẬN là một dòng (không gồm yêu cầu Đã gửi, Từ chối, Đã hủy – mục 8 Q06, mục 9 M.02).
const { layCsdl } = require('../db');
const { gioVN, dinhDang } = require('../lib/thoiGian');
const { PHUONG_AN } = require('../lib/hangSo');
const { tenVietTat } = require('./truyVanQL');

// Tiếp nhận chỉ xảy ra ở bước "Tiếp nhận & phân công" (MOI -> DA_PHAN_CONG); sau đó yêu cầu ở một trong các trạng thái này.
const TRANG_THAI_DA_TIEP_NHAN = ['DA_PHAN_CONG', 'DANG_SUA', 'CHO_NGHIEM_THU', 'CHUYEN_XU_LY', 'HOAN_THANH'];
const DAU_CHAM = TRANG_THAI_DA_TIEP_NHAN.map(() => '?').join(',');

// 8 cột đúng mẫu M.02
const COT = ['STT', 'Ngày tháng', 'Thiết bị gặp sự cố', 'Đơn vị sử dụng', 'Tình trạng sự cố', 'Xác nhận',
  'Ngày hoàn thành xử lý sự cố', 'Ghi chú'];

const motGiaTri = (v) => String((Array.isArray(v) ? v[0] : v) || '').trim();
function laNgay(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function danhSachNha() {
  return layCsdl().prepare('SELECT ma_nha, ten_nha, dang_su_dung FROM toa_nha ORDER BY id').all();
}

// Bộ lọc: khoảng ngày tiếp nhận (tu, den: YYYY-MM-DD) + nhà (mã nhà).
// Lần đầu mở trang (không có tham số tu / den) mặc định "tháng này" như mockup; xóa trống cả hai ô = mọi ngày.
function docBoLoc(query = {}) {
  const coKhoangNgay = Object.prototype.hasOwnProperty.call(query, 'tu') || Object.prototype.hasOwnProperty.call(query, 'den');
  const homNay = gioVN().slice(0, 10);
  let tu = coKhoangNgay ? motGiaTri(query.tu) : `${homNay.slice(0, 7)}-01`;
  let den = coKhoangNgay ? motGiaTri(query.den) : homNay;
  if (!laNgay(tu)) tu = '';
  if (!laNgay(den)) den = '';
  if (tu && den && tu > den) [tu, den] = [den, tu];
  const nhaVao = motGiaTri(query.nha);
  const nha = danhSachNha().some((n) => n.ma_nha === nhaVao) ? nhaVao : '';
  return { tu, den, nha };
}

// Query string giữ bộ lọc (cho nút In sổ, Xuất Excel). Luôn ghi tu, den để "mọi ngày" không bị đổi về tháng này.
function chuoiTruyVan(boLoc) {
  return new URLSearchParams({ tu: boLoc.tu, den: boLoc.den, ...(boLoc.nha ? { nha: boLoc.nha } : {}) }).toString();
}

// "Từ 01/11/2026 đến 28/11/2026 · Nhà D3" – dòng mô tả bộ lọc trên trang in
function moTaBoLoc(boLoc) {
  const ngay = (v) => dinhDang(v);
  let khoang = 'Mọi ngày';
  if (boLoc.tu && boLoc.den) khoang = `Từ ${ngay(boLoc.tu)} đến ${ngay(boLoc.den)}`;
  else if (boLoc.tu) khoang = `Từ ${ngay(boLoc.tu)}`;
  else if (boLoc.den) khoang = `Đến ${ngay(boLoc.den)}`;
  return `${khoang} · ${boLoc.nha ? `Nhà ${boLoc.nha}` : 'Tất cả các nhà'}`;
}

// Cột Ghi chú (mục 9 M.02: kết quả / phương án; thông tin giao việc khi chưa xong)
function ghiChu(r, dongSua) {
  if (r.trang_thai === 'HOAN_THANH') {
    if (r.ket_qua_kiem_tra === 'KHONG_KHAC_PHUC') {
      return [`${PHUONG_AN[r.phuong_an] || 'Theo phương án'}: ${r.ket_qua_cuoi || ''}`.trim(),
        r.so_bien_ban_ban_giao && `BB M.10 số ${r.so_bien_ban_ban_giao}`].filter(Boolean).join(' · ');
    }
    return (dongSua || []).map((d) => (d.so_luong > 1 ? `${d.noi_dung} × ${d.so_luong}` : d.noi_dung)).join('; ');
  }
  if (r.trang_thai === 'CHUYEN_XU_LY') {
    return [`Chuyển phương án: ${PHUONG_AN[r.phuong_an] || '–'}`, r.so_to_trinh && `tờ trình ${r.so_to_trinh}`].filter(Boolean).join(', ');
  }
  // Đã phân công / Đang xử lý / Chờ nghiệm thu: thông tin giao việc (mục 9 – ghi chú cuối)
  return r.ten_ktv ? `Giao ${r.ten_ktv}, hạn ${dinhDang(r.han_hoan_thanh)}` : '';
}

function danhSach(boLoc) {
  const db = layCsdl();
  const dk = [`y.trang_thai IN (${DAU_CHAM})`, 'y.thoi_gian_tiep_nhan IS NOT NULL'];
  const ts = [...TRANG_THAI_DA_TIEP_NHAN];
  if (boLoc.tu) { dk.push('y.thoi_gian_tiep_nhan >= ?'); ts.push(`${boLoc.tu} 00:00:00`); }
  if (boLoc.den) { dk.push('y.thoi_gian_tiep_nhan <= ?'); ts.push(`${boLoc.den} 23:59:59`); }
  if (boLoc.nha) { dk.push('n.ma_nha = ?'); ts.push(boLoc.nha); }

  // Mới tiếp nhận xếp trên (như mockup Q06); STT đánh theo thứ tự hiển thị
  const rows = db.prepare(`
    SELECT y.id, y.ma_yeu_cau, y.trang_thai, y.mo_ta, y.ket_qua_kiem_tra, y.phuong_an, y.so_to_trinh,
           y.so_bien_ban_ban_giao, y.ket_qua_cuoi, y.thoi_gian_tiep_nhan, y.thoi_gian_hoan_thanh,
           n.ma_nha, p.ma_phong, l.ten_loai, t.ten_thiet_bi, t.ma_tai_san,
           ql.ho_ten AS ten_ql, k.ho_ten AS ten_ktv, pc.han_hoan_thanh
      FROM yeu_cau y
      JOIN phong p ON p.id = y.phong_id
      JOIN toa_nha n ON n.id = p.toa_nha_id
      JOIN loai_thiet_bi l ON l.id = y.loai_thiet_bi_id
      LEFT JOIN thiet_bi t ON t.id = y.thiet_bi_id
      LEFT JOIN nguoi_dung ql ON ql.id = y.nguoi_tiep_nhan_id
      LEFT JOIN phan_cong pc ON pc.yeu_cau_id = y.id AND pc.con_hieu_luc = 1
      LEFT JOIN nguoi_dung k ON k.id = pc.ktv_id
     WHERE ${dk.join(' AND ')}
     ORDER BY y.thoi_gian_tiep_nhan DESC, y.id DESC`).all(...ts);

  // Nội dung sửa chữa (phần II M.01) của các yêu cầu hoàn thành tại chỗ – một truy vấn cho cả trang
  const idXong = rows.filter((r) => r.trang_thai === 'HOAN_THANH' && r.ket_qua_kiem_tra !== 'KHONG_KHAC_PHUC').map((r) => r.id);
  const dongSua = new Map();
  if (idXong.length) {
    for (const d of db.prepare(`SELECT yeu_cau_id, noi_dung, so_luong FROM noi_dung_sua_chua
                                 WHERE yeu_cau_id IN (${idXong.map(() => '?').join(',')}) ORDER BY yeu_cau_id, stt`).all(...idXong)) {
      if (!dongSua.has(d.yeu_cau_id)) dongSua.set(d.yeu_cau_id, []);
      dongSua.get(d.yeu_cau_id).push(d);
    }
  }

  return rows.map((r, i) => ({
    stt: i + 1,
    id: r.id,
    ma: r.ma_yeu_cau,
    ngay: dinhDang(r.thoi_gian_tiep_nhan.slice(0, 10)),
    thietBi: r.ten_thiet_bi ? `${r.ten_thiet_bi} ${r.ma_tai_san}` : `${r.ten_loai} (không trong DS)`,
    thietBiTen: r.ten_thiet_bi || r.ten_loai,
    thietBiMa: r.ten_thiet_bi ? r.ma_tai_san : '(không trong DS)',
    donVi: `${r.ma_nha}-${r.ma_phong}`,
    tinhTrang: r.mo_ta,
    xacNhan: tenVietTat(r.ten_ql),
    xacNhanDayDu: r.ten_ql || '',
    ngayHoanThanh: r.trang_thai === 'HOAN_THANH' && r.thoi_gian_hoan_thanh ? dinhDang(r.thoi_gian_hoan_thanh.slice(0, 10)) : '',
    ghiChu: ghiChu(r, dongSua.get(r.id)),
  }));
}

// ---------------------------------------------------------------- Xuất Excel (.csv UTF-8 có BOM)
// Excel chỉ nhận đúng tiếng Việt khi tệp CSV bắt đầu bằng BOM. Mọi ô đặt trong ngoặc kép; ô bắt đầu bằng = + - @
// (do sinh viên nhập) được thêm dấu ' để Excel không hiểu thành công thức.
function oCsv(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function xuatCsv(dong) {
  const hang = [COT, ...dong.map((d) => [d.stt, d.ngay, d.thietBi, d.donVi, d.tinhTrang, d.xacNhanDayDu, d.ngayHoanThanh, d.ghiChu])];
  return '﻿' + hang.map((h) => h.map(oCsv).join(',')).join('\r\n') + '\r\n';
}

module.exports = { TRANG_THAI_DA_TIEP_NHAN, COT, docBoLoc, chuoiTruyVan, moTaBoLoc, danhSachNha, danhSach, xuatCsv };
