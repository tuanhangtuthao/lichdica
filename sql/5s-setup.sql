-- ═══════════════════════════════════════════════════════════════
-- CÀI ĐẶT CHO TRANG KIỂM TRA 5S  (5s.html)
-- Chạy 1 lần trên Supabase → SQL Editor → New query → Run
-- ═══════════════════════════════════════════════════════════════

-- ── 1. BẢNG LƯU KẾT QUẢ 5S ────────────────────────────────────
create table if not exists public.s5_checks (
  id            bigserial primary key,
  date          date        not null,
  cell_id       text        not null,   -- vị trí ô trên sơ đồ: "zone_hàng_cột"
  machine_code  text        not null,   -- mã máy lúc chấm, giữ lại để tra cứu sau
  s1            boolean     not null default false,  -- Sàng lọc
  s2            boolean     not null default false,  -- Sắp xếp
  s3            boolean     not null default false,  -- Sạch sẽ
  s4            boolean     not null default false,  -- Săn sóc
  s5            boolean     not null default false,  -- Sẵn sàng
  note          text        not null default '',
  photos        jsonb       not null default '[]'::jsonb,
  inspector     text        not null default '',
  updated_at    timestamptz not null default now(),

  -- Khoá này là thứ cho phép dùng upsert: mỗi ngày mỗi ô chỉ 1 dòng.
  -- Nhờ nó, lưu 1 máy chỉ đụng đúng dòng đó, không xoá dữ liệu người khác
  -- đang chấm cùng lúc (trang Nhân Sự Ca đang xoá-rồi-ghi-lại cả ngày,
  -- hai người lưu cùng lúc là mất dữ liệu của nhau).
  constraint s5_checks_date_cell_uniq unique (date, cell_id)
);

-- Tra theo ngày là truy vấn chính của trang
create index if not exists s5_checks_date_idx on public.s5_checks (date);
-- Tra lịch sử 1 máy để xem máy nào hay tái phạm
create index if not exists s5_checks_machine_idx on public.s5_checks (machine_code, date desc);

-- ── 2. QUYỀN TRUY CẬP ─────────────────────────────────────────
-- Mở cho anon giống các bảng đang dùng (shift_roster, factory_layout).
-- LƯU Ý: ai có link web cũng ghi được. Nếu sau này cần siết, xem mục 4.
alter table public.s5_checks enable row level security;

drop policy if exists s5_checks_anon_all on public.s5_checks;
create policy s5_checks_anon_all on public.s5_checks
  for all to anon using (true) with check (true);

-- ── 3. KHO ẢNH ────────────────────────────────────────────────
-- Tạo bucket công khai để <img src> đọc được trực tiếp.
insert into storage.buckets (id, name, public)
values ('s5-photos', 's5-photos', true)
on conflict (id) do update set public = true;

drop policy if exists s5_photos_read  on storage.objects;
drop policy if exists s5_photos_write on storage.objects;

create policy s5_photos_read on storage.objects
  for select to anon, authenticated using (bucket_id = 's5-photos');

create policy s5_photos_write on storage.objects
  for insert to anon, authenticated with check (bucket_id = 's5-photos');

-- ── 4. (TUỲ CHỌN) SIẾT QUYỀN SAU NÀY ──────────────────────────
-- Muốn cho xem nhưng chỉ người có mật khẩu mới ghi, thì thay policy ở
-- mục 2 bằng 2 policy dưới đây (bỏ dấu ghi chú), và trang web phải gọi
-- check_app_password trước khi lưu — giống nút sửa sơ đồ bên Nhân Sự Ca.
--
-- drop policy if exists s5_checks_anon_all on public.s5_checks;
-- create policy s5_checks_read on public.s5_checks
--   for select to anon using (true);
-- create policy s5_checks_write on public.s5_checks
--   for all to authenticated using (true) with check (true);

-- ── KIỂM TRA ──────────────────────────────────────────────────
-- Chạy xong 2 câu này phải ra kết quả, không báo lỗi:
--   select * from public.s5_checks limit 1;
--   select id, public from storage.buckets where id = 's5-photos';
