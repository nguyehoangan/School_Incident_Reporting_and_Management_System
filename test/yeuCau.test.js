// Test tự động cho services/yeuCau.js: mọi dòng bảng 5.1 (SPEC) chạy được và các chuyển trạng thái sai bị từ chối.
// Chạy: npm test  (dùng CSDL tạm, không đụng data/csvc.db)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const THU_MUC_TAM = fs.mkdtempSync(path.join(os.tmpdir(), 'csvc-test-'));
process.env.DB_PATH = path.join(THU_MUC_TAM, 'test.db');

const { moCsdl, layCsdl } = require('../db');
const { gioVN, hanKiemTraMacDinh } = require('../lib/thoiGian');
const yeuCau = require('../services/yeuCau');
const { thucHienHanhDong: lam, LoiNghiepVu } = yeuCau;

// ---------------------------------------------------------------- Dữ liệu tối thiểu
const nd = {};
const tb = {};
let phongD3;
let phongC7;
let loaiMC;

test.before(() => {
  const db0 = moCsdl(process.env.DB_PATH);
  db0.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  db0.close();
  const db = layCsdl();
  const themND = db.prepare(`INSERT INTO nguoi_dung (email, mat_khau_hash, ho_ten, vai_tro, ma_so, trang_thai) VALUES (?, 'x', ?, ?, ?, ?)`);
  const tao = (khoa, email, ten, vaiTro, trangThai = 'HOAT_DONG') => {
    const id = themND.run(email, ten, vaiTro, khoa, trangThai).lastInsertRowid;
    nd[khoa] = { id, ho_ten: ten, vai_tro: vaiTro };
  };
  tao('ql', 'ql@hust.edu.vn', 'Quản Lý', 'QUAN_LY');
  tao('binh', 'binh@hust.edu.vn', 'Trần Văn Bình', 'KY_THUAT_VIEN');
  tao('duc', 'duc@hust.edu.vn', 'Phạm Minh Đức', 'KY_THUAT_VIEN');
  tao('hoa', 'hoa@hust.edu.vn', 'Lê Thị Hoa', 'KY_THUAT_VIEN');
  tao('khoa', 'khoa@hust.edu.vn', 'KTV Bị Khóa', 'KY_THUAT_VIEN', 'KHOA');
  tao('an', 'an@sis.hust.edu.vn', 'Nguyễn Hoàng An', 'SINH_VIEN');
  tao('ha', 'ha@sis.hust.edu.vn', 'Trần Thu Hà', 'SINH_VIEN');

  const d3 = db.prepare(`INSERT INTO toa_nha (ma_nha, ten_nha) VALUES ('D3', 'Nhà D3')`).run().lastInsertRowid;
  const c7 = db.prepare(`INSERT INTO toa_nha (ma_nha, ten_nha) VALUES ('C7', 'Nhà C7')`).run().lastInsertRowid;
  phongD3 = db.prepare(`INSERT INTO phong (toa_nha_id, ma_phong, tang) VALUES (?, '301', 3)`).run(d3).lastInsertRowid;
  phongC7 = db.prepare(`INSERT INTO phong (toa_nha_id, ma_phong, tang) VALUES (?, '102', 1)`).run(c7).lastInsertRowid;
  loaiMC = db.prepare(`INSERT INTO loai_thiet_bi (ten_loai) VALUES ('Máy chiếu')`).run().lastInsertRowid;
  tb.mc = db.prepare(`INSERT INTO thiet_bi (ma_tai_san, ten_thiet_bi, loai_thiet_bi_id, phong_id) VALUES ('MC-1', 'Máy chiếu', ?, ?)`)
    .run(loaiMC, phongD3).lastInsertRowid;
  // Khu vực: Bình D3 (đang bận 1 việc), Đức D3 (rảnh), Hoa C7
  const kv = db.prepare('INSERT INTO khu_vuc_phu_trach (ktv_id, toa_nha_id) VALUES (?, ?)');
  kv.run(nd.binh.id, d3); kv.run(nd.duc.id, d3); kv.run(nd.hoa.id, c7);
});

test.after(() => fs.rmSync(THU_MUC_TAM, { recursive: true, force: true }));

