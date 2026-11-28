// Test route cho màn hình Kỹ thuật viên (K01, K02): đi qua HTTP thật tới app Express, CSDL tạm.
// Logic chuyển trạng thái đã có test ở yeuCau.test.js; ở đây kiểm tra phần route + hiển thị + BR-04.
// Chạy: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');

const THU_MUC_TAM = fs.mkdtempSync(path.join(os.tmpdir(), 'csvc-ktv-'));
process.env.DB_PATH = path.join(THU_MUC_TAM, 'test.db');

const { moCsdl, layCsdl } = require('../db');
{ // CSDL tạm phải có trước khi nạp app (app.js mở CSDL ngay khi nạp)
  const db0 = moCsdl(process.env.DB_PATH);
  db0.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  db0.close();
}
const { gioVN } = require('../lib/thoiGian');
const yeuCau = require('../services/yeuCau');
const lam = yeuCau.thucHienHanhDong;
const app = require('../app');

const GOC_DU_AN = path.join(__dirname, '..');
const MAT_KHAU = '123456';
const nd = {};
let phongD3; let phongD5; let loaiMC;
let server; let goc;
const anhDaGhi = [];

const gioLech = (gio) => gioVN(new Date(Date.now() + gio * 3600e3));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

test.before(async () => {
  const db = layCsdl();
  const hash = bcrypt.hashSync(MAT_KHAU, 4);
  const them = db.prepare(`INSERT INTO nguoi_dung (email, mat_khau_hash, ho_ten, vai_tro, ma_so, trang_thai) VALUES (?, ?, ?, ?, ?, 'HOAT_DONG')`);
  const tao = (khoa, email, ten, vaiTro, maSo) => { nd[khoa] = { id: them.run(email, hash, ten, vaiTro, maSo).lastInsertRowid, email, ho_ten: ten, vai_tro: vaiTro }; };
  tao('ql', 'ql@hust.edu.vn', 'Quản Lý', 'QUAN_LY', 'NV1');
  tao('binh', 'binh@hust.edu.vn', 'Trần Văn Bình', 'KY_THUAT_VIEN', 'NV2');
  tao('hoa', 'hoa@hust.edu.vn', 'Lê Thị Hoa', 'KY_THUAT_VIEN', 'NV3');
  tao('an', 'an.nh225001@sis.hust.edu.vn', 'Nguyễn Hoàng An', 'SINH_VIEN', '20225001');

  const d3 = db.prepare(`INSERT INTO toa_nha (ma_nha, ten_nha) VALUES ('D3', 'Nhà D3')`).run().lastInsertRowid;
  const d5 = db.prepare(`INSERT INTO toa_nha (ma_nha, ten_nha) VALUES ('D5', 'Nhà D5')`).run().lastInsertRowid;
  phongD3 = db.prepare(`INSERT INTO phong (toa_nha_id, ma_phong, tang) VALUES (?, '301', 3)`).run(d3).lastInsertRowid;
  phongD5 = db.prepare(`INSERT INTO phong (toa_nha_id, ma_phong, tang) VALUES (?, '204', 2)`).run(d5).lastInsertRowid;
  loaiMC = db.prepare(`INSERT INTO loai_thiet_bi (ten_loai) VALUES ('Máy chiếu')`).run().lastInsertRowid;
  db.prepare('INSERT INTO khu_vuc_phu_trach (ktv_id, toa_nha_id) VALUES (?, ?)').run(nd.binh.id, d3);
  db.prepare('INSERT INTO khu_vuc_phu_trach (ktv_id, toa_nha_id) VALUES (?, ?)').run(nd.binh.id, d5);

  server = app.listen(0, '127.0.0.1');
  await new Promise((ok) => server.once('listening', ok));
  goc = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  for (const a of layCsdl().prepare('SELECT duong_dan FROM anh_dinh_kem WHERE loai_anh = ?').all('SAU')) {
    fs.rmSync(path.join(GOC_DU_AN, a.duong_dan), { force: true }); // ảnh do test ghi vào uploads/yeu-cau
  }
  fs.rmSync(THU_MUC_TAM, { recursive: true, force: true });
});

