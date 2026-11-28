// Trang in biểu mẫu QT.06 (SPEC mục 9, UC17, UC18): mỗi mẫu một route, khổ A4, in bằng window.print().
//   /in/m01/:id   Phiếu yêu cầu sửa chữa (M.01)       – SV (yêu cầu của mình), QL, KTV (việc được giao)
//   /in/m04/:id   Biên bản kiểm tra kỹ thuật (M.04)   – QL, KTV (việc được giao); cần biên bản đang hiệu lực
//   /in/m02       Sổ tiếp nhận thông báo sự cố (M.02) – QL, theo bộ lọc của Q06
//   /in/m03/:id   Sổ theo dõi thiết bị (M.03), cột 1–8 – QL, từ Hồ sơ thiết bị (Q04)
// Quyền kiểm tra ở server như trang chi tiết tương ứng (BR-02, BR-04): sai vai trò -> 403; không phải của mình -> 404.
const express = require('express');
const { chiVaiTro } = require('../middleware/auth');
const { soId } = require('../lib/truyVan');
const { TINH_TRANG_THIET_BI } = require('../lib/hangSo');
const { ngayChu, gioChu, dinhDang } = require('../lib/thoiGian');
const tvIn = require('../services/truyVanIn');
const so = require('../services/soTiepNhan');
const { hoSoThietBi } = require('../services/truyVanDanhMuc');

const router = express.Router();
router.use((req, res, next) => { res.locals.ngayChu = ngayChu; res.locals.gioChu = gioChu; next(); });

function khongThay(res, thongDiep = 'Yêu cầu không tồn tại hoặc bạn không có quyền xem.') {
  return res.status(404).render('loi', { tieuDe: 'Không tìm thấy biểu mẫu', thongDiep });
}

// Trang chi tiết để quay lại, theo vai trò
const trangChiTiet = (vaiTro, id) => ({
  SINH_VIEN: `/sinh-vien/yeu-cau/${id}`,
  QUAN_LY: `/quan-ly/yeu-cau/${id}`,
  KY_THUAT_VIEN: `/ky-thuat-vien/viec/${id}`,
}[vaiTro]);

// Đọc yêu cầu và kiểm tra quyền xem (BR-04). Không được xem -> 404 như trang chi tiết.
function layYeuCauDuocXem(req, res) {
  const id = soId(req.params.id);
  const yc = id ? tvIn.layYeuCau(id) : null;
  if (!yc || !tvIn.coQuyenXem(req.nguoiDung, yc)) { khongThay(res); return null; }
  return yc;
}

// ---------------------------------------------------------------- M.01
router.get('/m01/:id', chiVaiTro('SINH_VIEN', 'QUAN_LY', 'KY_THUAT_VIEN'), (req, res) => {
  const yc = layYeuCauDuocXem(req, res);
  if (!yc) return;
  res.render('in/m01', {
    tieuDe: `Phiếu yêu cầu ${yc.ma_yeu_cau} (M.01)`,
    kyHieu: 'M.01.QT&VT.06',
    quayLai: trangChiTiet(req.nguoiDung.vai_tro, yc.id),
    ...tvIn.duLieuM01(yc),
    // K02 không hiện email SV (mục 8) – trang in của KTV cũng vậy
    hienEmail: req.nguoiDung.vai_tro !== 'KY_THUAT_VIEN',
  });
});

// ---------------------------------------------------------------- M.04
router.get('/m04/:id', chiVaiTro('QUAN_LY', 'KY_THUAT_VIEN'), (req, res) => {
  const yc = layYeuCauDuocXem(req, res);
  if (!yc) return;
  const du = tvIn.duLieuM04(yc);
  if (!du) return khongThay(res, 'Yêu cầu này chưa có biên bản kiểm tra kỹ thuật đang hiệu lực.');
  res.render('in/m04', {
    tieuDe: `Biên bản kiểm tra kỹ thuật ${yc.ma_yeu_cau} (M.04)`,
    kyHieu: 'M.04.QT&VT.06',
    quayLai: trangChiTiet(req.nguoiDung.vai_tro, yc.id),
    ...du,
  });
});

// ---------------------------------------------------------------- M.02 (theo bộ lọc của Q06)
router.get('/m02', chiVaiTro('QUAN_LY'), (req, res) => {
  const boLoc = so.docBoLoc(req.query);
  res.render('in/m02', {
    tieuDe: 'Sổ tiếp nhận thông báo sự cố (M.02)',
    kyHieu: 'M.02.QT&VT.06',
    khoGiay: 'ngang',
    quayLai: `/quan-ly/so-tiep-nhan?${so.chuoiTruyVan(boLoc)}`,
    moTaLoc: so.moTaBoLoc(boLoc),
    cot: so.COT,
    dong: so.danhSach(boLoc),
  });
});

// ---------------------------------------------------------------- M.03 (1 thiết bị, cột 1–8)
router.get('/m03/:id', chiVaiTro('QUAN_LY'), (req, res) => {
  const id = soId(req.params.id);
  const hoSo = id ? hoSoThietBi(id) : null;
  if (!hoSo) return khongThay(res, 'Thiết bị không tồn tại.');
  // Cột 8: "Sửa chữa (số lần và nội dung đã sửa chữa)" – các lần sửa cũ trước
  const lanSua = hoSo.lichSu.slice().reverse().map((l) => `${dinhDang(l.ngay)}: ${l.noiDung} (${l.ketQua})`);
  res.render('in/m03', {
    tieuDe: `Sổ theo dõi thiết bị ${hoSo.tb.ma_tai_san} (M.03)`,
    kyHieu: 'M.03.QT&VT.06',
    khoGiay: 'ngang',
    quayLai: `/quan-ly/co-so-vat-chat?tab=thiet-bi&ho-so=${hoSo.tb.id}#ho-so`,
    ...hoSo,
    tinhTrang: TINH_TRANG_THIET_BI[hoSo.tb.tinh_trang],
    lanSua,
  });
});

module.exports = router;
