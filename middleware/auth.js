// Phiên đăng nhập và kiểm tra quyền ở server (BR-02).
const { layCsdl } = require('../db');
const { VAI_TRO } = require('../lib/hangSo');
const { MENU, trangDau } = require('../lib/menu');

// Đọc lại người dùng từ CSDL mỗi request: tài khoản bị khóa giữa chừng thì phiên mất hiệu lực.
function napNguoiDung(req, res, next) {
  res.locals.nguoiDung = null;
  res.locals.menu = [];
  res.locals.duongDanHienTai = req.path;
  const id = req.session && req.session.nguoiDungId;
  if (!id) return next();

  const nd = layCsdl()
    .prepare('SELECT id, email, ho_ten, vai_tro, ma_so, trang_thai FROM nguoi_dung WHERE id = ?')
    .get(id);
  if (!nd || nd.trang_thai !== 'HOAT_DONG') {
    return req.session.destroy(() => res.redirect('/dang-nhap'));
  }
  req.nguoiDung = nd;
  res.locals.nguoiDung = nd;
  res.locals.tenVaiTro = VAI_TRO[nd.vai_tro];
  res.locals.menu = MENU[nd.vai_tro] || [];
  res.locals.trangDau = trangDau(nd.vai_tro);
  next();
}

function canDangNhap(req, res, next) {
  if (!req.nguoiDung) return res.redirect('/dang-nhap');
  next();
}

// Chặn truy cập trang của vai trò khác: trả 403 "Bạn không có quyền truy cập".
function chiVaiTro(...dsVaiTro) {
  return (req, res, next) => {
    if (!req.nguoiDung) return res.redirect('/dang-nhap');
    if (!dsVaiTro.includes(req.nguoiDung.vai_tro)) {
      return res.status(403).render('loi', {
        tieuDe: 'Bạn không có quyền truy cập',
        thongDiep: 'Trang này không dành cho vai trò của bạn.',
      });
    }
    next();
  };
}

module.exports = { napNguoiDung, canDangNhap, chiVaiTro };
