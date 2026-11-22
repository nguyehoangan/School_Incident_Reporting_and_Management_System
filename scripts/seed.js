// Tạo lại CSDL và nạp dữ liệu mẫu (SPEC mục 13.3).
// Chạy: npm run seed
//
// Các yêu cầu mẫu được "diễn lại" từng bước (gửi → phân công → ... ) để lịch sử xử lý, phân công,
// nội dung sửa chữa, biên bản và tình trạng thiết bị luôn khớp với trạng thái cuối (mục 5, 6.3, 7.2).
// Đây chỉ là dữ liệu mẫu; logic chuyển trạng thái thật của ứng dụng nằm ở services/yeuCau.js (đợt 3).

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const bcrypt = require('bcrypt');
const { DUONG_DAN_CSDL, moCsdl } = require('../db');
const { gioVN, docGioVN, dinhDang } = require('../lib/thoiGian');
const { TRANG_THAI_YEU_CAU, PHUONG_AN } = require('../lib/hangSo');

const MAT_KHAU_DEMO = '123456';
const THU_MUC_ANH = path.join(__dirname, '..', 'uploads', 'seed');

// ---------------------------------------------------------------- Danh mục
const TAI_KHOAN = [
  { khoa: 'ql',   email: 'quanly@hust.edu.vn',           ho_ten: 'Nguyễn Thị Lan', vai_tro: 'QUAN_LY',       ma_so: 'NV001',    sdt: '0912000001' },
  { khoa: 'binh', email: 'ktv.binh@hust.edu.vn',         ho_ten: 'Trần Văn Bình',  vai_tro: 'KY_THUAT_VIEN', ma_so: 'NV101',    sdt: '0912000101' },
  { khoa: 'hoa',  email: 'ktv.hoa@hust.edu.vn',          ho_ten: 'Lê Thị Hoa',     vai_tro: 'KY_THUAT_VIEN', ma_so: 'NV102',    sdt: '0912000102' },
  { khoa: 'duc',  email: 'ktv.duc@hust.edu.vn',          ho_ten: 'Phạm Minh Đức',  vai_tro: 'KY_THUAT_VIEN', ma_so: 'NV103',    sdt: '0912000103' },
  { khoa: 'an',   email: 'an.nh225001@sis.hust.edu.vn',  ho_ten: 'Nguyễn Hoàng An', vai_tro: 'SINH_VIEN',    ma_so: '20225001', sdt: null },
  { khoa: 'ha',   email: 'ha.tt225002@sis.hust.edu.vn',  ho_ten: 'Trần Thu Hà',    vai_tro: 'SINH_VIEN',     ma_so: '20225002', sdt: null },
  { khoa: 'minh', email: 'minh.lv225003@sis.hust.edu.vn', ho_ten: 'Lê Văn Minh',   vai_tro: 'SINH_VIEN',     ma_so: '20225003', sdt: null },
];

// Mục 7.1
const KHU_VUC = { binh: ['D3', 'D5'], hoa: ['D9', 'C7'], duc: ['TC', 'D3'] };

// Mục 6: 11 loại thiết bị. tienTo dùng cho mã tài sản.
const LOAI = [
  { ten: 'Bàn ghế',   tienTo: 'BG', tenTB: 'Bộ bàn ghế sinh viên', model: ['Hòa Phát BSV-102', 'Xuân Hòa BHS-11'] },
  { ten: 'Bảng',      tienTo: 'BA', tenTB: 'Bảng viết',            model: ['Bảng từ trắng Bavico 1,2×3,6 m', 'Bảng xanh chống lóa Hàn Quốc'] },
  { ten: 'Cửa',       tienTo: 'CU', tenTB: 'Cửa ra vào',           model: ['Cửa nhôm kính Xingfa', 'Cửa gỗ công nghiệp An Cường'] },
  { ten: 'Máy chiếu', tienTo: 'MC', tenTB: 'Máy chiếu',            model: ['Epson EB-X51', 'Panasonic PT-LB383', 'Sony VPL-EX435'] },
  { ten: 'TV',        tienTo: 'TV', tenTB: 'TV màn hình lớn',      model: ['Samsung UA65AU7700', 'LG 75UQ8050'] },
  { ten: 'Quạt',      tienTo: 'QU', tenTB: 'Quạt trần',            model: ['Panasonic F-60MZ2', 'Mỹ Phong QT-1400'] },
  { ten: 'Điều hòa',  tienTo: 'DH', tenTB: 'Điều hòa',             model: ['Daikin FTKB50', 'Panasonic CU/CS-XU18', 'Mitsubishi MSY-JP50'] },
  { ten: 'Đèn',       tienTo: 'DE', tenTB: 'Bộ đèn LED',           model: ['Rạng Đông LED tube T8 1,2 m', 'Philips LED panel 600×600'] },
  { ten: 'Ổ điện',    tienTo: 'OD', tenTB: 'Ổ điện âm tường',      model: ['Panasonic WEV1081', 'Sino S18'] },
  { ten: 'Loa/Micro', tienTo: 'LM', tenTB: 'Bộ loa – micro',       model: ['JBL Control 25 + micro Shure', 'Bosch LBD3903 + micro TOA'] },
  { ten: 'Khác',      tienTo: 'KH', tenTB: 'Thiết bị khác',        model: [] },
];

