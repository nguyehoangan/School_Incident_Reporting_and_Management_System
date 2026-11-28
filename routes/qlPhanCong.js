// Q03 Bảng phân công (QL): tab "Khu vực phụ trách" và tab "Công việc đã giao" (SPEC mục 7, 8).
// Route chỉ nhận form và hiển thị; kiểm tra và ghi dữ liệu ở services/nhanSu.js. Gắn tại /quan-ly/phan-cong.
const express = require('express');
const { TRANG_THAI_YEU_CAU } = require('../lib/hangSo');
const { soId, mot, chuoiTruyVan } = require('../lib/truyVan');
const { datFlash, layFlash } = require('../lib/flash');
const nhanSu = require('../services/nhanSu');
const tv = require('../services/truyVanPhanCong');
const { LoiNghiepVu } = require('../services/yeuCau');

const router = express.Router();
const GOC = '/quan-ly/phan-cong';
const KHOA_FLASH = 'flashQ03';

router.get('/', (req, res) => {
  const tab = tv.TAB[mot(req.query.tab)] ? mot(req.query.tab) : 'khu-vuc';
  const mau = { tieuDe: 'Bảng phân công', lopTrang: 'nen-xam', tab, tabs: tv.TAB, flash: layFlash(req, KHOA_FLASH) };

  if (tab === 'khu-vuc') {
    const khuVuc = tv.bangKhuVuc();
    const idSua = soId(req.query.sua);
    const ktvSua = khuVuc.find((k) => k.id === idSua) || null;
    return res.render('ql/phan-cong', {
      ...mau, khuVuc, theoNha: tv.xemTheoNha(),
      ktvSua, hopNha: ktvSua ? tv.hopChonNha(ktvSua.id) : [],
    });
  }

  const loc = tv.tuyChonLocCongViec();
  const boLoc = tv.docBoLocCongViec(req.query, { dsKtvId: loc.ktv.map((k) => k.id), dsNhaId: loc.nha.map((n) => n.id) });
  const kq = tv.congViecDaGiao(boLoc);
  const url = (thayDoi) => `${GOC}?${chuoiTruyVan({ tab: 'cong-viec', ktv: boLoc.ktv, nha: boLoc.nha, tt: boLoc.tt, cu: boLoc.cu ? 1 : '', trang: '', ...thayDoi })}`;
  res.render('ql/phan-cong', { ...mau, loc, boLoc, ...kq, trangThai: TRANG_THAI_YEU_CAU, url });
});

// Lưu khu vực phụ trách của một KTV (hộp ô đánh dấu)
router.post('/khu-vuc/:id', (req, res, next) => {
  const id = soId(req.params.id);
  if (!id) return next();
  try {
    const kq = nhanSu.datKhuVuc(req.nguoiDung, id, (req.body || {}).nha);
    const noiDung = kq.soNha
      ? `Đã cập nhật khu vực phụ trách của ${kq.nhan}: ${kq.soNha} nhà.`
      : `Đã bỏ hết khu vực phụ trách của ${kq.nhan}.`;
    datFlash(req, KHOA_FLASH, 'ok', noiDung);
    res.redirect(`${GOC}?tab=khu-vuc`);
  } catch (e) {
    if (!(e instanceof LoiNghiepVu)) return next(e);
    if (e.ma === 404) return next();
    const noiDung = e.loi && e.loi.nha ? e.loi.nha : e.message;
    datFlash(req, KHOA_FLASH, 'loi', noiDung);
    res.redirect(`${GOC}?tab=khu-vuc&sua=${id}`);
  }
});

module.exports = router;