let soYC = 0;
function taoYC({ sv = 'an', phong = phongD3, thietBi = tb.mc, mucDo = 'BINH_THUONG' } = {}) {
  const db = layCsdl();
  const t = '2026-01-01 08:00:00'; // thời điểm cũ để kiểm tra thoi_gian_cap_nhat có đổi
  const ma = `YC-2026-${String(++soYC).padStart(4, '0')}`;
  const id = db.prepare(`INSERT INTO yeu_cau (ma_yeu_cau, sinh_vien_id, phong_id, thiet_bi_id, loai_thiet_bi_id, muc_do, mo_ta,
                           trang_thai, thoi_gian_gui, thoi_gian_cap_nhat) VALUES (?, ?, ?, ?, ?, ?, 'Mô tả hư hỏng mẫu', 'MOI', ?, ?)`)
    .run(ma, nd[sv].id, phong, thietBi, loaiMC, mucDo, t, t).lastInsertRowid;
  db.prepare(`INSERT INTO lich_su_xu_ly (yeu_cau_id, nguoi_thuc_hien_id, tu_trang_thai, den_trang_thai, noi_dung, thoi_gian)
              VALUES (?, ?, NULL, 'MOI', 'Gửi yêu cầu', ?)`).run(id, nd[sv].id, t);
  if (thietBi) db.prepare(`UPDATE thiet_bi SET tinh_trang = 'HOAT_DONG' WHERE id = ?`).run(thietBi);
  return id;
}

const ycRow = (id) => layCsdl().prepare('SELECT * FROM yeu_cau WHERE id = ?').get(id);
const lichSuCuoi = (id) => layCsdl().prepare('SELECT * FROM lich_su_xu_ly WHERE yeu_cau_id = ? ORDER BY id DESC LIMIT 1').get(id);
const soLichSu = (id) => layCsdl().prepare('SELECT COUNT(*) n FROM lich_su_xu_ly WHERE yeu_cau_id = ?').get(id).n;
const phanCongHL = (id) => layCsdl().prepare('SELECT * FROM phan_cong WHERE yeu_cau_id = ? AND con_hieu_luc = 1').all(id);
const tinhTrangTB = () => layCsdl().prepare('SELECT tinh_trang FROM thiet_bi WHERE id = ?').get(tb.mc).tinh_trang;

// Hạn hợp lệ: ngày mai, dạng <input type="datetime-local">
const hanMai = () => gioVN(new Date(Date.now() + 24 * 3600e3)).slice(0, 16).replace(' ', 'T');

const DONG_SUA = [{ noi_dung: 'Thay bóng đèn máy chiếu', so_luong: '1', ghi_chu: 'Bóng dự phòng kho' }];
const BIEN_BAN = { ket_qua: 'KHONG_KHAC_PHUC', tinh_trang_su_co: 'Máy nén không chạy', nguyen_nhan: 'Hỏng block', de_xuat: { thue_sua: 'Thuê đơn vị thay block' } };

// Đưa yêu cầu tới trạng thái mong muốn bằng chính service
function denTrangThai(trangThai, { ketQua = 'KHAC_PHUC_TAI_CHO', ktv = 'binh', ...tuyChon } = {}) {
  const id = taoYC(tuyChon);
  if (trangThai === 'MOI') return id;
  lam(nd.ql, id, 'phanCong', { ktv_id: nd[ktv].id, han: hanMai() });
  if (trangThai === 'DA_PHAN_CONG') return id;
  lam(nd[ktv], id, 'batDau');
  if (trangThai === 'DANG_SUA') return id;
  lam(nd[ktv], id, 'baoKetQua', ketQua === 'KHAC_PHUC_TAI_CHO' ? { ket_qua: ketQua, dong: DONG_SUA } : BIEN_BAN);
  if (trangThai === 'CHO_NGHIEM_THU') return id;
  lam(nd.ql, id, 'chuyenPhuongAn', { phuong_an: 'THUE_NGOAI', so_to_trinh: 'TT-01' });
  return id; // CHUYEN_XU_LY (cần ketQua: 'KHONG_KHAC_PHUC')
}

