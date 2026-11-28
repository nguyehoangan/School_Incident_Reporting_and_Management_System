// Trang của Kỹ thuật viên: K01 Việc được giao, K02 Chi tiết công việc (SPEC mục 8).
// Quyền và chuyển trạng thái do services/yeuCau.js kiểm tra (BR-02, BR-04); file này chỉ nhận form và hiển thị.
const express = require('express');
const multer = require('multer');
const { chiVaiTro } = require('../middleware/auth');
const { TRANG_THAI_YEU_CAU, MUC_DO, KET_QUA_KIEM_TRA, TINH_TRANG_THIET_BI, PHUONG_AN } = require('../lib/hangSo');
const yeuCau = require('../services/yeuCau');
const tv = require('../services/truyVanKtv');

const router = express.Router();
router.use(chiVaiTro('KY_THUAT_VIEN'));

const LOP_TRANG = 'nen-xam';
const soId = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);

// Ảnh sau sửa: giữ trong bộ nhớ, services/yeuCau.js kiểm tra định dạng / dung lượng / số lượng (BR-12) rồi mới ghi.
// Giới hạn số trường đủ cho bảng nhiều dòng (mỗi dòng 3 trường).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: yeuCau.ANH.dungLuongToiDa + 1, files: yeuCau.ANH.toiDa + 1, fields: 200, parts: 210 },
}).array('anh');

function trangKhongThay(res) {
  return res.status(404).render('loi', { tieuDe: 'Không tìm thấy công việc', thongDiep: 'Công việc không tồn tại hoặc không được giao cho bạn.' });
}

// ---------------------------------------------------------------- K01
router.get('/viec', (req, res) => {
  const khoa = Object.prototype.hasOwnProperty.call(tv.TAB, req.query.tab) ? req.query.tab : tv.TAB_MAC_DINH;
  res.render('ktv/viec', {
    tieuDe: 'Việc được giao',
    lopTrang: LOP_TRANG,
    tab: tv.TAB,
    khoa,
    dem: tv.demTheoTab(req.nguoiDung.id),
    nhom: tv.danhSachViec(req.nguoiDung.id, khoa),
    khuVuc: tv.khuVucPhuTrach(req.nguoiDung.id),
  });
});

// ---------------------------------------------------------------- K02
router.get('/viec/:id', (req, res) => {
  const id = soId(req.params.id);
  const ct = id && tv.chiTietViec(req.nguoiDung.id, id);
  if (!ct) return trangKhongThay(res); // BR-04
  const { yc, pc } = ct;

  const flash = req.session.flashK02 && req.session.flashK02.id === yc.id ? req.session.flashK02 : null;
  delete req.session.flashK02;

  const hanhDong = yeuCau.cacHanhDongHopLe(req.nguoiDung, yc, pc);
  // Dòng nội dung sửa chữa: giữ lại những gì KTV đã nhập khi server báo lỗi, nếu không thì 1 dòng trống
  const dongNhap = flash && flash.duLieu && flash.duLieu.dong.length ? flash.duLieu.dong : [{ noi_dung: '', so_luong: '', ghi_chu: '' }];

  res.render('ktv/chi-tiet', {
    tieuDe: `Công việc ${yc.ma_yeu_cau}`,
    lopTrang: LOP_TRANG,
    ...ct,
    trangThai: TRANG_THAI_YEU_CAU[yc.trang_thai],
    mucDo: MUC_DO,
    ketQuaKiemTra: KET_QUA_KIEM_TRA,
    tinhTrangTB: TINH_TRANG_THIET_BI,
    phuongAn: PHUONG_AN,
    hanhDong,
    dongNhap,
    gioiHan: { anhToiDa: yeuCau.ANH.toiDa, dungLuongToiDa: yeuCau.ANH.dungLuongToiDa },
    flash,
  });
});

// Chuẩn hóa dữ liệu form để lưu vào phiên khi báo lỗi (chỉ chuỗi, cắt độ dài)
const chuoi = (v) => String(v == null ? '' : v).slice(0, 1000);
function giuLaiForm(body) {
  const dong = Array.isArray(body.dong) ? Array.from(body.dong, (r) => ({
    noi_dung: chuoi(r && r.noi_dung), so_luong: chuoi(r && r.so_luong), ghi_chu: chuoi(r && r.ghi_chu),
  })) : [];
  return { dong: dong.slice(0, 50) };
}

function baoLoi(req, res, id, e, duLieu = null) {
  req.session.flashK02 = { id, loai: 'loi', noiDung: e.message, loiTruong: e.loi || {}, duLieu };
  res.redirect(`/ky-thuat-vien/viec/${id}#xu-ly`);
}

function xuLyLoi(req, res, next, id, e, duLieu) {
  if (!(e instanceof yeuCau.LoiNghiepVu)) return next(e);
  if (e.ma === 404) return trangKhongThay(res);
  baoLoi(req, res, id, e, e.ma === 422 ? duLieu : null);
}

router.post('/viec/:id/bat-dau', (req, res, next) => {
  const id = soId(req.params.id);
  if (!id) return trangKhongThay(res);
  try {
    const kq = yeuCau.thucHienHanhDong(req.nguoiDung, id, 'batDau');
    req.session.flashK02 = { id: kq.id, loai: 'ok', noiDung: `Đã bắt đầu kiểm tra ${kq.ma}.` };
    res.redirect(`/ky-thuat-vien/viec/${kq.id}#xu-ly`);
  } catch (e) {
    xuLyLoi(req, res, next, id, e);
  }
});

router.post('/viec/:id/bao-ket-qua', (req, res, next) => {
  const id = soId(req.params.id);
  if (!id) return trangKhongThay(res);
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const thongDiep = err.code === 'LIMIT_FILE_SIZE' ? 'Mỗi ảnh phải nhỏ hơn hoặc bằng 5 MB'
        : (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') ? `Chỉ được đính kèm tối đa ${yeuCau.ANH.toiDa} ảnh`
        : 'Không đọc được dữ liệu gửi lên';
      return baoLoi(req, res, id, new yeuCau.LoiNghiepVu('Vui lòng kiểm tra lại các mục được đánh dấu.', { ma: 422, loi: { anh: thongDiep } }), giuLaiForm(req.body || {}));
    }
    if (err) return next(err);

    const body = req.body || {};
    try {
      const kq = yeuCau.thucHienHanhDong(req.nguoiDung, id, 'baoKetQua', { ...body, anh: req.files || [] });
      req.session.flashK02 = { id: kq.id, loai: 'ok', noiDung: `Đã gửi kết quả ${kq.ma}, chờ quản lý nghiệm thu.` };
      res.redirect(`/ky-thuat-vien/viec/${kq.id}#xu-ly`);
    } catch (e) {
      if (e instanceof yeuCau.LoiNghiepVu && e.ma === 422 && req.files && req.files.length) {
        e.message += ' Ảnh sau sửa cần được chọn lại.'; // trình duyệt không giữ lại tệp đã chọn sau khi tải lại trang
      }
      xuLyLoi(req, res, next, id, e, giuLaiForm(body));
    }
  });
});

module.exports = router;
