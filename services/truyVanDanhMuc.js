// Truy vấn (chỉ đọc) cho Q04 Danh mục CSVC. Ghi dữ liệu nằm ở services/danhMuc.js.
// "Số lần sửa" và các số đếm đều tính bằng truy vấn, không lưu cột riêng (SPEC mục 10).
const { layCsdl } = require('../db');
const { TRANG_THAI_YEU_CAU, TINH_TRANG_THIET_BI, PHUONG_AN } = require('../lib/hangSo');
const { soId, mot } = require('../lib/truyVan');

const SO_DONG_MOI_TRANG = 20;
const TAB = { nha: 'Nhà', phong: 'Phòng', loai: 'Loại thiết bị', 'thiet-bi': 'Thiết bị' };

// Yêu cầu đã được tiếp nhận tính là một lần sửa (cùng tiêu chí với sổ M.02: không gồm Đã gửi, Từ chối, Đã hủy).
// Gồm cả việc đang làm dở để Số lần sửa khớp số dòng trong lịch sử sửa chữa của Hồ sơ thiết bị.
const TRANG_THAI_DA_TIEP_NHAN = ['DA_PHAN_CONG', 'DANG_SUA', 'CHO_NGHIEM_THU', 'CHUYEN_XU_LY', 'HOAN_THANH'];
const DAU_CHAM = TRANG_THAI_DA_TIEP_NHAN.map(() => '?').join(',');

const KY_TU_LIKE = /[\\%_]/g;
const mauLike = (q) => `%${q.replace(KY_TU_LIKE, (c) => '\\' + c)}%`;

// ---------------------------------------------------------------- Bộ lọc từ query string
function docBoLoc(query) {
  const tab = mot(query.tab);
  const tt = mot(query.tt);
  return {
    tab: TAB[tab] ? tab : 'nha',
    q: mot(query.q).trim().slice(0, 100),
    nha: soId(query.nha),
    phong: soId(query.phong),
    loai: soId(query.loai),
    tt: TINH_TRANG_THIET_BI[tt] ? tt : '',
    trang: Math.max(parseInt(mot(query.trang), 10) || 1, 1),
  };
}

function phanTrang(tong, trangVao) {
  const soTrang = Math.max(1, Math.ceil(tong / SO_DONG_MOI_TRANG));
  const trang = Math.min(trangVao, soTrang);
  return { trang, soTrang, gioiHan: `LIMIT ${SO_DONG_MOI_TRANG} OFFSET ${(trang - 1) * SO_DONG_MOI_TRANG}` };
}

// ---------------------------------------------------------------- Danh sách từng tab
function lietKeNha({ q }) {
  const ts = [];
  let where = '';
  if (q) { where = `WHERE (n.ma_nha LIKE ? ESCAPE '\\' OR n.ten_nha LIKE ? ESCAPE '\\')`; ts.push(mauLike(q), mauLike(q)); }
  return layCsdl().prepare(`
    SELECT n.id, n.ma_nha, n.ten_nha, n.dang_su_dung,
           (SELECT COUNT(*) FROM phong p WHERE p.toa_nha_id = n.id) AS so_phong,
           (SELECT COUNT(*) FROM phong p WHERE p.toa_nha_id = n.id AND p.dang_su_dung = 1) AS so_phong_dang_dung,
           (SELECT COUNT(*) FROM yeu_cau y JOIN phong p ON p.id = y.phong_id WHERE p.toa_nha_id = n.id) AS so_yeu_cau
      FROM toa_nha n ${where} ORDER BY n.id`).all(...ts);
}

