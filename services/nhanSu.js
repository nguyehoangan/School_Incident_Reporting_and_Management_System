// Ghi dữ liệu nhân sự kỹ thuật: tài khoản KTV (Q05) và khu vực phụ trách KTV ↔ Nhà (Q03, SPEC mục 7.1).
// Truy vấn chỉ đọc nằm ở services/truyVanPhanCong.js. Lỗi ném ra là LoiNghiepVu (xem services/danhMuc.js).
const bcrypt = require('bcrypt');
const { layCsdl } = require('../db');
const { LoiNghiepVu, TRANG_THAI_DANG_LAM } = require('./yeuCau');

const EMAIL_KTV = /^[^\s@]+@hust\.edu\.vn$/; // KTV là cán bộ: chỉ đuôi @hust.edu.vn (SPEC Q05)
const MAT_KHAU_TOI_THIEU = 6;
const MAT_KHAU_TOI_DA = 72; // giới hạn của bcrypt
const TRONG = 'Mục này không được để trống';

const loiDuLieu = (loi) => new LoiNghiepVu('Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.', { ma: 422, loaiLoi: 'du-lieu', loi });
const quyTac = (thongDiep) => new LoiNghiepVu(thongDiep, { ma: 409, loaiLoi: 'quy-tac' });
const chuoi = (v) => String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim();

function chiQuanLy(nguoiDung) {
  if (!nguoiDung || nguoiDung.vai_tro !== 'QUAN_LY') {
    throw new LoiNghiepVu('Chỉ Quản lý được quản lý kỹ thuật viên và khu vực phụ trách.', { ma: 403, loaiLoi: 'quyen' });
  }
}

function layKtv(id) {
  const k = layCsdl().prepare(`SELECT * FROM nguoi_dung WHERE id = ? AND vai_tro = 'KY_THUAT_VIEN'`).get(id);
  if (!k) throw new LoiNghiepVu('Kỹ thuật viên không tồn tại.', { ma: 404, loaiLoi: 'khong-thay' });
  return k;
}

// "Việc đang làm" = yêu cầu của KTV ở trạng thái Đã phân công / Đang xử lý (mục 7.1), tính bằng truy vấn
function soViecDangLam(ktvId) {
  return layCsdl().prepare(`SELECT COUNT(*) n FROM phan_cong pc JOIN yeu_cau y ON y.id = pc.yeu_cau_id
                             WHERE pc.ktv_id = ? AND pc.con_hieu_luc = 1 AND y.trang_thai IN (${TRANG_THAI_DANG_LAM.map(() => '?').join(',')})`)
    .get(ktvId, ...TRANG_THAI_DANG_LAM).n;
}

// ---------------------------------------------------------------- Q05
function kiemTraHoSo(body, { moi }) {
  const loi = {};
  const hoTen = chuoi(body.ho_ten);
  if (!hoTen) loi.ho_ten = TRONG;
  else if (hoTen.length < 2 || hoTen.length > 100) loi.ho_ten = 'Họ tên cần từ 2 đến 100 ký tự';

  let sdt = null;
  const sdtVao = chuoi(body.so_dien_thoai).replace(/[\s.-]/g, '');
  if (sdtVao) {
    if (!/^\+?\d{9,12}$/.test(sdtVao)) loi.so_dien_thoai = 'Số điện thoại gồm 9–12 chữ số (ví dụ 0912345678)';
    else sdt = sdtVao;
  }

  let email = null;
  let matKhau = null;
  if (moi) {
    email = chuoi(body.email).toLowerCase();
    if (!email) loi.email = TRONG;
    else if (!EMAIL_KTV.test(email)) loi.email = 'Email kỹ thuật viên phải có đuôi @hust.edu.vn';
    else if (layCsdl().prepare('SELECT 1 FROM nguoi_dung WHERE LOWER(email) = ?').get(email)) loi.email = `Email ${email} đã có tài khoản`;

    matKhau = String(body.mat_khau === undefined || body.mat_khau === null ? '' : body.mat_khau);
    if (!matKhau) loi.mat_khau = TRONG;
    else if (matKhau.length < MAT_KHAU_TOI_THIEU) loi.mat_khau = `Mật khẩu ban đầu cần ít nhất ${MAT_KHAU_TOI_THIEU} ký tự`;
    else if (matKhau.length > MAT_KHAU_TOI_DA) loi.mat_khau = `Mật khẩu tối đa ${MAT_KHAU_TOI_DA} ký tự`;
  }
  if (Object.keys(loi).length) throw loiDuLieu(loi);
  return { hoTen, sdt, email, matKhau };
}