// Kiểm tra chung cho mọi lần chuyển: trạng thái mới, 1 dòng lịch sử đúng, thời gian cập nhật đổi
function kiemTraChuyen(id, truoc, tu, den, nguoi) {
  const sau = ycRow(id);
  assert.equal(sau.trang_thai, den);
  assert.equal(soLichSu(id), truoc.soLS + 1, 'phải thêm đúng 1 dòng lich_su_xu_ly');
  const ls = lichSuCuoi(id);
  assert.equal(ls.tu_trang_thai, tu);
  assert.equal(ls.den_trang_thai, den);
  assert.equal(ls.nguoi_thuc_hien_id, nguoi.id);
  assert.notEqual(sau.thoi_gian_cap_nhat, truoc.capNhat, 'thoi_gian_cap_nhat phải đổi (BR-03)');
  assert.equal(sau.thoi_gian_cap_nhat, ls.thoi_gian);
  return sau;
}
const chup = (id) => ({ soLS: soLichSu(id), capNhat: (layCsdl().prepare(`UPDATE yeu_cau SET thoi_gian_cap_nhat = '2026-01-01 08:00:00' WHERE id = ?`).run(id), '2026-01-01 08:00:00') });

// Kỳ vọng service ném LoiNghiepVu với mã lỗi cho trước và không ghi gì vào CSDL
function tuChoiBoi(ma, ham, id) {
  const truoc = id ? { tt: ycRow(id).trang_thai, ls: soLichSu(id) } : null;
  assert.throws(ham, (e) => e instanceof LoiNghiepVu && e.ma === ma, `phải bị từ chối với mã ${ma}`);
  if (id) {
    assert.equal(ycRow(id).trang_thai, truoc.tt, 'trạng thái không được đổi');
    assert.equal(soLichSu(id), truoc.ls, 'không được ghi lịch sử');
  }
}

// ================================================================ Bảng 5.1
test('BANG_CHUYEN chép đúng 10 dòng của bảng 5.1', () => {
  const mong = [
    ['phanCong', 'MOI', 'DA_PHAN_CONG', 'QUAN_LY'],
    ['tuChoi', 'MOI', 'TU_CHOI', 'QUAN_LY'],
    ['huy', 'MOI', 'DA_HUY', 'SINH_VIEN'],
    ['doiKtv', 'DA_PHAN_CONG', 'DA_PHAN_CONG', 'QUAN_LY'],
    ['batDau', 'DA_PHAN_CONG', 'DANG_SUA', 'KY_THUAT_VIEN'],
    ['baoKetQua', 'DANG_SUA', 'CHO_NGHIEM_THU', 'KY_THUAT_VIEN'],
    ['nghiemThu', 'CHO_NGHIEM_THU', 'HOAN_THANH', 'QUAN_LY'],
    ['chuyenPhuongAn', 'CHO_NGHIEM_THU', 'CHUYEN_XU_LY', 'QUAN_LY'],
    ['lamLai', 'CHO_NGHIEM_THU', 'DA_PHAN_CONG', 'QUAN_LY'],
    ['dong', 'CHUYEN_XU_LY', 'HOAN_THANH', 'QUAN_LY'],
  ];
  const thuc = Object.entries(yeuCau.BANG_CHUYEN).map(([k, b]) => [k, b.tu, b.den, b.vaiTro]);
  assert.deepEqual(thuc, mong);
});

test('5.1 dòng 1: MOI → DA_PHAN_CONG (QL Tiếp nhận & phân công)', () => {
  const id = denTrangThai('MOI');
  const truoc = chup(id);
  const han = hanMai();
  lam(nd.ql, id, 'phanCong', { ktv_id: nd.duc.id, han, ghi_chu_giao_viec: 'Mang bóng dự phòng', ghi_chu_sv: 'Đã tiếp nhận' });
  const sau = kiemTraChuyen(id, truoc, 'MOI', 'DA_PHAN_CONG', nd.ql);
  assert.equal(sau.nguoi_tiep_nhan_id, nd.ql.id);
  assert.ok(sau.thoi_gian_tiep_nhan);
  assert.equal(sau.ghi_chu_ql, 'Đã tiếp nhận');
  const pc = phanCongHL(id);
  assert.equal(pc.length, 1);
  assert.equal(pc[0].ktv_id, nd.duc.id);
  assert.equal(pc[0].han_hoan_thanh, han.replace('T', ' ') + ':00');
  assert.equal(pc[0].ghi_chu_giao_viec, 'Mang bóng dự phòng');
  assert.match(lichSuCuoi(id).noi_dung, /Phạm Minh Đức/);
});

