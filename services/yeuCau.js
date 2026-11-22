// Logic nghiệp vụ của yêu cầu sửa chữa. Mọi chuyển trạng thái đi qua module này (BR-02, BR-03).
// Đợt 2: gửi yêu cầu (bước 1) và SV hủy yêu cầu (bước 2c). Các hành động của QL / KTV thêm ở đợt 3–4.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { layCsdl } = require('../db');
const { gioVN } = require('../lib/thoiGian');
const { TRANG_THAI_YEU_CAU } = require('../lib/hangSo');

const THU_MUC_ANH = path.join(__dirname, '..', 'uploads', 'yeu-cau');

// BR-12: JPG/PNG, ≤ 5 MB / ảnh, ≤ 3 ảnh
const ANH = { toiDa: 3, dungLuongToiDa: 5 * 1024 * 1024 };
const MO_TA = { min: 10, max: 1000 };
const MUC_DO_HOP_LE = ['KHAN_CAP', 'BINH_THUONG'];
const TRANG_THAI_KET_THUC = ['HOAN_THANH', 'TU_CHOI', 'DA_HUY'];

class LoiNghiepVu extends Error {
  constructor(thongDiep, { loaiLoi = 'nghiep-vu', truong = null, ma = 400 } = {}) {
    super(thongDiep);
    this.loaiLoi = loaiLoi;
    this.truong = truong;
    this.ma = ma;
  }
}

// Nhận diện định dạng thật của tệp theo byte đầu (không tin vào tên / mimetype do trình duyệt gửi).
function nhanDienAnh(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  return null;
}

// ---------------------------------------------------------------- Danh mục cho form S02
// Chỉ mục đang sử dụng (mục 6.1). Thiết bị đã thanh lý coi như ngừng sử dụng (mục 6.2).
function layDanhMucChoForm() {
  const db = layCsdl();
  const nha = db.prepare('SELECT id, ma_nha, ten_nha FROM toa_nha WHERE dang_su_dung = 1 ORDER BY ma_nha').all();
  const phong = db.prepare(`SELECT p.id, p.toa_nha_id, p.ma_phong, p.tang, p.loai_phong
                              FROM phong p JOIN toa_nha n ON n.id = p.toa_nha_id
                             WHERE p.dang_su_dung = 1 AND n.dang_su_dung = 1 ORDER BY p.ma_phong`).all();
  const thietBi = db.prepare(`SELECT t.id, t.phong_id, t.ma_tai_san, t.ten_thiet_bi, t.loai_thiet_bi_id
                                FROM thiet_bi t JOIN phong p ON p.id = t.phong_id
                               WHERE t.tinh_trang <> 'THANH_LY' AND p.dang_su_dung = 1 ORDER BY t.ma_tai_san`).all();
  const loai = db.prepare('SELECT id, ten_loai FROM loai_thiet_bi WHERE dang_su_dung = 1 ORDER BY id').all();
  return {
    nha: nha.map((n) => ({ id: n.id, ma: n.ma_nha, ten: n.ten_nha })),
    phong: phong.map((p) => ({ id: p.id, nhaId: p.toa_nha_id, ma: p.ma_phong, tang: p.tang, loai: p.loai_phong })),
    thietBi: thietBi.map((t) => ({ id: t.id, phongId: t.phong_id, ma: t.ma_tai_san, ten: t.ten_thiet_bi, loaiId: t.loai_thiet_bi_id })),
    loai: loai.map((l) => ({ id: l.id, ten: l.ten_loai })),
  };
}

// ---------------------------------------------------------------- Cảnh báo trùng (BR-09: chỉ cảnh báo)
// Thiết bị cụ thể: trùng nếu thiết bị đó đang có yêu cầu chưa kết thúc.
// "Không có trong danh sách": trùng nếu cùng phòng + cùng loại đang có yêu cầu chưa kết thúc.
function timYeuCauTrung({ thietBiId, phongId, loaiId }) {
  const db = layCsdl();
  const chuaXong = `trang_thai NOT IN (${TRANG_THAI_KET_THUC.map(() => '?').join(',')})`;
  let dong;
  if (thietBiId) {
    dong = db.prepare(`SELECT ma_yeu_cau, trang_thai FROM yeu_cau WHERE thiet_bi_id = ? AND ${chuaXong}
                       ORDER BY thoi_gian_gui DESC, id DESC LIMIT 1`).get(thietBiId, ...TRANG_THAI_KET_THUC);
  } else {
    dong = db.prepare(`SELECT ma_yeu_cau, trang_thai FROM yeu_cau WHERE phong_id = ? AND loai_thiet_bi_id = ? AND ${chuaXong}
                       ORDER BY thoi_gian_gui DESC, id DESC LIMIT 1`).get(phongId, loaiId, ...TRANG_THAI_KET_THUC);
  }
  if (!dong) return null;
  // SV chỉ thấy tên trạng thái dành cho SV (mục 5)
  return { ma: dong.ma_yeu_cau, trangThai: TRANG_THAI_YEU_CAU[dong.trang_thai].sv };
}

