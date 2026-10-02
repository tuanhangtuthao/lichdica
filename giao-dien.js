// ═══════════════════════════════════════════════════════════════
// GIAO DIỆN DÙNG CHUNG - thanh điều hướng + thông báo nhỏ
// ═══════════════════════════════════════════════════════════════
// Mọi trang nạp file này (cùng giao-dien.css). Nó làm 2 việc:
//
// 1. Dựng MỘT thanh điều hướng cho cả web. Trước đây mỗi trang tự làm một
//    kiểu (nút ở đầu trang, hàng tab, thanh dưới, menu "Thêm") và chồng lên
//    nhau. Giờ: máy tính có dãy link trong đầu trang; điện thoại có thanh 4 mục
//    dính đáy. Thêm/bớt trang thì sửa danh sách MUC bên dưới, mọi trang đổi theo.
//
// 2. Thay hộp alert() bằng thông báo nhỏ tự ẩn, không chặn màn hình. Các trang
//    vẫn gọi alert() như cũ, không phải sửa từng chỗ. confirm() và prompt() GIỮ
//    NGUYÊN vì code cần chờ câu trả lời trước khi chạy tiếp.
(function(){
  'use strict';

  // ── Các trang trong web. dt = vị trí trên điện thoại (null = nằm trong "Thêm") ──
  const MUC = [
    {id:'index',      ten:'Lịch ca',            icon:'lich',   mt:1, dt:2},
    {id:'ca-cua-toi', ten:'Ca của tôi',         icon:'nguoi',  mt:2, dt:1},
    {id:'xin-nghi',   ten:'Xin nghỉ',           icon:'don',    mt:3, dt:3},
    {id:'rating',     ten:'Đánh giá',           icon:'sao',    mt:4, dt:null},
    {id:'5s',         ten:'Kiểm tra 5S',        ngan:'5S',     icon:'kiem',  mt:5, dt:null, phu:'Cần mật khẩu'},
    {id:'nhansu-ca',  ten:'Nhân sự ca',         icon:'nhom',   mt:null, dt:null},
    {id:'huong-dan',  ten:'Tài liệu',           icon:'sach',   mt:null, dt:null, phu:'Video · hình · PDF'},
    {id:'dashboard',  ten:'Dashboard quản đốc', icon:'bieudo', mt:null, dt:null},
  ];

  const ICON = {
    lich:   '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    nguoi:  '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    don:    '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 14h6M9 17h4"/>',
    sao:    '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
    kiem:   '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    nhom:   '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
    sach:   '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5V4.5M8 7h8M8 11h6"/>',
    bieudo: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    them:   '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    xuong:  '<path d="M6 9l6 6 6-6"/>',
    dung:   '<path d="M5 12l5 5 9-10"/>',
    loi:    '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  };
  function svg(ten, co, mau){
    return `<svg width="${co||22}" height="${co||22}" viewBox="0 0 24 24" fill="none" stroke="${mau||'currentColor'}" ` +
           `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[ten]}</svg>`;
  }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Trang đang mở. Web chạy cả dạng /rating lẫn /rating.html, và / là trang chủ.
  const TRANG = (function(){
    let p = decodeURIComponent(location.pathname.split('/').pop() || '');
    p = p.replace(/\.html?$/i, '');
    return p || 'index';
  })();
  const href = m => m.id + '.html';
  const dang = m => m.id === TRANG;

  // ═══════════ THÔNG BÁO NHỎ ═══════════
  let vung = null;
  function thongBao(chu, tuyChon){
    chu = String(chu ?? '');
    if(!document.body){ return alertGoc(chu); }
    if(!vung){
      vung = document.createElement('div');
      vung.className = 'gd-tb-vung';
      vung.setAttribute('aria-live', 'polite');
      document.body.appendChild(vung);
    }
    // Bỏ emoji đầu câu (✅ ❌ ⚠️...) - đã có biểu tượng vẽ nét thay
    const sach = chu.replace(/^[\s☀-➿️‍\u{1F300}-\u{1FAFF}]+/u, '').trim() || chu;
    const loi = (tuyChon && 'loi' in tuyChon) ? tuyChon.loi
      : /(^|\s)(lỗi|error|thất bại|sai|chưa|không thể|không được|vui lòng|cần|phải)/i.test(chu) || /[❌⚠]/.test(chu);
    const o = document.createElement('div');
    o.className = 'gd-tb' + (loi ? ' loi' : '');
    o.setAttribute('role', loi ? 'alert' : 'status');
    o.innerHTML = svg(loi ? 'loi' : 'dung', 20, loi ? '#B3261E' : '#7DD3A0') + '<span></span>';
    o.lastChild.textContent = sach;
    o.title = 'Bấm để đóng';
    const tat = () => { if(o.parentNode) o.parentNode.removeChild(o); };
    o.onclick = tat;
    vung.appendChild(o);
    while(vung.children.length > 3) vung.removeChild(vung.firstChild);
    // Câu dài và câu báo lỗi để lâu hơn cho kịp đọc
    const ms = Math.min(10000, Math.max(loi ? 6000 : 3200, 2400 + sach.length * 45));
    setTimeout(tat, ms);
  }
  const alertGoc = window.alert.bind(window);
  window.alert = m => thongBao(m);
  window.gdThongBao = thongBao;
  window.gdAlertGoc = alertGoc;   // lỡ cần hộp chặn thật thì vẫn còn

  // ═══════════ THANH ĐIỀU HƯỚNG ═══════════
  function dung(){
    if(document.body.classList.contains('gd')) return;
    document.body.classList.add('gd', 'gd-co-nav', 'gd-trang-' + TRANG.replace(/[^a-z0-9-]/gi, ''));
    batDauBoEmoji();

    // ── Máy tính: dãy link trong đầu trang ──
    const dau = document.querySelector('[data-gd-nav]') || document.querySelector('.hdr');
    if(dau){
      const nav = document.createElement('nav');
      nav.className = 'gd-nav-tren';
      nav.setAttribute('aria-label', 'Các trang');
      const chinh = MUC.filter(m => m.mt).sort((a,b) => a.mt - b.mt);
      const them  = MUC.filter(m => !m.mt);
      nav.innerHTML = chinh.map(m =>
          `<a href="${href(m)}"${dang(m) ? ' class="dang" aria-current="page"' : ''}>${esc(m.ngan || m.ten)}</a>`).join('') +
        `<button type="button" class="gd-nut-them${them.some(dang) ? ' dang' : ''}" aria-haspopup="true" aria-expanded="false">` +
          `Thêm ${svg('xuong', 16)}</button>`;
      const trai = dau.querySelector('.hdr-left') || dau.firstElementChild;
      if(trai && trai.nextSibling) dau.insertBefore(nav, trai.nextSibling); else dau.appendChild(nav);

      const menu = document.createElement('div');
      menu.className = 'gd-them-menu';
      menu.innerHTML = them.map(m =>
        `<a href="${href(m)}"${dang(m) ? ' class="dang" aria-current="page"' : ''}>${svg(m.icon, 20)}${esc(m.ten)}</a>`).join('');
      document.body.appendChild(menu);
      const nut = nav.querySelector('.gd-nut-them');
      const dongMenu = () => { menu.classList.remove('mo'); nut.setAttribute('aria-expanded', 'false'); };
      nut.addEventListener('click', ev => {
        ev.stopPropagation();
        if(menu.classList.contains('mo')){ dongMenu(); return; }
        const r = nut.getBoundingClientRect();
        menu.style.top = (r.bottom + 6) + 'px';
        menu.style.left = Math.max(8, Math.min(r.left, innerWidth - 236)) + 'px';
        menu.classList.add('mo'); nut.setAttribute('aria-expanded', 'true');
      });
      document.addEventListener('click', ev => { if(!menu.contains(ev.target)) dongMenu(); });
      document.addEventListener('keydown', ev => { if(ev.key === 'Escape') dongMenu(); });
      addEventListener('resize', dongMenu);
    }

    // ── Điện thoại: thanh 4 mục dính đáy + tấm "Thêm" ──
    const duoi = document.createElement('nav');
    duoi.className = 'gd-nav-duoi';
    duoi.setAttribute('aria-label', 'Các trang');
    const dtChinh = MUC.filter(m => m.dt).sort((a,b) => a.dt - b.dt);
    const dtThem  = MUC.filter(m => !m.dt);
    duoi.innerHTML = dtChinh.map(m =>
        `<a href="${href(m)}"${dang(m) ? ' class="dang" aria-current="page"' : ''}>${svg(m.icon)}<span>${esc(m.ngan || m.ten)}</span></a>`).join('') +
      `<button type="button" class="gd-mo-tam${dtThem.some(dang) ? ' dang' : ''}" aria-haspopup="true">${svg('them')}<span>Thêm</span></button>`;
    document.body.appendChild(duoi);

    const man = document.createElement('div'); man.className = 'gd-man';
    const tam = document.createElement('div'); tam.className = 'gd-tam';
    tam.setAttribute('role', 'dialog'); tam.setAttribute('aria-label', 'Các trang khác');
    tam.innerHTML = '<div class="gd-tam-quai"></div>' + dtThem.map(m =>
      `<a href="${href(m)}"${dang(m) ? ' class="dang" aria-current="page"' : ''}>${svg(m.icon)}` +
      `<span>${esc(m.ten)}${m.phu ? `<small>${esc(m.phu)}</small>` : ''}</span></a>`).join('');
    document.body.appendChild(man); document.body.appendChild(tam);
    // Mở cả hai cùng lúc. Đừng hoãn sang khung hình sau: bấm đóng trước khung đó
    // thì lệnh mở hoãn vẫn chạy, tấm bật lại mà không còn lớp nền để bấm đóng.
    const moTam  = () => { man.classList.add('mo'); tam.classList.add('mo'); document.body.classList.add('gd-tam-mo'); };
    const dongTam = () => { tam.classList.remove('mo'); man.classList.remove('mo'); document.body.classList.remove('gd-tam-mo'); };
    duoi.querySelector('.gd-mo-tam').addEventListener('click', moTam);
    man.addEventListener('click', dongTam);
  }

  // ═══════════ BỎ EMOJI ĐẦU CHỮ TRÊN NÚT, TAB, TIÊU ĐỀ ═══════════
  // Emoji mỗi máy hiện một kiểu, trên nút còn làm chữ lệch hàng. Chỉ bỏ emoji
  // ĐỨNG ĐẦU, và chỉ khi sau đó còn chữ - nút chỉ có biểu tượng (🔑, ✕) giữ nguyên
  // để không thành nút trống. Nút do JS vẽ lại sau cũng được xử lý (MutationObserver).
  const CHON_EMOJI = 'button,.btn,.tab,.sbtn,.kb,h1,h2,h3,.s-section-head';
  const EMOJI = /^[\s☀-➿⬀-⯿️‍\u{1F300}-\u{1FAFF}]+/u;
  function boEmoji(goc){
    if(!goc || goc.nodeType !== 1) return;
    const ds = goc.matches(CHON_EMOJI) ? [goc] : [];
    goc.querySelectorAll(CHON_EMOJI).forEach(e => ds.push(e));
    for(const el of ds){
      if(el.closest('.gd-nav-tren,.gd-nav-duoi,.gd-tam,.gd-them-menu,#tl-root')) continue;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while((n = w.nextNode())){
        if(!n.nodeValue.trim()) continue;
        const con = n.nodeValue.replace(EMOJI, '');
        if(con !== n.nodeValue && con.trim()) n.nodeValue = con;
        break;            // chỉ xét cụm chữ đầu tiên của phần tử
      }
    }
  }
  let choEmoji = [], dangHen = false;
  const theoDoi = new MutationObserver(ds => {
    ds.forEach(d => d.addedNodes.forEach(n => { if(n.nodeType === 1) choEmoji.push(n); }));
    if(choEmoji.length && !dangHen){
      dangHen = true;
      setTimeout(() => { dangHen = false; const x = choEmoji; choEmoji = []; x.forEach(boEmoji); }, 0);
    }
  });
  function batDauBoEmoji(){ boEmoji(document.body); theoDoi.observe(document.body, {childList:true, subtree:true}); }

  // Chiều cao hàng tab con, để CSS tính đúng vùng bảng (khỏi đoán số cố định)
  function doTab(){
    const t = document.querySelector('.top-tabs');
    if(t && t.offsetHeight) document.documentElement.style.setProperty('--gd-tab-h', t.offsetHeight + 'px');
  }
  addEventListener('resize', doTab);
  addEventListener('load', doTab);
  document.addEventListener('DOMContentLoaded', doTab);

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dung);
  else dung();
})();
