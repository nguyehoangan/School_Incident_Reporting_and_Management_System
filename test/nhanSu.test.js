// Test cho services/nhanSu.js (Q05 tài khoản KTV, Q03 khu vực phụ trách) và truy vấn của Q03 / Q05.
// Đặc biệt: đổi khu vực phụ trách thì gợi ý phân công (yeuCau.goiYKtv, mục 7.3) đổi theo; KTV bị khóa không được gợi ý.
// Chạy: npm test  (CSDL tạm, không đụng data/csvc.db)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');

const THU_MUC_TAM = fs.mkdtempSync(path.join(os.tmpdir(), 'csvc-ns-'));
process.env.DB_PATH = path.join(THU_MUC_TAM, 'test.db');

const { moCsdl, layCsdl } = require('../db');
const { gioVN } = require('../lib/thoiGian');
const nhanSu = require('../services/nhanSu');
const tv = require('../services/truyVanPhanCong');
const yeuCau = require('../services/yeuCau');
const { LoiNghiepVu } = yeuCau;
const lam = yeuCau.thucHienHanhDong;

const nd = {};
const nha = {};
const phong = {};
let loaiMC;
let soYC = 0;

function chan(fn, ma, mau) {
  assert.throws(fn, (e) => {
    assert.ok(e instanceof LoiNghiepVu, `phải là LoiNghiepVu, nhận được: ${e && e.stack}`);
    assert.equal(e.ma, ma, `mã lỗi: ${e.message}`);
    if (mau) assert.match(e.message, mau);
    return true;
  });
}
function loiO(fn) {
  try { fn(); } catch (e) {
    assert.ok(e instanceof LoiNghiepVu && e.ma === 422, `phải là lỗi 422, nhận được: ${e && e.stack}`);
    return e.loi;
  }
  assert.fail('đáng lẽ phải báo lỗi dữ liệu');
}

test.before(() => {
  const db0 = moCsdl(process.env.DB_PATH);
  db0.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  db0.close();
  const db = layCsdl();
  const them = db.prepare(`INSERT INTO nguoi_dung (email, mat_khau_hash, ho_ten, vai_tro, ma_so) VALUES (?, 'x', ?, ?, ?)`);
  const tao = (khoa, email, ten, vaiTro) => { nd[khoa] = { id: them.run(email, ten, vaiTro, khoa).lastInsertRowid, vai_tro: vaiTro, ho_ten: ten }; };
  tao('ql', 'ql@hust.edu.vn', 'Quản Lý', 'QUAN_LY');
  tao('binh', 'binh@hust.edu.vn', 'Trần Văn Bình', 'KY_THUAT_VIEN');
  tao('hoa', 'hoa@hust.edu.vn', 'Lê Thị Hoa', 'KY_THUAT_VIEN');
  tao('duc', 'duc@hust.edu.vn', 'Phạm Minh Đức', 'KY_THUAT_VIEN');
  tao('sv', 'an@sis.hust.edu.vn', 'Nguyễn Hoàng An', 'SINH_VIEN');

  const themNha = db.prepare('INSERT INTO toa_nha (ma_nha, ten_nha, dang_su_dung) VALUES (?, ?, ?)');
  const themPhong = db.prepare('INSERT INTO phong (toa_nha_id, ma_phong, tang) VALUES (?, ?, 1)');
  for (const [ma, dang] of [['D3', 1], ['D5', 1], ['D8', 1], ['CU', 0]]) {
    nha[ma] = themNha.run(ma, `Nhà ${ma}`, dang).lastInsertRowid;
    phong[ma] = themPhong.run(nha[ma], '101').lastInsertRowid;
  }
  loaiMC = db.prepare(`INSERT INTO loai_thiet_bi (ten_loai) VALUES ('Máy chiếu')`).run().lastInsertRowid;
  // Khu vực ban đầu: Bình D3 + D5, Đức D3, Hoa chưa có; D8 chưa ai phụ trách
  const kv = db.prepare('INSERT INTO khu_vuc_phu_trach (ktv_id, toa_nha_id) VALUES (?, ?)');
  kv.run(nd.binh.id, nha.D3); kv.run(nd.binh.id, nha.D5); kv.run(nd.duc.id, nha.D3);
});

