// ═══════════════════════════════════════════════════════════════
// BÁO 5S CHƯA ĐẠT QUA ZALO — đặc tả: worker/BAO-5S-ZALO.md
// ═══════════════════════════════════════════════════════════════
// · quetBao5S: Cron 5 phút/lần. Lượt chưa đạt mới (kiểm cách đây ≥ 5 phút
//   để người kiểm kịp sửa nếu chấm nhầm) -> nhắn riêng nhân viên, kèm ảnh.
//   Nhân viên chưa liên kết bot thì BỎ QUA (chờ báo bù).
// · baoBuKhiLienKet: nhân viên vừa xác nhận liên kết -> 1 tin gộp các lượt
//   chưa đạt THÁNG NÀY chưa từng báo cho họ.
// Bảng zalo_bao_5s đánh dấu lượt đã báo (sql/zalo-bao-5s.sql). Mỗi lượt
// được "giữ chỗ" trước khi gửi (insert ... on conflict do nothing) nên hai
// lần quét chồng nhau cũng không báo trùng; gửi hỏng thì nhả ra để lần sau.
// ═══════════════════════════════════════════════════════════════
import { taoSb, homNayVN, dKey, DFUL, boDau } from './du-lieu.js';
import { guiTin, guiAnh } from './zalo.js';
import { SO_SANG_CA_NHAN } from './menu.js';

const { S_DEFS } = globalThis.TieuChi5S;

// Mốc bật tính năng. Lượt kiểm TRƯỚC mốc này không báo tức thì (tránh dội
// tin cũ lúc vừa bật) - chúng chỉ đến tay nhân viên qua báo bù khi liên kết.
const BAT_DAU = '2026-10-05T04:00:00Z';
const CHO_MS = 5 * 60e3;            // đợi 5 phút sau khi kiểm mới báo
const LUI_TOI_DA_MS = 2 * 864e5;    // mỗi lần quét chỉ nhìn lại 2 ngày
const ANH_TOI_DA = 3;               // tối đa 3 ảnh / lượt

const chuaDat = x => !S_DEFS.every(d => x[d.k] === true);
const mucHong = x => S_DEFS.filter(d => x[d.k] !== true).map(d => d.name);
const gioVN = iso => new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(11, 16);
const ddmm = k => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
function thuNgay(k) {
  const [y, m, d] = k.split('-').map(Number);
  return `${DFUL[new Date(y, m - 1, d).getDay()]}, ${ddmm(k)}`;
}

// Mẫu tin đã chốt (chữ trơn: dùng làm caption ảnh)
export function noiDungBao(x) {
  return '⚠️ Bạn có 1 lượt 5S CHƯA ĐẠT\n'
    + `📅 ${thuNgay(x.date)} – Ca ${x.shift === 'C' ? 'Tối' : 'Sáng'}${x.checked_at ? ' – ' + gioVN(x.checked_at) : ''}\n`
    + (x.machine_code ? `🔧 Máy ${x.machine_code}\n` : '')
    + `❌ Mục: ${mucHong(x).join(', ')}\n`
    + (x.note ? `📝 ${x.note}\n` : '')
    + (x.inspector ? `👤 Người kiểm: ${x.inspector}\n` : '')
    + '\nNhắn 0 để xem menu.';
}

// Giữ chỗ: chỉ trả về những lượt THỰC SỰ vừa ghi được (chưa ai ghi trước)
async function giuCho(sb, dong) {
  if (!dong.length) return [];
  const r = await sb.from('zalo_bao_5s').upsert(dong, { onConflict: 's5_id', ignoreDuplicates: true }).select('s5_id');
  if (r.error) throw new Error('Ghi zalo_bao_5s lỗi: ' + r.error.message);
  return (r.data || []).map(x => x.s5_id);
}
async function nhaCho(sb, ids) {
  if (!ids.length) return;
  const r = await sb.from('zalo_bao_5s').delete().in('s5_id', ids);
  if (r.error) console.error('[bao5s] nhả chỗ lỗi:', r.error.message);
}
async function daBao(sb, ids) {
  if (!ids.length) return new Set();
  const r = await sb.from('zalo_bao_5s').select('s5_id').in('s5_id', ids);
  if (r.error) throw new Error('Đọc zalo_bao_5s lỗi: ' + r.error.message);
  return new Set((r.data || []).map(x => x.s5_id));
}