// ---------------------------------------------------------------- Công cụ
let soYC = 0;
let soTB = 0;
// Tạo yêu cầu rồi đưa tới trạng thái mong muốn bằng chính service. han = số giờ kể từ bây giờ (âm = quá hạn).
function taoViec({ tt = 'DA_PHAN_CONG', ktv = 'binh', phong = phongD3, mucDo = 'BINH_THUONG', han = 24, coThietBi = true } = {}) {
  const db = layCsdl();
  const t = gioLech(-72);
  let thietBi = null;
  if (coThietBi) {
    soTB += 1;
    thietBi = db.prepare(`INSERT INTO thiet_bi (ma_tai_san, ten_thiet_bi, loai_thiet_bi_id, phong_id) VALUES (?, 'Máy chiếu', ?, ?)`)
      .run(`MC-${soTB}`, loaiMC, phong).lastInsertRowid;
  }
  const ma = `YC-2026-${String(++soYC).padStart(4, '0')}`;
  const id = db.prepare(`INSERT INTO yeu_cau (ma_yeu_cau, sinh_vien_id, phong_id, thiet_bi_id, loai_thiet_bi_id, muc_do, mo_ta,
                           trang_thai, thoi_gian_gui, thoi_gian_cap_nhat) VALUES (?, ?, ?, ?, ?, ?, 'Máy chiếu không lên hình', 'MOI', ?, ?)`)
    .run(ma, nd.an.id, phong, thietBi, loaiMC, mucDo, t, t).lastInsertRowid;
  db.prepare(`INSERT INTO lich_su_xu_ly (yeu_cau_id, nguoi_thuc_hien_id, tu_trang_thai, den_trang_thai, noi_dung, thoi_gian)
              VALUES (?, ?, NULL, 'MOI', 'Gửi yêu cầu', ?)`).run(id, nd.an.id, t);
  if (tt !== 'MOI') {
    lam(nd.ql, id, 'phanCong', { ktv_id: nd[ktv].id, han: gioLech(48).slice(0, 16).replace(' ', 'T'), ghi_chu_giao_viec: 'Mang bóng dự phòng' });
    db.prepare('UPDATE phan_cong SET han_hoan_thanh = ? WHERE yeu_cau_id = ?').run(gioLech(han), id); // chỉnh hạn chính xác cho test
  }
  if (['DANG_SUA', 'CHO_NGHIEM_THU', 'HOAN_THANH'].includes(tt)) lam(nd[ktv], id, 'batDau');
  if (['CHO_NGHIEM_THU', 'HOAN_THANH'].includes(tt)) {
    lam(nd[ktv], id, 'baoKetQua', { ket_qua: 'KHAC_PHUC_TAI_CHO', dong: [{ noi_dung: 'Thay bóng đèn', so_luong: '1' }] });
  }
  if (tt === 'HOAN_THANH') lam(nd.ql, id, 'nghiemThu');
  return { id, ma, thietBi };
}

const yc = (id) => layCsdl().prepare('SELECT * FROM yeu_cau WHERE id = ?').get(id);
const soLichSu = (id) => layCsdl().prepare('SELECT COUNT(*) n FROM lich_su_xu_ly WHERE yeu_cau_id = ?').get(id).n;
const tinhTrangTB = (id) => layCsdl().prepare('SELECT tinh_trang FROM thiet_bi WHERE id = ?').get(id).tinh_trang;

// Trình duyệt giả: giữ cookie phiên, không tự theo chuyển hướng (để kiểm tra mã trả về)
async function dangNhap(khoa) {
  const r = await fetch(`${goc}/dang-nhap`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: nd[khoa].email, mat_khau: MAT_KHAU }),
  });
  assert.equal(r.status, 302, 'đăng nhập phải thành công');
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const gui = (duong, tuyChon = {}) => fetch(goc + duong, { redirect: 'manual', ...tuyChon, headers: { ...(tuyChon.headers || {}), cookie } });
  return {
    get: (duong) => gui(duong),
    // Gửi form multipart; dong = [{noi_dung, so_luong, ghi_chu}], anh = [Buffer | {ten, du_lieu}]
    guiKetQua: (id, { dong = [], anh = [], ketQua = 'KHAC_PHUC_TAI_CHO' } = {}) => {
      const f = new FormData();
      f.append('ket_qua', ketQua);
      dong.forEach((d, i) => Object.entries(d).forEach(([k, v]) => f.append(`dong[${i}][${k}]`, v)));
      anh.forEach((a, i) => f.append('anh', new Blob([a.du_lieu || a]), a.ten || `anh${i}.png`));
      return gui(`/ky-thuat-vien/viec/${id}/bao-ket-qua`, { method: 'POST', body: f });
    },
    post: (duong) => gui(duong, { method: 'POST' }),
    // Gửi form K02 với các trường tùy ý (dùng cho nhánh "Không khắc phục tại chỗ" – biên bản M.04)
    guiForm: (id, truong) => {
      const f = new FormData();
      Object.entries(truong).forEach(([k, v]) => f.append(k, v));
      return gui(`/ky-thuat-vien/viec/${id}/bao-ket-qua`, { method: 'POST', body: f });
    },
  };
}
// Đọc thân trang và giải mã các ký tự EJS đã escape để so sánh với chữ hiển thị
const thanTrang = async (r) => (await r.text()).replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
// Theo chuyển hướng sau POST (kèm cookie) để đọc thông báo flash
async function theoDoi(phien, r) {
  assert.equal(r.status, 302);
  return phien.get(new URL(r.headers.get('location'), goc).pathname);
}
const viTri = (html, chuoi) => { const i = html.indexOf(chuoi); assert.ok(i >= 0, `phải có "${chuoi}"`); return i; };

