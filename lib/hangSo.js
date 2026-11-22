// Mã và nhãn hiển thị theo SPEC mục 2, 5, 6.2.

const VAI_TRO = {
  SINH_VIEN: 'Sinh viên',
  QUAN_LY: 'Quản lý',
  KY_THUAT_VIEN: 'Kỹ thuật viên',
};

// Mục 5: [tên cho QL/KTV, tên cho SV, lớp màu nhãn]
const TRANG_THAI_YEU_CAU = {
  MOI:            { ql: 'Đã gửi',                      sv: 'Đã gửi',                        mau: 'vang' },
  DA_PHAN_CONG:   { ql: 'Đã phân công',                sv: 'Đã tiếp nhận',                  mau: 'xanh-nhat' },
  DANG_SUA:       { ql: 'Đang xử lý',                  sv: 'Đang xử lý',                    mau: 'xanh' },
  CHO_NGHIEM_THU: { ql: 'Chờ nghiệm thu',              sv: 'Đang xử lý',                    mau: 'tim' },
  CHUYEN_XU_LY:   { ql: 'Chuyển xử lý theo phương án', sv: 'Chờ thay thế / sửa chữa ngoài', mau: 'cam' },
  HOAN_THANH:     { ql: 'Hoàn thành',                  sv: 'Đã hoàn thành',                 mau: 'xanh-la' },
  TU_CHOI:        { ql: 'Từ chối',                     sv: 'Bị từ chối',                    mau: 'do' },
  DA_HUY:         { ql: 'Đã hủy',                      sv: 'Đã hủy',                        mau: 'xam' },
};

const TINH_TRANG_THIET_BI = {
  HOAT_DONG: 'Hoạt động',
  DANG_SUA: 'Đang sửa',
  CHO_THAY_THE: 'Hỏng – chờ thay thế',
  THANH_LY: 'Đã thanh lý',
};

const MUC_DO = { KHAN_CAP: 'Khẩn cấp', BINH_THUONG: 'Bình thường' };

const KET_QUA_KIEM_TRA = {
  KHAC_PHUC_TAI_CHO: 'Đã khắc phục tại chỗ',
  KHONG_KHAC_PHUC: 'Không khắc phục tại chỗ',
};

const PHUONG_AN = {
  BAO_HANH: 'Bảo hành',
  MUA_VAT_TU: 'Mua vật tư thay thế',
  THUE_NGOAI: 'Thuê đơn vị sửa',
  THANH_LY: 'Thanh lý – mua mới',
};

module.exports = { VAI_TRO, TRANG_THAI_YEU_CAU, TINH_TRANG_THIET_BI, MUC_DO, KET_QUA_KIEM_TRA, PHUONG_AN };
