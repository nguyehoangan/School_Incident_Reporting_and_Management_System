// Test cho services/danhMuc.js (ghi danh mục CSVC, mục 6) và services/truyVanDanhMuc.js (số lần sửa, hồ sơ thiết bị).
// Kiểm tra: quyền QL, trùng mã, chặn xóa mục đã được yêu cầu tham chiếu (BR-10), ngừng theo cấp (6.1).
// Chạy: npm test  (CSDL tạm, không đụng data/csvc.db)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const THU_MUC_TAM = fs.mkdtempSync(path.join(os.tmpdir(), 'csvc-dm-'));
process.env.DB_PATH = path.join(THU_MUC_TAM, 'test.db');

const { moCsdl, layCsdl } = require('../db');
const dm = require('../services/danhMuc');
const tv = require('../services/truyVanDanhMuc');
const { LoiNghiepVu, layDanhMucChoForm } = require('../services/yeuCau');

const nd = {};
let soYC = 0;
let nhaD3; let phongD3; let loaiMC; let tbDaDung;

const dem = (sql, ...ts) => layCsdl().prepare(sql).get(...ts).n;
const tonTai = (bang, id) => !!layCsdl().prepare(`SELECT 1 FROM ${bang} WHERE id = ?`).get(id);

// Khẳng định lỗi LoiNghiepVu với mã (403 / 404 / 409 / 422) và nội dung
function chan(fn, ma, mau) {
  assert.throws(fn, (e) => {
    assert.ok(e instanceof LoiNghiepVu, `phải là LoiNghiepVu, nhận được: ${e && e.stack}`);
    assert.equal(e.ma, ma, `mã lỗi: ${e.message}`);
    if (mau) assert.match(e.message, mau);
    return true;
  });
}
// Lỗi dữ liệu 422: trả về { tenO: thongDiep }
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
  tao('ktv', 'ktv@hust.edu.vn', 'Kỹ Thuật', 'KY_THUAT_VIEN');
  tao('sv', 'sv@sis.hust.edu.vn', 'Sinh Viên', 'SINH_VIEN');

  // D3-301 có thiết bị MC-D3301-01 và đã có yêu cầu tham chiếu
  nhaD3 = db.prepare(`INSERT INTO toa_nha (ma_nha, ten_nha) VALUES ('D3', 'Nhà D3')`).run().lastInsertRowid;
  phongD3 = db.prepare(`INSERT INTO phong (toa_nha_id, ma_phong, tang, loai_phong) VALUES (?, '301', 3, 'Phòng học')`).run(nhaD3).lastInsertRowid;
  loaiMC = db.prepare(`INSERT INTO loai_thiet_bi (ten_loai) VALUES ('Máy chiếu')`).run().lastInsertRowid;
  tbDaDung = db.prepare(`INSERT INTO thiet_bi (ma_tai_san, ten_thiet_bi, loai_thiet_bi_id, phong_id) VALUES ('MC-D3301-01', 'Máy chiếu', ?, ?)`)
    .run(loaiMC, phongD3).lastInsertRowid;
  taoYeuCau({ trangThai: 'MOI', thietBi: tbDaDung });
});

test.after(() => fs.rmSync(THU_MUC_TAM, { recursive: true, force: true }));

function taoYeuCau({ trangThai = 'MOI', thietBi = null, phong = phongD3, loai = loaiMC, ketQua = null, phuongAn = null, ketQuaCuoi = null, tiepNhan = null, hoanThanh = null } = {}) {
  const db = layCsdl();
  const ma = `YC-2026-${String(++soYC).padStart(4, '0')}`;
  return db.prepare(`INSERT INTO yeu_cau (ma_yeu_cau, sinh_vien_id, phong_id, thiet_bi_id, loai_thiet_bi_id, muc_do, mo_ta, trang_thai, ket_qua_kiem_tra, phuong_an,
                       ket_qua_cuoi, thoi_gian_gui, thoi_gian_tiep_nhan, thoi_gian_hoan_thanh, thoi_gian_cap_nhat)
                     VALUES (?, ?, ?, ?, ?, 'BINH_THUONG', 'Mô tả hư hỏng mẫu', ?, ?, ?, ?, '2026-02-01 08:00:00', ?, ?, '2026-02-01 08:00:00')`)
    .run(ma, nd.sv.id, phong, thietBi, loai, trangThai, ketQua, phuongAn, ketQuaCuoi, tiepNhan, hoanThanh).lastInsertRowid;
}

