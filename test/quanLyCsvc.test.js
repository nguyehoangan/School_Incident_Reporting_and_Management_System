// Test route cho Q03 Bảng phân công, Q04 Danh mục CSVC, Q05 Quản lý KTV: đi qua HTTP thật tới app Express, CSDL tạm.
// Logic từng quy tắc đã có test ở danhMuc.test.js và nhanSu.test.js; ở đây kiểm tra phần route + hiển thị + quyền (BR-02).
// Chạy: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');

const THU_MUC_TAM = fs.mkdtempSync(path.join(os.tmpdir(), 'csvc-route-'));
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

const MAT_KHAU = '123456';
const nd = {};
const id = {};
let server; let goc;

test.before(async () => {
  const db = layCsdl();
  const hash = bcrypt.hashSync(MAT_KHAU, 4);
  const them = db.prepare(`INSERT INTO nguoi_dung (email, mat_khau_hash, ho_ten, vai_tro, ma_so, trang_thai) VALUES (?, ?, ?, ?, ?, 'HOAT_DONG')`);
  const tao = (khoa, email, ten, vaiTro) => { nd[khoa] = { id: them.run(email, hash, ten, vaiTro, khoa).lastInsertRowid, email, ho_ten: ten, vai_tro: vaiTro }; };
  tao('ql', 'ql@hust.edu.vn', 'Quản Lý', 'QUAN_LY');
  tao('binh', 'binh@hust.edu.vn', 'Trần Văn Bình', 'KY_THUAT_VIEN');
  tao('hoa', 'hoa@hust.edu.vn', 'Lê Thị Hoa', 'KY_THUAT_VIEN');
  tao('an', 'an.nh225001@sis.hust.edu.vn', 'Nguyễn Hoàng An', 'SINH_VIEN');

  id.d3 = db.prepare(`INSERT INTO toa_nha (ma_nha, ten_nha) VALUES ('D3', 'Nhà D3')`).run().lastInsertRowid;
  id.p301 = db.prepare(`INSERT INTO phong (toa_nha_id, ma_phong, tang) VALUES (?, '301', 3)`).run(id.d3).lastInsertRowid;
  id.mc = db.prepare(`INSERT INTO loai_thiet_bi (ten_loai) VALUES ('Máy chiếu')`).run().lastInsertRowid;
  id.tb = db.prepare(`INSERT INTO thiet_bi (ma_tai_san, ten_thiet_bi, loai_thiet_bi_id, phong_id, model_hang, nam_su_dung) VALUES ('MC-D3301-01', 'Máy chiếu', ?, ?, 'Epson EB-X51', 2021)`)
    .run(id.mc, id.p301).lastInsertRowid;
  db.prepare('INSERT INTO khu_vuc_phu_trach (ktv_id, toa_nha_id) VALUES (?, ?)').run(nd.binh.id, id.d3);

  // Một yêu cầu đã được tham chiếu và đang giao cho Bình (Đã phân công)
  const t = gioVN();
  id.yc = db.prepare(`INSERT INTO yeu_cau (ma_yeu_cau, sinh_vien_id, phong_id, thiet_bi_id, loai_thiet_bi_id, muc_do, mo_ta, trang_thai, thoi_gian_gui, thoi_gian_cap_nhat)
                      VALUES ('YC-2026-0001', ?, ?, ?, ?, 'BINH_THUONG', 'Máy chiếu không lên hình', 'MOI', ?, ?)`).run(nd.an.id, id.p301, id.tb, id.mc, t, t).lastInsertRowid;
  db.prepare(`INSERT INTO lich_su_xu_ly (yeu_cau_id, nguoi_thuc_hien_id, tu_trang_thai, den_trang_thai, noi_dung, thoi_gian) VALUES (?, ?, NULL, 'MOI', 'Gửi yêu cầu', ?)`).run(id.yc, nd.an.id, t);
  lam(nd.ql, id.yc, 'phanCong', { ktv_id: nd.binh.id, han: gioVN(new Date(Date.now() + 48 * 3600e3)).slice(0, 16).replace(' ', 'T') });

  server = app.listen(0, '127.0.0.1');
  await new Promise((ok) => server.once('listening', ok));
  goc = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => { server.close(); fs.rmSync(THU_MUC_TAM, { recursive: true, force: true }); });

// ---------------------------------------------------------------- Công cụ
const dem = (sql, ...ts) => layCsdl().prepare(sql).get(...ts).n;
const thanTrang = async (r) => (await r.text()).replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

async function dangNhap(email, matKhau = MAT_KHAU) {
  const r = await fetch(`${goc}/dang-nhap`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, mat_khau: matKhau }),
  });
  if (r.status !== 302) return { dangNhapDuoc: false, trangThai: r.status, thanTrang: await thanTrang(r) };
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const gui = (duong, tuyChon = {}) => fetch(goc + duong, { redirect: 'manual', ...tuyChon, headers: { ...(tuyChon.headers || {}), cookie } });
  return {
    dangNhapDuoc: true,
    get: (duong) => gui(duong),
    post: (duong, truong = {}) => {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(truong)) [].concat(v).forEach((x) => p.append(k, x));
      return gui(duong, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: p });
    },
    // POST rồi theo chuyển hướng để đọc thông báo flash
    postRoiXem: async (duong, truong) => {
      const r2 = await (async () => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(truong || {})) [].concat(v).forEach((x) => p.append(k, x)); return gui(duong, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: p }); })();
      assert.equal(r2.status, 302, `POST ${duong} phải chuyển hướng`);
      return gui(r2.headers.get('location'));
    },
  };
}

