# Điều khiển cửa cuốn bằng Siri (iOS)

Hướng dẫn tạo Siri Shortcuts để điều khiển cửa cuốn bằng giọng nói trên iPhone/iPad mà không cần mở app.

## Yêu cầu

- iPhone/iPad với iOS 13 trở lên
- App **Shortcuts** (có sẵn trên iOS, tìm trong App Library nếu chưa thấy)
- Cửa cuốn đã được deploy và hoạt động (Cloudflare Worker + ESP32 online)
- Biết **Worker URL** và **PIN** của hệ thống

---

## Tạo Shortcut "Mở cửa cuốn"

### Bước 1: Mở app Shortcuts

Tìm app **Shortcuts** (biểu tượng hình vuông màu cam) và mở lên.

### Bước 2: Tạo shortcut mới

Nhấn dấu **+** ở góc trên phải.

### Bước 3: Thêm action

1. Nhấn **Add Action**
2. Tìm kiếm **"Get Contents of URL"** (hoặc "URL" rồi chọn "Get Contents of URL")
3. Nhấn vào action đó để thêm vào

### Bước 4: Cấu hình request

Nhấn vào action vừa thêm để mở rộng, sau đó cấu hình:

| Trường | Giá trị |
|--------|---------|
| URL | `https://YOUR-WORKER.workers.dev` |
| Method | `POST` |

Nhấn **Show More** để hiện thêm tuỳ chọn:

- **Headers**: Thêm header mới:
  - Key: `Content-Type`
  - Value: `application/json`

- **Request Body**: Chọn **JSON**, sau đó thêm 2 trường:
  - `pin` → `1234` *(thay bằng PIN thật của bạn)*
  - `cmd` → `OPEN`

### Bước 5: Đặt tên shortcut

Nhấn vào tên shortcut ở trên cùng (mặc định là "New Shortcut"), đổi thành:

```
Mở cửa cuốn
```

> **Quan trọng:** Tên shortcut phải khớp với câu bạn sẽ nói với Siri. Siri sẽ tự nhận ra "Hey Siri, mở cửa cuốn".

### Bước 6: Lưu

Nhấn **Done** ở góc trên phải.

### Bước 7: Test

Nói: **"Hey Siri, mở cửa cuốn"**

Siri sẽ chạy shortcut và cửa sẽ mở.

---

## Tạo Shortcut "Dừng cửa cuốn"

Lặp lại các bước trên với:
- `cmd` → `STOP`
- Tên shortcut: `Dừng cửa cuốn`

Test: **"Hey Siri, dừng cửa cuốn"**

---

## Tạo Shortcut "Đóng cửa cuốn"

Lặp lại các bước trên với:
- `cmd` → `CLOSE`
- Tên shortcut: `Đóng cửa cuốn`

Test: **"Hey Siri, đóng cửa cuốn"**

---

## Thêm Shortcut vào màn hình chính (tuỳ chọn)

Để tạo icon riêng trên Home Screen:

1. Mở shortcut → nhấn **⋯** (ba chấm) ở góc trên phải
2. Nhấn **Add to Home Screen**
3. Đặt tên và chọn icon
4. Nhấn **Add**

---

## Chia sẻ với thành viên gia đình

Mỗi người cần tự tạo shortcut trên máy của mình. Không share file shortcut vì shortcut chứa PIN.

Cách nhanh nhất: gửi hướng dẫn này cho từng người, họ tự tạo trong 2 phút.

---

## Lưu ý bảo mật

> ⚠️ **Shortcut chứa PIN** — coi như credential, không share file shortcut với người ngoài.

- Nếu đổi PIN trong hệ thống, phải cập nhật lại tất cả shortcuts của mọi người
- Shortcut chỉ hoạt động khi điện thoại có internet (Wi-Fi hoặc mobile data)
- Nếu ESP32 offline, Worker sẽ trả lỗi nhưng Siri vẫn báo "Done" — kiểm tra trạng thái thiết bị trong app

---

## Troubleshooting

| Vấn đề | Nguyên nhân | Cách sửa |
|--------|-------------|----------|
| Siri không nhận ra shortcut | Tên shortcut không khớp | Đổi tên shortcut cho đúng câu nói |
| Shortcut chạy nhưng cửa không mở | Worker URL sai hoặc ESP32 offline | Kiểm tra URL và trạng thái ESP32 |
| Lỗi "Unauthorized" | PIN sai | Kiểm tra lại PIN trong shortcut |
| Lỗi "Rate limit exceeded" | Gửi quá 10 lệnh/phút | Đợi 1 phút rồi thử lại |
| Shortcut không chạy trên Apple Watch | Cần enable trong Watch app | Mở Watch app → My Watch → Shortcuts → bật shortcut |

---

## Google Assistant (Android)

Xem hướng dẫn trong `pwa/README.md` phần **Voice Control — Android**.