// ================================================================ Quyền truy cập
test('Chỉ KTV vào được /ky-thuat-vien: chưa đăng nhập → đăng nhập; SV, QL → 403', async () => {
  const an = await fetch(`${goc}/ky-thuat-vien/viec`, { redirect: 'manual' });
  assert.equal(an.status, 302);
  assert.equal(new URL(an.headers.get('location'), goc).pathname, '/dang-nhap');
  for (const khoa of ['an', 'ql']) {
    const p = await dangNhap(khoa);
    assert.equal((await p.get('/ky-thuat-vien/viec')).status, 403, `${khoa} xem K01`);
    assert.equal((await p.get('/ky-thuat-vien/viec/1')).status, 403, `${khoa} xem K02`);
    assert.equal((await p.post('/ky-thuat-vien/viec/1/bat-dau')).status, 403, `${khoa} bắt đầu`);
  }
});

// ================================================================ K01
test('K01: chỉ việc có phân công hiệu lực của mình, đếm theo tab, nhóm theo nhà, Khẩn cấp rồi hạn gần, quá hạn có chữ "Quá hạn"', async () => {
  const thuong = taoViec({ han: 20 });                          // D3, bình thường, hạn 20h
  const khan = taoViec({ mucDo: 'KHAN_CAP', han: 40 });         // D3, khẩn cấp (hạn xa) -> phải lên đầu nhóm D3
  const gan = taoViec({ tt: 'DANG_SUA', han: 5 });              // D3, bình thường, hạn gần nhất
  const quaHan = taoViec({ phong: phongD5, han: -6 });          // D5, quá hạn
  const cho = taoViec({ tt: 'CHO_NGHIEM_THU' });
  const xong = taoViec({ tt: 'HOAN_THANH' });
  const cuaHoa = taoViec({ ktv: 'hoa', tt: 'DANG_SUA' });
  const moi = taoViec({ tt: 'MOI' });

  const binh = await dangNhap('binh');
  const html = await thanTrang(await binh.get('/ky-thuat-vien/viec'));
  assert.match(html, /Cần làm \(4\)/);
  assert.match(html, /Chờ nghiệm thu \(1\)/);
  assert.match(html, /Đã xong \(1\)/);
  assert.match(html, /Khu vực phụ trách: D3, D5/);

  // Nhóm theo nhà: D3 trước D5; trong D3: khẩn cấp → hạn gần → hạn xa hơn
  const iD3 = viTri(html, 'Nhà D3 <span>· 3 việc'); const iD5 = viTri(html, 'Nhà D5 <span>· 1 việc');
  assert.ok(iD3 < iD5);
  const [iKhan, iGan, iThuong, iQua] = [khan, gan, thuong, quaHan].map((v) => viTri(html, `href="/ky-thuat-vien/viec/${v.id}">${v.ma}<`));
  assert.ok(iD3 < iKhan && iKhan < iGan && iGan < iThuong && iThuong < iD5 && iD5 < iQua, 'thứ tự D3: Khẩn cấp, hạn gần, hạn xa; rồi D5');
  assert.equal((html.match(/Quá hạn/g) || []).length, 1, 'chỉ việc quá hạn có chữ "Quá hạn"');
  assert.match(html.slice(iQua, iQua + 800), /viec__han--qua/);
  // Việc của người khác / chưa phân công / ở tab khác không xuất hiện
  for (const v of [cho, xong, cuaHoa, moi]) assert.ok(!html.includes(v.ma), `${v.ma} không thuộc tab Cần làm của Bình`);

  const htmlCho = await thanTrang(await binh.get('/ky-thuat-vien/viec?tab=cho-nghiem-thu'));
  assert.ok(htmlCho.includes(cho.ma) && !htmlCho.includes(thuong.ma));
  const htmlXong = await thanTrang(await binh.get('/ky-thuat-vien/viec?tab=da-xong'));
  assert.ok(htmlXong.includes(xong.ma) && !htmlXong.includes(cho.ma));
  // Tab lạ -> tab mặc định
  assert.match(await thanTrang(await binh.get('/ky-thuat-vien/viec?tab=abc')), /tab-ds__tab dang-chon[^>]*>Cần làm/);

  const hoa = await dangNhap('hoa');
  const htmlHoa = await thanTrang(await hoa.get('/ky-thuat-vien/viec'));
  assert.ok(htmlHoa.includes(cuaHoa.ma) && !htmlHoa.includes(thuong.ma));
  assert.match(htmlHoa, /Cần làm \(1\)/);
});