function themKtv(nguoiDung, body) {
  chiQuanLy(nguoiDung);
  const d = kiemTraHoSo(body || {}, { moi: true });
  const hash = bcrypt.hashSync(d.matKhau, 10); // chỉ lưu băm, không lưu mật khẩu
  let id;
  try {
    id = layCsdl().prepare(`INSERT INTO nguoi_dung (email, mat_khau_hash, ho_ten, vai_tro, so_dien_thoai, trang_thai)
                            VALUES (?, ?, ?, 'KY_THUAT_VIEN', ?, 'HOAT_DONG')`).run(d.email, hash, d.hoTen, d.sdt).lastInsertRowid;
  } catch (e) {
    if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw loiDuLieu({ email: `Email ${d.email} đã có tài khoản` });
    throw e;
  }
  return { id: Number(id), nhan: d.hoTen };
}

function suaKtv(nguoiDung, id, body) {
  chiQuanLy(nguoiDung);
  const ktv = layKtv(id);
  const d = kiemTraHoSo(body || {}, { moi: false });
  layCsdl().prepare('UPDATE nguoi_dung SET ho_ten = ?, so_dien_thoai = ? WHERE id = ?').run(d.hoTen, d.sdt, ktv.id);
  return { id: ktv.id, nhan: d.hoTen };
}

// Không khóa KTV còn việc đang làm: phải đổi người trước (mục Q05)
function khoaKtv(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const ktv = layKtv(id);
  if (ktv.trang_thai === 'KHOA') throw quyTac(`${ktv.ho_ten} đã bị khóa.`);
  const n = soViecDangLam(ktv.id);
  if (n) {
    throw quyTac(`Không khóa được ${ktv.ho_ten}: còn ${n} việc đang làm (Đã phân công / Đang xử lý). Hãy đổi người phụ trách các việc đó trước.`);
  }
  layCsdl().prepare(`UPDATE nguoi_dung SET trang_thai = 'KHOA' WHERE id = ?`).run(ktv.id);
  return { id: ktv.id, nhan: ktv.ho_ten };
}

function moKhoaKtv(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const ktv = layKtv(id);
  if (ktv.trang_thai !== 'KHOA') throw quyTac(`${ktv.ho_ten} không bị khóa.`);
  layCsdl().prepare(`UPDATE nguoi_dung SET trang_thai = 'HOAT_DONG' WHERE id = ?`).run(ktv.id);
  return { id: ktv.id, nhan: ktv.ho_ten };
}

// ---------------------------------------------------------------- Q03: khu vực phụ trách (KTV ↔ Nhà)
// dsNhaId: id các nhà được đánh dấu. Thay toàn bộ khu vực của KTV; chỉ gán MỚI được nhà đang sử dụng
// (nhà đã ngừng mà KTV đang giữ thì được giữ hoặc bỏ). Gợi ý phân công (yeuCau.goiYKtv) đọc thẳng bảng này.
function datKhuVuc(nguoiDung, ktvId, dsNhaId) {
  chiQuanLy(nguoiDung);
  const db = layCsdl();
  const ktv = layKtv(ktvId);
  const ids = [...new Set([].concat(dsNhaId === undefined || dsNhaId === null ? [] : dsNhaId).map((x) => String(x).trim()))];
  if (ids.some((x) => !/^\d+$/.test(x))) throw loiDuLieu({ nha: 'Nhà được chọn không hợp lệ' });
  const chon = ids.map(Number);

  const dangGiu = new Set(db.prepare('SELECT toa_nha_id FROM khu_vuc_phu_trach WHERE ktv_id = ?').all(ktv.id).map((r) => r.toa_nha_id));
  for (const nhaId of chon) {
    const nha = db.prepare('SELECT * FROM toa_nha WHERE id = ?').get(nhaId);
    if (!nha) throw loiDuLieu({ nha: 'Nhà được chọn không tồn tại' });
    if (!nha.dang_su_dung && !dangGiu.has(nhaId)) throw loiDuLieu({ nha: `Nhà ${nha.ma_nha} đã ngừng sử dụng, không gán mới được` });
  }

  db.transaction(() => {
    db.prepare('DELETE FROM khu_vuc_phu_trach WHERE ktv_id = ?').run(ktv.id);
    const them = db.prepare('INSERT INTO khu_vuc_phu_trach (ktv_id, toa_nha_id) VALUES (?, ?)');
    for (const nhaId of chon) them.run(ktv.id, nhaId);
  })();
  return { id: ktv.id, nhan: ktv.ho_ten, soNha: chon.length };
}

module.exports = { EMAIL_KTV, MAT_KHAU_TOI_THIEU, soViecDangLam, themKtv, suaKtv, khoaKtv, moKhoaKtv, datKhuVuc };