test('5.1 dòng 2: MOI → TU_CHOI (QL Từ chối, có lý do)', () => {
  const id = denTrangThai('MOI');
  const truoc = chup(id);
  lam(nd.ql, id, 'tuChoi', { ly_do: 'Trùng với yêu cầu YC-2026-0001' });
  const sau = kiemTraChuyen(id, truoc, 'MOI', 'TU_CHOI', nd.ql);
  assert.equal(sau.ly_do_tu_choi, 'Trùng với yêu cầu YC-2026-0001');
  assert.equal(tinhTrangTB(), 'HOAT_DONG', '6.3: bị từ chối thì giữ nguyên thiết bị');
});

test('5.1 dòng 3: MOI → DA_HUY (SV chủ yêu cầu hủy)', () => {
  const id = denTrangThai('MOI');
  const truoc = chup(id);
  yeuCau.huyYeuCau(nd.an, id);
  kiemTraChuyen(id, truoc, 'MOI', 'DA_HUY', nd.an);
  assert.equal(tinhTrangTB(), 'HOAT_DONG');
});

test('5.1 dòng 4: DA_PHAN_CONG → DA_PHAN_CONG (QL Đổi KTV, BR-07)', () => {
  const id = denTrangThai('DA_PHAN_CONG', { ktv: 'binh' });
  const truoc = chup(id);
  lam(nd.ql, id, 'doiKtv', { ktv_id: nd.duc.id, ghi_chu_giao_viec: 'Bình bận ở D5' });
  kiemTraChuyen(id, truoc, 'DA_PHAN_CONG', 'DA_PHAN_CONG', nd.ql);
  const hl = phanCongHL(id);
  assert.equal(hl.length, 1, 'BR-07: chỉ 1 phân công đang hiệu lực');
  assert.equal(hl[0].ktv_id, nd.duc.id);
  assert.ok(hl[0].han_hoan_thanh, 'không nhập hạn thì dùng hạn mặc định BR-06');
  const tatCa = layCsdl().prepare('SELECT ktv_id, con_hieu_luc FROM phan_cong WHERE yeu_cau_id = ? ORDER BY id').all(id);
  assert.deepEqual(tatCa, [{ ktv_id: nd.binh.id, con_hieu_luc: 0 }, { ktv_id: nd.duc.id, con_hieu_luc: 1 }]);
  assert.match(lichSuCuoi(id).noi_dung, /Đổi KTV Trần Văn Bình → Phạm Minh Đức/);
});

test('5.1 dòng 5: DA_PHAN_CONG → DANG_SUA (KTV được giao bắt đầu kiểm tra; thiết bị Đang sửa)', () => {
  const id = denTrangThai('DA_PHAN_CONG');
  const truoc = chup(id);
  lam(nd.binh, id, 'batDau');
  kiemTraChuyen(id, truoc, 'DA_PHAN_CONG', 'DANG_SUA', nd.binh);
  assert.equal(tinhTrangTB(), 'DANG_SUA');
});

test('5.1 dòng 6a: DANG_SUA → CHO_NGHIEM_THU (KTV báo Đã khắc phục tại chỗ)', () => {
  const id = denTrangThai('DANG_SUA');
  const truoc = chup(id);
  lam(nd.binh, id, 'baoKetQua', { ket_qua: 'KHAC_PHUC_TAI_CHO', dong: [...DONG_SUA, { noi_dung: '', so_luong: '', ghi_chu: '' }, { noi_dung: 'Vệ sinh lọc gió', so_luong: '', ghi_chu: '' }] });
  const sau = kiemTraChuyen(id, truoc, 'DANG_SUA', 'CHO_NGHIEM_THU', nd.binh);
  assert.equal(sau.ket_qua_kiem_tra, 'KHAC_PHUC_TAI_CHO');
  const dong = layCsdl().prepare('SELECT stt, noi_dung, so_luong FROM noi_dung_sua_chua WHERE yeu_cau_id = ? ORDER BY stt').all(id);
  assert.deepEqual(dong, [{ stt: 1, noi_dung: 'Thay bóng đèn máy chiếu', so_luong: 1 }, { stt: 2, noi_dung: 'Vệ sinh lọc gió', so_luong: null }]);
});

