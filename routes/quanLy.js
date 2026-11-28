// Trang của Quản lý: Q01 Danh sách yêu cầu, Q02 Chi tiết & xử lý (SPEC mục 8). Q03–Q05 ở các router riêng (đợt 5), Q06 làm ở đợt 6.
const express = require('express');
const { chiVaiTro } = require('../middleware/auth');
const { gioVN, choONhapGio, hanKiemTraMacDinh } = require('../lib/thoiGian');
const { TRANG_THAI_YEU_CAU, MUC_DO, PHUONG_AN, KET_QUA_KIEM_TRA, TINH_TRANG_THIET_BI } = require('../lib/hangSo');
const yeuCau = require('../services/yeuCau');
const tv = require('../services/truyVanQL');

const router = express.Router();
router.use(chiVaiTro('QUAN_LY'));

const LOP_TRANG = 'nen-xam';

// ---------------------------------------------------------------- Q01
router.get('/yeu-cau', (req, res) => {
  const dsNha = tv.danhSachNha();
  const boLoc = tv.docBoLoc(req.query, dsNha.map((n) => n.ma_nha));
  const ketQua = tv.danhSachYeuCau(boLoc);
  // Lưu bộ lọc đang dùng để nút "Quay lại danh sách" ở Q02 giữ nguyên (mục 8 – Q02)
  req.session.locQ01 = tv.chuoiTruyVan(boLoc, { trang: ketQua.trang });

  res.render('ql/danh-sach', {
    tieuDe: 'Danh sách yêu cầu',
    lopTrang: LOP_TRANG,
    boLoc,
    ...ketQua,
    ...tv.soLieuTongQuan(),
    dsNha: dsNha.filter((n) => n.dang_su_dung || boLoc.nha.includes(n.ma_nha)),
    khoangNhanh: tv.khoangNhanh(),
    trangThai: TRANG_THAI_YEU_CAU,
    mucDo: MUC_DO,
    sapXep: tv.SAP_XEP,
    cheDo: tv.CHE_DO,
    HOAN_THANH_THANG: tv.HOAN_THANH_THANG,
    url: (thayDoi) => {
      const q = tv.chuoiTruyVan(boLoc, thayDoi);
      return '/quan-ly/yeu-cau' + (q ? '?' + q : '');
    },
  });
});

// ---------------------------------------------------------------- Q02
const soId = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);

function trangKhongThay(res) {
  return res.status(404).render('loi', { tieuDe: 'Không tìm thấy yêu cầu', thongDiep: 'Yêu cầu không tồn tại.' });
}

router.get('/yeu-cau/:id', (req, res) => {
  const id = soId(req.params.id);
  const ct = id && tv.chiTietYeuCau(id);
  if (!ct) return trangKhongThay(res);
  const { yc, pc } = ct;

  const flash = req.session.flashQ02 && req.session.flashQ02.id === yc.id ? req.session.flashQ02 : null;
  delete req.session.flashQ02;

  const hanhDong = yeuCau.cacHanhDongHopLe(req.nguoiDung, yc, pc);
  const canChonKtv = hanhDong.some((h) => ['phanCong', 'doiKtv', 'lamLai'].includes(h));

  res.render('ql/chi-tiet', {
    tieuDe: `Yêu cầu ${yc.ma_yeu_cau}`,
    lopTrang: LOP_TRANG,
    ...ct,
    hanhDong,
    suaGhiChuSv: yeuCau.TRANG_THAI_SUA_GHI_CHU_SV.includes(yc.trang_thai),
    goiY: canChonKtv ? yeuCau.goiYKtv(yc.id) : [],
    hanMacDinh: choONhapGio(hanKiemTraMacDinh(gioVN(), yc.muc_do)),
    hanToiThieu: choONhapGio(gioVN()),
    trangThai: TRANG_THAI_YEU_CAU[yc.trang_thai],
    mucDo: MUC_DO,
    phuongAn: PHUONG_AN,
    ketQuaKiemTra: KET_QUA_KIEM_TRA,
    tinhTrangTB: TINH_TRANG_THIET_BI,
    tinhTrangSauCung: yeuCau.TINH_TRANG_SAU_CUNG,
    lyDoToiThieu: yeuCau.LY_DO_TOI_THIEU,
    quayLai: '/quan-ly/yeu-cau' + (req.session.locQ01 ? '?' + req.session.locQ01 : ''),
    flash,
  });
});

// Một đường dẫn cho mỗi hành động của QL trong bảng 5.1 (SPEC 13.2). Kiểm tra quyền / trạng thái ở services/yeuCau.js.
const HANH_DONG_QL = {
  'phan-cong': 'phanCong',
  'tu-choi': 'tuChoi',
  'doi-ktv': 'doiKtv',
  'nghiem-thu': 'nghiemThu',
  'chuyen-phuong-an': 'chuyenPhuongAn',
  'lam-lai': 'lamLai',
  dong: 'dong',
};

router.post('/yeu-cau/:id/:hanhDong', (req, res, next) => {
  const id = soId(req.params.id);
  const slug = req.params.hanhDong;
  const laGhiChu = slug === 'ghi-chu-sv';
  if (!id || (!laGhiChu && !Object.prototype.hasOwnProperty.call(HANH_DONG_QL, slug))) return trangKhongThay(res);
  const body = req.body || {};
  try {
    const kq = laGhiChu
      ? yeuCau.capNhatGhiChuSv(req.nguoiDung, id, body.ghi_chu_sv)
      : yeuCau.thucHienHanhDong(req.nguoiDung, id, HANH_DONG_QL[slug], body);
    req.session.flashQ02 = { id: kq.id, loai: 'ok', noiDung: `Đã cập nhật yêu cầu ${kq.ma}!` };
    res.redirect(`/quan-ly/yeu-cau/${kq.id}#xu-ly`);
  } catch (e) {
    if (!(e instanceof yeuCau.LoiNghiepVu)) return next(e);
    if (e.ma === 404) return trangKhongThay(res);
    // Lỗi dữ liệu: giữ lại giá trị đã nhập và mở lại đúng hộp thoại; lỗi trạng thái / quyền: chỉ báo
    req.session.flashQ02 = {
      id, loai: 'loi', noiDung: e.message, hanhDong: slug,
      loiTruong: e.loi || {}, duLieu: e.ma === 422 ? body : {},
    };
    res.redirect(`/quan-ly/yeu-cau/${id}#xu-ly`);
  }
});

// Q03, Q04, Q05 (đợt 5): mỗi màn hình một router riêng, đã nằm sau chiVaiTro('QUAN_LY') ở đầu file
router.use('/phan-cong', require('./qlPhanCong'));
router.use('/co-so-vat-chat', require('./qlDanhMuc'));
router.use('/ky-thuat-vien', require('./qlKtv'));
// Q06 làm ở đợt 6, giữ trang tạm
router.get('/so-tiep-nhan', (req, res) => res.render('trang-tam', { tieuDe: 'Sổ tiếp nhận thông báo sự cố (M.02)', maMan: 'Q06' }));

module.exports = router;