// Thứ tự thiết bị theo loại phòng; mỗi phòng lấy n thiết bị đầu danh sách (n = 3..6)
const BO_THIET_BI = {
  'Phòng học':        ['MC', 'DH', 'QU', 'DE', 'BA', 'BG'],
  'Phòng thí nghiệm': ['DH', 'OD', 'DE', 'BG', 'TV', 'QU'],
  'Hội trường':       ['LM', 'MC', 'DH', 'DE', 'BG', 'CU'],
  'Phòng đọc':        ['DE', 'DH', 'QU', 'OD', 'BG', 'TV'],
};

const NHA = [
  { ma: 'D3', ten: 'Nhà D3', phong: [['101', 'Phòng học'], ['201', 'Phòng học'], ['301', 'Phòng học'], ['302', 'Phòng học'], ['401', 'Hội trường']] },
  { ma: 'D5', ten: 'Nhà D5', phong: [['104', 'Phòng học'], ['204', 'Phòng học'], ['305', 'Phòng học'], ['406', 'Phòng thí nghiệm']] },
  { ma: 'D9', ten: 'Nhà D9', phong: [['101', 'Hội trường'], ['203', 'Phòng học'], ['304', 'Phòng học'], ['402', 'Phòng thí nghiệm']] },
  { ma: 'C7', ten: 'Nhà C7', phong: [['102', 'Phòng học'], ['201', 'Phòng học'], ['216', 'Phòng thí nghiệm'], ['305', 'Phòng học']] },
  { ma: 'TC', ten: 'Thư viện Tạ Quang Bửu', phong: [['201', 'Phòng đọc'], ['305', 'Phòng đọc'], ['401', 'Hội trường'], ['502', 'Phòng đọc']] },
];

const NGUON_KINH_PHI = ['Ngân sách nhà nước', 'Nguồn thu sự nghiệp', 'Tài trợ – xã hội hóa'];

