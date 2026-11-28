// Truy vấn (chỉ đọc) cho Q03 Bảng phân công và Q05 Quản lý KTV. Ghi dữ liệu nằm ở services/nhanSu.js.
// Việc đang làm / quá hạn / yêu cầu chưa xong đều tính bằng truy vấn (SPEC mục 7.1, 10).
const { layCsdl } = require('../db');
const { gioVN } = require('../lib/thoiGian');
const { TRANG_THAI_YEU_CAU } = require('../lib/hangSo');
const { soId, mot } = require('../lib/truyVan');
const { TRANG_THAI_DANG_LAM, TRANG_THAI_KET_THUC } = require('./yeuCau');
const { quaHan } = require('./truyVanQL');

const SO_DONG_MOI_TRANG = 15;
const dauCham = (ds) => ds.map(() => '?').join(',');
const TAB = { 'khu-vuc': 'Khu vực phụ trách', 'cong-viec': 'Công việc đã giao' };

// ---------------------------------------------------------------- Tab "Khu vực phụ trách"
// Mọi KTV (kể cả đã khóa, đánh dấu để QL biết): nhà phụ trách, việc đang làm, quá hạn
function bangKhuVuc() {
  const db = layCsdl();
  const bayGio = gioVN();
  const ktv = db.prepare(`
    SELECT u.id, u.ho_ten, u.email, u.trang_thai,
           (SELECT COUNT(*) FROM phan_cong pc JOIN yeu_cau y ON y.id = pc.yeu_cau_id
             WHERE pc.ktv_id = u.id AND pc.con_hieu_luc = 1 AND y.trang_thai IN (${dauCham(TRANG_THAI_DANG_LAM)})) AS dang_lam,
           (SELECT COUNT(*) FROM phan_cong pc JOIN yeu_cau y ON y.id = pc.yeu_cau_id
             WHERE pc.ktv_id = u.id AND pc.con_hieu_luc = 1 AND y.trang_thai IN (${dauCham(TRANG_THAI_DANG_LAM)})
               AND pc.han_hoan_thanh < ?) AS qua_han
      FROM nguoi_dung u WHERE u.vai_tro = 'KY_THUAT_VIEN' ORDER BY u.id`)
    .all(...TRANG_THAI_DANG_LAM, ...TRANG_THAI_DANG_LAM, bayGio);
  const nhaCua = nhaPhuTrachTheoKtv();
  return ktv.map((k) => ({
    id: k.id, hoTen: k.ho_ten, email: k.email, biKhoa: k.trang_thai === 'KHOA',
    nha: nhaCua.get(k.id) || [], dangLam: k.dang_lam, quaHan: k.qua_han,
  }));
}

// Map ktvId -> [{ id, ma }] theo thứ tự nhà
function nhaPhuTrachTheoKtv() {
  const map = new Map();
  for (const r of layCsdl().prepare(`SELECT k.ktv_id, n.id, n.ma_nha FROM khu_vuc_phu_trach k JOIN toa_nha n ON n.id = k.toa_nha_id ORDER BY n.id`).all()) {
    if (!map.has(r.ktv_id)) map.set(r.ktv_id, []);
    map.get(r.ktv_id).push({ id: r.id, ma: r.ma_nha });
  }
  return map;
}

// Bảng phụ "Xem theo nhà": nhà nào chưa có KTV (đang hoạt động) phụ trách thì canhBao = true.
// Hiện nhà đang sử dụng + nhà đã ngừng nhưng còn yêu cầu chưa xong (cùng tiêu chí thanh Q01).
function xemTheoNha() {
  const db = layCsdl();
  const nha = db.prepare(`
    SELECT n.id, n.ma_nha, n.dang_su_dung,
           (SELECT COUNT(*) FROM yeu_cau y JOIN phong p ON p.id = y.phong_id
             WHERE p.toa_nha_id = n.id AND y.trang_thai NOT IN (${dauCham(TRANG_THAI_KET_THUC)})) AS chua_xong
      FROM toa_nha n ORDER BY n.id`).all(...TRANG_THAI_KET_THUC);
  const ktvCua = db.prepare(`
    SELECT k.toa_nha_id, u.ho_ten FROM khu_vuc_phu_trach k JOIN nguoi_dung u ON u.id = k.ktv_id
     WHERE u.vai_tro = 'KY_THUAT_VIEN' AND u.trang_thai = 'HOAT_DONG' ORDER BY u.id`).all();
  return nha.filter((n) => n.dang_su_dung || n.chua_xong).map((n) => {
    const ds = ktvCua.filter((x) => x.toa_nha_id === n.id).map((x) => x.ho_ten);
    return { id: n.id, ma: n.ma_nha, ngung: !n.dang_su_dung, ktv: ds, chuaXong: n.chua_xong, canhBao: ds.length === 0 };
  });
}

// Các nhà hiện trong hộp ô đánh dấu khi sửa khu vực: nhà đang sử dụng + nhà đã ngừng mà KTV đang giữ
function hopChonNha(ktvId) {
  const dangGiu = new Set((nhaPhuTrachTheoKtv().get(ktvId) || []).map((n) => n.id));
  return layCsdl().prepare('SELECT id, ma_nha, dang_su_dung FROM toa_nha ORDER BY id').all()
    .filter((n) => n.dang_su_dung || dangGiu.has(n.id))
    .map((n) => ({ id: n.id, ma: n.ma_nha, ngung: !n.dang_su_dung, chon: dangGiu.has(n.id) }));
}

