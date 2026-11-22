// Truy vấn (chỉ đọc) cho màn hình Quản lý: Q01 Danh sách yêu cầu và Q02 Chi tiết.
// Mọi số đếm tính bằng truy vấn, không lưu cột riêng (SPEC mục 10). Ghi dữ liệu nằm ở services/yeuCau.js.
const { layCsdl } = require('../db');
const { gioVN, dinhDang } = require('../lib/thoiGian');
const { TRANG_THAI_YEU_CAU, MUC_DO, VAI_TRO } = require('../lib/hangSo');
const yeuCau = require('./yeuCau');

const SO_DONG_MOI_TRANG = 15;
const KET_THUC = yeuCau.TRANG_THAI_KET_THUC; // HOAN_THANH, TU_CHOI, DA_HUY
const DANG_LAM = yeuCau.TRANG_THAI_DANG_LAM; // DA_PHAN_CONG, DANG_SUA
const HOAN_THANH_THANG = 'HOAN_THANH_THANG'; // ô "Hoàn thành (tháng này)"
const dauCham = (ds) => ds.map(() => '?').join(',');

// 5 ô số liệu (mục 8 – Q01)
const O_SO_LIEU = [
  { tt: 'MOI', ten: 'Mới (Đã gửi)', mau: 'vang' },
  { tt: 'DA_PHAN_CONG', ten: 'Đã phân công', mau: 'xanh-nhat' },
  { tt: 'DANG_SUA', ten: 'Đang xử lý', mau: 'xanh' },
  { tt: 'CHO_NGHIEM_THU', ten: 'Chờ nghiệm thu', mau: 'tim' },
  { tt: HOAN_THANH_THANG, ten: 'Hoàn thành (tháng này)', mau: 'xanh-la' },
];

const SAP_XEP = { 'khan-cap': 'Khẩn cấp lên đầu', 'moi-nhat': 'Mới nhất' };
const CHE_DO = { 'danh-sach': 'Danh sách', 'theo-nha': 'Theo nhà' };

// "Nguyễn Hoàng An" -> "N.H. An" (cột Sinh viên như mockup Q01)
function tenVietTat(hoTen) {
  const t = String(hoTen || '').trim().split(/\s+/);
  if (t.length < 2) return hoTen || '';
  return t.slice(0, -1).map((x) => x[0].toUpperCase() + '.').join('') + ' ' + t[t.length - 1];
}

// BR-08: quá hạn = Đã phân công / Đang xử lý và hiện tại > hạn kiểm tra (chỉ cảnh báo)
function quaHan(trangThai, han, bayGio = gioVN()) {
  return !!han && DANG_LAM.includes(trangThai) && bayGio > han;
}

// ---------------------------------------------------------------- Khoảng ngày nhanh
const ngayHomNay = () => gioVN().slice(0, 10);
function khoangNhanh() {
  const homNay = ngayHomNay();
  const [y, m] = homNay.split('-').map(Number);
  // Học kỳ theo năm học: HK1 01/09–31/01, HK2 01/02–30/06, HK hè 01/07–31/08
  let dauHocKy;
  if (m >= 9) dauHocKy = `${y}-09-01`;
  else if (m === 1) dauHocKy = `${y - 1}-09-01`;
  else if (m <= 6) dauHocKy = `${y}-02-01`;
  else dauHocKy = `${y}-07-01`;
  return {
    'thang-nay': { ten: 'Tháng này', tu: `${homNay.slice(0, 7)}-01`, den: homNay },
    'hoc-ky': { ten: 'Học kỳ này', tu: dauHocKy, den: homNay },
    'nam-nay': { ten: 'Năm nay', tu: `${y}-01-01`, den: homNay },
  };
}