// ================================================================ BR-04
test('BR-04: việc của người khác / chưa phân công / không tồn tại trả 404, và không thao tác được', async () => {
  const cuaHoa = taoViec({ ktv: 'hoa', tt: 'DA_PHAN_CONG' });
  const cuaHoaDangSua = taoViec({ ktv: 'hoa', tt: 'DANG_SUA' });
  const moi = taoViec({ tt: 'MOI' });
  const binh = await dangNhap('binh');

  for (const id of [cuaHoa.id, moi.id, 999999]) assert.equal((await binh.get(`/ky-thuat-vien/viec/${id}`)).status, 404, `xem ${id}`);
  assert.equal((await binh.get('/ky-thuat-vien/viec/abc')).status, 404);

  const lsTruoc = [soLichSu(cuaHoa.id), soLichSu(cuaHoaDangSua.id)];
  assert.equal((await binh.post(`/ky-thuat-vien/viec/${cuaHoa.id}/bat-dau`)).status, 404);
  const kq = await binh.guiKetQua(cuaHoaDangSua.id, { dong: [{ noi_dung: 'Sửa trộm', so_luong: '1' }] });
  assert.equal(kq.status, 404);
  assert.equal(yc(cuaHoa.id).trang_thai, 'DA_PHAN_CONG');
  assert.equal(yc(cuaHoaDangSua.id).trang_thai, 'DANG_SUA');
  assert.deepEqual([soLichSu(cuaHoa.id), soLichSu(cuaHoaDangSua.id)], lsTruoc, 'không ghi lịch sử');
  assert.equal(layCsdl().prepare('SELECT COUNT(*) n FROM noi_dung_sua_chua WHERE yeu_cau_id = ?').get(cuaHoaDangSua.id).n, 0);
});

test('BR-04: sau khi QL đổi người / yêu cầu làm lại cho KTV khác thì KTV cũ mất quyền (phân công cũ hết hiệu lực)', async () => {
  const v = taoViec({ tt: 'DA_PHAN_CONG' });
  const binh = await dangNhap('binh');
  assert.equal((await binh.get(`/ky-thuat-vien/viec/${v.id}`)).status, 200);
  lam(nd.ql, v.id, 'doiKtv', { ktv_id: nd.hoa.id });
  assert.equal((await binh.get(`/ky-thuat-vien/viec/${v.id}`)).status, 404);
  assert.equal((await binh.post(`/ky-thuat-vien/viec/${v.id}/bat-dau`)).status, 404);
  assert.ok(!(await thanTrang(await binh.get('/ky-thuat-vien/viec'))).includes(v.ma));
  const hoa = await dangNhap('hoa');
  assert.equal((await hoa.get(`/ky-thuat-vien/viec/${v.id}`)).status, 200);
});

// ================================================================ K02
test('K02: hiện thông tin yêu cầu, ghi chú giao việc, KHÔNG hiện email SV; chưa có phần II thì chưa có nút In M.01; chọn được "Không khắc phục"', async () => {
  const v = taoViec({ tt: 'DANG_SUA', mucDo: 'KHAN_CAP' });
  const binh = await dangNhap('binh');
  const html = await thanTrang(await binh.get(`/ky-thuat-vien/viec/${v.id}`));
  assert.ok(html.includes('Máy chiếu không lên hình'));
  assert.ok(html.includes('Mang bóng dự phòng'), 'ghi chú giao việc');
  assert.ok(html.includes('Quản Lý'), 'người giao');
  assert.ok(html.includes('Nguyễn Hoàng An') && html.includes('20225001'));
  assert.ok(!html.includes(nd.an.email) && !html.includes('@sis.hust.edu.vn'), 'không lộ email SV');
  assert.ok(!html.includes('nut-in-m01') && !html.includes('nut-in-m04'), 'SPEC 8 – K02: In M.01 khi đã có phần II, In M.04 khi đã lập biên bản');
  assert.match(html, /value="KHONG_KHAC_PHUC"\s*>/, 'nhánh "Không khắc phục tại chỗ" đã mở');
  assert.ok(!/value="KHONG_KHAC_PHUC"[^>]*disabled/.test(html));
  assert.ok(html.includes('name="tinh_trang_su_co"') && html.includes('name="nguyen_nhan"') && html.includes('name="bp_thue_sua"'));
  assert.match(html, /name="dong\[0\]\[noi_dung\]"/);
  assert.ok(!html.includes('Bắt đầu kiểm tra</button>'), 'Đang xử lý thì không còn nút Bắt đầu');
});

