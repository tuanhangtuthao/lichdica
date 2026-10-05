// ═══════════════════════════════════════════════════════════════
// MENU SỐ CỦA BOT ZALO — trả lời KHÔNG qua AI (tức thì, không tốn tiền key)
// ═══════════════════════════════════════════════════════════════
// Đặc tả: worker/MENU-ZALO.md. Đổi chữ / thứ tự mục thì sửa MUC_CA_NHAN,
// MUC_QUAN_LY và hàm tương ứng bên dưới, nhớ cập nhật lại file đặc tả.
// ═══════════════════════════════════════════════════════════════
import { taoCongCu, homNayVN, dKey, addD, NHAN_CA, NHOM, DFUL, dsLienKet, boDau } from './du-lieu.js';
import { taoXuong } from './du-lieu-xuong.js';

const { S_DEFS } = globalThis.TieuChi5S;

const SO = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣'];
const ICON = { S: '☀️', C: '🌙', N: '🏠', L: '🎌', HC: '🏢', NP: '🏖️', VM: '🔴', UN: '❔', C1: '🕕', C2: '🕑', C3: '🕙' };
const NGAN = { S: 'Sáng', C: 'Chiều', N: 'Nghỉ', L: 'Nghỉ Lễ', HC: 'Hành Chính', NP: 'Nghỉ Phép',
  VM: 'Vắng Mặt', UN: 'Chưa có lịch', C1: 'Ca 1', C2: 'Ca 2', C3: 'Ca 3' };
const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const LAM = ma => !['N', 'L', 'NP', 'VM', 'UN'].includes(ma);

// Công cụ cá nhân trả nhãn đầy đủ ("Ca Sáng (6h-18h)") -> đổi ngược về mã
const MA_TU_NHAN = Object.fromEntries(Object.entries(NHAN_CA).map(([k, v]) => [v, k]));
const maCa = nhan => MA_TU_NHAN[nhan] || 'UN';

function tuKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
const ddmm = k => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const thuNgay = k => `${DFUL[tuKey(k).getDay()]}, ${ddmm(k)}`;
const thangHienTai = () => dKey(homNayVN()).slice(0, 7);
const tenThang = t => `${t.slice(5)}/${t.slice(0, 4)}`;
const gio = h => (h % 1 === 0 ? h : h.toFixed(1)) + 'h';
// "Ca Sáng (6h-18h)" -> "**Ca Sáng** (6h–18h)"
const nhanDam = nhan => { const i = nhan.indexOf(' ('); return i < 0 ? `**${nhan}**` : `**${nhan.slice(0, i)}**${nhan.slice(i).replace('-', '–')}`; };

const CUOI_NV = '\n\n↩️ Nhắn **0** về menu · nhắn số khác để xem tiếp';
const CUOI_QL_CA_NHAN = '\n\n↩️ Nhắn **0** về menu quản lý · nhắn số khác để xem tiếp';


// ── MENU ───────────────────────────────────────────────────────
const MUC_CA_NHAN = ['Ca ngày mai', 'Lịch 7 ngày tới', 'Vi phạm 5S tháng này', 'Điểm & xếp loại tháng này',
  'Ngày nghỉ sắp tới', 'Tăng ca tháng này', 'Nghỉ phép tháng này', 'Tiêu chí 5S'];
const MUC_QUAN_LY = ['Ai làm ca Sáng hôm nay', 'Ai làm ca Đêm hôm nay', 'Quân số hôm nay', 'Ai làm ca ngày mai',
  'Ai chưa được phân ca', 'Ai chưa được chấm điểm hôm nay', 'Xếp loại tháng (A/B/C/D + DS hạng C/D)',
  'Vi phạm 5S hôm nay', 'Top vi phạm 5S tháng / máy tái phạm', 'Tăng ca hôm nay / top tháng',
  'Đơn xin nghỉ đang chờ duyệt', 'Liên kết Zalo (ai đã / chưa vào bot)'];
