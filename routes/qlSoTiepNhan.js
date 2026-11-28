// Q06 Sổ tiếp nhận thông báo sự cố (M.02) – QL. Gắn tại /quan-ly/so-tiep-nhan (đã qua chiVaiTro('QUAN_LY')).
// Chỉ xem: không có ô sửa, muốn đổi nội dung thì sửa ở yêu cầu (mục 8 Q06). Dữ liệu truy vấn trực tiếp (BR-15).
const express = require('express');
const { gioVN } = require('../lib/thoiGian');
const so = require('../services/soTiepNhan');

const router = express.Router();

router.get('/', (req, res) => {
  const boLoc = so.docBoLoc(req.query);
  const q = so.chuoiTruyVan(boLoc);
  res.render('ql/so-tiep-nhan', {
    tieuDe: 'Sổ tiếp nhận thông báo sự cố',
    lopTrang: 'nen-xam',
    boLoc,
    dong: so.danhSach(boLoc),
    dsNha: so.danhSachNha().filter((n) => n.dang_su_dung || n.ma_nha === boLoc.nha),
    cot: so.COT,
    urlIn: `/in/m02?${q}`,
    urlExcel: `/quan-ly/so-tiep-nhan/xuat-excel?${q}`,
  });
});

// Xuất Excel: tệp .csv UTF-8 có BOM (Excel mở đúng tiếng Việt), theo bộ lọc đang chọn
router.get('/xuat-excel', (req, res) => {
  const boLoc = so.docBoLoc(req.query);
  const ten = `so-tiep-nhan-M02_${gioVN().slice(0, 10).replace(/-/g, '')}.csv`;
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${ten}"`);
  res.send(so.xuatCsv(so.danhSach(boLoc)));
});

module.exports = router;
