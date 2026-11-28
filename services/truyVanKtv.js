// Truy vấn cho màn hình Kỹ thuật viên: K01 Việc được giao, K02 Chi tiết công việc (SPEC mục 8).
// Chỉ ĐỌC dữ liệu; mọi chuyển trạng thái vẫn đi qua services/yeuCau.js.
// BR-04: KTV chỉ thấy việc có bản ghi phân công đang hiệu lực (con_hieu_luc = 1) của chính mình.
const { layCsdl } = require('../db');
const { gioVN } = require('../lib/thoiGian');
const { TRANG_THAI_YEU_CAU, MUC_DO } = require('../lib/hangSo');
const { quaHan } = require('./truyVanQL');

// Mục 8 – K01: ba tab. "Đã xong" gồm cả Chuyển xử lý theo phương án.
const TAB = {
  'can-lam':        { ten: 'Cần làm',        ds: ['DA_PHAN_CONG', 'DANG_SUA'] },
  'cho-nghiem-thu': { ten: 'Chờ nghiệm thu', ds: ['CHO_NGHIEM_THU'] },
  'da-xong':        { ten: 'Đã xong',        ds: ['HOAN_THANH', 'CHUYEN_XU_LY'] },
};
const TAB_MAC_DINH = 'can-lam';

const THIET_BI_KHAC = 'không có trong danh sách';

function tenThietBi(r) {
  return r.ten_thiet_bi ? `${r.ten_thiet_bi} ${r.ma_tai_san}` : `${r.ten_loai} (${THIET_BI_KHAC})`;
}

// Số việc ở từng tab (hiện cạnh tên tab)
function demTheoTab(ktvId) {
  const db = layCsdl();
  const dem = {};
  for (const [khoa, t] of Object.entries(TAB)) {
    dem[khoa] = db.prepare(`
      SELECT COUNT(*) n FROM yeu_cau y JOIN phan_cong pc ON pc.yeu_cau_id = y.id AND pc.con_hieu_luc = 1
       WHERE pc.ktv_id = ? AND y.trang_thai IN (${t.ds.map(() => '?').join(',')})`).get(ktvId, ...t.ds).n;
  }
  return dem;
}

// K01: danh sách việc của một tab, nhóm theo nhà; trong mỗi nhà Khẩn cấp trước, rồi hạn gần trước.
function danhSachViec(ktvId, khoaTab) {
  const db = layCsdl();
  const tab = TAB[khoaTab];
  const bayGio = gioVN();
  const dong = db.prepare(`
    SELECT y.id, y.ma_yeu_cau, y.muc_do, y.trang_thai, n.id AS nha_id, n.ma_nha, p.ma_phong,
           l.ten_loai, t.ten_thiet_bi, t.ma_tai_san, pc.han_hoan_thanh
      FROM yeu_cau y
      JOIN phan_cong pc ON pc.yeu_cau_id = y.id AND pc.con_hieu_luc = 1
      JOIN phong p ON p.id = y.phong_id
      JOIN toa_nha n ON n.id = p.toa_nha_id
      JOIN loai_thiet_bi l ON l.id = y.loai_thiet_bi_id
      LEFT JOIN thiet_bi t ON t.id = y.thiet_bi_id
     WHERE pc.ktv_id = ? AND y.trang_thai IN (${tab.ds.map(() => '?').join(',')})
     ORDER BY n.id, (y.muc_do = 'KHAN_CAP') DESC, pc.han_hoan_thanh, y.id`).all(ktvId, ...tab.ds)
    .map((r) => ({
      id: r.id,
      ma: r.ma_yeu_cau,
      maNha: r.ma_nha,
      phong: `${r.ma_nha}-${r.ma_phong}`,
      thietBi: tenThietBi(r),
      khanCap: r.muc_do === 'KHAN_CAP',
      mucDo: MUC_DO[r.muc_do],
      han: r.han_hoan_thanh,
      quaHan: quaHan(r.trang_thai, r.han_hoan_thanh, bayGio), // BR-08
      trangThai: { ten: TRANG_THAI_YEU_CAU[r.trang_thai].ql, mau: TRANG_THAI_YEU_CAU[r.trang_thai].mau },
    }));

  const nhom = [];
  for (const d of dong) {
    let g = nhom[nhom.length - 1];
    if (!g || g.maNha !== d.maNha) { g = { maNha: d.maNha, dong: [] }; nhom.push(g); }
    g.dong.push(d);
  }
  return nhom;
}

// "Khu vực phụ trách: D3, D5" (mục 7.1)
function khuVucPhuTrach(ktvId) {
  return layCsdl().prepare(`SELECT n.ma_nha FROM khu_vuc_phu_trach k JOIN toa_nha n ON n.id = k.toa_nha_id
                             WHERE k.ktv_id = ? ORDER BY n.id`).all(ktvId).map((r) => r.ma_nha);
}