function lietKePhong({ nha, q, trang }) {
  const db = layCsdl();
  const dk = [];
  const ts = [];
  if (nha) { dk.push('p.toa_nha_id = ?'); ts.push(nha); }
  if (q) { dk.push(`((n.ma_nha || '-' || p.ma_phong) LIKE ? ESCAPE '\\' OR p.loai_phong LIKE ? ESCAPE '\\')`); ts.push(mauLike(q), mauLike(q)); }
  const where = dk.length ? `WHERE ${dk.join(' AND ')}` : '';
  const tong = db.prepare(`SELECT COUNT(*) n FROM phong p JOIN toa_nha n ON n.id = p.toa_nha_id ${where}`).get(...ts).n;
  const pt = phanTrang(tong, trang);
  const dong = db.prepare(`
    SELECT p.id, p.toa_nha_id, n.ma_nha, p.ma_phong, p.tang, p.loai_phong, p.dang_su_dung, n.dang_su_dung AS nha_dang_su_dung,
           (SELECT COUNT(*) FROM thiet_bi t WHERE t.phong_id = p.id) AS so_thiet_bi,
           (SELECT COUNT(*) FROM thiet_bi t WHERE t.phong_id = p.id AND t.tinh_trang <> 'THANH_LY') AS so_thiet_bi_chua_thanh_ly,
           (SELECT COUNT(*) FROM yeu_cau y WHERE y.phong_id = p.id) AS so_yeu_cau
      FROM phong p JOIN toa_nha n ON n.id = p.toa_nha_id ${where}
     ORDER BY n.id, p.ma_phong ${pt.gioiHan}`).all(...ts);
  return { dong, tong, trang: pt.trang, soTrang: pt.soTrang };
}

function lietKeLoai({ q }) {
  const ts = [];
  let where = '';
  if (q) { where = `WHERE l.ten_loai LIKE ? ESCAPE '\\'`; ts.push(mauLike(q)); }
  return layCsdl().prepare(`
    SELECT l.id, l.ten_loai, l.dang_su_dung,
           (SELECT COUNT(*) FROM thiet_bi t WHERE t.loai_thiet_bi_id = l.id) AS so_thiet_bi,
           (SELECT COUNT(*) FROM yeu_cau y WHERE y.loai_thiet_bi_id = l.id) AS so_yeu_cau
      FROM loai_thiet_bi l ${where} ORDER BY l.id`).all(...ts);
}

function lietKeThietBi({ nha, phong, loai, tt, q, trang }) {
  const db = layCsdl();
  const dk = [];
  const ts = [];
  if (nha) { dk.push('p.toa_nha_id = ?'); ts.push(nha); }
  if (phong) { dk.push('t.phong_id = ?'); ts.push(phong); }
  if (loai) { dk.push('t.loai_thiet_bi_id = ?'); ts.push(loai); }
  if (tt) { dk.push('t.tinh_trang = ?'); ts.push(tt); }
  if (q) { dk.push(`(t.ma_tai_san LIKE ? ESCAPE '\\' OR t.ten_thiet_bi LIKE ? ESCAPE '\\' OR t.model_hang LIKE ? ESCAPE '\\')`); ts.push(mauLike(q), mauLike(q), mauLike(q)); }
  const where = dk.length ? `WHERE ${dk.join(' AND ')}` : '';
  const tu = `FROM thiet_bi t JOIN phong p ON p.id = t.phong_id JOIN toa_nha n ON n.id = p.toa_nha_id
              JOIN loai_thiet_bi l ON l.id = t.loai_thiet_bi_id ${where}`;
  const tong = db.prepare(`SELECT COUNT(*) n ${tu}`).get(...ts).n;
  const pt = phanTrang(tong, trang);
  const dong = db.prepare(`
    SELECT t.id, t.ma_tai_san, t.ten_thiet_bi, t.model_hang, t.nam_su_dung, t.nguon_kinh_phi, t.han_bao_hanh, t.tinh_trang,
           t.loai_thiet_bi_id, t.phong_id, l.ten_loai, n.ma_nha, p.ma_phong, p.dang_su_dung AS phong_dang_su_dung,
           (SELECT COUNT(*) FROM yeu_cau y WHERE y.thiet_bi_id = t.id AND y.trang_thai IN (${DAU_CHAM})) AS so_lan_sua,
           (SELECT COUNT(*) FROM yeu_cau y WHERE y.thiet_bi_id = t.id) AS so_yeu_cau
      ${tu} ORDER BY n.id, p.ma_phong, t.ma_tai_san ${pt.gioiHan}`).all(...TRANG_THAI_DA_TIEP_NHAN, ...ts);
  return { dong, tong, trang: pt.trang, soTrang: pt.soTrang };
}

