# Bot Zalo tự báo khi nhân viên bị 5S chưa đạt — ĐẶC TẢ, CHƯA LÀM CODE

Chốt ngày 05/10/2026.

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

## CÒN CHỜ XÁC NHẬN
1. Nhân viên **chưa liên kết bot** (chưa từng nhắn MSNV) thì bot không nhắn được. Bỏ qua, hay báo trưởng ca thay?
2. ~~Zalo có cho bot tự nhắn trước không?~~ **Đã thử 05/10/2026: ĐƯỢC.** `sendPhoto` (ảnh lượt T-10 + caption chữ trơn, 273 ký tự) gửi chủ động tới tài khoản đã liên kết → Zalo trả `ok`. Chờ chủ dự án xác nhận hiển thị.
3. Lượt cũ (trước khi bật tính năng) có báo bù không? Đề xuất: **không**, chỉ báo lượt từ lúc bật.
