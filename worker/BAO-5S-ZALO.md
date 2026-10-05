# Bot Zalo tự báo khi nhân viên bị 5S chưa đạt — ĐẶC TẢ

Chốt và triển khai 05/10/2026. Code: `worker/bao-5s.js` (Cron 5 phút + báo bù), gọi từ `worker/index.js`. Bảng đánh dấu: `sql/zalo-bao-5s.sql` (đã chạy). Mốc bật: lượt kiểm từ `2026-10-05T04:00Z` trở đi mới được báo tức thì (`BAT_DAU` trong bao-5s.js); lượt trước đó chỉ đến tay nhân viên qua báo bù.

## Đã chốt
- **Người nhận: chỉ chính nhân viên bị đánh giá, nhắn riêng.** Không gửi nhóm, không gửi trưởng ca.
- Chỉ báo lượt **chưa đạt** (có mục `!== true`, cùng công thức với rating.html / menu).
- Không qua AI → không tốn tiền key.

## Cách chạy (đề xuất)
- Cloudflare Cron Trigger chạy **5 phút/lần**: tìm lượt chưa đạt mới, `checked_at` cách đây ≥ 5 phút (để người kiểm kịp sửa nếu chấm nhầm), chưa báo → gửi → đánh dấu đã báo.
- Đánh dấu ở **bảng riêng** (vd `zalo_da_bao_5s`, khoá = `s5_checks.id`), KHÔNG ghi vào `s5_checks`: từ khi siết RLS (`sql/5s-siet-rls.sql`), khoá anon chỉ được đọc `s5_checks`. Cần 1 câu SQL tạo bảng.
- Tìm người nhận: `s5_checks.worker_id` → `zalo_links.msnv` → `chat_id = zalo_id`. Bản ghi cũ chưa có `worker_id` thì khớp theo tên.

## Mẫu tin (kèm ảnh nếu có — sendPhoto, caption ≤ 2000 ký tự)
```
⚠️ Bạn có 1 lượt 5S CHƯA ĐẠT
📅 Thứ 2, 05/10 – Ca Sáng – 08:40
🔧 Máy T-10
❌ Mục: Rổ đựng hàng
📝 <ghi chú của người kiểm>
👤 Người kiểm: Hữu

Nhắn 0 để xem menu.
```
Nhiều ảnh: gửi ảnh đầu kèm chữ, các ảnh sau gửi tiếp.

## Nhân viên chưa liên kết → BỎ QUA (chốt 05/10/2026)
Ban đầu định báo trưởng ca thay, sau đó **bỏ**. Người chưa liên kết thì lúc bị đánh giá không ai nhận tin; các lượt đó chờ **báo bù** khi họ liên kết (mục dưới).

## Báo bù khi liên kết (chốt 05/10/2026)
Ngay khi nhân viên xác nhận liên kết (nhắn 1), gửi thêm **1 tin gộp** sau menu, liệt kê các lượt chưa đạt **chưa từng báo cho chính họ**:
```
📋 Bạn có <n> lượt 5S chưa đạt tháng <mm> chưa được báo:
• <dd/mm> – máy <mã> – <mục>
…
Nhắn 3 để xem chi tiết.
```
Không gửi ảnh từng lượt (tránh dội tin). Gửi xong đánh dấu các lượt đó "đã báo nhân viên". Không có lượt nào thì không gửi gì.

## Phạm vi báo bù (chốt)
- Chỉ lấy **tháng hiện tại**. Quản lý (đang ở menu quản lý) được nhắc "Nhắn 13 rồi 3" thay vì "Nhắn 3".

## ĐÃ GIẢI QUYẾT
1. Nhân viên chưa liên kết → **bỏ qua** (đã bỏ phương án báo trưởng ca).
2. ~~Zalo có cho bot tự nhắn trước không?~~ **Đã thử 05/10/2026: ĐƯỢC.** `sendPhoto` (ảnh lượt T-10 + caption chữ trơn, 273 ký tự) gửi chủ động tới tài khoản đã liên kết → Zalo trả `ok`. Chờ chủ dự án xác nhận hiển thị.
3. Lượt cũ → **báo bù khi nhân viên liên kết** (xem trên), không gửi hàng loạt lúc bật tính năng.
