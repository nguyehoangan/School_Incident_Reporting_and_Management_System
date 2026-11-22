// Menu theo vai trò và trang đầu sau đăng nhập (SPEC mục 3 bước 4, mục 8).
const MENU = {
  SINH_VIEN: [
    { duongDan: '/sinh-vien/yeu-cau', ten: 'Yêu cầu của tôi' },
    { duongDan: '/sinh-vien/gui-yeu-cau', ten: 'Gửi yêu cầu' },
  ],
  QUAN_LY: [
    { duongDan: '/quan-ly/yeu-cau', ten: 'Yêu cầu' },
    { duongDan: '/quan-ly/phan-cong', ten: 'Phân công' },
    { duongDan: '/quan-ly/co-so-vat-chat', ten: 'Cơ sở vật chất' },
    { duongDan: '/quan-ly/ky-thuat-vien', ten: 'Kỹ thuật viên' },
    { duongDan: '/quan-ly/so-tiep-nhan', ten: 'Sổ tiếp nhận' },
  ],
  KY_THUAT_VIEN: [
    { duongDan: '/ky-thuat-vien/viec', ten: 'Việc của tôi' },
  ],
};

function trangDau(vaiTro) {
  return MENU[vaiTro] ? MENU[vaiTro][0].duongDan : '/dang-nhap';
}

module.exports = { MENU, trangDau };