test.after(() => fs.rmSync(THU_MUC_TAM, { recursive: true, force: true }));

function taoYC(maNha, mucDo = 'BINH_THUONG') {
  const db = layCsdl();
  const t = '2026-01-01 08:00:00';
  const ma = `YC-2026-${String(++soYC).padStart(4, '0')}`;
  const id = db.prepare(`INSERT INTO yeu_cau (ma_yeu_cau, sinh_vien_id, phong_id, thiet_bi_id, loai_thiet_bi_id, muc_do, mo_ta, trang_thai, thoi_gian_gui, thoi_gian_cap_nhat)
                         VALUES (?, ?, ?, NULL, ?, ?, 'Mô tả hư hỏng mẫu', 'MOI', ?, ?)`).run(ma, nd.sv.id, phong[maNha], loaiMC, mucDo, t, t).lastInsertRowid;
  db.prepare(`INSERT INTO lich_su_xu_ly (yeu_cau_id, nguoi_thuc_hien_id, tu_trang_thai, den_trang_thai, noi_dung, thoi_gian) VALUES (?, ?, NULL, 'MOI', 'Gửi yêu cầu', ?)`)
    .run(id, nd.sv.id, t);
  return id;
}
const hanMai = () => gioVN(new Date(Date.now() + 24 * 3600e3)).slice(0, 16).replace(' ', 'T');
const giaoViec = (id, ktv) => lam(nd.ql, id, 'phanCong', { ktv_id: nd[ktv].id, han: hanMai() });
const trangThaiKtv = (khoa) => layCsdl().prepare('SELECT trang_thai FROM nguoi_dung WHERE id = ?').get(nd[khoa].id).trang_thai;
const khuVucCua = (khoa) => layCsdl().prepare('SELECT t.ma_nha FROM khu_vuc_phu_trach k JOIN toa_nha t ON t.id = k.toa_nha_id WHERE k.ktv_id = ? ORDER BY t.id')
  .all(nd[khoa].id).map((r) => r.ma_nha);
const goiY = (idYC) => yeuCau.goiYKtv(idYC);

// ---------------------------------------------------------------- Quyền
test('chỉ Quản lý được thêm / sửa / khóa KTV và đổi khu vực phụ trách', () => {
  for (const nguoi of [nd.sv, nd.binh, null]) {
    chan(() => nhanSu.themKtv(nguoi, { ho_ten: 'Hacker', email: 'h@hust.edu.vn', mat_khau: '123456' }), 403);
    chan(() => nhanSu.suaKtv(nguoi, nd.hoa.id, { ho_ten: 'Đổi tên' }), 403);
    chan(() => nhanSu.khoaKtv(nguoi, nd.hoa.id), 403);
    chan(() => nhanSu.moKhoaKtv(nguoi, nd.hoa.id), 403);
    chan(() => nhanSu.datKhuVuc(nguoi, nd.hoa.id, [nha.D8]), 403);
  }
  assert.equal(trangThaiKtv('hoa'), 'HOAT_DONG');
  assert.deepEqual(khuVucCua('hoa'), []);
});

