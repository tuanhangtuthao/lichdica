// ═══════════════════════════════════════════════════════════════
// BẢN TIN NHÂN SỰ 8:00 SÁNG QUA ZALO
// ═══════════════════════════════════════════════════════════════
// Cron `0 1 * * *` (01:00 UTC = 08:00 giờ Việt Nam, wrangler.jsonc) gửi danh
// sách người đi làm hôm nay: ca Sáng, ca Tối, Hành Chính, và Ca 1 / Ca 2 /
// Ca 3 (mã ca gán tay cho nhóm Ca Xoay - chỉ hiện khi có người). Không qua AI.
//
// Người nhận: BAN_TIN_MSNV trong wrangler.jsonc (cách nhau bằng dấu phẩy),
// mỗi MSNV gửi tới tài khoản Zalo đang liên kết. Chưa liên kết thì bỏ qua.
// Ngày không ai đi làm (Chủ nhật, lễ) thì không gửi.
// ═══════════════════════════════════════════════════════════════
import { taoSb, homNayVN, dKey } from './du-lieu.js';
import { taoXuong } from './du-lieu-xuong.js';
import { dsTheoKip, tenKip, thuNgay } from './menu.js';
import { guiTin } from './zalo.js';

const GIOI_HAN_TIN = 1800;   // Zalo nhận tối đa 2000 ký tự / tin, chừa chỗ dự phòng

// Mỗi mục: mã ca trong dữ liệu -> tiêu đề. Mục không có ai thì bỏ.
const MUC = [
  ['S',  '☀️ **CA SÁNG** (6h–18h)'],
  ['C',  '🌙 **CA TỐI** (18h–6h)'],
  ['HC', '🏢 **HÀNH CHÍNH** (7h30–16h30)'],
  ['C1', '① **CA 1**'],
  ['C2', '② **CA 2**'],
  ['C3', '③ **CA 3**'],
];

// Chia nhiều tin nếu quá dài, cắt ở dòng trống để không đứt giữa danh sách
export function chiaTin(text, toiDa = GIOI_HAN_TIN) {
  if (text.length <= toiDa) return [text];
  const out = []; let cur = '';
  for (const khoi of text.split('\n\n')) {
    if (cur && (cur + '\n\n' + khoi).length > toiDa) { out.push(cur); cur = khoi; }
    else cur = cur ? cur + '\n\n' + khoi : khoi;
  }
  if (cur) out.push(cur);
  return out;
}

export async function noiDungBanTin(sb, ngay) {
  const r = await taoXuong(sb).ca_trong_ngay(ngay);
  const phan = [], coNguoi = MUC.some(([ma]) => (r.theo_ca[ma] || []).length);
  if (!coNguoi) return null;
  for (const [ma, tieuDe] of MUC) {
    const ds = r.theo_ca[ma] || [];
    if (!ds.length && (ma === 'S' || ma === 'C')) phan.push(`${tieuDe}\nKhông có ai làm ca này.`);
    else if (ds.length) phan.push(`${tieuDe} – ${ds.length} người\n${dsTheoKip(ds)}`);
  }
  const vang = [...(r.theo_ca.NP || []), ...(r.theo_ca.VM || [])];
  phan.push(`🏖️ Nghỉ phép / vắng: ${vang.length ? tenKip(vang) : 'không có'}`);
  return `🌅 **NHÂN SỰ CA** – ${thuNgay(ngay)}\n\n` + phan.join('\n\n');
}

export async function guiBanTin(env) {
  const sb = taoSb();
  // BAN_TIN_NGAY chỉ dùng khi chạy thử ở máy (ép một ngày cụ thể)
  const ngay = env.BAN_TIN_NGAY || dKey(homNayVN());
  const dsMs = String(env.BAN_TIN_MSNV || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!dsMs.length) { console.warn('[bantin] BAN_TIN_MSNV trống, không gửi cho ai'); return { gui: 0 }; }

  const text = await noiDungBanTin(sb, ngay);
  if (!text) { console.log(`[bantin] ${ngay}: không ai đi làm, bỏ qua`); return { gui: 0, boQua: 'khong_ai_di_lam' }; }

  const r = await sb.from('zalo_links').select('zalo_id,msnv').in('msnv', dsMs);
  if (r.error) throw new Error('Đọc zalo_links lỗi: ' + r.error.message);
  const nhan = r.data || [];
  const chuaLK = dsMs.filter(m => !nhan.some(n => n.msnv === m));
  if (chuaLK.length) console.warn('[bantin] MSNV chưa liên kết Zalo, bỏ qua:', chuaLK.join(', '));

  let gui = 0;
  for (const n of nhan) {
    const phan = chiaTin(text);
    let loi = false;
    for (const p of phan) {
      const kq = await guiTin(env, n.zalo_id, p);
      if (!kq.ok) { loi = true; break; }
    }
    if (!loi) gui++;
  }
  console.log(`[bantin] ${ngay}: gửi ${gui}/${nhan.length} người`);
  return { gui, chuaLK };
}
