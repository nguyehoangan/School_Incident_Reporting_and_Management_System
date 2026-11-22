-- Cơ sở dữ liệu theo SPEC mục 10 (tên bảng / cột tiếng Việt không dấu, snake_case).
-- Thời gian lưu dạng TEXT 'YYYY-MM-DD HH:MM:SS' theo giờ Việt Nam (BR-13).
-- Giá trị đúng/sai lưu INTEGER 0/1.

CREATE TABLE nguoi_dung (
  id              INTEGER PRIMARY KEY,
  email           TEXT    NOT NULL UNIQUE,
  mat_khau_hash   TEXT    NOT NULL,
  ho_ten          TEXT    NOT NULL,
  vai_tro         TEXT    NOT NULL CHECK (vai_tro IN ('SINH_VIEN','QUAN_LY','KY_THUAT_VIEN')),
  ma_so           TEXT,
  so_dien_thoai   TEXT,
  trang_thai      TEXT    NOT NULL DEFAULT 'HOAT_DONG' CHECK (trang_thai IN ('HOAT_DONG','KHOA'))
);

CREATE TABLE toa_nha (
  id              INTEGER PRIMARY KEY,
  ma_nha          TEXT    NOT NULL UNIQUE,
  ten_nha         TEXT    NOT NULL,
  dang_su_dung    INTEGER NOT NULL DEFAULT 1 CHECK (dang_su_dung IN (0,1))
);

CREATE TABLE phong (
  id              INTEGER PRIMARY KEY,
  toa_nha_id      INTEGER NOT NULL REFERENCES toa_nha(id),
  ma_phong        TEXT    NOT NULL,
  tang            INTEGER,
  loai_phong      TEXT,
  dang_su_dung    INTEGER NOT NULL DEFAULT 1 CHECK (dang_su_dung IN (0,1)),
  UNIQUE (toa_nha_id, ma_phong)
);

CREATE TABLE loai_thiet_bi (
  id              INTEGER PRIMARY KEY,
  ten_loai        TEXT    NOT NULL UNIQUE,
  dang_su_dung    INTEGER NOT NULL DEFAULT 1 CHECK (dang_su_dung IN (0,1))
);

CREATE TABLE thiet_bi (
  id               INTEGER PRIMARY KEY,
  ma_tai_san       TEXT    NOT NULL UNIQUE,
  ten_thiet_bi     TEXT    NOT NULL,
  loai_thiet_bi_id INTEGER NOT NULL REFERENCES loai_thiet_bi(id),
  phong_id         INTEGER NOT NULL REFERENCES phong(id),
  model_hang       TEXT,
  nam_su_dung      INTEGER,
  nguon_kinh_phi   TEXT,
  han_bao_hanh     TEXT,
  tinh_trang       TEXT    NOT NULL DEFAULT 'HOAT_DONG'
                   CHECK (tinh_trang IN ('HOAT_DONG','DANG_SUA','CHO_THAY_THE','THANH_LY'))
);

CREATE TABLE yeu_cau (
  id                   INTEGER PRIMARY KEY,
  ma_yeu_cau           TEXT    NOT NULL UNIQUE,          -- YC-YYYY-NNNN
  sinh_vien_id         INTEGER NOT NULL REFERENCES nguoi_dung(id),
  phong_id             INTEGER NOT NULL REFERENCES phong(id),
  thiet_bi_id          INTEGER REFERENCES thiet_bi(id),   -- rỗng = "Không có trong danh sách"
  loai_thiet_bi_id     INTEGER NOT NULL REFERENCES loai_thiet_bi(id),
  muc_do               TEXT    NOT NULL CHECK (muc_do IN ('KHAN_CAP','BINH_THUONG')),
  mo_ta                TEXT    NOT NULL,
  trang_thai           TEXT    NOT NULL DEFAULT 'MOI' CHECK (trang_thai IN
                         ('MOI','DA_PHAN_CONG','DANG_SUA','CHO_NGHIEM_THU','CHUYEN_XU_LY','HOAN_THANH','TU_CHOI','DA_HUY')),
  ly_do_tu_choi        TEXT,
  ghi_chu_ql           TEXT,
  ket_qua_kiem_tra     TEXT    CHECK (ket_qua_kiem_tra IS NULL OR ket_qua_kiem_tra IN ('KHAC_PHUC_TAI_CHO','KHONG_KHAC_PHUC')),
  phuong_an            TEXT    CHECK (phuong_an IS NULL OR phuong_an IN ('BAO_HANH','MUA_VAT_TU','THUE_NGOAI','THANH_LY')),
  so_to_trinh          TEXT,
  so_bien_ban_ban_giao TEXT,
  ket_qua_cuoi         TEXT,
  nguoi_tiep_nhan_id   INTEGER REFERENCES nguoi_dung(id),
  thoi_gian_gui        TEXT    NOT NULL,
  thoi_gian_tiep_nhan  TEXT,
  thoi_gian_cap_nhat   TEXT    NOT NULL,
  thoi_gian_hoan_thanh TEXT
);