const DUONG_DAN_QL = ['/quan-ly/phan-cong', '/quan-ly/phan-cong?tab=cong-viec', '/quan-ly/co-so-vat-chat', '/quan-ly/co-so-vat-chat?tab=phong',
  '/quan-ly/co-so-vat-chat?tab=loai', '/quan-ly/co-so-vat-chat?tab=thiet-bi', '/quan-ly/ky-thuat-vien'];

// ---------------------------------------------------------------- Quyền (BR-02)
test('chưa đăng nhập thì chuyển về đăng nhập; SV và KTV gõ thẳng đường dẫn Q03/Q04/Q05 bị chặn 403', async () => {
  for (const duong of DUONG_DAN_QL) {
    const r = await fetch(goc + duong, { redirect: 'manual' });
    assert.equal(r.status, 302);
    assert.equal(new URL(r.headers.get('location'), goc).pathname, '/dang-nhap');
  }
  for (const email of [nd.an.email, nd.binh.email]) {
    const p = await dangNhap(email);
    for (const duong of DUONG_DAN_QL) assert.equal((await p.get(duong)).status, 403, `${email} ${duong}`);
    // POST ghi dữ liệu cũng bị chặn, và không có gì thay đổi
    assert.equal((await p.post('/quan-ly/co-so-vat-chat/nha', { ma_nha: 'X9', ten_nha: 'Nhà X9' })).status, 403);
    assert.equal((await p.post(`/quan-ly/co-so-vat-chat/phong/${id.p301}/xoa`)).status, 403);
    assert.equal((await p.post(`/quan-ly/ky-thuat-vien/${nd.binh.id}/khoa`)).status, 403);
    assert.equal((await p.post('/quan-ly/ky-thuat-vien', { ho_ten: 'A B', email: 'ab@hust.edu.vn', mat_khau: '123456' })).status, 403);
    assert.equal((await p.post(`/quan-ly/phan-cong/khu-vuc/${nd.binh.id}`, { nha: [] })).status, 403);
  }
  assert.equal(dem(`SELECT COUNT(*) n FROM toa_nha WHERE ma_nha = 'X9'`), 0);
  assert.equal(dem('SELECT COUNT(*) n FROM phong WHERE id = ?', id.p301), 1);
  assert.equal(dem('SELECT COUNT(*) n FROM khu_vuc_phu_trach WHERE ktv_id = ?', nd.binh.id), 1);
});