export const SO_MUC_QL = MUC_QUAN_LY.length;          // 12
export const SO_SANG_CA_NHAN = MUC_QUAN_LY.length + 1; // 13
const CUOI_QL = `\n\n↩️ Nhắn **0** về menu quản lý · **${SO_SANG_CA_NHAN}** sang menu cá nhân`;

export function menuCaNhan(nv, laQL) {
  return `👋 Chào **${nv.name}** (${NHOM[nv.kip] || ''})\nNhắn SỐ để xem:\n\n`
    + MUC_CA_NHAN.map((m, i) => `${SO[i + 1]} ${m}`).join('\n')
    + (laQL ? `\n${SO[0]} Về menu quản lý` : `\n${SO[0]} Xem lại menu`)
    + '\n💬 Hoặc gõ câu hỏi bất kỳ, vd: "thứ 6 tuần sau tôi làm ca gì?"';
}

export function menuQuanLy(nv) {
  return `👔 Chào **${nv.name}** (${nv.role})\n**MENU QUẢN LÝ** – nhắn SỐ để xem:\n\n`
    + MUC_QUAN_LY.map((m, i) => `${SO[i + 1]} ${m}`).join('\n')
    + `\n${SO[SO_SANG_CA_NHAN]} ➜ Menu cá nhân`
    + `\n${SO[0]} Xem lại menu quản lý`
    + '\n💬 Hoặc gõ câu hỏi bất kỳ, vd: "kíp 2 tuần này ai nghỉ phép?"';
}

export const khongCoMuc = n => `Mình chưa có mục số ${n}. Nhắn **0** để xem menu nhé.`;