// ---------------------------------------------------------------- Dữ liệu cho ô chọn
// Bộ lọc: mọi nhà / phòng / loại (kể cả đã ngừng, để lọc được mục cũ)
function tuyChonLoc() {
  const db = layCsdl();
  return {
    nha: db.prepare('SELECT id, ma_nha, ten_nha, dang_su_dung FROM toa_nha ORDER BY id').all(),
    phong: db.prepare(`SELECT p.id, p.toa_nha_id, n.ma_nha, p.ma_phong, p.dang_su_dung FROM phong p JOIN toa_nha n ON n.id = p.toa_nha_id
                       ORDER BY n.id, p.ma_phong`).all(),
    loai: db.prepare('SELECT id, ten_loai, dang_su_dung FROM loai_thiet_bi ORDER BY id').all(),
  };
}

// Form thêm / sửa: chỉ mục đang sử dụng, cộng thêm mục hiện tại của bản ghi đang sửa (kể cả đã ngừng)
function tuyChonForm({ phongId = null, loaiId = null } = {}) {
  const t = tuyChonLoc();
  return {
    nha: t.nha.filter((n) => n.dang_su_dung),
    phong: t.phong.filter((p) => p.dang_su_dung || p.id === phongId),
    loai: t.loai.filter((l) => l.dang_su_dung || l.id === loaiId),
  };
}


// Giá trị ban đầu của form Sửa (chuỗi, đúng tên ô trong form). Không thấy -> null.
function giaTriForm(muc, id) {
  const db = layCsdl();
  const chuoi = (v) => (v === null || v === undefined ? '' : String(v));
  if (muc === 'nha') {
    const r = db.prepare('SELECT ma_nha, ten_nha FROM toa_nha WHERE id = ?').get(id);
    return r && { ma_nha: r.ma_nha, ten_nha: r.ten_nha };
  }
  if (muc === 'phong') {
    const r = db.prepare('SELECT p.toa_nha_id, n.ma_nha, p.ma_phong, p.tang, p.loai_phong FROM phong p JOIN toa_nha n ON n.id = p.toa_nha_id WHERE p.id = ?').get(id);
    return r && { nha_id: chuoi(r.toa_nha_id), nha_ma: r.ma_nha, ma_phong: r.ma_phong, tang: chuoi(r.tang), loai_phong: chuoi(r.loai_phong) };
  }
  if (muc === 'loai') {
    const r = db.prepare('SELECT ten_loai FROM loai_thiet_bi WHERE id = ?').get(id);
    return r && { ten_loai: r.ten_loai };
  }
  const r = db.prepare('SELECT * FROM thiet_bi WHERE id = ?').get(id);
  return r && {
    ma_tai_san: r.ma_tai_san, ten_thiet_bi: r.ten_thiet_bi, loai_thiet_bi_id: chuoi(r.loai_thiet_bi_id), phong_id: chuoi(r.phong_id),
    model_hang: chuoi(r.model_hang), nam_su_dung: chuoi(r.nam_su_dung), nguon_kinh_phi: chuoi(r.nguon_kinh_phi),
    han_bao_hanh: chuoi(r.han_bao_hanh), tinh_trang: r.tinh_trang,
  };
}