// ---------------------------------------------------------------- Quyền
test('chỉ Quản lý được thêm / sửa / ngừng / xóa danh mục', () => {
  for (const nguoi of [nd.sv, nd.ktv, null]) {
    chan(() => dm.themNha(nguoi, { ma_nha: 'X1', ten_nha: 'Nhà X1' }), 403);
    chan(() => dm.suaPhong(nguoi, phongD3, { ma_phong: '301' }), 403);
    chan(() => dm.ngungLoai(nguoi, loaiMC), 403);
    chan(() => dm.xoaThietBi(nguoi, tbDaDung), 403);
    chan(() => dm.themLoai(nguoi, { ten_loai: 'Quạt' }), 403);
  }
  assert.equal(dem(`SELECT COUNT(*) n FROM toa_nha WHERE ma_nha = 'X1'`), 0);
});

// ---------------------------------------------------------------- Trùng mã
test('nhà: trùng mã (kể cả khác hoa thường / có khoảng trắng) bị chặn, mã sai định dạng báo ngay dưới ô', () => {
  const kq = dm.themNha(nd.ql, { ma_nha: ' d8 ', ten_nha: 'Nhà D8' });
  assert.equal(kq.nhan, 'D8'); // chuẩn hóa thành chữ hoa
  assert.equal(layCsdl().prepare('SELECT dang_su_dung FROM toa_nha WHERE id = ?').get(kq.id).dang_su_dung, 1);

  assert.match(loiO(() => dm.themNha(nd.ql, { ma_nha: 'D8', ten_nha: 'Nhà khác' })).ma_nha, /đã tồn tại/);
  assert.match(loiO(() => dm.themNha(nd.ql, { ma_nha: 'd3', ten_nha: 'Nhà khác' })).ma_nha, /đã tồn tại/);
  assert.equal(dem('SELECT COUNT(*) n FROM toa_nha'), 2);

  const l = loiO(() => dm.themNha(nd.ql, { ma_nha: 'D 8!', ten_nha: '' }));
  assert.ok(l.ma_nha && l.ten_nha);
  assert.ok(loiO(() => dm.themNha(nd.ql, { ma_nha: '', ten_nha: 'Nhà' })).ma_nha);
  assert.ok(loiO(() => dm.themNha(nd.ql, { ma_nha: 'ABCDEFGHIJK', ten_nha: 'Nhà dài' })).ma_nha);

  // Sửa: giữ mã của chính mình thì được, đổi sang mã đã có thì không
  const d8 = layCsdl().prepare(`SELECT id FROM toa_nha WHERE ma_nha = 'D8'`).get().id;
  dm.suaNha(nd.ql, d8, { ma_nha: 'D8', ten_nha: 'Nhà D8 mới' });
  assert.match(loiO(() => dm.suaNha(nd.ql, d8, { ma_nha: 'D3', ten_nha: 'x' })).ma_nha, /đã tồn tại/);
  chan(() => dm.suaNha(nd.ql, 99999, { ma_nha: 'Z9', ten_nha: 'x' }), 404);
});

test('phòng: trùng mã trong cùng một nhà bị chặn, cùng mã ở nhà khác thì được; gõ "D8-101" vẫn lưu "101"', () => {
  const d8 = layCsdl().prepare(`SELECT id FROM toa_nha WHERE ma_nha = 'D8'`).get().id;
  const p = dm.themPhong(nd.ql, { nha_id: d8, ma_phong: 'D8-101', tang: '1', loai_phong: 'Phòng học' });
  assert.equal(p.nhan, 'D8-101');
  assert.equal(layCsdl().prepare('SELECT ma_phong FROM phong WHERE id = ?').get(p.id).ma_phong, '101');

  assert.match(loiO(() => dm.themPhong(nd.ql, { nha_id: d8, ma_phong: '101' })).ma_phong, /D8-101 đã tồn tại/);
  assert.match(loiO(() => dm.themPhong(nd.ql, { nha_id: d8, ma_phong: 'd8-101' })).ma_phong, /đã tồn tại/);
  // Cùng mã "301" ở nhà D8 khác nhà D3 (đã có D3-301) -> hợp lệ
  assert.equal(dm.themPhong(nd.ql, { nha_id: d8, ma_phong: '301' }).nhan, 'D8-301');

  assert.ok(loiO(() => dm.themPhong(nd.ql, { ma_phong: '102' })).nha_id); // thiếu nhà
  assert.ok(loiO(() => dm.themPhong(nd.ql, { nha_id: d8, ma_phong: '' })).ma_phong);
  assert.ok(loiO(() => dm.themPhong(nd.ql, { nha_id: d8, ma_phong: '102', tang: 'abc' })).tang);

  // Sửa sang mã trùng phòng khác cùng nhà bị chặn; giữ nguyên mã thì sửa được tầng
  assert.match(loiO(() => dm.suaPhong(nd.ql, p.id, { ma_phong: '301' })).ma_phong, /đã tồn tại/);
  dm.suaPhong(nd.ql, p.id, { ma_phong: '101', tang: '2', loai_phong: 'Hội trường' });
  assert.equal(layCsdl().prepare('SELECT tang FROM phong WHERE id = ?').get(p.id).tang, 2);
});

