# Hướng dẫn giao việc cho Claude Code – 6 đợt

## Chuẩn bị (làm 1 lần)
1. Chép toàn bộ bộ tài liệu này vào thư mục gốc của repo: `CLAUDE.md`, `SPEC.md`, `PROMPTS.md`, thư mục `docs/`, `design/`. Commit lên GitHub.
2. Mở Claude Code trong thư mục repo. **Không cần chạy `/init`** vì đã có sẵn `CLAUDE.md`.
3. Kiểm tra Claude đã đọc CLAUDE.md: gõ `/context`.

## Cách chạy mỗi đợt
1. Mở phiên mới (hoặc gõ `/clear` nếu đang ở phiên cũ).
2. Chọn mô hình bằng `/model` theo bảng dưới.
3. Bấm `Shift+Tab` đến khi thấy `⏸ plan mode on`, rồi dán prompt của đợt.
4. Đọc kế hoạch Claude đưa ra. Thấy ổn thì duyệt cho code; chưa ổn thì nói chỗ cần sửa.
5. Code xong: tự chạy web, bấm thử theo phần "Kiểm tra" của đợt. Đạt thì bảo Claude commit, rồi sang đợt sau.

| Đợt | Nội dung | Mô hình gợi ý |
|---|---|---|
| 1 | CSDL, dữ liệu mẫu, khung giao diện, đăng nhập | Opus |
| 2 | Màn hình Sinh viên | Sonnet |
| 3 | Màn hình Quản lý: danh sách + xử lý yêu cầu | Opus |
| 4 | Màn hình Kỹ thuật viên, chạy trọn 1 vòng | Sonnet |
| 5 | Phân công, danh mục CSVC, quản lý KTV | Sonnet |
| 6 | Nhánh không khắc phục tại chỗ, sổ M.02, trang in, điện thoại | Opus |
| Cuối | Rà soát toàn bộ | Opus |

**Mẹo:** Sửa một lỗi quá 2 lần chưa được → `/clear`, dán lại prompt đợt đó kèm mô tả lỗi cụ thể. Claude đang làm sai hướng → bấm `Esc` để dừng; `Esc` 2 lần (hoặc `/rewind`) để quay lại trước đó.

---

## Đợt 1 – Nền móng
```
Đọc @SPEC.md (mục 1, 2, 3, 8 phần khung chung và M01, 10, 13) và xem các ảnh trong design/ và design/mockups/.
Làm ĐỢT 1, chưa làm gì của các đợt sau:
1. Khởi tạo dự án Node.js + Express + better-sqlite3 + EJS theo CLAUDE.md, có script npm start và npm run seed.
2. Tạo đủ các bảng ở SPEC mục 10 (kể cả bảng chưa dùng tới) với khóa, ràng buộc UNIQUE đúng SPEC.
3. Script seed tạo dữ liệu mẫu đúng mục 13.3: 1 QL, 3 KTV, 3 SV (cùng mật khẩu demo 123456, băm bcrypt),
   5 nhà D3/D5/D9/C7/TC, mỗi nhà 3–5 phòng, mỗi phòng 3–6 thiết bị, 11 loại thiết bị, khu vực phụ trách cho 3 KTV,
   khoảng 25 yêu cầu trải đều mọi trạng thái và các nhà (kèm lịch sử, phân công, biên bản phù hợp trạng thái).
4. Khung giao diện chung: header đỏ có logo, tên hệ thống, họ tên – vai trò, nút Đăng xuất; menu theo vai trò (SPEC mục 8).
5. Màn M01 đăng nhập theo mục 3 (kiểm tra đuôi email, thông báo lỗi, tài khoản khóa), chuyển trang theo vai trò;
   chặn truy cập trang của vai trò khác. Các trang đích tạm thời chỉ cần tiêu đề.
Lập kế hoạch trước. Khi code xong: chạy seed + start, đăng nhập thử cả 3 vai trò và 1 lần sai mật khẩu,
1 lần dùng email ngoài trường; thử mở trang QL bằng tài khoản SV. Ghi tài khoản mẫu vào README.md.
Chụp màn hình trang đăng nhập và khung giao diện, so với design/mockups/M01-dang-nhap.png và Q01-danh-sach-yeu-cau.png, báo lại kết quả kèm bằng chứng.
```
**Kiểm tra:** 3 tài khoản vào đúng 3 trang; email `@gmail.com` bị chặn; SV gõ đường dẫn trang QL bị báo không có quyền.

