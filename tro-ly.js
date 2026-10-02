// ═══════════════════════════════════════════════════════════════
// TRỢ LÝ - BONG BÓNG CHAT DÙNG CHUNG
// ═══════════════════════════════════════════════════════════════
// Nhúng vào trang nào thì trang đó có bong bóng chat ở góc dưới bên phải.
//
//   <script src="lich-ca.js"></script>       (cần: getShift)
//   <script src="5s-tieu-chi.js"></script>   (cần: S_DEFS)
//   <script src="tro-ly.js"></script>
//
// Tự tạo client Supabase riêng và bọc trong IIFE nên không đụng biến nào của
// trang chủ nhà. Mọi CSS đều nằm dưới #tl-root để không đè style trang chủ.
//
// z-index 9000/9500: thấp hơn màn khoá của trang 5S và Tài Liệu (99999) nên
// chưa mở khoá thì bong bóng bị màn khoá che, đúng ý - không hỏi được dữ liệu
// khi chưa qua cửa.
//
// ĐỔI CÂU TRẢ LỜI / CÂU HỎI NHANH: sửa trong phần BỘ MÁY bên dưới (TOOLS,
// BRAIN_LOCAL, defaultChips). Trước đây phần này nằm trong chatbot.html.
//
// GẮN CLAUDE API: viết BRAIN_CLAUDE cùng chữ ký answer(câuHỏi, ctx) rồi đổi
// dòng `const BRAIN = BRAIN_LOCAL;`. Giao diện và tầng TOOLS giữ nguyên.
// ═══════════════════════════════════════════════════════════════
(function () {
'use strict';
if (window.__troLyDaNap) return;          // phòng khi một trang nhúng hai lần
window.__troLyDaNap = true;

if (typeof supabase === 'undefined') { console.warn('[Trợ Lý] thiếu supabase-js'); return; }
if (typeof getShift === 'undefined')  { console.warn('[Trợ Lý] thiếu lich-ca.js'); return; }
if (typeof S_DEFS === 'undefined')    { console.warn('[Trợ Lý] thiếu 5s-tieu-chi.js'); return; }

const SB_URL = 'https://xtutpuwesganunktrxcv.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0dXRwdXdlc2dhbnVua3RyeGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NzQzMjksImV4cCI6MjA5MjI1MDMyOX0.0LWgIofa8QuMqP5Sjr3QdAK1tbH6aOljbqqXdrtrLc4';
const sb = supabase.createClient(SB_URL, SB_KEY);

// ═══════════════════════════════════════════════════════════════
// BỘ MÁY  (nguyên văn từ chatbot.html cũ)
// ═══════════════════════════════════════════════════════════════
const SLBL  = {S:'☀️ Ca Sáng',C:'🌙 Ca Chiều',N:'🏠 Nghỉ',L:'🎌 Nghỉ Lễ',HC:'🏢 Hành Chính',
               NP:'🏖️ Nghỉ Phép',VM:'🔴 Vắng Mặt',UN:'– Chưa có lịch',C1:'① Ca 1 (6h-14h)',
               C2:'② Ca 2',C3:'③ Ca 3'};
const SHORT = {S:'Ca Sáng',C:'Ca Chiều',N:'Nghỉ',L:'Nghỉ Lễ',HC:'Hành Chính',NP:'Nghỉ Phép',
               VM:'Vắng Mặt',UN:'chưa có lịch',C1:'Ca 1',C2:'Ca 2',C3:'Ca 3'};
const GRP_LABEL = {1:'Kíp 1',2:'Kíp 2',3:'Kíp 3',4:'HC / Ca Xoay'};
const DFUL = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
const WORK  = s => s!=='N' && s!=='L' && s!=='NP' && s!=='VM' && s!=='UN';

function dKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function mKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
function today(){const t=new Date();t.setHours(0,0,0,0);return t;}
function addD(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function fmtD(d){return `${d.getDate()}/${d.getMonth()+1}`;}
function fmtDay(d){
  const t=today(), diff=Math.round((d-t)/864e5);
  if(diff===0) return 'Hôm nay '+fmtD(d);
  if(diff===1) return 'Ngày mai '+fmtD(d);
  if(diff===-1)return 'Hôm qua '+fmtD(d);
  return DFUL[d.getDay()]+' '+fmtD(d);
}
function round1(v){return Math.round(parseFloat(v)*10)/10;}
function hhmm(h){return h%1===0?h+'h':h.toFixed(1)+'h';}
function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function chip(s){return `<span class="chip ch${s}">${SLBL[s]||s}</span>`;}
function gbClass(g){return 'gb-'+(g==='A+'?'Ap':g);}
function gbadge(g){return `<span class="gb ${gbClass(g)}">${esc(g)}</span>`;}

// Bỏ dấu tiếng Việt + chuẩn hoá, để "ca cua toi hom nay" cũng khớp được.
function norm(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/đ/g,'d').replace(/[^a-z0-9/\s]/g,' ').replace(/\s+/g,' ').trim();
}

function empShiftFor(e, d, dk, HOLS, SCHED){
  if(HOLS.some(h=>h.date===dk)) return 'L';
  const isSun = d.getDay()===0;
  const ov = SCHED.filter(s=>s.emp_id===e.id && s.start_date<=dk && dk<=s.end_date);
  if(ov.length){ ov.sort((a,b)=>b.id-a.id); return ov[0].shift; }
  if(e.fixed_shift==='HC') return isSun?'N':'HC';
  if(e.fixed_shift==='S')  return isSun?'N':'S';
  if(e.fixed_shift==='C')  return isSun?'N':'C';
  if(e.kip===4) return isSun?'N':'UN';
  if(e.kip>=1&&e.kip<=3) return getShift(e.kip,d);
  return 'UN';
}

function otHours(o){
  let h=null;
  if(o.note){ const m=o.note.match(/^([\d.]+)h/); if(m) h=parseFloat(m[1]); }
  if(!h && o.start_time && o.end_time){
    const [h1,m1]=o.start_time.split(':').map(Number),[h2,m2]=o.end_time.split(':').map(Number);
    const diff=((h2*60+m2)-(h1*60+m1))/60; if(diff>0) h=diff;
  }
  return h;
}

// ═══════════════════════════════════════════════════════════════
// TẦNG 1 - DỮ LIỆU
// ═══════════════════════════════════════════════════════════════
const DB = { emps:null, hols:null, sched:null, grade:null, docs:null, ot:{}, s5:{} };

async function loadCore(){
  if(DB.emps) return;
  const [er,hr,sr,gr] = await Promise.all([
    sb.from('employees').select('*').order('kip').order('sort_order'),
    sb.from('holidays').select('*'),
    sb.from('emp_schedule').select('*'),
    sb.from('rating_config').select('*'),
  ]);
  if(er.error) throw new Error(er.error.message);
  DB.emps  = er.data||[];
  DB.hols  = hr.data||[];
  DB.sched = sr.data||[];
  DB.grade = gr.data||[];
}
async function loadOt(monthKey){
  if(DB.ot[monthKey]) return DB.ot[monthKey];
  const r = await sb.from('overtime').select('*').like('date', monthKey+'-%').order('date');
  DB.ot[monthKey] = r.data||[];
  return DB.ot[monthKey];
}
async function loadDocs(){
  if(DB.docs) return DB.docs;
  const r = await sb.from('huong_dan_videos').select('*').order('nhom').order('sort_order');
  DB.docs = r.error ? [] : (r.data||[]);
  return DB.docs;
}
// Chỉ giữ lượt CHƯA ĐẠT - giống cách rating.html lọc, để con số "số lần vi
// phạm" trên chatbot và trên trang Đánh Giá luôn bằng nhau.
async function loadS5(monthKey){
  if(DB.s5[monthKey]) return DB.s5[monthKey];
  // s5_checks.date là cột kiểu date THẬT, không lọc bằng like được
  // (Postgres báo "operator does not exist: date ~~ unknown"), phải dùng
  // khoảng ngày. Khác overtime.date / ratings_new.date đang là cột text -
  // chỗ đó like chạy bình thường nên đừng copy ngược lại.
  const [y,m] = monthKey.split('-').map(Number);
  const sau = m===12 ? `${y+1}-01-01` : `${y}-${String(m+1).padStart(2,'0')}-01`;
  const r = await sb.from('s5_checks').select('*')
              .gte('date', monthKey+'-01').lt('date', sau).order('date');
  if(r.error) throw new Error('Đọc dữ liệu 5S lỗi: '+r.error.message);
  DB.s5[monthKey] = (r.data||[]).filter(x => !S_DEFS.every(d => x[d.k] === true));
  return DB.s5[monthKey];
}
function s5MucHong(r){ return S_DEFS.filter(d => r[d.k] !== true); }
// Khớp theo MSNV trước; bản ghi cũ chưa có MSNV thì đối chiếu theo tên.
function s5CuaNguoi(rows, empId, empName){
  const ten = String(empName||'').trim().toLowerCase();
  return rows.filter(r => r.worker_id
      ? String(r.worker_id) === String(empId)
      : (ten && String(r.worker_name||'').trim().toLowerCase() === ten)
    ).sort((a,b)=>a.date.localeCompare(b.date));
}

function findEmp(id){ return DB.emps.find(e=>String(e.id)===String(id)) || null; }
function getGrade(score){
  const s=[...DB.grade].sort((a,b)=>(b.min_score||0)-(a.min_score||0));
  for(const g of s){ if(score>=(g.min_score||0)) return g.grade; }
  return 'D';
}

// ═══════════════════════════════════════════════════════════════
// TẦNG 2 - TOOL
// Đây chính là danh sách hàm sẽ khai báo cho Claude khi gắn API thật.
// Mỗi hàm nhận tham số đơn giản, trả về dữ liệu thuần (không HTML).
// ═══════════════════════════════════════════════════════════════
const TOOLS = {

  async tra_lich_ca({msnv, tu_ngay, den_ngay}){
    await loadCore();
    const e = findEmp(msnv); if(!e) return {loi:'khong_thay_nv'};
    const out=[];
    for(let d=new Date(tu_ngay); d<=den_ngay; d=addD(d,1)){
      const dk=dKey(d);
      out.push({ngay:dk, thu:DFUL[d.getDay()], ca:empShiftFor(e,d,dk,DB.hols,DB.sched)});
    }
    return {nhan_vien:{id:e.id,ten:e.name,kip:e.kip,role:e.role}, ngay:out};
  },

  async tim_ngay_nghi_toi({msnv, so_ngay=45}){
    await loadCore();
    const e = findEmp(msnv); if(!e) return {loi:'khong_thay_nv'};
    const t=today(), ds=[];
    for(let i=0;i<so_ngay;i++){
      const d=addD(t,i), dk=dKey(d), s=empShiftFor(e,d,dk,DB.hols,DB.sched);
      if(s==='N'||s==='L') ds.push({ngay:dk, thu:DFUL[d.getDay()], ca:s});
      else if(ds.length) break;
      if(s==='UN') break;
    }
    return {nhan_vien:{ten:e.name}, ngay_nghi:ds};
  },

  async tra_tang_ca({msnv, thang}){
    await loadCore();
    const e = findEmp(msnv); if(!e) return {loi:'khong_thay_nv'};
    const ots=(await loadOt(thang)).filter(o=>String(o.emp_id)===String(msnv));
    let tong=0; const ds=ots.map(o=>{const h=otHours(o); if(h)tong+=h;
      return {ngay:o.date, ca:o.shift, gio:h, ghi_chu:o.note||''};});
    return {nhan_vien:{ten:e.name}, thang, tong_gio:round1(tong), lan:ds};
  },

  async tra_nghi_phep({msnv, thang}){
    await loadCore();
    const e = findEmp(msnv); if(!e) return {loi:'khong_thay_nv'};
    const ds=DB.sched.filter(s=>String(s.emp_id)===String(msnv)
      && (s.shift==='NP'||s.shift==='VM') && s.start_date.startsWith(thang))
      .map(s=>({tu:s.start_date, den:s.end_date, loai:s.shift}));
    return {nhan_vien:{ten:e.name}, thang, ds};
  },

  async tra_danh_gia({msnv, thang}){
    await loadCore();
    const e = findEmp(msnv); if(!e) return {loi:'khong_thay_nv'};
    const [rr,mr] = await Promise.all([
      sb.from('ratings_new').select('*').eq('emp_id',msnv).like('date',thang+'-%'),
      sb.from('monthly_reviews').select('*').eq('emp_id',msnv).eq('month_key',thang),
    ]);
    const rs=rr.data||[], cnt=rs.length;
    const base = cnt ? round1(rs.reduce((a,r)=>a+parseFloat(r.score),0)/cnt) : null;
    const rv=(mr.data||[]).find(r=>r.approved)||{};
    const diem=(rv.final_score!=null)?parseFloat(rv.final_score):base;
    return {nhan_vien:{ten:e.name}, thang, so_ngay_cham:cnt, diem,
            phan_tram: diem!=null?Math.round(diem/10*100):null,
            hang: rv.grade || (diem!=null?getGrade(diem):null),
            da_duyet: !!(rv.grade||rv.final_score!=null), ghi_chu: rv.note||''};
  },

  async tra_thong_tin({msnv}){
    await loadCore();
    const e = findEmp(msnv); if(!e) return {loi:'khong_thay_nv'};
    return {id:e.id, ten:e.name, kip:e.kip, nhom:GRP_LABEL[e.kip],
            role:e.role||'', ca_co_dinh:e.fixed_shift||null};
  },

  // ── Tổng hợp cho quản đốc ──
  async tra_kip_theo_ngay({ngay}){
    await loadCore();
    const d=new Date(ngay+'T00:00:00'), dk=ngay;
    const kips=[1,2,3].map(k=>{
      const ca=getShift(k,d);
      const ds=DB.emps.filter(e=>e.kip===k);
      const di=ds.filter(e=>WORK(empShiftFor(e,d,dk,DB.hols,DB.sched)));
      return {kip:k, ca, tong:ds.length, di_lam:di.length};
    });
    const hc=DB.emps.filter(e=>e.kip===4);
    const hcDi=hc.filter(e=>WORK(empShiftFor(e,d,dk,DB.hols,DB.sched)));
    return {ngay:dk, thu:DFUL[d.getDay()], le:(DB.hols.find(h=>h.date===dk)||{}).name||null,
            kips, hanh_chinh:{tong:hc.length, di_lam:hcDi.length},
            tong_di_lam: kips.reduce((a,k)=>a+k.di_lam,0)+hcDi.length};
  },

  async tra_nguoi_vang({ngay}){
    await loadCore();
    const d=new Date(ngay+'T00:00:00'), dk=ngay, np=[], vm=[];
    DB.emps.forEach(e=>{
      const s=empShiftFor(e,d,dk,DB.hols,DB.sched);
      if(s==='NP') np.push({ten:e.name, kip:e.kip});
      if(s==='VM') vm.push({ten:e.name, kip:e.kip});
    });
    return {ngay:dk, nghi_phep:np, vang_mat:vm};
  },

  async xep_hang_tang_ca({thang, top=5}){
    await loadCore();
    const ots=await loadOt(thang), m={};
    ots.forEach(o=>{const h=otHours(o); if(!h)return;
      m[o.emp_id]=(m[o.emp_id]||0)+h;});
    const ds=Object.entries(m).map(([id,h])=>{
      const e=findEmp(id);
      return {id, ten:e?e.name:('MSNV '+id), kip:e?e.kip:null, gio:round1(h)};
    }).sort((a,b)=>b.gio-a.gio).slice(0,top);
    return {thang, top:ds, tong_nguoi:Object.keys(m).length};
  },

  async tra_vi_pham_5s({msnv, thang}){
    await loadCore();
    const e = findEmp(msnv); if(!e) return {loi:'khong_thay_nv'};
    const ds = s5CuaNguoi(await loadS5(thang), e.id, e.name);
    return {nhan_vien:{ten:e.name, kip:e.kip}, thang, so_lan:ds.length,
            chi_tiet: ds.map(r=>({ngay:r.date, may:r.machine_code||'', ca:r.shift||'',
              muc_hong: s5MucHong(r).map(d=>d.short||d.name),
              ghi_chu: r.note||'', nguoi_kiem: r.inspector||'',
              so_anh: (r.photos||[]).length}))};
  },

  async xep_hang_vi_pham_5s({thang, top=5}){
    await loadCore();
    const rows = await loadS5(thang), m = {};
    rows.forEach(r=>{
      const key = r.worker_id || ('ten:'+String(r.worker_name||'').trim().toLowerCase());
      if(!key || key==='ten:') return;
      if(!m[key]) m[key] = {ten:r.worker_name||'', lan:0, muc:0};
      m[key].lan++; m[key].muc += s5MucHong(r).length;
    });
    const ds = Object.entries(m).map(([k,v])=>{
      const e = k.startsWith('ten:') ? null : findEmp(k);
      return {ten: e?e.name:(v.ten||k), kip: e?e.kip:null, lan:v.lan, so_muc:v.muc};
    }).sort((a,b)=>b.lan-a.lan||b.so_muc-a.so_muc).slice(0,top);
    return {thang, top:ds, tong_luot:rows.length, tong_nguoi:Object.keys(m).length};
  },

  async xep_hang_danh_gia({thang, top=10, hang=null}){
    await loadCore();
    const [rr,mr] = await Promise.all([
      sb.from('ratings_new').select('*').like('date', thang+'-%'),
      sb.from('monthly_reviews').select('*').eq('month_key', thang),
    ]);
    const diemTho = {};
    (rr.data||[]).forEach(r=>{ (diemTho[r.emp_id]=diemTho[r.emp_id]||[]).push(parseFloat(r.score)); });
    const duyet = {};
    (mr.data||[]).forEach(r=>{ if(r.approved) duyet[r.emp_id]=r; });
    const ds = [];
    DB.emps.forEach(e=>{
      const arr = diemTho[e.id]||[];
      const base = arr.length ? round1(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
      const rv = duyet[e.id]||{};
      const diem = (rv.final_score!=null) ? parseFloat(rv.final_score) : base;
      if(diem==null) return;
      ds.push({id:e.id, ten:e.name, kip:e.kip, diem,
               hang: rv.grade || getGrade(diem), da_duyet: !!(rv.grade||rv.final_score!=null)});
    });
    ds.sort((a,b)=>b.diem-a.diem);
    const theoHang = {};
    ds.forEach(x=>{ theoHang[x.hang]=(theoHang[x.hang]||0)+1; });
    // Hỏi đích danh "ai hạng A" thì chỉ trả người hạng đó. Khớp theo chữ cái
    // đầu nên "hạng A" gồm cả A+ (dấu + bị bỏ lúc chuẩn hoá câu hỏi).
    const loc = hang ? ds.filter(x=>String(x.hang||'').toUpperCase().startsWith(hang)) : ds;
    return {thang, tong:ds.length, theo_hang:theoHang, loc_hang:hang,
            so_khop:loc.length, top:loc.slice(0,top)};
  },

  // ── Quy trình / tài liệu ──
  async tra_tieu_chi_5s(){
    return {so_muc:S_DEFS.length,
            muc:S_DEFS.map((s,i)=>({stt:i+1, ten:s.name, mo_ta:s.desc}))};
  },

  async tim_tai_lieu({tu_khoa}){
    const docs=await loadDocs(), q=norm(tu_khoa);
    if(!q) return {tu_khoa, ds:docs.slice(0,8).map(d=>({ten:d.ten,nhom:d.nhom,mota:d.mota}))};
    const tu=q.split(' ').filter(w=>w.length>1);
    const hit=docs.map(d=>{
      const hay=norm(d.ten+' '+d.nhom+' '+(d.mota||''));
      return {d, diem:tu.filter(w=>hay.includes(w)).length};
    }).filter(x=>x.diem>0).sort((a,b)=>b.diem-a.diem).slice(0,6);
    return {tu_khoa, ds:hit.map(x=>({ten:x.d.ten, nhom:x.d.nhom, mota:x.d.mota,
            thoiluong:x.d.thoiluong}))};
  },
};

// ═══════════════════════════════════════════════════════════════
// TẦNG 3 - BỘ NÃO
// BRAIN_LOCAL: khớp từ khoá, chạy trong trình duyệt, miễn phí.
//
// ►► GẮN CLAUDE API SAU NÀY: viết BRAIN_CLAUDE cùng chữ ký
//      async answer(cauHoi, ctx) -> {html, chips?}
//    trong đó nó POST câu hỏi + định nghĩa TOOLS lên /api/chat
//    (Cloudflare Worker giữ API key), Worker gọi Claude, Claude chọn tool,
//    Worker chạy TOOLS tương ứng rồi trả câu trả lời về.
//    Xong chỉ cần đổi dòng  const BRAIN = BRAIN_LOCAL;  ở cuối khối này.
//    Giao diện, tầng TOOL và tầng dữ liệu giữ nguyên.
// ═══════════════════════════════════════════════════════════════

const DOW_MAP = {'chu nhat':0,'cn':0,'thu 2':1,'thu hai':1,'t2':1,'thu 3':2,'thu ba':2,'t3':2,
  'thu 4':3,'thu tu':3,'t4':3,'thu 5':4,'thu nam':4,'t5':4,'thu 6':5,'thu sau':5,'t6':5,
  'thu 7':6,'thu bay':6,'t7':6};

// Trả về {kind:'day'|'range'|'month', ...} hoặc null
function parseTime(q){
  const t=today();

  // tháng
  if(/\bthang (nay|hien tai)\b/.test(q)) return {kind:'month', key:mKey(t), label:'tháng này'};
  if(/\bthang (truoc|roi|vua roi)\b/.test(q)){
    const d=new Date(t.getFullYear(),t.getMonth()-1,1);
    return {kind:'month', key:mKey(d), label:'tháng '+(d.getMonth()+1)};
  }
  if(/\bthang (sau|toi)\b/.test(q)){
    const d=new Date(t.getFullYear(),t.getMonth()+1,1);
    return {kind:'month', key:mKey(d), label:'tháng '+(d.getMonth()+1)};
  }
  const mt=q.match(/\bthang (\d{1,2})\b/);
  if(mt){
    const m=+mt[1];
    if(m>=1&&m<=12){
      // Chọn lần xuất hiện GẦN hôm nay nhất của tháng đó. Hôm nay 10/2026 thì
      // "tháng 9" là 09/2026 vừa rồi, còn "tháng 1" là 01/2027 sắp tới.
      let y=t.getFullYear(); const diff=m-(t.getMonth()+1);
      if(diff >  6) y--;
      if(diff < -6) y++;
      return {kind:'month', key:`${y}-${String(m).padStart(2,'0')}`, label:`tháng ${m}/${y}`};
    }
  }

  // khoảng ngày
  if(/\btuan (nay|hien tai)\b/.test(q)){
    const off=(t.getDay()+6)%7, from=addD(t,-off);
    return {kind:'range', from, to:addD(from,6), label:'tuần này'};
  }
  if(/\btuan (sau|toi|ke)\b/.test(q)){
    const off=(t.getDay()+6)%7, from=addD(t,7-off);
    return {kind:'range', from, to:addD(from,6), label:'tuần sau'};
  }
  if(/\b(7|bay) ngay (toi|tiep|sau)\b|\btuan toi day\b/.test(q))
    return {kind:'range', from:t, to:addD(t,6), label:'7 ngày tới'};

  // ngày cụ thể dd/mm
  const md=q.match(/\b(\d{1,2})\s*\/\s*(\d{1,2})\b/);
  if(md){
    const dd=+md[1], mm=+md[2];
    if(dd>=1&&dd<=31&&mm>=1&&mm<=12){
      let y=t.getFullYear();
      let d=new Date(y,mm-1,dd);
      if(d < addD(t,-180)) d=new Date(y+1,mm-1,dd);
      return {kind:'day', d, label:fmtD(d)};
    }
  }

  // ngày tương đối
  if(/\bhom kia\b/.test(q))           return {kind:'day', d:addD(t,-2), label:'hôm kia'};
  if(/\bhom qua\b/.test(q))           return {kind:'day', d:addD(t,-1), label:'hôm qua'};
  if(/\b(ngay )?kia\b/.test(q))       return {kind:'day', d:addD(t,2),  label:'ngày kia'};
  if(/\b(ngay )?mot\b/.test(q))       return {kind:'day', d:addD(t,2),  label:'ngày mốt'};
  if(/\b(ngay )?mai\b/.test(q))       return {kind:'day', d:addD(t,1),  label:'ngày mai'};
  if(/\b(hom nay|bua nay|nay|hien tai|gio|bay gio)\b/.test(q))
                                      return {kind:'day', d:t, label:'hôm nay'};

  // thứ trong tuần -> lần xuất hiện gần nhất sắp tới
  for(const [k,v] of Object.entries(DOW_MAP)){
    if(new RegExp('\\b'+k+'\\b').test(q)){
      let diff=(v-t.getDay()+7)%7; if(diff===0) diff=7;
      const d=addD(t,diff);
      return {kind:'day', d, label:DFUL[v]+' '+fmtD(d)};
    }
  }
  return null;
}

const BRAIN_LOCAL = {
async answer(raw, ctx){
  const q = norm(raw);
  if(!q) return {html:'Bạn hỏi gì ạ?'};

  const has = (...ws) => ws.some(w=>q.includes(w));
  const time = parseTime(q);
  // Câu hỏi ngôi thứ nhất ("tôi thuộc kíp nào", "tôi làm ca nào hôm nay") phải
  // ưu tiên nhánh cá nhân, nếu không sẽ bị mấy nhánh tổng hợp bên dưới nuốt mất
  // vì cũng chứa cụm "kíp nào" / "ca nào".
  const SELF = /\b(toi|em|minh|tui|tao)\b/.test(q);
  const AI   = /\bai\b/.test(q);          // "ai tăng ca nhiều nhất" - hỏi về người khác
  const OT   = /\bot\b/.test(q);          // dùng ranh giới từ, nếu không "ngày mốt" cũng dính
  // Hỏi về vi phạm 5S (khác với hỏi tiêu chí 5S gồm những gì)
  const VP5S = has('vi pham','chua dat','khong dat')
            || (has('5s') && has('may lan','bao nhieu lan','so lan','bi loi'));
  const monthKey = time && time.kind==='month' ? time.key : mKey(today());
  const monthLbl = time && time.kind==='month' ? time.label : 'tháng này';

  // ── chào / giúp ──
  if(/^(hi|hello|chao|xin chao|alo|hey)\b/.test(q) || q==='help' || has('giup gi','lam duoc gi','huong dan su dung'))
    return {html: helpText(), chips: defaultChips()};

  // ── tổng hợp: ai vi phạm 5S nhiều nhất ──
  if(VP5S && !SELF && (AI || has('nhieu nhat','xep hang','top','thong ke'))){
    const r = await TOOLS.xep_hang_vi_pham_5s({thang:monthKey});
    if(!r.top.length) return {html:`Không có lượt 5S chưa đạt nào trong ${monthLbl}. 👍`};
    let h = `<b>Vi phạm 5S nhiều nhất ${monthLbl}</b>\n`
          + `${r.tong_luot} lượt chưa đạt · ${r.tong_nguoi} người`;
    h += '<table>' + r.top.map((x,i)=>
      `<tr><td>${i+1}.</td><td><b>${esc(x.ten)}</b>${x.kip?' · Kíp '+x.kip:''}</td>`
      + `<td style="text-align:right;color:#c62828;font-weight:700">${x.lan} lần</td></tr>`
    ).join('') + '</table>';
    return {html:h, chips:['Tiêu chí 5S','Ai hạng A tháng này']};
  }

  // ── tổng hợp: xếp loại đánh giá ──
  if(!SELF && has('xep loai','xep hang','danh gia','hang a','hang b','hang c')
          && (AI || has('nhieu nhat','top','bang xep hang','thong ke','bao nhieu nguoi'))){
    const mH = q.match(/\bhang ([a-d])\b/);
    const r = await TOOLS.xep_hang_danh_gia({thang:monthKey,
                hang: mH ? mH[1].toUpperCase() : null});
    if(!r.tong) return {html:`Chưa có ai được chấm điểm trong ${monthLbl}.`};
    if(r.loc_hang && !r.so_khop)
      return {html:`Không có ai hạng <b>${r.loc_hang}</b> trong ${monthLbl}.\n`
                 + `Phân bố: ` + Object.entries(r.theo_hang).map(([g,n])=>`${g}: ${n}`).join(' · '),
              chips:['Xếp loại của tôi','Ai vi phạm 5S nhiều nhất']};
    let h = r.loc_hang
      ? `<b>Hạng ${r.loc_hang} ${monthLbl}</b> · ${r.so_khop} người\n`
      : `<b>Xếp loại ${monthLbl}</b> · ${r.tong} người có điểm\n`;
    h += Object.entries(r.theo_hang).map(([g,n])=>`${g}: ${n}`).join(' · ');
    h += '<table>' + r.top.map((x,i)=>
      `<tr><td>${i+1}.</td><td><b>${esc(x.ten)}</b>${x.kip?' · Kíp '+x.kip:''}</td>`
      + `<td style="text-align:right">${gbadge(x.hang)} ${x.diem}</td></tr>`
    ).join('') + '</table>';
    return {html:h, chips:['Ai vi phạm 5S nhiều nhất','Xếp loại của tôi']};
  }

  // ── quy trình 5S (tiêu chí gồm những gì) ──
  if(has('5s','tieu chi') && !VP5S){
    const r = await TOOLS.tra_tieu_chi_5s();
    let h = `<b>${r.so_muc} mục kiểm tra 5S</b>`;
    h += '<table>' + r.muc.map(m=>
      `<tr><td>${m.stt}.</td><td><b>${esc(m.ten)}</b><br><span style="color:#777;font-size:.92em">${esc(m.mo_ta)}</span></td></tr>`
    ).join('') + '</table>';
    return {html:h, chips:['Mở trang 5S','Tài liệu hướng dẫn']};
  }

  // ── tài liệu / video ──
  if(has('tai lieu','video','huong dan','cach lam','quy trinh','xem clip')){
    const kw = q.replace(/\b(tai lieu|video|huong dan|cach lam|quy trinh|xem clip|co|nao|ve|tim|cho toi|khong)\b/g,' ').trim();
    const r = await TOOLS.tim_tai_lieu({tu_khoa:kw});
    if(!r.ds.length) return {html:`Không tìm thấy tài liệu nào về "<b>${esc(kw||'…')}</b>".\nThử mở trang 📚 Tài Liệu để xem toàn bộ.`,
                             chips:['Mở trang Tài Liệu']};
    let h = kw ? `Tài liệu về "<b>${esc(kw)}</b>":` : '<b>Một số tài liệu:</b>';
    h += '<table>' + r.ds.map(d=>
      `<tr><td>📄</td><td><b>${esc(d.ten)}</b>${d.thoiluong?' · '+esc(d.thoiluong):''}<br><span style="color:#777;font-size:.92em">${esc(d.nhom)}${d.mota?' — '+esc(d.mota):''}</span></td></tr>`
    ).join('') + '</table>';
    return {html:h, chips:['Mở trang Tài Liệu']};
  }

  // ── tổng hợp: kíp nào đi làm ──
  if(!SELF && has('kip nao','ca nao','bao nhieu nguoi','may nguoi','tong hop','di lam hom nay','ai di lam','quan so')){
    const d = time && time.kind==='day' ? time.d : today();
    const r = await TOOLS.tra_kip_theo_ngay({ngay:dKey(d)});
    let h = `<b>${fmtDay(d)}</b>${r.le?` · 🎌 ${esc(r.le)}`:''}`;
    h += '<table>' + r.kips.map(k=>
      `<tr><td>Kíp ${k.kip}</td><td>${chip(k.ca)} <span style="color:#777">${k.di_lam}/${k.tong} người</span></td></tr>`
    ).join('');
    if(r.hanh_chinh.tong) h += `<tr><td>HC/Xoay</td><td><span style="color:#777">${r.hanh_chinh.di_lam}/${r.hanh_chinh.tong} người</span></td></tr>`;
    h += '</table>';
    h += `\nTổng đi làm: <b>${r.tong_di_lam} người</b>`;
    const v = await TOOLS.tra_nguoi_vang({ngay:dKey(d)});
    if(v.nghi_phep.length) h += `\n🏖️ Nghỉ phép: ${v.nghi_phep.map(x=>esc(x.ten)).join(', ')}`;
    if(v.vang_mat.length)  h += `\n🔴 Vắng mặt: ${v.vang_mat.map(x=>esc(x.ten)).join(', ')}`;
    return {html:h, chips:['Ai tăng ca nhiều nhất','Hôm nay ai nghỉ phép']};
  }

  // ── tổng hợp: ai nghỉ phép ──
  if(!SELF && has('ai nghi','ai vang','nghi phep hom nay','danh sach nghi')){
    const d = time && time.kind==='day' ? time.d : today();
    const r = await TOOLS.tra_nguoi_vang({ngay:dKey(d)});
    if(!r.nghi_phep.length && !r.vang_mat.length)
      return {html:`<b>${fmtDay(d)}</b> không có ai nghỉ phép hay vắng mặt. 👍`};
    let h = `<b>${fmtDay(d)}</b>`;
    if(r.nghi_phep.length) h += `\n🏖️ Nghỉ phép (${r.nghi_phep.length}): ${r.nghi_phep.map(x=>esc(x.ten)+' (K'+x.kip+')').join(', ')}`;
    if(r.vang_mat.length)  h += `\n🔴 Vắng mặt (${r.vang_mat.length}): ${r.vang_mat.map(x=>esc(x.ten)+' (K'+x.kip+')').join(', ')}`;
    return {html:h};
  }

  // ── tổng hợp: xếp hạng tăng ca ──
  if(!SELF && has('nhieu nhat','xep hang','top','nhieu gio nhat') && (OT || has('tang ca'))){
    const r = await TOOLS.xep_hang_tang_ca({thang:monthKey});
    if(!r.top.length) return {html:`Chưa có ai tăng ca trong ${monthLbl}.`};
    let h = `<b>Tăng ca nhiều nhất ${monthLbl}</b> (${r.tong_nguoi} người có tăng ca)`;
    h += '<table>' + r.top.map((x,i)=>
      `<tr><td>${i+1}.</td><td><b>${esc(x.ten)}</b>${x.kip?' · Kíp '+x.kip:''}</td><td style="text-align:right;color:#e65100;font-weight:700">${hhmm(x.gio)}</td></tr>`
    ).join('') + '</table>';
    return {html:h};
  }

  // ───── Từ đây cần MSNV ─────
  const msnv = ctx.msnv;
  if(!msnv) return {html:'Để trả lời được, tôi cần biết bạn là ai.\nBấm nút <b>Nhập MSNV</b> ở góc trên bên phải nhé.',
                    chips:['Nhập MSNV']};

  // ── khi nào được nghỉ ──
  if(has('khi nao','bao gio','luc nao','con may ngay') && has('nghi')){
    const r = await TOOLS.tim_ngay_nghi_toi({msnv});
    if(r.loi) return {html:notFound(msnv)};
    if(!r.ngay_nghi.length) return {html:'Trong 45 ngày tới tôi chưa thấy ngày nghỉ nào trong lịch (có thể lịch chưa được cập nhật).'};
    const first=r.ngay_nghi[0], d=new Date(first.ngay+'T00:00:00');
    const cach=Math.round((d-today())/864e5);
    let h = cach===0 ? '<b>Hôm nay bạn nghỉ rồi</b> 🏠'
          : `Ngày nghỉ gần nhất: <b>${fmtDay(d)}</b>` + (cach>0?` — còn ${cach} ngày nữa`:'');
    if(r.ngay_nghi.length>1)
      h += `\nĐợt nghỉ này gồm ${r.ngay_nghi.length} ngày: ` +
           r.ngay_nghi.map(x=>fmtD(new Date(x.ngay+'T00:00:00'))).join(', ');
    return {html:h, chips:['Lịch tuần sau','Ca của tôi hôm nay']};
  }

  // ── vi phạm 5S của cá nhân ──
  if(VP5S){
    const r = await TOOLS.tra_vi_pham_5s({msnv, thang:monthKey});
    if(r.loi) return {html:notFound(msnv)};
    if(!r.so_lan) return {html:`<b>${esc(r.nhan_vien.ten)}</b> không có lượt 5S chưa đạt nào trong ${monthLbl}. 👍`,
                          chips:['Xếp loại của tôi','Tiêu chí 5S']};
    let h = `<b>${esc(r.nhan_vien.ten)}</b> · ${monthLbl}\n`
          + `⚠️ <b style="color:#c62828">${r.so_lan} lần</b> 5S chưa đạt`;
    h += '<table>' + r.chi_tiet.map(x=>{
      const [,mm,dd] = x.ngay.split('-');
      return `<tr><td>${dd}/${mm}${x.may?'<br><span style="color:#999">'+esc(x.may)+'</span>':''}</td>`
        + `<td>${x.muc_hong.map(m=>esc(m)).join(', ')}`
        + `${x.ghi_chu?'<br><span style="color:#777;font-size:.92em">'+esc(x.ghi_chu)+'</span>':''}</td></tr>`;
    }).join('') + '</table>';
    h += '\nChi tiết kèm ảnh xem ở trang 5S.';
    return {html:h, chips:['Tiêu chí 5S','Xếp loại của tôi','Mở trang 5S']};
  }

  // ── tăng ca cá nhân ──
  if(OT || has('tang ca','lam them','tang gio')){
    const r = await TOOLS.tra_tang_ca({msnv, thang:monthKey});
    if(r.loi) return {html:notFound(msnv)};
    if(!r.lan.length) return {html:`<b>${esc(r.nhan_vien.ten)}</b> chưa có tăng ca nào trong ${monthLbl}.`,
                              chips:['Ca của tôi hôm nay','Xếp loại của tôi']};
    let h = `<b>${esc(r.nhan_vien.ten)}</b> · tăng ca ${monthLbl}: <b style="color:#e65100">${hhmm(r.tong_gio)}</b> (${r.lan.length} lần)`;
    h += '<table>' + r.lan.map(o=>{
      const [,mm,dd]=o.ngay.split('-');
      return `<tr><td>${dd}/${mm}</td><td>${o.ca==='C'?'Chiều':o.ca==='S'?'Sáng':esc(o.ca||'')}</td><td style="text-align:right;color:#e65100;font-weight:700">${o.gio?hhmm(o.gio):''}</td></tr>`;
    }).join('') + '</table>';
    return {html:h, chips:['Ai tăng ca nhiều nhất']};
  }

  // ── nghỉ phép cá nhân ──
  if(has('nghi phep','phep','vang mat','xin nghi')){
    const r = await TOOLS.tra_nghi_phep({msnv, thang:monthKey});
    if(r.loi) return {html:notFound(msnv)};
    if(!r.ds.length) return {html:`<b>${esc(r.nhan_vien.ten)}</b> không có ngày nghỉ phép / vắng mặt nào trong ${monthLbl}.`,
                             chips:['Khi nào tôi được nghỉ']};
    let h = `<b>${esc(r.nhan_vien.ten)}</b> · ${monthLbl}`;
    h += '<table>' + r.ds.map(x=>{
      const a=x.tu.split('-'), b=x.den.split('-');
      const rg = x.tu===x.den ? `${a[2]}/${a[1]}` : `${a[2]}/${a[1]} → ${b[2]}/${b[1]}`;
      return `<tr><td>${rg}</td><td>${x.loai==='NP'?'🏖️ Nghỉ phép':'🔴 Vắng mặt'}</td></tr>`;
    }).join('') + '</table>';
    return {html:h};
  }

  // ── điểm đánh giá ──
  if(has('diem','danh gia','xep loai','xep hang','hang cua toi','ket qua')){
    const r = await TOOLS.tra_danh_gia({msnv, thang:monthKey});
    if(r.loi) return {html:notFound(msnv)};
    if(r.diem==null) return {html:`<b>${esc(r.nhan_vien.ten)}</b> chưa có điểm đánh giá nào trong ${monthLbl}.`};
    let h = `<b>${esc(r.nhan_vien.ten)}</b> · ${monthLbl}`;
    h += `\n⭐ Điểm: <b>${r.diem}</b>/10 (${r.phan_tram}%)`;
    h += `\n🏅 Xếp loại: ${r.hang?gbadge(r.hang):'<b>–</b>'}${r.da_duyet?' (đã duyệt)':''}`;
    h += `\n📋 Số ngày đã chấm: ${r.so_ngay_cham}`;
    if(r.ghi_chu) h += `\n📝 ${esc(r.ghi_chu)}`;
    return {html:h, chips:['Tăng ca tháng này']};
  }

  // ── thông tin bản thân ──
  if(has('toi la ai','thong tin cua toi','thuoc kip','kip may','kip cua toi','toi o kip','vi tri cua toi')){
    const r = await TOOLS.tra_thong_tin({msnv});
    if(r.loi) return {html:notFound(msnv)};
    let h = `<b>${esc(r.ten)}</b>\nMSNV: ${esc(r.id)}\nNhóm: ${esc(r.nhom||'')}`;
    if(r.role) h += `\nVị trí: ${esc(r.role)}`;
    if(r.ca_co_dinh) h += `\nCa cố định: ${esc(SHORT[r.ca_co_dinh]||r.ca_co_dinh)}`;
    return {html:h, chips:['Ca của tôi hôm nay','Lịch tuần này']};
  }

  // ── lịch ca (mặc định khi có từ chỉ thời gian) ──
  if(has('ca','lich','lam','di lam','truc') || time){
    let from, to, lbl;
    if(time && time.kind==='range'){ from=time.from; to=time.to; lbl=time.label; }
    else if(time && time.kind==='day'){ from=to=time.d; lbl=time.label; }
    else if(time && time.kind==='month'){
      from=new Date(time.key+'-01T00:00:00');
      to=new Date(from.getFullYear(), from.getMonth()+1, 0); lbl=time.label;
    }
    else { from=today(); to=addD(from,6); lbl='7 ngày tới'; }

    const r = await TOOLS.tra_lich_ca({msnv, tu_ngay:from, den_ngay:to});
    if(r.loi) return {html:notFound(msnv)};
    const nv = r.nhan_vien;

    if(r.ngay.length===1){
      const x=r.ngay[0], d=new Date(x.ngay+'T00:00:00');
      if(x.ca==='UN')
        return {html:`<b>${fmtDay(d)}</b> chưa có lịch ca.\nLịch từ 01/11/2026 trở đi đang chờ chốt.`,
                chips:['Lịch tuần này']};
      const h = `<b>${esc(nv.ten)}</b> · ${GRP_LABEL[nv.kip]||''}\n${fmtDay(d)}: ${chip(x.ca)}`;
      return {html:h, chips:['Lịch tuần này','Khi nào tôi được nghỉ','Tăng ca tháng này']};
    }

    let h = `<b>${esc(nv.ten)}</b> · ${GRP_LABEL[nv.kip]||''} · ${lbl}`;
    h += '<table>' + r.ngay.map(x=>{
      const d=new Date(x.ngay+'T00:00:00');
      const hl = dKey(d)===dKey(today()) ? ' style="background:#fff8e1"' : '';
      return `<tr${hl}><td>${esc(x.thu)} ${fmtD(d)}</td><td>${chip(x.ca)}</td></tr>`;
    }).join('') + '</table>';
    const lam = r.ngay.filter(x=>WORK(x.ca)).length;
    h += `\nĐi làm ${lam}/${r.ngay.length} ngày`;
    return {html:h, chips:['Khi nào tôi được nghỉ','Tăng ca tháng này']};
  }

  // ── không hiểu ──
  return {html:'Tôi chưa hiểu câu này 😅\nThử hỏi theo mấy kiểu dưới đây, hoặc gõ <b>giúp</b> để xem tôi làm được gì.',
          chips: defaultChips()};
}};

const BRAIN = BRAIN_LOCAL;   // ← đổi thành BRAIN_CLAUDE khi gắn API

function notFound(id){ return `Không tìm thấy MSNV "<b>${esc(id)}</b>".\nBấm tên ở đầu khung chat để nhập lại.`; }

function helpText(){
  return 'Chào bạn 👋 Tôi tra giúp mấy thứ sau:\n\n'
    + '<b>Của riêng bạn</b> (cần MSNV)\n'
    + '· Ca của tôi hôm nay / mai / thứ 5 / 15/10\n'
    + '· Lịch tuần này, tuần sau\n'
    + '· Khi nào tôi được nghỉ\n'
    + '· Tăng ca tháng này / tháng 9\n'
    + '· Nghỉ phép của tôi\n'
    + '· Xếp loại của tôi · Tôi vi phạm 5S mấy lần\n\n'
    + '<b>Tổng hợp</b>\n'
    + '· Hôm nay kíp nào đi làm, bao nhiêu người\n'
    + '· Hôm nay ai nghỉ phép\n'
    + '· Ai tăng ca nhiều nhất tháng này\n'
    + '· Ai hạng A tháng này · Ai vi phạm 5S nhiều nhất\n\n'
    + '<b>Quy trình</b>\n'
    + '· Tiêu chí 5S gồm những gì\n'
    + '· Tìm tài liệu / video về ...';
}
function defaultChips(){
  // Chỉ 6 nút cho gọn. Các câu đã bỏ (khi nào tôi được nghỉ, hôm nay kíp nào
  // đi làm, ai hạng A, ai vi phạm 5S nhiều nhất) VẪN trả lời được nếu gõ tay,
  // và vẫn hiện làm gợi ý sau những câu trả lời liên quan.
  return ['Ca của tôi hôm nay','Lịch tuần sau','Xếp loại của tôi',
          'Tôi vi phạm 5S mấy lần','Tăng ca tháng này','Tiêu chí 5S'];
}

// ═══════════════════════════════════════════════════════════════
// GIAO DIỆN BONG BÓNG
// ═══════════════════════════════════════════════════════════════
const CSS = `
#tl-root{--tl-xanh:#1a237e}
#tl-bong{position:fixed;right:16px;z-index:9000;width:56px;height:56px;border-radius:50%;
  border:none;cursor:pointer;background:linear-gradient(135deg,#1a237e,#4a148c);color:#fff;
  font-size:1.6rem;line-height:1;box-shadow:0 4px 16px rgba(0,0,0,.3);
  display:flex;align-items:center;justify-content:center;transition:transform .15s}
#tl-bong:hover{transform:scale(1.07)}
#tl-bong.an{display:none}
#tl-cham{position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;
  background:#e53935;border:2px solid #fff}

#tl-khung{position:fixed;right:16px;z-index:9500;width:380px;max-width:calc(100vw - 32px);
  height:560px;max-height:calc(100vh - 100px);background:#eef1f6;border-radius:16px;
  box-shadow:0 10px 40px rgba(0,0,0,.35);display:none;flex-direction:column;overflow:hidden;
  font-family:'Segoe UI','Arial',sans-serif}
#tl-khung.mo{display:flex}
@media(max-width:480px){
  #tl-khung{right:0;left:0;bottom:0!important;width:100%;max-width:100%;height:85vh;
    max-height:85vh;border-radius:16px 16px 0 0}
}

#tl-dau{background:linear-gradient(135deg,#1a237e,#4a148c);color:#fff;padding:10px 12px;
  display:flex;align-items:center;gap:8px;flex-shrink:0}
#tl-dau .t{flex:1;min-width:0}
#tl-dau .t b{font-size:.95rem;display:block;line-height:1.2}
#tl-dau .t span{font-size:.68rem;opacity:.85}
#tl-ai{background:rgba(255,255,255,.18);border:none;color:#fff;font-family:inherit;
  font-size:.7rem;font-weight:700;padding:5px 10px;border-radius:20px;cursor:pointer;
  white-space:nowrap;max-width:120px;overflow:hidden;text-overflow:ellipsis}
#tl-dong{background:none;border:none;color:#fff;font-size:1.3rem;line-height:1;cursor:pointer;
  padding:0 2px}

#tl-log{flex:1;overflow-y:auto;padding:12px 10px 4px;display:flex;flex-direction:column;gap:9px}
#tl-root .msg{max-width:88%;padding:9px 12px;border-radius:14px;font-size:.85rem;
  white-space:pre-wrap;word-wrap:break-word;box-shadow:0 1px 3px rgba(0,0,0,.06);color:#333;
  line-height:1.5}
#tl-root .msg.bot{background:#fff;align-self:flex-start;border-bottom-left-radius:4px}
#tl-root .msg.me{background:#1a237e;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
#tl-root .msg.sys{align-self:center;background:#fff8e1;color:#8d6e00;font-size:.73rem;
  max-width:95%;text-align:center;border-radius:10px}
#tl-root .msg b{color:#1a237e}
#tl-root .msg.me b{color:#fff}
#tl-root .msg table{border-collapse:collapse;margin-top:5px;font-size:.8rem;width:100%}
#tl-root .msg td{padding:3px 5px;border-bottom:1px dashed #eee}
#tl-root .msg td:first-child{color:#666;white-space:nowrap}
#tl-root .msg .chip{display:inline-block;padding:2px 9px;border-radius:20px;font-size:.74rem;
  font-weight:700}
#tl-root .chS{background:#fff3e0;color:#e65100}#tl-root .chC{background:#e8eaf6;color:#283593}
#tl-root .chN{background:#f3e5f5;color:#6a1b9a}#tl-root .chL{background:#ffebee;color:#b71c1c}
#tl-root .chHC{background:#e0f2f1;color:#00695c}#tl-root .chNP{background:#e1f5fe;color:#0277bd}
#tl-root .chVM{background:#ffcdd2;color:#b71c1c}#tl-root .chUN{background:#f5f5f5;color:#999}
#tl-root .chC1{background:#b2dfdb;color:#00695c}#tl-root .chC2{background:#ffe082;color:#e65100}
#tl-root .chC3{background:#ce93d8;color:#4a148c}
#tl-root .msg .gb{display:inline-block;padding:1px 8px;border-radius:7px;font-weight:800;
  font-size:.8rem}
#tl-root .gb-Ap{background:#e8f5e9;color:#1b5e20}#tl-root .gb-A{background:#c8e6c9;color:#2e7d32}
#tl-root .gb-B{background:#bbdefb;color:#1565c0}#tl-root .gb-C{background:#fff9c4;color:#e65100}
#tl-root .gb-D{background:#ffcdd2;color:#b71c1c}

#tl-go{align-self:flex-start;background:#fff;padding:11px 15px;border-radius:14px;
  border-bottom-left-radius:4px;display:flex;gap:4px}
#tl-go i{width:6px;height:6px;border-radius:50%;background:#bbb;animation:tlbl 1.2s infinite}
#tl-go i:nth-child(2){animation-delay:.2s}#tl-go i:nth-child(3){animation-delay:.4s}
@keyframes tlbl{0%,60%,100%{opacity:.25}30%{opacity:1}}

#tl-nut{display:flex;flex-wrap:wrap;gap:5px;padding:7px 10px 3px;flex-shrink:0}
#tl-nut button{background:#fff;border:1.5px solid #c5cae9;color:#1a237e;font-family:inherit;
  font-size:.73rem;font-weight:600;padding:6px 11px;border-radius:20px;cursor:pointer}
#tl-nut button:hover{background:#e8eaf6}

#tl-thanh{display:flex;gap:7px;padding:9px 10px;background:#fff;border-top:1px solid #e0e0e0;
  flex-shrink:0}
#tl-thanh input{flex:1;padding:10px 13px;border:2px solid #e0e0e0;border-radius:22px;
  font-size:.88rem;font-family:inherit;outline:none;min-width:0;color:#333;background:#fff}
#tl-thanh input:focus{border-color:#1a237e}
#tl-thanh button{width:40px;height:40px;border-radius:50%;background:#1a237e;color:#fff;
  border:none;font-size:1rem;cursor:pointer;flex-shrink:0}
#tl-thanh button:disabled{background:#c5cae9;cursor:default}

#tl-hoi{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9600;display:none;
  align-items:center;justify-content:center;padding:16px}
#tl-hoi.mo{display:flex}
#tl-hoi .hop{background:#fff;border-radius:16px;padding:18px;max-width:300px;width:100%;
  font-family:'Segoe UI','Arial',sans-serif}
#tl-hoi h3{font-size:1rem;color:#1a237e;margin:0 0 4px}
#tl-hoi p{font-size:.76rem;color:#777;margin:0 0 12px}
#tl-hoi input{width:100%;padding:11px;border:2px solid #c5cae9;border-radius:12px;
  font-size:1.05rem;text-align:center;font-weight:700;letter-spacing:2px;outline:none;
  font-family:inherit;box-sizing:border-box}
#tl-hoi .hang{display:flex;gap:8px;margin-top:12px}
#tl-hoi .hang button{flex:1;padding:10px;border:none;border-radius:12px;font-family:inherit;
  font-size:.85rem;font-weight:700;cursor:pointer}
#tl-hoi .ok{background:#1a237e;color:#fff}#tl-hoi .bo{background:#eceff1;color:#555}
#tl-hoi .loi{color:#c62828;font-size:.76rem;margin-top:8px;text-align:center;display:none}
`;

const HTML = `
<button id="tl-bong" title="Hỏi Trợ Lý" aria-label="Mở Trợ Lý">🤖<span id="tl-cham"></span></button>
<div id="tl-khung" role="dialog" aria-label="Trợ Lý Phân Xưởng 1">
  <div id="tl-dau">
    <div class="t"><b>🤖 Trợ Lý Phân Xưởng 1</b><span>Lịch ca · tăng ca · đánh giá · 5S</span></div>
    <button id="tl-ai">Nhập MSNV</button>
    <button id="tl-dong" aria-label="Đóng">✕</button>
  </div>
  <div id="tl-log"></div>
  <div id="tl-nut"></div>
  <div id="tl-thanh">
    <input type="text" id="tl-input" placeholder="Hỏi gì đó... vd: mai tôi làm ca gì" autocomplete="off">
    <button id="tl-gui" aria-label="Gửi">➤</button>
  </div>
</div>
<div id="tl-hoi">
  <div class="hop">
    <h3>Bạn là ai?</h3>
    <p>Nhập MSNV để tôi tra được lịch ca, tăng ca và đánh giá của riêng bạn.</p>
    <input type="text" id="tl-msnv" placeholder="MSNV" inputmode="numeric">
    <div class="loi" id="tl-loi"></div>
    <div class="hang">
      <button class="bo" id="tl-bo">Để sau</button>
      <button class="ok" id="tl-luu">Xong</button>
    </div>
  </div>
</div>`;

let MSNV = '';
try { MSNV = localStorage.getItem('tracuu_msnv') || ''; } catch (e) {}
let ban = false, daChao = false;
let root, elLog, elNut, elInput, elGui, elKhung, elBong, elAi, elHoi;

function dung() {
  root = document.createElement('div');
  root.id = 'tl-root';
  const st = document.createElement('style');
  st.textContent = CSS;
  root.appendChild(st);
  const box = document.createElement('div');
  box.innerHTML = HTML;
  while (box.firstChild) root.appendChild(box.firstChild);
  document.body.appendChild(root);

  elKhung = root.querySelector('#tl-khung');
  elBong  = root.querySelector('#tl-bong');
  elLog   = root.querySelector('#tl-log');
  elNut   = root.querySelector('#tl-nut');
  elInput = root.querySelector('#tl-input');
  elGui   = root.querySelector('#tl-gui');
  elAi    = root.querySelector('#tl-ai');
  elHoi   = root.querySelector('#tl-hoi');

  // tránh đè lên thanh điều hướng dưới cùng của trang Lịch Ca trên điện thoại
  const nav = document.querySelector('.bot-nav');
  const day = nav && getComputedStyle(nav).display !== 'none' ? nav.offsetHeight : 0;
  elBong.style.bottom  = (day + 16) + 'px';
  elKhung.style.bottom = (day + 16) + 'px';

  elBong.onclick  = mo;
  root.querySelector('#tl-dong').onclick = dong;
  elGui.onclick   = gui;
  elInput.onkeydown = e => { if (e.key === 'Enter') gui(); };
  elAi.onclick    = moHoi;
  root.querySelector('#tl-bo').onclick  = () => elHoi.classList.remove('mo');
  root.querySelector('#tl-msnv').onkeydown = e => { if (e.key === 'Enter') luuAi(); };
  root.querySelector('#tl-luu').onclick = luuAi;
  elHoi.onclick = e => { if (e.target === elHoi) elHoi.classList.remove('mo'); };
}

function dat(html, ai) {
  const d = document.createElement('div');
  d.className = 'msg ' + ai;
  d.innerHTML = html;
  elLog.appendChild(d);
  elLog.scrollTop = elLog.scrollHeight;
}
function datNut(ds) {
  elNut.innerHTML = '';
  (ds || []).forEach(c => {
    const b = document.createElement('button');
    b.textContent = c;
    b.onclick = () => { elInput.value = c; gui(); };
    elNut.appendChild(b);
  });
}
function dangGo(bat) {
  const cu = root.querySelector('#tl-go');
  if (cu) cu.remove();
  if (bat) {
    const d = document.createElement('div');
    d.id = 'tl-go';
    d.innerHTML = '<i></i><i></i><i></i>';
    elLog.appendChild(d);
    elLog.scrollTop = elLog.scrollHeight;
  }
}

async function mo() {
  elKhung.classList.add('mo');
  elBong.classList.add('an');
  const cham = root.querySelector('#tl-cham');
  if (cham) cham.remove();
  if (!daChao) {
    daChao = true;
    dat(helpText(), 'bot');
    datNut(defaultChips());
    try {
      await loadCore();
      if (MSNV) {
        const e = findEmp(MSNV);
        if (e) { datTen(e); dat(`Đang xem với tư cách <b>${esc(e.name)}</b> · ${esc(GRP_LABEL[e.kip] || '')}`, 'sys'); }
        else MSNV = '';
      }
    } catch (e) {
      dat('⚠️ Không tải được dữ liệu: ' + esc(e.message), 'sys');
    }
  }
  setTimeout(() => elInput.focus(), 50);
}
function dong() { elKhung.classList.remove('mo'); elBong.classList.remove('an'); }
function datTen(e) {
  elAi.textContent = e ? ('👤 ' + e.name.split(' ').slice(-2).join(' ')) : 'Nhập MSNV';
}
function moHoi() {
  elHoi.classList.add('mo');
  root.querySelector('#tl-loi').style.display = 'none';
  const i = root.querySelector('#tl-msnv');
  i.value = MSNV; i.focus(); i.select();
}
async function luuAi() {
  const id = root.querySelector('#tl-msnv').value.trim();
  const loi = root.querySelector('#tl-loi');
  if (!id) { loi.textContent = 'Nhập MSNV đã nhé.'; loi.style.display = 'block'; return; }
  try {
    await loadCore();
    const e = findEmp(id);
    if (!e) { loi.textContent = 'Không tìm thấy MSNV này.'; loi.style.display = 'block'; return; }
    MSNV = id;
    try { localStorage.setItem('tracuu_msnv', id); } catch (ex) {}
    datTen(e);
    elHoi.classList.remove('mo');
    dat(`Chào <b>${esc(e.name)}</b> 👋 · ${esc(GRP_LABEL[e.kip] || '')}\nBạn muốn hỏi gì?`, 'bot');
    datNut(defaultChips());
  } catch (ex) {
    loi.textContent = 'Lỗi tải dữ liệu: ' + ex.message; loi.style.display = 'block';
  }
}

async function gui() {
  if (ban) return;
  const raw = elInput.value.trim();
  if (!raw) return;

  const n = norm(raw);
  if (n === 'nhap msnv') { elInput.value = ''; moHoi(); return; }
  if (n.startsWith('mo trang')) {
    elInput.value = '';
    if (n.includes('5s'))       { location.href = '5s.html'; return; }
    if (n.includes('tai lieu')) { location.href = 'huong-dan.html'; return; }
  }

  elInput.value = '';
  dat(esc(raw), 'me');
  ban = true; elGui.disabled = true; dangGo(true);
  try {
    const r = await BRAIN.answer(raw, { msnv: MSNV });
    dangGo(false);
    dat(r.html, 'bot');
    datNut(r.chips && r.chips.length ? r.chips : defaultChips());
  } catch (e) {
    dangGo(false);
    dat('Lỗi khi tra dữ liệu: ' + esc(e.message), 'bot');
  } finally {
    ban = false; elGui.disabled = false; elInput.focus();
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dung);
else dung();

})();
