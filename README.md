# Hệ thống báo hỏng & sửa chữa CSVC

Bài tập lớn ET3260 – Nhóm 4. Web cho 3 vai trò: **Sinh viên** báo hỏng thiết bị phòng học, **Quản lý** tiếp nhận / phân công / nghiệm thu, **Kỹ thuật viên** kiểm tra và sửa. Quy trình bám theo QT.06 (sửa chữa trang thiết bị): khắc phục tại chỗ thì nghiệm thu, không khắc phục tại chỗ thì lập biên bản kiểm tra kỹ thuật (M.04) và chuyển phương án. Đặc tả đầy đủ trong [`SPEC.md`](SPEC.md).

Công nghệ: Node.js + Express, SQLite (`better-sqlite3`), giao diện EJS + CSS thuần, `express-session`, `bcrypt`, `multer` (ảnh lưu ở `uploads/yeu-cau/`). Không dùng thư viện xuất Excel / PDF: Excel là tệp `.csv` UTF-8 có BOM, PDF in bằng trình duyệt.

## Cài đặt và chạy

Cần Node.js ≥ 18.

```bash
npm install
npm run seed     # xóa và tạo lại CSDL data/csvc.db + dữ liệu mẫu
npm start        # http://localhost:3000 (đổi cổng: PORT=3100 npm start)
```

Chạy lại `npm run seed` bất cứ lúc nào để đưa dữ liệu về ban đầu (ngày giờ mẫu tính theo thời điểm chạy seed).

## Tài khoản mẫu

Mật khẩu chung cho mọi tài khoản: **`123456`**

| Vai trò | Email | Họ tên | Trang đầu sau đăng nhập |
|---|---|---|---|
| Quản lý | `quanly@hust.edu.vn` | Nguyễn Thị Lan | Danh sách yêu cầu |
| Kỹ thuật viên | `ktv.binh@hust.edu.vn` | Trần Văn Bình (phụ trách D3, D5) | Việc được giao |
| Kỹ thuật viên | `ktv.hoa@hust.edu.vn` | Lê Thị Hoa (phụ trách D9, C7) | Việc được giao |
| Kỹ thuật viên | `ktv.duc@hust.edu.vn` | Phạm Minh Đức (phụ trách TC, D3) | Việc được giao |
| Sinh viên | `an.nh225001@sis.hust.edu.vn` | Nguyễn Hoàng An (20225001) | Yêu cầu của tôi |
| Sinh viên | `ha.tt225002@sis.hust.edu.vn` | Trần Thu Hà (20225002) | Yêu cầu của tôi |
| Sinh viên | `minh.lv225003@sis.hust.edu.vn` | Lê Văn Minh (20225003) | Yêu cầu của tôi |

Dữ liệu mẫu còn có 5 nhà (D3, D5, D9, C7, TC), 21 phòng, 93 thiết bị, 11 loại thiết bị và 26 yêu cầu ở đủ 8 trạng thái. Thiết bị dùng cho kịch bản demo SPEC 13.5 (`MC-D3301-01` máy chiếu D3-301, `DH-C7102-01` điều hòa C7-102) để ở trạng thái Hoạt động, chưa có yêu cầu nào.

## Danh sách màn hình

Mã màn hình theo SPEC mục 8; ảnh mẫu ở `design/mockups/<mã>-*.png`.

| Mã | Màn hình | Vai trò | Đường dẫn |
|---|---|---|---|
| M01 | Đăng nhập | Tất cả | `/dang-nhap` |
| S01 | Yêu cầu của tôi | SV | `/sinh-vien/yeu-cau` |
| S02 | Gửi yêu cầu mới (ảnh, cảnh báo trùng) | SV | `/sinh-vien/gui-yeu-cau` |
| S03 | Chi tiết yêu cầu, Hủy, **In M.01** | SV | `/sinh-vien/yeu-cau/:id` |
| Q01 | Danh sách yêu cầu (ô số liệu, theo nhà, lọc, sắp xếp) | QL | `/quan-ly/yeu-cau` |
| Q02 | Chi tiết & xử lý: phân công, từ chối, đổi KTV, nghiệm thu, làm lại, duyệt biên bản & chuyển phương án, đóng; **In M.01 / M.04** | QL | `/quan-ly/yeu-cau/:id` |
| Q03 | Bảng phân công (khu vực phụ trách, công việc đã giao) | QL | `/quan-ly/phan-cong` |
| Q04 | Danh mục CSVC (nhà, phòng, loại, thiết bị), Hồ sơ thiết bị, **In M.03** | QL | `/quan-ly/co-so-vat-chat` |
| Q05 | Quản lý KTV | QL | `/quan-ly/ky-thuat-vien` |
| Q06 | Sổ tiếp nhận thông báo sự cố (M.02): lọc khoảng ngày + nhà, **In sổ**, **Xuất Excel** | QL | `/quan-ly/so-tiep-nhan` |
| K01 | Việc được giao (nhóm theo nhà, 3 tab) | KTV | `/ky-thuat-vien/viec` |
| K02 | Chi tiết công việc: bắt đầu kiểm tra, báo kết quả *Đã khắc phục tại chỗ* (phần II M.01) hoặc *Không khắc phục tại chỗ* (biên bản M.04); **In M.01 / M.04** | KTV | `/ky-thuat-vien/viec/:id` |

### Trang in biểu mẫu (SPEC mục 9)