## Đợt 2 – Sinh viên
```
Đọc @SPEC.md mục 4 (bước 1, 2c), 6.1, 8 (S01, S02, S03), BR-09, BR-12.
Giao diện bám theo design/mockups/S01-*.png, S02-*.png, S02b-*.png, S03-*.png.
Làm ĐỢT 2: các màn S01 Yêu cầu của tôi, S02 Gửi yêu cầu mới, S03 Chi tiết yêu cầu cho Sinh viên.
- S02: chọn Nhà → Phòng → Thiết bị phụ thuộc nhau (dữ liệu lấy từ danh mục, chỉ mục đang sử dụng),
  dòng "Không có trong danh sách" thì bắt chọn loại thiết bị; mọi trường bắt buộc báo "Mục này không được để trống" ngay dưới ô;
  ảnh 1–3 tấm JPG/PNG ≤ 5MB có xem trước; cảnh báo trùng; khóa nút khi đang gửi; sinh mã YC-năm-số;
  gửi xong hiện cửa sổ nổi trên nền mờ đúng nội dung SPEC.
- S01: bảng, nhãn trạng thái màu theo tên hiển thị cho SV (mục 5), lọc, phân trang 10.
- S03: thông tin, ảnh phóng to, dòng tiến độ, nút Hủy chỉ khi trạng thái MOI (server cũng phải chặn).
Nút "In M.01" để đợt 6, giờ chỉ đặt nút ẩn.
Lập kế hoạch trước. Code xong: gửi thử 1 yêu cầu đủ trường, 1 lần bỏ trống, 1 lần ảnh 6MB, 1 lần trùng thiết bị; hủy 1 yêu cầu.
Báo kết quả kèm ảnh chụp.
```
**Kiểm tra:** gửi được, mã hiển thị đúng; bỏ trống thì báo lỗi tại ô; yêu cầu đã phân công không có nút Hủy.

## Đợt 3 – Quản lý xử lý yêu cầu
```
Đọc @SPEC.md mục 4, 5 (nhất là bảng 5.1), 7.3, 7.4, 8 (Q01, Q02), 11.
Giao diện bám theo design/mockups/Q01-*.png, Q01b-*.png, Q02-*.png.
Làm ĐỢT 3 cho Quản lý:
1. Module services/yeuCau.js chứa TOÀN BỘ logic chuyển trạng thái theo bảng 5.1 (kiểm tra vai trò, trạng thái hiện tại,
   trường bắt buộc), mỗi lần chuyển ghi lich_su_xu_ly, cập nhật thời gian, cập nhật tình trạng thiết bị theo mục 6.3,
   phân công theo BR-07 trong một transaction. Đợt này dùng các hành động của QL; KTV dùng ở đợt 4.
2. Q01: 5 ô số liệu bấm để lọc, thanh đếm "Theo nhà", bộ lọc (nhà chọn nhiều, trạng thái, mức độ, khoảng ngày + nút nhanh,
   tìm kiếm), sắp xếp, chế độ Danh sách / Theo nhà, dòng khẩn cấp nổi bật, chữ Quá hạn (BR-08), phân trang 15.
3. Q02: 3 khối như SPEC; khối xử lý hiện nút đúng theo trạng thái; hộp phân công gợi ý KTV theo mục 7.3;
   hạn mặc định theo BR-06; Từ chối / Làm lại bắt buộc lý do; Quay lại danh sách giữ bộ lọc.
Viết test tự động cho services/yeuCau.js: mọi dòng của bảng 5.1 chạy được, và vài chuyển trạng thái sai bị từ chối.
Lập kế hoạch trước. Code xong: chạy test, rồi bấm thử phân công 1 yêu cầu nhà D3 (KTV phụ trách D3 phải đứng đầu), từ chối 1 yêu cầu.
Báo kết quả test và ảnh chụp.
```
**Kiểm tra:** lọc D3 chỉ còn yêu cầu D3; phân công xong SV thấy "Đã tiếp nhận"; test chạy qua.

## Đợt 4 – Kỹ thuật viên, chạy trọn một vòng
```
Đọc @SPEC.md mục 4 (bước 3, 4a, 5a, 5c), 8 (K01, K02), BR-04.
Giao diện bám theo design/mockups/K01-*.png, K02-*.png.
Làm ĐỢT 4: màn K01 Việc được giao (nhóm theo nhà, tab, thẻ, hạn đỏ khi quá hạn) và K02 Chi tiết công việc
với nhánh "Đã khắc phục tại chỗ" (bảng nhiều dòng Nội dung sửa chữa · Số lượng · Ghi chú lưu vào noi_dung_sua_chua, ảnh sau sửa).
Nhánh "Không khắc phục tại chỗ" (biên bản M.04) để đợt 6, giờ hiện lựa chọn nhưng khóa lại.
Dùng lại services/yeuCau.js cho các hành động bat-dau, bao-ket-qua; QL nghiệm thu đạt / yêu cầu làm lại ở Q02.
KTV chỉ thấy việc có phân công đang hiệu lực của mình (chặn cả ở server).
Lập kế hoạch trước. Code xong: chạy lại toàn bộ test, rồi chạy tay kịch bản 1–4 ở SPEC mục 13.5
(đăng nhập lần lượt SV → QL → KTV → QL), báo kết quả từng bước kèm ảnh chụp.
```
**Kiểm tra:** chạy trọn vòng SV gửi → QL phân công → KTV báo xong → QL làm lại → KTV báo lại → QL nghiệm thu; thiết bị về "Hoạt động".