test('loại thiết bị: trùng tên (không phân biệt hoa thường / dấu cách thừa) bị chặn', () => {
  assert.match(loiO(() => dm.themLoai(nd.ql, { ten_loai: 'máy chiếu' })).ten_loai, /đã tồn tại/);
  assert.match(loiO(() => dm.themLoai(nd.ql, { ten_loai: '  MÁY   CHIẾU ' })).ten_loai, /đã tồn tại/);
  assert.ok(loiO(() => dm.themLoai(nd.ql, { ten_loai: '' })).ten_loai);
  const quat = dm.themLoai(nd.ql, { ten_loai: 'Quạt' });
  assert.match(loiO(() => dm.suaLoai(nd.ql, quat.id, { ten_loai: 'Máy chiếu' })).ten_loai, /đã tồn tại/);
  dm.suaLoai(nd.ql, quat.id, { ten_loai: 'Quạt' }); // giữ nguyên tên mình
  dm.suaLoai(nd.ql, quat.id, { ten_loai: 'Quạt trần' });
  assert.equal(layCsdl().prepare('SELECT ten_loai FROM loai_thiet_bi WHERE id = ?').get(quat.id).ten_loai, 'Quạt trần');
});

test('thiết bị: trùng mã tài sản bị chặn; kiểm tra năm, hạn bảo hành, loại / phòng đã ngừng', () => {
  const hopLe = { ma_tai_san: 'mc-d3301-02', ten_thiet_bi: 'Máy chiếu', loai_thiet_bi_id: loaiMC, phong_id: phongD3,
    model_hang: 'Epson EB-X51', nam_su_dung: '2021', nguon_kinh_phi: 'Ngân sách nhà nước', han_bao_hanh: '2027-12-31' };
  const tb = dm.themThietBi(nd.ql, hopLe);
  assert.equal(tb.nhan, 'MC-D3301-02');
  const dong = layCsdl().prepare('SELECT * FROM thiet_bi WHERE id = ?').get(tb.id);
  assert.equal(dong.tinh_trang, 'HOAT_DONG');
  assert.equal(dong.nam_su_dung, 2021);
  assert.equal(dong.han_bao_hanh, '2027-12-31');

  assert.match(loiO(() => dm.themThietBi(nd.ql, hopLe)).ma_tai_san, /đã tồn tại/);
  assert.match(loiO(() => dm.themThietBi(nd.ql, { ...hopLe, ma_tai_san: 'MC-D3301-01' })).ma_tai_san, /đã tồn tại/);
  assert.ok(loiO(() => dm.themThietBi(nd.ql, { ...hopLe, ma_tai_san: 'MC-X', nam_su_dung: '1800' })).nam_su_dung);
  assert.ok(loiO(() => dm.themThietBi(nd.ql, { ...hopLe, ma_tai_san: 'MC-X', nam_su_dung: '2999' })).nam_su_dung);
  assert.ok(loiO(() => dm.themThietBi(nd.ql, { ...hopLe, ma_tai_san: 'MC-X', han_bao_hanh: '2027-02-30' })).han_bao_hanh);
  assert.ok(loiO(() => dm.themThietBi(nd.ql, { ...hopLe, ma_tai_san: 'MC-X', tinh_trang: 'LUNG_TUNG' })).tinh_trang);
  const thieu = loiO(() => dm.themThietBi(nd.ql, { ma_tai_san: '', ten_thiet_bi: '', loai_thiet_bi_id: '', phong_id: '' }));
  assert.deepEqual(Object.keys(thieu).sort(), ['loai_thiet_bi_id', 'ma_tai_san', 'phong_id', 'ten_thiet_bi']);

  // Sửa: đổi mã sang mã của thiết bị khác bị chặn; QL sửa tay được tình trạng (mục 6.3 đoạn cuối)
  assert.match(loiO(() => dm.suaThietBi(nd.ql, tb.id, { ...hopLe, ma_tai_san: 'MC-D3301-01' })).ma_tai_san, /đã tồn tại/);
  dm.suaThietBi(nd.ql, tb.id, { ...hopLe, ma_tai_san: 'MC-D3301-02', tinh_trang: 'CHO_THAY_THE' });
  assert.equal(layCsdl().prepare('SELECT tinh_trang FROM thiet_bi WHERE id = ?').get(tb.id).tinh_trang, 'CHO_THAY_THE');
});

