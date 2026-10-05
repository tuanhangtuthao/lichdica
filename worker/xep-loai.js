// ═══════════════════════════════════════════════════════════════
// TỔNG KẾT XẾP LOẠI THÁNG + XÁC NHẬN ONLINE QUA ZALO
// Đặc tả: worker/TONG-KET-THANG-ZALO.md · SQL: sql/zalo-xep-loai.sql
// ═══════════════════════════════════════════════════════════════
// Quản lý duyệt xếp loại (monthly_reviews.approved) -> bot nhắn riêng nhân
// viên tổng kết + yêu cầu xác nhận trước ngày 4 tháng sau. Nhân viên trả lời
// bằng menu: 1 Đồng ý · 2 Xem lại chi tiết · 3 Không đồng ý. Không qua AI.
//
// · quetXepLoai (Cron 5 phút/lần): gửi tổng kết mới, báo khi hạng bị sửa,
//   nhắc lúc 8:00 người chưa xác nhận, báo Trưởng Phòng khi quá hạn.
// · baoBuXepLoai: nhân viên vừa liên kết bot -> gửi bù.
// · xuLyXacNhan: nhận câu trả lời 1/2/3 hoặc "đồng ý" / "không đồng ý".
// · trangThaiXacNhan: nội dung mục 13 của menu quản lý.
//
// Cloudflare gói miễn phí chỉ cho 50 lệnh gọi mạng mỗi lần chạy, nên dữ liệu
// cả tháng được nạp MỘT lần rồi tính cho từng người, và mỗi lần chỉ gửi tối
// đa NGAN_SACH người (5 phút/lần -> 72 người/giờ, thừa cho 44 nhân viên).
// ═══════════════════════════════════════════════════════════════
import {
  taoSb, homNayVN, dKey, addD, tuKey, round1, caCua, gioTangCa, NHOM, boDau, luuMenu,
} from './du-lieu.js';
import { guiTin } from './zalo.js';

const { S_DEFS, laLoiCua5S } = globalThis.TieuChi5S;

export const BAT_DAU_THANG = '2026-10';   // chỉ xét xếp loại từ tháng này trở đi
const HAN_NGAY = 4;                        // hạn: hết ngày 4 của tháng sau
const NGAY_GIA_HAN = 3;                    // duyệt trễ: hạn = 3 ngày sau lúc phát hiện
const GIO_NHAC = 8;                        // nhắc từ 8:00 giờ VN
const HIEU_LUC_MENU_MS = 12 * 3600e3;      // số 1/2/3 chỉ là "xác nhận" trong 12h sau lần hỏi
const LY_DO_MS = 2 * 3600e3;               // tin nhắn tiếp theo trong 2h sau "không đồng ý" = lý do
const NGAN_SACH = 6;                       // số người gửi tối đa mỗi lần chạy
const THU_TU = { 'A+': 5, A: 4, B: 3, C: 2, D: 1 };

