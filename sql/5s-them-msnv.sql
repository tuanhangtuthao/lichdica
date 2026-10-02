-- ═══════════════════════════════════════════════════════════════
-- THÊM MSNV VÀO LƯỢT KIỂM 5S
-- Chạy SAU 5s-tieu-chi-moi-5-muc.sql, 1 lần, Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- Trước giờ chỉ lưu tên thợ. Nhân sự tra theo mã chắc hơn theo tên vì tên
-- có thể trùng hoặc gõ khác dấu.
alter table public.s5_checks
  add column if not exists worker_id text not null default '';

-- Điền MSNV cho dữ liệu cũ bằng cách dò theo tên.
-- btrim + lower để không trượt vì khác hoa thường hay thừa khoảng trắng.
-- Dòng nào không dò ra thì để trống, KHÔNG đoán bừa - có những ô ghi
-- "thiếu nhân sự", "máy hư", hoặc người thời vụ không có trong danh sách.
update public.s5_checks s
   set worker_id = e.id
  from public.employees e
 where s.worker_id = ''
   and btrim(lower(s.worker_name)) = btrim(lower(e.name));

create index if not exists s5_checks_worker_id_idx
  on public.s5_checks (worker_id, date desc);

-- ── KIỂM TRA ──────────────────────────────────────────────────
-- Xem điền được bao nhiêu dòng:
--   select count(*) filter (where worker_id <> '') as co_msnv,
--          count(*) filter (where worker_id =  '') as chua_co,
--          count(*) as tong
--     from public.s5_checks;
--
-- Xem những tên không dò ra MSNV (để biết có cần sửa tay không):
--   select distinct worker_name from public.s5_checks
--    where worker_id = '' order by worker_name;
