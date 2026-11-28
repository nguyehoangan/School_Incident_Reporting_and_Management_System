// Ghi danh mục CSVC (SPEC mục 6): nhà, phòng, loại thiết bị, thiết bị – thêm / sửa / ngừng sử dụng / mở lại / xóa.
// Mọi kiểm tra (quyền QL, trùng mã, ràng buộc BR-10, ngừng theo cấp mục 6.1) làm ở đây; route chỉ nhận form và hiển thị.
// Truy vấn chỉ đọc cho màn hình Q04 nằm ở services/truyVanDanhMuc.js.
//
// Lỗi ném ra là LoiNghiepVu (services/yeuCau.js): 403 sai vai trò · 404 không thấy · 409 vi phạm quy tắc ·
// 422 dữ liệu form sai (kèm e.loi = { tenOForm: thongDiep } để hiện ngay dưới ô).
const { layCsdl } = require('../db');
const { gioVN } = require('../lib/thoiGian');
const { TINH_TRANG_THIET_BI } = require('../lib/hangSo');
const { LoiNghiepVu } = require('./yeuCau');

const TRONG = 'Mục này không được để trống';
const MA_NHA = /^[A-Z0-9]{1,10}$/;
const MA_PHONG = /^[A-Z0-9][A-Z0-9._-]{0,19}$/;
const MA_TAI_SAN = /^[A-Z0-9][A-Z0-9._-]{0,29}$/;
const NAM_THAP_NHAT = 1970;

// ---------------------------------------------------------------- Tiện ích
function chiQuanLy(nguoiDung) {
  if (!nguoiDung || nguoiDung.vai_tro !== 'QUAN_LY') {
    throw new LoiNghiepVu('Chỉ Quản lý được thay đổi danh mục.', { ma: 403, loaiLoi: 'quyen' });
  }
}
const loiDuLieu = (loi) => new LoiNghiepVu('Dữ liệu chưa hợp lệ, vui lòng kiểm tra lại.', { ma: 422, loaiLoi: 'du-lieu', loi });
const quyTac = (thongDiep) => new LoiNghiepVu(thongDiep, { ma: 409, loaiLoi: 'quy-tac' });
const khongThay = (ten) => new LoiNghiepVu(`${ten} không tồn tại.`, { ma: 404, loaiLoi: 'khong-thay' });

// Gọn khoảng trắng đầu / cuối và khoảng trắng liên tiếp
const chuoi = (v) => String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim();
const chuanTen = (s) => chuoi(s).normalize('NFC').toLocaleLowerCase('vi');
const dem = (sql, ...ts) => layCsdl().prepare(sql).get(...ts).n;

// Trùng khóa duy nhất lọt qua bước kiểm tra trước (hai người thêm cùng lúc) vẫn báo đúng ô
function ghiDuyNhat(thucHien, truong, thongDiep) {
  try {
    return thucHien();
  } catch (e) {
    if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') throw loiDuLieu({ [truong]: thongDiep });
    throw e;
  }
}

