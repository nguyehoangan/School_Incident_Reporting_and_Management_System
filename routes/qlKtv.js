// Q05 Quản lý KTV (QL): danh sách, thêm, sửa, khóa / mở khóa (SPEC mục 8).
// Route chỉ nhận form và hiển thị; kiểm tra và ghi dữ liệu ở services/nhanSu.js. Gắn tại /quan-ly/ky-thuat-vien.
const express = require('express');
const { soId, mot } = require('../lib/truyVan');
const { datFlash, layFlash } = require('../lib/flash');
const nhanSu = require('../services/nhanSu');
const tv = require('../services/truyVanPhanCong');
const { LoiNghiepVu } = require('../services/yeuCau');

const router = express.Router();
const GOC = '/quan-ly/ky-thuat-vien';
const KHOA_FLASH = 'flashQ05';

function hien(res, req, { form = null, ma = 200, flash = null } = {}) {
  res.status(ma).render('ql/ktv', {
    tieuDe: 'Quản lý kỹ thuật viên', lopTrang: 'nen-xam', dsKtv: tv.danhSachKtv(), form, flash,
    matKhauToiThieu: nhanSu.MAT_KHAU_TOI_THIEU,
  });
}

router.get('/', (req, res) => {
  let form = null;
  if (mot(req.query.them) === '1') form = { id: null, giaTri: {}, loi: {} };
  else if (soId(req.query.sua)) {
    const k = tv.layKtv(soId(req.query.sua));
    if (k) form = { id: k.id, email: k.email, giaTri: { ho_ten: k.ho_ten, so_dien_thoai: k.so_dien_thoai || '' }, loi: {} };
  }
  hien(res, req, { form, flash: layFlash(req, KHOA_FLASH) });
});

const THONG_DIEP = {
  them: (ten) => `Đã thêm kỹ thuật viên ${ten}.`,
  sua: (ten) => `Đã cập nhật thông tin ${ten}.`,
  khoa: (ten) => `Đã khóa tài khoản ${ten}.`,
  moKhoa: (ten) => `Đã mở khóa tài khoản ${ten}.`,
};

function xuLy(hanhDong) {
  return (req, res, next) => {
    const coId = req.params.id !== undefined;
    const id = coId ? soId(req.params.id) : null;
    if (coId && !id) return next();
    try {
      let kq;
      if (hanhDong === 'them') kq = nhanSu.themKtv(req.nguoiDung, req.body);
      else if (hanhDong === 'sua') kq = nhanSu.suaKtv(req.nguoiDung, id, req.body);
      else kq = nhanSu[hanhDong === 'khoa' ? 'khoaKtv' : 'moKhoaKtv'](req.nguoiDung, id);
      datFlash(req, KHOA_FLASH, 'ok', THONG_DIEP[hanhDong](kq.nhan));
      res.redirect(GOC);
    } catch (e) {
      if (!(e instanceof LoiNghiepVu)) return next(e);
      if (e.ma === 404) return next();
      if (e.ma === 422) {
        // Giữ lại giá trị đã nhập (trừ mật khẩu), lỗi hiện dưới từng ô
        const { mat_khau: _bo, ...giaTri } = req.body || {};
        const k = id ? tv.layKtv(id) : null;
        return hien(res, req, { ma: 422, form: { id, email: k ? k.email : undefined, giaTri, loi: e.loi || {} } });
      }
      datFlash(req, KHOA_FLASH, 'loi', e.message);
      res.redirect(GOC);
    }
  };
}

router.post('/', xuLy('them'));
router.post('/:id', xuLy('sua'));
router.post('/:id/khoa', xuLy('khoa'));
router.post('/:id/mo-khoa', xuLy('moKhoa'));

module.exports = router;