CREATE TABLE noi_dung_sua_chua (
  id          INTEGER PRIMARY KEY,
  yeu_cau_id  INTEGER NOT NULL REFERENCES yeu_cau(id),
  stt         INTEGER NOT NULL,
  noi_dung    TEXT    NOT NULL,
  so_luong    INTEGER,
  ghi_chu     TEXT
);

CREATE TABLE bien_ban_kiem_tra (
  id                 INTEGER PRIMARY KEY,
  yeu_cau_id         INTEGER NOT NULL REFERENCES yeu_cau(id),
  ktv_id             INTEGER NOT NULL REFERENCES nguoi_dung(id),
  thoi_gian          TEXT    NOT NULL,
  tinh_trang_su_co   TEXT    NOT NULL,
  nguyen_nhan        TEXT    NOT NULL,
  de_xuat_mua_vat_tu TEXT,   -- rỗng = không đề xuất
  de_xuat_thue_sua   TEXT,
  de_xuat_thanh_ly   TEXT,
  con_bao_hanh       INTEGER NOT NULL DEFAULT 0 CHECK (con_bao_hanh IN (0,1)),
  con_hieu_luc       INTEGER NOT NULL DEFAULT 1 CHECK (con_hieu_luc IN (0,1))
);
-- Tối đa 1 biên bản đang hiệu lực cho mỗi yêu cầu
CREATE UNIQUE INDEX uq_bien_ban_hieu_luc ON bien_ban_kiem_tra(yeu_cau_id) WHERE con_hieu_luc = 1;

CREATE TABLE anh_dinh_kem (
  id            INTEGER PRIMARY KEY,
  yeu_cau_id    INTEGER NOT NULL REFERENCES yeu_cau(id),
  duong_dan     TEXT    NOT NULL,
  loai_anh      TEXT    NOT NULL CHECK (loai_anh IN ('TRUOC','SAU')),
  nguoi_tai_id  INTEGER NOT NULL REFERENCES nguoi_dung(id)
);

CREATE TABLE phan_cong (
  id                 INTEGER PRIMARY KEY,
  yeu_cau_id         INTEGER NOT NULL REFERENCES yeu_cau(id),
  ktv_id             INTEGER NOT NULL REFERENCES nguoi_dung(id),
  nguoi_giao_id      INTEGER NOT NULL REFERENCES nguoi_dung(id),
  thoi_gian_giao     TEXT    NOT NULL,
  han_hoan_thanh     TEXT    NOT NULL,
  ghi_chu_giao_viec  TEXT,
  con_hieu_luc       INTEGER NOT NULL DEFAULT 1 CHECK (con_hieu_luc IN (0,1))
);
-- BR-07: mỗi yêu cầu tối đa 1 bản ghi phân công đang hiệu lực
CREATE UNIQUE INDEX uq_phan_cong_hieu_luc ON phan_cong(yeu_cau_id) WHERE con_hieu_luc = 1;

CREATE TABLE khu_vuc_phu_trach (
  ktv_id      INTEGER NOT NULL REFERENCES nguoi_dung(id),
  toa_nha_id  INTEGER NOT NULL REFERENCES toa_nha(id),
  PRIMARY KEY (ktv_id, toa_nha_id)
);

CREATE TABLE lich_su_xu_ly (
  id                  INTEGER PRIMARY KEY,
  yeu_cau_id          INTEGER NOT NULL REFERENCES yeu_cau(id),
  nguoi_thuc_hien_id  INTEGER NOT NULL REFERENCES nguoi_dung(id),
  tu_trang_thai       TEXT,            -- rỗng ở dòng "Gửi yêu cầu"
  den_trang_thai      TEXT    NOT NULL,
  noi_dung            TEXT,
  thoi_gian           TEXT    NOT NULL
);
-- Lịch sử chỉ thêm, không sửa / xóa
CREATE TRIGGER lich_su_khong_sua BEFORE UPDATE ON lich_su_xu_ly
BEGIN SELECT RAISE(ABORT, 'lich_su_xu_ly chi duoc them, khong duoc sua'); END;
CREATE TRIGGER lich_su_khong_xoa BEFORE DELETE ON lich_su_xu_ly
BEGIN SELECT RAISE(ABORT, 'lich_su_xu_ly chi duoc them, khong duoc xoa'); END;

CREATE INDEX ix_phong_nha        ON phong(toa_nha_id);
CREATE INDEX ix_thiet_bi_phong   ON thiet_bi(phong_id);
CREATE INDEX ix_yeu_cau_tt       ON yeu_cau(trang_thai);
CREATE INDEX ix_yeu_cau_sv       ON yeu_cau(sinh_vien_id);
CREATE INDEX ix_yeu_cau_phong    ON yeu_cau(phong_id);
CREATE INDEX ix_phan_cong_ktv    ON phan_cong(ktv_id, con_hieu_luc);
CREATE INDEX ix_lich_su_yeu_cau  ON lich_su_xu_ly(yeu_cau_id);
