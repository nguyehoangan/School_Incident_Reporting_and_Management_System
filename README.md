# Hệ thống báo hỏng & sửa chữa CSVC

Bài tập lớn ET3260 – Nhóm 4. Web cho 3 vai trò: **Sinh viên** báo hỏng thiết bị phòng học, **Quản lý** tiếp nhận / phân công / nghiệm thu, **Kỹ thuật viên** kiểm tra và sửa. Đặc tả đầy đủ trong [`SPEC.md`](SPEC.md).

Công nghệ: Node.js + Express, SQLite (`better-sqlite3`), giao diện EJS + CSS thuần, `express-session`, `bcrypt`.

## Chạy thử

Cần Node.js ≥ 18.

```bash
npm install
npm run seed     # xóa và tạo lại CSDL data/csvc.db + dữ liệu mẫu
npm start        # http://localhost:3000
```

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

## Cấu trúc

```
app.js               máy chủ Express
db/schema.sql        12 bảng theo SPEC mục 10
db/index.js          kết nối SQLite
lib/                 hằng số (vai trò, trạng thái), giờ Việt Nam, menu theo vai trò
middleware/auth.js   phiên đăng nhập, chặn truy cập theo vai trò (ở server)
routes/              đăng nhập + trang của SV / QL / KTV
views/               giao diện EJS
public/              CSS, JS phía trình duyệt
scripts/seed.js      tạo dữ liệu mẫu
uploads/             ảnh đính kèm (ảnh mẫu sinh ở uploads/seed/)
design/, docs/       ảnh giao diện mẫu, sơ đồ, quy trình QT.06
```

## Tiến độ

- [x] Đợt 1: CSDL, dữ liệu mẫu, khung giao diện, đăng nhập và chuyển trang theo vai trò
- [ ] Đợt 2–6: xem `PROMPTS.md`

Thư mục `frontend/`, `backend/` và `index.html` ở gốc là bản thử giao diện tĩnh cũ (chạy trên GitHub Pages), không dùng cho ứng dụng này.
