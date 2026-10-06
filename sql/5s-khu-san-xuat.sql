-- ═══════════════════════════════════════════════════════════════
-- 5S: THÊM KHU "SẢN XUẤT" VÀO KHU VỰC KHÁC
-- Chạy 1 lần: Supabase → SQL Editor → New query → dán → Run
-- Cần chạy SAU sql/5s-ky-thuat-khu-vuc.sql. Chạy lại nhiều lần không sao.
-- ═══════════════════════════════════════════════════════════════
-- Ô khu Sản xuất (cell_id kv_sx) KHÔNG cần SQL - đã có sẵn trong web.
-- File này chỉ mở thêm nhóm 'SX' cho danh sách người phụ trách 5S (bảng
-- s5_nguoi), trước đây chỉ nhận KT / QC / DG.
alter table public.s5_nguoi drop constraint if exists s5_nguoi_nhom_check;
alter table public.s5_nguoi add constraint s5_nguoi_nhom_check
  check (nhom in ('KT','QC','DG','SX'));   -- Kỹ thuật / QC / Đóng gói / Sản xuất