// ---------------------------------------------------------------- Thêm / sửa KTV
test('thêm KTV: email đuôi @hust.edu.vn và chưa tồn tại, mật khẩu ≥ 6 ký tự và được băm bcrypt', () => {
  const kq = nhanSu.themKtv(nd.ql, { ho_ten: '  Vũ  Văn Nam ', email: 'KTV.Nam@Hust.edu.vn', so_dien_thoai: '0912 345 678', mat_khau: 'matkhau1' });
  const dong = layCsdl().prepare('SELECT * FROM nguoi_dung WHERE id = ?').get(kq.id);
  assert.equal(dong.vai_tro, 'KY_THUAT_VIEN');
  assert.equal(dong.trang_thai, 'HOAT_DONG');
  assert.equal(dong.email, 'ktv.nam@hust.edu.vn', 'email lưu chữ thường (đăng nhập cũng chuẩn hóa chữ thường)');
  assert.equal(dong.ho_ten, 'Vũ Văn Nam');
  assert.equal(dong.so_dien_thoai, '0912345678');
  assert.notEqual(dong.mat_khau_hash, 'matkhau1');
  assert.ok(dong.mat_khau_hash.startsWith('$2'), 'băm bcrypt');
  assert.ok(bcrypt.compareSync('matkhau1', dong.mat_khau_hash));
  assert.ok(!bcrypt.compareSync('sai-mat-khau', dong.mat_khau_hash));

  const base = { ho_ten: 'Người Mới', email: 'moi@hust.edu.vn', mat_khau: '123456' };
  assert.match(loiO(() => nhanSu.themKtv(nd.ql, { ...base, email: 'moi@gmail.com' })).email, /@hust\.edu\.vn/);
  assert.match(loiO(() => nhanSu.themKtv(nd.ql, { ...base, email: 'moi@sis.hust.edu.vn' })).email, /@hust\.edu\.vn/);
  assert.match(loiO(() => nhanSu.themKtv(nd.ql, { ...base, email: 'moi.hust.edu.vn' })).email, /@hust\.edu\.vn/);
  assert.ok(loiO(() => nhanSu.themKtv(nd.ql, { ...base, email: '' })).email);
  // Email đã có tài khoản (cả khác hoa thường, cả của vai trò khác) -> báo trùng
  assert.match(loiO(() => nhanSu.themKtv(nd.ql, { ...base, email: 'binh@hust.edu.vn' })).email, /đã có tài khoản/);
  assert.match(loiO(() => nhanSu.themKtv(nd.ql, { ...base, email: 'BINH@HUST.EDU.VN' })).email, /đã có tài khoản/);
  assert.match(loiO(() => nhanSu.themKtv(nd.ql, { ...base, email: 'ql@hust.edu.vn' })).email, /đã có tài khoản/);
  assert.match(loiO(() => nhanSu.themKtv(nd.ql, { ...base, email: 'ktv.nam@hust.edu.vn' })).email, /đã có tài khoản/);
  // Mật khẩu ngắn / thiếu, họ tên trống, số điện thoại sai
  assert.match(loiO(() => nhanSu.themKtv(nd.ql, { ...base, mat_khau: '12345' })).mat_khau, /ít nhất 6/);
  assert.ok(loiO(() => nhanSu.themKtv(nd.ql, { ...base, mat_khau: '' })).mat_khau);
  assert.ok(loiO(() => nhanSu.themKtv(nd.ql, { ...base, ho_ten: ' ' })).ho_ten);
  assert.ok(loiO(() => nhanSu.themKtv(nd.ql, { ...base, so_dien_thoai: '12ab' })).so_dien_thoai);
  assert.equal(layCsdl().prepare(`SELECT COUNT(*) n FROM nguoi_dung WHERE email = 'moi@hust.edu.vn'`).get().n, 0, 'lỗi thì không tạo tài khoản');
});

test('sửa KTV: đổi họ tên, số điện thoại; không sửa được tài khoản không phải KTV', () => {
  nhanSu.suaKtv(nd.ql, nd.hoa.id, { ho_ten: 'Lê Thị Hoa (mới)', so_dien_thoai: '0987654321' });
  const d = layCsdl().prepare('SELECT ho_ten, so_dien_thoai, email FROM nguoi_dung WHERE id = ?').get(nd.hoa.id);
  assert.deepEqual({ ...d }, { ho_ten: 'Lê Thị Hoa (mới)', so_dien_thoai: '0987654321', email: 'hoa@hust.edu.vn' });
  nhanSu.suaKtv(nd.ql, nd.hoa.id, { ho_ten: 'Lê Thị Hoa', so_dien_thoai: '' });
  assert.equal(layCsdl().prepare('SELECT so_dien_thoai FROM nguoi_dung WHERE id = ?').get(nd.hoa.id).so_dien_thoai, null);
  assert.ok(loiO(() => nhanSu.suaKtv(nd.ql, nd.hoa.id, { ho_ten: '' })).ho_ten);
  chan(() => nhanSu.suaKtv(nd.ql, nd.sv.id, { ho_ten: 'Sinh viên' }), 404);
  chan(() => nhanSu.khoaKtv(nd.ql, nd.ql.id), 404);
});

