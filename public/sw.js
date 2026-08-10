// Service Worker — تثبيت التطبيق كتطبيق هاتف + تخزين الأصول الثابتة
// البيانات الحية تبقى من الشبكة دائمًا (نظام مالي — لا نعرض بيانات قديمة).

const CACHE = 'rajaei-static-v1';
const STATIC_PATTERNS = [/^\/_next\/static\//, /^\/icons\//, /^\/fonts\//, /\.(?:woff2?|png|svg|ico)$/];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isStatic = STATIC_PATTERNS.some((p) => p.test(url.pathname));
  if (isStatic) {
    // الأصول الثابتة: من الكاش أولًا (أسماؤها مجزأة فلا تتقادم)
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(event.request, clone));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // التنقل: شبكة دائمًا، وصفحة بديلة عند انقطاع الاتصال
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>غير متصل</title><style>body{font-family:Tahoma,system-ui;background:#0b2a22;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100dvh;margin:0;text-align:center}div{padding:24px}h1{font-size:22px}p{color:#8fd0b8;font-size:14px}button{margin-top:16px;background:#237c62;color:#fff;border:0;border-radius:10px;padding:12px 24px;font-size:15px;font-weight:bold}</style></head><body><div><h1>لا يوجد اتصال بالإنترنت</h1><p>نظام رجائي المصري يحتاج اتصالًا لعرض البيانات الحية</p><button onclick="location.reload()">إعادة المحاولة</button></div></body></html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        ),
      ),
    );
  }
});