const ddmm = k => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const ddmmyyyy = k => `${ddmm(k)}/${k.slice(0, 4)}`;
const thangNhan = mk => `${mk.slice(5)}/${mk.slice(0, 4)}`;
const homNay = () => dKey(homNayVN());
const bayGio = () => new Date().toISOString();
const gioVN = iso => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString();
  return `${d.slice(11, 16)}, ${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
};
function thangTruoc(mk) {
  const [y, m] = mk.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}
function hanMacDinh(mk, hom) {
  const [y, m] = mk.split('-').map(Number);
  const han = m === 12 ? `${y + 1}-01-0${HAN_NGAY}` : `${y}-${String(m + 1).padStart(2, '0')}-0${HAN_NGAY}`;
  return hom > han ? dKey(addD(tuKey(hom), NGAY_GIA_HAN)) : han;
}
const conNgay = (han, hom) => Math.round((tuKey(han) - tuKey(hom)) / 864e5);
const nhom = ds => ds.reduce((m, x) => ((m[x.kip] = m[x.kip] || []).push(x), m), {});

// ── NỘI DUNG TIN ───────────────────────────────────────────────
export function loiYeuCau(grade, mk, han) {
  return `✍️ **BẠN CẦN XÁC NHẬN XẾP LOẠI NÀY** (hạng ${grade} tháng ${thangNhan(mk)})\n`
    + '1️⃣ Đồng ý\n2️⃣ Xem lại chi tiết\n3️⃣ Không đồng ý / có thắc mắc\n'
    + `Hạn: hết ngày ${ddmmyyyy(han)}\n(Nhắn **0** để vào menu, bot sẽ nhắc lại sau)`;
}

// Nạp dữ liệu cả tháng một lần cho mọi người
async function taiNguCanh(sb, mk) {
  const [y, m] = mk.split('-').map(Number);
  const sau = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const kq = await Promise.all([
    sb.from('ratings_new').select('emp_id,score').like('date', mk + '-%'),
    // s5_checks.date là cột kiểu date thật -> lọc khoảng ngày, không dùng like
    sb.from('s5_checks').select('*').gte('date', mk + '-01').lt('date', sau),
    sb.from('overtime').select('*').like('date', mk + '-%'),
    sb.from('emp_schedule').select('*'),
    sb.from('holidays').select('*'),
    sb.from('monthly_reviews').select('emp_id,grade').eq('month_key', thangTruoc(mk)).eq('approved', true),
  ]);
  const loi = kq.find(x => x.error);
  if (loi) throw new Error('Nạp dữ liệu tháng lỗi: ' + loi.error.message);
  const [rt, s5, ot, sc, hl, rp] = kq.map(x => x.data || []);
  return { mk, cuoi: new Date(y, m, 0).getDate(), rt, s5, ot, sc, hl, rp };
}

function noiDungTongKet(ctx, nv, rv) {
  const id = String(nv.id), mk = ctx.mk, dau = mk + '-01';
  const ck = `${mk}-${String(ctx.cuoi).padStart(2, '0')}`;

  // điểm: final_score nếu quản lý đã chốt, không thì trung bình điểm ngày
  const diemNgay = ctx.rt.filter(r => String(r.emp_id) === id).map(r => parseFloat(r.score));
  const tb = diemNgay.length ? round1(diemNgay.reduce((a, b) => a + b, 0) / diemNgay.length) : null;
  const diem = rv.final_score != null ? parseFloat(rv.final_score) : tb;

  // 5S chưa đạt: cùng công thức rating.html (theo MSNV, bản cũ theo tên)
  const ten = boDau(nv.name);
  const vp5s = ctx.s5.filter(x => !S_DEFS.every(d => x[d.k] === true))
    // Lỗi 5S tính cho ai: thợ / kỹ thuật / cả hai (laLoiCua5S, 5s-tieu-chi.js)
    .filter(x => laLoiCua5S(x, id, nv.name, boDau)).length;

  let gio = 0, caCa = 0;
  ctx.ot.filter(o => String(o.emp_id) === id).forEach(o => {
    const h = gioTangCa(o); if (h) gio += h;
    if (o.ot_type === 'full') caCa++;
  });

  const schedNV = ctx.sc.filter(s => String(s.emp_id) === id);
  let nghi = 0, lam = 0;
  schedNV.filter(s => s.shift === 'NP' || s.shift === 'VM').forEach(s => {
    const a = s.start_date < dau ? dau : s.start_date, b = s.end_date > ck ? ck : s.end_date;
    const d = Math.round((tuKey(b) - tuKey(a)) / 864e5) + 1;
    if (d > 0) nghi += d;
  });
  for (let i = 1; i <= ctx.cuoi; i++) {
    const d = tuKey(`${mk}-${String(i).padStart(2, '0')}`);
    if (!['N', 'L', 'NP', 'VM', 'UN'].includes(caCua(nv, d, ctx.hl, schedNV))) lam++;
  }

  const truoc = (ctx.rp.find(r => String(r.emp_id) === id) || {}).grade;
  let xu = '';
  if (truoc && THU_TU[truoc] && THU_TU[rv.grade]) {
    const d = THU_TU[rv.grade] - THU_TU[truoc];
    xu = `  (tháng ${thangTruoc(mk).slice(5)}: ${truoc} ${d > 0 ? '⬆️' : d < 0 ? '⬇️' : '➡️'})`;
  }
  return `📋 **TỔNG KẾT THÁNG ${thangNhan(mk)}**\n👤 ${nv.name} (${NHOM[nv.kip] || ''})\n\n`
    + `⭐ Xếp loại: **${rv.grade}**${xu}\n`
    + `📊 Điểm: ${diem != null ? diem + '/10' : 'chưa có'}${diemNgay.length ? ` · đã chấm ${diemNgay.length} ngày` : ''}\n`
    + (rv.note ? `📝 Nhận xét của quản lý: ${rv.note}\n` : '')
    + `\n📅 Đi làm: ${lam} ngày\n🧹 5S chưa đạt: ${vp5s} lần\n`
    + `⏰ Tăng ca: ${round1(gio)} giờ${caCa ? ` + ${caCa} lần cả ca` : ''}\n🏖️ Nghỉ phép / vắng: ${nghi} ngày`;
}

// ── GỬI MỘT NGƯỜI ─────────────────────────────────────────────
async function capNhat(sb, id, mk, dat, dieuKien = q => q) {
  const q = dieuKien(sb.from('zalo_xep_loai').update(dat).eq('emp_id', id).eq('month_key', mk));
  const r = await q.select('*');
  if (r.error) throw new Error('Cập nhật zalo_xep_loai lỗi: ' + r.error.message);
  return r.data || [];
}

// Gửi tổng kết + yêu cầu. kieu: 'moi' | 'bu' | 'dieu_chinh'
async function guiTongKet(sb, env, ctx, nv, zaloId, rv, rec, kieu) {
  const id = String(nv.id), mk = rv.month_key, hom = homNay();
  let dong;
  if (kieu === 'dieu_chinh') {
    // so sánh-và-đổi: chỉ một lần chạy thắng, tránh gửi trùng khi hai lần chạy chồng nhau
    const hanMoi = rec.han >= hom ? rec.han : dKey(addD(tuKey(hom), NGAY_GIA_HAN));
    dong = (await capNhat(sb, id, mk, {
      grade: rv.grade, trang_thai: 'cho', xac_nhan_luc: null, ly_do: '', cho_ly_do: false,
      qua_han_bao: false, nhac_luc: null, han: hanMoi, hoi_luc: bayGio(), zalo_id: zaloId,
    }, q => q.eq('grade', rec.grade)))[0];
  } else {
    dong = (await capNhat(sb, id, mk, { gui_luc: bayGio(), hoi_luc: bayGio(), zalo_id: zaloId }, q => q.is('gui_luc', null)))[0];
  }
  if (!dong) return false;                                     // lần chạy khác đã làm
  const mo = kieu === 'dieu_chinh'
    ? `🔄 Xếp loại tháng ${thangNhan(mk)} của bạn đã được điều chỉnh: ${rec.grade} → ${rv.grade}\n\n` : '';
  const text = mo + noiDungTongKet(ctx, nv, rv) + '\n\n' + loiYeuCau(rv.grade, mk, dong.han);
  try {
    const kq = await guiTin(env, zaloId, text);
    if (!kq.ok) throw new Error('Zalo từ chối');
  } catch (e) {
    if (kieu !== 'dieu_chinh') await capNhat(sb, id, mk, { gui_luc: null });   // nhả để lần sau gửi lại
    throw e;
  }
  await luuMenu(sb, zaloId, 'xac_nhan');
  return true;
}

// Đảm bảo có bản ghi cho (người, tháng); đồng bộ hạng nếu quản lý sửa
async function dongBo(sb, rv, rec, hom) {
  const id = String(rv.emp_id), mk = rv.month_key;
  if (!rec) {
    const han = hanMacDinh(mk, hom);
    const u = await sb.from('zalo_xep_loai').upsert({ emp_id: id, month_key: mk, grade: rv.grade, han },
      { onConflict: 'emp_id,month_key', ignoreDuplicates: true });
    if (u.error) throw new Error('Ghi zalo_xep_loai lỗi: ' + u.error.message);
    return { emp_id: id, month_key: mk, grade: rv.grade, han, trang_thai: 'cho', gui_luc: null };
  }
  if (rec.grade !== rv.grade && !rec.gui_luc) {                 // chưa gửi: chỉ cập nhật hạng
    await capNhat(sb, id, mk, { grade: rv.grade }, q => q.is('gui_luc', null));
    return { ...rec, grade: rv.grade };
  }
  return rec;
}

async function layReviews(sb, tu, ids) {
  let q = sb.from('monthly_reviews').select('emp_id,month_key,grade,note,final_score')
    .eq('approved', true).gte('month_key', tu).not('grade', 'is', null);
  if (ids && ids.length) q = q.in('emp_id', ids);
  const r = await q;
  if (r.error) throw new Error('Đọc monthly_reviews lỗi: ' + r.error.message);
  return (r.data || []).filter(x => String(x.grade).trim());
}

// ── CRON 5 PHÚT ───────────────────────────────────────────────
export async function quetXepLoai(env) {
  const sb = taoSb(), hom = homNay(), tu = env.XL_TU_THANG || BAT_DAU_THANG;
  const loc = String(env.XL_LOC_MSNV || '').split(',').map(s => s.trim()).filter(Boolean);   // chỉ để chạy thử
  const kq = { moi: 0, dieuChinh: 0, nhac: 0, quaHan: 0, loi: 0 };
  let ngan = NGAN_SACH;

  const reviews = await layReviews(sb, tu, loc);
  if (!reviews.length) return kq;
  const ids = [...new Set(reviews.map(r => String(r.emp_id)))];
  const [er, rr, lr] = await Promise.all([
    sb.from('employees').select('*').in('id', ids),
    sb.from('zalo_xep_loai').select('*').gte('month_key', tu).in('emp_id', ids),
    sb.from('zalo_links').select('zalo_id,msnv').in('msnv', ids),
  ]);
  const loiDoc = er.error || rr.error || lr.error;
  if (loiDoc) throw new Error('Đọc dữ liệu lỗi: ' + loiDoc.message);
  const nvTheoId = Object.fromEntries((er.data || []).map(e => [String(e.id), e]));
  const recTheo = Object.fromEntries((rr.data || []).map(r => [r.emp_id + '|' + r.month_key, r]));
  const zaloCua = Object.fromEntries((lr.data || []).map(l => [String(l.msnv), l.zalo_id]));
  const ctxCache = {};
  const layCtx = async mk => (ctxCache[mk] = ctxCache[mk] || await taiNguCanh(sb, mk));

  // 1) tổng kết mới / báo điều chỉnh
  for (const rv of reviews) {
    const id = String(rv.emp_id), nv = nvTheoId[id];
    if (!nv) continue;
    try {
      const rec0 = recTheo[id + '|' + rv.month_key];
      const rec = await dongBo(sb, rv, rec0, hom);
      recTheo[id + '|' + rv.month_key] = rec;
      const zid = zaloCua[id];
      if (!zid) continue;                                       // chưa liên kết: chờ báo bù
      const dieuChinh = rec0 && rec0.gui_luc && rec0.grade !== rv.grade;
      if (!dieuChinh && rec.gui_luc) continue;
      if (ngan <= 0) continue;
      ngan--;
      const ok = await guiTongKet(sb, env, await layCtx(rv.month_key), nv, zid, rv, rec0 || rec, dieuChinh ? 'dieu_chinh' : 'moi');
      if (ok) dieuChinh ? kq.dieuChinh++ : kq.moi++;
    } catch (e) { kq.loi++; console.error('[xeploai] gửi tổng kết lỗi', id, e.message); }
  }

  // 2) nhắc nhở + báo quá hạn: từ 8:00 giờ VN (không phụ thuộc cron 8:00 riêng
  //    vì gửi cho cả xưởng một lúc sẽ vượt giới hạn lệnh gọi mạng)
  const gio = new Date(Date.now() + 7 * 3600e3).getUTCHours();
  if (gio >= GIO_NHAC) {
    const recs = Object.values(recTheo);
    for (const r of recs) {
      if (ngan <= 0) break;
      if (r.trang_thai !== 'cho' || !r.gui_luc || r.han < hom || r.nhac_luc === hom) continue;
      const ngayGui = new Date(new Date(r.gui_luc).getTime() + 7 * 3600e3).toISOString().slice(0, 10);   // ngày theo giờ VN
      if (ngayGui >= hom) continue;                                  // vừa gửi hôm nay: chưa nhắc
      const nv = nvTheoId[r.emp_id], zid = r.zalo_id || zaloCua[r.emp_id];
      if (!nv || !zid) continue;
      try {
        ngan--;
        const c = conNgay(r.han, hom);
        const kq2 = await guiTin(env, zid,
          `⏰ **NHẮC XÁC NHẬN XẾP LOẠI**\nBạn chưa xác nhận xếp loại ${r.grade} tháng ${thangNhan(r.month_key)} `
          + `(${c <= 0 ? 'hôm nay là hạn chót' : 'còn ' + c + ' ngày'}).\n\n` + loiYeuCau(r.grade, r.month_key, r.han));
        if (!kq2.ok) throw new Error('Zalo từ chối');
        await capNhat(sb, r.emp_id, r.month_key, { nhac_luc: hom, hoi_luc: bayGio() });
        await luuMenu(sb, zid, 'xac_nhan');
        kq.nhac++;
      } catch (e) { kq.loi++; console.error('[xeploai] nhắc lỗi', r.emp_id, e.message); }
    }
    if (ngan > 0) kq.quaHan = await baoQuaHan(sb, env, recs, nvTheoId, hom);
  }
  if (kq.moi || kq.dieuChinh || kq.nhac || kq.quaHan || kq.loi) console.log('[xeploai]', JSON.stringify(kq));
  return kq;
}

// ── BÁO QUẢN LÝ ───────────────────────────────────────────────
async function nguoiNhanBao(sb, env) {
  const ds = String(env.XAC_NHAN_BAO_MSNV || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!ds.length) return [];
  const r = await sb.from('zalo_links').select('zalo_id,msnv').in('msnv', ds);
  if (r.error) throw new Error(r.error.message);
  return (r.data || []).map(x => x.zalo_id);
}
async function baoQuanLy(sb, env, text) {
  let n = 0;
  for (const z of await nguoiNhanBao(sb, env)) {
    try { const k = await guiTin(env, z, text); if (k.ok) n++; } catch (e) { console.error('[xeploai] báo quản lý lỗi', e.message); }
  }
  return n;
}

async function baoQuaHan(sb, env, recs, nvTheoId, hom) {
  const qua = recs.filter(r => r.trang_thai === 'cho' && r.han < hom && !r.qua_han_bao);
  if (!qua.length) return 0;
  const theoThang = {};
  qua.forEach(r => { (theoThang[r.month_key] = theoThang[r.month_key] || []).push(r); });
  let text = '⏳ **QUÁ HẠN XÁC NHẬN XẾP LOẠI**';
  for (const [mk, ds] of Object.entries(theoThang)) {
    const nguoi = ds.map(r => ({ ten: (nvTheoId[r.emp_id] || {}).name || r.emp_id, kip: (nvTheoId[r.emp_id] || {}).kip, chuaVao: !r.gui_luc }));
    text += `\nTháng ${thangNhan(mk)} · ${ds.length} người chưa xác nhận:\n`
      + Object.entries(nhom(nguoi)).map(([k, v]) => `**${NHOM[k] || 'Kíp ' + k}**: ` + v.map(x => x.ten + (x.chuaVao ? ' 📵' : '')).join(', ')).join('\n')
      + (nguoi.some(x => x.chuaVao) ? '\n(📵 = chưa liên kết bot nên không nhận được tin)' : '');
  }
  const n = await baoQuanLy(sb, env, text);
  if (!n) return 0;                                             // chưa báo được thì mai thử lại
  for (const r of qua) await capNhat(sb, r.emp_id, r.month_key, { qua_han_bao: true });
  return qua.length;
}

// ── BÁO BÙ KHI NHÂN VIÊN VỪA LIÊN KẾT ─────────────────────────
export async function baoBuXepLoai(env, nv, zaloId) {
  const sb = taoSb(), hom = homNay(), tu = env.XL_TU_THANG || BAT_DAU_THANG;
  const id = String(nv.id);
  const reviews = await layReviews(sb, tu, [id]);
  if (!reviews.length) return 0;
  const rr = await sb.from('zalo_xep_loai').select('*').eq('emp_id', id).gte('month_key', tu);
  if (rr.error) throw new Error(rr.error.message);
  const recTheo = Object.fromEntries((rr.data || []).map(r => [r.month_key, r]));
  let n = 0;
  for (const rv of reviews.sort((a, b) => a.month_key.localeCompare(b.month_key))) {
    const rec = await dongBo(sb, rv, recTheo[rv.month_key], hom);
    if (rec.gui_luc) continue;
    if (await guiTongKet(sb, env, await taiNguCanh(sb, rv.month_key), nv, zaloId, rv, rec, 'bu')) n++;
  }
  return n;
}

// ── NHÂN VIÊN TRẢ LỜI ─────────────────────────────────────────
// Trả về { text } nếu đã xử lý, null nếu không phải câu trả lời xác nhận.
export async function xuLyXacNhan({ sb, env, nv, lk, text, laQL }) {
  const id = String(nv.id), hom = homNay(), tu = env.XL_TU_THANG || BAT_DAU_THANG, tx = boDau(text);
  const nha = laQL ? 'quan_ly' : 'ca_nhan';
  const rr = await sb.from('zalo_xep_loai').select('*').eq('emp_id', id).gte('month_key', tu).order('month_key', { ascending: false });
  if (rr.error) { console.error('[xeploai] đọc lỗi', rr.error.message); return null; }
  const rows = rr.data || [];
  const batMode = lk.menu === 'xac_nhan';
  if (!rows.length) { if (batMode) await luuMenu(sb, lk.zalo_id, nha); return null; }

  // 1) đang chờ nhập lý do sau khi bấm "không đồng ý"
  const cl = rows.find(r => r.cho_ly_do);
  if (cl) {
    const hetHan = !cl.xac_nhan_luc || Date.now() - new Date(cl.xac_nhan_luc).getTime() > LY_DO_MS;
    await capNhat(sb, id, cl.month_key, { cho_ly_do: false });
    if (/^\d{1,2}$/.test(text) || hetHan) return null;          // bấm số menu hoặc quá lâu: xử lý như bình thường
    const lyDo = text.slice(0, 300);
    await capNhat(sb, id, cl.month_key, { ly_do: lyDo });
    await baoQuanLy(sb, env, `💬 **Lý do không đồng ý** – ${nv.name} (${id}), xếp loại ${cl.grade} tháng ${thangNhan(cl.month_key)}:\n"${lyDo}"`);
    return { text: '✅ Đã ghi lý do của bạn, quản lý sẽ xem xét.\n\nNhắn **0** để vào menu.' };
  }

  // 2) xác định hành động
  const pend = rows.find(r => r.trang_thai === 'cho' && r.gui_luc);
  const modeOn = batMode && pend && pend.hoi_luc && Date.now() - new Date(pend.hoi_luc).getTime() < HIEU_LUC_MENU_MS;
  // Hết hiệu lực, hoặc người dùng nhắn 0 để vào menu: trả số về menu bình thường.
  // (Thiếu bước này thì sau khi nhắn 0, bấm "1" để xem Ca ngày mai sẽ bị ghi thành ĐỒNG Ý.)
  if (batMode && (!modeOn || text === '0')) await luuMenu(sb, lk.zalo_id, nha);
  let act = null;
  if (tx === 'dong y') act = 'dong_y';
  else if (tx === 'khong dong y') act = 'khong_dong_y';
  else if (modeOn && /^[123]$/.test(text)) act = { 1: 'dong_y', 2: 'xem', 3: 'khong_dong_y' }[text];
  if (!act) return null;

  // bấm chữ thì áp cho xếp loại chờ, hoặc xếp loại gần nhất đã gửi (cho phép đổi ý trước hạn)
  const dich = pend || rows.find(r => r.gui_luc && r.han >= hom);
  if (!dich) return null;
  const mk = dich.month_key;

  if (act === 'xem') {
    const [rv, ctx] = await Promise.all([
      sb.from('monthly_reviews').select('emp_id,month_key,grade,note,final_score').eq('emp_id', id).eq('month_key', mk).eq('approved', true).limit(1),
      taiNguCanh(sb, mk),
    ]);
    const r0 = (rv.data || [])[0];
    if (!r0) return null;
    await capNhat(sb, id, mk, { hoi_luc: bayGio() });
    return { text: noiDungTongKet(ctx, nv, r0) + '\n\n' + loiYeuCau(dich.grade, mk, dich.han), giuMenu: true };
  }

  const bay = bayGio(), tre = dich.han < hom ? ' (trễ hạn)' : '';
  if (act === 'dong_y') {
    await capNhat(sb, id, mk, { trang_thai: 'dong_y', xac_nhan_luc: bay, zalo_id: lk.zalo_id, cho_ly_do: false, ly_do: '' });
    await luuMenu(sb, lk.zalo_id, nha);
    return { text: `✅ Đã ghi nhận bạn **ĐỒNG Ý** xếp loại ${dich.grade} tháng ${thangNhan(mk)}${tre}\n🕒 ${gioVN(bay)}\n\n`
      + 'Nhầm? Nhắn **không đồng ý** để đổi trước hạn.\nNhắn **0** để vào menu.' };
  }
  await capNhat(sb, id, mk, { trang_thai: 'khong_dong_y', xac_nhan_luc: bay, zalo_id: lk.zalo_id, cho_ly_do: true });
  await luuMenu(sb, lk.zalo_id, nha);
  await baoQuanLy(sb, env, `🚫 **KHÔNG ĐỒNG Ý XẾP LOẠI**\n👤 ${nv.name} (${id}) – ${NHOM[nv.kip] || ''}\n`
    + `⭐ Xếp loại ${dich.grade} tháng ${thangNhan(mk)}${tre}\n🕒 ${gioVN(bay)}`);
  return { text: `📝 Đã ghi nhận bạn **KHÔNG ĐỒNG Ý** xếp loại ${dich.grade} tháng ${thangNhan(mk)}. Quản lý sẽ xem xét.\n\n`
    + '👉 Nhắn lý do ngay bây giờ (không bắt buộc): tin nhắn tiếp theo của bạn sẽ được ghi làm lý do.\nNhắn **0** để bỏ qua.' };
}

// ── MỤC 13 MENU QUẢN LÝ ───────────────────────────────────────
export async function trangThaiXacNhan(sb, tu = BAT_DAU_THANG) {   // tu: chỉ để chạy thử với tháng cũ
  const rr = await sb.from('zalo_xep_loai').select('*').gte('month_key', tu).order('month_key', { ascending: false });
  if (rr.error) throw new Error(rr.error.message);
  const rows = rr.data || [];
  if (!rows.length)
    return `✍️ **Xác nhận xếp loại**\nChưa có xếp loại nào được duyệt từ tháng ${thangNhan(BAT_DAU_THANG)} trở đi.\n`
      + 'Khi quản lý duyệt, bot sẽ tự gửi tổng kết và yêu cầu xác nhận cho từng người.';
  const mk = rows[0].month_key, cung = rows.filter(r => r.month_key === mk);
  const [er, lr] = await Promise.all([
    sb.from('employees').select('id,name,kip').order('kip').order('sort_order'),
    sb.from('zalo_links').select('msnv').not('msnv', 'is', null),
  ]);
  if (er.error || lr.error) throw new Error((er.error || lr.error).message);
  const emps = er.data || [], daLK = new Set((lr.data || []).map(l => String(l.msnv)));
  const nvId = Object.fromEntries(emps.map(e => [String(e.id), e]));
  const ten = r => (nvId[r.emp_id] || {}).name || r.emp_id;
  const dongY = cung.filter(r => r.trang_thai === 'dong_y');
  const khong = cung.filter(r => r.trang_thai === 'khong_dong_y');
  const cho = cung.filter(r => r.trang_thai === 'cho');
  const chuaVao = cho.filter(r => !r.gui_luc && !daLK.has(r.emp_id));
  const dangCho = cho.filter(r => !chuaVao.includes(r));
  const chuaDuyet = emps.filter(e => !cung.some(r => r.emp_id === String(e.id)));
  const theoKip = ds => Object.entries(nhom(ds.map(r => ({ kip: (nvId[r.emp_id] || {}).kip, ten: ten(r) }))))
    .map(([k, v]) => `${NHOM[k] || 'Kíp ' + k}: ${v.map(x => x.ten).join(', ')}`).join('\n');
  const han = cung[0].han;
  const phan = [`✍️ **Xác nhận xếp loại tháng ${thangNhan(mk)}** – hạn ${ddmm(han)}\n${cung.length} người đã được duyệt`];
  phan.push(`✅ **Đồng ý (${dongY.length})**` + (dongY.length ? ': ' + dongY.map(ten).join(', ') : ''));
  phan.push(`🚫 **Không đồng ý (${khong.length})**` + (khong.length ? '\n' + khong.map(r => `• ${ten(r)}${r.ly_do ? ' – "' + r.ly_do + '"' : ''}`).join('\n') : ''));
  phan.push(`⏳ **Chờ xác nhận (${dangCho.length})**` + (dangCho.length ? '\n' + theoKip(dangCho) : ''));
  phan.push(`📵 **Chưa liên kết bot (${chuaVao.length})** – không nhận được tin` + (chuaVao.length ? '\n' + theoKip(chuaVao) : ''));
  if (chuaDuyet.length) phan.push(`📋 Chưa được duyệt xếp loại: ${chuaDuyet.length} người`);
  return phan.join('\n\n');
}
