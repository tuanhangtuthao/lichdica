// ═══════════════════════════════════════════════════════════════
// DỮ LIỆU TOÀN XƯỞNG — chỉ dành cho quản lý (Trưởng Ca / Tổ Trưởng / Trưởng Phòng)
// ═══════════════════════════════════════════════════════════════
// Dùng chung cho MENU QUẢN LÝ (menu.js) và công cụ AI của quản lý, nên câu
// trả lời theo số và câu trả lời của AI luôn ra cùng một con số.
// Theo đặc tả: mọi quản lý đều xem được cả xưởng (worker/MENU-ZALO.md).
// ═══════════════════════════════════════════════════════════════
import {
  caCua, gioTangCa, round1, tuKey, dKey, DFUL, NHAN_CA, NHOM, timNV, taoCongCu, boDau,
  DINH_NGHIA_CONG_CU,
} from './du-lieu.js';

const { S_DEFS, tieuChiCua, nguoiChiu5S } = globalThis.TieuChi5S;
const { getShift } = globalThis.LichCa;
const DI_LAM = ma => !['N', 'L', 'NP', 'VM', 'UN'].includes(ma);

function kiemNgay(k, ten) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k || '')) throw new Error(ten + ' phải dạng YYYY-MM-DD');
  return k;
}
function kiemThang(t) {
  if (!/^\d{4}-\d{2}$/.test(t || '')) throw new Error('thang phải dạng YYYY-MM');
  return t;
}
function thangSau(thang) {
  const [y, m] = thang.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
const mucHong = x => tieuChiCua(x).filter(d => x[d.k] !== true).map(d => d.name);   // máy / khu vực
const chuaDat = x => !S_DEFS.every(d => x[d.k] === true);

export function taoXuong(sb) {
  let _nen = null;
  async function nen() {
    if (_nen) return _nen;
    const [er, hr, sr, gr] = await Promise.all([
      sb.from('employees').select('*').order('kip').order('sort_order'),
      sb.from('holidays').select('*'),
      sb.from('emp_schedule').select('*'),
      sb.from('rating_config').select('*'),
    ]);
    const loi = er.error || hr.error || sr.error;
    if (loi) throw new Error(loi.message);
    const schedTheoNV = {};
    (sr.data || []).forEach(s => { (schedTheoNV[s.emp_id] = schedTheoNV[s.emp_id] || []).push(s); });
    _nen = { emps: er.data || [], hols: hr.data || [], schedTheoNV, grade: gr.data || [] };
    return _nen;
  }
  const tenNV = (emps, id) => (emps.find(e => String(e.id) === String(id)) || {}).name;

  // Ca của từng nhân viên trong một ngày
  async function caNgay(dk) {
    kiemNgay(dk, 'ngay');
    const { emps, hols, schedTheoNV } = await nen();
    const d = tuKey(dk);
    return emps.map(e => ({
      id: String(e.id), ten: e.name, kip: e.kip, chuc_vu: e.role || '',
      ma: caCua(e, d, hols, schedTheoNV[e.id] || []),
    }));
  }

  const API = {
    // Ai làm ca nào trong ngày, nhóm theo mã ca
    async ca_trong_ngay(dk) {
      const ds = await caNgay(dk), d = tuKey(dk), out = {};
      ds.forEach(x => { (out[x.ma] = out[x.ma] || []).push(x); });
      return { ngay: dk, thu: DFUL[d.getDay()], theo_ca: out, nhan_ca: NHAN_CA };
    },

    async quan_so(dk) {
      const ds = await caNgay(dk), d = tuKey(dk);
      const kip = [1, 2, 3, 4].map(k => {
        const nv = ds.filter(x => x.kip === k);
        const ma = nv.filter(x => DI_LAM(x.ma)).map(x => x.ma);
        return { kip: k, nhom: NHOM[k], tong: nv.length, di_lam: ma.length,
          ca: k <= 3 ? getShift(k, d) : null };
      });
      return {
        ngay: dk, thu: DFUL[d.getDay()], kip,
        tong_di_lam: kip.reduce((s, k) => s + k.di_lam, 0), tong_nv: ds.length,
        nghi_phep: ds.filter(x => x.ma === 'NP').map(x => ({ ten: x.ten, kip: x.kip })),
        vang_mat: ds.filter(x => x.ma === 'VM').map(x => ({ ten: x.ten, kip: x.kip })),
        chua_phan_ca: ds.filter(x => x.ma === 'UN').map(x => ({ ten: x.ten, chuc_vu: x.chuc_vu })),
      };
    },

    // Người đi làm trong ngày mà chưa có điểm. Bỏ Trưởng Phòng (người chấm).
    async chua_cham_diem(dk) {
      const ds = await caNgay(dk);
      const r = await sb.from('ratings_new').select('emp_id').eq('date', dk);
      if (r.error) throw new Error(r.error.message);
      const daCham = new Set((r.data || []).map(x => String(x.emp_id)));
      const thieu = ds.filter(x => DI_LAM(x.ma) && !daCham.has(x.id) && boDau(x.chuc_vu) !== 'truong phong');
      return { ngay: dk, so_da_cham: daCham.size, chua_cham: thieu.map(x => ({ ten: x.ten, kip: x.kip, chuc_vu: x.chuc_vu })) };
    },

    // Cùng công thức với xep_hang_danh_gia của tro-ly.js / rating.html
    async xep_loai_thang(thang) {
      kiemThang(thang);
      const { emps, grade } = await nen();
      const [rr, mr] = await Promise.all([
        sb.from('ratings_new').select('emp_id,score').like('date', thang + '-%'),
        sb.from('monthly_reviews').select('*').eq('month_key', thang),
      ]);
      if (rr.error || mr.error) throw new Error((rr.error || mr.error).message);
      const tho = {};
      (rr.data || []).forEach(r => { (tho[r.emp_id] = tho[r.emp_id] || []).push(parseFloat(r.score)); });
      const duyet = {};
      (mr.data || []).forEach(r => { if (r.approved) duyet[r.emp_id] = r; });
      const cfg = [...grade].sort((a, b) => (b.min_score || 0) - (a.min_score || 0));
      const ds = [];
      emps.forEach(e => {
        const a = tho[e.id] || [];
        const base = a.length ? round1(a.reduce((s, v) => s + v, 0) / a.length) : null;
        const rv = duyet[e.id] || {};
        const diem = rv.final_score != null ? parseFloat(rv.final_score) : base;
        if (diem == null) return;
        const hang = rv.grade || (cfg.find(g => diem >= (g.min_score || 0)) || {}).grade || 'D';
        ds.push({ ten: e.name, kip: e.kip, diem, hang, da_duyet: !!(rv.grade || rv.final_score != null) });
      });
      ds.sort((a, b) => b.diem - a.diem);
      const theo_hang = {};
      ds.forEach(x => { theo_hang[x.hang] = (theo_hang[x.hang] || 0) + 1; });
      return { thang, so_nguoi_co_diem: ds.length, theo_hang, danh_sach: ds };
    },

    // s5_checks.date là cột kiểu date thật -> lọc khoảng ngày, không dùng like
    async vi_pham_5s(tu, den) {
      kiemNgay(tu, 'tu_ngay'); kiemNgay(den, 'den_ngay');
      const r = await sb.from('s5_checks').select('*').gte('date', tu).lte('date', den).order('date');
      if (r.error) throw new Error(r.error.message);
      const tong = (r.data || []).length;
      const ds = (r.data || []).filter(chuaDat).map(x => ({
        // người chịu lỗi: kỹ thuật nếu máy đang có kỹ thuật dùng (nguoiChiu5S)
        ngay: x.date, ca: x.shift || '', may: x.machine_code || '', nguoi: nguoiChiu5S(x).ten || '',
        msnv: nguoiChiu5S(x).msnv || '', vai_tro: nguoiChiu5S(x).vai,
        muc_chua_dat: mucHong(x), ghi_chu: x.note || '', nguoi_kiem: x.inspector || '',
      }));
      return { tu_ngay: tu, den_ngay: den, so_luot_kiem: tong, so_luot_chua_dat: ds.length, chi_tiet: ds };
    },

    async top_5s_thang(thang) {
      kiemThang(thang);
      const v = await API.vi_pham_5s(thang + '-01', dKey(new Date(tuKey(thangSau(thang)) - 864e5)));
      const nguoi = {}, may = {};
      v.chi_tiet.forEach(x => {
        const k = x.msnv || x.nguoi || '(không rõ)';
        nguoi[k] = nguoi[k] || { ten: x.nguoi || k, lan: 0 }; nguoi[k].lan++;
        if (x.may) { may[x.may] = (may[x.may] || 0) + 1; }
      });
      return {
        thang, so_luot_kiem: v.so_luot_kiem, so_luot_chua_dat: v.so_luot_chua_dat,
        top_nguoi: Object.values(nguoi).sort((a, b) => b.lan - a.lan).slice(0, 5),
        may_tai_pham: Object.entries(may).filter(([, n]) => n >= 2)
          .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m, n]) => ({ may: m, lan: n })),
      };
    },

    // overtime.date là cột text YYYY-MM-DD -> gte/lte theo chuỗi vẫn đúng
    async tang_ca(tu, den) {
      kiemNgay(tu, 'tu_ngay'); kiemNgay(den, 'den_ngay');
      const r = await sb.from('overtime').select('*').gte('date', tu).lte('date', den).order('date');
      if (r.error) throw new Error(r.error.message);
      const ds = (r.data || []).map(o => ({
        ngay: o.date, ten: o.emp_name || '', msnv: o.emp_id || '',
        ca: o.shift === 'C' ? 'Chiều' : o.shift === 'S' ? 'Sáng' : (o.shift || ''),
        so_gio: gioTangCa(o), ca_ca: o.ot_type === 'full', ghi_chu: o.note || '',
      }));
      const tong = {};
      ds.forEach(x => {
        const k = x.msnv || x.ten;
        tong[k] = tong[k] || { ten: x.ten, gio: 0, lan: 0, ca_ca: 0 };
        tong[k].lan++; if (x.so_gio) tong[k].gio += x.so_gio; if (x.ca_ca) tong[k].ca_ca++;
      });
      return {
        tu_ngay: tu, den_ngay: den, so_lan: ds.length, chi_tiet: ds,
        theo_nguoi: Object.values(tong).map(t => ({ ...t, gio: round1(t.gio) }))
          .sort((a, b) => (b.gio + b.ca_ca * 12) - (a.gio + a.ca_ca * 12)),
      };
    },

    async don_cho_duyet() {
      const r = await sb.from('leave_requests').select('*').eq('status', 'pending').order('created_at');
      if (r.error) throw new Error(r.error.message);
      return { so_don: (r.data || []).length,
        don: (r.data || []).map(d => ({ ten: d.emp_name, msnv: d.emp_id, tu: d.start_date, den: d.end_date, ly_do: d.reason || '' })) };
    },

    async tim_nhan_vien(tuKhoa) {
      const { emps } = await nen();
      const q = boDau(tuKhoa);
      if (!q) throw new Error('tu_khoa trống');
      const ds = emps.filter(e => String(e.id) === q.trim() || boDau(e.name).includes(q))
        .slice(0, 10).map(e => ({ msnv: String(e.id), ten: e.name, kip: e.kip, nhom: NHOM[e.kip], chuc_vu: e.role || '' }));
      return { tu_khoa: tuKhoa, ket_qua: ds };
    },

    // Dữ liệu cá nhân của BẤT KỲ ai - dùng lại đúng công cụ cá nhân
    async du_lieu_nhan_vien(msnv, ten, dauVao) {
      const e = await timNV(sb, msnv);
      if (!e) return { loi: 'Không có MSNV ' + msnv };
      const kq = await taoCongCu(sb, e).chay(ten, dauVao);
      return { nhan_vien: { msnv: String(e.id), ten: e.name, kip: e.kip }, ...kq };
    },
  };
  return API;
}

