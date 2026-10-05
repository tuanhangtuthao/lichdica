-- ═══════════════════════════════════════════════════════════════
-- 5S: KỸ THUẬT ĐANG DÙNG MÁY + KHU VỰC QC / KỸ THUẬT / ĐÓNG GÓI
-- Chạy 1 lần: Supabase → SQL Editor → New query → dán → Run
-- Chạy lại nhiều lần cũng không sao (đều có "if not exists").
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Kỹ thuật đang dùng máy ─────────────────────────────────
-- Máy có kỹ thuật đang dùng thì lỗi 5S tính cho KỸ THUẬT, thợ không bị tính
-- (xem nguoiChiu5S trong 5s-tieu-chi.js). Để trống = máy do thợ đứng như thường.
alter table public.s5_checks add column if not exists tech_name text not null default '';
alter table public.s5_checks add column if not exists tech_id   text not null default '';
comment on column public.s5_checks.tech_name is 'Kỹ thuật đang dùng máy lúc kiểm. Có giá trị = lỗi 5S tính cho kỹ thuật, không tính cho thợ';
comment on column public.s5_checks.tech_id   is 'MSNV của kỹ thuật (nếu có)';

-- ── 2. Danh sách người chỉ dùng cho 5S ────────────────────────
-- Kỹ thuật, QC, đóng gói không có trong bảng employees (bảng đó là thợ Phân
-- Xưởng 1 + hành chính, dùng cho lịch ca và đánh giá). Để riêng ở đây để KHÔNG
-- hiện lên lịch ca / trang Đánh giá. Thêm/sửa ngay trong trang 5S.
-- Lưu ý: bot Zalo chỉ liên kết với bảng employees, nên chưa nhắn báo 5S được
-- cho người trong bảng này.
create table if not exists public.s5_nguoi (
  id         bigserial primary key,
  ten        text not null check (btrim(ten) <> ''),
  msnv       text not null default '',
  nhom       text not null check (nhom in ('KT','QC','DG')),   -- Kỹ thuật / QC / Đóng gói
  created_at timestamptz not null default now()
);
alter table public.s5_nguoi enable row level security;
drop policy if exists s5_nguoi_anon_all on public.s5_nguoi;
create policy s5_nguoi_anon_all on public.s5_nguoi
  for all to anon using (true) with check (true);

-- ── 3. Khu vực QC / Kỹ thuật / Đóng gói ───────────────────────
-- KHÔNG cần bảng mới: mỗi khu là một "ô" trong s5_checks với cell_id kv_qc,
-- kv_kt, kv_dg; người phụ trách lưu ở worker_name / worker_id như thợ đứng máy.
-- Tiêu chí của khu nằm ở S_DEFS_KHU trong 5s-tieu-chi.js.

-- ── KIỂM TRA SAU KHI CHẠY ─────────────────────────────────────
--   select column_name from information_schema.columns
--   where table_name = 's5_checks' and column_name like 'tech%';      -- phải ra 2 dòng
--   select count(*) from public.s5_nguoi;                               -- phải chạy được
