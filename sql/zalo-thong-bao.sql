-- ═══════════════════════════════════════════════════════════════
-- BOT ZALO: QUẢN LÝ GỬI THÔNG BÁO CHUNG CỦA PHÂN XƯỞNG
-- Chạy 1 lần, Supabase → SQL Editor → Run. Xem worker/THONG-BAO-ZALO.md.
-- Nếu dán bị cắt, chạy từng khối một.
-- ═══════════════════════════════════════════════════════════════
-- Mỗi lệnh "thông báo: ..." tạo một dòng ở trạng thái 'cho' (chờ người gửi
-- bấm 1 xác nhận). Bấm 1 thì chuyển 'dang_gui' và con_lai giữ danh sách người
-- chưa được gửi (Cloudflare gói miễn phí chỉ cho ~50 lệnh gọi mạng mỗi lần
-- chạy nên gửi từng lô, lô sau do cron 5 phút gửi tiếp). Xong thì 'xong'.
-- trang_thai: 'cho' | 'dang_gui' | 'xong' | 'huy' (do code bot đảm bảo).

-- KHỐI 1: bảng
create table if not exists public.zalo_thong_bao (
  id bigint generated always as identity primary key,
  zalo_id text not null,
  msnv_gui text not null default '',
  ten_gui text not null default '',
  vai_tro text not null default '',
  noi_dung text not null,
  kip text not null default '',
  trang_thai text not null default 'cho',
  con_lai jsonb not null default '[]'::jsonb,
  tong int not null default 0,
  da_gui int not null default 0,
  loi jsonb not null default '[]'::jsonb,
  tao_luc timestamptz not null default now(),
  cap_nhat timestamptz not null default now(),
  xong_luc timestamptz
);

-- KHỐI 2: cho bot đọc/ghi
alter table public.zalo_thong_bao enable row level security;
drop policy if exists zalo_thong_bao_anon_all on public.zalo_thong_bao;
create policy zalo_thong_bao_anon_all on public.zalo_thong_bao for all to anon using (true) with check (true);
