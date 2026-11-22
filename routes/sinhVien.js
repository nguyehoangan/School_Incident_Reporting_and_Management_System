// Trang của Sinh viên: S01 Yêu cầu của tôi, S02 Gửi yêu cầu mới, S03 Chi tiết yêu cầu (SPEC mục 8).
const express = require('express');
const multer = require('multer');
const { layCsdl } = require('../db');
const { chiVaiTro } = require('../middleware/auth');
const { TRANG_THAI_YEU_CAU, MUC_DO, PHUONG_AN } = require('../lib/hangSo');
const yeuCau = require('../services/yeuCau');

const router = express.Router();
router.use(chiVaiTro('SINH_VIEN'));

const SO_DONG_MOI_TRANG = 10;

// Mục 8 – S01: lọc theo trạng thái. "Đang xử lý" = mọi yêu cầu chưa kết thúc.
const BO_LOC = {
  'tat-ca':     { ten: 'Tất cả',        ds: null },
  'dang-xu-ly': { ten: 'Đang xử lý',    ds: ['MOI', 'DA_PHAN_CONG', 'DANG_SUA', 'CHO_NGHIEM_THU', 'CHUYEN_XU_LY'] },
  'da-xong':    { ten: 'Đã xong',       ds: ['HOAN_THANH'] },
  'tu-choi-huy': { ten: 'Từ chối – Hủy', ds: ['TU_CHOI', 'DA_HUY'] },
};

// Chỉ lấy ảnh/tệp trong bộ nhớ, tự kiểm tra rồi mới ghi (xem services/yeuCau.js).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: yeuCau.ANH.dungLuongToiDa + 1, files: yeuCau.ANH.toiDa + 1, fields: 20, parts: 40 },
}).array('anh');

function nhanTrangThai(trangThai) {
  const t = TRANG_THAI_YEU_CAU[trangThai];
  return { ten: t.sv, mau: t.mau };
}

// ---------------------------------------------------------------- S01
router.get('/yeu-cau', (req, res) => {
  const db = layCsdl();
  const khoa = Object.prototype.hasOwnProperty.call(BO_LOC, req.query.tt) ? req.query.tt : 'tat-ca';
  const loc = BO_LOC[khoa];
  const dkTrangThai = loc.ds ? `AND y.trang_thai IN (${loc.ds.map(() => '?').join(',')})` : '';
  const thamSo = [req.nguoiDung.id, ...(loc.ds || [])];

  const tong = db.prepare(`SELECT COUNT(*) n FROM yeu_cau y WHERE y.sinh_vien_id = ? ${dkTrangThai}`).get(...thamSo).n;
  const soTrang = Math.max(1, Math.ceil(tong / SO_DONG_MOI_TRANG));
  const trang = Math.min(Math.max(parseInt(req.query.trang, 10) || 1, 1), soTrang);

  const dong = db.prepare(`
    SELECT y.id, y.ma_yeu_cau, y.thoi_gian_gui, y.muc_do, y.trang_thai, y.ghi_chu_ql, y.ly_do_tu_choi,
           n.ma_nha, p.ma_phong, t.ten_thiet_bi, t.ma_tai_san, l.ten_loai
      FROM yeu_cau y
      JOIN phong p ON p.id = y.phong_id
      JOIN toa_nha n ON n.id = p.toa_nha_id
      JOIN loai_thiet_bi l ON l.id = y.loai_thiet_bi_id
      LEFT JOIN thiet_bi t ON t.id = y.thiet_bi_id
     WHERE y.sinh_vien_id = ? ${dkTrangThai}
     ORDER BY y.thoi_gian_gui DESC, y.id DESC
     LIMIT ? OFFSET ?`).all(...thamSo, SO_DONG_MOI_TRANG, (trang - 1) * SO_DONG_MOI_TRANG)
    .map((r) => ({
      id: r.id,
      ma: r.ma_yeu_cau,
      guiLuc: r.thoi_gian_gui,
      mucDo: MUC_DO[r.muc_do],
      khanCap: r.muc_do === 'KHAN_CAP',
      thietBi: r.ten_thiet_bi ? `${r.ten_thiet_bi} – ${r.ma_tai_san}` : `${r.ten_loai} (không có trong danh sách)`,
      phong: `${r.ma_nha}-${r.ma_phong}`,
      trangThai: nhanTrangThai(r.trang_thai),
      ghiChuQl: r.ghi_chu_ql || (r.trang_thai === 'TU_CHOI' ? r.ly_do_tu_choi : '') || '',
    }));

  const tongTatCa = loc.ds ? db.prepare('SELECT COUNT(*) n FROM yeu_cau WHERE sinh_vien_id = ?').get(req.nguoiDung.id).n : tong;

  res.render('sv/danh-sach', {
    tieuDe: 'Yêu cầu của tôi',
    dong, tong, tongTatCa, trang, soTrang, khoa, boLoc: BO_LOC, soDongMoiTrang: SO_DONG_MOI_TRANG,
  });
});