// ---------------------------------------------------------------- Kiểm tra dữ liệu gửi lên (S02)
// Trả về { loi: {tenTruong: thongDiep}, du: {...đã chuẩn hóa} }
function kiemTraYeuCauMoi(body, tepAnh) {
  const db = layCsdl();
  const loi = {};
  const TRONG = 'Mục này không được để trống';
  const so = (v) => (/^\d+$/.test(String(v || '').trim()) ? Number(v) : null);

  const nhaId = so(body.nha_id);
  const phongId = so(body.phong_id);
  const chonKhac = body.thiet_bi_id === 'KHAC';
  const thietBiId = chonKhac ? null : so(body.thiet_bi_id);
  let loaiId = so(body.loai_thiet_bi_id);
  const mucDo = String(body.muc_do || '');
  const moTa = String(body.mo_ta || '').trim();

  // Nhà
  let nha = null;
  if (!nhaId) loi.nha_id = TRONG;
  else {
    nha = db.prepare('SELECT id FROM toa_nha WHERE id = ? AND dang_su_dung = 1').get(nhaId);
    if (!nha) loi.nha_id = 'Nhà không hợp lệ hoặc đã ngừng sử dụng';
  }

  // Phòng (thuộc nhà đã chọn)
  let phong = null;
  if (!phongId) loi.phong_id = TRONG;
  else if (!loi.nha_id) {
    phong = db.prepare('SELECT id FROM phong WHERE id = ? AND toa_nha_id = ? AND dang_su_dung = 1').get(phongId, nhaId);
    if (!phong) loi.phong_id = 'Phòng không thuộc nhà đã chọn hoặc đã ngừng sử dụng';
  }

  // Thiết bị / loại thiết bị
  if (!chonKhac && !thietBiId) loi.thiet_bi_id = TRONG;
  else if (!chonKhac && phong) {
    const tb = db.prepare(`SELECT id, loai_thiet_bi_id FROM thiet_bi WHERE id = ? AND phong_id = ? AND tinh_trang <> 'THANH_LY'`)
      .get(thietBiId, phongId);
    if (!tb) loi.thiet_bi_id = 'Thiết bị không thuộc phòng đã chọn hoặc đã ngừng sử dụng';
    else loaiId = tb.loai_thiet_bi_id; // chọn thiết bị cụ thể: loại lấy từ thiết bị
  } else if (chonKhac) {
    if (!loaiId) loi.loai_thiet_bi_id = TRONG;
    else if (!db.prepare('SELECT 1 FROM loai_thiet_bi WHERE id = ? AND dang_su_dung = 1').get(loaiId)) {
      loi.loai_thiet_bi_id = 'Loại thiết bị không hợp lệ';
    }
  }

  // Mức độ
  if (!mucDo) loi.muc_do = TRONG;
  else if (!MUC_DO_HOP_LE.includes(mucDo)) loi.muc_do = 'Mức độ không hợp lệ';

  // Mô tả 10–1000 ký tự
  if (!moTa) loi.mo_ta = TRONG;
  else if (moTa.length < MO_TA.min) loi.mo_ta = `Mô tả cần từ ${MO_TA.min} đến ${MO_TA.max} ký tự (hiện có ${moTa.length})`;
  else if (moTa.length > MO_TA.max) loi.mo_ta = `Mô tả cần từ ${MO_TA.min} đến ${MO_TA.max} ký tự (hiện có ${moTa.length})`;

  // Ảnh: 1–3 tấm JPG/PNG ≤ 5 MB
  const anh = [];
  if (!tepAnh || tepAnh.length === 0) loi.anh = TRONG;
  else if (tepAnh.length > ANH.toiDa) loi.anh = `Chỉ được đính kèm tối đa ${ANH.toiDa} ảnh`;
  else {
    for (const t of tepAnh) {
      if (t.size > ANH.dungLuongToiDa) { loi.anh = `Ảnh "${t.originalname}" lớn hơn 5 MB`; break; }
      const dinhDang = nhanDienAnh(t.buffer);
      if (!dinhDang) { loi.anh = `Ảnh "${t.originalname}" không phải JPG hoặc PNG`; break; }
      anh.push({ buffer: t.buffer, duoi: dinhDang });
    }
  }

  return { loi, du: { phongId, thietBiId, loaiId, mucDo, moTa, anh } };
}