// ── TRẢ LỜI MENU CÁ NHÂN ───────────────────────────────────────
export async function traLoiCaNhan(sb, nv, so, laQL) {
  const cc = taoCongCu(sb, nv), t = homNayVN(), nay = dKey(t), thang = thangHienTai();
  const cuoi = laQL ? CUOI_QL_CA_NHAN : CUOI_NV;
  let s;
  switch (so) {
    case 1: {
      const mai = dKey(addD(t, 1));
      const x = (await cc.chay('tra_lich_ca', { tu_ngay: mai, den_ngay: mai })).ngay[0];
      s = `📅 **Ca ngày mai** – ${thuNgay(mai)}\n${ICON[maCa(x.ca)] || ''} ${nhanDam(x.ca)}`;
      break;
    }
    case 2: {
      const r = await cc.chay('tra_lich_ca', { tu_ngay: nay, den_ngay: dKey(addD(t, 6)) });
      const dong = r.ngay.map(x => { const m = maCa(x.ca); return `${THU[tuKey(x.ngay).getDay()].padEnd(2)} ${ddmm(x.ngay)}  ${ICON[m] || ''} ${NGAN[m] || x.ca}`; });
      const lam = r.ngay.filter(x => LAM(maCa(x.ca))).length;
      s = `📅 **Lịch 7 ngày tới**\n${dong.join('\n')}\n→ Đi làm ${lam}/7 ngày`;
      break;
    }
    case 3: {
      const r = await cc.chay('tra_vi_pham_5s', { thang });
      if (!r.so_lan_chua_dat) { s = '✅ Tháng này bạn chưa có lượt 5S nào chưa đạt. Giữ vững nhé!'; break; }
      s = `🧹 **Vi phạm 5S tháng ${tenThang(thang)}**\n⚠️ **${r.so_lan_chua_dat} lần** chưa đạt\n\n`
        + r.chi_tiet.map(x => `• ${ddmm(x.ngay)}${x.may ? ' – máy ' + x.may : ''}\n  Mục: ${x.muc_chua_dat.join(', ')}`
          + (x.ghi_chu ? `\n  Ghi chú: ${x.ghi_chu}` : '')).join('\n')
        + '\n\nXem ảnh chi tiết trên web, trang 5S.';
      break;
    }
    case 4: {
      const r = await cc.chay('tra_danh_gia', { thang });
      if (r.diem_tren_10 == null) { s = `⭐ Tháng ${tenThang(thang)} bạn chưa được chấm điểm ngày nào.`; break; }
      s = `⭐ **Đánh giá tháng ${tenThang(thang)}**\nĐiểm: **${r.diem_tren_10}/10** (${r.phan_tram}%)\n`
        + `Xếp loại: **${r.xep_loai}**${r.da_duyet ? ' (đã duyệt)' : ' (chưa duyệt)'}\nSố ngày đã chấm: ${r.so_ngay_da_cham}`
        + (r.ghi_chu_quan_ly ? `\n📝 ${r.ghi_chu_quan_ly}` : '');
      break;
    }
    case 5: {
      const r = await cc.chay('tim_ngay_nghi_toi', {});
      const ds = r.dot_nghi_gan_nhat;
      if (!ds || !ds.length) { s = '🏠 Chưa thấy ngày nghỉ nào trong phần lịch đã có (lịch sắp tới có thể chưa chốt).'; break; }
      const dau = ds[0].ngay, cuoiN = ds[ds.length - 1].ngay;
      const con = Math.round((tuKey(dau) - t) / 864e5);
      s = '🏠 **Ngày nghỉ sắp tới**\n'
        + (ds.length === 1 ? `${ds[0].thu} ${ddmm(dau)}` : `${ds[0].thu} ${ddmm(dau)} → ${ds[ds.length - 1].thu} ${ddmm(cuoiN)} (${ds.length} ngày)`)
        + '\n' + (con <= 0 ? 'Hôm nay bạn đang nghỉ 🎉' : `Còn ${con} ngày nữa`);
      break;
    }
    case 6: {
      const r = await cc.chay('tra_tang_ca', { thang });
      if (!r.so_lan) { s = `⏰ Tháng ${tenThang(thang)} bạn chưa có tăng ca.`; break; }
      const caCa = r.lan.filter(x => x.ca_ca).length;
      s = `⏰ **Tăng ca tháng ${tenThang(thang)}**\nTổng: **${gio(r.tong_gio)}**${caCa ? ` + ${caCa} lần cả ca` : ''} (${r.so_lan} lần)\n`
        + r.lan.map(x => `• ${ddmm(x.ngay)} ${x.ca} – ${x.so_gio ? gio(x.so_gio) : x.ca_ca ? 'cả ca' : '?'}`).join('\n');
      break;
    }
    case 7: {
      const r = await cc.chay('tra_nghi_phep', { thang });
      if (!r.ds.length) { s = `🏖️ Tháng ${tenThang(thang)} bạn không có ngày nghỉ phép / vắng mặt nào.`; break; }
      s = `🏖️ **Nghỉ phép / vắng mặt tháng ${tenThang(thang)}**\n`
        + r.ds.map(x => `• ${x.tu === x.den ? ddmm(x.tu) : ddmm(x.tu) + ' → ' + ddmm(x.den)}  ${x.loai}`).join('\n');
      break;
    }
    case 8:
      s = `🧹 **${S_DEFS.length} mục kiểm tra 5S**\n` + S_DEFS.map((d, i) => `${i + 1}. ${d.name}\n   ${d.desc}`).join('\n');
      break;
    default:
      return khongCoMuc(so);
  }
  return s + cuoi;
}