## Đợt 5 – Phân công, danh mục, KTV
```
Đọc @SPEC.md mục 6, 7, 8 (Q03, Q04, Q05), BR-10.
Giao diện bám theo design/mockups/Q03-*.png, Q04-*.png.
Làm ĐỢT 5:
- Q03 Bảng phân công: tab Khu vực phụ trách (sửa nhà phụ trách bằng ô đánh dấu, cảnh báo nhà chưa có KTV)
  và tab Công việc đã giao (lọc, bật xem bản ghi cũ).
- Q04 Danh mục CSVC 4 tab Nhà / Phòng / Loại thiết bị / Thiết bị: tìm kiếm, thêm, sửa, ngừng sử dụng hoặc xóa đúng mục 6.1;
  kiểm tra trùng mã; Hồ sơ thiết bị (thông tin cột 1–7 M.03 + lịch sử sửa chữa).
- Q05 Quản lý KTV: thêm (email @hust.edu.vn, mật khẩu ban đầu), sửa, khóa / mở khóa (không khóa KTV còn việc).
Lập kế hoạch trước. Code xong: thêm 1 nhà mới, 1 phòng, 1 thiết bị và kiểm tra chúng hiện ở form gửi của SV;
thử xóa 1 phòng đã có yêu cầu (phải bị chặn, chỉ cho ngừng sử dụng); đổi nhà phụ trách của 1 KTV và kiểm tra gợi ý phân công đổi theo.
Báo kết quả kèm ảnh chụp.
```
**Kiểm tra:** thiết bị mới xuất hiện ở form SV; phòng đã có yêu cầu không xóa được.

## Đợt 6 – Hoàn thiện theo quy trình QT.06
```
Đọc @SPEC.md mục 4 (bước 4b, 5b, 6), 5, 6.3, 8 (Q02, Q06, K02), 9, BR-14, BR-15 và xem mẫu M.01, M.02, M.04
trong @docs/QT06-quy-trinh-sua-chua.pdf (trang 10, 11, 13) cùng design/phieu-yeu-cau-mau.png.
Giao diện bám theo design/mockups/Q02b-*.png, Q06-*.png, P01-*.png.
Làm ĐỢT 6:
1. Nhánh "Không khắc phục tại chỗ": form biên bản kiểm tra kỹ thuật ở K02, QL "Duyệt biên bản & chuyển phương án",
   trạng thái CHUYEN_XU_LY, QL "Đóng yêu cầu"; cập nhật thiết bị theo 6.3. Bổ sung test cho các chuyển trạng thái mới.
2. Q06 Sổ tiếp nhận thông báo sự cố (M.02): truy vấn trực tiếp, lọc, nút In sổ, Xuất Excel.
3. Trang in A4 cho M.01 (2 phần), M.02 (khổ ngang), M.04, bố cục giống mẫu giấy, đầu trang "ĐẠI HỌC BÁCH KHOA HÀ NỘI",
   góc phải ghi ký hiệu mẫu; dùng CSS @media print, nút In gọi window.print(). Bật các nút In ở S03, Q02, K02, Q04.
4. Rà giao diện điện thoại (bảng thành thẻ khi màn hình hẹp).
Lập kế hoạch trước. Code xong: chạy test, chạy tay kịch bản 5 và 6 ở SPEC 13.5, in thử ra PDF cả 3 mẫu
và đặt cạnh mẫu giấy để so; chụp màn hình giao diện ở bề rộng 390px. Báo kết quả kèm bằng chứng.
```
**Kiểm tra:** in ra PDF giống mẫu giấy; kịch bản điều hòa C7 chạy hết đến "Hoàn thành".

## Rà soát cuối
```
Dùng một subagent rà soát toàn bộ code so với @SPEC.md: mọi dòng bảng 5.1, mọi quy tắc BR-01 đến BR-15,
mọi màn hình ở mục 8, mọi kịch bản ở 13.5. Chỉ báo những chỗ sai hoặc thiếu so với SPEC
(kèm file, dòng, cách tái hiện), không góp ý phong cách. Sau đó sửa các lỗi đó, chạy lại test và kịch bản.
```

---

## Mẫu prompt khi gặp lỗi
```
Lỗi: [mô tả bạn thấy gì, ở màn hình nào, đăng nhập bằng tài khoản nào, bấm gì].
Mong muốn: [đúng ra phải thế nào, dẫn mục SPEC nếu có].
Tìm nguyên nhân gốc, sửa, rồi tái hiện lại đúng các bước trên để chứng minh đã hết lỗi.
```
