// Q04 Danh mục CSVC (QL): 4 tab Nhà / Phòng / Loại thiết bị / Thiết bị, form thêm – sửa, Hồ sơ thiết bị (SPEC mục 6, 8).
// Route chỉ nhận form và hiển thị; kiểm tra và ghi dữ liệu ở services/danhMuc.js. Gắn tại /quan-ly/co-so-vat-chat.
const express = require('express');
const { TINH_TRANG_THIET_BI } = require('../lib/hangSo');
const { soId, mot, chuoiTruyVan } = require('../lib/truyVan');
const { datFlash, layFlash } = require('../lib/flash');
const dm = require('../services/danhMuc');
const tv = require('../services/truyVanDanhMuc');
const { LoiNghiepVu } = require('../services/yeuCau');

const router = express.Router();
const GOC = '/quan-ly/co-so-vat-chat';
const KHOA_FLASH = 'flashQ04';

// Đường dẫn (slug) -> khóa trong dm.MUC; tab nào thì mục đó
const MUC_THEO_TAB = { nha: 'nha', phong: 'phong', loai: 'loai', 'thiet-bi': 'thietBi' };
const TAB_THEO_MUC = Object.fromEntries(Object.entries(MUC_THEO_TAB).map(([tab, muc]) => [muc, tab]));
const NHAN_NUT_THEM = { nha: '+ Thêm nhà', phong: '+ Thêm phòng', loai: '+ Thêm loại thiết bị', 'thiet-bi': '+ Thêm thiết bị' };
const LOAI_PHONG_GOI_Y = ['Phòng học', 'Phòng thí nghiệm', 'Hội trường', 'Phòng đọc'];
const NGUON_KINH_PHI_GOI_Y = ['Ngân sách nhà nước', 'Nguồn thu sự nghiệp', 'Tài trợ – xã hội hóa'];

const MAU_TINH_TRANG = { HOAT_DONG: 'xanh-la', DANG_SUA: 'xanh', CHO_THAY_THE: 'cam', THANH_LY: 'xam' };
const GIA_TRI_MAC_DINH = {
  nha: { ma_nha: '', ten_nha: '' },
  phong: { nha_id: '', ma_phong: '', tang: '', loai_phong: '' },
  loai: { ten_loai: '' },
  thietBi: { ma_tai_san: '', ten_thiet_bi: '', loai_thiet_bi_id: '', phong_id: '', model_hang: '', nam_su_dung: '', nguon_kinh_phi: '', han_bao_hanh: '', tinh_trang: 'HOAT_DONG' },
};

// Bộ lọc đang dùng -> query string (bỏ giá trị rỗng); chỉ giữ khóa của tab hiện tại
function truyVanLoc(boLoc, thayDoi = {}) {
  const b = { ...boLoc, ...thayDoi };
  const chung = { tab: b.tab, q: b.q };
  if (b.tab === 'phong') Object.assign(chung, { nha: b.nha, trang: b.trang > 1 ? b.trang : '' });
  if (b.tab === 'thiet-bi') Object.assign(chung, { nha: b.nha, phong: b.phong, loai: b.loai, tt: b.tt, trang: b.trang > 1 ? b.trang : '' });
  if (thayDoi['ho-so']) chung['ho-so'] = thayDoi['ho-so'];
  if (thayDoi.them) chung.them = 1;
  if (thayDoi.sua) chung.sua = thayDoi.sua;
  return chuoiTruyVan(chung);
}