// Lý do QL yêu cầu làm lại: lấy từ dòng lịch sử mới nhất "Yêu cầu làm lại: <lý do>. Giao lại cho <KTV>"
// (do services/yeuCau.js ghi; chưa có cột riêng nên không đổi schema).
const TIEN_TO_LAM_LAI = 'Yêu cầu làm lại: ';
const HAU_TO_LAM_LAI = '. Giao lại cho ';
function lyDoLamLai(db, yeuCauId) {
  const h = db.prepare(`SELECT noi_dung FROM lich_su_xu_ly WHERE yeu_cau_id = ? AND tu_trang_thai = 'CHO_NGHIEM_THU'
                          AND den_trang_thai = 'DA_PHAN_CONG' ORDER BY id DESC LIMIT 1`).get(yeuCauId);
  if (!h || !h.noi_dung.startsWith(TIEN_TO_LAM_LAI)) return null;
  const phan = h.noi_dung.slice(TIEN_TO_LAM_LAI.length);
  const i = phan.lastIndexOf(HAU_TO_LAM_LAI);
  return i >= 0 ? phan.slice(0, i) : phan;
}

// K02: chi tiết một việc. Trả null nếu việc không tồn tại HOẶC không có phân công hiệu lực của KTV này (BR-04 -> 404).
function chiTietViec(ktvId, yeuCauId) {
  const db = layCsdl();
  const yc = db.prepare(`
    SELECT y.*, n.ma_nha, p.ma_phong, l.ten_loai,
           t.ten_thiet_bi, t.ma_tai_san, t.model_hang, t.tinh_trang AS tinh_trang_tb, t.han_bao_hanh,
           sv.ho_ten AS ten_sv, sv.ma_so AS mssv
      FROM yeu_cau y
      JOIN phong p ON p.id = y.phong_id
      JOIN toa_nha n ON n.id = p.toa_nha_id
      JOIN loai_thiet_bi l ON l.id = y.loai_thiet_bi_id
      JOIN nguoi_dung sv ON sv.id = y.sinh_vien_id
      LEFT JOIN thiet_bi t ON t.id = y.thiet_bi_id
     WHERE y.id = ?`).get(yeuCauId);
  if (!yc) return null;

  const pc = db.prepare(`SELECT pc.*, g.ho_ten AS ten_nguoi_giao FROM phan_cong pc JOIN nguoi_dung g ON g.id = pc.nguoi_giao_id
                          WHERE pc.yeu_cau_id = ? AND pc.con_hieu_luc = 1`).get(yc.id);
  if (!pc || pc.ktv_id !== ktvId) return null;

  const anh = (loai) => db.prepare('SELECT duong_dan FROM anh_dinh_kem WHERE yeu_cau_id = ? AND loai_anh = ? ORDER BY id')
    .all(yc.id, loai).map((a) => a.duong_dan);
  const lyDo = ['DA_PHAN_CONG', 'DANG_SUA', 'CHO_NGHIEM_THU'].includes(yc.trang_thai) ? lyDoLamLai(db, yc.id) : null;
  // Ghi chú giao việc của lần làm lại chỉ là "Làm lại: <lý do>" – đã có khối lý do riêng nên không hiện lặp
  const ghiChu = pc.ghi_chu_giao_viec && pc.ghi_chu_giao_viec !== `Làm lại: ${lyDo}` ? pc.ghi_chu_giao_viec : null;

  return {
    yc,
    pc,
    phong: `${yc.ma_nha}-${yc.ma_phong}`,
    thietBi: yc.ten_thiet_bi ? `${yc.ten_thiet_bi} · ${yc.ma_tai_san}` : `${yc.ten_loai} (${THIET_BI_KHAC})`,
    quaHan: quaHan(yc.trang_thai, pc.han_hoan_thanh),
    ghiChuGiaoViec: ghiChu,
    lyDoLamLai: lyDo,
    anhTruoc: anh('TRUOC'),
    anhSau: anh('SAU'),
    noiDungSua: db.prepare('SELECT stt, noi_dung, so_luong, ghi_chu FROM noi_dung_sua_chua WHERE yeu_cau_id = ? ORDER BY stt').all(yc.id),
    bienBan: db.prepare('SELECT * FROM bien_ban_kiem_tra WHERE yeu_cau_id = ? AND con_hieu_luc = 1').get(yc.id) || null,
  };
}

module.exports = { TAB, TAB_MAC_DINH, demTheoTab, danhSachViec, khuVucPhuTrach, chiTietViec };