// ---------------------------------------------------------------- Yêu cầu mẫu
// phong: 'Nhà-Phòng'; tb: tiền tố loại thiết bị trong phòng, hoặc khac: tên loại khi "Không có trong danh sách".
// gui: số giờ trước thời điểm chạy seed; buoc: các bước xử lý, mỗi bước có 'sau' = số giờ sau bước trước.
const YEU_CAU = [
  // ---- MOI (5)
  { phong: 'D3-201', tb: 'MC', sv: 'an', muc_do: 'KHAN_CAP', gui: 2, mo_ta: 'Máy chiếu bật không lên hình, đèn báo nhấp nháy đỏ. Lớp chiều nay không học được.', buoc: [] },
  { phong: 'D5-204', tb: 'QU', sv: 'minh', muc_do: 'BINH_THUONG', gui: 5, mo_ta: 'Quạt trần kêu to và rung mạnh khi bật số 3.', buoc: [] },
  { phong: 'C7-201', tb: 'DE', sv: 'ha', muc_do: 'BINH_THUONG', gui: 20, mo_ta: 'Hai bóng đèn cuối lớp không sáng, bóng còn lại nhấp nháy.', buoc: [] },
  { phong: 'TC-305', tb: 'OD', sv: 'an', muc_do: 'KHAN_CAP', gui: 1, mo_ta: 'Ổ điện cạnh bàn số 12 có mùi khét và tóe lửa khi cắm sạc.', buoc: [] },
  { phong: 'D9-203', khac: 'Cửa', sv: 'minh', muc_do: 'BINH_THUONG', gui: 28, mo_ta: 'Tay nắm cửa sau bị gãy, cửa không đóng lại được.', buoc: [] },

  // ---- DA_PHAN_CONG (4)
  { phong: 'D3-302', tb: 'DH', sv: 'ha', muc_do: 'BINH_THUONG', gui: 30, mo_ta: 'Điều hòa chảy nước xuống dãy bàn đầu.',
    buoc: [{ lam: 'phanCong', ktv: 'binh', sau: 2, ghiChu: 'Kiểm tra ống thoát nước dàn lạnh.', ghiChuSv: 'Đã giao kỹ thuật viên kiểm tra.' }] },
  { phong: 'D5-104', tb: 'BA', sv: 'an', muc_do: 'BINH_THUONG', gui: 110, mo_ta: 'Bảng từ bong lớp phủ ở giữa, viết bút dạ không ăn mực.',
    buoc: [{ lam: 'phanCong', ktv: 'binh', sau: 3 }] },
  { phong: 'D9-101', tb: 'LM', sv: 'minh', muc_do: 'KHAN_CAP', gui: 6, mo_ta: 'Micro không dây mất tiếng, loa rè khi tăng âm lượng.',
    buoc: [{ lam: 'phanCong', ktv: 'hoa', sau: 1 }, { lam: 'doiKtv', ktv: 'duc', sau: 1, lyDo: 'KTV Hoa đang xử lý sự cố ở C7' }] },
  { phong: 'TC-201', tb: 'TV', sv: 'ha', muc_do: 'BINH_THUONG', gui: 48, mo_ta: 'TV không nhận tín hiệu HDMI từ máy tính.',
    buoc: [{ lam: 'phanCong', ktv: 'duc', sau: 2 }] },

  // ---- DANG_SUA (3)
  { phong: 'D3-101', tb: 'QU', sv: 'an', muc_do: 'BINH_THUONG', gui: 20, mo_ta: 'Quạt trần số 2 không quay, có tiếng ù ở hộp số.',
    buoc: [{ lam: 'phanCong', ktv: 'binh', sau: 2 }, { lam: 'batDau', sau: 3 }] },
  { phong: 'C7-216', tb: 'OD', sv: 'minh', muc_do: 'KHAN_CAP', gui: 100, mo_ta: 'Ổ điện bàn thí nghiệm số 3 mất điện hoàn toàn.',
    buoc: [{ lam: 'phanCong', ktv: 'hoa', sau: 1 }, { lam: 'batDau', sau: 20 }] },
  { phong: 'TC-401', tb: 'MC', sv: 'an', muc_do: 'BINH_THUONG', gui: 26, mo_ta: 'Máy chiếu hội trường hình bị ám vàng, chữ mờ.',
    buoc: [{ lam: 'phanCong', ktv: 'duc', sau: 2 }, { lam: 'batDau', sau: 16 }] },

  // ---- CHO_NGHIEM_THU (4: 2 tại chỗ, 2 không khắc phục)
  { phong: 'D5-305', tb: 'DE', sv: 'ha', muc_do: 'BINH_THUONG', gui: 70, mo_ta: 'Dãy đèn sát cửa sổ tắt hẳn, công tắc bật không có tác dụng.',
    buoc: [{ lam: 'phanCong', ktv: 'binh', sau: 2 }, { lam: 'batDau', sau: 18 },
      { lam: 'baoTaiCho', sau: 3, anhSau: true, dong: [['Thay bóng đèn LED tube 1,2 m', 2, 'Bóng dự phòng kho'], ['Thay công tắc đôi', 1, '']] }] },
  { phong: 'D9-304', tb: 'MC', sv: 'minh', muc_do: 'KHAN_CAP', gui: 50, mo_ta: 'Máy chiếu tự tắt sau khoảng 10 phút sử dụng.',
    buoc: [{ lam: 'phanCong', ktv: 'hoa', sau: 1 }, { lam: 'batDau', sau: 2 },
      { lam: 'baoTaiCho', sau: 2, dong: [['Vệ sinh lưới lọc gió, quạt tản nhiệt', 1, ''], ['Thay cáp VGA', 1, 'Cáp cũ gãy chân']] }] },
  { phong: 'D3-201', tb: 'DH', sv: 'an', muc_do: 'BINH_THUONG', gui: 120, mo_ta: 'Điều hòa bật lên chỉ có quạt gió, không ra hơi lạnh.',
    buoc: [{ lam: 'phanCong', ktv: 'duc', sau: 2 }, { lam: 'batDau', sau: 20 },
      { lam: 'baoKhong', sau: 4, bienBan: { tinhTrang: 'Máy nén không chạy, quạt dàn nóng vẫn quay bình thường.', nguyenNhan: 'Hỏng block máy nén.', thueSua: 'Thuê đơn vị bảo trì điều hòa thay block máy nén.' } }] },
  { phong: 'TC-201', tb: 'DH', sv: 'ha', muc_do: 'BINH_THUONG', gui: 140, mo_ta: 'Điều hòa báo lỗi, đèn nháy liên tục, không điều khiển được.',
    buoc: [{ lam: 'phanCong', ktv: 'duc', sau: 3 }, { lam: 'batDau', sau: 18 },
      { lam: 'baoKhong', sau: 3, bienBan: { tinhTrang: 'Dàn lạnh báo lỗi U4, không nhận lệnh từ điều khiển.', nguyenNhan: 'Hỏng bo mạch điều khiển dàn lạnh.', muaVatTu: 'Mua 01 bo mạch điều khiển dàn lạnh đúng model.' } }] },

  // ---- CHUYEN_XU_LY (2)
  { phong: 'D9-402', tb: 'DH', sv: 'minh', muc_do: 'BINH_THUONG', gui: 300, mo_ta: 'Điều hòa phòng thí nghiệm chạy nhưng không lạnh, có tiếng kêu lạch cạch.',
    buoc: [{ lam: 'phanCong', ktv: 'hoa', sau: 2 }, { lam: 'batDau', sau: 18 },
      { lam: 'baoKhong', sau: 4, bienBan: { tinhTrang: 'Máy chạy ồn, áp suất gas thấp.', nguyenNhan: 'Rò gas ở dàn nóng, quạt dàn nóng mòn bạc.', thueSua: 'Thuê đơn vị sửa: hàn ống, nạp gas, thay quạt dàn nóng.' } },
      { lam: 'chuyenPA', sau: 24, phuongAn: 'THUE_NGOAI', soToTrinh: 'TT-112/QTVT' }] },
  { phong: 'C7-305', tb: 'MC', sv: 'an', muc_do: 'KHAN_CAP', gui: 240, mo_ta: 'Máy chiếu không lên nguồn, có mùi khét.',
    buoc: [{ lam: 'phanCong', ktv: 'hoa', sau: 1 }, { lam: 'batDau', sau: 3 },
      { lam: 'baoKhong', sau: 3, bienBan: { tinhTrang: 'Không lên nguồn, bo nguồn có vết cháy.', nguyenNhan: 'Cháy bo nguồn; máy đã dùng lâu năm.', thanhLy: 'Đề nghị thanh lý, mua máy chiếu mới thay thế.' } },
      { lam: 'chuyenPA', sau: 20, phuongAn: 'THANH_LY', soToTrinh: 'TT-118/QTVT' }] },

  // ---- HOAN_THANH (5)
  { phong: 'D3-301', tb: 'BA', sv: 'ha', muc_do: 'BINH_THUONG', gui: 500, mo_ta: 'Bảng bị lỏng một bên, nghiêng khi viết.',
    buoc: [{ lam: 'phanCong', ktv: 'binh', sau: 2 }, { lam: 'batDau', sau: 18 },
      { lam: 'baoTaiCho', sau: 2, anhSau: true, dong: [['Bắt lại vít nở giá treo bảng', 4, '']] }, { lam: 'nghiemThu', sau: 20 }] },
  { phong: 'D5-204', tb: 'MC', sv: 'an', muc_do: 'KHAN_CAP', gui: 400, mo_ta: 'Máy chiếu hình rất tối, gần như không nhìn thấy chữ.',
    buoc: [{ lam: 'phanCong', ktv: 'binh', sau: 1 }, { lam: 'batDau', sau: 2 },
      { lam: 'baoTaiCho', sau: 2, dong: [['Thay bóng đèn máy chiếu', 1, 'Bóng dự phòng kho']] },
      { lam: 'lamLai', sau: 20, lyDo: 'Hình vẫn mờ, chưa căn chỉnh tiêu cự' },
      { lam: 'batDau', sau: 16 },
      { lam: 'baoTaiCho', sau: 2, anhSau: true, dong: [['Thay bóng đèn máy chiếu', 1, 'Bóng dự phòng kho'], ['Căn chỉnh tiêu cự và keystone', 1, '']] },
      { lam: 'nghiemThu', sau: 6 }] },
  { phong: 'TC-502', tb: 'QU', sv: 'minh', muc_do: 'BINH_THUONG', gui: 600, mo_ta: 'Quạt trần quay chậm dù đã bật số lớn nhất.',
    buoc: [{ lam: 'phanCong', ktv: 'duc', sau: 3 }, { lam: 'batDau', sau: 18 },
      { lam: 'baoTaiCho', sau: 2, anhSau: true, dong: [['Thay tụ quạt 2,5 µF', 1, '']] }, { lam: 'nghiemThu', sau: 22 }] },
  { phong: 'C7-201', tb: 'DH', sv: 'ha', muc_do: 'BINH_THUONG', gui: 700, mo_ta: 'Điều hòa chạy yếu, phòng không mát.',
    buoc: [{ lam: 'phanCong', ktv: 'hoa', sau: 2 }, { lam: 'batDau', sau: 18 },
      { lam: 'baoKhong', sau: 3, bienBan: { tinhTrang: 'Máy chạy nhưng dòng điện thấp, dàn lạnh không đủ lạnh.', nguyenNhan: 'Tụ máy nén yếu, thiếu gas.', muaVatTu: 'Mua 01 tụ máy nén 35 µF và gas R32 để nạp bổ sung.' } },
      { lam: 'chuyenPA', sau: 24, phuongAn: 'MUA_VAT_TU', soToTrinh: 'TT-097/QTVT' },
      { lam: 'dong', sau: 120, ketQua: 'Đã thay tụ và nạp gas, điều hòa chạy bình thường.', soBienBan: 'BB-087/2026', tinhTrangTB: 'HOAT_DONG' }] },
  { phong: 'D9-101', tb: 'BG', sv: 'minh', muc_do: 'BINH_THUONG', gui: 800, mo_ta: 'Dãy ghế hàng 5 gãy chân, ngồi bị lật.',
    buoc: [{ lam: 'phanCong', ktv: 'hoa', sau: 2 }, { lam: 'batDau', sau: 20 },
      { lam: 'baoKhong', sau: 2, bienBan: { tinhTrang: 'Khung ghế gãy 2 chân, gỉ sét nhiều mối hàn.', nguyenNhan: 'Hết niên hạn sử dụng, khung kim loại mục.', thanhLy: 'Đề nghị thanh lý, mua bộ bàn ghế mới.' } },
      { lam: 'chuyenPA', sau: 30, phuongAn: 'THANH_LY', soToTrinh: 'TT-090/QTVT' },
      { lam: 'dong', sau: 200, ketQua: 'Đã thanh lý bộ cũ và lắp bộ bàn ghế mới.', soBienBan: 'BB-079/2026', tinhTrangTB: 'THANH_LY' }] },

  // ---- TU_CHOI (2)
  { phong: 'D3-401', tb: 'LM', sv: 'an', muc_do: 'BINH_THUONG', gui: 90, mo_ta: 'Loa hội trường không có tiếng.',
    buoc: [{ lam: 'tuChoi', sau: 3, lyDo: 'Kiểm tra thấy loa hoạt động bình thường, do chưa bật nguồn ampli.' }] },
  { phong: 'C7-102', khac: 'Khác', sv: 'ha', muc_do: 'BINH_THUONG', gui: 75, mo_ta: 'Phòng thiếu ổ cắm sạc laptop, đề nghị lắp thêm cho dãy bàn giữa.',
    buoc: [{ lam: 'tuChoi', sau: 4, lyDo: 'Không thuộc phạm vi sửa chữa; đề nghị lắp mới gửi qua phòng Quản trị.' }] },

  // ---- DA_HUY (1)
  { phong: 'D5-104', tb: 'DH', sv: 'minh', muc_do: 'BINH_THUONG', gui: 160, mo_ta: 'Điều hòa không bật được bằng điều khiển.',
    buoc: [{ lam: 'huy', sau: 1 }] },
];

