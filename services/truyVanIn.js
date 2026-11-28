// Truy vấn (chỉ đọc) cho các trang in biểu mẫu QT.06 (SPEC mục 9): M.01 phiếu yêu cầu, M.04 biên bản kiểm tra kỹ thuật.
// M.02 lấy từ services/soTiepNhan.js, M.03 từ services/truyVanDanhMuc.js (hoSoThietBi). Quyền xem kiểm tra ở coQuyenXem().
const { layCsdl } = require('../db');
const { MUC_DO } = require('../lib/hangSo');
const { phanCongHienTai } = require('./yeuCau');

// Yêu cầu + nhà, phòng, thiết bị, loại, SV – đủ cho phần đầu của M.01 và M.04
function layYeuCau(id) {
  return layCsdl().prepare(`
    SELECT y.*, n.ma_nha, n.ten_nha, p.ma_phong, l.ten_loai,
           t.ten_thiet_bi, t.ma_tai_san, t.model_hang, t.nam_su_dung, t.han_bao_hanh,
           sv.ho_ten AS ten_sv, sv.ma_so AS mssv, sv.email AS email_sv,
           ql.ho_ten AS ten_ql_tiep_nhan
      FROM yeu_cau y
      JOIN phong p ON p.id = y.phong_id
      JOIN toa_nha n ON n.id = p.toa_nha_id
      JOIN loai_thiet_bi l ON l.id = y.loai_thiet_bi_id
      JOIN nguoi_dung sv ON sv.id = y.sinh_vien_id
      LEFT JOIN thiet_bi t ON t.id = y.thiet_bi_id
      LEFT JOIN nguoi_dung ql ON ql.id = y.nguoi_tiep_nhan_id
     WHERE y.id = ?`).get(id) || null;
}

// Quyền xem biểu mẫu của một yêu cầu – giống trang chi tiết tương ứng (BR-04):
// QL xem mọi yêu cầu; SV chỉ yêu cầu của mình (S03); KTV chỉ việc có phân công đang hiệu lực của mình (K02).
function coQuyenXem(nguoiDung, yc) {
  if (!nguoiDung || !yc) return false;
  if (nguoiDung.vai_tro === 'QUAN_LY') return true;
  if (nguoiDung.vai_tro === 'SINH_VIEN') return yc.sinh_vien_id === nguoiDung.id;
  if (nguoiDung.vai_tro === 'KY_THUAT_VIEN') {
    const pc = phanCongHienTai(layCsdl(), yc.id);
    return !!pc && pc.ktv_id === nguoiDung.id;
  }
  return false;
}

// Người thực hiện lần chuyển trạng thái gần nhất sang `den` (ví dụ ai báo kết quả, ai nghiệm thu)
function nguoiChuyenGanNhat(yeuCauId, tu, den) {
  const r = layCsdl().prepare(`SELECT u.ho_ten, ls.thoi_gian FROM lich_su_xu_ly ls JOIN nguoi_dung u ON u.id = ls.nguoi_thuc_hien_id
                                WHERE ls.yeu_cau_id = ? AND ls.tu_trang_thai = ? AND ls.den_trang_thai = ?
                                ORDER BY ls.id DESC LIMIT 1`).get(yeuCauId, tu, den);
  return r || null;
}

const tenThietBi = (yc) => (yc.ten_thiet_bi
  ? `${yc.ten_thiet_bi} (${yc.ma_tai_san})`
  : `${yc.ten_loai} (không có trong danh sách)`);

// M.01 – Phiếu yêu cầu sửa chữa trang thiết bị (mục 9): phần I do SV gửi, phần II các dòng KTV nhập ở bước 4a.
function duLieuM01(yc) {
  const db = layCsdl();
  const dongSua = db.prepare('SELECT stt, noi_dung, so_luong, ghi_chu FROM noi_dung_sua_chua WHERE yeu_cau_id = ? ORDER BY stt').all(yc.id);
  // Ô ký phần II: điền tên khi đã có phần II (KTV báo kết quả); SV và QL nghiệm thu khi đã hoàn thành tại chỗ
  const baoKetQua = dongSua.length ? nguoiChuyenGanNhat(yc.id, 'DANG_SUA', 'CHO_NGHIEM_THU') : null;
  const nghiemThu = dongSua.length && yc.trang_thai === 'HOAN_THANH' ? nguoiChuyenGanNhat(yc.id, 'CHO_NGHIEM_THU', 'HOAN_THANH') : null;
  return {
    yc,
    donVi: `Nhà ${yc.ma_nha} – Phòng ${yc.ma_nha}-${yc.ma_phong}`,
    phanI: [{
      stt: 1,
      noiDung: `${tenThietBi(yc)}, phòng ${yc.ma_nha}-${yc.ma_phong}`,
      tinhTrang: yc.mo_ta,
      ghiChu: MUC_DO[yc.muc_do],
    }],
    phanII: dongSua,
    ky: {
      ktv: baoKetQua ? baoKetQua.ho_ten : '',
      donViSuDung: nghiemThu ? yc.ten_sv : '',
      ql: nghiemThu ? nghiemThu.ho_ten : '',
      ngay: nghiemThu ? nghiemThu.thoi_gian : '',
    },
  };
}

// M.04 – Biên bản kiểm tra kỹ thuật từ biên bản ĐANG HIỆU LỰC (mỗi yêu cầu tối đa 1). Không có -> null.
function duLieuM04(yc) {
  const bb = layCsdl().prepare(`SELECT b.*, u.ho_ten AS ten_ktv FROM bien_ban_kiem_tra b JOIN nguoi_dung u ON u.id = b.ktv_id
                                 WHERE b.yeu_cau_id = ? AND b.con_hieu_luc = 1`).get(yc.id);
  if (!bb) return null;
  return {
    yc,
    bb,
    diaDiem: `Nhà ${yc.ma_nha} – Phòng ${yc.ma_nha}-${yc.ma_phong}`,
    tenMay: yc.ten_thiet_bi ? [yc.ten_thiet_bi, yc.model_hang].filter(Boolean).join(' ') : `${yc.ten_loai} (không có trong danh sách)`,
    bienPhap: [
      ['Mua vật tư thay thế', bb.de_xuat_mua_vat_tu],
      ['Thuê đơn vị sửa chữa', bb.de_xuat_thue_sua],
      ['Hỏng, đề nghị thanh lý', bb.de_xuat_thanh_ly],
    ],
  };
}

module.exports = { layYeuCau, coQuyenXem, duLieuM01, duLieuM04 };
