// ═══════════════════════════════════════════════════════════════
// TRẠM CHUYỂN TIẾP WEBHOOK ZALO  (Supabase Edge Function "zalo-webhook")
// ═══════════════════════════════════════════════════════════════
// Vì sao cần: Zalo gửi webhook bằng User-Agent "Java/1.8...". Tên miền
// workers.dev của Cloudflare bật sẵn Browser Integrity Check, chặn chữ ký
// đó bằng lỗi 1010 trước khi tới worker - và không tắt được trên workers.dev.
// Supabase thì không chặn, nên Zalo gửi vào đây, trạm này chuyển nguyên văn
// sang worker bằng User-Agent khác.
//
// Trạm KHÔNG tự kiểm tra gì: chuyển nguyên header X-Bot-Api-Secret-Token,
// worker mới là nơi kiểm tra. Ai gọi thẳng vào đây mà sai secret thì worker
// vẫn trả 403 như thường.
//
// Triển khai: dán file này vào Supabase -> Edge Functions -> zalo-webhook,
// và TẮT "Enforce JWT Verification" (Zalo không gửi JWT của Supabase).
// Xem worker/README.md.
// ═══════════════════════════════════════════════════════════════
const WORKER = 'https://lichdica.tuanhang1415.workers.dev/api/zalo';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('ok');

  const res = await fetch(WORKER, {
    method: 'POST',
    headers: {
      'Content-Type': req.headers.get('content-type') ?? 'application/json',
      'X-Bot-Api-Secret-Token': req.headers.get('x-bot-api-secret-token') ?? '',
      'User-Agent': 'ZaloRelay/1.0 (supabase edge function)',
    },
    body: await req.arrayBuffer(),
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') ?? 'text/plain' },
  });
});