test('5.1 dòng 6b: DANG_SUA → CHO_NGHIEM_THU (KTV báo Không khắc phục, lập biên bản M.04)', () => {
  const id = denTrangThai('DANG_SUA');
  const truoc = chup(id);
  lam(nd.binh, id, 'baoKetQua', BIEN_BAN);
  const sau = kiemTraChuyen(id, truoc, 'DANG_SUA', 'CHO_NGHIEM_THU', nd.binh);
  assert.equal(sau.ket_qua_kiem_tra, 'KHONG_KHAC_PHUC');
  const bb = layCsdl().prepare('SELECT * FROM bien_ban_kiem_tra WHERE yeu_cau_id = ? AND con_hieu_luc = 1').get(id);
  assert.equal(bb.nguyen_nhan, 'Hỏng block');
  assert.equal(bb.de_xuat_thue_sua, 'Thuê đơn vị thay block');
  assert.equal(bb.de_xuat_mua_vat_tu, null);
});

test('5.1 dòng 7: CHO_NGHIEM_THU → HOAN_THANH (QL Nghiệm thu đạt; thiết bị Hoạt động)', () => {
  const id = denTrangThai('CHO_NGHIEM_THU');
  const truoc = chup(id);
  lam(nd.ql, id, 'nghiemThu');
  const sau = kiemTraChuyen(id, truoc, 'CHO_NGHIEM_THU', 'HOAN_THANH', nd.ql);
  assert.ok(sau.thoi_gian_hoan_thanh);
  assert.equal(tinhTrangTB(), 'HOAT_DONG');
});

test('5.1 dòng 8: CHO_NGHIEM_THU → CHUYEN_XU_LY (QL duyệt biên bản; thiết bị Hỏng – chờ thay thế)', () => {
  const id = denTrangThai('CHO_NGHIEM_THU', { ketQua: 'KHONG_KHAC_PHUC' });
  const truoc = chup(id);
  lam(nd.ql, id, 'chuyenPhuongAn', { phuong_an: 'THUE_NGOAI', so_to_trinh: '45/TTr-QT' });
  const sau = kiemTraChuyen(id, truoc, 'CHO_NGHIEM_THU', 'CHUYEN_XU_LY', nd.ql);
  assert.equal(sau.phuong_an, 'THUE_NGOAI');
  assert.equal(sau.so_to_trinh, '45/TTr-QT');
  assert.equal(tinhTrangTB(), 'CHO_THAY_THE');
});

test('5.1 dòng 9: CHO_NGHIEM_THU → DA_PHAN_CONG (QL Yêu cầu làm lại; mặc định KTV cũ)', () => {
  const id = denTrangThai('CHO_NGHIEM_THU');
  const truoc = chup(id);
  lam(nd.ql, id, 'lamLai', { ly_do: 'Hình vẫn mờ, chưa căn chỉnh tiêu cự' });
  const sau = kiemTraChuyen(id, truoc, 'CHO_NGHIEM_THU', 'DA_PHAN_CONG', nd.ql);
  assert.equal(sau.ket_qua_kiem_tra, null);
  const hl = phanCongHL(id);
  assert.equal(hl.length, 1);
  assert.equal(hl[0].ktv_id, nd.binh.id, 'mặc định giao lại KTV cũ');
  assert.equal(layCsdl().prepare('SELECT COUNT(*) n FROM noi_dung_sua_chua WHERE yeu_cau_id = ?').get(id).n, 0, 'nội dung sửa cũ bị xóa');
  assert.equal(layCsdl().prepare('SELECT COUNT(*) n FROM phan_cong WHERE yeu_cau_id = ?').get(id).n, 2);
  // Làm lại có thể đổi KTV khác; biên bản cũ hết hiệu lực
  const id2 = denTrangThai('CHO_NGHIEM_THU', { ketQua: 'KHONG_KHAC_PHUC' });
  lam(nd.ql, id2, 'lamLai', { ly_do: 'Biên bản thiếu thông tin bảo hành', ktv_id: nd.duc.id });
  assert.equal(phanCongHL(id2)[0].ktv_id, nd.duc.id);
  assert.equal(layCsdl().prepare('SELECT COUNT(*) n FROM bien_ban_kiem_tra WHERE yeu_cau_id = ? AND con_hieu_luc = 1').get(id2).n, 0);
  // Vòng 2: KTV làm lại rồi QL nghiệm thu đạt (kịch bản 13.5 bước 4)
  lam(nd.binh, id, 'batDau');
  lam(nd.binh, id, 'baoKetQua', { ket_qua: 'KHAC_PHUC_TAI_CHO', dong: DONG_SUA });
  lam(nd.ql, id, 'nghiemThu');
  assert.equal(ycRow(id).trang_thai, 'HOAN_THANH');
});