// ── TRẢ LỜI MENU QUẢN LÝ ───────────────────────────────────────
// Danh sách người: nhóm theo kíp, trong kíp nhóm theo chức vụ, trưởng ca lên đầu
function dsTheoKip(ds) {
  const theoKip = {};
  ds.forEach(x => { (theoKip[x.kip] = theoKip[x.kip] || []).push(x); });
  return Object.keys(theoKip).sort().map(k => {
    const nv = theoKip[k], theoCV = {};
    nv.forEach(x => { const cv = x.chuc_vu || 'Khác'; (theoCV[cv] = theoCV[cv] || []).push(x.ten); });
    const cvs = Object.keys(theoCV).sort((a, b) => (/trưởng/i.test(b) ? 1 : 0) - (/trưởng/i.test(a) ? 1 : 0));
    return `**${NHOM[k] || 'Kíp ' + k}** · ${nv.length} người\n`
      + cvs.map(cv => `${/trưởng/i.test(cv) ? '👔' : '•'} ${cv}${theoCV[cv].length > 2 ? ` (${theoCV[cv].length})` : ''}: ${theoCV[cv].join(', ')}`).join('\n');
  }).join('\n\n');
}
const tenKip = ds => ds.map(x => `${x.ten} (K${x.kip})`).join(', ');