test('K02: Đã phân công → nút Bắt đầu kiểm tra, chưa có form báo kết quả', async () => {
  const v = taoViec({ tt: 'DA_PHAN_CONG' });
  const html = await thanTrang(await (await dangNhap('binh')).get(`/ky-thuat-vien/viec/${v.id}`));
  assert.ok(html.includes(`action="/ky-thuat-vien/viec/${v.id}/bat-dau"`));
  assert.ok(!html.includes('form-ket-qua'));
});

test('Bắt đầu kiểm tra: Đã phân công → Đang xử lý, thiết bị Đang sửa, ghi 1 dòng lịch sử; bấm lần 2 bị từ chối (409) không ghi thêm', async () => {
  const v = taoViec({ tt: 'DA_PHAN_CONG' });
  const binh = await dangNhap('binh');
  const truoc = soLichSu(v.id);
  const r = await binh.post(`/ky-thuat-vien/viec/${v.id}/bat-dau`);
  assert.equal(r.status, 302);
  assert.equal(yc(v.id).trang_thai, 'DANG_SUA');
  assert.equal(tinhTrangTB(v.thietBi), 'DANG_SUA');
  assert.equal(soLichSu(v.id), truoc + 1);
  assert.match(await thanTrang(await theoDoi(binh, r)), /Đã bắt đầu kiểm tra YC-/);

  const r2 = await binh.post(`/ky-thuat-vien/viec/${v.id}/bat-dau`);
  assert.equal(soLichSu(v.id), truoc + 1);
  assert.match(await thanTrang(await theoDoi(binh, r2)), /Không thể "Bắt đầu kiểm tra"/);
});

test('Báo kết quả khi chưa bắt đầu kiểm tra bị từ chối: trạng thái giữ nguyên', async () => {
  const v = taoViec({ tt: 'DA_PHAN_CONG' });
  const binh = await dangNhap('binh');
  const r = await binh.guiKetQua(v.id, { dong: [{ noi_dung: 'Thay bóng', so_luong: '1' }] });
  assert.match(await thanTrang(await theoDoi(binh, r)), /Không thể "Báo kết quả"/);
  assert.equal(yc(v.id).trang_thai, 'DA_PHAN_CONG');
});

test('Báo kết quả "Đã khắc phục tại chỗ": lưu các dòng (bỏ dòng trống) + ảnh sau sửa, sang Chờ nghiệm thu; KTV chỉ còn xem', async () => {
  const v = taoViec({ tt: 'DANG_SUA' });
  const binh = await dangNhap('binh');
  const r = await binh.guiKetQua(v.id, {
    dong: [
      { noi_dung: 'Thay tụ quạt 3µF', so_luong: '1', ghi_chu: 'Lấy từ kho' },
      { noi_dung: '', so_luong: '', ghi_chu: '' }, // dòng trống được bỏ qua
      { noi_dung: 'Tra dầu, siết lại cánh quạt', so_luong: '', ghi_chu: '' },
    ],
    anh: [PNG, PNG],
  });
  const trangSau = await thanTrang(await theoDoi(binh, r));
  assert.match(trangSau, /Đã gửi kết quả YC-/);
  const sau = yc(v.id);
  assert.equal(sau.trang_thai, 'CHO_NGHIEM_THU');
  assert.equal(sau.ket_qua_kiem_tra, 'KHAC_PHUC_TAI_CHO');
  const dong = layCsdl().prepare('SELECT stt, noi_dung, so_luong, ghi_chu FROM noi_dung_sua_chua WHERE yeu_cau_id = ? ORDER BY stt').all(v.id);
  assert.deepEqual(dong, [
    { stt: 1, noi_dung: 'Thay tụ quạt 3µF', so_luong: 1, ghi_chu: 'Lấy từ kho' },
    { stt: 2, noi_dung: 'Tra dầu, siết lại cánh quạt', so_luong: null, ghi_chu: null },
  ]);
  const anh = layCsdl().prepare(`SELECT duong_dan FROM anh_dinh_kem WHERE yeu_cau_id = ? AND loai_anh = 'SAU'`).all(v.id);
  assert.equal(anh.length, 2);
  for (const a of anh) { anhDaGhi.push(a.duong_dan); assert.ok(fs.existsSync(path.join(GOC_DU_AN, a.duong_dan)), 'tệp ảnh đã được ghi'); }
  assert.equal(tinhTrangTB(v.thietBi), 'DANG_SUA', 'thiết bị chỉ về Hoạt động sau khi QL nghiệm thu');

  // Trang chi tiết bây giờ chỉ xem: có kết quả đã báo, không còn form
  assert.ok(trangSau.includes('Tra dầu, siết lại cánh quạt') && trangSau.includes('Đang chờ quản lý nghiệm thu'));
  assert.ok(!trangSau.includes('form-ket-qua'));
  const htmlCho = await thanTrang(await binh.get('/ky-thuat-vien/viec?tab=cho-nghiem-thu'));
  assert.ok(htmlCho.includes(sau.ma_yeu_cau));
  // Gửi lại lần nữa bị từ chối
  const lai = await binh.guiKetQua(v.id, { dong: [{ noi_dung: 'Gửi lại', so_luong: '1' }] });
  assert.match(await thanTrang(await theoDoi(binh, lai)), /Không thể "Báo kết quả"/);
});

