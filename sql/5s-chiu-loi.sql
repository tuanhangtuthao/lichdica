-- ═══════════════════════════════════════════════════════════════
-- 5S: CHỌN AI CHỊU LỖI KHI MÁY CÓ KỸ THUẬT (Thợ / Kỹ thuật / Cả hai)
-- Chạy 1 lần: Supabase → SQL Editor → New query → dán → Run
-- Cần chạy SAU sql/5s-ky-thuat-khu-vuc.sql. Chạy lại nhiều lần không sao.
-- ═══════════════════════════════════════════════════════════════
-- 'kt'     = kỹ thuật chịu lỗi (mặc định khi có kỹ thuật)
-- 'tho'    = thợ chịu lỗi dù có kỹ thuật đang dùng máy
-- 'ca_hai' = tính cho cả hai
-- ''       = lượt cũ / không có kỹ thuật. Có kỹ thuật mà để trống = coi như 'kt'
-- Cách đọc nằm ở chiuLoiCua / dsNguoiChiu5S trong 5s-tieu-chi.js.
alter table public.s5_checks add column if not exists chiu_loi text not null default '';
alter table public.s5_checks drop constraint if exists s5_checks_chiu_loi_hop_le;
alter table public.s5_checks add constraint s5_checks_chiu_loi_hop_le
  check (chiu_loi in ('', 'kt', 'tho', 'ca_hai'));
comment on column public.s5_checks.chiu_loi is 'Máy có kỹ thuật: ai chịu lỗi 5S - kt / tho / ca_hai (trống = kt)';

-- KIỂM TRA: phải ra 1 dòng chiu_loi
--   select column_name from information_schema.columns
--   where table_name = 's5_checks' and column_name = 'chiu_loi';