test('QL mở được các trang Q03, Q04, Q05 (kể cả các tab)', async () => {
  const ql = await dangNhap(nd.ql.email);
  for (const duong of DUONG_DAN_QL) {
    const r = await ql.get(duong);
    assert.equal(r.status, 200, duong);
  }
  let html = await thanTrang(await ql.get('/quan-ly/phan-cong'));
  assert.match(html, /Khu vực phụ trách/);
  assert.match(html, /Xem theo nhà/);
  assert.match(html, /ktv\.|binh@hust\.edu\.vn/);
  html = await thanTrang(await ql.get('/quan-ly/phan-cong?tab=cong-viec'));
  assert.match(html, /YC-2026-0001/);
  assert.match(html, /Hiện cả bản ghi cũ/);
  html = await thanTrang(await ql.get('/quan-ly/co-so-vat-chat?tab=thiet-bi'));
  assert.match(html, /MC-D3301-01/);
  assert.match(html, /Số lần sửa/);
  // Trang Q06 vẫn là trang tạm (đợt 6)
  assert.match(await thanTrang(await ql.get('/quan-ly/so-tiep-nhan')), /đang được xây dựng/);
});

// ---------------------------------------------------------------- Q04
test('Q04: thêm nhà → hiện thông báo; thêm trùng mã → báo lỗi ngay dưới ô và giữ giá trị đã nhập', async () => {
  const ql = await dangNhap(nd.ql.email);
  const html = await thanTrang(await ql.postRoiXem('/quan-ly/co-so-vat-chat/nha?tab=nha', { ma_nha: 'D8', ten_nha: 'Nhà D8' }));
  assert.match(html, /Đã thêm nhà D8\./);
  assert.equal(dem(`SELECT COUNT(*) n FROM toa_nha WHERE ma_nha = 'D8'`), 1);

  const r = await ql.post('/quan-ly/co-so-vat-chat/nha?tab=nha', { ma_nha: 'd3', ten_nha: 'Nhà trùng' });
  assert.equal(r.status, 422);
  const loi = await thanTrang(r);
  assert.match(loi, /id="loi-ma_nha">Mã nhà D3 đã tồn tại</);
  assert.match(loi, /value="d3"/, 'giữ lại giá trị đã nhập');
  assert.equal(dem('SELECT COUNT(*) n FROM toa_nha'), 2);
});

test('Q04: thêm phòng, thiết bị rồi xem ở tab Thiết bị và Hồ sơ thiết bị', async () => {
  const ql = await dangNhap(nd.ql.email);
  const d8 = layCsdl().prepare(`SELECT id FROM toa_nha WHERE ma_nha = 'D8'`).get().id;
  let html = await thanTrang(await ql.postRoiXem('/quan-ly/co-so-vat-chat/phong?tab=phong', { nha_id: d8, ma_phong: '101', tang: '1', loai_phong: 'Phòng học' }));
  assert.match(html, /Đã thêm phòng D8-101\./);
  const phong = layCsdl().prepare('SELECT id FROM phong WHERE toa_nha_id = ?').get(d8).id;
  html = await thanTrang(await ql.postRoiXem('/quan-ly/co-so-vat-chat/thiet-bi?tab=thiet-bi', {
    ma_tai_san: 'MC-D8101-01', ten_thiet_bi: 'Máy chiếu', loai_thiet_bi_id: id.mc, phong_id: phong, model_hang: 'Epson EB-X51', nam_su_dung: '2024', han_bao_hanh: '2027-06-30',
  }));
  assert.match(html, /Đã thêm thiết bị MC-D8101-01\./);
  assert.match(html, /MC-D8101-01/);

  const tb = layCsdl().prepare(`SELECT id FROM thiet_bi WHERE ma_tai_san = 'MC-D8101-01'`).get().id;
  html = await thanTrang(await ql.get(`/quan-ly/co-so-vat-chat?tab=thiet-bi&ho-so=${tb}`));
  assert.match(html, /Hồ sơ thiết bị MC-D8101-01/);
  assert.match(html, /Epson EB-X51/);
  assert.match(html, /30\/06\/2027/, 'hạn bảo hành hiển thị dd/mm/yyyy');
  assert.match(html, /chưa có lần sửa chữa nào/);

  // Hồ sơ của thiết bị đã có yêu cầu: có dòng lịch sử, mã yêu cầu liên kết sang Q02
  html = await thanTrang(await ql.get(`/quan-ly/co-so-vat-chat?tab=thiet-bi&ho-so=${id.tb}`));
  assert.match(html, new RegExp(`href="/quan-ly/yeu-cau/${id.yc}"`));
  assert.match(html, /Đang xử lý \(Đã phân công\)/);
});

