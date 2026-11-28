// Test đợt 6: Q06 Sổ tiếp nhận thông báo sự cố (M.02, BR-15) và các trang in biểu mẫu /in/m01–m04 (quyền xem, nội dung).
// CSDL tạm, đi qua HTTP thật tới app Express. Chạy: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcrypt');

const THU_MUC_TAM = fs.mkdtempSync(path.join(os.tmpdir(), 'csvc-so-'));
process.env.DB_PATH = path.join(THU_MUC_TAM, 'test.db');

const { moCsdl, layCsdl } = require('../db');
{ // CSDL tạm phải có trước khi nạp app (app.js mở CSDL ngay khi nạp)
  const db0 = moCsdl(process.env.DB_PATH);
  db0.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  db0.close();
}
const { gioVN } = require('../lib/thoiGian');
const yeuCau = require('../services/yeuCau');
const so = require('../services/soTiepNhan');
const lam = yeuCau.thucHienHanhDong;
const app = require('../app');

const MAT_KHAU = '123456';
const nd = {};
const phong = {};
let loaiMC; let loaiDH;
let server; let goc;

test.before(async () => {
  const db = layCsdl();
  const hash = bcrypt.hashSync(MAT_KHAU, 4);
  const them = db.prepare(`INSERT INTO nguoi_dung (email, mat_khau_hash, ho_ten, vai_tro, ma_so, trang_thai) VALUES (?, ?, ?, ?, ?, 'HOAT_DONG')`);
  const tao = (khoa, email, ten, vaiTro, maSo) => { nd[khoa] = { id: them.run(email, hash, ten, vaiTro, maSo).lastInsertRowid, email, ho_ten: ten, vai_tro: vaiTro }; };
  tao('ql', 'quanly@hust.edu.vn', 'Nguyễn Thị Lan', 'QUAN_LY', 'NV1');
  tao('binh', 'binh@hust.edu.vn', 'Trần Văn Bình', 'KY_THUAT_VIEN', 'NV2');
  tao('hoa', 'hoa@hust.edu.vn', 'Lê Thị Hoa', 'KY_THUAT_VIEN', 'NV3');
  tao('an', 'an.nh225001@sis.hust.edu.vn', 'Nguyễn Hoàng An', 'SINH_VIEN', '20225001');
  tao('ha', 'ha.tt225002@sis.hust.edu.vn', 'Trần Thu Hà', 'SINH_VIEN', '20225002');

  for (const ma of ['D3', 'C7']) {
    const nha = db.prepare('INSERT INTO toa_nha (ma_nha, ten_nha) VALUES (?, ?)').run(ma, `Nhà ${ma}`).lastInsertRowid;
    phong[ma] = db.prepare(`INSERT INTO phong (toa_nha_id, ma_phong, tang) VALUES (?, ?, 1)`).run(nha, ma === 'D3' ? '301' : '102').lastInsertRowid;
  }
  loaiMC = db.prepare(`INSERT INTO loai_thiet_bi (ten_loai) VALUES ('Máy chiếu')`).run().lastInsertRowid;
  loaiDH = db.prepare(`INSERT INTO loai_thiet_bi (ten_loai) VALUES ('Điều hòa')`).run().lastInsertRowid;

  server = app.listen(0, '127.0.0.1');
  await new Promise((ok) => server.once('listening', ok));
  goc = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => {
  server.close();
  fs.rmSync(THU_MUC_TAM, { recursive: true, force: true });
});

// ---------------------------------------------------------------- Công cụ
const BIEN_BAN = { ket_qua: 'KHONG_KHAC_PHUC', tinh_trang_su_co: 'Máy nén không chạy', nguyen_nhan: 'Hỏng block', de_xuat: { thue_sua: 'Thay block, nạp gas' } };
let soYC = 0;
let soTB = 0;
// Tạo yêu cầu rồi đưa tới trạng thái mong muốn bằng chính services/yeuCau.js. ketQua chọn nhánh khi qua bước báo kết quả.
function taoYC({ tt = 'DA_PHAN_CONG', sv = 'an', ktv = 'binh', nha = 'D3', moTa = 'Máy chiếu không lên hình', coThietBi = true, ketQua = 'KHAC_PHUC_TAI_CHO' } = {}) {
  const db = layCsdl();
  const loai = nha === 'C7' ? loaiDH : loaiMC;
  let thietBi = null;
  if (coThietBi) {
    soTB += 1;
    thietBi = db.prepare(`INSERT INTO thiet_bi (ma_tai_san, ten_thiet_bi, loai_thiet_bi_id, phong_id, model_hang, nam_su_dung) VALUES (?, ?, ?, ?, 'Epson EB-X51', 2022)`)
      .run(`TB-${nha}-${soTB}`, nha === 'C7' ? 'Điều hòa' : 'Máy chiếu', loai, phong[nha]).lastInsertRowid;
  }
  const t = gioVN();
  const ma = `YC-2026-${String(++soYC).padStart(4, '0')}`;
  const id = db.prepare(`INSERT INTO yeu_cau (ma_yeu_cau, sinh_vien_id, phong_id, thiet_bi_id, loai_thiet_bi_id, muc_do, mo_ta,
                           trang_thai, thoi_gian_gui, thoi_gian_cap_nhat) VALUES (?, ?, ?, ?, ?, 'BINH_THUONG', ?, 'MOI', ?, ?)`)
    .run(ma, nd[sv].id, phong[nha], thietBi, loai, moTa, t, t).lastInsertRowid;
  if (tt === 'MOI') return { id, ma, thietBi };
  if (tt === 'TU_CHOI') { lam(nd.ql, id, 'tuChoi', { ly_do: 'Báo trùng yêu cầu khác' }); return { id, ma, thietBi }; }
  if (tt === 'DA_HUY') { lam(nd[sv], id, 'huy'); return { id, ma, thietBi }; }
  lam(nd.ql, id, 'phanCong', { ktv_id: nd[ktv].id, han: gioVN(new Date(Date.now() + 48 * 3600e3)).slice(0, 16).replace(' ', 'T') });
  if (tt === 'DA_PHAN_CONG') return { id, ma, thietBi };
  lam(nd[ktv], id, 'batDau');
  if (tt === 'DANG_SUA') return { id, ma, thietBi };
  lam(nd[ktv], id, 'baoKetQua', ketQua === 'KHAC_PHUC_TAI_CHO'
    ? { ket_qua: ketQua, dong: [{ noi_dung: 'Thay bóng đèn', so_luong: '1', ghi_chu: 'Bóng dự phòng kho' }, { noi_dung: 'Vệ sinh lọc gió', so_luong: '2' }] }
    : BIEN_BAN);
  if (tt === 'CHO_NGHIEM_THU') return { id, ma, thietBi };
  if (ketQua === 'KHAC_PHUC_TAI_CHO') { lam(nd.ql, id, 'nghiemThu'); return { id, ma, thietBi }; }
  lam(nd.ql, id, 'chuyenPhuongAn', { phuong_an: 'THUE_NGOAI', so_to_trinh: '45/TTr-QT' });
  if (tt === 'CHUYEN_XU_LY') return { id, ma, thietBi };
  lam(nd.ql, id, 'dong', { ket_qua_cuoi: 'Đơn vị sửa đã thay block', so_bien_ban_ban_giao: 'BB-12/2026', tinh_trang_thiet_bi: 'HOAT_DONG' });
  return { id, ma, thietBi };
}
const datNgayTiepNhan = (id, ngay) => layCsdl().prepare('UPDATE yeu_cau SET thoi_gian_tiep_nhan = ? WHERE id = ?').run(`${ngay} 08:30:00`, id);

async function dangNhap(khoa) {
  const r = await fetch(`${goc}/dang-nhap`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: nd[khoa].email, mat_khau: MAT_KHAU }),
  });
  assert.equal(r.status, 302, 'đăng nhập phải thành công');
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return { get: (duong) => fetch(goc + duong, { redirect: 'manual', headers: { cookie } }) };
}
const thanTrang = async (r) => (await r.text()).replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// ================================================================ Q06 – sổ M.02 (service)
test('Q06 chỉ lấy yêu cầu đã tiếp nhận: bỏ Đã gửi, Từ chối, Đã hủy; đủ 5 trạng thái sau tiếp nhận', () => {
  const moi = taoYC({ tt: 'MOI', moTa: 'SO-MOI' });
  const tuChoi = taoYC({ tt: 'TU_CHOI', moTa: 'SO-TUCHOI' });
  const huy = taoYC({ tt: 'DA_HUY', moTa: 'SO-HUY' });
  const coDong = ['DA_PHAN_CONG', 'DANG_SUA', 'CHO_NGHIEM_THU', 'CHUYEN_XU_LY', 'HOAN_THANH']
    .map((tt) => taoYC({ tt, ketQua: tt === 'CHUYEN_XU_LY' ? 'KHONG_KHAC_PHUC' : 'KHAC_PHUC_TAI_CHO' }));

  const ds = so.danhSach({ tu: '', den: '', nha: '' });
  const ma = ds.map((d) => d.ma);
  for (const y of coDong) assert.ok(ma.includes(y.ma), `${y.ma} đã tiếp nhận phải có trong sổ`);
  for (const y of [moi, tuChoi, huy]) assert.ok(!ma.includes(y.ma), `${y.ma} không được có trong sổ`);
  // Không lưu bảng riêng (BR-15): đổi dữ liệu yêu cầu thì sổ đổi theo ngay
  layCsdl().prepare('UPDATE yeu_cau SET mo_ta = ? WHERE id = ?').run('Mô tả đã sửa ở yêu cầu', coDong[0].id);
  assert.equal(so.danhSach({ tu: '', den: '', nha: '' }).find((d) => d.ma === coDong[0].ma).tinhTrang, 'Mô tả đã sửa ở yêu cầu');
  // STT liên tục từ 1
  assert.deepEqual(ds.map((d) => d.stt), ds.map((_, i) => i + 1));
});