// ---------------------------------------------------------------- S02
router.get('/gui-yeu-cau', (req, res) => {
  res.render('sv/gui-yeu-cau', {
    tieuDe: 'Gửi yêu cầu mới',
    danhMuc: yeuCau.layDanhMucChoForm(),
    gioiHan: { anhToiDa: yeuCau.ANH.toiDa, dungLuongToiDa: yeuCau.ANH.dungLuongToiDa, moTaMin: yeuCau.MO_TA.min, moTaMax: yeuCau.MO_TA.max },
    mucDo: MUC_DO,
  });
});

// Cảnh báo trùng: chỉ cảnh báo, không chặn (BR-09). Gọi trước khi gửi.
router.get('/gui-yeu-cau/kiem-tra-trung', (req, res) => {
  const so = (v) => (/^\d+$/.test(String(v || '')) ? Number(v) : null);
  const trung = yeuCau.timYeuCauTrung({
    thietBiId: so(req.query.thiet_bi_id),
    phongId: so(req.query.phong_id),
    loaiId: so(req.query.loai_thiet_bi_id),
  });
  res.json({ trung });
});

router.post('/yeu-cau', (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const thongDiep = err.code === 'LIMIT_FILE_SIZE' ? 'Mỗi ảnh phải nhỏ hơn hoặc bằng 5 MB'
        : (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') ? `Chỉ được đính kèm tối đa ${yeuCau.ANH.toiDa} ảnh`
        : 'Không đọc được tệp tải lên';
      return res.status(422).json({ loi: { anh: thongDiep } });
    }
    if (err) return next(err);

    try {
      const { loi, du } = yeuCau.kiemTraYeuCauMoi(req.body || {}, req.files);
      if (Object.keys(loi).length) return res.status(422).json({ loi });
      const moi = yeuCau.taoYeuCau(req.nguoiDung, du);
      res.status(201).json({ ma: moi.ma, id: moi.id, duongDan: `/sinh-vien/yeu-cau/${moi.id}` });
    } catch (e) {
      next(e);
    }
  });
});

// ---------------------------------------------------------------- S03
function layYeuCauCuaToi(req, res) {
  const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : null;
  const yc = id && layCsdl().prepare(`
    SELECT y.*, n.ma_nha, n.ten_nha, p.ma_phong, p.tang, p.loai_phong,
           t.ten_thiet_bi, t.ma_tai_san, t.model_hang, l.ten_loai
      FROM yeu_cau y
      JOIN phong p ON p.id = y.phong_id
      JOIN toa_nha n ON n.id = p.toa_nha_id
      JOIN loai_thiet_bi l ON l.id = y.loai_thiet_bi_id
      LEFT JOIN thiet_bi t ON t.id = y.thiet_bi_id
     WHERE y.id = ?`).get(id);
  // BR-04: SV chỉ xem yêu cầu của chính mình; yêu cầu của người khác trả 404 như không tồn tại
  if (!yc || yc.sinh_vien_id !== req.nguoiDung.id) {
    res.status(404).render('loi', { tieuDe: 'Không tìm thấy yêu cầu', thongDiep: 'Yêu cầu không tồn tại hoặc không phải của bạn.' });
    return null;
  }
  return yc;
}