test('5.1 dòng 10: CHUYEN_XU_LY → HOAN_THANH (QL Đóng yêu cầu; thiết bị theo lựa chọn)', () => {
  const id = denTrangThai('CHUYEN_XU_LY', { ketQua: 'KHONG_KHAC_PHUC' });
  const truoc = chup(id);
  lam(nd.ql, id, 'dong', { ket_qua_cuoi: 'Đã thay block máy nén', so_bien_ban_ban_giao: 'BB-01/2026', tinh_trang_thiet_bi: 'THANH_LY' });
  const sau = kiemTraChuyen(id, truoc, 'CHUYEN_XU_LY', 'HOAN_THANH', nd.ql);
  assert.equal(sau.ket_qua_cuoi, 'Đã thay block máy nén');
  assert.equal(sau.so_bien_ban_ban_giao, 'BB-01/2026');
  assert.ok(sau.thoi_gian_hoan_thanh);
  assert.equal(tinhTrangTB(), 'THANH_LY');
  // Yêu cầu không gắn thiết bị cụ thể: không bắt buộc tình trạng thiết bị
  const id2 = denTrangThai('CHUYEN_XU_LY', { ketQua: 'KHONG_KHAC_PHUC', thietBi: null });
  lam(nd.ql, id2, 'dong', { ket_qua_cuoi: 'Đã lắp cửa mới' });
  assert.equal(ycRow(id2).trang_thai, 'HOAN_THANH');
});

// ================================================================ Chuyển trạng thái sai bị từ chối
test('Sai vai trò bị từ chối (403): KTV phân công, QL bắt đầu kiểm tra, SV từ chối, QL hủy thay SV', () => {
  const moi = denTrangThai('MOI');
  tuChoiBoi(403, () => lam(nd.binh, moi, 'phanCong', { ktv_id: nd.binh.id, han: hanMai() }), moi);
  tuChoiBoi(403, () => lam(nd.an, moi, 'tuChoi', { ly_do: 'Không hợp lệ' }), moi);
  tuChoiBoi(403, () => lam(nd.ql, moi, 'huy'), moi);
  const pc = denTrangThai('DA_PHAN_CONG');
  tuChoiBoi(403, () => lam(nd.ql, pc, 'batDau'), pc);
});

test('Sai trạng thái bị từ chối (409): KTV không đẩy thẳng Đã phân công → Hoàn thành; SV không hủy yêu cầu đã phân công', () => {
  const pc = denTrangThai('DA_PHAN_CONG');
  tuChoiBoi(403, () => lam(nd.binh, pc, 'nghiemThu'), pc); // KTV không có quyền nghiệm thu
  tuChoiBoi(409, () => lam(nd.ql, pc, 'nghiemThu'), pc); // QL cũng không thể khi chưa qua Chờ nghiệm thu
  tuChoiBoi(409, () => yeuCau.huyYeuCau(nd.an, pc), pc);
  tuChoiBoi(409, () => lam(nd.ql, pc, 'phanCong', { ktv_id: nd.duc.id, han: hanMai() }), pc);
  tuChoiBoi(409, () => lam(nd.binh, pc, 'baoKetQua', { ket_qua: 'KHAC_PHUC_TAI_CHO', dong: DONG_SUA }), pc);
  const moi = denTrangThai('MOI');
  tuChoiBoi(409, () => lam(nd.ql, moi, 'doiKtv', { ktv_id: nd.duc.id }), moi);
  tuChoiBoi(409, () => lam(nd.ql, moi, 'dong', { ket_qua_cuoi: 'x', tinh_trang_thiet_bi: 'HOAT_DONG' }), moi);
});

test('Trạng thái kết thúc không chuyển tiếp được và không còn nút nào', () => {
  const tc = denTrangThai('MOI');
  lam(nd.ql, tc, 'tuChoi', { ly_do: 'Không thuộc phạm vi' });
  for (const hd of ['phanCong', 'tuChoi']) tuChoiBoi(409, () => lam(nd.ql, tc, hd, { ly_do: 'Thử lại lần nữa', ktv_id: nd.binh.id, han: hanMai() }), tc);
  tuChoiBoi(409, () => yeuCau.huyYeuCau(nd.an, tc), tc);
  assert.deepEqual(yeuCau.cacHanhDongHopLe(nd.ql, ycRow(tc)), []);
});