// ---------------------------------------------------------------- Đọc bộ lọc từ query string
function laNgay(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function docBoLoc(query, dsMaNha) {
  const motGiaTri = (v) => (Array.isArray(v) ? v[0] : v);
  const nhaVao = [].concat(query.nha || []).flatMap((x) => String(x).split(','));
  const nha = dsMaNha.filter((ma) => nhaVao.includes(ma));
  const tt = String(motGiaTri(query.tt) || '');
  const md = String(motGiaTri(query.md) || '');
  const tu = String(motGiaTri(query.tu) || '');
  const den = String(motGiaTri(query.den) || '');
  const q = String(motGiaTri(query.q) || '').trim().slice(0, 100);
  const sx = String(motGiaTri(query.sx) || '');
  const cd = String(motGiaTri(query.cd) || '');
  return {
    nha,
    tt: TRANG_THAI_YEU_CAU[tt] || tt === HOAN_THANH_THANG ? tt : '',
    md: MUC_DO[md] ? md : '',
    tu: laNgay(tu) ? tu : '',
    den: laNgay(den) ? den : '',
    q,
    sx: SAP_XEP[sx] ? sx : 'khan-cap',
    cd: CHE_DO[cd] ? cd : 'danh-sach',
    trang: Math.max(parseInt(motGiaTri(query.trang), 10) || 1, 1),
  };
}

// Tạo query string từ bộ lọc (bỏ giá trị mặc định); thayDoi ghi đè vài khóa. Đổi bộ lọc thì về trang 1.
function chuoiTruyVan(boLoc, thayDoi = {}) {
  const b = { ...boLoc, trang: 1, ...thayDoi };
  const p = new URLSearchParams();
  if (b.nha.length) p.set('nha', b.nha.join(','));
  if (b.tt) p.set('tt', b.tt);
  if (b.md) p.set('md', b.md);
  if (b.tu) p.set('tu', b.tu);
  if (b.den) p.set('den', b.den);
  if (b.q) p.set('q', b.q);
  if (b.sx !== 'khan-cap') p.set('sx', b.sx);
  if (b.cd !== 'danh-sach') p.set('cd', b.cd);
  if (b.trang > 1) p.set('trang', String(b.trang));
  return p.toString();
}

// ---------------------------------------------------------------- Q01
function danhSachNha() {
  return layCsdl().prepare('SELECT id, ma_nha, ten_nha, dang_su_dung FROM toa_nha ORDER BY id').all();
}

// Đầu tháng hiện tại (giờ VN) để đếm "Hoàn thành (tháng này)"
const dauThang = () => `${ngayHomNay().slice(0, 7)}-01 00:00:00`;

function soLieuTongQuan() {
  const db = layCsdl();
  const dem = {};
  for (const r of db.prepare('SELECT trang_thai, COUNT(*) n FROM yeu_cau GROUP BY trang_thai').all()) dem[r.trang_thai] = r.n;
  dem[HOAN_THANH_THANG] = db.prepare(`SELECT COUNT(*) n FROM yeu_cau WHERE trang_thai = 'HOAN_THANH' AND thoi_gian_hoan_thanh >= ?`)
    .get(dauThang()).n;
  const oSoLieu = O_SO_LIEU.map((o) => ({ ...o, so: dem[o.tt] || 0 }));

  // Thanh "Chưa xong theo nhà" (mục 7.4): nhà đang sử dụng + nhà ngừng sử dụng nhưng còn yêu cầu chưa xong
  const theoNha = db.prepare(`
    SELECT n.ma_nha, n.dang_su_dung,
           (SELECT COUNT(*) FROM yeu_cau y JOIN phong p ON p.id = y.phong_id
             WHERE p.toa_nha_id = n.id AND y.trang_thai NOT IN (${dauCham(KET_THUC)})) AS chua_xong
      FROM toa_nha n ORDER BY n.id`).all(...KET_THUC)
    .filter((r) => r.dang_su_dung || r.chua_xong)
    .map((r) => ({ maNha: r.ma_nha, chuaXong: r.chua_xong }));
  return { oSoLieu, theoNha };
}

const KY_TU_LIKE = /[\\%_]/g;

function danhSachYeuCau(boLoc) {
  const db = layCsdl();
  const dk = [];
  const ts = [];
  if (boLoc.nha.length) { dk.push(`n.ma_nha IN (${dauCham(boLoc.nha)})`); ts.push(...boLoc.nha); }
  if (boLoc.tt === HOAN_THANH_THANG) { dk.push(`y.trang_thai = 'HOAN_THANH' AND y.thoi_gian_hoan_thanh >= ?`); ts.push(dauThang()); }
  else if (boLoc.tt) { dk.push('y.trang_thai = ?'); ts.push(boLoc.tt); }
  if (boLoc.md) { dk.push('y.muc_do = ?'); ts.push(boLoc.md); }
  if (boLoc.tu) { dk.push('y.thoi_gian_gui >= ?'); ts.push(`${boLoc.tu} 00:00:00`); }
  if (boLoc.den) { dk.push('y.thoi_gian_gui <= ?'); ts.push(`${boLoc.den} 23:59:59`); }
  if (boLoc.q) {
    const mau = `%${boLoc.q.replace(KY_TU_LIKE, (c) => '\\' + c)}%`;
    dk.push(`(y.ma_yeu_cau LIKE ? ESCAPE '\\' OR sv.ma_so LIKE ? ESCAPE '\\' OR sv.ho_ten LIKE ? ESCAPE '\\'
             OR (n.ma_nha || '-' || p.ma_phong) LIKE ? ESCAPE '\\' OR t.ma_tai_san LIKE ? ESCAPE '\\')`);
    ts.push(mau, mau, mau, mau, mau);
  }
  const where = dk.length ? `WHERE ${dk.join(' AND ')}` : '';
  // "Khẩn cấp lên đầu": yêu cầu khẩn cấp còn đang xử lý dở lên trước, còn lại mới nhất trước
  const orderBy = boLoc.sx === 'moi-nhat'
    ? 'y.thoi_gian_gui DESC, y.id DESC'
    : `CASE WHEN y.muc_do = 'KHAN_CAP' AND y.trang_thai NOT IN (${KET_THUC.map((x) => `'${x}'`).join(',')}) THEN 0 ELSE 1 END,
       y.thoi_gian_gui DESC, y.id DESC`;
  const tu = `
      FROM yeu_cau y
      JOIN phong p ON p.id = y.phong_id
      JOIN toa_nha n ON n.id = p.toa_nha_id
      JOIN loai_thiet_bi l ON l.id = y.loai_thiet_bi_id
      JOIN nguoi_dung sv ON sv.id = y.sinh_vien_id
      LEFT JOIN thiet_bi t ON t.id = y.thiet_bi_id
      LEFT JOIN phan_cong pc ON pc.yeu_cau_id = y.id AND pc.con_hieu_luc = 1
      LEFT JOIN nguoi_dung k ON k.id = pc.ktv_id
      ${where}`;
  const tong = db.prepare(`SELECT COUNT(*) n ${tu}`).get(...ts).n;

  const theoNha = boLoc.cd === 'theo-nha';
  const soTrang = theoNha ? 1 : Math.max(1, Math.ceil(tong / SO_DONG_MOI_TRANG));
  const trang = Math.min(boLoc.trang, soTrang);
  const gioiHan = theoNha ? '' : `LIMIT ${SO_DONG_MOI_TRANG} OFFSET ${(trang - 1) * SO_DONG_MOI_TRANG}`;
  const bayGio = gioVN();

  const dong = db.prepare(`
    SELECT y.id, y.ma_yeu_cau, y.thoi_gian_gui, y.muc_do, y.trang_thai, n.id AS nha_id, n.ma_nha, p.ma_phong,
           l.ten_loai, sv.ho_ten AS ten_sv, sv.ma_so AS mssv, k.ho_ten AS ten_ktv, pc.han_hoan_thanh
    ${tu} ORDER BY ${theoNha ? 'n.id, ' : ''}${orderBy} ${gioiHan}`).all(...ts)
    .map((r) => ({
      id: r.id,
      ma: r.ma_yeu_cau,
      guiLuc: r.thoi_gian_gui,
      khanCap: r.muc_do === 'KHAN_CAP',
      mucDo: MUC_DO[r.muc_do],
      thietBi: r.ten_loai,
      maNha: r.ma_nha,
      phong: `${r.ma_nha}-${r.ma_phong}`,
      sv: tenVietTat(r.ten_sv),
      svDayDu: `${r.ten_sv} · ${r.mssv || ''}`,
      ktv: r.ten_ktv || null,
      han: r.han_hoan_thanh,
      quaHan: quaHan(r.trang_thai, r.han_hoan_thanh, bayGio),
      ketThuc: KET_THUC.includes(r.trang_thai),
      trangThai: { ten: TRANG_THAI_YEU_CAU[r.trang_thai].ql, mau: TRANG_THAI_YEU_CAU[r.trang_thai].mau },
    }));

  // Chế độ "Theo nhà": nhóm theo nhà, tiêu đề ghi số yêu cầu chưa xong (mục 7.4)
  let nhom = [];
  if (theoNha) {
    const theoMa = new Map();
    for (const d of dong) {
      if (!theoMa.has(d.maNha)) theoMa.set(d.maNha, { maNha: d.maNha, dong: [], chuaXong: 0 });
      const g = theoMa.get(d.maNha);
      g.dong.push(d);
      if (!d.ketThuc) g.chuaXong += 1;
    }
    nhom = [...theoMa.values()];
  }
  return { dong, nhom, tong, trang, soTrang };
}

// ---------------------------------------------------------------- Q02
const NHAN_VAI_TRO = { SINH_VIEN: 'SV', QUAN_LY: 'QL', KY_THUAT_VIEN: 'KTV' };

// Tên thao tác trong lịch sử, suy ra từ cặp (từ, sang) – mỗi cặp ứng với đúng 1 dòng bảng 5.1
function tenThaoTac(tu, den) {
  if (!tu) return 'Gửi yêu cầu';
  if (tu === den && !Object.values(yeuCau.BANG_CHUYEN).some((b) => b.tu === tu && b.den === den)) return 'Cập nhật ghi chú cho SV';
  const b = Object.values(yeuCau.BANG_CHUYEN).find((x) => x.tu === tu && x.den === den);
  return b ? b.ten : `${tu} → ${den}`;
}

function chiTietYeuCau(id) {
  const db = layCsdl();
  const yc = db.prepare(`
    SELECT y.*, n.id AS nha_id, n.ma_nha, n.ten_nha, p.ma_phong, l.ten_loai,
           t.ten_thiet_bi, t.ma_tai_san, t.model_hang, t.tinh_trang AS tinh_trang_tb, t.han_bao_hanh,
           sv.ho_ten AS ten_sv, sv.ma_so AS mssv, sv.email AS email_sv
      FROM yeu_cau y
      JOIN phong p ON p.id = y.phong_id
      JOIN toa_nha n ON n.id = p.toa_nha_id
      JOIN loai_thiet_bi l ON l.id = y.loai_thiet_bi_id
      JOIN nguoi_dung sv ON sv.id = y.sinh_vien_id
      LEFT JOIN thiet_bi t ON t.id = y.thiet_bi_id
     WHERE y.id = ?`).get(id);
  if (!yc) return null;

  const pc = yeuCau.phanCongHienTai(db, yc.id);
  const anh = (loai) => db.prepare('SELECT duong_dan FROM anh_dinh_kem WHERE yeu_cau_id = ? AND loai_anh = ? ORDER BY id')
    .all(yc.id, loai).map((a) => a.duong_dan);
  const lichSu = db.prepare(`
    SELECT ls.thoi_gian, ls.tu_trang_thai, ls.den_trang_thai, ls.noi_dung, u.ho_ten, u.vai_tro
      FROM lich_su_xu_ly ls JOIN nguoi_dung u ON u.id = ls.nguoi_thuc_hien_id
     WHERE ls.yeu_cau_id = ? ORDER BY ls.thoi_gian, ls.id`).all(yc.id)
    .map((h) => ({
      thoiGian: h.thoi_gian,
      nguoi: `${h.ho_ten} (${NHAN_VAI_TRO[h.vai_tro] || VAI_TRO[h.vai_tro]})`,
      thaoTac: tenThaoTac(h.tu_trang_thai, h.den_trang_thai),
      noiDung: h.noi_dung,
      den: TRANG_THAI_YEU_CAU[h.den_trang_thai].ql,
    }));
  const noiDungSua = db.prepare('SELECT stt, noi_dung, so_luong, ghi_chu FROM noi_dung_sua_chua WHERE yeu_cau_id = ? ORDER BY stt').all(yc.id);
  const bienBan = db.prepare(`SELECT b.*, u.ho_ten AS ten_ktv FROM bien_ban_kiem_tra b JOIN nguoi_dung u ON u.id = b.ktv_id
                               WHERE b.yeu_cau_id = ? AND b.con_hieu_luc = 1`).get(yc.id) || null;
  // "Các yêu cầu khác của thiết bị / phòng này"
  const soYeuCauKhac = db.prepare('SELECT COUNT(*) n FROM yeu_cau WHERE phong_id = ? AND id <> ?').get(yc.phong_id, yc.id).n;

  return {
    yc,
    pc,
    quaHan: pc ? quaHan(yc.trang_thai, pc.han_hoan_thanh) : false,
    anhTruoc: anh('TRUOC'),
    anhSau: anh('SAU'),
    lichSu,
    noiDungSua,
    bienBan,
    soYeuCauKhac,
    phong: `${yc.ma_nha}-${yc.ma_phong}`,
  };
}

module.exports = {
  SO_DONG_MOI_TRANG, O_SO_LIEU, SAP_XEP, CHE_DO, HOAN_THANH_THANG,
  tenVietTat, quaHan, khoangNhanh, docBoLoc, chuoiTruyVan, danhSachNha, soLieuTongQuan, danhSachYeuCau,
  chiTietYeuCau, tenThaoTac, dinhDang,
};