// ---------------------------------------------------------------- BR-10: chặn xóa mục đã được tham chiếu
test('BR-10: không xóa được mục đã có yêu cầu tham chiếu, chỉ ngừng sử dụng; dữ liệu còn nguyên', () => {
  chan(() => dm.xoaThietBi(nd.ql, tbDaDung), 409, /yêu cầu tham chiếu/);
  chan(() => dm.xoaPhong(nd.ql, phongD3), 409, /yêu cầu tham chiếu/);
  chan(() => dm.xoaLoai(nd.ql, loaiMC), 409, /yêu cầu tham chiếu/);
  chan(() => dm.xoaNha(nd.ql, nhaD3), 409, /yêu cầu tham chiếu/);
  assert.ok(tonTai('thiet_bi', tbDaDung) && tonTai('phong', phongD3) && tonTai('loai_thiet_bi', loaiMC) && tonTai('toa_nha', nhaD3));
  assert.match(
    (() => { try { dm.xoaPhong(nd.ql, phongD3); } catch (e) { return e.message; } return ''; })(),
    /Ngừng sử dụng/,
  );

  // Thiết bị: "ngừng sử dụng" = Đã thanh lý, rồi mở lại được; vẫn không xóa được
  dm.ngungThietBi(nd.ql, tbDaDung);
  assert.equal(layCsdl().prepare('SELECT tinh_trang FROM thiet_bi WHERE id = ?').get(tbDaDung).tinh_trang, 'THANH_LY');
  chan(() => dm.ngungThietBi(nd.ql, tbDaDung), 409, /đã ngừng/);
  chan(() => dm.xoaThietBi(nd.ql, tbDaDung), 409);
  dm.moLaiThietBi(nd.ql, tbDaDung);
  assert.equal(layCsdl().prepare('SELECT tinh_trang FROM thiet_bi WHERE id = ?').get(tbDaDung).tinh_trang, 'HOAT_DONG');
  chan(() => dm.moLaiThietBi(nd.ql, tbDaDung), 409, /đang sử dụng/);

  // Loại đã dùng: ngừng được (không có ràng buộc cấp trên), mở lại được
  dm.ngungLoai(nd.ql, loaiMC);
  chan(() => dm.xoaLoai(nd.ql, loaiMC), 409);
  dm.moLaiLoai(nd.ql, loaiMC);
});

test('mục chưa từng được dùng thì xóa hẳn được; còn mục con thì phải xóa mục con trước', () => {
  const nha = dm.themNha(nd.ql, { ma_nha: 'TC', ten_nha: 'Thư viện' });
  const phong = dm.themPhong(nd.ql, { nha_id: nha.id, ma_phong: '201' });
  const loai = dm.themLoai(nd.ql, { ten_loai: 'Loại thử' });
  const tb = dm.themThietBi(nd.ql, { ma_tai_san: 'TC-201-01', ten_thiet_bi: 'Quạt', loai_thiet_bi_id: loai.id, phong_id: phong.id });
  layCsdl().prepare('INSERT INTO khu_vuc_phu_trach (ktv_id, toa_nha_id) VALUES (?, ?)').run(nd.ktv.id, nha.id);

  chan(() => dm.xoaNha(nd.ql, nha.id), 409, /còn 1 phòng/);
  chan(() => dm.xoaPhong(nd.ql, phong.id), 409, /còn 1 thiết bị/);
  chan(() => dm.xoaLoai(nd.ql, loai.id), 409, /còn 1 thiết bị/);

  dm.xoaThietBi(nd.ql, tb.id);
  assert.ok(!tonTai('thiet_bi', tb.id));
  dm.xoaLoai(nd.ql, loai.id);
  assert.ok(!tonTai('loai_thiet_bi', loai.id));
  dm.xoaPhong(nd.ql, phong.id);
  assert.ok(!tonTai('phong', phong.id));
  dm.xoaNha(nd.ql, nha.id);
  assert.ok(!tonTai('toa_nha', nha.id));
  assert.equal(dem('SELECT COUNT(*) n FROM khu_vuc_phu_trach WHERE toa_nha_id = ?', nha.id), 0, 'xóa nhà kéo theo cấu hình khu vực');
  chan(() => dm.xoaNha(nd.ql, nha.id), 404);
});

