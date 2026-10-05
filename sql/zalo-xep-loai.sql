-- ═══════════════════════════════════════════════════════════════
-- BOT ZALO: TỔNG KẾT XẾP LOẠI THÁNG + XÁC NHẬN ONLINE
-- Chạy 1 lần, Supabase → SQL Editor → Run (đã chạy 05/10/2026).
-- Xem worker/TONG-KET-THANG-ZALO.md. Nếu dán bị cắt, chạy từng khối một.
-- ═══════════════════════════════════════════════════════════════
-- Mỗi (nhân viên, tháng) có một dòng từ lúc quản lý duyệt xếp loại. Dòng này
-- vừa là dấu "đã gửi tổng kết" (không gửi trùng), vừa lưu việc nhân viên đồng
-- ý hay không để quản lý xem ở mục 13 của menu. Để riêng bảng, không ghi vào
-- monthly_reviews: khoá anon của bot chỉ nên đọc dữ liệu đánh giá.
-- trang_thai nhận 'cho' | 'dong_y' | 'khong_dong_y' (do code bot đảm bảo).

-- KHỐI 1: bảng
create table if not exists public.zalo_xep_loai (
  emp_id text not null,
  month_key text not null,
  grade text not null,
  han date not null,
  trang_thai text not null default 'cho',
  gui_luc timestamptz,
  hoi_luc timestamptz,
  zalo_id text not null default '',
  xac_nhan_luc timestamptz,
  ly_do text not null default '',
  cho_ly_do boolean not null default false,
  nhac_luc date,
  qua_han_bao boolean not null default false,
  tao_luc timestamptz not null default now(),
  primary key (emp_id, month_key)
);

-- KHỐI 2: cho bot đọc/ghi
alter table public.zalo_xep_loai enable row level security;
drop policy if exists zalo_xep_loai_anon_all on public.zalo_xep_loai;
create policy zalo_xep_loai_anon_all on public.zalo_xep_loai for all to anon using (true) with check (true);

-- KHỐI 3: thêm chế độ 'xac_nhan' cho cột menu (số 1/2/3 = Đồng ý / Xem lại / Không đồng ý)
alter table public.zalo_links drop constraint if exists zalo_links_menu_hop_le;
alter table public.zalo_links add constraint zalo_links_menu_hop_le check (menu in ('ca_nhan', 'quan_ly', 'xac_nhan'));