// ── CÔNG CỤ AI CHO QUẢN LÝ ─────────────────────────────────────
// = công cụ cá nhân (dữ liệu của chính quản lý) + công cụ toàn xưởng.
const NGAY = { type: 'string', description: 'YYYY-MM-DD' };
const THANG = { type: 'string', description: 'YYYY-MM' };
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const LOAI_CA_NHAN = {
  lich_ca: 'tra_lich_ca', ngay_nghi_toi: 'tim_ngay_nghi_toi', danh_gia: 'tra_danh_gia',
  vi_pham_5s: 'tra_vi_pham_5s', tang_ca: 'tra_tang_ca', nghi_phep: 'tra_nghi_phep',
};

const DINH_NGHIA_XUONG = [
  { name: 'tim_nhan_vien', description: 'Tìm nhân viên theo tên (không cần dấu) hoặc MSNV để lấy MSNV. Dùng trước khi tra dữ liệu một người cụ thể.',
    input_schema: obj({ tu_khoa: { type: 'string' } }, ['tu_khoa']) },
  { name: 'du_lieu_nhan_vien', description: 'Dữ liệu cá nhân của MỘT nhân viên bất kỳ: lich_ca (cần tu_ngay, den_ngay), ngay_nghi_toi, danh_gia / vi_pham_5s / tang_ca / nghi_phep (cần thang).',
    input_schema: obj({ msnv: { type: 'string' }, loai: { type: 'string', enum: Object.keys(LOAI_CA_NHAN) },
      tu_ngay: NGAY, den_ngay: NGAY, thang: THANG }, ['msnv', 'loai']) },
  { name: 'ca_trong_ngay', description: 'Cả xưởng trong một ngày: ai làm Ca Sáng, ai Ca Chiều / Ca Tối / ca đêm (C, 18h-6h), ai Nghỉ, Hành Chính, Nghỉ Phép, Vắng Mặt, Chưa phân ca (UN).',
    input_schema: obj({ ngay: NGAY }, ['ngay']) },
  { name: 'quan_so', description: 'Quân số một ngày: mỗi kíp đi làm bao nhiêu / tổng, tổng đi làm, ai nghỉ phép, ai vắng mặt, ai chưa phân ca.',
    input_schema: obj({ ngay: NGAY }, ['ngay']) },
  { name: 'chua_cham_diem', description: 'Ai đi làm trong ngày mà chưa được chấm điểm đánh giá.',
    input_schema: obj({ ngay: NGAY }, ['ngay']) },
  { name: 'xep_loai_thang', description: 'Điểm và xếp loại (A+, A, B, C, D) của cả xưởng trong tháng, số người mỗi hạng.',
    input_schema: obj({ thang: THANG }, ['thang']) },
  { name: 'vi_pham_5s_xuong', description: 'Các lượt kiểm tra 5S chưa đạt của cả xưởng trong khoảng ngày: ai, máy, mục, ghi chú.',
    input_schema: obj({ tu_ngay: NGAY, den_ngay: NGAY }, ['tu_ngay', 'den_ngay']) },
  { name: 'top_5s_thang', description: 'Top người vi phạm 5S và máy hay tái phạm trong tháng.',
    input_schema: obj({ thang: THANG }, ['thang']) },
  { name: 'tang_ca_xuong', description: 'Ai tăng ca trong khoảng ngày, bao nhiêu giờ, và tổng theo người.',
    input_schema: obj({ tu_ngay: NGAY, den_ngay: NGAY }, ['tu_ngay', 'den_ngay']) },
  { name: 'don_xin_nghi_cho_duyet', description: 'Các đơn xin nghỉ đang chờ duyệt.', input_schema: obj({}) },
];