Khổ A4, bố cục theo mẫu giấy trong `docs/QT06-quy-trinh-sua-chua.pdf`, đầu trang "ĐẠI HỌC BÁCH KHOA HÀ NỘI" + quốc hiệu, góc phải ký hiệu mẫu. Nút **In / Lưu PDF** mở hộp thoại in của trình duyệt (chọn *Lưu dưới dạng PDF* để ra tệp). Quyền kiểm tra ở server như trang chi tiết tương ứng.

| Mẫu | Đường dẫn | Ai in được | Nội dung |
|---|---|---|---|
| M.01 Phiếu yêu cầu sửa chữa | `/in/m01/:id` | SV (yêu cầu của mình), QL, KTV (việc đang được giao) | Phần I do SV gửi; phần II các dòng KTV nhập (để trống nếu chưa có) |
| M.02 Sổ tiếp nhận thông báo sự cố | `/in/m02?tu=&den=&nha=` | QL | Theo bộ lọc của Q06, khổ ngang |
| M.03 Sổ theo dõi thiết bị (cột 1–8) | `/in/m03/:thietBiId` | QL | Một thiết bị, kèm số lần và nội dung sửa chữa, khổ ngang |
| M.04 Biên bản kiểm tra kỹ thuật | `/in/m04/:id` | QL, KTV (việc đang được giao) | Từ biên bản đang hiệu lực |

## Chạy test

```bash
npm test         # node --test test/*.test.js – mỗi tệp tự tạo CSDL tạm, không đụng data/csvc.db
```

| Tệp | Kiểm tra |
|---|---|
| `test/yeuCau.test.js` | Mọi dòng bảng chuyển trạng thái 5.1, chuyển trạng thái sai bị từ chối, BR-04/05/06/07/14, cập nhật thiết bị theo 6.3 |
| `test/kyThuatVien.test.js` | K01, K02 qua HTTP: BR-04, bắt đầu kiểm tra, báo kết quả tại chỗ; **biên bản M.04 thiếu trường / thiếu biện pháp bị từ chối**, lưu đúng biện pháp được đánh dấu |
| `test/soTiepNhanVaIn.test.js` | **Q06 chỉ lấy yêu cầu đã tiếp nhận** (bỏ Đã gửi, Từ chối, Đã hủy), lọc ngày / nhà, cột Ghi chú, CSV có BOM; quyền và nội dung các trang in M.01–M.04 |
| `test/danhMuc.test.js`, `test/nhanSu.test.js`, `test/quanLyCsvc.test.js` | Danh mục CSVC (trùng mã, BR-10), tài khoản KTV và khu vực phụ trách, route Q03–Q05 |

## Cấu trúc

```
app.js                 máy chủ Express
db/schema.sql          12 bảng theo SPEC mục 10
services/yeuCau.js     logic nghiệp vụ: gửi yêu cầu và TOÀN BỘ chuyển trạng thái theo bảng 5.1 (BANG_CHUYEN)
services/truyVanQL.js, truyVanKtv.js, truyVanDanhMuc.js, truyVanPhanCong.js   truy vấn chỉ đọc cho từng màn hình
services/soTiepNhan.js sổ M.02 truy vấn trực tiếp từ yeu_cau (BR-15) + xuất CSV
services/truyVanIn.js  dữ liệu và quyền xem cho trang in M.01, M.04
services/danhMuc.js, nhanSu.js   ghi danh mục CSVC và tài khoản / khu vực KTV
routes/                đăng nhập, trang SV / QL / KTV, inBieuMau.js (trang in /in/...)
views/                 giao diện EJS; views/in/ là trang in A4
public/css/style.css   giao diện chung (có phần cho điện thoại ≤ 640px); public/css/in.css cho trang in
lib/                   hằng số, giờ Việt Nam, menu theo vai trò
middleware/auth.js     phiên đăng nhập, chặn truy cập theo vai trò (ở server)
scripts/seed.js        tạo dữ liệu mẫu
test/                  test tự động (node --test)
```

Giao diện dùng được trên điện thoại: ở bề rộng ≤ 640px các bảng chuyển thành thẻ, menu xuống dòng, nút / ô chọn cao tối thiểu 40px; trang in co theo màn hình, bảng nhiều cột cuộn ngang trong khung.

## Tiến độ

- [x] Đợt 1: CSDL, dữ liệu mẫu, khung giao diện, đăng nhập và chuyển trang theo vai trò
- [x] Đợt 2: màn hình Sinh viên (S01, S02, S03)
- [x] Đợt 3: Quản lý – Q01 Danh sách yêu cầu, Q02 Chi tiết & xử lý
- [x] Đợt 4: Kỹ thuật viên – K01 Việc được giao, K02 Chi tiết (bắt đầu kiểm tra, báo kết quả tại chỗ)
- [x] Đợt 5: Q03 Bảng phân công, Q04 Danh mục CSVC (Hồ sơ thiết bị), Q05 Quản lý KTV
- [x] Đợt 6: K02 nhánh *Không khắc phục tại chỗ* (biên bản M.04), Q06 Sổ tiếp nhận M.02 (in, xuất Excel), trang in M.01–M.04, rà giao diện điện thoại

Thư mục `frontend/`, `backend/` và `index.html` ở gốc là bản thử giao diện tĩnh cũ (chạy trên GitHub Pages), không dùng cho ứng dụng này.