function ngayHopLe(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

// ---------------------------------------------------------------- Số yêu cầu tham chiếu (BR-10)
const soYeuCauCuaNha = (id) => dem('SELECT COUNT(*) n FROM yeu_cau y JOIN phong p ON p.id = y.phong_id WHERE p.toa_nha_id = ?', id);
const soYeuCauCuaPhong = (id) => dem('SELECT COUNT(*) n FROM yeu_cau WHERE phong_id = ?', id);
const soYeuCauCuaLoai = (id) => dem('SELECT COUNT(*) n FROM yeu_cau WHERE loai_thiet_bi_id = ?', id);
const soYeuCauCuaThietBi = (id) => dem('SELECT COUNT(*) n FROM yeu_cau WHERE thiet_bi_id = ?', id);

const loiDaThamChieu = (ten, n, cachNgung = 'Ngừng sử dụng') =>
  quyTac(`Không xóa được ${ten}: đã có ${n} yêu cầu tham chiếu (BR-10). Chỉ có thể "${cachNgung}" để giữ lịch sử.`);

// ================================================================ NHÀ
const layNha = (id) => layCsdl().prepare('SELECT * FROM toa_nha WHERE id = ?').get(id) || (() => { throw khongThay('Nhà'); })();

function kiemTraNha(body, idDangSua = null) {
  const db = layCsdl();
  const loi = {};
  const ma = chuoi(body.ma_nha).toUpperCase();
  const ten = chuoi(body.ten_nha);
  if (!ma) loi.ma_nha = TRONG;
  else if (!MA_NHA.test(ma)) loi.ma_nha = 'Mã nhà chỉ gồm chữ và số, không dấu cách, tối đa 10 ký tự (ví dụ D8)';
  else if (db.prepare('SELECT 1 FROM toa_nha WHERE ma_nha = ? AND id <> ?').get(ma, idDangSua || 0)) loi.ma_nha = `Mã nhà ${ma} đã tồn tại`;
  if (!ten) loi.ten_nha = TRONG;
  else if (ten.length > 100) loi.ten_nha = 'Tên nhà tối đa 100 ký tự';
  if (Object.keys(loi).length) throw loiDuLieu(loi);
  return { ma, ten };
}

function themNha(nguoiDung, body) {
  chiQuanLy(nguoiDung);
  const { ma, ten } = kiemTraNha(body || {});
  const id = ghiDuyNhat(() => layCsdl().prepare('INSERT INTO toa_nha (ma_nha, ten_nha, dang_su_dung) VALUES (?, ?, 1)').run(ma, ten).lastInsertRowid,
    'ma_nha', `Mã nhà ${ma} đã tồn tại`);
  return { id: Number(id), nhan: ma };
}

function suaNha(nguoiDung, id, body) {
  chiQuanLy(nguoiDung);
  const nha = layNha(id);
  const { ma, ten } = kiemTraNha(body || {}, nha.id);
  ghiDuyNhat(() => layCsdl().prepare('UPDATE toa_nha SET ma_nha = ?, ten_nha = ? WHERE id = ?').run(ma, ten, nha.id),
    'ma_nha', `Mã nhà ${ma} đã tồn tại`);
  return { id: nha.id, nhan: ma };
}

// Mục 6.1: không ngừng nhà khi còn phòng đang sử dụng (phải ngừng phòng trước)
function ngungNha(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const nha = layNha(id);
  if (!nha.dang_su_dung) throw quyTac(`Nhà ${nha.ma_nha} đã ngừng sử dụng.`);
  const n = dem('SELECT COUNT(*) n FROM phong WHERE toa_nha_id = ? AND dang_su_dung = 1', nha.id);
  if (n) throw quyTac(`Không ngừng được nhà ${nha.ma_nha}: còn ${n} phòng đang sử dụng. Hãy ngừng sử dụng các phòng trước.`);
  layCsdl().prepare('UPDATE toa_nha SET dang_su_dung = 0 WHERE id = ?').run(nha.id);
  return { id: nha.id, nhan: nha.ma_nha };
}

function moLaiNha(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const nha = layNha(id);
  if (nha.dang_su_dung) throw quyTac(`Nhà ${nha.ma_nha} đang sử dụng.`);
  layCsdl().prepare('UPDATE toa_nha SET dang_su_dung = 1 WHERE id = ?').run(nha.id);
  return { id: nha.id, nhan: nha.ma_nha };
}

// Xóa hẳn chỉ khi chưa từng được dùng: không yêu cầu nào tham chiếu và không còn phòng nào (BR-10)
function xoaNha(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const db = layCsdl();
  const nha = layNha(id);
  const yc = soYeuCauCuaNha(nha.id);
  if (yc) throw loiDaThamChieu(`nhà ${nha.ma_nha}`, yc);
  const phong = dem('SELECT COUNT(*) n FROM phong WHERE toa_nha_id = ?', nha.id);
  if (phong) throw quyTac(`Không xóa được nhà ${nha.ma_nha}: còn ${phong} phòng thuộc nhà này. Hãy xóa các phòng trước.`);
  db.transaction(() => {
    db.prepare('DELETE FROM khu_vuc_phu_trach WHERE toa_nha_id = ?').run(nha.id); // cấu hình gợi ý, không phải lịch sử
    db.prepare('DELETE FROM toa_nha WHERE id = ?').run(nha.id);
  })();
  return { id: nha.id, nhan: nha.ma_nha };
}

// ================================================================ PHÒNG
function layPhong(id) {
  const p = layCsdl().prepare(`SELECT p.*, n.ma_nha, n.dang_su_dung AS nha_dang_su_dung FROM phong p JOIN toa_nha n ON n.id = p.toa_nha_id WHERE p.id = ?`).get(id);
  if (!p) throw khongThay('Phòng');
  return p;
}

// phongCu: khi sửa (nhà không đổi được vì yêu cầu cũ tham chiếu phòng)
function kiemTraPhong(body, phongCu = null) {
  const db = layCsdl();
  const loi = {};
  let nha = null;
  if (phongCu) nha = db.prepare('SELECT * FROM toa_nha WHERE id = ?').get(phongCu.toa_nha_id);
  else {
    const nhaId = /^\d+$/.test(chuoi(body.nha_id)) ? Number(chuoi(body.nha_id)) : null;
    if (!nhaId) loi.nha_id = TRONG;
    else {
      nha = db.prepare('SELECT * FROM toa_nha WHERE id = ?').get(nhaId);
      if (!nha) loi.nha_id = 'Nhà không tồn tại';
      else if (!nha.dang_su_dung) loi.nha_id = `Nhà ${nha.ma_nha} đã ngừng sử dụng, không thêm phòng vào được`;
    }
  }

  let ma = chuoi(body.ma_phong).toUpperCase();
  if (nha && ma.startsWith(`${nha.ma_nha}-`)) ma = ma.slice(nha.ma_nha.length + 1); // gõ "D8-101" vẫn lưu "101"
  if (!ma) loi.ma_phong = TRONG;
  else if (!MA_PHONG.test(ma)) loi.ma_phong = 'Mã phòng chỉ gồm chữ, số, dấu - . _ (ví dụ 101), tối đa 20 ký tự';
  else if (nha && db.prepare('SELECT 1 FROM phong WHERE toa_nha_id = ? AND ma_phong = ? AND id <> ?').get(nha.id, ma, phongCu ? phongCu.id : 0)) {
    loi.ma_phong = `Phòng ${nha.ma_nha}-${ma} đã tồn tại trong nhà ${nha.ma_nha}`;
  }

  let tang = null;
  const tangVao = chuoi(body.tang);
  if (tangVao) {
    if (!/^\d{1,2}$/.test(tangVao)) loi.tang = 'Tầng phải là số nguyên từ 0 đến 99';
    else tang = Number(tangVao);
  }
  const loaiPhong = chuoi(body.loai_phong) || null;
  if (loaiPhong && loaiPhong.length > 50) loi.loai_phong = 'Loại phòng tối đa 50 ký tự';

  if (Object.keys(loi).length) throw loiDuLieu(loi);
  return { nha, ma, tang, loaiPhong };
}

function themPhong(nguoiDung, body) {
  chiQuanLy(nguoiDung);
  const { nha, ma, tang, loaiPhong } = kiemTraPhong(body || {});
  const id = ghiDuyNhat(() => layCsdl().prepare('INSERT INTO phong (toa_nha_id, ma_phong, tang, loai_phong, dang_su_dung) VALUES (?, ?, ?, ?, 1)')
    .run(nha.id, ma, tang, loaiPhong).lastInsertRowid, 'ma_phong', `Phòng ${nha.ma_nha}-${ma} đã tồn tại trong nhà ${nha.ma_nha}`);
  return { id: Number(id), nhan: `${nha.ma_nha}-${ma}` };
}

function suaPhong(nguoiDung, id, body) {
  chiQuanLy(nguoiDung);
  const phong = layPhong(id);
  const { nha, ma, tang, loaiPhong } = kiemTraPhong(body || {}, phong);
  ghiDuyNhat(() => layCsdl().prepare('UPDATE phong SET ma_phong = ?, tang = ?, loai_phong = ? WHERE id = ?').run(ma, tang, loaiPhong, phong.id),
    'ma_phong', `Phòng ${nha.ma_nha}-${ma} đã tồn tại trong nhà ${nha.ma_nha}`);
  return { id: phong.id, nhan: `${nha.ma_nha}-${ma}` };
}

// Mục 6.1: không ngừng phòng khi còn thiết bị chưa thanh lý
function ngungPhong(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const phong = layPhong(id);
  const ten = `${phong.ma_nha}-${phong.ma_phong}`;
  if (!phong.dang_su_dung) throw quyTac(`Phòng ${ten} đã ngừng sử dụng.`);
  const n = dem(`SELECT COUNT(*) n FROM thiet_bi WHERE phong_id = ? AND tinh_trang <> 'THANH_LY'`, phong.id);
  if (n) throw quyTac(`Không ngừng được phòng ${ten}: còn ${n} thiết bị chưa thanh lý. Hãy ngừng sử dụng (thanh lý) các thiết bị trước.`);
  layCsdl().prepare('UPDATE phong SET dang_su_dung = 0 WHERE id = ?').run(phong.id);
  return { id: phong.id, nhan: ten };
}

function moLaiPhong(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const phong = layPhong(id);
  const ten = `${phong.ma_nha}-${phong.ma_phong}`;
  if (phong.dang_su_dung) throw quyTac(`Phòng ${ten} đang sử dụng.`);
  if (!phong.nha_dang_su_dung) throw quyTac(`Không mở lại được phòng ${ten}: nhà ${phong.ma_nha} đang ngừng sử dụng. Hãy mở lại nhà trước.`);
  layCsdl().prepare('UPDATE phong SET dang_su_dung = 1 WHERE id = ?').run(phong.id);
  return { id: phong.id, nhan: ten };
}

function xoaPhong(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const phong = layPhong(id);
  const ten = `${phong.ma_nha}-${phong.ma_phong}`;
  const yc = soYeuCauCuaPhong(phong.id);
  if (yc) throw loiDaThamChieu(`phòng ${ten}`, yc);
  const tb = dem('SELECT COUNT(*) n FROM thiet_bi WHERE phong_id = ?', phong.id);
  if (tb) throw quyTac(`Không xóa được phòng ${ten}: còn ${tb} thiết bị đặt trong phòng. Hãy xóa các thiết bị trước.`);
  layCsdl().prepare('DELETE FROM phong WHERE id = ?').run(phong.id);
  return { id: phong.id, nhan: ten };
}

// ================================================================ LOẠI THIẾT BỊ
const layLoai = (id) => layCsdl().prepare('SELECT * FROM loai_thiet_bi WHERE id = ?').get(id) || (() => { throw khongThay('Loại thiết bị'); })();

function kiemTraLoai(body, idDangSua = null) {
  const loi = {};
  const ten = chuoi(body.ten_loai);
  if (!ten) loi.ten_loai = TRONG;
  else if (ten.length > 50) loi.ten_loai = 'Tên loại tối đa 50 ký tự';
  else {
    // SQLite chỉ so sánh không phân biệt hoa thường với chữ không dấu nên so ở đây: "máy chiếu" = "Máy chiếu"
    const trung = layCsdl().prepare('SELECT id, ten_loai FROM loai_thiet_bi').all()
      .find((l) => l.id !== idDangSua && chuanTen(l.ten_loai) === chuanTen(ten));
    if (trung) loi.ten_loai = `Loại "${trung.ten_loai}" đã tồn tại`;
  }
  if (Object.keys(loi).length) throw loiDuLieu(loi);
  return { ten };
}

function themLoai(nguoiDung, body) {
  chiQuanLy(nguoiDung);
  const { ten } = kiemTraLoai(body || {});
  const id = ghiDuyNhat(() => layCsdl().prepare('INSERT INTO loai_thiet_bi (ten_loai, dang_su_dung) VALUES (?, 1)').run(ten).lastInsertRowid,
    'ten_loai', `Loại "${ten}" đã tồn tại`);
  return { id: Number(id), nhan: ten };
}

function suaLoai(nguoiDung, id, body) {
  chiQuanLy(nguoiDung);
  const loai = layLoai(id);
  const { ten } = kiemTraLoai(body || {}, loai.id);
  ghiDuyNhat(() => layCsdl().prepare('UPDATE loai_thiet_bi SET ten_loai = ? WHERE id = ?').run(ten, loai.id),
    'ten_loai', `Loại "${ten}" đã tồn tại`);
  return { id: loai.id, nhan: ten };
}

function ngungLoai(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const loai = layLoai(id);
  if (!loai.dang_su_dung) throw quyTac(`Loại "${loai.ten_loai}" đã ngừng sử dụng.`);
  layCsdl().prepare('UPDATE loai_thiet_bi SET dang_su_dung = 0 WHERE id = ?').run(loai.id);
  return { id: loai.id, nhan: loai.ten_loai };
}

function moLaiLoai(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const loai = layLoai(id);
  if (loai.dang_su_dung) throw quyTac(`Loại "${loai.ten_loai}" đang sử dụng.`);
  layCsdl().prepare('UPDATE loai_thiet_bi SET dang_su_dung = 1 WHERE id = ?').run(loai.id);
  return { id: loai.id, nhan: loai.ten_loai };
}

function xoaLoai(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const loai = layLoai(id);
  const yc = soYeuCauCuaLoai(loai.id);
  if (yc) throw loiDaThamChieu(`loại "${loai.ten_loai}"`, yc);
  const tb = dem('SELECT COUNT(*) n FROM thiet_bi WHERE loai_thiet_bi_id = ?', loai.id);
  if (tb) throw quyTac(`Không xóa được loại "${loai.ten_loai}": còn ${tb} thiết bị thuộc loại này.`);
  layCsdl().prepare('DELETE FROM loai_thiet_bi WHERE id = ?').run(loai.id);
  return { id: loai.id, nhan: loai.ten_loai };
}

// ================================================================ THIẾT BỊ
// "Ngừng sử dụng" của thiết bị = tình trạng Đã thanh lý (mục 6.2: thanh lý coi như ngừng sử dụng).
function layThietBi(id) {
  const t = layCsdl().prepare(`SELECT t.*, p.ma_phong, p.dang_su_dung AS phong_dang_su_dung, n.ma_nha
                                 FROM thiet_bi t JOIN phong p ON p.id = t.phong_id JOIN toa_nha n ON n.id = p.toa_nha_id WHERE t.id = ?`).get(id);
  if (!t) throw khongThay('Thiết bị');
  return t;
}

function kiemTraThietBi(body, tbCu = null) {
  const db = layCsdl();
  const loi = {};
  const so = (v) => (/^\d+$/.test(chuoi(v)) ? Number(chuoi(v)) : null);

  const ma = chuoi(body.ma_tai_san).toUpperCase();
  if (!ma) loi.ma_tai_san = TRONG;
  else if (!MA_TAI_SAN.test(ma)) loi.ma_tai_san = 'Mã tài sản chỉ gồm chữ, số, dấu - . _ (ví dụ MC-D8101-01), tối đa 30 ký tự';
  else if (db.prepare('SELECT 1 FROM thiet_bi WHERE ma_tai_san = ? AND id <> ?').get(ma, tbCu ? tbCu.id : 0)) loi.ma_tai_san = `Mã tài sản ${ma} đã tồn tại`;

  const ten = chuoi(body.ten_thiet_bi);
  if (!ten) loi.ten_thiet_bi = TRONG;
  else if (ten.length > 100) loi.ten_thiet_bi = 'Tên thiết bị tối đa 100 ký tự';

  // Loại / phòng phải đang sử dụng khi chọn mới; giữ nguyên giá trị cũ thì không bắt buộc
  const loaiId = so(body.loai_thiet_bi_id);
  if (!loaiId) loi.loai_thiet_bi_id = TRONG;
  else {
    const l = db.prepare('SELECT * FROM loai_thiet_bi WHERE id = ?').get(loaiId);
    if (!l) loi.loai_thiet_bi_id = 'Loại thiết bị không tồn tại';
    else if (!l.dang_su_dung && !(tbCu && tbCu.loai_thiet_bi_id === l.id)) loi.loai_thiet_bi_id = `Loại "${l.ten_loai}" đã ngừng sử dụng`;
  }

  const phongId = so(body.phong_id);
  let phong = null;
  if (!phongId) loi.phong_id = TRONG;
  else {
    phong = db.prepare('SELECT p.*, n.ma_nha FROM phong p JOIN toa_nha n ON n.id = p.toa_nha_id WHERE p.id = ?').get(phongId);
    if (!phong) loi.phong_id = 'Phòng không tồn tại';
    else if (!phong.dang_su_dung && !(tbCu && tbCu.phong_id === phong.id)) loi.phong_id = `Phòng ${phong.ma_nha}-${phong.ma_phong} đã ngừng sử dụng`;
  }

  const modelHang = chuoi(body.model_hang) || null;
  if (modelHang && modelHang.length > 100) loi.model_hang = 'Model – hãng tối đa 100 ký tự';
  const nguon = chuoi(body.nguon_kinh_phi) || null;
  if (nguon && nguon.length > 100) loi.nguon_kinh_phi = 'Nguồn kinh phí tối đa 100 ký tự';

  let nam = null;
  const namVao = chuoi(body.nam_su_dung);
  const namNay = Number(gioVN().slice(0, 4));
  if (namVao) {
    if (!/^\d{4}$/.test(namVao) || Number(namVao) < NAM_THAP_NHAT || Number(namVao) > namNay) loi.nam_su_dung = `Năm sử dụng phải từ ${NAM_THAP_NHAT} đến ${namNay}`;
    else nam = Number(namVao);
  }

  const hanBH = chuoi(body.han_bao_hanh) || null;
  if (hanBH && !ngayHopLe(hanBH)) loi.han_bao_hanh = 'Hạn bảo hành phải là ngày hợp lệ (dd/mm/yyyy)';

  let tinhTrang = chuoi(body.tinh_trang) || (tbCu ? tbCu.tinh_trang : 'HOAT_DONG');
  if (!TINH_TRANG_THIET_BI[tinhTrang]) loi.tinh_trang = 'Tình trạng không hợp lệ';
  else if (tinhTrang !== 'THANH_LY' && phong && !phong.dang_su_dung) {
    loi.tinh_trang = `Phòng ${phong.ma_nha}-${phong.ma_phong} đang ngừng sử dụng, chỉ để được tình trạng Đã thanh lý`;
  }

  if (Object.keys(loi).length) throw loiDuLieu(loi);
  return { ma, ten, loaiId, phongId, phong, modelHang, nam, nguon, hanBH, tinhTrang };
}

function themThietBi(nguoiDung, body) {
  chiQuanLy(nguoiDung);
  const d = kiemTraThietBi(body || {});
  const id = ghiDuyNhat(() => layCsdl().prepare(`INSERT INTO thiet_bi (ma_tai_san, ten_thiet_bi, loai_thiet_bi_id, phong_id, model_hang, nam_su_dung,
                                                    nguon_kinh_phi, han_bao_hanh, tinh_trang) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(d.ma, d.ten, d.loaiId, d.phongId, d.modelHang, d.nam, d.nguon, d.hanBH, d.tinhTrang).lastInsertRowid,
  'ma_tai_san', `Mã tài sản ${d.ma} đã tồn tại`);
  return { id: Number(id), nhan: d.ma };
}

// Sửa cả tình trạng: QL được sửa tay (mục 6.3, đoạn cuối), ví dụ khi đã thay thiết bị mới
function suaThietBi(nguoiDung, id, body) {
  chiQuanLy(nguoiDung);
  const tb = layThietBi(id);
  const d = kiemTraThietBi(body || {}, tb);
  ghiDuyNhat(() => layCsdl().prepare(`UPDATE thiet_bi SET ma_tai_san = ?, ten_thiet_bi = ?, loai_thiet_bi_id = ?, phong_id = ?, model_hang = ?,
                                         nam_su_dung = ?, nguon_kinh_phi = ?, han_bao_hanh = ?, tinh_trang = ? WHERE id = ?`)
    .run(d.ma, d.ten, d.loaiId, d.phongId, d.modelHang, d.nam, d.nguon, d.hanBH, d.tinhTrang, tb.id),
  'ma_tai_san', `Mã tài sản ${d.ma} đã tồn tại`);
  return { id: tb.id, nhan: d.ma };
}

function ngungThietBi(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const tb = layThietBi(id);
  if (tb.tinh_trang === 'THANH_LY') throw quyTac(`Thiết bị ${tb.ma_tai_san} đã ngừng sử dụng (đã thanh lý).`);
  layCsdl().prepare(`UPDATE thiet_bi SET tinh_trang = 'THANH_LY' WHERE id = ?`).run(tb.id);
  return { id: tb.id, nhan: tb.ma_tai_san };
}

function moLaiThietBi(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const tb = layThietBi(id);
  if (tb.tinh_trang !== 'THANH_LY') throw quyTac(`Thiết bị ${tb.ma_tai_san} đang sử dụng.`);
  if (!tb.phong_dang_su_dung) throw quyTac(`Không mở lại được thiết bị ${tb.ma_tai_san}: phòng ${tb.ma_nha}-${tb.ma_phong} đang ngừng sử dụng. Hãy mở lại phòng trước.`);
  layCsdl().prepare(`UPDATE thiet_bi SET tinh_trang = 'HOAT_DONG' WHERE id = ?`).run(tb.id);
  return { id: tb.id, nhan: tb.ma_tai_san };
}

function xoaThietBi(nguoiDung, id) {
  chiQuanLy(nguoiDung);
  const tb = layThietBi(id);
  const yc = soYeuCauCuaThietBi(tb.id);
  if (yc) throw loiDaThamChieu(`thiết bị ${tb.ma_tai_san}`, yc, 'Ngừng sử dụng (thanh lý)');
  layCsdl().prepare('DELETE FROM thiet_bi WHERE id = ?').run(tb.id);
  return { id: tb.id, nhan: tb.ma_tai_san };
}

// ================================================================ Lối vào theo tên mục (dùng cho route)
const MUC = {
  nha: { ten: 'nhà', them: themNha, sua: suaNha, ngung: ngungNha, moLai: moLaiNha, xoa: xoaNha },
  phong: { ten: 'phòng', them: themPhong, sua: suaPhong, ngung: ngungPhong, moLai: moLaiPhong, xoa: xoaPhong },
  loai: { ten: 'loại thiết bị', them: themLoai, sua: suaLoai, ngung: ngungLoai, moLai: moLaiLoai, xoa: xoaLoai },
  thietBi: { ten: 'thiết bị', them: themThietBi, sua: suaThietBi, ngung: ngungThietBi, moLai: moLaiThietBi, xoa: xoaThietBi },
};

module.exports = {
  MUC,
  themNha, suaNha, ngungNha, moLaiNha, xoaNha,
  themPhong, suaPhong, ngungPhong, moLaiPhong, xoaPhong,
  themLoai, suaLoai, ngungLoai, moLaiLoai, xoaLoai,
  themThietBi, suaThietBi, ngungThietBi, moLaiThietBi, xoaThietBi,
  soYeuCauCuaNha, soYeuCauCuaPhong, soYeuCauCuaLoai, soYeuCauCuaThietBi,
};
