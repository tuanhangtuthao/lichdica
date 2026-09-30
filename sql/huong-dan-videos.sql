-- ═══════════════════════════════════════════════════════════════
-- BẢNG VIDEO HƯỚNG DẪN
-- Để tự thêm/sửa/xoá video ngay trên trang, không phải sửa mã nguồn.
-- Chạy 1 lần trên Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.huong_dan_videos (
  id          bigserial   primary key,
  drive_id    text        not null,                 -- id file trên Google Drive
  ten         text        not null,
  nhom        text        not null default 'Khác',  -- thư mục / nhóm, dùng để gom và lọc
  mota        text        not null default '',
  thoiluong   text        not null default '',
  sort_order  int         not null default 0,       -- số nhỏ hiện trước
  created_at  timestamptz not null default now()
);

create index if not exists huong_dan_videos_thu_tu_idx
  on public.huong_dan_videos (nhom, sort_order, id);

-- Quyền: mở cho anon giống các bảng đang dùng.
-- LƯU Ý: ô mật khẩu trên trang chỉ chặn thao tác trên giao diện, KHÔNG
-- chặn được ở tầng dữ liệu - giống hệt nút sửa sơ đồ bên Nhân Sự Ca.
-- Ai rành kỹ thuật vẫn ghi thẳng vào bảng được. Đủ để tránh nhân viên
-- sửa nhầm, không phải hàng rào bảo mật thật.
alter table public.huong_dan_videos enable row level security;

drop policy if exists huong_dan_videos_anon_all on public.huong_dan_videos;
create policy huong_dan_videos_anon_all on public.huong_dan_videos
  for all to anon using (true) with check (true);

-- Chuyển video đang gắn cứng trong mã nguồn sang bảng
insert into public.huong_dan_videos (drive_id, ten, nhom, sort_order)
select '1x8xihpv8zu4nKyWNX8KIdxA-cRzF8cqb',
       'Hướng dẫn sử dụng tem trạng thái',
       'Hướng dẫn công việc', 0
where not exists (
  select 1 from public.huong_dan_videos
  where drive_id = '1x8xihpv8zu4nKyWNX8KIdxA-cRzF8cqb'
);

-- ── KIỂM TRA ──────────────────────────────────────────────────
--   select id, ten, nhom, drive_id from public.huong_dan_videos order by nhom, sort_order;
-- Phải thấy đúng 1 dòng "Hướng dẫn sử dụng tem trạng thái".