// ---------------------------------------------------------------- Tiện ích
// Hạn kiểm tra mặc định (BR-06): Khẩn cấp = cuối ngày giao; Bình thường = 01 ngày làm việc (bỏ T7, CN).
function hanMacDinh(thoiGianGiao, mucDo) {
  if (mucDo === 'KHAN_CAP') return thoiGianGiao.slice(0, 10) + ' 23:59:00';
  const d = docGioVN(thoiGianGiao);
  let ngay = new Date(d.getTime() + 24 * 3600e3);
  // thứ trong tuần theo giờ VN
  const thu = (x) => new Date(x.getTime() + 7 * 3600e3).getUTCDay();
  while (thu(ngay) === 0 || thu(ngay) === 6) ngay = new Date(ngay.getTime() + 24 * 3600e3);
  return gioVN(ngay);
}

// Giờ hành chính cho dữ liệu mẫu (giờ VN): SV gửi trong khoảng 7:00–21:00,
// QL/KTV xử lý trong 7:30–17:30 các ngày thứ Hai–Sáu.
const MOT_NGAY = 24 * 3600e3;
const LECH_VN = 7 * 3600e3;
const gioTrongNgay = (d) => { const v = new Date(d.getTime() + LECH_VN); return v.getUTCHours() + v.getUTCMinutes() / 60; };
const thuVN = (d) => new Date(d.getTime() + LECH_VN).getUTCDay();
function datGio(d, gio) {
  const v = new Date(d.getTime() + LECH_VN);
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()) + Math.round(gio * 60) * 60e3 - LECH_VN);
}
function gioGuiHopLy(d) { // lùi về trước để không vượt thời điểm hiện tại
  const h = gioTrongNgay(d);
  const phut = (h % 1);
  if (h >= 21) return datGio(d, 20 + phut);
  if (h < 7) return datGio(new Date(d.getTime() - MOT_NGAY), 20 + phut);
  return d;
}
function gioXuLyHopLy(d) { // đẩy tới giờ hành chính gần nhất
  let x = d;
  for (;;) {
    const h = gioTrongNgay(x);
    if (thuVN(x) === 0 || thuVN(x) === 6) x = datGio(new Date(x.getTime() + MOT_NGAY), 7.5 + (h % 1) / 2);
    else if (h < 7.5) x = datGio(x, 7.5 + (h % 1) / 2);
    else if (h > 17.5) x = datGio(new Date(x.getTime() + MOT_NGAY), 7.5 + (h % 1) / 2);
    else return x;
  }
}