// ── CRON: báo lượt mới ─────────────────────────────────────────
export async function quetBao5S(env) {
  const sb = taoSb(), now = Date.now();
  // BAO_5S_TU chỉ dùng khi chạy thử ở máy (lùi mốc để có dữ liệu thử)
  const moc = new Date(env.BAO_5S_TU || BAT_DAU).getTime();
  const tu = new Date(Math.max(moc, now - LUI_TOI_DA_MS)).toISOString();
  const den = new Date(now - CHO_MS).toISOString();
  if (tu >= den) return { bao: 0 };

  const r = await sb.from('s5_checks').select('*').gte('checked_at', tu).lte('checked_at', den).order('checked_at');
  if (r.error) throw new Error('Đọc s5_checks lỗi: ' + r.error.message);
  const loi = (r.data || []).filter(chuaDat);
  if (!loi.length) return { bao: 0 };
  const da = await daBao(sb, loi.map(x => x.id));
  const can = loi.filter(x => !da.has(x.id));
  if (!can.length) return { bao: 0 };

  // Ai là ai: theo worker_id; bản ghi cũ chưa có MSNV thì dò theo tên
  const [er, lr] = await Promise.all([
    sb.from('employees').select('id,name'),
    sb.from('zalo_links').select('zalo_id,msnv').not('msnv', 'is', null),
  ]);
  if (er.error || lr.error) throw new Error((er.error || lr.error).message);
  const theoTen = Object.fromEntries((er.data || []).map(e => [boDau(e.name), String(e.id)]));
  const zaloCua = Object.fromEntries((lr.data || []).map(l => [String(l.msnv), l.zalo_id]));

  let bao = 0, boQua = 0;
  for (const x of can) {
    const msnv = x.worker_id ? String(x.worker_id) : theoTen[boDau(x.worker_name)];
    const zid = msnv && zaloCua[msnv];
    if (!zid) { boQua++; continue; }                         // chưa liên kết -> chờ báo bù
    const giu = await giuCho(sb, [{ s5_id: x.id, msnv, zalo_id: zid, cach: 'tuc_thi' }]);
    if (!giu.length) continue;                               // lần quét khác đã báo
    const anh = (x.photos || []).slice(0, ANH_TOI_DA);
    const kq = anh.length ? await guiAnh(env, zid, anh[0], noiDungBao(x)) : await guiTin(env, zid, noiDungBao(x));
    if (!kq.ok) { await nhaCho(sb, giu); continue; }          // gửi hỏng -> để lần sau
    for (const p of anh.slice(1)) await guiAnh(env, zid, p, '');
    bao++;
  }
  console.log(`[bao5s] quét ${tu} → ${den}: ${loi.length} lượt chưa đạt, báo ${bao}, bỏ qua (chưa liên kết) ${boQua}`);
  return { bao, boQua };
}

// ── BÁO BÙ khi nhân viên vừa liên kết ──────────────────────────
export async function baoBuKhiLienKet(env, nv, zaloId, laQL) {
  const sb = taoSb();
  const thang = dKey(homNayVN()).slice(0, 7);
  const [y, m] = thang.split('-').map(Number);
  const sau = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  // s5_checks.date là cột kiểu date -> lọc khoảng ngày, không dùng like
  const r = await sb.from('s5_checks').select('*').gte('date', thang + '-01').lt('date', sau).order('date');
  if (r.error) throw new Error('Đọc s5_checks lỗi: ' + r.error.message);
  const id = String(nv.id), ten = boDau(nv.name);
  const cuaNV = (r.data || []).filter(chuaDat)
    .filter(x => x.worker_id ? String(x.worker_id) === id : boDau(x.worker_name) === ten);
  if (!cuaNV.length) return 0;
  const da = await daBao(sb, cuaNV.map(x => x.id));
  const chua = cuaNV.filter(x => !da.has(x.id));
  if (!chua.length) return 0;

  const giu = new Set(await giuCho(sb, chua.map(x => ({ s5_id: x.id, msnv: id, zalo_id: zaloId, cach: 'bao_bu' }))));
  const ds = chua.filter(x => giu.has(x.id));
  if (!ds.length) return 0;
  const text = `📋 Bạn có ${ds.length} lượt 5S chưa đạt tháng ${String(m).padStart(2, '0')} chưa được báo:\n`
    + ds.map(x => `• ${ddmm(x.date)}${x.machine_code ? ' – máy ' + x.machine_code : ''} – ${mucHong(x).join(', ')}`).join('\n')
    // quản lý đang ở menu quản lý (số 3 là quân số) -> phải sang menu cá nhân trước
    + `\n\n${laQL ? `Nhắn ${SO_SANG_CA_NHAN} rồi 3` : 'Nhắn 3'} để xem chi tiết.`;
  const kq = await guiTin(env, zaloId, text);
  if (!kq.ok) { await nhaCho(sb, ds.map(x => x.id)); return 0; }
  return ds.length;
}
