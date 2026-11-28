// Máy chủ web – Hệ thống báo hỏng & sửa chữa CSVC.
const path = require('path');
const express = require('express');
const session = require('express-session');
const { layCsdl } = require('./db');
const { napNguoiDung } = require('./middleware/auth');
const { dinhDang } = require('./lib/thoiGian');

layCsdl(); // báo lỗi sớm nếu chưa chạy seed

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.disable('x-powered-by');

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/design', express.static(path.join(__dirname, 'design')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'csvc.sid',
  secret: process.env.SESSION_SECRET || 'csvc-et3260-nhom4-demo',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 },
}));

app.locals.tenHeThong = 'Hệ thống báo hỏng & sửa chữa CSVC';
app.locals.dinhDang = dinhDang;

app.use(napNguoiDung);
app.use('/', require('./routes/auth'));
app.use('/sinh-vien', require('./routes/sinhVien'));
app.use('/quan-ly', require('./routes/quanLy'));
app.use('/ky-thuat-vien', require('./routes/kyThuatVien'));
app.use('/in', require('./routes/inBieuMau')); // trang in biểu mẫu M.01–M.04

app.use((req, res) => {
  res.status(404).render('loi', { tieuDe: 'Không tìm thấy trang', thongDiep: 'Đường dẫn không tồn tại.' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('loi', { tieuDe: 'Có lỗi xảy ra', thongDiep: 'Vui lòng thử lại sau.' });
});

// Chỉ mở cổng khi chạy trực tiếp (npm start); test route nạp app mà không cần mở cổng.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Đang chạy tại http://localhost:${PORT}`);
  });
}

module.exports = app;
