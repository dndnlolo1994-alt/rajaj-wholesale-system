import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/setup-required', '/print-bridge'];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  // مسار الـ cron محمي بسر خاص وليس بجلسة مستخدم
  if (pathname.startsWith('/api/cron')) {
    return NextResponse.next();
  }

  // بيئة غير مكتملة → صفحة إرشادات الإعداد
  if (!url || !anonKey) {
    if (pathname === '/setup-required') return NextResponse.next();
    return NextResponse.redirect(new URL('/setup-required', request.url));
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // مهم: لا تضع أي كود بين إنشاء العميل واستدعاء getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  // فتح البرنامج → شاشة البيع مباشرة (بدون تحميل صفحة وسيطة)
  if (user && pathname === '/') {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // كل المسارات ما عدا الملفات الثابتة وأصول PWA
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|sw\\.js|icons/|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