export function taoCongCuQuanLy(sb, nv) {
  const caNhan = taoCongCu(sb, nv), x = taoXuong(sb);
  const CHAY = {
    tim_nhan_vien: a => x.tim_nhan_vien(a.tu_khoa),
    du_lieu_nhan_vien: a => {
      const ten = LOAI_CA_NHAN[a.loai];
      if (!ten) throw new Error('loai không hợp lệ');
      return x.du_lieu_nhan_vien(a.msnv, ten, { tu_ngay: a.tu_ngay, den_ngay: a.den_ngay, thang: a.thang });
    },
    ca_trong_ngay: a => x.ca_trong_ngay(a.ngay),
    quan_so: a => x.quan_so(a.ngay),
    chua_cham_diem: a => x.chua_cham_diem(a.ngay),
    xep_loai_thang: a => x.xep_loai_thang(a.thang),
    vi_pham_5s_xuong: a => x.vi_pham_5s(a.tu_ngay, a.den_ngay),
    top_5s_thang: a => x.top_5s_thang(a.thang),
    tang_ca_xuong: a => x.tang_ca(a.tu_ngay, a.den_ngay),
    don_xin_nghi_cho_duyet: () => x.don_cho_duyet(),
  };
  return {
    dinhNghia: [...DINH_NGHIA_CONG_CU, ...DINH_NGHIA_XUONG],
    async chay(ten, dauVao) {
      if (CHAY[ten]) return CHAY[ten](dauVao || {});
      return caNhan.chay(ten, dauVao);
    },
  };
}
