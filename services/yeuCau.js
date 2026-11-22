// Logic nghiệp vụ của yêu cầu sửa chữa. MỌI chuyển trạng thái đi qua module này (BR-02, BR-03):
// bảng BANG_CHUYEN bên dưới chép đúng bảng 5.1 của SPEC; hàm thucHienHanhDong() là lối vào duy nhất.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { layCsdl } = require('../db');
const { gioVN, dinhDang, tuONhapGio, hanKiemTraMacDinh } = require('../lib/thoiGian');
const { TRANG_THAI_YEU_CAU, PHUONG_AN, KET_QUA_KIEM_TRA, TINH_TRANG_THIET_BI } = require('../lib/hangSo');

const THU_MUC_ANH = path.join(__dirname, '..', 'uploads', 'yeu-cau');

// BR-12: JPG/PNG, ≤ 5 MB / ảnh, ≤ 3 ảnh
const ANH = { toiDa: 3, dungLuongToiDa: 5 * 1024 * 1024 };
const MO_TA = { min: 10, max: 1000 };
const MUC_DO_HOP_LE = ['KHAN_CAP', 'BINH_THUONG'];
const TRANG_THAI_KET_THUC = ['HOAN_THANH', 'TU_CHOI', 'DA_HUY'];

// ma: 403 sai vai trò · 404 không thấy / không phải của mình (BR-04) · 409 sai trạng thái · 422 thiếu / sai dữ liệu.
// loi: { tenTruong: thongDiep } khi ma = 422.
class LoiNghiepVu extends Error {
  constructor(thongDiep, { loaiLoi = 'nghiep-vu', truong = null, ma = 400, loi = null } = {}) {
    super(thongDiep);
    this.loaiLoi = loaiLoi;
    this.truong = truong;
    this.ma = ma;
    this.loi = loi;
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
  const anh = chuanHoaAnh(loi, 'anh', tepAnh, { batBuoc: true });

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


// ================================================================ Chuyển trạng thái – bảng 5.1
// Mỗi dòng của BANG_CHUYEN là một dòng của bảng 5.1:
//   tu / den      trạng thái trước / sau
//   vaiTro        ai được làm (kèm điều kiện sở hữu ở coQuyenVoiYeuCau – BR-04)
//   dieuKien      điều kiện thêm trên yêu cầu (BR-14)
//   kiemTra       kiểm tra + chuẩn hóa các trường bắt buộc, ném LoiNghiepVu 422 kèm lỗi theo từng trường
//   thucHien      ghi CSDL (trong transaction chung), trả về nội dung lịch sử và các cột yeu_cau cần cập nhật
// Mọi chuyển trạng thái không có trong bảng đều bị từ chối (mục 5.1, BR-03).

const LY_DO_TOI_THIEU = 5; // BR-05
const DO_DAI_TOI_DA = 1000;
const TRANG_THAI_DANG_LAM = ['DA_PHAN_CONG', 'DANG_SUA']; // "việc đang làm" (7.1) và quá hạn (BR-08)
const TINH_TRANG_SAU_CUNG = ['HOAT_DONG', 'THANH_LY']; // mục 6.3, đóng yêu cầu ở trạng thái Chuyển xử lý
const TRONG = 'Mục này không được để trống';

const chuoi = (v) => (v == null ? '' : String(v)).trim();
const soNguyenDuong = (v) => (/^\d+$/.test(chuoi(v)) && Number(chuoi(v)) > 0 ? Number(chuoi(v)) : null);

function baoLoiTruong(loi) {
  if (Object.keys(loi).length) {
    throw new LoiNghiepVu('Vui lòng kiểm tra lại các mục được đánh dấu.', { ma: 422, loi, truong: Object.keys(loi)[0] });
  }
}

function kiemTraDoDai(loi, truong, giaTri, toiDa = DO_DAI_TOI_DA) {
  if (giaTri.length > toiDa) loi[truong] = `Tối đa ${toiDa} ký tự (hiện có ${giaTri.length})`;
}

// BR-05: lý do bắt buộc, ≥ 5 ký tự
function kiemTraLyDo(loi, truong, giaTri) {
  if (!giaTri) loi[truong] = TRONG;
  else if (giaTri.length < LY_DO_TOI_THIEU) loi[truong] = `Lý do cần ít nhất ${LY_DO_TOI_THIEU} ký tự`;
  else kiemTraDoDai(loi, truong, giaTri);
}

// BR-06: chỉ chọn KTV đang hoạt động
function layKtvHoatDong(db, id) {
  return id ? db.prepare(`SELECT id, ho_ten FROM nguoi_dung WHERE id = ? AND vai_tro = 'KY_THUAT_VIEN' AND trang_thai = 'HOAT_DONG'`).get(id) : null;
}

// BR-06: hạn không được trước thời điểm giao. Không nhập -> dùng hạn mặc định nếu cho phép.
function kiemTraHan(loi, truong, giaTri, ctx, { batBuoc }) {
  const g = chuoi(giaTri);
  if (!g) {
    if (batBuoc) loi[truong] = TRONG;
    return hanKiemTraMacDinh(ctx.bayGio, ctx.yc.muc_do);
  }
  const han = tuONhapGio(g);
  if (!han) loi[truong] = 'Thời gian không hợp lệ';
  else if (han.slice(0, 16) < ctx.bayGio.slice(0, 16)) loi[truong] = 'Hạn kiểm tra không được trước thời điểm giao';
  return han;
}

// Phân công đang hiệu lực của yêu cầu (BR-07: tối đa 1)
function phanCongHienTai(db, yeuCauId) {
  return db.prepare(`SELECT pc.*, u.ho_ten AS ten_ktv FROM phan_cong pc JOIN nguoi_dung u ON u.id = pc.ktv_id
                      WHERE pc.yeu_cau_id = ? AND pc.con_hieu_luc = 1`).get(yeuCauId) || null;
}

// BR-07: vô hiệu bản ghi cũ trước rồi mới tạo bản ghi mới, trong cùng transaction của hành động.
function giaoViec(ctx, ktvId, han, ghiChu) {
  ctx.db.prepare('UPDATE phan_cong SET con_hieu_luc = 0 WHERE yeu_cau_id = ? AND con_hieu_luc = 1').run(ctx.yc.id);
  ctx.db.prepare(`INSERT INTO phan_cong (yeu_cau_id, ktv_id, nguoi_giao_id, thoi_gian_giao, han_hoan_thanh, ghi_chu_giao_viec, con_hieu_luc)
                  VALUES (?, ?, ?, ?, ?, ?, 1)`).run(ctx.yc.id, ktvId, ctx.nd.id, ctx.bayGio, han, ghiChu || null);
}

// Mục 6.3 / BR-11: chỉ khi yêu cầu gắn thiết bị cụ thể
function datTinhTrangThietBi(ctx, tinhTrang) {
  if (ctx.yc.thiet_bi_id) ctx.db.prepare('UPDATE thiet_bi SET tinh_trang = ? WHERE id = ?').run(tinhTrang, ctx.yc.thiet_bi_id);
}

// Ảnh JPG/PNG ≤ 5 MB, ≤ 3 tấm (BR-12). Trả về [{buffer, duoi}] hoặc ghi lỗi vào loi[truong].
function chuanHoaAnh(loi, truong, tepAnh, { batBuoc }) {
  const anh = [];
  if (!tepAnh || tepAnh.length === 0) { if (batBuoc) loi[truong] = TRONG; return anh; }
  if (tepAnh.length > ANH.toiDa) { loi[truong] = `Chỉ được đính kèm tối đa ${ANH.toiDa} ảnh`; return anh; }
  for (const t of tepAnh) {
    if (t.size > ANH.dungLuongToiDa) { loi[truong] = `Ảnh "${t.originalname}" lớn hơn 5 MB`; break; }
    const dinhDang = nhanDienAnh(t.buffer);
    if (!dinhDang) { loi[truong] = `Ảnh "${t.originalname}" không phải JPG hoặc PNG`; break; }
    anh.push({ buffer: t.buffer, duoi: dinhDang });
  }
  return anh;
}

function luuAnh(ctx, dsAnh, loaiAnh) {
  if (!dsAnh.length) return;
  fs.mkdirSync(THU_MUC_ANH, { recursive: true });
  const them = ctx.db.prepare('INSERT INTO anh_dinh_kem (yeu_cau_id, duong_dan, loai_anh, nguoi_tai_id) VALUES (?, ?, ?, ?)');
  for (const a of dsAnh) {
    const ten = `${crypto.randomUUID()}.${a.duoi}`;
    fs.writeFileSync(path.join(THU_MUC_ANH, ten), a.buffer);
    ctx.daGhi.push(path.join(THU_MUC_ANH, ten));
    them.run(ctx.yc.id, `/uploads/yeu-cau/${ten}`, loaiAnh, ctx.nd.id);
  }
}

const noiCau = (...phan) => phan.filter(Boolean).join('. ');

const BANG_CHUYEN = {
  // MOI -> DA_PHAN_CONG · QL · KTV; hạn kiểm tra
  phanCong: {
    tu: 'MOI', den: 'DA_PHAN_CONG', vaiTro: 'QUAN_LY', ten: 'Tiếp nhận & phân công',
    kiemTra(d, ctx) {
      const loi = {};
      const ktv = layKtvHoatDong(ctx.db, soNguyenDuong(d.ktv_id));
      if (!chuoi(d.ktv_id)) loi.ktv_id = TRONG;
      else if (!ktv) loi.ktv_id = 'Kỹ thuật viên không tồn tại hoặc đã bị khóa';
      const han = kiemTraHan(loi, 'han', d.han, ctx, { batBuoc: true });
      const ghiChuGiaoViec = chuoi(d.ghi_chu_giao_viec);
      const ghiChuSv = chuoi(d.ghi_chu_sv);
      kiemTraDoDai(loi, 'ghi_chu_giao_viec', ghiChuGiaoViec);
      kiemTraDoDai(loi, 'ghi_chu_sv', ghiChuSv);
      baoLoiTruong(loi);
      return { ktv, han, ghiChuGiaoViec, ghiChuSv };
    },
    thucHien(ctx, du) {
      giaoViec(ctx, du.ktv.id, du.han, du.ghiChuGiaoViec);
      return {
        noiDung: noiCau(`Tiếp nhận & phân công cho ${du.ktv.ho_ten}`, `Hạn kiểm tra: ${dinhDang(du.han)}`,
          du.ghiChuGiaoViec && `Ghi chú giao việc: ${du.ghiChuGiaoViec}`),
        cot: { nguoi_tiep_nhan_id: ctx.nd.id, thoi_gian_tiep_nhan: ctx.bayGio, ...(du.ghiChuSv ? { ghi_chu_ql: du.ghiChuSv } : {}) },
      };
    },
  },

  // MOI -> TU_CHOI · QL · lý do từ chối
  tuChoi: {
    tu: 'MOI', den: 'TU_CHOI', vaiTro: 'QUAN_LY', ten: 'Từ chối',
    kiemTra(d) {
      const loi = {};
      const lyDo = chuoi(d.ly_do);
      kiemTraLyDo(loi, 'ly_do', lyDo);
      baoLoiTruong(loi);
      return { lyDo };
    },
    thucHien(ctx, du) {
      return { noiDung: `Từ chối: ${du.lyDo}`, cot: { ly_do_tu_choi: du.lyDo } };
    },
  },

  // MOI -> DA_HUY · SV chủ yêu cầu · –
  huy: {
    tu: 'MOI', den: 'DA_HUY', vaiTro: 'SINH_VIEN', ten: 'Hủy yêu cầu',
    thucHien() { return { noiDung: 'Sinh viên hủy yêu cầu' }; },
  },

  // DA_PHAN_CONG -> DA_PHAN_CONG · QL · KTV mới
  doiKtv: {
    tu: 'DA_PHAN_CONG', den: 'DA_PHAN_CONG', vaiTro: 'QUAN_LY', ten: 'Đổi KTV',
    kiemTra(d, ctx) {
      const loi = {};
      const ktv = layKtvHoatDong(ctx.db, soNguyenDuong(d.ktv_id));
      if (!chuoi(d.ktv_id)) loi.ktv_id = TRONG;
      else if (!ktv) loi.ktv_id = 'Kỹ thuật viên không tồn tại hoặc đã bị khóa';
      else if (ctx.pc && ctx.pc.ktv_id === ktv.id) loi.ktv_id = 'Hãy chọn kỹ thuật viên khác người đang được giao';
      const han = kiemTraHan(loi, 'han', d.han, ctx, { batBuoc: false });
      const ghiChuGiaoViec = chuoi(d.ghi_chu_giao_viec);
      kiemTraDoDai(loi, 'ghi_chu_giao_viec', ghiChuGiaoViec);
      baoLoiTruong(loi);
      return { ktv, han, ghiChuGiaoViec };
    },
    thucHien(ctx, du) {
      const cu = ctx.pc ? ctx.pc.ten_ktv : '–';
      giaoViec(ctx, du.ktv.id, du.han, du.ghiChuGiaoViec);
      return { noiDung: noiCau(`Đổi KTV ${cu} → ${du.ktv.ho_ten}`, `Hạn kiểm tra: ${dinhDang(du.han)}`, du.ghiChuGiaoViec) };
    },
  },

  // DA_PHAN_CONG -> DANG_SUA · KTV được giao · –
  batDau: {
    tu: 'DA_PHAN_CONG', den: 'DANG_SUA', vaiTro: 'KY_THUAT_VIEN', ten: 'Bắt đầu kiểm tra',
    thucHien(ctx) {
      datTinhTrangThietBi(ctx, 'DANG_SUA'); // 6.3: chuyển sang Đang xử lý -> thiết bị Đang sửa
      return { noiDung: 'Bắt đầu kiểm tra' };
    },
  },

  // DANG_SUA -> CHO_NGHIEM_THU · KTV được giao · kết quả; tại chỗ: ≥1 dòng nội dung; không: tình trạng, nguyên nhân, ≥1 biện pháp
  baoKetQua: {
    tu: 'DANG_SUA', den: 'CHO_NGHIEM_THU', vaiTro: 'KY_THUAT_VIEN', ten: 'Báo kết quả',
    kiemTra(d) {
      const loi = {};
      const ketQua = chuoi(d.ket_qua);
      if (!ketQua) loi.ket_qua = TRONG;
      else if (!KET_QUA_KIEM_TRA[ketQua]) loi.ket_qua = 'Kết quả không hợp lệ';
      const du = { ketQua };
      if (ketQua === 'KHAC_PHUC_TAI_CHO') {
        du.dong = [];
        (Array.isArray(d.dong) ? d.dong : []).forEach((r, i) => {
          const noiDung = chuoi(r && r.noi_dung);
          const slChuoi = chuoi(r && r.so_luong);
          const ghiChu = chuoi(r && r.ghi_chu);
          if (!noiDung && !slChuoi && !ghiChu) return; // dòng trống bỏ qua
          if (!noiDung) loi[`dong.${i}.noi_dung`] = TRONG;
          const soLuong = slChuoi ? soNguyenDuong(slChuoi) : null;
          if (slChuoi && !soLuong) loi[`dong.${i}.so_luong`] = 'Số lượng phải là số nguyên dương';
          du.dong.push({ noiDung, soLuong, ghiChu });
        });
        if (!du.dong.length) loi.dong = 'Cần ít nhất 1 dòng nội dung sửa chữa';
        du.anh = chuanHoaAnh(loi, 'anh', d.anh, { batBuoc: false });
      } else if (ketQua === 'KHONG_KHAC_PHUC') {
        du.tinhTrang = chuoi(d.tinh_trang_su_co);
        du.nguyenNhan = chuoi(d.nguyen_nhan);
        if (!du.tinhTrang) loi.tinh_trang_su_co = TRONG; else kiemTraDoDai(loi, 'tinh_trang_su_co', du.tinhTrang);
        if (!du.nguyenNhan) loi.nguyen_nhan = TRONG; else kiemTraDoDai(loi, 'nguyen_nhan', du.nguyenNhan);
        // Biện pháp đề nghị: null = không chọn; chọn mà không ghi chi tiết thì lưu "Có đề nghị"
        const deXuat = d.de_xuat || {};
        const bp = (k) => (deXuat[k] == null || deXuat[k] === false ? null : (chuoi(deXuat[k] === true ? '' : deXuat[k]) || 'Có đề nghị'));
        du.muaVatTu = bp('mua_vat_tu');
        du.thueSua = bp('thue_sua');
        du.thanhLy = bp('thanh_ly');
        if (!du.muaVatTu && !du.thueSua && !du.thanhLy) loi.de_xuat = 'Chọn ít nhất 1 biện pháp đề nghị';
        du.conBaoHanh = d.con_bao_hanh === true || d.con_bao_hanh === '1' || d.con_bao_hanh === 1 ? 1 : 0;
      }
      baoLoiTruong(loi);
      return du;
    },
    thucHien(ctx, du) {
      if (du.ketQua === 'KHAC_PHUC_TAI_CHO') {
        ctx.db.prepare('DELETE FROM noi_dung_sua_chua WHERE yeu_cau_id = ?').run(ctx.yc.id);
        const them = ctx.db.prepare('INSERT INTO noi_dung_sua_chua (yeu_cau_id, stt, noi_dung, so_luong, ghi_chu) VALUES (?, ?, ?, ?, ?)');
        du.dong.forEach((r, i) => them.run(ctx.yc.id, i + 1, r.noiDung, r.soLuong, r.ghiChu || null));
        luuAnh(ctx, du.anh, 'SAU');
        return { noiDung: 'Báo kết quả: Đã khắc phục tại chỗ', cot: { ket_qua_kiem_tra: du.ketQua } };
      }
      ctx.db.prepare('UPDATE bien_ban_kiem_tra SET con_hieu_luc = 0 WHERE yeu_cau_id = ? AND con_hieu_luc = 1').run(ctx.yc.id);
      ctx.db.prepare(`INSERT INTO bien_ban_kiem_tra (yeu_cau_id, ktv_id, thoi_gian, tinh_trang_su_co, nguyen_nhan,
                        de_xuat_mua_vat_tu, de_xuat_thue_sua, de_xuat_thanh_ly, con_bao_hanh, con_hieu_luc)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
        .run(ctx.yc.id, ctx.nd.id, ctx.bayGio, du.tinhTrang, du.nguyenNhan, du.muaVatTu, du.thueSua, du.thanhLy, du.conBaoHanh);
      return { noiDung: 'Báo kết quả: Không khắc phục tại chỗ – đã lập biên bản kiểm tra kỹ thuật', cot: { ket_qua_kiem_tra: du.ketQua } };
    },
  },

  // CHO_NGHIEM_THU -> HOAN_THANH · QL · chỉ khi kết quả = khắc phục tại chỗ (BR-14)
  nghiemThu: {
    tu: 'CHO_NGHIEM_THU', den: 'HOAN_THANH', vaiTro: 'QUAN_LY', ten: 'Nghiệm thu đạt',
    dieuKien: (yc) => yc.ket_qua_kiem_tra === 'KHAC_PHUC_TAI_CHO',
    loiDieuKien: 'Chỉ nghiệm thu đạt khi kết quả là "Đã khắc phục tại chỗ" (BR-14).',
    thucHien(ctx) {
      datTinhTrangThietBi(ctx, 'HOAT_DONG'); // 6.3: hoàn thành sau khắc phục tại chỗ -> Hoạt động
      return { noiDung: 'Nghiệm thu đạt', cot: { thoi_gian_hoan_thanh: ctx.bayGio } };
    },
  },

  // CHO_NGHIEM_THU -> CHUYEN_XU_LY · QL · chỉ khi kết quả = không khắc phục; phương án
  chuyenPhuongAn: {
    tu: 'CHO_NGHIEM_THU', den: 'CHUYEN_XU_LY', vaiTro: 'QUAN_LY', ten: 'Duyệt biên bản & chuyển phương án',
    dieuKien: (yc) => yc.ket_qua_kiem_tra === 'KHONG_KHAC_PHUC',
    loiDieuKien: 'Chỉ duyệt biên bản & chuyển phương án khi kết quả là "Không khắc phục tại chỗ" (BR-14).',
    kiemTra(d) {
      const loi = {};
      const phuongAn = chuoi(d.phuong_an);
      if (!phuongAn) loi.phuong_an = TRONG;
      else if (!PHUONG_AN[phuongAn]) loi.phuong_an = 'Phương án không hợp lệ';
      const soToTrinh = chuoi(d.so_to_trinh);
      kiemTraDoDai(loi, 'so_to_trinh', soToTrinh, 100);
      baoLoiTruong(loi);
      return { phuongAn, soToTrinh };
    },
    thucHien(ctx, du) {
      datTinhTrangThietBi(ctx, 'CHO_THAY_THE'); // 6.3: chuyển xử lý theo phương án -> Hỏng – chờ thay thế
      return {
        noiDung: noiCau(`Duyệt biên bản & chuyển phương án: ${PHUONG_AN[du.phuongAn]}`, du.soToTrinh && `Số tờ trình: ${du.soToTrinh}`),
        cot: { phuong_an: du.phuongAn, so_to_trinh: du.soToTrinh || null },
      };
    },
  },

  // CHO_NGHIEM_THU -> DA_PHAN_CONG · QL · lý do; KTV (mặc định KTV cũ)
  lamLai: {
    tu: 'CHO_NGHIEM_THU', den: 'DA_PHAN_CONG', vaiTro: 'QUAN_LY', ten: 'Yêu cầu làm lại',
    kiemTra(d, ctx) {
      const loi = {};
      const lyDo = chuoi(d.ly_do);
      kiemTraLyDo(loi, 'ly_do', lyDo);
      let ktv = null;
      if (chuoi(d.ktv_id)) {
        ktv = layKtvHoatDong(ctx.db, soNguyenDuong(d.ktv_id));
        if (!ktv) loi.ktv_id = 'Kỹ thuật viên không tồn tại hoặc đã bị khóa';
      } else {
        ktv = ctx.pc ? layKtvHoatDong(ctx.db, ctx.pc.ktv_id) : null; // mặc định KTV cũ
        if (!ktv) loi.ktv_id = 'KTV cũ không còn hoạt động, hãy chọn KTV khác';
      }
      const han = kiemTraHan(loi, 'han', d.han, ctx, { batBuoc: false });
      baoLoiTruong(loi);
      return { lyDo, ktv, han };
    },
    thucHien(ctx, du) {
      giaoViec(ctx, du.ktv.id, du.han, `Làm lại: ${du.lyDo}`);
      // Kết quả lần trước không còn hiệu lực: xóa nội dung sửa chữa (mục 10), vô hiệu biên bản
      ctx.db.prepare('DELETE FROM noi_dung_sua_chua WHERE yeu_cau_id = ?').run(ctx.yc.id);
      ctx.db.prepare('UPDATE bien_ban_kiem_tra SET con_hieu_luc = 0 WHERE yeu_cau_id = ? AND con_hieu_luc = 1').run(ctx.yc.id);
      return {
        noiDung: noiCau(`Yêu cầu làm lại: ${du.lyDo}`, `Giao lại cho ${du.ktv.ho_ten}`, `Hạn kiểm tra: ${dinhDang(du.han)}`),
        cot: { ket_qua_kiem_tra: null },
      };
    },
  },

  // CHUYEN_XU_LY -> HOAN_THANH · QL · kết quả xử lý; tình trạng thiết bị sau cùng
  dong: {
    tu: 'CHUYEN_XU_LY', den: 'HOAN_THANH', vaiTro: 'QUAN_LY', ten: 'Đóng yêu cầu',
    kiemTra(d, ctx) {
      const loi = {};
      const ketQua = chuoi(d.ket_qua_cuoi);
      if (!ketQua) loi.ket_qua_cuoi = TRONG; else kiemTraDoDai(loi, 'ket_qua_cuoi', ketQua);
      const soBienBan = chuoi(d.so_bien_ban_ban_giao);
      kiemTraDoDai(loi, 'so_bien_ban_ban_giao', soBienBan, 100);
      const tinhTrang = chuoi(d.tinh_trang_thiet_bi);
      if (ctx.yc.thiet_bi_id) { // chỉ bắt buộc khi yêu cầu gắn thiết bị cụ thể
        if (!tinhTrang) loi.tinh_trang_thiet_bi = TRONG;
        else if (!TINH_TRANG_SAU_CUNG.includes(tinhTrang)) loi.tinh_trang_thiet_bi = 'Tình trạng thiết bị không hợp lệ';
      }
      baoLoiTruong(loi);
      return { ketQua, soBienBan, tinhTrang };
    },
    thucHien(ctx, du) {
      if (ctx.yc.thiet_bi_id) datTinhTrangThietBi(ctx, du.tinhTrang); // 6.3: QL chọn Hoạt động / Đã thanh lý
      return {
        noiDung: noiCau(`Đóng yêu cầu: ${du.ketQua}`, du.soBienBan && `Biên bản M.10 số ${du.soBienBan}`,
          ctx.yc.thiet_bi_id && `Thiết bị: ${TINH_TRANG_THIET_BI[du.tinhTrang]}`),
        cot: { ket_qua_cuoi: du.ketQua, so_bien_ban_ban_giao: du.soBienBan || null, thoi_gian_hoan_thanh: ctx.bayGio },
      };
    },
  },
};

// BR-04: SV chỉ thao tác yêu cầu của mình; KTV chỉ thao tác việc có phân công đang hiệu lực của mình.
function coQuyenVoiYeuCau(nguoiDung, yc, pc) {
  if (nguoiDung.vai_tro === 'QUAN_LY') return true;
  if (nguoiDung.vai_tro === 'SINH_VIEN') return yc.sinh_vien_id === nguoiDung.id;
  if (nguoiDung.vai_tro === 'KY_THUAT_VIEN') return !!pc && pc.ktv_id === nguoiDung.id;
  return false;
}

// Danh sách hành động người dùng được làm với yêu cầu ở trạng thái hiện tại (giao diện dùng để ẩn / hiện nút).
function cacHanhDongHopLe(nguoiDung, yc, pc = phanCongHienTai(layCsdl(), yc.id)) {
  if (!nguoiDung || !yc || !coQuyenVoiYeuCau(nguoiDung, yc, pc)) return [];
  return Object.keys(BANG_CHUYEN).filter((k) => {
    const b = BANG_CHUYEN[k];
    return b.vaiTro === nguoiDung.vai_tro && b.tu === yc.trang_thai && (!b.dieuKien || b.dieuKien(yc));
  });
}

// Lối vào duy nhất cho mọi chuyển trạng thái. Kiểm tra theo thứ tự: hành động có trong bảng 5.1 → vai trò →
// quyền với yêu cầu (BR-04) → trạng thái hiện tại → điều kiện (BR-14) → trường bắt buộc; rồi ghi CSDL,
// cập nhật thoi_gian_cap_nhat và thêm 1 dòng lich_su_xu_ly – tất cả trong một transaction.
function thucHienHanhDong(nguoiDung, yeuCauId, hanhDong, duLieu = {}) {
  const buoc = Object.prototype.hasOwnProperty.call(BANG_CHUYEN, hanhDong) ? BANG_CHUYEN[hanhDong] : null;
  if (!buoc) throw new LoiNghiepVu('Hành động không hợp lệ.', { ma: 400 });
  if (!nguoiDung || nguoiDung.vai_tro !== buoc.vaiTro) {
    throw new LoiNghiepVu(`Bạn không có quyền thực hiện "${buoc.ten}".`, { ma: 403 });
  }
  const db = layCsdl();
  const daGhi = [];

  const chay = db.transaction(() => {
    const yc = db.prepare('SELECT * FROM yeu_cau WHERE id = ?').get(yeuCauId);
    const pc = yc ? phanCongHienTai(db, yc.id) : null;
    if (!yc || !coQuyenVoiYeuCau(nguoiDung, yc, pc)) throw new LoiNghiepVu('Không tìm thấy yêu cầu.', { ma: 404 });
    if (yc.trang_thai !== buoc.tu) {
      throw new LoiNghiepVu(`Không thể "${buoc.ten}" khi yêu cầu ${yc.ma_yeu_cau} đang ở trạng thái "${TRANG_THAI_YEU_CAU[yc.trang_thai].ql}".`, { ma: 409 });
    }
    if (buoc.dieuKien && !buoc.dieuKien(yc)) throw new LoiNghiepVu(buoc.loiDieuKien, { ma: 409 });

    const ctx = { db, nd: nguoiDung, yc, pc, bayGio: gioVN(), daGhi };
    const du = buoc.kiemTra ? buoc.kiemTra(duLieu || {}, ctx) : {};
    const { noiDung, cot = {} } = buoc.thucHien(ctx, du);

    const tenCot = Object.keys(cot);
    const kq = db.prepare(`UPDATE yeu_cau SET trang_thai = ?, thoi_gian_cap_nhat = ?${tenCot.map((c) => `, ${c} = ?`).join('')}
                            WHERE id = ? AND trang_thai = ?`)
      .run(buoc.den, ctx.bayGio, ...tenCot.map((c) => cot[c]), yc.id, buoc.tu);
    if (kq.changes !== 1) throw new LoiNghiepVu('Yêu cầu vừa được người khác cập nhật, vui lòng tải lại trang.', { ma: 409 });

    db.prepare(`INSERT INTO lich_su_xu_ly (yeu_cau_id, nguoi_thuc_hien_id, tu_trang_thai, den_trang_thai, noi_dung, thoi_gian)
                VALUES (?, ?, ?, ?, ?, ?)`).run(yc.id, nguoiDung.id, buoc.tu, buoc.den, noiDung, ctx.bayGio);
    return { id: yc.id, ma: yc.ma_yeu_cau, tu: buoc.tu, den: buoc.den };
  });

  try {
    return chay();
  } catch (e) {
    for (const f of daGhi) fs.rmSync(f, { force: true }); // transaction hoàn tác thì xóa ảnh đã ghi
    throw e;
  }
}

// Bước 2c: SV hủy (giữ tên hàm cũ cho routes/sinhVien.js)
function huyYeuCau(sinhVien, yeuCauId) {
  return thucHienHanhDong(sinhVien, yeuCauId, 'huy');
}

// Q02 – trạng thái Đang xử lý: QL cập nhật "Ghi chú cho SV". Không đổi trạng thái nhưng vẫn ghi lịch sử để truy vết.
const TRANG_THAI_SUA_GHI_CHU_SV = ['DANG_SUA'];
function capNhatGhiChuSv(nguoiDung, yeuCauId, ghiChu) {
  if (!nguoiDung || nguoiDung.vai_tro !== 'QUAN_LY') throw new LoiNghiepVu('Bạn không có quyền cập nhật ghi chú.', { ma: 403 });
  const db = layCsdl();
  return db.transaction(() => {
    const yc = db.prepare('SELECT id, ma_yeu_cau, trang_thai FROM yeu_cau WHERE id = ?').get(yeuCauId);
    if (!yc) throw new LoiNghiepVu('Không tìm thấy yêu cầu.', { ma: 404 });
    if (!TRANG_THAI_SUA_GHI_CHU_SV.includes(yc.trang_thai)) {
      throw new LoiNghiepVu('Chỉ cập nhật ghi chú cho SV khi yêu cầu đang xử lý.', { ma: 409 });
    }
    const loi = {};
    const g = chuoi(ghiChu);
    if (!g) loi.ghi_chu_sv = TRONG; else kiemTraDoDai(loi, 'ghi_chu_sv', g);
    baoLoiTruong(loi);
    const bayGio = gioVN();
    db.prepare('UPDATE yeu_cau SET ghi_chu_ql = ?, thoi_gian_cap_nhat = ? WHERE id = ?').run(g, bayGio, yc.id);
    db.prepare(`INSERT INTO lich_su_xu_ly (yeu_cau_id, nguoi_thuc_hien_id, tu_trang_thai, den_trang_thai, noi_dung, thoi_gian)
                VALUES (?, ?, ?, ?, ?, ?)`).run(yc.id, nguoiDung.id, yc.trang_thai, yc.trang_thai, `Cập nhật ghi chú cho SV: ${g}`, bayGio);
    return { id: yc.id, ma: yc.ma_yeu_cau };
  })();
}

// ================================================================ Gợi ý KTV khi phân công (mục 7.3)
// KTV đang hoạt động; người phụ trách nhà của phòng trong yêu cầu lên trước, trong nhóm ai ít việc đang làm hơn xếp trước;
// sau đó đến các KTV còn lại (cũng theo số việc đang làm). Bằng nhau thì theo thứ tự tài khoản (id).
function goiYKtv(yeuCauId) {
  const db = layCsdl();
  const yc = db.prepare(`SELECT p.toa_nha_id, n.ma_nha FROM yeu_cau y JOIN phong p ON p.id = y.phong_id
                           JOIN toa_nha n ON n.id = p.toa_nha_id WHERE y.id = ?`).get(yeuCauId);
  if (!yc) return [];
  const khuVuc = db.prepare(`SELECT k.ktv_id, n.ma_nha FROM khu_vuc_phu_trach k JOIN toa_nha n ON n.id = k.toa_nha_id
                              ORDER BY n.id`).all();
  const ds = db.prepare(`
    SELECT u.id, u.ho_ten,
           (SELECT COUNT(*) FROM phan_cong pc JOIN yeu_cau y ON y.id = pc.yeu_cau_id
             WHERE pc.ktv_id = u.id AND pc.con_hieu_luc = 1
               AND y.trang_thai IN (${TRANG_THAI_DANG_LAM.map(() => '?').join(',')})) AS dang_lam
      FROM nguoi_dung u
     WHERE u.vai_tro = 'KY_THUAT_VIEN' AND u.trang_thai = 'HOAT_DONG'`).all(...TRANG_THAI_DANG_LAM)
    .map((k) => {
      const nha = khuVuc.filter((x) => x.ktv_id === k.id).map((x) => x.ma_nha);
      return { id: k.id, hoTen: k.ho_ten, dangLam: k.dang_lam, nha, phuTrach: nha.includes(yc.ma_nha) };
    })
    .sort((a, b) => (b.phuTrach - a.phuTrach) || (a.dangLam - b.dangLam) || (a.id - b.id));
  return ds.map((k, i) => ({
    ...k,
    goiY: i === 0 && k.phuTrach,
    moTa: `${k.nha.length ? `Phụ trách ${k.nha.join(', ')}` : 'Chưa được giao khu vực'} · đang làm ${k.dangLam} việc`,
  }));
}

module.exports = {
  LoiNghiepVu, ANH, MO_TA, TRANG_THAI_KET_THUC, TRANG_THAI_DANG_LAM, TINH_TRANG_SAU_CUNG, LY_DO_TOI_THIEU,
  BANG_CHUYEN, TRANG_THAI_SUA_GHI_CHU_SV,
  layDanhMucChoForm, timYeuCauTrung, kiemTraYeuCauMoi, taoYeuCau, huyYeuCau,
  thucHienHanhDong, cacHanhDongHopLe, phanCongHienTai, capNhatGhiChuSv, goiYKtv,
};
