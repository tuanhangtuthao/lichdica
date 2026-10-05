// ═══════════════════════════════════════════════════════════════
// DỮ LIỆU + CÔNG CỤ TRA CỨU CHO BOT ZALO
// ═══════════════════════════════════════════════════════════════
// Lịch ca và tiêu chí 5S lấy từ đúng hai file web đang dùng (lich-ca.js,
// 5s-tieu-chi.js), nên bot Zalo và web không bao giờ lệch nhau.
//
// Mọi công cụ ở đây đều GẮN CỨNG MSNV của người đang nhắn - Claude không
// có tham số nào để chọn MSNV khác. Đó là thứ đảm bảo "chỉ trả lời dữ liệu
// của chính người hỏi", chứ không phải lời dặn trong prompt.
// ═══════════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';
import '../lich-ca.js';
import '../5s-tieu-chi.js';

const { getShift } = globalThis.LichCa;
const { S_DEFS, tieuChiCua, laLoiCua5S } = globalThis.TieuChi5S;

// Khoá anon này vốn đã nằm công khai trong mọi trang web, không phải bí mật.
const SB_URL = 'https://xtutpuwesganunktrxcv.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dXRwdXdlc2dhbnVua3RyeGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzQzMjksImV4cCI6MjA5MjI1MDMyOX0.0LWgIofa8QuMqP5Sjr3QdAK1tbH6aOljbqqXdrtrLc4';

export function taoSb() {
  return createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
}

// ── NGÀY GIỜ ───────────────────────────────────────────────────
// Worker chạy giờ UTC. 6h sáng ở Việt Nam là 23h hôm trước theo UTC, nên
// "hôm nay" phải tính theo giờ Việt Nam, không thì 7 tiếng mỗi ngày bot
// trả lời lệch sang hôm qua.
export function homNayVN() {
  const vn = new Date(Date.now() + 7 * 3600e3);
  return new Date(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate());
}
export const DFUL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
export function dKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addD(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
export function tuKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
export function round1(v) { return Math.round(parseFloat(v) * 10) / 10; }

// Nhãn đầy đủ để Claude không hiểu nhầm: ở xưởng này N là NGHỈ (không phải
// ca đêm) và C là ca chiều 18h-6h.
export const NHAN_CA = {
  S: 'Ca Sáng (6h-18h)', C: 'Ca Chiều (18h-6h sáng hôm sau)', N: 'Nghỉ', L: 'Nghỉ Lễ',
  HC: 'Hành Chính (7h30-16h30)', NP: 'Nghỉ Phép', VM: 'Vắng Mặt',
  UN: 'Chưa có lịch (lịch tháng này chưa chốt)', C1: 'Ca 1 (6h-14h)', C2: 'Ca 2', C3: 'Ca 3',
};
export const NHOM = { 1: 'Kíp 1', 2: 'Kíp 2', 3: 'Kíp 3', 4: 'Hành Chính / Ca Xoay' };

// Giống empShiftFor của web: lễ > lịch tay > ca cố định > kíp
export function caCua(e, d, hols, sched) {
  const dk = dKey(d);
  if (hols.some(h => h.date === dk)) return 'L';
  const ov = sched.filter(s => s.start_date <= dk && dk <= s.end_date);
  if (ov.length) { ov.sort((a, b) => b.id - a.id); return ov[0].shift; }
  const cn = d.getDay() === 0;
  if (e.fixed_shift === 'HC') return cn ? 'N' : 'HC';
  if (e.fixed_shift === 'S') return cn ? 'N' : 'S';
  if (e.fixed_shift === 'C') return cn ? 'N' : 'C';
  if (e.kip === 4) return cn ? 'N' : 'UN';
  if (e.kip >= 1 && e.kip <= 3) return getShift(e.kip, d);
  return 'UN';
}

export function gioTangCa(o) {
  let h = null;
  if (o.note) { const m = o.note.match(/^([\d.]+)h/); if (m) h = parseFloat(m[1]); }
  if (!h && o.start_time && o.end_time) {
    const [h1, m1] = o.start_time.split(':').map(Number), [h2, m2] = o.end_time.split(':').map(Number);
    const diff = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    if (diff > 0) h = diff;
  }
  return h;
}

function kiemThang(thang) {
  if (!/^\d{4}-\d{2}$/.test(thang || '')) throw new Error('thang phải dạng YYYY-MM');
  return thang;
}
function kiemNgay(k, ten) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k || '')) throw new Error(ten + ' phải dạng YYYY-MM-DD');
  return k;
}