test('Q06: nội dung các cột đúng mẫu M.02 (xác nhận, ngày hoàn thành, ghi chú theo kết quả / phương án)', () => {
  const xong = taoYC({ tt: 'HOAN_THANH' });
  const cxl = taoYC({ tt: 'CHUYEN_XU_LY', nha: 'C7', ketQua: 'KHONG_KHAC_PHUC' });
  const dong = taoYC({ tt: 'HOAN_THANH', nha: 'C7', ketQua: 'KHONG_KHAC_PHUC' });
  const dangLam = taoYC({ tt: 'DANG_SUA', coThietBi: false });
  const ds = so.danhSach({ tu: '', den: '', nha: '' });
  const d = (y) => ds.find((x) => x.ma === y.ma);

  assert.equal(so.COT.length, 8);
  assert.deepEqual(so.COT, ['STT', 'Ngày tháng', 'Thiết bị gặp sự cố', 'Đơn vị sử dụng', 'Tình trạng sự cố', 'Xác nhận', 'Ngày hoàn thành xử lý sự cố', 'Ghi chú']);
  assert.match(d(xong).ngay, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.equal(d(xong).donVi, 'D3-301');
  assert.equal(d(xong).xacNhan, 'N.T. Lan');
  assert.equal(d(xong).xacNhanDayDu, 'Nguyễn Thị Lan');
  assert.match(d(xong).ngayHoanThanh, /^\d{2}\/\d{2}\/\d{4}$/);
  assert.equal(d(xong).ghiChu, 'Thay bóng đèn; Vệ sinh lọc gió × 2');
  assert.equal(d(cxl).ngayHoanThanh, '');
  assert.equal(d(cxl).ghiChu, 'Chuyển phương án: Thuê đơn vị sửa, tờ trình 45/TTr-QT');
  assert.equal(d(dong).ghiChu, 'Thuê đơn vị sửa: Đơn vị sửa đã thay block · BB M.10 số BB-12/2026');
  assert.match(d(dangLam).ghiChu, /^Giao Trần Văn Bình, hạn \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  assert.equal(d(dangLam).thietBi, 'Máy chiếu (không trong DS)');
});

test('Q06: lọc theo khoảng ngày tiếp nhận và nhà; tham số sai bị bỏ qua; mặc định tháng này', () => {
  const a = taoYC({ nha: 'D3' }); datNgayTiepNhan(a.id, '2025-03-10');
  const b = taoYC({ nha: 'C7' }); datNgayTiepNhan(b.id, '2025-03-20');
  const c = taoYC({ nha: 'D3' }); datNgayTiepNhan(c.id, '2025-04-02');
  const ma = (boLoc) => so.danhSach(boLoc).map((d) => d.ma);

  let r = ma(so.docBoLoc({ tu: '2025-03-01', den: '2025-03-31' }));
  assert.ok(r.includes(a.ma) && r.includes(b.ma) && !r.includes(c.ma));
  r = ma(so.docBoLoc({ tu: '2025-03-01', den: '2025-03-31', nha: 'C7' }));
  assert.deepEqual(r, [b.ma]);
  r = ma(so.docBoLoc({ tu: '2025-03-20', den: '2025-03-20' }));
  assert.deepEqual(r, [b.ma], 'ngày cuối tính cả ngày');
  // Đảo ngược khoảng ngày thì tự đổi chỗ; nhà không tồn tại / ngày sai thì bỏ
  assert.deepEqual(so.docBoLoc({ tu: '2025-03-31', den: '2025-03-01', nha: 'XX' }), { tu: '2025-03-01', den: '2025-03-31', nha: '' });
  assert.deepEqual(so.docBoLoc({ tu: '2025-02-30', den: 'abc' }), { tu: '', den: '', nha: '' });
  // Lần đầu mở (không có tu / den): tháng này
  const homNay = gioVN().slice(0, 10);
  assert.deepEqual(so.docBoLoc({}), { tu: `${homNay.slice(0, 7)}-01`, den: homNay, nha: '' });
  assert.ok(!ma(so.docBoLoc({})).includes(a.ma));
  // Xóa trống cả hai ô = mọi ngày
  assert.ok(ma(so.docBoLoc({ tu: '', den: '' })).includes(a.ma));
});

test('Q06 Xuất Excel: CSV có BOM UTF-8, đủ 8 cột, ô có dấu phẩy / ngoặc kép được bọc, ô bắt đầu bằng "=" không thành công thức', () => {
  const csv = so.xuatCsv([
    { stt: 1, ngay: '20/11/2026', thietBi: 'Quạt trần QT-D5204-02', donVi: 'D5-204', tinhTrang: 'Quay chậm, kêu "lạch cạch"', xacNhanDayDu: 'Nguyễn Thị Lan', ngayHoanThanh: '', ghiChu: '' },
    { stt: 2, ngay: '21/11/2026', thietBi: 'Đèn', donVi: 'D3-301', tinhTrang: '=HYPERLINK("x")', xacNhanDayDu: 'Lan', ngayHoanThanh: '22/11/2026', ghiChu: 'Thay bóng' },
  ]);
  assert.ok(csv.startsWith('﻿'), 'có BOM');
  const dong = csv.slice(1).split('\r\n');
  assert.equal(dong[0], '"STT","Ngày tháng","Thiết bị gặp sự cố","Đơn vị sử dụng","Tình trạng sự cố","Xác nhận","Ngày hoàn thành xử lý sự cố","Ghi chú"');
  assert.equal(dong[1], '"1","20/11/2026","Quạt trần QT-D5204-02","D5-204","Quay chậm, kêu ""lạch cạch""","Nguyễn Thị Lan","",""');
  assert.ok(dong[2].includes(`"'=HYPERLINK(""x"")"`));
  assert.equal(dong[3], '', 'kết thúc bằng xuống dòng');
});

// ================================================================ Q06 – route
test('Q06: chỉ QL mở được trang sổ, xuất Excel, in sổ; SV / KTV bị 403', async () => {
  for (const khoa of ['an', 'binh']) {
    const p = await dangNhap(khoa);
    for (const duong of ['/quan-ly/so-tiep-nhan', '/quan-ly/so-tiep-nhan/xuat-excel', '/in/m02']) {
      assert.equal((await p.get(duong)).status, 403, `${khoa} ${duong}`);
    }
  }
  const chua = await fetch(`${goc}/in/m02`, { redirect: 'manual' });
  assert.equal(chua.status, 302);
});

test('Q06 trang + Xuất Excel + In sổ theo cùng bộ lọc; không có ô sửa', async () => {
  const a = taoYC({ nha: 'C7', moTa: 'Điều hòa không lạnh, có mùi khét' }); datNgayTiepNhan(a.id, '2024-05-15');
  const b = taoYC({ nha: 'D3', moTa: 'Máy chiếu nhòe chữ' }); datNgayTiepNhan(b.id, '2024-05-16');
  const tuChoi = taoYC({ tt: 'TU_CHOI', nha: 'C7', moTa: 'Yêu cầu bị từ chối' });
  layCsdl().prepare('UPDATE yeu_cau SET thoi_gian_gui = ? WHERE id = ?').run('2024-05-15 08:00:00', tuChoi.id);
  const ql = await dangNhap('ql');
  const loc = 'tu=2024-05-01&den=2024-05-31&nha=C7';

  const html = await thanTrang(await ql.get(`/quan-ly/so-tiep-nhan?${loc}`));
  assert.ok(html.includes('Điều hòa không lạnh, có mùi khét'));
  assert.ok(!html.includes('Máy chiếu nhòe chữ'), 'lọc theo nhà');
  assert.ok(!html.includes('Yêu cầu bị từ chối'));
  assert.ok(html.includes(`href="/in/m02?${loc}"`), 'nút In sổ giữ bộ lọc');
  assert.ok(html.includes(`href="/quan-ly/so-tiep-nhan/xuat-excel?${loc}"`), 'nút Xuất Excel giữ bộ lọc');
  const formPost = (html.match(/<form[^>]*method="post"[^>]*>/gi) || []).filter((f) => !f.includes('/dang-xuat'));
  assert.deepEqual(formPost, [], 'sổ chỉ xem, không có form sửa (trừ nút Đăng xuất ở đầu trang)');
  assert.ok(!html.includes('<input class="o-nhap"'), 'không có ô nhập');

  const r = await ql.get(`/quan-ly/so-tiep-nhan/xuat-excel?${loc}`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /^text\/csv; charset=utf-8/);
  assert.match(r.headers.get('content-disposition'), /attachment; filename="so-tiep-nhan-M02_\d{8}\.csv"/);
  const buf = Buffer.from(await r.arrayBuffer());
  assert.deepEqual([...buf.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'BOM UTF-8 ở 3 byte đầu');
  const csv = buf.toString('utf8');
  assert.ok(csv.includes('Điều hòa không lạnh, có mùi khét') && !csv.includes('Máy chiếu nhòe chữ'));
  assert.equal(csv.trim().split('\r\n').length, 2, 'tiêu đề + 1 dòng');

  const inSo = await thanTrang(await ql.get(`/in/m02?${loc}`));
  assert.ok(inSo.includes('SỔ TIẾP NHẬN THÔNG BÁO SỰ CỐ') && inSo.includes('M.02.QT&VT.06'));
  assert.ok(inSo.includes('ĐẠI HỌC BÁCH KHOA HÀ NỘI') && inSo.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'));
  assert.ok(inSo.includes('@page { size: A4 landscape; }'), 'sổ in khổ ngang');
  assert.ok(inSo.includes('Từ 01/05/2024 đến 31/05/2024 · Nhà C7'));
  assert.ok(inSo.includes('Điều hòa không lạnh, có mùi khét') && !inSo.includes('Máy chiếu nhòe chữ'));
  assert.ok(inSo.includes('id="nut-in"') && inSo.includes('/public/js/in.js'));
});

// ================================================================ Trang in M.01 / M.04 / M.03 – quyền
test('In M.01: SV chỉ in yêu cầu của mình; KTV chỉ in việc đang được giao; QL in mọi yêu cầu', async () => {
  const cuaAn = taoYC({ sv: 'an', ktv: 'binh', tt: 'DA_PHAN_CONG' });
  const cuaHa = taoYC({ sv: 'ha', ktv: 'hoa', tt: 'MOI' });
  const [an, binh, hoa, ql] = await Promise.all(['an', 'binh', 'hoa', 'ql'].map(dangNhap));

  assert.equal((await an.get(`/in/m01/${cuaAn.id}`)).status, 200);
  assert.equal((await an.get(`/in/m01/${cuaHa.id}`)).status, 404, 'SV in yêu cầu của người khác');
  assert.equal((await binh.get(`/in/m01/${cuaAn.id}`)).status, 200);
  assert.equal((await hoa.get(`/in/m01/${cuaAn.id}`)).status, 404, 'KTV không được giao');
  assert.equal((await binh.get(`/in/m01/${cuaHa.id}`)).status, 404, 'yêu cầu chưa phân công');
  assert.equal((await ql.get(`/in/m01/${cuaHa.id}`)).status, 200);
  assert.equal((await ql.get('/in/m01/999999')).status, 404);
  assert.equal((await ql.get('/in/m01/abc')).status, 404);
  assert.equal((await fetch(`${goc}/in/m01/${cuaAn.id}`, { redirect: 'manual' })).status, 302, 'chưa đăng nhập -> trang đăng nhập');

  // Đổi KTV: KTV cũ mất quyền in ngay (phân công cũ hết hiệu lực – BR-04)
  lam(nd.ql, cuaAn.id, 'doiKtv', { ktv_id: nd.hoa.id });
  assert.equal((await binh.get(`/in/m01/${cuaAn.id}`)).status, 404);
  assert.equal((await hoa.get(`/in/m01/${cuaAn.id}`)).status, 200);
});

test('In M.01: phần I từ yêu cầu SV gửi, phần II để trống khi chưa có; đủ 2 phần và tên người ký khi đã nghiệm thu; KTV không thấy email SV', async () => {
  const moi = taoYC({ tt: 'MOI', moTa: 'Đèn chiếu mờ, nhấp nháy' });
  const xong = taoYC({ tt: 'HOAN_THANH', moTa: 'Máy chiếu tắt đột ngột' });
  const [an, ql] = await Promise.all(['an', 'ql'].map(dangNhap));

  let html = await thanTrang(await an.get(`/in/m01/${moi.id}`));
  assert.ok(html.includes('M.01.QT&VT.06') && html.includes('PHIẾU YÊU CẦU SỬA CHỮA TRANG THIẾT BỊ'));
  assert.ok(html.includes('ĐẠI HỌC BÁCH KHOA HÀ NỘI') && html.includes('Độc lập - Tự do - Hạnh phúc'));
  assert.ok(html.includes('ĐƠN VỊ: Nhà D3 – Phòng D3-301'));
  assert.ok(html.includes('Nguyễn Hoàng An – MSSV 20225001 – an.nh225001@sis.hust.edu.vn'));
  assert.ok(html.includes('Đèn chiếu mờ, nhấp nháy') && html.includes('Bình thường'));
  assert.ok(html.includes('NGƯỜI ĐỀ NGHỊ') && html.includes('CÁN BỘ KỸ THUẬT') && html.includes('PHÒNG QUẢN LÝ CSVC'));
  assert.equal((html.match(/class="dong-trong"/g) || []).length, 3, 'phần II: 3 dòng trống để viết tay');
  assert.ok(html.includes('Ngày ..... tháng ..... năm 20.....'));
  assert.ok(html.includes(`href="/sinh-vien/yeu-cau/${moi.id}"`), 'Quay lại đúng trang của SV');

  html = await thanTrang(await ql.get(`/in/m01/${xong.id}`));
  assert.ok(html.includes('Thay bóng đèn') && html.includes('Bóng dự phòng kho') && html.includes('Vệ sinh lọc gió'));
  assert.ok(!html.includes('class="dong-trong"'));
  assert.ok(html.includes('Trần Văn Bình') && html.includes('Nguyễn Thị Lan'), 'tên KTV và QL nghiệm thu ở ô ký');
  assert.ok(html.includes(`href="/quan-ly/yeu-cau/${xong.id}"`));

  const binh = await dangNhap('binh');
  const dangGiao = taoYC({ tt: 'CHO_NGHIEM_THU' });
  html = await thanTrang(await binh.get(`/in/m01/${dangGiao.id}`));
  assert.ok(html.includes('Nguyễn Hoàng An') && !html.includes('@sis.hust.edu.vn'), 'KTV không thấy email SV (như K02)');
});

test('In M.04: QL và KTV được giao in biên bản đang hiệu lực; SV bị 403; chưa có biên bản -> 404', async () => {
  const coBB = taoYC({ tt: 'CHO_NGHIEM_THU', nha: 'C7', sv: 'ha', ktv: 'hoa', ketQua: 'KHONG_KHAC_PHUC' });
  const khongBB = taoYC({ tt: 'CHO_NGHIEM_THU', ktv: 'hoa' });
  const [ha, binh, hoa, ql] = await Promise.all(['ha', 'binh', 'hoa', 'ql'].map(dangNhap));

  assert.equal((await ha.get(`/in/m04/${coBB.id}`)).status, 403, 'SV không in M.04 (UC18)');
  assert.equal((await binh.get(`/in/m04/${coBB.id}`)).status, 404, 'KTV không được giao');
  assert.equal((await ql.get(`/in/m04/${khongBB.id}`)).status, 404);
  assert.equal((await hoa.get(`/in/m04/${coBB.id}`)).status, 200);

  const html = await thanTrang(await ql.get(`/in/m04/${coBB.id}`));
  assert.ok(html.includes('M.04.QT&VT.06') && html.includes('BIÊN BẢN KIỂM TRA KỸ THUẬT'));
  assert.ok(html.includes('ĐẠI HỌC BÁCH KHOA HÀ NỘI') && html.includes('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'));
  assert.match(html, /Thời gian: Hồi \d{2} giờ \d{2} ngày \d{2} tháng \d{2} năm \d{4}/);
  assert.ok(html.includes('Địa điểm: Nhà C7 – Phòng C7-102'));
  assert.ok(html.includes('Nguyễn Thị Lan') && html.includes('Lê Thị Hoa') && html.includes('Trần Thu Hà'), 'thành phần: QL, KTV, SV');
  assert.ok(html.includes('Máy nén không chạy') && html.includes('Hỏng block'));
  assert.ok(html.includes('Thuê đơn vị sửa chữa: Thay block, nạp gas'));
  assert.ok(html.includes('ĐƠN VỊ SỬ DỤNG') && html.includes('P. QL CSVC'));

  // Yêu cầu làm lại -> biên bản hết hiệu lực -> không in được nữa
  lam(nd.ql, coBB.id, 'lamLai', { ly_do: 'Biên bản thiếu thông tin model' });
  assert.equal((await ql.get(`/in/m04/${coBB.id}`)).status, 404);
});

test('Q02 / S03 / K02 / Q04 có nút In đúng chỗ (không còn nút ẩn)', async () => {
  const bb = taoYC({ tt: 'CHO_NGHIEM_THU', ketQua: 'KHONG_KHAC_PHUC' });
  const [an, ql] = await Promise.all(['an', 'ql'].map(dangNhap));
  let html = await thanTrang(await ql.get(`/quan-ly/yeu-cau/${bb.id}`));
  assert.ok(html.includes(`href="/in/m01/${bb.id}"`) && html.includes(`href="/in/m04/${bb.id}"`));
  html = await thanTrang(await an.get(`/sinh-vien/yeu-cau/${bb.id}`));
  assert.ok(html.includes(`href="/in/m01/${bb.id}"`) && !html.includes('/in/m04/'));
  html = await thanTrang(await ql.get(`/quan-ly/co-so-vat-chat?tab=thiet-bi&ho-so=${bb.thietBi}`));
  assert.ok(html.includes(`href="/in/m03/${bb.thietBi}"`));
  assert.ok(!/id="nut-in-m0\d"[^>]*hidden/.test(html));
});

test('In M.03: chỉ QL; cột 1–8 của một thiết bị kèm số lần và nội dung sửa chữa', async () => {
  const xong = taoYC({ tt: 'HOAN_THANH' });
  const [an, binh, ql] = await Promise.all(['an', 'binh', 'ql'].map(dangNhap));
  assert.equal((await an.get(`/in/m03/${xong.thietBi}`)).status, 403);
  assert.equal((await binh.get(`/in/m03/${xong.thietBi}`)).status, 403);
  assert.equal((await ql.get('/in/m03/999999')).status, 404);
  const html = await thanTrang(await ql.get(`/in/m03/${xong.thietBi}`));
  assert.ok(html.includes('M.03.QT&VT.06') && html.includes('SỔ THEO DÕI HIỆU QUẢ SỬ DỤNG TRANG THIẾT BỊ'));
  assert.ok(html.includes('Model – Hãng sản xuất') && html.includes('Sửa chữa (Số lần và nội dung đã sửa chữa)'));
  assert.ok(html.includes('Epson EB-X51') && html.includes('2022') && html.includes('Hoạt động'));
  assert.ok(html.includes('1 lần') && html.includes('Thay bóng đèn'));
});