test('Báo kết quả thiếu / sai dữ liệu: không ghi gì, quay lại form kèm lỗi theo từng ô và giữ giá trị đã nhập', async () => {
  const v = taoViec({ tt: 'DANG_SUA' });
  const binh = await dangNhap('binh');
  const truoc = soLichSu(v.id);
  const kiemTraKhongGhi = () => {
    assert.equal(yc(v.id).trang_thai, 'DANG_SUA');
    assert.equal(soLichSu(v.id), truoc);
    assert.equal(layCsdl().prepare('SELECT COUNT(*) n FROM noi_dung_sua_chua WHERE yeu_cau_id = ?').get(v.id).n, 0);
    assert.equal(layCsdl().prepare('SELECT COUNT(*) n FROM anh_dinh_kem WHERE yeu_cau_id = ? AND loai_anh = ?').get(v.id, 'SAU').n, 0);
  };

  // Không có dòng nào
  let html = await thanTrang(await theoDoi(binh, await binh.guiKetQua(v.id, { dong: [{ noi_dung: '', so_luong: '', ghi_chu: '' }] })));
  assert.ok(html.includes('Cần ít nhất 1 dòng nội dung sửa chữa'));
  kiemTraKhongGhi();

  // Số lượng sai, thiếu nội dung; giá trị đã nhập vẫn còn trên form
  html = await thanTrang(await theoDoi(binh, await binh.guiKetQua(v.id, {
    dong: [{ noi_dung: 'Thay dây nguồn', so_luong: 'abc', ghi_chu: 'Hàng mới' }, { noi_dung: '', so_luong: '2', ghi_chu: '' }],
  })));
  assert.ok(html.includes('Số lượng phải là số nguyên dương'));
  assert.ok(html.includes('Mục này không được để trống'));
  assert.ok(html.includes('value="Thay dây nguồn"') && html.includes('value="abc"') && html.includes('value="Hàng mới"'), 'giữ lại giá trị đã nhập');
  assert.ok(html.includes('name="dong[1][so_luong]"'), 'giữ lại cả 2 dòng');
  kiemTraKhongGhi();

  // Ảnh: không phải JPG/PNG (nội dung chữ đổi tên .png) → báo lỗi, nhắc chọn lại ảnh
  const dongOk = [{ noi_dung: 'Thay bóng', so_luong: '1', ghi_chu: '' }];
  html = await thanTrang(await theoDoi(binh, await binh.guiKetQua(v.id, { dong: dongOk, anh: [{ ten: 'gia.png', du_lieu: Buffer.from('khong phai anh') }] })));
  assert.ok(html.includes('không phải JPG hoặc PNG') && html.includes('chọn lại'));
  kiemTraKhongGhi();

  // Quá 3 ảnh
  html = await thanTrang(await theoDoi(binh, await binh.guiKetQua(v.id, { dong: dongOk, anh: [PNG, PNG, PNG, PNG] })));
  assert.ok(html.includes('tối đa 3 ảnh'));
  kiemTraKhongGhi();

  // Ảnh > 5 MB
  html = await thanTrang(await theoDoi(binh, await binh.guiKetQua(v.id, { dong: dongOk, anh: [Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)])] })));
  assert.ok(html.includes('5 MB'));
  kiemTraKhongGhi();
});