// ---------------------------------------------------------------- Ngừng sử dụng theo cấp (mục 6.1)
test('không ngừng nhà khi còn phòng đang dùng, không ngừng phòng khi còn thiết bị chưa thanh lý', () => {
  const nha = dm.themNha(nd.ql, { ma_nha: 'C7', ten_nha: 'Nhà C7' });
  const phong = dm.themPhong(nd.ql, { nha_id: nha.id, ma_phong: '102' });
  const tb = dm.themThietBi(nd.ql, { ma_tai_san: 'DH-C7102-01', ten_thiet_bi: 'Điều hòa', loai_thiet_bi_id: loaiMC, phong_id: phong.id });

  chan(() => dm.ngungNha(nd.ql, nha.id), 409, /còn 1 phòng đang sử dụng/);
  chan(() => dm.ngungPhong(nd.ql, phong.id), 409, /còn 1 thiết bị chưa thanh lý/);
  assert.equal(layCsdl().prepare('SELECT dang_su_dung FROM toa_nha WHERE id = ?').get(nha.id).dang_su_dung, 1);

  dm.ngungThietBi(nd.ql, tb.id); // thanh lý -> không còn "chưa thanh lý"
  dm.ngungPhong(nd.ql, phong.id);
  chan(() => dm.ngungPhong(nd.ql, phong.id), 409, /đã ngừng/);
  dm.ngungNha(nd.ql, nha.id);
  assert.equal(layCsdl().prepare('SELECT dang_su_dung FROM toa_nha WHERE id = ?').get(nha.id).dang_su_dung, 0);

  // Mục đã ngừng: không thêm con mới vào được; không mở lại con khi cha còn ngừng
  assert.match(loiO(() => dm.themPhong(nd.ql, { nha_id: nha.id, ma_phong: '103' })).nha_id, /ngừng sử dụng/);
  assert.match(loiO(() => dm.themThietBi(nd.ql, { ma_tai_san: 'X-1', ten_thiet_bi: 'x', loai_thiet_bi_id: loaiMC, phong_id: phong.id })).phong_id, /ngừng sử dụng/);
  chan(() => dm.moLaiPhong(nd.ql, phong.id), 409, /mở lại nhà/);
  chan(() => dm.moLaiThietBi(nd.ql, tb.id), 409, /mở lại phòng/);
  // Thiết bị trong phòng ngừng chỉ để được "Đã thanh lý"
  assert.ok(loiO(() => dm.suaThietBi(nd.ql, tb.id, { ma_tai_san: 'DH-C7102-01', ten_thiet_bi: 'Điều hòa', loai_thiet_bi_id: loaiMC, phong_id: phong.id, tinh_trang: 'HOAT_DONG' })).tinh_trang);

  dm.moLaiNha(nd.ql, nha.id);
  chan(() => dm.moLaiNha(nd.ql, nha.id), 409, /đang sử dụng/);
  dm.moLaiPhong(nd.ql, phong.id);
  dm.moLaiThietBi(nd.ql, tb.id);
});

test('mục ngừng sử dụng không hiện trong form S02 của SV, mục mới thì hiện', () => {
  const d8 = layCsdl().prepare(`SELECT id FROM toa_nha WHERE ma_nha = 'D8'`).get().id;
  const p101 = layCsdl().prepare(`SELECT id FROM phong WHERE toa_nha_id = ? AND ma_phong = '101'`).get(d8).id;
  const tb = dm.themThietBi(nd.ql, { ma_tai_san: 'MC-D8101-01', ten_thiet_bi: 'Máy chiếu', loai_thiet_bi_id: loaiMC, phong_id: p101 });

  let form = layDanhMucChoForm();
  assert.ok(form.nha.some((n) => n.ma === 'D8'));
  assert.ok(form.phong.some((p) => p.id === p101));
  assert.ok(form.thietBi.some((t) => t.id === tb.id));

  dm.ngungThietBi(nd.ql, tb.id);
  assert.ok(!layDanhMucChoForm().thietBi.some((t) => t.id === tb.id));
  dm.ngungLoai(nd.ql, loaiMC);
  assert.ok(!layDanhMucChoForm().loai.some((l) => l.id === loaiMC));
  dm.moLaiLoai(nd.ql, loaiMC);
  assert.ok(layDanhMucChoForm().loai.some((l) => l.id === loaiMC));
});

