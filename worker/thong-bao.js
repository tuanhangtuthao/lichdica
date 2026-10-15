// ═══════════════════════════════════════════════════════════════
// QUẢN LÝ GỬI THÔNG BÁO CHUNG CỦA PHÂN XƯỞNG QUA BOT
// ═══════════════════════════════════════════════════════════════
// Đặc tả: worker/THONG-BAO-ZALO.md. Bảng: sql/zalo-thong-bao.sql.
//   "thông báo: nội dung"          -> cả xưởng
//   "thông báo kíp 1,3: nội dung"  -> chỉ kíp 1 và 3
// Bot đọc lại nội dung + số người nhận, chờ 1 (gửi) / 2 (huỷ) rồi mới gửi.
// Chỉ Trưởng Phòng và Tổ Trưởng được dùng (duocThongBao).
// ═══════════════════════════════════════════════════════════════
import { taoSb, homNayVN, dKey, boDau, NHOM, duocThongBao } from './du-lieu.js';
import { guiTin } from './zalo.js';
import { thuNgay } from './menu.js';

const HAN_NHAP_PHUT = 15;     // bản nháp quá lâu không bấm 1 thì bỏ
const TOI_DA_NOI_DUNG = 1500; // còn chỗ cho tiêu đề + người ký trong 2000 ký tự của Zalo
const LO = 25;                // người gửi mỗi lần chạy: Cloudflare gói miễn phí ~50 lệnh gọi mạng
const BANG = 'zalo_thong_bao';

const HUONG_DAN = '📢 **Gửi thông báo chung** – gõ:\n'
  + '• thông báo: nội dung → cả xưởng\n'
  + '• thông báo kíp 2: nội dung → chỉ kíp 2 (nhiều kíp: kíp 1,3; kíp 4 = Hành Chính / Ca Xoay)\n'
  + 'Bot sẽ hỏi lại, nhắn **1** để gửi hoặc **2** để huỷ.';
const CHUA_BAT = '📢 Tính năng thông báo chưa được bật (thiếu bảng dữ liệu). Báo người quản trị chạy file sql/zalo-thong-bao.sql nhé.';

const thieuBang = e => !!e && (/zalo_thong_bao/.test(e.message || '') || ['42P01', 'PGRST205'].includes(e.code));

// Nhận ra lệnh. Trả về null nếu tin này không phải lệnh thông báo.
export function phanTichLenh(text) {
  const m = String(text || '').match(/^([^:：]*)[:：]([\s\S]*)$/);
  const dau = boDau(m ? m[1] : text);
  const kh = dau.match(/^thong bao(?: kip ([0-9][0-9 ,va]*))?$/);
  if (!kh) return null;
  if (!m || !m[2].trim()) return { huongDan: true };
  let kip = null;
  if (kh[1]) {
    kip = [...new Set((kh[1].match(/\d/g) || []).map(Number))].filter(k => NHOM[k]).sort();
    if (!kip.length) return { loi: 'Mình không thấy kíp nào hợp lệ. Kíp là 1, 2, 3 hoặc 4 (Hành Chính / Ca Xoay).' };
  }
  return { kip, noiDung: m[2].trim() };
}

const tenDoiTuong = kip => (kip && kip.length ? kip.map(k => NHOM[k]).join(' + ') : 'Cả xưởng');
const kipTuChuoi = s => (s ? s.split(',').map(Number) : null);

// Ai sẽ nhận: tài khoản Zalo đã liên kết, thuộc đúng kíp, trừ chính người gửi
async function nguoiNhan(sb, kip, zaloGui) {
  const [er, lr] = await Promise.all([
    sb.from('employees').select('id,name,kip'),
    sb.from('zalo_links').select('zalo_id,msnv').not('msnv', 'is', null),
  ]);
  if (er.error) throw new Error(er.error.message);
  if (lr.error) throw new Error(lr.error.message);
  const nv = (er.data || []).filter(e => !kip || kip.includes(Number(e.kip)));
  const theoId = new Map(nv.map(e => [String(e.id), e]));
  const thay = new Set(), nhan = [];
  for (const l of lr.data || []) {
    const e = theoId.get(String(l.msnv));
    if (!e || l.zalo_id === zaloGui || thay.has(l.zalo_id)) continue;
    thay.add(l.zalo_id); nhan.push({ z: l.zalo_id, t: e.name });
  }
  return { nhan, tongNguoi: nv.length };
}

function noiDungGui(r) {
  return `📢 **THÔNG BÁO PHÂN XƯỞNG 1** – ${thuNgay(dKey(homNayVN()))}\n\n${r.noi_dung}\n\n— ${r.vai_tro} ${r.ten_gui}`.trim();
}

// Gửi một lô, ghi lại tiến độ
async function guiMotLo(env, sb, r) {
  const lo = (r.con_lai || []).slice(0, LO), conLai = (r.con_lai || []).slice(LO);
  const loi = [...(r.loi || [])]; let ok = 0;
  const noi = noiDungGui(r);
  for (const n of lo) {
    let kq;
    try { kq = await guiTin(env, n.z, noi); } catch (e) { kq = { ok: false }; }
    if (kq && kq.ok) ok++; else loi.push(n.t);
  }
  const daGui = (r.da_gui || 0) + ok, xong = !conLai.length;
  const u = await sb.from(BANG).update({
    con_lai: conLai, da_gui: daGui, loi,
    trang_thai: xong ? 'xong' : 'dang_gui', cap_nhat: new Date().toISOString(),
    ...(xong ? { xong_luc: new Date().toISOString() } : {}),
  }).eq('id', r.id);
  if (u.error) throw new Error(u.error.message);
  return { xong, daGui, tong: r.tong, loi };
}

