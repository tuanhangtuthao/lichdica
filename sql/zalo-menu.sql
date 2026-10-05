-- ═══════════════════════════════════════════════════════════════
-- BOT ZALO: NHỚ MỖI NGƯỜI ĐANG Ở MENU NÀO
-- Chạy SAU zalo-lien-ket.sql, 1 lần, Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════
-- Quản lý có 2 menu (quản lý / cá nhân) mà số 1 ở hai menu nghĩa khác nhau,
-- nên bot phải nhớ người đó đang đứng ở menu nào. Nhân viên thường luôn là
-- 'ca_nhan'. Xem worker/MENU-ZALO.md.
--
-- Chưa chạy câu này thì bot vẫn chạy, chỉ là quản lý nhắn số sẽ luôn
-- được hiểu theo menu quản lý (không sang được menu cá nhân).

alter table public.zalo_links
  add column if not exists menu text not null default 'ca_nhan';

alter table public.zalo_links drop constraint if exists zalo_links_menu_hop_le;
alter table public.zalo_links
  add constraint zalo_links_menu_hop_le check (menu in ('ca_nhan', 'quan_ly'));