// ---------------------------------------------------------------- Số lần sửa và hồ sơ thiết bị (truy vấn)
test('số lần sửa chỉ tính yêu cầu đã tiếp nhận; hồ sơ thiết bị liệt kê đúng các lần đó', () => {
  const db = layCsdl();
  const tb = dm.themThietBi(nd.ql, { ma_tai_san: 'QU-D3301-01', ten_thiet_bi: 'Quạt trần', loai_thiet_bi_id: loaiMC, phong_id: phongD3 }).id;
  taoYeuCau({ trangThai: 'MOI', thietBi: tb });
  taoYeuCau({ trangThai: 'DA_HUY', thietBi: tb });
  taoYeuCau({ trangThai: 'TU_CHOI', thietBi: tb });
  const dangLam = taoYeuCau({ trangThai: 'DANG_SUA', thietBi: tb, tiepNhan: '2026-03-02 09:00:00' });
  const xong = taoYeuCau({ trangThai: 'HOAN_THANH', thietBi: tb, ketQua: 'KHAC_PHUC_TAI_CHO', tiepNhan: '2026-02-10 09:00:00', hoanThanh: '2026-02-11 10:30:00' });
  db.prepare(`INSERT INTO noi_dung_sua_chua (yeu_cau_id, stt, noi_dung, so_luong) VALUES (?, 1, 'Thay tụ quạt', 1), (?, 2, 'Thay bóng đèn', 2)`).run(xong, xong);
  db.prepare(`INSERT INTO phan_cong (yeu_cau_id, ktv_id, nguoi_giao_id, thoi_gian_giao, han_hoan_thanh, con_hieu_luc) VALUES (?, ?, ?, '2026-02-10 09:00:00', '2026-02-11 09:00:00', 1)`)
    .run(xong, nd.ktv.id, nd.ql.id);

  const dong = tv.lietKeThietBi({ q: 'QU-D3301-01', trang: 1 }).dong[0];
  assert.equal(dong.so_lan_sua, 2);
  assert.equal(dong.so_yeu_cau, 5);

  const hs = tv.hoSoThietBi(tb);
  assert.equal(hs.soLanSua, 2);
  assert.equal(hs.lichSu.length, 2);
  assert.equal(hs.phong, 'D3-301');
  // Mới nhất lên trước; dòng đã xong ghi KTV, nội dung đã sửa, kết quả
  assert.equal(hs.lichSu[0].yeuCauId, dangLam);
  assert.match(hs.lichSu[0].ketQua, /Đang xử lý/);
  const lanXong = hs.lichSu[1];
  assert.equal(lanXong.ngay, '2026-02-11');
  assert.equal(lanXong.ktv, 'Kỹ Thuật');
  assert.equal(lanXong.noiDung, 'Thay tụ quạt; Thay bóng đèn × 2');
  assert.equal(lanXong.ketQua, 'Khắc phục tại chỗ');
  assert.equal(tv.hoSoThietBi(999999), null);
});

test('danh sách có lọc theo nhà / phòng / loại / tình trạng và tìm kiếm', () => {
  const d8 = layCsdl().prepare(`SELECT id FROM toa_nha WHERE ma_nha = 'D8'`).get().id;
  assert.deepEqual(tv.lietKeNha({ q: 'D8' }).map((n) => n.ma_nha), ['D8']);
  assert.equal(tv.lietKeNha({ q: '' }).find((n) => n.ma_nha === 'D3').so_phong, 1);
  assert.deepEqual(tv.lietKePhong({ nha: d8, q: '', trang: 1 }).dong.map((p) => p.ma_phong).sort(), ['101', '301']);
  assert.ok(tv.lietKeLoai({ q: 'chiếu' }).some((l) => l.ten_loai === 'Máy chiếu'));
  assert.ok(tv.lietKeThietBi({ nha: d8, trang: 1 }).dong.every((t) => t.ma_nha === 'D8'));
  assert.equal(tv.lietKeThietBi({ tt: 'CHO_THAY_THE', trang: 1 }).dong.every((t) => t.tinh_trang === 'CHO_THAY_THE'), true);
  // Ký tự đặc biệt của LIKE không làm hỏng tìm kiếm
  assert.equal(tv.lietKeThietBi({ q: '%', trang: 1 }).tong, 0);
});