test('BR-14: kết quả tại chỗ không chuyển phương án được, không khắc phục thì không nghiệm thu đạt được', () => {
  const taiCho = denTrangThai('CHO_NGHIEM_THU');
  tuChoiBoi(409, () => lam(nd.ql, taiCho, 'chuyenPhuongAn', { phuong_an: 'MUA_VAT_TU' }), taiCho);
  const khong = denTrangThai('CHO_NGHIEM_THU', { ketQua: 'KHONG_KHAC_PHUC' });
  tuChoiBoi(409, () => lam(nd.ql, khong, 'nghiemThu'), khong);
  assert.deepEqual(yeuCau.cacHanhDongHopLe(nd.ql, ycRow(taiCho)), ['nghiemThu', 'lamLai']);
  assert.deepEqual(yeuCau.cacHanhDongHopLe(nd.ql, ycRow(khong)), ['chuyenPhuongAn', 'lamLai']);
});

test('BR-04: KTV không được giao và SV không phải chủ yêu cầu bị chặn (404)', () => {
  const pc = denTrangThai('DA_PHAN_CONG', { ktv: 'binh' });
  tuChoiBoi(404, () => lam(nd.duc, pc, 'batDau'), pc);
  const moi = denTrangThai('MOI', { sv: 'an' });
  tuChoiBoi(404, () => yeuCau.huyYeuCau(nd.ha, moi), moi);
  tuChoiBoi(404, () => lam(nd.ql, 999999, 'tuChoi', { ly_do: 'Không tồn tại' }));
  // Sau khi đổi KTV, KTV cũ mất quyền
  lam(nd.ql, pc, 'doiKtv', { ktv_id: nd.duc.id });
  tuChoiBoi(404, () => lam(nd.binh, pc, 'batDau'), pc);
  lam(nd.duc, pc, 'batDau');
  assert.equal(ycRow(pc).trang_thai, 'DANG_SUA');
});

test('Thiếu / sai trường bắt buộc bị từ chối (422) kèm tên trường', () => {
  const moi = denTrangThai('MOI');
  const loiCua = (ham) => { try { ham(); } catch (e) { assert.equal(e.ma, 422); return e.loi; } assert.fail('phải ném lỗi'); };
  // BR-05: lý do bắt buộc, ≥ 5 ký tự
  assert.ok(loiCua(() => lam(nd.ql, moi, 'tuChoi', {})).ly_do);
  assert.ok(loiCua(() => lam(nd.ql, moi, 'tuChoi', { ly_do: '  sai ' })).ly_do);
  // Phân công: KTV + hạn bắt buộc; KTV bị khóa không được chọn; hạn không trước thời điểm giao (BR-06)
  const l1 = loiCua(() => lam(nd.ql, moi, 'phanCong', {}));
  assert.ok(l1.ktv_id && l1.han);
  assert.ok(loiCua(() => lam(nd.ql, moi, 'phanCong', { ktv_id: nd.khoa.id, han: hanMai() })).ktv_id);
  assert.ok(loiCua(() => lam(nd.ql, moi, 'phanCong', { ktv_id: nd.an.id, han: hanMai() })).ktv_id, 'SV không phải KTV');
  assert.ok(loiCua(() => lam(nd.ql, moi, 'phanCong', { ktv_id: nd.binh.id, han: '2020-01-01T08:00' })).han);
  assert.ok(loiCua(() => lam(nd.ql, moi, 'phanCong', { ktv_id: nd.binh.id, han: 'không phải ngày' })).han);
  assert.equal(ycRow(moi).trang_thai, 'MOI');
  assert.equal(phanCongHL(moi).length, 0, 'lỗi thì không tạo phân công');

  const pc = denTrangThai('DA_PHAN_CONG', { ktv: 'binh' });
  assert.ok(loiCua(() => lam(nd.ql, pc, 'doiKtv', { ktv_id: nd.binh.id })).ktv_id, 'đổi KTV phải chọn người khác');
  assert.ok(loiCua(() => lam(nd.ql, pc, 'doiKtv', {})).ktv_id);

  const ds = denTrangThai('DANG_SUA');
  assert.ok(loiCua(() => lam(nd.binh, ds, 'baoKetQua', {})).ket_qua);
  assert.ok(loiCua(() => lam(nd.binh, ds, 'baoKetQua', { ket_qua: 'KHAC_PHUC_TAI_CHO', dong: [] })).dong);
  const lBB = loiCua(() => lam(nd.binh, ds, 'baoKetQua', { ket_qua: 'KHONG_KHAC_PHUC', de_xuat: {} }));
  assert.ok(lBB.tinh_trang_su_co && lBB.nguyen_nhan && lBB.de_xuat);

  const cnt = denTrangThai('CHO_NGHIEM_THU');
  assert.ok(loiCua(() => lam(nd.ql, cnt, 'lamLai', { ly_do: 'abc' })).ly_do);
  const cnt2 = denTrangThai('CHO_NGHIEM_THU', { ketQua: 'KHONG_KHAC_PHUC' });
  assert.ok(loiCua(() => lam(nd.ql, cnt2, 'chuyenPhuongAn', { phuong_an: 'KHONG_CO' })).phuong_an);
  const cxl = denTrangThai('CHUYEN_XU_LY', { ketQua: 'KHONG_KHAC_PHUC' });
  const lDong = loiCua(() => lam(nd.ql, cxl, 'dong', { tinh_trang_thiet_bi: 'DANG_SUA' }));
  assert.ok(lDong.ket_qua_cuoi && lDong.tinh_trang_thiet_bi);
});