// ---------------------------------------------------------------- Hồ sơ thiết bị (cột 1–8 sổ M.03)
function hoSoThietBi(id) {
  const db = layCsdl();
  const tb = db.prepare(`
    SELECT t.*, l.ten_loai, n.ma_nha, p.ma_phong
      FROM thiet_bi t JOIN loai_thiet_bi l ON l.id = t.loai_thiet_bi_id JOIN phong p ON p.id = t.phong_id JOIN toa_nha n ON n.id = p.toa_nha_id
     WHERE t.id = ?`).get(id);
  if (!tb) return null;

  const yc = db.prepare(`
    SELECT y.id, y.ma_yeu_cau, y.trang_thai, y.ket_qua_kiem_tra, y.phuong_an, y.ket_qua_cuoi,
           y.thoi_gian_gui, y.thoi_gian_tiep_nhan, y.thoi_gian_hoan_thanh,
           (SELECT u.ho_ten FROM phan_cong pc JOIN nguoi_dung u ON u.id = pc.ktv_id WHERE pc.yeu_cau_id = y.id
             ORDER BY pc.con_hieu_luc DESC, pc.id DESC LIMIT 1) AS ten_ktv
      FROM yeu_cau y WHERE y.thiet_bi_id = ? AND y.trang_thai IN (${DAU_CHAM})
     ORDER BY COALESCE(y.thoi_gian_hoan_thanh, y.thoi_gian_tiep_nhan, y.thoi_gian_gui) DESC, y.id DESC`).all(tb.id, ...TRANG_THAI_DA_TIEP_NHAN);

  const lichSu = yc.map((y) => {
    const dong = db.prepare('SELECT noi_dung, so_luong FROM noi_dung_sua_chua WHERE yeu_cau_id = ? ORDER BY stt').all(y.id);
    const bb = db.prepare('SELECT nguyen_nhan FROM bien_ban_kiem_tra WHERE yeu_cau_id = ? AND con_hieu_luc = 1').get(y.id);
    const phanNoiDung = [];
    if (dong.length) phanNoiDung.push(dong.map((d) => (d.so_luong > 1 ? `${d.noi_dung} × ${d.so_luong}` : d.noi_dung)).join('; '));
    if (bb && y.ket_qua_kiem_tra === 'KHONG_KHAC_PHUC') phanNoiDung.push(`Nguyên nhân: ${bb.nguyen_nhan}`);
    if (y.trang_thai === 'HOAN_THANH' && y.ket_qua_cuoi) phanNoiDung.push(y.ket_qua_cuoi);

    let ketQua;
    if (y.trang_thai === 'HOAN_THANH') {
      ketQua = y.ket_qua_kiem_tra === 'KHONG_KHAC_PHUC' ? `Hoàn thành theo phương án: ${PHUONG_AN[y.phuong_an] || '–'}` : 'Khắc phục tại chỗ';
    } else if (y.trang_thai === 'CHUYEN_XU_LY') ketQua = `Chuyển xử lý: ${PHUONG_AN[y.phuong_an] || '–'}`;
    else ketQua = `Đang xử lý (${TRANG_THAI_YEU_CAU[y.trang_thai].ql})`;

    return {
      yeuCauId: y.id,
      ma: y.ma_yeu_cau,
      ngay: (y.thoi_gian_hoan_thanh || y.thoi_gian_tiep_nhan || y.thoi_gian_gui || '').slice(0, 10),
      noiDung: phanNoiDung.join(' · ') || '–',
      ktv: y.ten_ktv || '–',
      ketQua,
      xong: y.trang_thai === 'HOAN_THANH',
    };
  });

  return { tb, phong: `${tb.ma_nha}-${tb.ma_phong}`, lichSu, soLanSua: lichSu.length };
}

module.exports = {
  SO_DONG_MOI_TRANG, TAB, TRANG_THAI_DA_TIEP_NHAN,
  docBoLoc, lietKeNha, lietKePhong, lietKeLoai, lietKeThietBi, tuyChonLoc, tuyChonForm, giaTriForm, hoSoThietBi,
};