// Lập thời gian cho các bước của một yêu cầu; lùi cả yêu cầu thêm 1 ngày nếu bước cuối rơi vào tương lai.
function lapLich(yc, bayGio) {
  for (let lui = 0; lui < 10; lui++) {
    const tGui = gioGuiHopLy(new Date(bayGio.getTime() - yc.gui * 3600e3 - lui * MOT_NGAY));
    let t = tGui;
    const dsT = yc.buoc.map((b) => (t = gioXuLyHopLy(new Date(t.getTime() + b.sau * 3600e3))));
    if (t <= bayGio) return { tGui, dsT };
  }
  throw new Error(`Không lập được lịch cho yêu cầu ở ${yc.phong}`);
}

// Ảnh PNG giữ chỗ (màu trơn + sọc) để yêu cầu mẫu có ảnh đính kèm.
const BANG_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = BANG_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function khoiPng(loai, duLieu) {
  const dai = Buffer.alloc(4); dai.writeUInt32BE(duLieu.length);
  const loaiDl = Buffer.concat([Buffer.from(loai, 'ascii'), duLieu]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(loaiDl));
  return Buffer.concat([dai, loaiDl, crc]);
}
function taoPng(rong, cao, [r, g, b]) {
  const dong = rong * 3 + 1;
  const tho = Buffer.alloc(dong * cao);
  for (let y = 0; y < cao; y++) {
    tho[y * dong] = 0;
    for (let x = 0; x < rong; x++) {
      const soc = ((x + y) >> 4) % 2 === 0 ? 1 : 0.85;
      const i = y * dong + 1 + x * 3;
      tho[i] = Math.round(r * soc); tho[i + 1] = Math.round(g * soc); tho[i + 2] = Math.round(b * soc);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(rong, 0); ihdr.writeUInt32BE(cao, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    khoiPng('IHDR', ihdr), khoiPng('IDAT', zlib.deflateSync(tho)), khoiPng('IEND', Buffer.alloc(0)),
  ]);
}
const MAU_ANH = { TRUOC: [196, 120, 110], SAU: [110, 170, 125] };

// ---------------------------------------------------------------- Chạy
function main() {
  // Xóa CSDL cũ và ảnh mẫu cũ
  for (const duoi of ['', '-wal', '-shm']) fs.rmSync(DUONG_DAN_CSDL + duoi, { force: true });
  fs.rmSync(THU_MUC_ANH, { recursive: true, force: true });
  fs.mkdirSync(THU_MUC_ANH, { recursive: true });

  const db = moCsdl();
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));

  const bayGio = new Date(Math.floor(Date.now() / 60e3) * 60e3); // làm tròn phút
  const idND = {};
  const tenND = {};

  const napDanhMuc = db.transaction(() => {
    // Tài khoản
    const themND = db.prepare(`INSERT INTO nguoi_dung (email, mat_khau_hash, ho_ten, vai_tro, ma_so, so_dien_thoai, trang_thai)
                               VALUES (?, ?, ?, ?, ?, ?, 'HOAT_DONG')`);
    for (const t of TAI_KHOAN) {
      const hash = bcrypt.hashSync(MAT_KHAU_DEMO, 10);
      idND[t.khoa] = themND.run(t.email, hash, t.ho_ten, t.vai_tro, t.ma_so, t.sdt).lastInsertRowid;
      tenND[t.khoa] = t.ho_ten;
    }

    // Loại thiết bị
    const themLoai = db.prepare('INSERT INTO loai_thiet_bi (ten_loai, dang_su_dung) VALUES (?, 1)');
    for (const l of LOAI) l.id = themLoai.run(l.ten).lastInsertRowid;

    // Nhà, phòng, thiết bị
    const themNha = db.prepare('INSERT INTO toa_nha (ma_nha, ten_nha, dang_su_dung) VALUES (?, ?, 1)');
    const themPhong = db.prepare('INSERT INTO phong (toa_nha_id, ma_phong, tang, loai_phong, dang_su_dung) VALUES (?, ?, ?, ?, 1)');
    const themTB = db.prepare(`INSERT INTO thiet_bi (ma_tai_san, ten_thiet_bi, loai_thiet_bi_id, phong_id, model_hang,
                                 nam_su_dung, nguon_kinh_phi, han_bao_hanh, tinh_trang)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'HOAT_DONG')`);
    let iPhong = 0;
    let iTB = 0;
    for (const nha of NHA) {
      nha.id = themNha.run(nha.ma, nha.ten).lastInsertRowid;
      nha.dsPhong = {};
      for (const [maPhong, loaiPhong] of nha.phong) {
        const phongId = themPhong.run(nha.id, maPhong, Number(maPhong[0]), loaiPhong).lastInsertRowid;
        const p = { id: phongId, nhaId: nha.id, maNha: nha.ma, ma: maPhong, thietBi: {} };
        nha.dsPhong[maPhong] = p;
        const soTB = 3 + ((iPhong * 7) % 4); // 3..6
        for (const tienTo of BO_THIET_BI[loaiPhong].slice(0, soTB)) {
          const l = LOAI.find((x) => x.tienTo === tienTo);
          const nam = 2015 + ((iTB * 3) % 10);
          const ma = `${tienTo}-${nha.ma}${maPhong}-01`;
          const id = themTB.run(ma, l.tenTB, l.id, phongId, l.model[iTB % l.model.length], nam,
            NGUON_KINH_PHI[iTB % NGUON_KINH_PHI.length], `${nam + 2 + (iTB % 4)}-12-31`).lastInsertRowid;
          p.thietBi[tienTo] = { id, ma, hanBaoHanh: `${nam + 2 + (iTB % 4)}-12-31` };
          iTB++;
        }
        iPhong++;
      }
    }

    // Khu vực phụ trách (mục 7.1)
    const themKV = db.prepare('INSERT INTO khu_vuc_phu_trach (ktv_id, toa_nha_id) VALUES (?, ?)');
    for (const [ktv, dsNha] of Object.entries(KHU_VUC)) {
      for (const ma of dsNha) themKV.run(idND[ktv], NHA.find((n) => n.ma === ma).id);
    }
  });
  napDanhMuc();

  // ---- Yêu cầu: tính thời gian gửi, đánh mã YC-năm-số theo thứ tự gửi
  const ds = YEU_CAU.map((yc) => {
    const [maNha, maPhong] = yc.phong.split('-');
    const p = NHA.find((n) => n.ma === maNha).dsPhong[maPhong];
    if (!p) throw new Error(`Không có phòng ${yc.phong}`);
    let thietBi = null;
    let loai;
    if (yc.tb) {
      thietBi = p.thietBi[yc.tb];
      if (!thietBi) throw new Error(`Phòng ${yc.phong} không có thiết bị loại ${yc.tb}`);
      loai = LOAI.find((l) => l.tienTo === yc.tb);
    } else {
      loai = LOAI.find((l) => l.ten === yc.khac);
    }
    const { tGui: tgGui, dsT } = lapLich(yc, bayGio);
    return { ...yc, p, thietBi, loai, tgGui, dsT };
  }).sort((a, b) => a.tgGui - b.tgGui);

  const demTheoNam = {};
  for (const yc of ds) {
    const nam = gioVN(yc.tgGui).slice(0, 4);
    demTheoNam[nam] = (demTheoNam[nam] || 0) + 1;
    yc.ma = `YC-${nam}-${String(demTheoNam[nam]).padStart(4, '0')}`;
  }

  const q = {
    themYC: db.prepare(`INSERT INTO yeu_cau (ma_yeu_cau, sinh_vien_id, phong_id, thiet_bi_id, loai_thiet_bi_id, muc_do, mo_ta,
                          trang_thai, thoi_gian_gui, thoi_gian_cap_nhat)
                        VALUES (?, ?, ?, ?, ?, ?, ?, 'MOI', ?, ?)`),
    capNhat: (id, cot) => {
      const ten = Object.keys(cot);
      db.prepare(`UPDATE yeu_cau SET ${ten.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...ten.map((c) => cot[c]), id);
    },
    lichSu: db.prepare(`INSERT INTO lich_su_xu_ly (yeu_cau_id, nguoi_thuc_hien_id, tu_trang_thai, den_trang_thai, noi_dung, thoi_gian)
                        VALUES (?, ?, ?, ?, ?, ?)`),
    anh: db.prepare('INSERT INTO anh_dinh_kem (yeu_cau_id, duong_dan, loai_anh, nguoi_tai_id) VALUES (?, ?, ?, ?)'),
    phanCong: db.prepare(`INSERT INTO phan_cong (yeu_cau_id, ktv_id, nguoi_giao_id, thoi_gian_giao, han_hoan_thanh, ghi_chu_giao_viec, con_hieu_luc)
                          VALUES (?, ?, ?, ?, ?, ?, 1)`),
    hetHieuLucPC: db.prepare('UPDATE phan_cong SET con_hieu_luc = 0 WHERE yeu_cau_id = ? AND con_hieu_luc = 1'),
    noiDung: db.prepare('INSERT INTO noi_dung_sua_chua (yeu_cau_id, stt, noi_dung, so_luong, ghi_chu) VALUES (?, ?, ?, ?, ?)'),
    xoaNoiDung: db.prepare('DELETE FROM noi_dung_sua_chua WHERE yeu_cau_id = ?'),
    bienBan: db.prepare(`INSERT INTO bien_ban_kiem_tra (yeu_cau_id, ktv_id, thoi_gian, tinh_trang_su_co, nguyen_nhan,
                           de_xuat_mua_vat_tu, de_xuat_thue_sua, de_xuat_thanh_ly, con_bao_hanh, con_hieu_luc)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`),
    hetHieuLucBB: db.prepare('UPDATE bien_ban_kiem_tra SET con_hieu_luc = 0 WHERE yeu_cau_id = ? AND con_hieu_luc = 1'),
    tinhTrangTB: db.prepare('UPDATE thiet_bi SET tinh_trang = ? WHERE id = ?'),
  };

  function luuAnh(yc, loai, soThuTu, nguoiTai) {
    const ten = `${yc.ma}-${loai.toLowerCase()}-${soThuTu}.png`;
    fs.writeFileSync(path.join(THU_MUC_ANH, ten), taoPng(480, 320, MAU_ANH[loai]));
    q.anh.run(yc.id, `/uploads/seed/${ten}`, loai, nguoiTai);
  }

  const napYeuCau = db.transaction(() => {
    for (const yc of ds) {
      const t0 = yc.tgGui;
      let tt = 'MOI';
      let ktvHienTai = null;
      const sv = idND[yc.sv];
      const ql = idND.ql;
      const tbId = yc.thietBi ? yc.thietBi.id : null;

      // Bước 1: SV gửi
      const tGui = gioVN(t0);
      yc.id = q.themYC.run(yc.ma, sv, yc.p.id, tbId, yc.loai.id, yc.muc_do, yc.mo_ta, tGui, tGui).lastInsertRowid;
      q.lichSu.run(yc.id, sv, null, 'MOI', 'Gửi yêu cầu', tGui);
      luuAnh(yc, 'TRUOC', 1, sv);
      if (yc.muc_do === 'KHAN_CAP') luuAnh(yc, 'TRUOC', 2, sv);

      const chuyen = (nguoi, den, noiDung, tg, cot = {}) => {
        q.lichSu.run(yc.id, nguoi, tt, den, noiDung, tg);
        q.capNhat(yc.id, { trang_thai: den, thoi_gian_cap_nhat: tg, ...cot });
        tt = den;
      };
      const giaoViec = (ktv, tg, ghiChu) => {
        const han = hanMacDinh(tg, yc.muc_do);
        q.phanCong.run(yc.id, idND[ktv], ql, tg, han, ghiChu || null);
        ktvHienTai = ktv;
        return han;
      };

      for (const [iBuoc, b] of yc.buoc.entries()) {
        const tg = gioVN(yc.dsT[iBuoc]);
        switch (b.lam) {
          case 'phanCong': {
            const han = giaoViec(b.ktv, tg, b.ghiChu);
            chuyen(ql, 'DA_PHAN_CONG', `Tiếp nhận & phân công cho ${tenND[b.ktv]}. Hạn kiểm tra: ${dinhDang(han)}`, tg,
              { nguoi_tiep_nhan_id: ql, thoi_gian_tiep_nhan: tg, ...(b.ghiChuSv ? { ghi_chu_ql: b.ghiChuSv } : {}) });
            break;
          }
          case 'doiKtv': {
            const cu = ktvHienTai;
            q.hetHieuLucPC.run(yc.id);
            giaoViec(b.ktv, tg, b.lyDo);
            chuyen(ql, 'DA_PHAN_CONG', `Đổi KTV ${tenND[cu]} → ${tenND[b.ktv]}. ${b.lyDo}`, tg);
            break;
          }
          case 'tuChoi':
            chuyen(ql, 'TU_CHOI', `Từ chối: ${b.lyDo}`, tg, { ly_do_tu_choi: b.lyDo });
            break;
          case 'huy':
            chuyen(sv, 'DA_HUY', 'Sinh viên hủy yêu cầu', tg);
            break;
          case 'batDau':
            chuyen(idND[ktvHienTai], 'DANG_SUA', 'Bắt đầu kiểm tra', tg);
            if (tbId) q.tinhTrangTB.run('DANG_SUA', tbId);
            break;
          case 'baoTaiCho':
            b.dong.forEach(([nd, sl, gc], i) => q.noiDung.run(yc.id, i + 1, nd, sl, gc || null));
            if (b.anhSau) luuAnh(yc, 'SAU', 1, idND[ktvHienTai]);
            chuyen(idND[ktvHienTai], 'CHO_NGHIEM_THU', 'Báo kết quả: Đã khắc phục tại chỗ', tg, { ket_qua_kiem_tra: 'KHAC_PHUC_TAI_CHO' });
            break;
          case 'baoKhong': {
            const bb = b.bienBan;
            const conBH = yc.thietBi && yc.thietBi.hanBaoHanh >= tg.slice(0, 10) ? 1 : 0;
            q.bienBan.run(yc.id, idND[ktvHienTai], tg, bb.tinhTrang, bb.nguyenNhan,
              bb.muaVatTu || null, bb.thueSua || null, bb.thanhLy || null, conBH);
            chuyen(idND[ktvHienTai], 'CHO_NGHIEM_THU', 'Báo kết quả: Không khắc phục tại chỗ – đã lập biên bản kiểm tra kỹ thuật', tg,
              { ket_qua_kiem_tra: 'KHONG_KHAC_PHUC' });
            break;
          }
          case 'lamLai': {
            const ktv = b.ktv || ktvHienTai;
            q.hetHieuLucPC.run(yc.id);
            q.xoaNoiDung.run(yc.id);
            q.hetHieuLucBB.run(yc.id);
            giaoViec(ktv, tg, `Làm lại: ${b.lyDo}`);
            chuyen(ql, 'DA_PHAN_CONG', `Yêu cầu làm lại: ${b.lyDo}. Giao lại cho ${tenND[ktv]}`, tg, { ket_qua_kiem_tra: null });
            break;
          }
          case 'nghiemThu':
            chuyen(ql, 'HOAN_THANH', 'Nghiệm thu đạt', tg, { thoi_gian_hoan_thanh: tg });
            if (tbId) q.tinhTrangTB.run('HOAT_DONG', tbId);
            break;
          case 'chuyenPA':
            chuyen(ql, 'CHUYEN_XU_LY', `Duyệt biên bản & chuyển phương án: ${PHUONG_AN[b.phuongAn]}. Số tờ trình: ${b.soToTrinh}`, tg,
              { phuong_an: b.phuongAn, so_to_trinh: b.soToTrinh });
            if (tbId) q.tinhTrangTB.run('CHO_THAY_THE', tbId);
            break;
          case 'dong':
            chuyen(ql, 'HOAN_THANH', `Đóng yêu cầu: ${b.ketQua} Biên bản M.10 số ${b.soBienBan}`, tg,
              { ket_qua_cuoi: b.ketQua, so_bien_ban_ban_giao: b.soBienBan, thoi_gian_hoan_thanh: tg });
            if (tbId) q.tinhTrangTB.run(b.tinhTrangTB, tbId);
            break;
          default:
            throw new Error(`Bước không hợp lệ: ${b.lam}`);
        }
      }
      yc.trangThai = tt;
    }
  });
  napYeuCau();

  // ---- Tóm tắt
  const dem = (sql) => db.prepare(sql).get().n;
  console.log(`Đã tạo CSDL: ${DUONG_DAN_CSDL}`);
  console.log(`  Tài khoản: ${dem('SELECT COUNT(*) n FROM nguoi_dung')} · Nhà: ${dem('SELECT COUNT(*) n FROM toa_nha')} · ` +
    `Phòng: ${dem('SELECT COUNT(*) n FROM phong')} · Loại TB: ${dem('SELECT COUNT(*) n FROM loai_thiet_bi')} · ` +
    `Thiết bị: ${dem('SELECT COUNT(*) n FROM thiet_bi')} · Yêu cầu: ${dem('SELECT COUNT(*) n FROM yeu_cau')}`);
  console.log(`  Phân công: ${dem('SELECT COUNT(*) n FROM phan_cong')} (đang hiệu lực ${dem('SELECT COUNT(*) n FROM phan_cong WHERE con_hieu_luc = 1')}) · ` +
    `Lịch sử: ${dem('SELECT COUNT(*) n FROM lich_su_xu_ly')} · Biên bản: ${dem('SELECT COUNT(*) n FROM bien_ban_kiem_tra')} · ` +
    `Nội dung sửa: ${dem('SELECT COUNT(*) n FROM noi_dung_sua_chua')} · Ảnh: ${dem('SELECT COUNT(*) n FROM anh_dinh_kem')}`);
  console.log('  Yêu cầu theo trạng thái:');
  for (const r of db.prepare(`SELECT trang_thai, COUNT(*) n FROM yeu_cau GROUP BY trang_thai`).all()) {
    console.log(`    ${r.trang_thai.padEnd(15)} ${String(r.n).padStart(2)}  (${TRANG_THAI_YEU_CAU[r.trang_thai].ql})`);
  }
  const theoNha = db.prepare(`SELECT n.ma_nha, COUNT(y.id) n FROM toa_nha n
                                LEFT JOIN phong p ON p.toa_nha_id = n.id LEFT JOIN yeu_cau y ON y.phong_id = p.id
                              GROUP BY n.id ORDER BY n.id`).all();
  console.log(`  Yêu cầu theo nhà: ${theoNha.map((r) => `${r.ma_nha}: ${r.n}`).join(' · ')}`);
  console.log(`  Tài khoản mẫu (mật khẩu ${MAT_KHAU_DEMO}):`);
  for (const t of TAI_KHOAN) console.log(`    ${t.vai_tro.padEnd(14)} ${t.email}  (${t.ho_ten})`);
  db.close();
}

main();