export async function traLoiQuanLy(sb, so) {
  const x = taoXuong(sb), t = homNayVN(), nay = dKey(t), thang = thangHienTai();
  let s;
  switch (so) {
    case 1: case 2: {
      const ma = so === 1 ? 'S' : 'C';
      const r = await x.ca_trong_ngay(nay);
      const ds = r.theo_ca[ma] || [];
      const vang = [...(r.theo_ca.NP || []), ...(r.theo_ca.VM || [])];
      s = (so === 1 ? '☀️ **Ca Sáng hôm nay**' : '🌙 **Ca Đêm hôm nay** (18h–6h)') + ` – ${thuNgay(nay)}\n`
        + (ds.length ? dsTheoKip(ds) : 'Không có ai làm ca này hôm nay.')
        + `\n\n🏖️ Nghỉ phép / vắng: ${vang.length ? tenKip(vang) : 'không có'}`;
      break;
    }
    case 3: {
      const r = await x.quan_so(nay);
      s = `👥 **Quân số hôm nay** – ${thuNgay(nay)}\n`
        // menu quản lý gọi ca C là "Đêm" (mục 2) -> giữ cùng một tên
        + r.kip.map(k => `• ${k.nhom}: **${k.di_lam}/${k.tong}**${k.ca ? ` (${ICON[k.ca] || ''} ${k.ca === 'C' ? 'Đêm' : NGAN[k.ca] || k.ca})` : ''}`).join('\n')
        + `\n**Tổng đi làm: ${r.tong_di_lam}/${r.tong_nv}**`
        + `\n\n🏖️ Nghỉ phép: ${r.nghi_phep.length ? tenKip(r.nghi_phep) : 'không có'}`
        + `\n🔴 Vắng mặt: ${r.vang_mat.length ? tenKip(r.vang_mat) : 'không có'}`
        + (r.chua_phan_ca.length ? `\n❔ Chưa phân ca: ${r.chua_phan_ca.length} người (xem mục 5)` : '');
      break;
    }
    case 4: {
      const mai = dKey(addD(t, 1));
      const r = await x.ca_trong_ngay(mai);
      const dong = (ma, tieuDe) => {
        const ds = r.theo_ca[ma] || [];
        if (!ds.length) return `${tieuDe}: không có ai`;
        const theoKip = {};
        ds.forEach(v => { (theoKip[v.kip] = theoKip[v.kip] || []).push(v.ten); });
        return `${tieuDe} – ${ds.length} người\n` + Object.keys(theoKip).sort()
          .map(k => `**${NHOM[k]}** (${theoKip[k].length}): ${theoKip[k].join(', ')}`).join('\n');
      };
      const vang = [...(r.theo_ca.NP || []), ...(r.theo_ca.VM || [])];
      s = `📅 **Ca ngày mai** – ${thuNgay(mai)}\n\n${dong('S', '☀️ **Sáng**')}\n\n${dong('C', '🌙 **Đêm**')}`
        + `\n\n🏖️ Nghỉ phép / vắng: ${vang.length ? tenKip(vang) : 'không có'}`;
      break;
    }
    case 5: {
      const r = await x.quan_so(nay);
      s = r.chua_phan_ca.length
        ? `❔ **Chưa được phân ca hôm nay** – ${r.chua_phan_ca.length} người\n` + r.chua_phan_ca.map(v => `• ${v.ten}${v.chuc_vu ? ' – ' + v.chuc_vu : ''}`).join('\n')
          + '\n\nPhân ca trên web: tab Quản Lý → Phân ca.'
        : '✅ Hôm nay ai cũng đã có ca.';
      break;
    }
    case 6: {
      const r = await x.chua_cham_diem(nay);
      s = r.chua_cham.length
        ? `📝 **Chưa được chấm điểm hôm nay** – ${r.chua_cham.length} người\n(đã chấm: ${r.so_da_cham})\n\n` + dsTheoKip(r.chua_cham)
        : `✅ Hôm nay đã chấm đủ cho mọi người đi làm (${r.so_da_cham} người).`;
      break;
    }
    case 7: {
      const r = await x.xep_loai_thang(thang);
      if (!r.so_nguoi_co_diem) { s = `⭐ Tháng ${tenThang(thang)} chưa ai được chấm điểm.`; break; }
      const thuTu = ['A+', 'A', 'B', 'C', 'D'];
      const kem = r.danh_sach.filter(v => ['C', 'D'].includes(v.hang)).sort((a, b) => a.diem - b.diem);
      s = `⭐ **Xếp loại tháng ${tenThang(thang)}** – ${r.so_nguoi_co_diem} người có điểm\n`
        + thuTu.filter(h => r.theo_hang[h]).map(h => `${h}: ${r.theo_hang[h]}`).join(' · ')
        + (kem.length
          ? `\n\n⚠️ **Hạng C/D cần nhắc nhở** (${kem.length}):\n` + kem.map(v => `• ${v.ten} (K${v.kip}) – ${v.hang} · ${v.diem}`).join('\n')
          : '\n\n✅ Không ai hạng C/D.');
      break;
    }
    case 8: {
      const r = await x.vi_pham_5s(nay, nay);
      s = r.so_luot_chua_dat
        ? `🧹 **Vi phạm 5S hôm nay** – ${r.so_luot_chua_dat}/${r.so_luot_kiem} lượt chưa đạt\n\n`
          + r.chi_tiet.map(v => `• ${v.nguoi || '(không rõ)'}${v.may ? ' – máy ' + v.may : ''}\n  Mục: ${v.muc_chua_dat.join(', ')}`
            + (v.ghi_chu ? `\n  Ghi chú: ${v.ghi_chu}` : '')).join('\n')
        : `✅ Hôm nay chưa có lượt 5S nào chưa đạt (${r.so_luot_kiem} lượt đã kiểm).`;
      break;
    }
    case 9: {
      const r = await x.top_5s_thang(thang);
      if (!r.so_luot_chua_dat) { s = `✅ Tháng ${tenThang(thang)} chưa có lượt 5S nào chưa đạt (${r.so_luot_kiem} lượt đã kiểm).`; break; }
      s = `🧹 **Vi phạm 5S tháng ${tenThang(thang)}** – ${r.so_luot_chua_dat}/${r.so_luot_kiem} lượt chưa đạt\n\n**Top người:**\n`
        + r.top_nguoi.map((v, i) => `${i + 1}. ${v.ten} – ${v.lan} lần`).join('\n')
        + '\n\n**Máy tái phạm (≥2 lần):**\n'
        + (r.may_tai_pham.length ? r.may_tai_pham.map(v => `• ${v.may} – ${v.lan} lần`).join('\n') : 'chưa có máy nào');
      break;
    }
    case 10: {
      const [h, m] = await Promise.all([x.tang_ca(nay, nay), x.tang_ca(thang + '-01', nay)]);
      const moTa = v => v.so_gio ? gio(v.so_gio) : v.ca_ca ? 'cả ca' : '?';
      s = `⏰ **Tăng ca hôm nay** – ${thuNgay(nay)}\n`
        + (h.chi_tiet.length ? h.chi_tiet.map(v => `• ${v.ten} – ${v.ca} ${moTa(v)}`).join('\n') : 'Không có ai.')
        + `\n\n🏆 **Top tăng ca tháng ${tenThang(thang)}**\n`
        + (m.theo_nguoi.length ? m.theo_nguoi.slice(0, 5).map((v, i) =>
          `${i + 1}. ${v.ten} – ${gio(v.gio)}${v.ca_ca ? ` + ${v.ca_ca} lần cả ca` : ''}`).join('\n') : 'Chưa có ai.');
      break;
    }
    case 11: {
      const r = await x.don_cho_duyet();
      s = r.so_don
        ? `📨 **Đơn xin nghỉ chờ duyệt** – ${r.so_don} đơn\n`
          + r.don.map(d => `• ${d.ten}: ${d.tu === d.den ? ddmm(d.tu) : ddmm(d.tu) + ' → ' + ddmm(d.den)}${d.ly_do ? '\n  Lý do: ' + d.ly_do : ''}`).join('\n')
          + '\n\nDuyệt trên web: tab Quản Lý.'
        : '✅ Không có đơn xin nghỉ nào đang chờ duyệt.';
      break;
    }
    case 12: {
      s = await traLoiLienKet(sb);
      break;
    }
    default:
      return khongCoMuc(so);
  }
  return s + CUOI_QL;
}