test('Q04: xóa phòng đã có yêu cầu bị chặn (chỉ ngừng sử dụng); phòng chưa dùng xóa được', async () => {
  const ql = await dangNhap(nd.ql.email);
  const html = await thanTrang(await ql.postRoiXem(`/quan-ly/co-so-vat-chat/phong/${id.p301}/xoa?tab=phong`));
  assert.match(html, /Không xóa được phòng D3-301: đã có 1 yêu cầu tham chiếu/);
  assert.match(html, /Ngừng sử dụng/);
  assert.equal(dem('SELECT COUNT(*) n FROM phong WHERE id = ?', id.p301), 1);

  // Ngừng nhà D3 khi phòng còn dùng -> chặn; ngừng phòng khi còn thiết bị chưa thanh lý -> chặn
  assert.match(await thanTrang(await ql.postRoiXem(`/quan-ly/co-so-vat-chat/nha/${id.d3}/ngung?tab=nha`)), /còn 1 phòng đang sử dụng/);
  assert.match(await thanTrang(await ql.postRoiXem(`/quan-ly/co-so-vat-chat/phong/${id.p301}/ngung?tab=phong`)), /còn 1 thiết bị chưa thanh lý/);

  // Phòng D8-101 (có thiết bị mới, chưa yêu cầu): xóa thiết bị rồi phòng
  const tb = layCsdl().prepare(`SELECT id FROM thiet_bi WHERE ma_tai_san = 'MC-D8101-01'`).get().id;
  const phong = layCsdl().prepare(`SELECT phong_id FROM thiet_bi WHERE id = ?`).get(tb).phong_id;
  assert.match(await thanTrang(await ql.postRoiXem(`/quan-ly/co-so-vat-chat/phong/${phong}/xoa?tab=phong`)), /còn 1 thiết bị đặt trong phòng/);
  assert.match(await thanTrang(await ql.postRoiXem(`/quan-ly/co-so-vat-chat/thiet-bi/${tb}/xoa?tab=thiet-bi`)), /Đã xóa thiết bị MC-D8101-01\./);
  assert.match(await thanTrang(await ql.postRoiXem(`/quan-ly/co-so-vat-chat/phong/${phong}/xoa?tab=phong`)), /Đã xóa phòng D8-101\./);
  assert.equal(dem('SELECT COUNT(*) n FROM phong WHERE id = ?', phong), 0);
});

test('Q04: id không có / mục không có → 404; mở form sửa hiện sẵn giá trị', async () => {
  const ql = await dangNhap(nd.ql.email);
  assert.equal((await ql.post('/quan-ly/co-so-vat-chat/phong/99999/xoa')).status, 404);
  assert.equal((await ql.post('/quan-ly/co-so-vat-chat/khong-co')).status, 404);
  assert.equal((await ql.post('/quan-ly/co-so-vat-chat/nha/abc/ngung')).status, 404);
  const html = await thanTrang(await ql.get(`/quan-ly/co-so-vat-chat?tab=thiet-bi&sua=${id.tb}`));
  assert.match(html, /Sửa thiết bị/);
  assert.match(html, /value="MC-D3301-01"/);
  assert.match(html, /value="Epson EB-X51"/);
});

