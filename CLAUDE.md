# Hệ thống báo hỏng & sửa chữa CSVC (BTL ET3260 – Nhóm 4)

Web cho 3 vai trò: Sinh viên báo hỏng thiết bị, Quản lý tiếp nhận / phân công / nghiệm thu, Kỹ thuật viên kiểm tra và sửa.
**Mọi yêu cầu nghiệp vụ nằm trong `SPEC.md`. Làm đúng SPEC; chỗ nào SPEC chưa rõ thì hỏi, không tự bịa thêm chức năng.**

## Tài liệu
- `SPEC.md`: đặc tả đầy đủ (vai trò, máy trạng thái mục 5, danh mục CSVC mục 6, màn hình mục 8, biểu mẫu mục 9, CSDL mục 10, quy tắc BR-xx mục 11).
- `docs/state.svg`, `docs/erd.svg`: sơ đồ trạng thái và sơ đồ CSDL.
- `docs/QT06-quy-trinh-sua-chua.pdf`: quy trình gốc và mẫu giấy M.01, M.02, M.04 (bản scan, dùng khi làm trang in).
- `design/`: ảnh giao diện mẫu (phong cách web HUST) và logo, ảnh nền.
- `design/mockups/`: ảnh minh họa từng màn hình, tên file theo mã màn hình trong SPEC mục 8 (M01, S01…, Q01…, K01…, P01 = trang in M.01). Dựng giao diện bám theo các ảnh này.

## Công nghệ
- Node.js + Express, SQLite qua `better-sqlite3`, giao diện EJS + CSS thuần (không dùng framework CSS), `express-session`, `bcrypt`, `multer` (ảnh lưu ở `uploads/`).
- Chạy: `npm install` → `npm run seed` (tạo lại CSDL + dữ liệu mẫu) → `npm start` → http://localhost:3000
- Toàn bộ chữ trên giao diện bằng tiếng Việt. Giờ Việt Nam, hiển thị `dd/mm/yyyy HH:mm`.

## Quy tắc code
- Tên bảng / cột / mã trạng thái đúng như SPEC mục 5 và 10 (tiếng Việt không dấu, snake_case).
- Kiểm tra quyền và chuyển trạng thái **ở server** theo bảng SPEC 5.1; mọi chuyển trạng thái ghi một dòng `lich_su_xu_ly`. Gom logic chuyển trạng thái vào một module duy nhất (`services/yeuCau.js`).
- Danh mục đã được tham chiếu thì chỉ "ngừng sử dụng", không xóa (BR-10).
- Giao diện: bám theo `design/mockups/<mã màn hình>.png`; header đỏ HUST có `design/logoBK.webp`, ảnh nền đăng nhập `design/background.webp`. Dùng được trên điện thoại.
- Không thêm chức năng ngoài phạm vi (SPEC mục 1: trang chủ, avatar, thông báo, thống kê… để sau).

## Kiểm tra trước khi báo xong
- Chạy `npm run seed && npm start`, đăng nhập bằng tài khoản mẫu và bấm thử đúng luồng vừa làm.
- Có trình duyệt thì chụp màn hình, so với ảnh trong `design/` và nêu chỗ khác.
- Báo lại bằng chứng (lệnh đã chạy, kết quả, ảnh chụp), không chỉ nói "đã xong".

## Git
- Commit sau mỗi đợt, message tiếng Việt ngắn gọn mô tả việc đã làm.
- KHÔNG thêm dòng `Co-Authored-By: Claude` hay "Generated with Claude Code" vào commit / PR.
- Trước mỗi lần commit, chạy: git config user.name "BonLonTon" && git config user.email "114303202+nguyehoangan@users.noreply.github.com"
