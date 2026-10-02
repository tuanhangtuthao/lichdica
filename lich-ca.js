// ═══════════════════════════════════════════════════════════════
// LỊCH CA - NGUỒN DUY NHẤT
// ═══════════════════════════════════════════════════════════════
// Sáu trang (index, rating, nhansu-ca, tra-cuu, dashboard, chatbot) đều nạp
// file này. Trước đây mỗi trang giữ một bản sao, đổi lịch là phải sửa 6 chỗ,
// quên một chỗ là trang đó hiện ca sai mà không có gì báo. Giống cách
// 5s-tieu-chi.js đang gom danh sách tiêu chí 5S về một mối.
//
// ĐỔI LỊCH CA thì chỉ sửa ở đây:
//   · tháng chuyển tiếp, không theo chu kỳ  -> thêm ngày vào SCHED_OVR
//   · tháng chưa chốt lịch                  -> đẩy SCHED_UNKNOWN_FROM
//   · đổi hẳn sang chu kỳ mới               -> sửa CYCLE / REF / PHASE
//
// Mã ca: S = Sáng (6h-18h) · C = Chiều (18h-6h) · N = Nghỉ · L = Nghỉ Lễ
//        C1 = Ca 1 (6h-14h) · UN = chưa có lịch
// ═══════════════════════════════════════════════════════════════

// ── TÍNH CA ────────────────────────────────
// Chu kỳ 12 ngày: S×4 → N×2 → C×4 → N×2 (4 ngày làm, 2 ngày nghỉ)
const CYCLE = ['S','S','S','S','N','N','C','C','C','C','N','N'];
const REF   = new Date(2026, 3, 12); // 12/04/2026 – mốc tham chiếu
const PHASE = {1:3, 2:11, 3:7}; // 12/04: Kíp1=S, Kíp2=N, Kíp3=C – theo lịch thực tế

