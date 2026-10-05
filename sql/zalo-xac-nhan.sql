-- ═══════════════════════════════════════════════════════════════
-- BOT ZALO: XÁC NHẬN TÊN KHI LIÊN KẾT MSNV
-- Chạy SAU zalo-menu.sql, 1 lần, Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════
-- Nhắn MSNV xong, bot hỏi "Bạn là <tên>?" và chỉ liên kết khi trả lời 1.
-- Trong lúc chờ, MSNV nằm ở msnv_cho; msnv chỉ có giá trị khi đã xác
-- nhận. Người chưa liên kết bao giờ thì msnv để trống (NULL).

alter table public.zalo_links alter column msnv drop not null;
alter table public.zalo_links add column if not exists msnv_cho text;