// ---------------------------------------------------------------- Khóa / mở khóa
test('không khóa được KTV còn việc đang làm (Đã phân công / Đang xử lý); đổi người rồi thì khóa được', () => {
  const yc1 = taoYC('D3');
  giaoViec(yc1, 'binh'); // Đã phân công
  chan(() => nhanSu.khoaKtv(nd.ql, nd.binh.id), 409, /còn 1 việc đang làm.*đổi người/);
  assert.equal(trangThaiKtv('binh'), 'HOAT_DONG');

  const yc2 = taoYC('D5');
  giaoViec(yc2, 'binh');
  lam(nd.binh, yc2, 'batDau'); // Đang xử lý
  chan(() => nhanSu.khoaKtv(nd.ql, nd.binh.id), 409, /còn 2 việc đang làm/);

  lam(nd.ql, yc1, 'doiKtv', { ktv_id: nd.duc.id, han: hanMai() });
  chan(() => nhanSu.khoaKtv(nd.ql, nd.binh.id), 409, /còn 1 việc đang làm/); // vẫn còn yc2 đang xử lý
  assert.equal(tv.danhSachKtv().find((k) => k.id === nd.binh.id).dangLam, 1);

  // Chờ nghiệm thu không còn tính là "đang làm": báo kết quả xong thì khóa được
  lam(nd.binh, yc2, 'baoKetQua', { ket_qua: 'KHAC_PHUC_TAI_CHO', dong: [{ noi_dung: 'Thay bóng đèn', so_luong: '1', ghi_chu: '' }] });
  nhanSu.khoaKtv(nd.ql, nd.binh.id);
  assert.equal(trangThaiKtv('binh'), 'KHOA');
  chan(() => nhanSu.khoaKtv(nd.ql, nd.binh.id), 409, /đã bị khóa/);

  nhanSu.moKhoaKtv(nd.ql, nd.binh.id);
  assert.equal(trangThaiKtv('binh'), 'HOAT_DONG');
  chan(() => nhanSu.moKhoaKtv(nd.ql, nd.binh.id), 409, /không bị khóa/);
});

test('KTV bị khóa không xuất hiện trong gợi ý phân công, mở khóa thì có lại', () => {
  const yc = taoYC('D3');
  assert.ok(goiY(yc).some((k) => k.id === nd.hoa.id));
  nhanSu.khoaKtv(nd.ql, nd.hoa.id); // Hoa chưa có việc
  assert.ok(!goiY(yc).some((k) => k.id === nd.hoa.id), 'KTV bị khóa không được gợi ý');
  chan(() => giaoViec(yc, 'hoa'), 422, undefined); // BR-06: phân công chỉ chọn KTV đang hoạt động
  assert.equal(layCsdl().prepare('SELECT trang_thai FROM yeu_cau WHERE id = ?').get(yc).trang_thai, 'MOI');
  nhanSu.moKhoaKtv(nd.ql, nd.hoa.id);
  assert.ok(goiY(yc).some((k) => k.id === nd.hoa.id));
});

// ---------------------------------------------------------------- Khu vực phụ trách
test('đổi khu vực phụ trách làm gợi ý phân công đổi theo (mục 7.3)', () => {
  const ycD8 = taoYC('D8');
  // Chưa ai phụ trách D8 -> không ai được đánh dấu "Phụ trách" / gợi ý
  assert.ok(goiY(ycD8).every((k) => !k.phuTrach && !k.goiY));

  nhanSu.datKhuVuc(nd.ql, nd.hoa.id, [nha.D8, nha.D5]);
  assert.deepEqual(khuVucCua('hoa'), ['D5', 'D8']);
  let ds = goiY(ycD8);
  assert.equal(ds[0].id, nd.hoa.id, 'Hoa phụ trách D8 nên lên đầu');
  assert.ok(ds[0].phuTrach && ds[0].goiY);
  assert.match(ds[0].moTa, /^Phụ trách D5, D8 · đang làm \d+ việc$/);
  assert.ok(ds.slice(1).every((k) => !k.phuTrach));

  // Gán thêm Đức cho D8, bỏ D8 khỏi Hoa -> Đức lên đầu, Hoa xuống
  nhanSu.datKhuVuc(nd.ql, nd.duc.id, [nha.D3, nha.D8]);
  nhanSu.datKhuVuc(nd.ql, nd.hoa.id, [nha.D5]);
  ds = goiY(ycD8);
  assert.equal(ds[0].id, nd.duc.id);
  assert.ok(!ds.find((k) => k.id === nd.hoa.id).phuTrach);

  // Bỏ hết khu vực: không còn ai phụ trách D8
  nhanSu.datKhuVuc(nd.ql, nd.duc.id, [nha.D3]);
  assert.deepEqual(khuVucCua('duc'), ['D3']);
  assert.ok(goiY(ycD8).every((k) => !k.phuTrach));
  nhanSu.datKhuVuc(nd.ql, nd.hoa.id, []);
  assert.deepEqual(khuVucCua('hoa'), []);
  assert.match(goiY(ycD8).find((k) => k.id === nd.hoa.id).moTa, /^Chưa được giao khu vực/);
});