// ── NHÂN VIÊN + LIÊN KẾT ZALO ──────────────────────────────────
export async function timNV(sb, msnv) {
  const r = await sb.from('employees').select('*').eq('id', String(msnv)).limit(1);
  if (r.error) throw new Error('Đọc nhân viên lỗi: ' + r.error.message);
  return (r.data || [])[0] || null;
}

export async function layLienKet(sb, zaloId) {
  const r = await sb.from('zalo_links').select('*').eq('zalo_id', zaloId).limit(1);
  if (r.error) throw new Error('Đọc liên kết Zalo lỗi: ' + r.error.message);
  return (r.data || [])[0] || null;
}

// Bỏ dấu, thường hoá - dùng để so chức vụ và nhận lệnh
export function boDau(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();
}

// Quản lý = chức vụ Trưởng Ca / Tổ Trưởng / Trưởng Phòng (dữ liệu ghi cả
// "Trưởng Ca" lẫn "Trưởng ca" nên phải so không phân biệt hoa thường).
const CHUC_VU_QL = ['truong ca', 'to truong', 'truong phong'];
export function laQuanLy(nv) {
  return !!nv && CHUC_VU_QL.includes(boDau(nv.role));
}

// Nhớ người dùng đang ở menu nào. Chưa chạy sql/zalo-menu.sql thì cột
// chưa có -> bỏ qua, không làm hỏng câu trả lời.
export async function luuMenu(sb, zaloId, menu) {
  const r = await sb.from('zalo_links').update({ menu }).eq('zalo_id', zaloId);
  if (r.error) console.warn('[zalo] chưa lưu được menu (đã chạy sql/zalo-menu.sql chưa?):', r.error.message);
}