test('Hành động không có trong bảng 5.1 bị từ chối (400)', () => {
  const moi = denTrangThai('MOI');
  tuChoiBoi(400, () => lam(nd.ql, moi, 'hoanThanhLuon'), moi);
  tuChoiBoi(400, () => lam(nd.ql, moi, 'toString'), moi);
});

// ================================================================ Gợi ý KTV (7.3) và hạn mặc định (BR-06)
test('7.3: gợi ý KTV phụ trách nhà lên trước, ít việc trước; KTV bị khóa không có trong danh sách', () => {
  const db = layCsdl();
  db.exec("UPDATE yeu_cau SET trang_thai = 'HOAN_THANH' WHERE trang_thai IN ('DA_PHAN_CONG','DANG_SUA')"); // xóa việc đang làm
  denTrangThai('DA_PHAN_CONG', { ktv: 'binh' }); // Bình: 1 việc
  const moiD3 = denTrangThai('MOI');
  const goiY = yeuCau.goiYKtv(moiD3);
  assert.deepEqual(goiY.map((k) => k.hoTen), ['Phạm Minh Đức', 'Trần Văn Bình', 'Lê Thị Hoa']);
  assert.equal(goiY[0].goiY, true);
  assert.equal(goiY[0].moTa, 'Phụ trách D3 · đang làm 0 việc');
  assert.equal(goiY[1].moTa, 'Phụ trách D3 · đang làm 1 việc');
  assert.equal(goiY[2].phuTrach, false);
  const moiC7 = denTrangThai('MOI', { phong: phongC7, thietBi: null });
  assert.equal(yeuCau.goiYKtv(moiC7)[0].hoTen, 'Lê Thị Hoa');
});

test('BR-06: hạn mặc định Khẩn cấp = cuối ngày giao; Bình thường = 01 ngày làm việc (bỏ T7, CN)', () => {
  assert.equal(hanKiemTraMacDinh('2026-11-20 10:15:00', 'KHAN_CAP'), '2026-11-20 23:59:00');
  assert.equal(hanKiemTraMacDinh('2026-11-18 10:15:00', 'BINH_THUONG'), '2026-11-19 10:15:00'); // T4 -> T5
  assert.equal(hanKiemTraMacDinh('2026-11-20 10:15:00', 'BINH_THUONG'), '2026-11-23 10:15:00'); // T6 -> T2
  assert.equal(hanKiemTraMacDinh('2026-11-21 09:00:00', 'BINH_THUONG'), '2026-11-23 09:00:00'); // T7 -> T2
});

test('Cập nhật ghi chú cho SV chỉ khi Đang xử lý, có ghi lịch sử', () => {
  const ds = denTrangThai('DANG_SUA');
  const n = soLichSu(ds);
  yeuCau.capNhatGhiChuSv(nd.ql, ds, 'KTV đang chờ linh kiện');
  assert.equal(ycRow(ds).ghi_chu_ql, 'KTV đang chờ linh kiện');
  assert.equal(soLichSu(ds), n + 1);
  const moi = denTrangThai('MOI');
  tuChoiBoi(409, () => yeuCau.capNhatGhiChuSv(nd.ql, moi, 'abc'), moi);
  tuChoiBoi(403, () => yeuCau.capNhatGhiChuSv(nd.binh, ds, 'abc'));
});