// Dòng tiến độ rút gọn (mục 8 – S03), không hiện tên KTV.
function dungTienDo(yc, lichSu) {
  const luc = (tt) => (lichSu.find((h) => h.den_trang_thai === tt) || {}).thoi_gian || null;
  const cuoi = yc.trang_thai === 'CHUYEN_XU_LY' ? { ten: 'Chờ thay thế / sửa chữa ngoài', luc: luc('CHUYEN_XU_LY') }
    : { ten: 'Đã hoàn thành', luc: luc('HOAN_THANH') };

  if (yc.trang_thai === 'TU_CHOI' || yc.trang_thai === 'DA_HUY') {
    const bi = yc.trang_thai === 'TU_CHOI';
    return [
      { ten: 'Đã gửi', luc: yc.thoi_gian_gui, tt: 'xong' },
      { ten: bi ? 'Bị từ chối' : 'Đã hủy', luc: luc(yc.trang_thai), tt: 'ket-thuc-' + (bi ? 'do' : 'xam') },
    ];
  }
  const muc = { MOI: 0, DA_PHAN_CONG: 1, DANG_SUA: 2, CHO_NGHIEM_THU: 2, CHUYEN_XU_LY: 3, HOAN_THANH: 3 }[yc.trang_thai];
  const buoc = [
    { ten: 'Đã gửi', luc: yc.thoi_gian_gui },
    { ten: 'Đã tiếp nhận', luc: luc('DA_PHAN_CONG') },
    { ten: 'Đang xử lý', luc: luc('DANG_SUA') },
    cuoi,
  ];
  return buoc.map((b, i) => ({
    ten: b.ten,
    luc: i <= muc ? b.luc : null,
    // Hoàn thành là bước cuối đã đạt (hiển thị "xong"); các trường hợp còn lại bước hiện tại được nhấn mạnh
    tt: i < muc || (i === muc && yc.trang_thai === 'HOAN_THANH') ? 'xong' : i === muc ? 'hien-tai' : 'chua',
  }));
}

router.get('/yeu-cau/:id', (req, res) => {
  const yc = layYeuCauCuaToi(req, res);
  if (!yc) return;
  const db = layCsdl();
  const lichSu = db.prepare('SELECT den_trang_thai, thoi_gian FROM lich_su_xu_ly WHERE yeu_cau_id = ? ORDER BY id').all(yc.id);
  const anh = (loai) => db.prepare('SELECT duong_dan FROM anh_dinh_kem WHERE yeu_cau_id = ? AND loai_anh = ? ORDER BY id').all(yc.id, loai).map((a) => a.duong_dan);
  const hoanThanh = yc.trang_thai === 'HOAN_THANH';
  const thongBao = req.session.thongBao || null;
  delete req.session.thongBao;

  res.render('sv/chi-tiet', {
    tieuDe: `Yêu cầu ${yc.ma_yeu_cau}`,
    yc,
    trangThai: nhanTrangThai(yc.trang_thai),
    mucDo: MUC_DO[yc.muc_do],
    phong: `${yc.ma_nha}-${yc.ma_phong}`,
    thietBi: yc.ten_thiet_bi ? `${yc.ten_thiet_bi} – ${yc.ma_tai_san}` : null,
    phuongAn: yc.trang_thai === 'CHUYEN_XU_LY' && yc.phuong_an ? PHUONG_AN[yc.phuong_an] : null,
    tienDo: dungTienDo(yc, lichSu),
    anhTruoc: anh('TRUOC'),
    anhSau: hoanThanh ? anh('SAU') : [],
    noiDungSua: hoanThanh && yc.ket_qua_kiem_tra === 'KHAC_PHUC_TAI_CHO'
      ? db.prepare('SELECT stt, noi_dung, so_luong, ghi_chu FROM noi_dung_sua_chua WHERE yeu_cau_id = ? ORDER BY stt').all(yc.id) : [],
    choPhepHuy: yc.trang_thai === 'MOI',
    thongBao,
  });
});

router.post('/yeu-cau/:id/huy', (req, res, next) => {
  try {
    const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : 0;
    const kq = yeuCau.huyYeuCau(req.nguoiDung, id);
    req.session.thongBao = { loai: 'ok', noiDung: `Đã hủy yêu cầu ${kq.ma}.` };
    res.redirect(`/sinh-vien/yeu-cau/${kq.id}`);
  } catch (e) {
    if (!(e instanceof yeuCau.LoiNghiepVu)) return next(e);
    if (e.ma === 404) {
      return res.status(404).render('loi', { tieuDe: 'Không tìm thấy yêu cầu', thongDiep: 'Yêu cầu không tồn tại hoặc không phải của bạn.' });
    }
    // Server từ chối (không còn ở trạng thái Đã gửi): quay lại trang chi tiết kèm lý do
    req.session.thongBao = { loai: 'loi', noiDung: e.message };
    res.redirect(`/sinh-vien/yeu-cau/${req.params.id}`);
  }
});

module.exports = router;