test('Yêu cầu làm lại: KTV cũ thấy lại việc ở tab Cần làm kèm lý do làm lại; hoàn thành thì sang tab Đã xong', async () => {
  const v = taoViec({ tt: 'CHO_NGHIEM_THU' });
  lam(nd.ql, v.id, 'lamLai', { ly_do: 'Hình vẫn mờ, chưa căn chỉnh. Cần căn lại tiêu cự' });
  const binh = await dangNhap('binh');
  const html = await thanTrang(await binh.get(`/ky-thuat-vien/viec/${v.id}`));
  assert.ok(html.includes('Lý do làm lại') && html.includes('Hình vẫn mờ, chưa căn chỉnh. Cần căn lại tiêu cự'), 'lý do có dấu chấm vẫn nguyên vẹn');
  assert.equal((html.match(/Hình vẫn mờ/g) || []).length, 1, 'không hiện lặp ở ghi chú giao việc');
  assert.ok(html.includes(`/bat-dau"`), 'đã phân công lại -> bắt đầu kiểm tra lần 2');
  assert.ok((await thanTrang(await binh.get('/ky-thuat-vien/viec'))).includes(v.ma));

  lam(nd.binh, v.id, 'batDau');
  lam(nd.binh, v.id, 'baoKetQua', { ket_qua: 'KHAC_PHUC_TAI_CHO', dong: [{ noi_dung: 'Căn lại tiêu cự', so_luong: '1' }] });
  lam(nd.ql, v.id, 'nghiemThu');
  assert.equal(tinhTrangTB(v.thietBi), 'HOAT_DONG');
  assert.ok((await thanTrang(await binh.get('/ky-thuat-vien/viec?tab=da-xong'))).includes(v.ma));
  const ct = await thanTrang(await binh.get(`/ky-thuat-vien/viec/${v.id}`));
  assert.ok(ct.includes('Hoàn thành lúc') && ct.includes('Căn lại tiêu cự'));
});

// ================================================================ Đợt 6: nhánh "Không khắc phục tại chỗ" – biên bản M.04
const bienBanHieuLuc = (id) => layCsdl().prepare('SELECT * FROM bien_ban_kiem_tra WHERE yeu_cau_id = ? AND con_hieu_luc = 1').get(id);

test('Báo kết quả M.04 thiếu trường: báo lỗi theo từng ô, không ghi gì, giữ nhánh đã chọn', async () => {
  const v = taoViec({ tt: 'DANG_SUA' });
  const binh = await dangNhap('binh');
  const truoc = soLichSu(v.id);
  const html = await thanTrang(await theoDoi(binh, await binh.guiForm(v.id, {
    ket_qua: 'KHONG_KHAC_PHUC', tinh_trang_su_co: '   ', nguyen_nhan: '', con_bao_hanh: '0',
  })));
  assert.ok(html.includes('Vui lòng kiểm tra lại các mục được đánh dấu.'));
  // Lỗi đúng dưới từng ô: tình trạng, nguyên nhân (trống) và biện pháp (chưa chọn)
  assert.match(html, /name="tinh_trang_su_co"[\s\S]{0,200}?<\/textarea>\s*<p class="loi-truong" >Mục này không được để trống/);
  assert.match(html, /name="nguyen_nhan"[\s\S]{0,200}?<\/textarea>\s*<p class="loi-truong" >Mục này không được để trống/);
  assert.match(html, /id="loi-de-xuat" >Chọn ít nhất 1 biện pháp đề nghị/);
  assert.match(html, /value="KHONG_KHAC_PHUC" checked/, 'mở lại đúng nhánh biên bản');
  assert.match(html, /data-nhanh="KHAC_PHUC_TAI_CHO" hidden/);
  assert.equal(yc(v.id).trang_thai, 'DANG_SUA');
  assert.equal(yc(v.id).ket_qua_kiem_tra, null);
  assert.equal(soLichSu(v.id), truoc);
  assert.equal(bienBanHieuLuc(v.id), undefined);
});