// ── ĐÈ LỊCH TẠM THỜI THÁNG 9 + 10/2026 ─────
// Hai tháng này là giai đoạn chuyển tiếp sang chu kỳ 28 ngày nên KHÔNG theo
// quy tắc chu kỳ 12 ngày ở trên. Nguồn:
//   T9 : Lich_ca_3_team_tu_24-08_den_30-11_2026.xlsx
//   T10: Lich_ca_thang_10_2026_2_phuong_an_ca_lien_mach.xlsx (sheet "PA1 - Giữ ngày nghỉ")
// Mỗi ngày: [Kíp 1, Kíp 2, Kíp 3] — quy đổi từ file: D(Đêm)->C (Chiều 18h-6h),
// N(Ngày)->S (Sáng 6h-18h), OFF->N (Nghỉ), C1 giữ nguyên (Ca 1, 6h-14h); 01+02/09 -> L (Nghỉ Lễ)
const SCHED_OVR = {
  // ── tháng 9/2026 ──
  '2026-09-01':['L','L','L'], // T3 01/09
  '2026-09-02':['L','L','L'], // T4 02/09
  '2026-09-03':['C','N','S'], // T5 03/09
  '2026-09-04':['N','C','S'], // T6 04/09
  '2026-09-05':['N','C','S'], // T7 05/09
  '2026-09-06':['N','N','N'], // CN 06/09
  '2026-09-07':['C','N','S'], // T2 07/09
  '2026-09-08':['C','S','N'], // T3 08/09
  '2026-09-09':['C','S','N'], // T4 09/09
  '2026-09-10':['C','S','N'], // T5 10/09
  '2026-09-11':['N','S','C'], // T6 11/09
  '2026-09-12':['N','S','C'], // T7 12/09
  '2026-09-13':['N','N','C'], // CN 13/09
  '2026-09-14':['S','N','C'], // T2 14/09
  '2026-09-15':['S','N','C'], // T3 15/09
  '2026-09-16':['S','C','N'], // T4 16/09
  '2026-09-17':['S','C','N'], // T5 17/09
  '2026-09-18':['N','C','S'], // T6 18/09
  '2026-09-19':['N','N','S'], // T7 19/09
  '2026-09-20':['N','N','S'], // CN 20/09
  '2026-09-21':['C','N','S'], // T2 21/09
  '2026-09-22':['C','S','N'], // T3 22/09
  '2026-09-23':['C','S','N'], // T4 23/09
  '2026-09-24':['C','S','N'], // T5 24/09
  '2026-09-25':['N','S','C'], // T6 25/09
  '2026-09-26':['N','S','C'], // T7 26/09
  '2026-09-27':['N','N','N'], // CN 27/09
  '2026-09-28':['S','N','C'], // T2 28/09
  '2026-09-29':['S','C','N'], // T3 29/09
  '2026-09-30':['S','C','N'], // T4 30/09
  // ── tháng 10/2026 ──
  '2026-10-01':['N','C','S'], // T5 01/10
  '2026-10-02':['S','C','N'], // T6 02/10
  '2026-10-03':['S','C','N'], // T7 03/10
  '2026-10-04':['N','N','N'], // CN 04/10
  '2026-10-05':['S','N','C'], // T2 05/10
  '2026-10-06':['S','N','C'], // T3 06/10
  '2026-10-07':['N','S','C'], // T4 07/10
  '2026-10-08':['N','S','C'], // T5 08/10
  '2026-10-09':['C','S','N'], // T6 09/10
  '2026-10-10':['C','S','N'], // T7 10/10
  '2026-10-11':['N','N','N'], // CN 11/10
  '2026-10-12':['N','C','S'], // T2 12/10
  '2026-10-13':['N','C','S'], // T3 13/10
  '2026-10-14':['N','C','S'], // T4 14/10
  '2026-10-15':['S','C','N'], // T5 15/10
  '2026-10-16':['S','C','N'], // T6 16/10
  '2026-10-17':['N','N','N'], // T7 17/10
  '2026-10-18':['N','N','C'], // CN 18/10
  '2026-10-19':['S','N','C'], // T2 19/10
  '2026-10-20':['S','N','C'], // T3 20/10
  '2026-10-21':['N','S','C'], // T4 21/10
  '2026-10-22':['N','S','C'], // T5 22/10
  '2026-10-23':['C','S','N'], // T6 23/10
  '2026-10-24':['C','S','N'], // T7 24/10
  '2026-10-25':['N','S','N'], // CN 25/10
  '2026-10-26':['C','N','S'], // T2 26/10
  '2026-10-27':['C','N','S'], // T3 27/10
  '2026-10-28':['C','N','S'], // T4 28/10
  '2026-10-29':['C','N','S'], // T5 29/10
  '2026-10-30':['C','N','S'], // T6 30/10
  '2026-10-31':['C','S','N'], // T7 31/10
};
function ovrKey(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

// Từ 01/10/2026 chưa chốt lịch (chờ thông tin chính thức) -> hiện "UN" (chưa có lịch)
// thay vì đoán theo chu kỳ 12 ngày cũ. Khi có lịch: nối ngày vào SCHED_OVR ở trên
// rồi đẩy mốc này lên, hoặc bỏ hẳn nếu đã đổi CYCLE/REF sang chu kỳ mới.
const SCHED_UNKNOWN_FROM = '2026-11-01';

function getShift(k, d) {
  const _ov = SCHED_OVR[ovrKey(d)];
  if (_ov && _ov[k-1]) return _ov[k-1];
  if (ovrKey(d) >= SCHED_UNKNOWN_FROM) return 'UN';
  const len = CYCLE.length;
  const d0 = new Date(d); d0.setHours(0,0,0,0);
  const n = Math.round((d0 - REF) / 864e5);
  return CYCLE[((n + PHASE[k]) % len + len) % len];
}

// Trả về {type:'work'|'rest', day:X, total:N}
// Quét theo lịch thực tế (tính cả SCHED_OVR) thay vì suy từ vị trí trong chu kỳ.
function getBlockStatus(k, d) {
  const isRest = s => s === 'N' || s === 'L';
  const d0 = new Date(d); d0.setHours(0,0,0,0);
  const cur = getShift(k, d0);
  if (cur === 'UN') return { type:'none', day:0, total:0 };
  const rest = isRest(cur);
  let back = 0, fwd = 0;
  for (let i = 1; i <= 14; i++) {
    const p = new Date(d0); p.setDate(p.getDate() - i);
    const sp = getShift(k, p);
    if (sp === 'UN' || isRest(sp) !== rest) break;
    back++;
  }
  for (let i = 1; i <= 14; i++) {
    const nx = new Date(d0); nx.setDate(nx.getDate() + i);
    const sn = getShift(k, nx);
    if (sn === 'UN' || isRest(sn) !== rest) break;
    fwd++;
  }
  return { type: rest ? 'rest' : 'work', day: back + 1, total: back + 1 + fwd };
}