// ---------------------------------------------------------------- Q05
test('Q05: thêm KTV (đăng nhập được bằng mật khẩu ban đầu); email sai đuôi / trùng / mật khẩu ngắn báo lỗi dưới ô', async () => {
  const ql = await dangNhap(nd.ql.email);
  let r = await ql.post('/quan-ly/ky-thuat-vien', { ho_ten: 'Vũ Văn Nam', email: 'nam@gmail.com', so_dien_thoai: '', mat_khau: '123' });
  assert.equal(r.status, 422);
  let html = await thanTrang(r);
  assert.match(html, /id="loi-email">Email kỹ thuật viên phải có đuôi @hust\.edu\.vn</);
  assert.match(html, /id="loi-mat_khau">Mật khẩu ban đầu cần ít nhất 6 ký tự</);
  assert.doesNotMatch(html, /value="123"/, 'không in lại mật khẩu đã nhập');

  r = await ql.post('/quan-ly/ky-thuat-vien', { ho_ten: 'Vũ Văn Nam', email: 'binh@hust.edu.vn', mat_khau: 'matkhau9' });
  assert.equal(r.status, 422);
  assert.match(await thanTrang(r), /id="loi-email">Email binh@hust\.edu\.vn đã có tài khoản</);

  html = await thanTrang(await ql.postRoiXem('/quan-ly/ky-thuat-vien', { ho_ten: 'Vũ Văn Nam', email: 'nam@hust.edu.vn', so_dien_thoai: '0912345678', mat_khau: 'matkhau9' }));
  assert.match(html, /Đã thêm kỹ thuật viên Vũ Văn Nam\./);
  assert.match(html, /nam@hust\.edu\.vn/);

  const moi = await dangNhap('nam@hust.edu.vn', 'matkhau9');
  assert.ok(moi.dangNhapDuoc, 'KTV mới đăng nhập được bằng mật khẩu ban đầu');
  assert.equal((await moi.get('/ky-thuat-vien/viec')).status, 200);
});

test('Q05: không khóa KTV còn việc (báo phải đổi người trước); khóa KTV hết việc thì KTV đó không đăng nhập được', async () => {
  const ql = await dangNhap(nd.ql.email);
  let html = await thanTrang(await ql.postRoiXem(`/quan-ly/ky-thuat-vien/${nd.binh.id}/khoa`));
  assert.match(html, /Không khóa được Trần Văn Bình: còn 1 việc đang làm.*Hãy đổi người phụ trách các việc đó trước\./);
  assert.equal(layCsdl().prepare('SELECT trang_thai FROM nguoi_dung WHERE id = ?').get(nd.binh.id).trang_thai, 'HOAT_DONG', 'KTV còn việc vẫn hoạt động');

  const phienHoa = await dangNhap(nd.hoa.email); // Hoa đang đăng nhập khi bị khóa
  assert.equal((await phienHoa.get('/ky-thuat-vien/viec')).status, 200);
  html = await thanTrang(await ql.postRoiXem(`/quan-ly/ky-thuat-vien/${nd.hoa.id}/khoa`));
  assert.match(html, /Đã khóa tài khoản Lê Thị Hoa\./);
  assert.match(html, /Mở khóa/);

  const dn = await dangNhap(nd.hoa.email);
  assert.equal(dn.dangNhapDuoc, false);
  assert.equal(dn.trangThai, 403);
  assert.match(dn.thanTrang, /Tài khoản đã bị khóa/);
  assert.notEqual((await phienHoa.get('/ky-thuat-vien/viec')).status, 200, 'phiên đang mở của KTV bị khóa mất hiệu lực');

  html = await thanTrang(await ql.postRoiXem(`/quan-ly/ky-thuat-vien/${nd.hoa.id}/mo-khoa`));
  assert.match(html, /Đã mở khóa tài khoản Lê Thị Hoa\./);
  assert.ok((await dangNhap(nd.hoa.email)).dangNhapDuoc);
});

