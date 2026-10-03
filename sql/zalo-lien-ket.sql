-- ═══════════════════════════════════════════════════════════════
-- BẢNG LIÊN KẾT TÀI KHOẢN ZALO -> MSNV  (cho bot Zalo, xem worker/README.md)
-- Chạy 1 lần trên Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════
-- Lần đầu nhân viên nhắn bot, bot hỏi MSNV rồi lưu lại ở đây; từ đó bot
-- biết tài khoản Zalo này là ai mà không cần hỏi lại.
--
-- so_cau / ngay_dem: đếm số câu hỏi trong ngày để chặn spam (mỗi câu là
-- một lần gọi Claude API, tốn tiền). Giới hạn nằm ở worker/du-lieu.js.

create table if not exists public.zalo_links (
  zalo_id     text        primary key,              -- message.from.id của Zalo
  msnv        text        not null,
  ten_zalo    text        not null default '',      -- tên hiển thị Zalo, để dễ đối chiếu
  so_cau      int         not null default 0,
  ngay_dem    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists zalo_links_msnv_idx on public.zalo_links (msnv);

-- Quyền: mở cho anon giống các bảng đang dùng, vì worker gọi bằng khoá anon.
-- LƯU Ý: đây là mức bảo mật đã chọn ("chỉ cần MSNV, giống web") - ai nhắn
-- bot và gõ MSNV người khác thì xem được dữ liệu người đó.
alter table public.zalo_links enable row level security;
drop policy if exists zalo_links_anon_all on public.zalo_links;
create policy zalo_links_anon_all on public.zalo_links
  for all to anon using (true) with check (true);

-- ── KIỂM TRA ──────────────────────────────────────────────────
-- Ai đã liên kết:
--   select z.ten_zalo, z.msnv, e.name, z.so_cau, z.ngay_dem
--     from public.zalo_links z left join public.employees e on e.id = z.msnv
--    order by z.updated_at desc;
