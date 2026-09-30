-- ═══════════════════════════════════════════════════════════════
-- TÀI LIỆU HƯỚNG DẪN: KHÔNG CHỈ VIDEO
-- Thêm cột phân loại để chứa cả hình ảnh, PDF, tài liệu khác.
-- Chạy SAU huong-dan-videos.sql, 1 lần, Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════

-- 'video' | 'anh' | 'pdf' | 'khac'
-- Mặc định 'video' nên các dòng đã có giữ nguyên ý nghĩa, không cần sửa tay.
alter table public.huong_dan_videos
  add column if not exists loai text not null default 'video';

-- Chặn gõ sai loại. Trang chỉ cho chọn 4 giá trị này, ràng buộc là lớp cuối.
alter table public.huong_dan_videos drop constraint if exists huong_dan_videos_loai_hop_le;
alter table public.huong_dan_videos
  add constraint huong_dan_videos_loai_hop_le
  check (loai in ('video','anh','pdf','khac'));

comment on column public.huong_dan_videos.loai is
  'Loại tài liệu: video | anh | pdf | khac';

create index if not exists huong_dan_videos_loai_idx
  on public.huong_dan_videos (loai);

-- ── KIỂM TRA ──────────────────────────────────────────────────
--   select id, ten, nhom, loai from public.huong_dan_videos order by nhom, sort_order;
-- Dòng đang có phải mang loai = 'video'.