// Tên Zalo khác hẳn tên nhân viên (không chung chữ nào) -> nên kiểm tra.
// Chỉ là gợi ý: nhiều người đặt tên Zalo là biệt danh.
function tenKhop(tenZalo, tenNV) {
  const a = new Set(boDau(tenNV).split(' '));
  return boDau(tenZalo).split(' ').some(w => w.length > 1 && a.has(w));
}

async function traLoiLienKet(sb) {
  const [lk, er] = await Promise.all([
    dsLienKet(sb),
    sb.from('employees').select('id,name,kip').order('kip').order('sort_order'),
  ]);
  if (er.error) throw new Error(er.error.message);
  const emps = er.data || [];
  const theoMs = {};
  lk.forEach(l => { (theoMs[l.msnv] = theoMs[l.msnv] || []).push(l); });
  const ok = [], kiemTra = [], chua = [];
  emps.forEach(e => {
    const ds = theoMs[String(e.id)] || [];
    if (!ds.length) { chua.push(e); return; }
    ds.forEach(l => {
      const dong = `• ${e.name} (${e.id}) ← Zalo "${l.ten_zalo || '?'}"`;
      if (ds.length > 1) kiemTra.push(dong + ' – trùng MSNV');
      else if (!tenKhop(l.ten_zalo, e.name)) kiemTra.push(dong + ' – tên khác');
      else ok.push(dong);
    });
  });
  const daLK = emps.length - chua.length;
  const theoKip = {};
  chua.forEach(e => { (theoKip[e.kip] = theoKip[e.kip] || []).push(e.name); });
  const phan = [`🔗 **Liên kết Zalo** – ${daLK}/${emps.length} nhân viên`];
  // Cả xưởng liên kết xong thì danh sách này dài ~44 dòng, vượt 2000 ký tự
  // của Zalo -> quá 10 người chỉ ghi số; người cần kiểm tra vẫn ghi đủ tên.
  if (ok.length) phan.push(ok.length <= 10 ? ok.join('\n') : `✅ Đã liên kết đúng: ${ok.length} người`);
  if (kiemTra.length) phan.push('⚠️ **Nên kiểm tra:**\n' + kiemTra.join('\n'));
  phan.push(chua.length
    ? `❌ **Chưa liên kết (${chua.length})** – chưa nhận được tin cá nhân:\n`
      + Object.keys(theoKip).sort().map(k => `${NHOM[k]}: ${theoKip[k].join(', ')}`).join('\n')
    : '✅ Cả xưởng đã liên kết.');
  phan.push('Gỡ liên kết sai: nhắn **gỡ <MSNV>**, vd: gỡ 1050');
  return phan.join('\n\n');
}