// ---------------------------------------------------------------- Bước 1: SV gửi yêu cầu
// Sinh mã YC-năm-số (đánh số lại từ 1 mỗi năm), ghi lịch sử, lưu ảnh – trong một transaction.
function taoYeuCau(sinhVien, du) {
  const db = layCsdl();
  const bayGio = gioVN();
  const nam = bayGio.slice(0, 4);
  const daGhi = [];

  const thucHien = db.transaction(() => {
    const dong = db.prepare(`SELECT MAX(CAST(SUBSTR(ma_yeu_cau, 9) AS INTEGER)) AS lon_nhat FROM yeu_cau WHERE ma_yeu_cau LIKE ?`)
      .get(`YC-${nam}-%`);
    const ma = `YC-${nam}-${String((dong.lon_nhat || 0) + 1).padStart(4, '0')}`;

    const id = db.prepare(`INSERT INTO yeu_cau (ma_yeu_cau, sinh_vien_id, phong_id, thiet_bi_id, loai_thiet_bi_id, muc_do, mo_ta,
                             trang_thai, thoi_gian_gui, thoi_gian_cap_nhat)
                           VALUES (?, ?, ?, ?, ?, ?, ?, 'MOI', ?, ?)`)
      .run(ma, sinhVien.id, du.phongId, du.thietBiId, du.loaiId, du.mucDo, du.moTa, bayGio, bayGio).lastInsertRowid;

    db.prepare(`INSERT INTO lich_su_xu_ly (yeu_cau_id, nguoi_thuc_hien_id, tu_trang_thai, den_trang_thai, noi_dung, thoi_gian)
                VALUES (?, ?, NULL, 'MOI', 'Gửi yêu cầu', ?)`).run(id, sinhVien.id, bayGio);

    fs.mkdirSync(THU_MUC_ANH, { recursive: true });
    const themAnh = db.prepare(`INSERT INTO anh_dinh_kem (yeu_cau_id, duong_dan, loai_anh, nguoi_tai_id) VALUES (?, ?, 'TRUOC', ?)`);
    for (const a of du.anh) {
      const ten = `${crypto.randomUUID()}.${a.duoi}`; // BR-12: đổi tên tệp để tránh trùng
      fs.writeFileSync(path.join(THU_MUC_ANH, ten), a.buffer);
      daGhi.push(path.join(THU_MUC_ANH, ten));
      themAnh.run(id, `/uploads/yeu-cau/${ten}`, sinhVien.id);
    }
    return { id, ma };
  });

  try {
    return thucHien();
  } catch (e) {
    for (const f of daGhi) fs.rmSync(f, { force: true }); // transaction hoàn tác thì xóa ảnh đã ghi
    throw e;
  }
}

// ---------------------------------------------------------------- Bước 2c: SV hủy (MOI -> DA_HUY)
function huyYeuCau(sinhVien, yeuCauId) {
  const db = layCsdl();
  return db.transaction(() => {
    const yc = db.prepare('SELECT id, ma_yeu_cau, sinh_vien_id, trang_thai FROM yeu_cau WHERE id = ?').get(yeuCauId);
    if (!yc || yc.sinh_vien_id !== sinhVien.id) throw new LoiNghiepVu('Không tìm thấy yêu cầu.', { ma: 404 }); // BR-04
    if (yc.trang_thai !== 'MOI') {
      throw new LoiNghiepVu('Chỉ hủy được yêu cầu khi còn ở trạng thái "Đã gửi".', { ma: 409 }); // bảng 5.1
    }
    const bayGio = gioVN();
    db.prepare(`UPDATE yeu_cau SET trang_thai = 'DA_HUY', thoi_gian_cap_nhat = ? WHERE id = ? AND trang_thai = 'MOI'`).run(bayGio, yc.id);
    db.prepare(`INSERT INTO lich_su_xu_ly (yeu_cau_id, nguoi_thuc_hien_id, tu_trang_thai, den_trang_thai, noi_dung, thoi_gian)
                VALUES (?, ?, 'MOI', 'DA_HUY', 'Sinh viên hủy yêu cầu', ?)`).run(yc.id, sinhVien.id, bayGio);
    return { id: yc.id, ma: yc.ma_yeu_cau };
  })();
}

module.exports = {
  LoiNghiepVu, ANH, MO_TA, TRANG_THAI_KET_THUC,
  layDanhMucChoForm, timYeuCauTrung, kiemTraYeuCauMoi, taoYeuCau, huyYeuCau,
};