function baoKetQua(k) {
  let s = `✅ Đã gửi thông báo tới **${k.daGui}/${k.tong}** người.`;
  if (k.loi.length) s += `\n⚠️ Chưa gửi được: ${k.loi.slice(0, 10).join(', ')}${k.loi.length > 10 ? ` và ${k.loi.length - 10} người khác` : ''}.`;
  return s;
}

// Gọi cho mọi tin của người đang dùng bot. Trả về chữ để gửi lại, hoặc null nếu
// tin này không liên quan thông báo (để luồng bình thường xử lý tiếp).
export async function xuLyThongBao({ sb, env, nv, lk, text }) {
  const lenh = phanTichLenh(text);
  if (lenh && !duocThongBao(nv))
    return 'Lệnh thông báo chỉ dành cho Trưởng Phòng và Tổ Trưởng. Nhắn **0** để xem menu nhé.';
  if (!duocThongBao(nv)) return null;

  // 1) đang có bản nháp chờ xác nhận?
  const han = new Date(Date.now() - HAN_NHAP_PHUT * 60000).toISOString();
  const q = await sb.from(BANG).select('*').eq('zalo_id', lk.zalo_id).eq('trang_thai', 'cho')
    .gte('tao_luc', han).order('id', { ascending: false }).limit(1);
  if (q.error) {
    if (thieuBang(q.error)) return lenh ? CHUA_BAT : null;
    throw new Error(q.error.message);
  }
  const nhap = (q.data || [])[0];
  if (nhap) {
    const so = text.trim();
    if (so === '1') {
      const { nhan } = await nguoiNhan(sb, kipTuChuoi(nhap.kip), lk.zalo_id);
      if (!nhan.length) {
        await sb.from(BANG).update({ trang_thai: 'huy' }).eq('id', nhap.id);
        return 'Chưa có ai trong nhóm này liên kết Zalo nên không gửi được. Đã huỷ.';
      }
      // chỉ một lần bấm 1 được tính: chuyển trạng thái có điều kiện
      const c = await sb.from(BANG).update({
        trang_thai: 'dang_gui', con_lai: nhan, tong: nhan.length, da_gui: 0, loi: [],
        cap_nhat: new Date().toISOString(),
      }).eq('id', nhap.id).eq('trang_thai', 'cho').select();
      if (c.error) throw new Error(c.error.message);
      if (!c.data || !c.data.length) return 'Thông báo này đã được xử lý rồi.';
      const k = await guiMotLo(env, sb, c.data[0]);
      return k.xong ? baoKetQua(k)
        : `⏳ Đã gửi ${k.daGui}/${k.tong} người, phần còn lại sẽ gửi trong vài phút nữa. Gửi xong mình báo lại bạn nhé.`;
    }
    // bất cứ tin nào khác (kể cả 2) là bỏ bản nháp
    await sb.from(BANG).update({ trang_thai: 'huy' }).eq('id', nhap.id);
    if (so === '2') return 'Đã huỷ thông báo, chưa gửi cho ai. Nhắn **0** để xem menu.';
  }

  // 2) lệnh mới -> tạo bản nháp, hỏi lại
  if (!lenh) return null;
  if (lenh.huongDan) return HUONG_DAN;
  if (lenh.loi) return lenh.loi;
  if (lenh.noiDung.length > TOI_DA_NOI_DUNG)
    return `Nội dung dài ${lenh.noiDung.length} ký tự, quá giới hạn ${TOI_DA_NOI_DUNG}. Bạn rút gọn giúp mình nhé.`;
  const { nhan, tongNguoi } = await nguoiNhan(sb, lenh.kip, lk.zalo_id);
  if (!nhan.length)
    return `Chưa có ai trong nhóm **${tenDoiTuong(lenh.kip)}** liên kết Zalo với bot nên không gửi được.`;
  const ins = await sb.from(BANG).insert({
    zalo_id: lk.zalo_id, msnv_gui: String(nv.id), ten_gui: nv.name, vai_tro: nv.role || '',
    noi_dung: lenh.noiDung, kip: lenh.kip ? lenh.kip.join(',') : '',
  });
  if (ins.error) { if (thieuBang(ins.error)) return CHUA_BAT; throw new Error(ins.error.message); }
  const chua = tongNguoi - nhan.length - 1;   // trừ chính người gửi
  return `📢 Bạn sắp gửi thông báo này tới **${nhan.length}** người (${tenDoiTuong(lenh.kip)}):\n\n"${lenh.noiDung}"\n`
    + (chua > 0 ? `\n(${chua} người chưa liên kết bot nên sẽ không nhận được)\n` : '')
    + '\n1️⃣ Gửi ngay\n2️⃣ Huỷ';
}

// Cron 5 phút: gửi tiếp lô sau của thông báo đang dở (mỗi lần một thông báo)
export async function tiepThongBao(env) {
  const sb = taoSb();
  const treHon = new Date(Date.now() - 60000).toISOString();   // tránh đụng lô đang gửi dở
  const q = await sb.from(BANG).select('*').eq('trang_thai', 'dang_gui').lt('cap_nhat', treHon).order('id').limit(1);
  if (q.error) { if (!thieuBang(q.error)) console.error('[thongbao] đọc lỗi:', q.error.message); return; }
  const r = (q.data || [])[0];
  if (!r) return;
  const k = await guiMotLo(env, sb, r);
  if (k.xong) await guiTin(env, r.zalo_id, baoKetQua(k));
  console.log(`[thongbao] #${r.id}: ${k.daGui}/${k.tong}${k.xong ? ' (xong)' : ''}`);
}