test('đặt khu vực: nhà không tồn tại / dữ liệu lạ bị từ chối; nhà đã ngừng không gán mới được nhưng đang giữ thì giữ / bỏ được', () => {
  assert.ok(loiO(() => nhanSu.datKhuVuc(nd.ql, nd.hoa.id, [99999])).nha);
  assert.ok(loiO(() => nhanSu.datKhuVuc(nd.ql, nd.hoa.id, ['abc'])).nha);
  assert.match(loiO(() => nhanSu.datKhuVuc(nd.ql, nd.hoa.id, [nha.CU])).nha, /đã ngừng sử dụng/);
  assert.deepEqual(khuVucCua('hoa'), [], 'lỗi thì giữ nguyên khu vực cũ');
  chan(() => nhanSu.datKhuVuc(nd.ql, nd.sv.id, [nha.D3]), 404);

  // Giá trị dạng chuỗi đơn (một ô đánh dấu) và trùng lặp đều được chấp nhận
  nhanSu.datKhuVuc(nd.ql, nd.hoa.id, String(nha.D8));
  assert.deepEqual(khuVucCua('hoa'), ['D8']);
  nhanSu.datKhuVuc(nd.ql, nd.hoa.id, [String(nha.D8), String(nha.D8)]);
  assert.deepEqual(khuVucCua('hoa'), ['D8']);

  // Đang giữ một nhà rồi nhà đó mới bị ngừng: lưu lại vẫn giữ được, bỏ đi cũng được
  layCsdl().prepare('INSERT INTO khu_vuc_phu_trach (ktv_id, toa_nha_id) VALUES (?, ?)').run(nd.hoa.id, nha.CU);
  nhanSu.datKhuVuc(nd.ql, nd.hoa.id, [nha.D8, nha.CU]);
  assert.deepEqual(khuVucCua('hoa'), ['D8', 'CU']);
  nhanSu.datKhuVuc(nd.ql, nd.hoa.id, [nha.D8]);
  assert.deepEqual(khuVucCua('hoa'), ['D8']);
  nhanSu.datKhuVuc(nd.ql, nd.hoa.id, []);
});