// Dựng dữ liệu cho trang. form: { muc, id, giaTri, loi } khi đang mở form thêm / sửa
function dungTrang(req, boLoc, { form = null, flash = null } = {}) {
  const tab = boLoc.tab;
  const muc = MUC_THEO_TAB[tab];
  const mau = {
    tieuDe: 'Danh mục cơ sở vật chất', lopTrang: 'nen-xam', tab, tabs: tv.TAB, boLoc, flash,
    nhanNutThem: NHAN_NUT_THEM[tab], tinhTrangTB: TINH_TRANG_THIET_BI, mauTinhTrang: MAU_TINH_TRANG,
    loaiPhongGoiY: LOAI_PHONG_GOI_Y, nguonKinhPhiGoiY: NGUON_KINH_PHI_GOI_Y,
    form, hoSo: null,
    url: (thayDoi) => `${GOC}?${truyVanLoc(boLoc, thayDoi)}`,
    urlTab: (t) => `${GOC}?tab=${t}`,
    // Form POST giữ nguyên bộ lọc: sau khi lưu quay về đúng danh sách đang xem
    duongHanhDong: (slug, id, hanhDong) => `${GOC}/${slug}${id ? `/${id}` : ''}${hanhDong ? `/${hanhDong}` : ''}?${truyVanLoc(boLoc)}`,
  };
  const tuyChonLoc = tv.tuyChonLoc();

  if (tab === 'nha') mau.dsNha = tv.lietKeNha(boLoc);
  else if (tab === 'phong') Object.assign(mau, { phong: tv.lietKePhong(boLoc), dsNhaLoc: tuyChonLoc.nha });
  else if (tab === 'loai') mau.dsLoai = tv.lietKeLoai(boLoc);
  else {
    // Phòng trong ô lọc thu theo nhà đã chọn; phòng không thuộc nhà đó thì bỏ khỏi bộ lọc
    const dsPhongLoc = tuyChonLoc.phong.filter((p) => !boLoc.nha || p.toa_nha_id === boLoc.nha);
    if (boLoc.phong && !dsPhongLoc.some((p) => p.id === boLoc.phong)) boLoc.phong = null;
    Object.assign(mau, { thietBi: tv.lietKeThietBi(boLoc), dsNhaLoc: tuyChonLoc.nha, dsPhongLoc, dsLoaiLoc: tuyChonLoc.loai });
    const idHoSo = soId(req.query['ho-so']);
    if (idHoSo) mau.hoSo = tv.hoSoThietBi(idHoSo);
  }

  if (form) {
    const giaTri = form.giaTri || {};
    mau.tuyChonForm = tv.tuyChonForm({ phongId: soId(giaTri.phong_id), loaiId: soId(giaTri.loai_thiet_bi_id) });
    mau.form = { ...form, giaTri: { ...GIA_TRI_MAC_DINH[muc], ...giaTri } };
  }
  return mau;
}

router.get('/', (req, res) => {
  const boLoc = tv.docBoLoc(req.query);
  const muc = MUC_THEO_TAB[boLoc.tab];
  let form = null;
  if (mot(req.query.them) === '1') form = { muc, id: null, giaTri: {}, loi: {} };
  else if (soId(req.query.sua)) {
    const id = soId(req.query.sua);
    const giaTri = tv.giaTriForm(muc, id);
    if (giaTri) form = { muc, id, giaTri, loi: {} };
  }
  res.render('ql/danh-muc', dungTrang(req, boLoc, { form, flash: layFlash(req, KHOA_FLASH) }));
});

const THONG_DIEP = {
  them: (ten, nhan) => `Đã thêm ${ten} ${nhan}.`,
  sua: (ten, nhan) => `Đã cập nhật ${ten} ${nhan}.`,
  ngung: (ten, nhan) => `Đã ngừng sử dụng ${ten} ${nhan}.`,
  moLai: (ten, nhan) => `Đã mở lại ${ten} ${nhan}.`,
  xoa: (ten, nhan) => `Đã xóa ${ten} ${nhan}.`,
};

function xuLy(hanhDong) {
  return (req, res, next) => {
    const tab = req.params.muc;
    const muc = MUC_THEO_TAB[tab];
    const coId = req.params.id !== undefined;
    const id = coId ? soId(req.params.id) : null;
    if (!muc || (coId && !id)) return next();
    const boLoc = tv.docBoLoc({ ...req.query, tab });
    const dich = `${GOC}?${truyVanLoc(boLoc)}`;
    const doiTuongMuc = dm.MUC[muc];
    try {
      let kq;
      if (hanhDong === 'them') kq = doiTuongMuc.them(req.nguoiDung, req.body);
      else if (hanhDong === 'sua') kq = doiTuongMuc.sua(req.nguoiDung, id, req.body);
      else kq = doiTuongMuc[hanhDong](req.nguoiDung, id);
      datFlash(req, KHOA_FLASH, 'ok', THONG_DIEP[hanhDong](doiTuongMuc.ten, kq.nhan));
      res.redirect(dich);
    } catch (e) {
      if (!(e instanceof LoiNghiepVu)) return next(e);
      if (e.ma === 404) return next();
      if (e.ma === 422) {
        // Lỗi dữ liệu: dựng lại trang với form đang mở, giữ giá trị đã nhập, lỗi hiện dưới từng ô
        const giaTri = { ...(req.body || {}) };
        if (hanhDong === 'sua' && muc === 'phong') giaTri.nha_ma = (tv.giaTriForm('phong', id) || {}).nha_ma;
        return res.status(422).render('ql/danh-muc', dungTrang(req, boLoc, { form: { muc, id, giaTri, loi: e.loi || {} } }));
      }
      datFlash(req, KHOA_FLASH, 'loi', e.message);
      res.redirect(dich);
    }
  };
}

router.post('/:muc', xuLy('them'));
router.post('/:muc/:id', xuLy('sua'));
router.post('/:muc/:id/ngung', xuLy('ngung'));
router.post('/:muc/:id/mo-lai', xuLy('moLai'));
router.post('/:muc/:id/xoa', xuLy('xoa'));

module.exports = router;