// ---------------------------------------------------------------- Q03
test('Q03: sửa khu vực phụ trách → bảng và "Xem theo nhà" đổi; nhà chưa có KTV bị tô cảnh báo', async () => {
  const ql = await dangNhap(nd.ql.email);
  const d8 = layCsdl().prepare(`SELECT id FROM toa_nha WHERE ma_nha = 'D8'`).get().id;

  let html = await thanTrang(await ql.get('/quan-ly/phan-cong'));
  assert.match(html, /dong-canh-bao[\s\S]*?D8[\s\S]*?Chưa có KTV phụ trách/);

  html = await thanTrang(await ql.get(`/quan-ly/phan-cong?tab=khu-vuc&sua=${nd.hoa.id}`));
  assert.match(html, /Sửa khu vực – Lê Thị Hoa/);
  assert.match(html, new RegExp(`name="nha" value="${d8}"`));

  html = await thanTrang(await ql.postRoiXem(`/quan-ly/phan-cong/khu-vuc/${nd.hoa.id}`, { nha: [String(d8)] }));
  assert.match(html, /Đã cập nhật khu vực phụ trách của Lê Thị Hoa: 1 nhà\./);
  assert.doesNotMatch(html, /Chưa có KTV phụ trách/);
  assert.equal(dem('SELECT COUNT(*) n FROM khu_vuc_phu_trach WHERE ktv_id = ? AND toa_nha_id = ?', nd.hoa.id, d8), 1);

  // Bỏ hết ô đánh dấu (không gửi trường nha) -> bỏ hết khu vực
  html = await thanTrang(await ql.postRoiXem(`/quan-ly/phan-cong/khu-vuc/${nd.hoa.id}`, {}));
  assert.match(html, /Đã bỏ hết khu vực phụ trách của Lê Thị Hoa\./);
  assert.match(html, /Chưa có KTV phụ trách/);

  // Nhà không tồn tại -> báo lỗi, giữ nguyên
  html = await thanTrang(await ql.postRoiXem(`/quan-ly/phan-cong/khu-vuc/${nd.binh.id}`, { nha: ['99999'] }));
  assert.match(html, /Nhà được chọn không tồn tại/);
  assert.equal(dem('SELECT COUNT(*) n FROM khu_vuc_phu_trach WHERE ktv_id = ?', nd.binh.id), 1);
  assert.equal((await ql.post('/quan-ly/phan-cong/khu-vuc/99999', {})).status, 404);
});

test('Q03: tab Công việc đã giao có liên kết sang Q02; lọc theo KTV; ô "Hiện cả bản ghi cũ"', async () => {
  const ql = await dangNhap(nd.ql.email);
  let html = await thanTrang(await ql.get('/quan-ly/phan-cong?tab=cong-viec'));
  assert.match(html, new RegExp(`href="/quan-ly/yeu-cau/${id.yc}"`));
  assert.match(html, /D3-301/);
  assert.doesNotMatch(html, /Hết hiệu lực/);

  html = await thanTrang(await ql.get(`/quan-ly/phan-cong?tab=cong-viec&ktv=${nd.hoa.id}`));
  assert.match(html, /Chưa có công việc nào khớp/);

  lam(nd.ql, id.yc, 'doiKtv', { ktv_id: nd.hoa.id, han: gioVN(new Date(Date.now() + 48 * 3600e3)).slice(0, 16).replace(' ', 'T') });
  html = await thanTrang(await ql.get('/quan-ly/phan-cong?tab=cong-viec&cu=1'));
  assert.match(html, /Hết hiệu lực/);
  assert.match(html, /Trần Văn Bình/);
  assert.match(html, /Lê Thị Hoa/);
  html = await thanTrang(await ql.get('/quan-ly/phan-cong?tab=cong-viec'));
  assert.doesNotMatch(html, /Hết hiệu lực/);
});