// ── LIÊN KẾT AN TOÀN (cách 1-2-3 đã chốt 05/10/2026) ───────────
// 1. Nhắn MSNV -> chỉ ghi vào msnv_cho, bot hỏi "Bạn là <tên>?"
// 2. Trả lời 1 -> liên kết; MỌI tài khoản khác đang giữ MSNV đó bị gỡ và
//    được báo, để tin cá nhân (vd báo 5S) chỉ tới đúng một người.
// 3. Quản lý xem danh sách và gỡ liên kết sai (menu.js).
// Cần sql/zalo-xac-nhan.sql (msnv được để trống + cột msnv_cho).
export async function ghiChoXacNhan(sb, zaloId, msnv, tenZalo) {
  const r = await sb.from('zalo_links').upsert({
    zalo_id: zaloId, msnv_cho: String(msnv), ten_zalo: tenZalo || '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'zalo_id' });
  if (r.error) throw new Error('Lưu MSNV chờ xác nhận lỗi: ' + r.error.message);
}
export async function huyChoXacNhan(sb, zaloId) {
  const r = await sb.from('zalo_links').update({ msnv_cho: null }).eq('zalo_id', zaloId);
  if (r.error) throw new Error(r.error.message);
}
// Trả về danh sách zalo_id vừa bị gỡ khỏi MSNV này (để báo cho họ)
export async function xacNhanLienKet(sb, zaloId, msnv, tenZalo, menu) {
  const ms = String(msnv);
  const cu = await sb.from('zalo_links').select('zalo_id').eq('msnv', ms).neq('zalo_id', zaloId);
  if (cu.error) throw new Error(cu.error.message);
  const biGo = (cu.data || []).map(x => x.zalo_id);
  if (biGo.length) {
    const d = await sb.from('zalo_links').delete().in('zalo_id', biGo);
    if (d.error) throw new Error('Gỡ liên kết cũ lỗi: ' + d.error.message);
  }
  const r = await sb.from('zalo_links').update({
    msnv: ms, msnv_cho: null, ten_zalo: tenZalo || '', menu, updated_at: new Date().toISOString(),
  }).eq('zalo_id', zaloId);
  if (r.error) throw new Error('Lưu liên kết lỗi: ' + r.error.message);
  return biGo;
}
// Quản lý gỡ: xoá mọi tài khoản đang gắn MSNV này, trả về zalo_id để báo
export async function goLienKet(sb, msnv) {
  const r = await sb.from('zalo_links').delete().eq('msnv', String(msnv)).select('zalo_id');
  if (r.error) throw new Error(r.error.message);
  return (r.data || []).map(x => x.zalo_id);
}
export async function dsLienKet(sb) {
  const r = await sb.from('zalo_links').select('zalo_id,msnv,ten_zalo,updated_at').not('msnv', 'is', null);
  if (r.error) throw new Error(r.error.message);
  return r.data || [];
}

export async function luuLienKet(sb, zaloId, msnv, tenZalo) {
  const r = await sb.from('zalo_links').upsert({
    zalo_id: zaloId, msnv: String(msnv), ten_zalo: tenZalo || '',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'zalo_id' });
  if (r.error) throw new Error('Lưu liên kết Zalo lỗi: ' + r.error.message);
}

// Chặn spam đốt tiền API: giới hạn số câu hỏi TỰ DO (đi qua AI) mỗi ngày
// cho mỗi tài khoản Zalo. Trả lời theo số trong menu không qua AI nên không
// tính vào đây.
export const GIOI_HAN_NV = 10;   // nhân viên
export const GIOI_HAN_QL = 40;   // trưởng ca / tổ trưởng / trưởng phòng
export async function duocHoiTiep(sb, lk, gioiHan) {
  const nay = dKey(homNayVN());
  const so = lk.ngay_dem === nay ? (lk.so_cau || 0) : 0;
  if (so >= gioiHan) return false;
  const r = await sb.from('zalo_links')
    .update({ so_cau: so + 1, ngay_dem: nay }).eq('zalo_id', lk.zalo_id);
  if (r.error) throw new Error('Đếm câu hỏi lỗi: ' + r.error.message);
  return true;
}

// ── ĐỊNH NGHĨA CÔNG CỤ CHO CLAUDE ──────────────────────────────
// Không có tham số msnv ở bất kỳ công cụ nào - xem ghi chú đầu file.
const THANG = { type: 'string', description: 'Tháng cần tra, dạng YYYY-MM' };
export const DINH_NGHIA_CONG_CU = [
  {
    name: 'tra_lich_ca',
    description: 'Lịch ca làm việc của người đang hỏi trong một khoảng ngày (tối đa 62 ngày). '
      + 'Dùng cho "mai tôi làm ca gì", "lịch tuần sau", "thứ 5 làm gì", "tháng 10 tôi làm mấy ngày".',
    input_schema: {
      type: 'object',
      properties: {
        tu_ngay: { type: 'string', description: 'Ngày bắt đầu, YYYY-MM-DD' },
        den_ngay: { type: 'string', description: 'Ngày kết thúc, YYYY-MM-DD, không trước tu_ngay' },
      },
      required: ['tu_ngay', 'den_ngay'], additionalProperties: false,
    },
  },
  {
    name: 'tim_ngay_nghi_toi',
    description: 'Đợt ngày nghỉ gần nhất sắp tới của người đang hỏi. Dùng cho "khi nào tôi được nghỉ".',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'tra_danh_gia',
    description: 'Điểm đánh giá và xếp loại tháng của người đang hỏi (A+, A, B, C, D), số ngày đã chấm, '
      + 'đã được duyệt chưa, ghi chú của quản lý.',
    input_schema: { type: 'object', properties: { thang: THANG }, required: ['thang'], additionalProperties: false },
  },
  {
    name: 'tra_vi_pham_5s',
    description: 'Các lượt kiểm tra 5S CHƯA ĐẠT của người đang hỏi trong tháng: ngày, máy, mục chưa đạt, ghi chú.',
    input_schema: { type: 'object', properties: { thang: THANG }, required: ['thang'], additionalProperties: false },
  },
  {
    name: 'tra_tang_ca',
    description: 'Các lần tăng ca và tổng số giờ tăng ca trong tháng của người đang hỏi.',
    input_schema: { type: 'object', properties: { thang: THANG }, required: ['thang'], additionalProperties: false },
  },
  {
    name: 'tra_nghi_phep',
    description: 'Các ngày nghỉ phép / vắng mặt trong tháng của người đang hỏi.',
    input_schema: { type: 'object', properties: { thang: THANG }, required: ['thang'], additionalProperties: false },
  },
  {
    name: 'tra_tieu_chi_5s',
    description: 'Danh sách các mục kiểm tra 5S của xưởng và mô tả từng mục.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

// ── CÀI ĐẶT CÔNG CỤ ────────────────────────────────────────────
// e = dòng employees của người đang nhắn. Mọi truy vấn lọc theo e.id.
export function taoCongCu(sb, e) {
  const id = String(e.id);
  let _nen = null;
  async function nen() {           // ngày lễ + lịch tay của riêng người này
    if (_nen) return _nen;
    const [hr, sr] = await Promise.all([
      sb.from('holidays').select('*'),
      sb.from('emp_schedule').select('*').eq('emp_id', id),
    ]);
    if (hr.error || sr.error) throw new Error((hr.error || sr.error).message);
    _nen = { hols: hr.data || [], sched: sr.data || [] };
    return _nen;
  }

  const CONG_CU = {
    async tra_lich_ca({ tu_ngay, den_ngay }) {
      kiemNgay(tu_ngay, 'tu_ngay'); kiemNgay(den_ngay, 'den_ngay');
      let a = tuKey(tu_ngay), b = tuKey(den_ngay);
      if (b < a) [a, b] = [b, a];
      if ((b - a) / 864e5 > 62) b = addD(a, 62);
      const { hols, sched } = await nen();
      const ngay = [];
      for (let d = new Date(a); d <= b; d = addD(d, 1)) {
        const ma = caCua(e, d, hols, sched);
        ngay.push({ ngay: dKey(d), thu: DFUL[d.getDay()], ca: NHAN_CA[ma] || ma });
      }
      return { ngay };
    },

    async tim_ngay_nghi_toi() {
      const { hols, sched } = await nen();
      const t = homNayVN(), ds = [];
      for (let i = 0; i < 45; i++) {
        const d = addD(t, i), ma = caCua(e, d, hols, sched);
        if (ma === 'UN') break;
        if (ma === 'N' || ma === 'L') ds.push({ ngay: dKey(d), thu: DFUL[d.getDay()], ca: NHAN_CA[ma] });
        else if (ds.length) break;
      }
      return ds.length ? { dot_nghi_gan_nhat: ds }
        : { ket_qua: 'Không thấy ngày nghỉ nào trong phần lịch đã có (có thể lịch sắp tới chưa chốt).' };
    },

    async tra_danh_gia({ thang }) {
      kiemThang(thang);
      const [rr, mr, gr] = await Promise.all([
        sb.from('ratings_new').select('*').eq('emp_id', id).like('date', thang + '-%'),
        sb.from('monthly_reviews').select('*').eq('emp_id', id).eq('month_key', thang),
        sb.from('rating_config').select('*'),
      ]);
      if (rr.error || mr.error) throw new Error((rr.error || mr.error).message);
      const rs = rr.data || [], cnt = rs.length;
      const base = cnt ? round1(rs.reduce((s, r) => s + parseFloat(r.score), 0) / cnt) : null;
      const rv = (mr.data || []).find(r => r.approved) || {};
      const diem = rv.final_score != null ? parseFloat(rv.final_score) : base;
      let hang = rv.grade || null;
      if (!hang && diem != null) {
        const cfg = [...(gr.data || [])].sort((x, y) => (y.min_score || 0) - (x.min_score || 0));
        hang = (cfg.find(g => diem >= (g.min_score || 0)) || {}).grade || 'D';
      }
      if (diem == null) return { thang, ket_qua: 'Chưa có điểm đánh giá nào trong tháng này.' };
      return {
        thang, diem_tren_10: diem, phan_tram: Math.round(diem * 10), xep_loai: hang,
        so_ngay_da_cham: cnt, da_duyet: !!(rv.grade || rv.final_score != null),
        ghi_chu_quan_ly: rv.note || '',
      };
    },

    // Đếm y hệt rating.html: lượt chưa đạt = có mục !== true; khớp theo MSNV,
    // bản ghi cũ chưa có MSNV thì theo tên. s5_checks.date là cột kiểu date
    // thật nên phải lọc khoảng ngày (like bị Postgres từ chối).
    async tra_vi_pham_5s({ thang }) {
      kiemThang(thang);
      const [y, m] = thang.split('-').map(Number);
      const sau = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const r = await sb.from('s5_checks').select('*')
        .gte('date', thang + '-01').lt('date', sau).order('date');
      if (r.error) throw new Error(r.error.message);
      const ten = String(e.name || '').trim().toLowerCase();
      const ds = (r.data || [])
        .filter(x => !S_DEFS.every(d => x[d.k] === true))
        // Lỗi 5S tính cho ai: thợ / kỹ thuật / cả hai (laLoiCua5S, 5s-tieu-chi.js)
        .filter(x => laLoiCua5S(x, id, e.name));
      return {
        thang, so_lan_chua_dat: ds.length,
        chi_tiet: ds.map(x => ({
          ngay: x.date, may: x.machine_code || '',
          muc_chua_dat: tieuChiCua(x).filter(d => x[d.k] !== true).map(d => d.name),
          ghi_chu: x.note || '',
        })),
      };
    },

    async tra_tang_ca({ thang }) {
      kiemThang(thang);
      const r = await sb.from('overtime').select('*').eq('emp_id', id).like('date', thang + '-%').order('date');
      if (r.error) throw new Error(r.error.message);
      let tong = 0;
      const lan = (r.data || []).map(o => {
        const h = gioTangCa(o); if (h) tong += h;
        return { ngay: o.date, ca: o.shift === 'C' ? 'Chiều' : o.shift === 'S' ? 'Sáng' : (o.shift || ''), so_gio: h,
                 ca_ca: o.ot_type === 'full' };   // tăng ca cả ca thì không ghi số giờ
      });
      return { thang, tong_gio: round1(tong), so_lan: lan.length, lan };
    },

    async tra_nghi_phep({ thang }) {
      kiemThang(thang);
      const { sched } = await nen();
      const ds = sched
        .filter(s => (s.shift === 'NP' || s.shift === 'VM') && s.start_date.startsWith(thang))
        .map(s => ({ tu: s.start_date, den: s.end_date, loai: s.shift === 'NP' ? 'Nghỉ phép' : 'Vắng mặt' }));
      return { thang, ds };
    },

    async tra_tieu_chi_5s() {
      return { muc: S_DEFS.map((d, i) => ({ stt: i + 1, ten: d.name, mo_ta: d.desc })) };
    },
  };

  return {
    dinhNghia: DINH_NGHIA_CONG_CU,
    async chay(ten, dauVao) {
      const f = CONG_CU[ten];
      if (!f) throw new Error('Không có công cụ ' + ten);
      return f(dauVao || {});
    },
  };
}
