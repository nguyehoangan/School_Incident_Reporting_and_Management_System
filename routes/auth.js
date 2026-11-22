// M01 – Đăng nhập / đăng xuất (SPEC mục 3, BR-01).
const express = require('express');
const bcrypt = require('bcrypt');
const { layCsdl } = require('../db');
const { trangDau } = require('../lib/menu');

const router = express.Router();

const EMAIL_TRUONG = /^[^\s@]+@(sis\.)?hust\.edu\.vn$/;
const LOI = {
  EMAIL_NGOAI: 'Vui lòng dùng email trường (@hust.edu.vn hoặc @sis.hust.edu.vn)',
  SAI: 'Email hoặc mật khẩu không đúng',
  KHOA: 'Tài khoản đã bị khóa, vui lòng liên hệ phòng quản lý',
};

function hienForm(res, { email = '', loi = null, ma = 200 } = {}) {
  res.status(ma).render('dang-nhap', { email, loi });
}

router.get('/', (req, res) => {
  res.redirect(req.nguoiDung ? trangDau(req.nguoiDung.vai_tro) : '/dang-nhap');
});

router.get('/dang-nhap', (req, res) => {
  if (req.nguoiDung) return res.redirect(trangDau(req.nguoiDung.vai_tro));
  hienForm(res);
});

router.post('/dang-nhap', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const matKhau = String(req.body.mat_khau || '');

    // Bước 1: chỉ email trường
    if (!EMAIL_TRUONG.test(email)) return hienForm(res, { email, loi: LOI.EMAIL_NGOAI, ma: 400 });

    // Bước 2: không có tài khoản hoặc sai mật khẩu -> báo chung
    const nd = layCsdl()
      .prepare('SELECT id, vai_tro, mat_khau_hash, trang_thai FROM nguoi_dung WHERE email = ?')
      .get(email);
    const dung = nd ? await bcrypt.compare(matKhau, nd.mat_khau_hash) : false;
    if (!dung) return hienForm(res, { email, loi: LOI.SAI, ma: 401 });

    // Bước 3: tài khoản bị khóa
    if (nd.trang_thai === 'KHOA') return hienForm(res, { email, loi: LOI.KHOA, ma: 403 });

    // Bước 4: tạo phiên mới, chuyển trang theo vai trò
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.nguoiDungId = nd.id;
      req.session.save((err2) => (err2 ? next(err2) : res.redirect(trangDau(nd.vai_tro))));
    });
  } catch (e) {
    next(e);
  }
});

router.post('/dang-xuat', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('csvc.sid');
    res.redirect('/dang-nhap');
  });
});

module.exports = router;