test('Báo kết quả M.04 thiếu biện pháp (chỉ ghi chi tiết mà không đánh dấu) bị từ chối, giữ giá trị đã nhập', async () => {
  const v = taoViec({ tt: 'DANG_SUA' });
  const binh = await dangNhap('binh');
  const truoc = soLichSu(v.id);
  const html = await thanTrang(await theoDoi(binh, await binh.guiForm(v.id, {
    ket_qua: 'KHONG_KHAC_PHUC', tinh_trang_su_co: 'Máy nén không chạy', nguyen_nhan: 'Hỏng block máy nén',
    ct_thue_sua: 'Thay block, nạp gas', con_bao_hanh: '1',
  })));
  assert.ok(html.includes('Chọn ít nhất 1 biện pháp đề nghị'));
  assert.ok(html.includes('>Máy nén không chạy</textarea>') && html.includes('>Hỏng block máy nén</textarea>'), 'giữ tình trạng, nguyên nhân');
  assert.ok(html.includes('value="Thay block, nạp gas"'), 'giữ chi tiết biện pháp');
  assert.match(html, /name="con_bao_hanh" value="1" checked/, 'giữ lựa chọn còn bảo hành');
  assert.ok(!/name="bp_thue_sua" value="1" checked/.test(html));
  assert.equal(yc(v.id).trang_thai, 'DANG_SUA');
  assert.equal(soLichSu(v.id), truoc);
  assert.equal(bienBanHieuLuc(v.id), undefined);
});

test('Báo kết quả M.04 đủ trường: lưu biên bản (chỉ biện pháp được đánh dấu), sang Chờ nghiệm thu; có nút In M.04, chưa có In M.01', async () => {
  const v = taoViec({ tt: 'DANG_SUA' });
  const binh = await dangNhap('binh');
  const truoc = soLichSu(v.id);
  const r = await binh.guiForm(v.id, {
    ket_qua: 'KHONG_KHAC_PHUC', tinh_trang_su_co: 'Máy nén không chạy, dàn lạnh không lạnh', nguyen_nhan: 'Hỏng block máy nén',
    bp_thue_sua: '1', ct_thue_sua: ' Thay block, nạp gas ',
    bp_mua_vat_tu: '1', ct_mua_vat_tu: '',              // đánh dấu, không ghi chi tiết -> "Có đề nghị"
    ct_thanh_ly: 'Không đánh dấu nên bỏ qua',          // có chữ nhưng không đánh dấu -> không đề xuất
    con_bao_hanh: '1',
    'dong[0][noi_dung]': 'Dòng của nhánh kia', 'dong[0][so_luong]': '1', // dữ liệu của nhánh kia bị bỏ qua
  });
  const html = await thanTrang(await theoDoi(binh, r));
  assert.match(html, /Đã lập biên bản kiểm tra kỹ thuật \(M\.04\) cho YC-/);
  const sau = yc(v.id);
  assert.equal(sau.trang_thai, 'CHO_NGHIEM_THU');
  assert.equal(sau.ket_qua_kiem_tra, 'KHONG_KHAC_PHUC');
  assert.equal(soLichSu(v.id), truoc + 1);
  const bb = bienBanHieuLuc(v.id);
  assert.equal(bb.ktv_id, nd.binh.id);
  assert.equal(bb.tinh_trang_su_co, 'Máy nén không chạy, dàn lạnh không lạnh');
  assert.equal(bb.nguyen_nhan, 'Hỏng block máy nén');
  assert.equal(bb.de_xuat_thue_sua, 'Thay block, nạp gas');
  assert.equal(bb.de_xuat_mua_vat_tu, 'Có đề nghị');
  assert.equal(bb.de_xuat_thanh_ly, null);
  assert.equal(bb.con_bao_hanh, 1);
  assert.equal(layCsdl().prepare('SELECT COUNT(*) n FROM noi_dung_sua_chua WHERE yeu_cau_id = ?').get(v.id).n, 0);
  assert.equal(tinhTrangTB(v.thietBi), 'DANG_SUA', 'thiết bị chỉ đổi khi QL duyệt biên bản');
  // Trang chi tiết: chỉ xem biên bản, có nút In M.04, chưa có phần II nên chưa có In M.01
  assert.ok(html.includes('Thay block, nạp gas') && html.includes('Đang chờ quản lý nghiệm thu'));
  assert.ok(html.includes(`href="/in/m04/${v.id}"`));
  assert.ok(!html.includes(`href="/in/m01/${v.id}"`));
  assert.ok(!html.includes('form-ket-qua'));
});

test('Khắc phục tại chỗ xong thì K02 có nút In M.01', async () => {
  const v = taoViec({ tt: 'CHO_NGHIEM_THU' });
  const html = await thanTrang(await (await dangNhap('binh')).get(`/ky-thuat-vien/viec/${v.id}`));
  assert.ok(html.includes(`href="/in/m01/${v.id}"`));
  assert.ok(!html.includes(`href="/in/m04/${v.id}"`));
});