// ---------------------------------------------------------------- Truy vấn Q03
test('Q03: bảng khu vực (việc đang làm, quá hạn) và "Xem theo nhà" cảnh báo nhà chưa có KTV', () => {
  const db = layCsdl();
  nhanSu.datKhuVuc(nd.ql, nd.binh.id, [nha.D3, nha.D5]);
  nhanSu.datKhuVuc(nd.ql, nd.duc.id, [nha.D3]);

  let theoNha = tv.xemTheoNha();
  const d8 = theoNha.find((n) => n.ma === 'D8');
  assert.ok(d8.canhBao, 'D8 chưa có KTV phụ trách -> cảnh báo');
  assert.deepEqual(d8.ktv, []);
  assert.ok(!theoNha.find((n) => n.ma === 'D3').canhBao);
  assert.ok(!theoNha.some((n) => n.ma === 'CU'), 'nhà đã ngừng và hết yêu cầu chưa xong thì không hiện');
  assert.ok(theoNha.find((n) => n.ma === 'D3').chuaXong >= 1);

  // Nhà đã ngừng nhưng còn yêu cầu chưa xong vẫn hiện
  taoYC('CU');
  assert.ok(tv.xemTheoNha().some((n) => n.ma === 'CU'));

  // Gán D8 cho Hoa -> hết cảnh báo; Hoa bị khóa -> lại cảnh báo (KTV khóa không tính là phụ trách)
  nhanSu.datKhuVuc(nd.ql, nd.hoa.id, [nha.D8]);
  assert.ok(!tv.xemTheoNha().find((n) => n.ma === 'D8').canhBao);
  assert.deepEqual(tv.xemTheoNha().find((n) => n.ma === 'D8').ktv, ['Lê Thị Hoa']);
  nhanSu.khoaKtv(nd.ql, nd.hoa.id);
  assert.ok(tv.xemTheoNha().find((n) => n.ma === 'D8').canhBao);
  nhanSu.moKhoaKtv(nd.ql, nd.hoa.id);

  // Quá hạn: sửa hạn của một phân công đang làm về quá khứ
  const yc = taoYC('D3');
  giaoViec(yc, 'duc');
  const truoc = tv.bangKhuVuc().find((k) => k.id === nd.duc.id);
  db.prepare('UPDATE phan_cong SET han_hoan_thanh = ? WHERE yeu_cau_id = ? AND con_hieu_luc = 1').run('2026-01-02 09:00:00', yc);
  const sau = tv.bangKhuVuc().find((k) => k.id === nd.duc.id);
  assert.equal(sau.quaHan, truoc.quaHan + 1);
  assert.equal(sau.dangLam, truoc.dangLam);
  assert.deepEqual(sau.nha.map((n) => n.ma), ['D3']);
});

test('Q03: công việc đã giao – lọc theo KTV / nhà / trạng thái, "hiện cả bản ghi cũ" cho thấy lịch sử đổi người', () => {
  const yc = taoYC('D5');
  giaoViec(yc, 'binh');
  lam(nd.ql, yc, 'doiKtv', { ktv_id: nd.duc.id, han: hanMai() });

  const loc = tv.tuyChonLocCongViec();
  const dsKtvId = loc.ktv.map((k) => k.id);
  const dsNhaId = loc.nha.map((n) => n.id);
  const doc = (q) => tv.docBoLocCongViec(q, { dsKtvId, dsNhaId });
  const ma = layCsdl().prepare('SELECT ma_yeu_cau FROM yeu_cau WHERE id = ?').get(yc).ma_yeu_cau;

  const hieuLuc = tv.congViecDaGiao(doc({})).dong.filter((r) => r.ma === ma);
  assert.equal(hieuLuc.length, 1, 'mỗi yêu cầu chỉ một bản ghi đang hiệu lực');
  assert.equal(hieuLuc[0].ktv, 'Phạm Minh Đức');
  assert.equal(hieuLuc[0].phong, 'D5-101');
  assert.ok(hieuLuc[0].hieuLuc);

  const tatCa = tv.congViecDaGiao(doc({ cu: '1' })).dong.filter((r) => r.ma === ma);
  assert.equal(tatCa.length, 2);
  assert.deepEqual(tatCa.map((r) => [r.ktv, r.hieuLuc]).sort(), [['Phạm Minh Đức', true], ['Trần Văn Bình', false]].sort());
  assert.ok(tatCa.filter((r) => !r.hieuLuc).every((r) => !r.quaHan), 'bản ghi hết hiệu lực không báo quá hạn');

  // Lọc: KTV, nhà, trạng thái; giá trị lạ bị bỏ qua
  assert.ok(tv.congViecDaGiao(doc({ ktv: String(nd.duc.id) })).dong.every((r) => r.ktv === 'Phạm Minh Đức'));
  assert.ok(tv.congViecDaGiao(doc({ nha: String(nha.D5) })).dong.every((r) => r.phong.startsWith('D5-')));
  assert.ok(tv.congViecDaGiao(doc({ tt: 'DANG_SUA' })).dong.every((r) => r.trangThai.ten === 'Đang xử lý'));
  assert.equal(doc({ ktv: '99999', nha: 'x', tt: 'LUNG_TUNG', trang: '-5' }).ktv, null);
  assert.equal(doc({ ktv: '99999', nha: 'x', tt: 'LUNG_TUNG', trang: '-5' }).tt, '');
  assert.equal(doc({ trang: '-5' }).trang, 1);
});
