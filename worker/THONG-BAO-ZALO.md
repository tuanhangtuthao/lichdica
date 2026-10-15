# Thông báo chung của phân xưởng qua bot Zalo

Code: `worker/thong-bao.js`. Bảng: `sql/zalo-thong-bao.sql` (chạy 1 lần trên Supabase).

## Ai dùng được
Chỉ **Trưởng Phòng** và **Tổ Trưởng** (`duocThongBao` trong `du-lieu.js`). Trưởng Ca và nhân viên gõ lệnh sẽ được báo là không có quyền.

## Cách dùng (nhắn cho bot)
| Lệnh | Gửi cho |
|---|---|
| `thông báo: nội dung` | cả xưởng |
| `thông báo kíp 2: nội dung` | chỉ kíp 2 |
| `thông báo kíp 1,3: nội dung` | kíp 1 và 3 (kíp 4 = Hành Chính / Ca Xoay) |
| `thông báo` | xem hướng dẫn |

Bot đọc lại nội dung và số người nhận, rồi hỏi:
`1️⃣ Gửi ngay · 2️⃣ Huỷ`. Bản nháp hết hạn sau 15 phút; gõ bất cứ tin nào khác cũng là bỏ bản nháp.

Người nhận thấy:
```
📢 THÔNG BÁO PHÂN XƯỞNG 1 – Thứ 4, 07/10

<nội dung>

— Tổ Trưởng Quách Viết Tỉnh
```

## Giới hạn
- Chỉ tới được người **đã liên kết MSNV** với bot; bot nói rõ "X người chưa liên kết nên không nhận được". Chính người gửi không nhận lại.
- Nội dung tối đa 1500 ký tự.
- Cloudflare gói miễn phí chỉ cho ~50 lệnh gọi mạng mỗi lần chạy, nên mỗi lần gửi tối đa **25 người**. Còn dư thì cron 5 phút gửi tiếp lô sau, xong bot báo lại cho người gửi `✅ Đã gửi X/Y người` (kèm tên những người Zalo từ chối).
- Chưa có hẹn giờ / lặp lại: chỉ gửi ngay.
