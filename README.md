# School Incident Reporting and Management System

Hệ thống báo cáo & sửa chữa trang thiết bị trường học (bản demo giao diện) – Đại học Bách khoa Hà Nội.

## Nội dung
Trang web một tệp (`index.html`), gồm 4 màn hình nối với nhau bằng hash router:

1. **Splash** – trang giới thiệu theo mẫu (dải đỏ + logo + ảnh sân trường).
2. **Đăng nhập** – đăng nhập bằng email trường hoặc tài khoản/mật khẩu (bản demo: nhập bất kỳ).
3. **Màn hình chính** – thanh menu, thông báo, tài khoản; nội dung để trắng.
4. **Yêu cầu xử lý sự cố** (Hỗ trợ → Yêu cầu xử lý sự cố) – phiếu đề nghị sửa chữa theo biểu mẫu, bảng nội dung hư hỏng và ô tải ảnh hiện trạng.

Toàn bộ logo và ảnh nền được nhúng sẵn (data URI) nên `index.html` chạy độc lập, không cần tệp ngoài.

## Chạy thử
Mở `index.html` bằng trình duyệt, hoặc bật GitHub Pages (Settings → Pages → branch `main`, thư mục `/root`).

## Ghi chú
Đây là bản demo giao diện phục vụ nội bộ trường, logic đăng nhập/gửi phiếu chạy phía client (chưa có backend).