// ---------------------------------------------------------------- Tab "Công việc đã giao"
function docBoLocCongViec(query, { dsKtvId, dsNhaId }) {
  const ktv = soId(query.ktv);
  const nha = soId(query.nha);
  const tt = mot(query.tt);
  return {
    ktv: dsKtvId.includes(ktv) ? ktv : null,
    nha: dsNhaId.includes(nha) ? nha : null,
    tt: TRANG_THAI_YEU_CAU[tt] ? tt : '',
    cu: mot(query.cu) === '1',
    trang: Math.max(parseInt(mot(query.trang), 10) || 1, 1),
  };
}

function congViecDaGiao(boLoc) {
  const db = layCsdl();
  const dk = [];
  const ts = [];
  if (!boLoc.cu) dk.push('pc.con_hieu_luc = 1');
  if (boLoc.ktv) { dk.push('pc.ktv_id = ?'); ts.push(boLoc.ktv); }
  if (boLoc.nha) { dk.push('p.toa_nha_id = ?'); ts.push(boLoc.nha); }
  if (boLoc.tt) { dk.push('y.trang_thai = ?'); ts.push(boLoc.tt); }
  const where = dk.length ? `WHERE ${dk.join(' AND ')}` : '';
  const tu = `FROM phan_cong pc JOIN yeu_cau y ON y.id = pc.yeu_cau_id JOIN phong p ON p.id = y.phong_id
              JOIN toa_nha n ON n.id = p.toa_nha_id JOIN nguoi_dung k ON k.id = pc.ktv_id ${where}`;
  const tong = db.prepare(`SELECT COUNT(*) n ${tu}`).get(...ts).n;
  const soTrang = Math.max(1, Math.ceil(tong / SO_DONG_MOI_TRANG));
  const trang = Math.min(boLoc.trang, soTrang);
  const bayGio = gioVN();
  const dong = db.prepare(`
    SELECT pc.id, pc.thoi_gian_giao, pc.han_hoan_thanh, pc.con_hieu_luc, y.id AS yeu_cau_id, y.ma_yeu_cau, y.trang_thai,
           n.ma_nha, p.ma_phong, k.ho_ten AS ten_ktv
      ${tu} ORDER BY pc.thoi_gian_giao DESC, pc.id DESC LIMIT ${SO_DONG_MOI_TRANG} OFFSET ${(trang - 1) * SO_DONG_MOI_TRANG}`).all(...ts)
    .map((r) => ({
      id: r.id,
      yeuCauId: r.yeu_cau_id,
      ma: r.ma_yeu_cau,
      phong: `${r.ma_nha}-${r.ma_phong}`,
      ktv: r.ten_ktv,
      giaoLuc: r.thoi_gian_giao,
      han: r.han_hoan_thanh,
      hieuLuc: !!r.con_hieu_luc,
      trangThai: { ten: TRANG_THAI_YEU_CAU[r.trang_thai].ql, mau: TRANG_THAI_YEU_CAU[r.trang_thai].mau },
      quaHan: !!r.con_hieu_luc && quaHan(r.trang_thai, r.han_hoan_thanh, bayGio), // BR-08: chỉ cảnh báo
    }));
  return { dong, tong, trang, soTrang };
}

// Ô chọn cho bộ lọc tab "Công việc đã giao"
function tuyChonLocCongViec() {
  const db = layCsdl();
  return {
    ktv: db.prepare(`SELECT id, ho_ten FROM nguoi_dung WHERE vai_tro = 'KY_THUAT_VIEN' ORDER BY id`).all(),
    nha: db.prepare('SELECT id, ma_nha FROM toa_nha ORDER BY id').all(),
  };
}

// ---------------------------------------------------------------- Q05
function danhSachKtv() {
  const db = layCsdl();
  const nhaCua = nhaPhuTrachTheoKtv();
  return db.prepare(`
    SELECT u.id, u.ho_ten, u.email, u.so_dien_thoai, u.trang_thai,
           (SELECT COUNT(*) FROM phan_cong pc JOIN yeu_cau y ON y.id = pc.yeu_cau_id
             WHERE pc.ktv_id = u.id AND pc.con_hieu_luc = 1 AND y.trang_thai IN (${dauCham(TRANG_THAI_DANG_LAM)})) AS dang_lam
      FROM nguoi_dung u WHERE u.vai_tro = 'KY_THUAT_VIEN' ORDER BY u.id`).all(...TRANG_THAI_DANG_LAM)
    .map((k) => ({
      id: k.id, hoTen: k.ho_ten, email: k.email, sdt: k.so_dien_thoai, biKhoa: k.trang_thai === 'KHOA',
      nha: nhaCua.get(k.id) || [], dangLam: k.dang_lam,
    }));
}

function layKtv(id) {
  return layCsdl().prepare(`SELECT id, ho_ten, email, so_dien_thoai, trang_thai FROM nguoi_dung WHERE id = ? AND vai_tro = 'KY_THUAT_VIEN'`).get(id) || null;
}

module.exports = {
  SO_DONG_MOI_TRANG, TAB,
  bangKhuVuc, xemTheoNha, hopChonNha, docBoLocCongViec, congViecDaGiao, tuyChonLocCongViec, danhSachKtv, layKtv,
};
