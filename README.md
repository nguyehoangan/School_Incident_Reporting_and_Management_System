# School Incident Reporting and Management System

Hệ thống báo cáo & sửa chữa trang thiết bị trường học (bản demo giao diện) – Đại học Bách khoa Hà Nội.

## Nội dung
Toàn bộ trang nằm trong **một tệp `index.html` tự chứa** (logo và ảnh nền được nhúng sẵn dạng data URI), nên chạy đúng ở bất kỳ đâu – mở trực tiếp, Live Server hay GitHub Pages – mà không cần tệp ảnh ngoài.

Gồm 4 màn hình nối nhau bằng hash router:

1. **Splash** – trang giới thiệu (dải đỏ + logo + ảnh sân trường).
2. **Đăng nhập** – đăng nhập bằng email trường hoặc tài khoản/mật khẩu (bản demo: nhập bất kỳ).
3. **Màn hình chính** – thanh menu, thông báo, tài khoản; nội dung để trắng.
4. **Yêu cầu xử lý sự cố** (Hỗ trợ → Yêu cầu xử lý sự cố) – phiếu đề nghị sửa chữa theo biểu mẫu, bảng nội dung hư hỏng và ô tải ảnh hiện trạng.

## Chạy thử
- Mở `index.html` bằng trình duyệt hoặc Live Server.
- Hoặc bật **GitHub Pages**: Settings → Pages → branch `main`, thư mục `/ (root)` → link công khai.

## Ghi chú
Bản demo giao diện phục vụ nội bộ trường; logic đăng nhập/gửi phiếu chạy phía client (chưa có backend).
