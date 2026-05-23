import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const canonicalHost = "www.nexatech.edu.kg";
  const host = request.headers.get("host") || "";
  const isLocal =
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (!isLocal && host !== canonicalHost) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.host = canonicalHost;
    return NextResponse.redirect(canonicalUrl);
  }

  const origin = isLocal
    ? `${request.nextUrl.protocol}//${host}`
    : `https://${canonicalHost}`;

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isStudentProtectedRoute = pathname.startsWith("/mail/inbox") || pathname.startsWith("/mail/settings");
  const isAdminProtectedRoute = pathname === "/mail/admin" || pathname.startsWith("/mail/admin/");
  const isAdminLoginRoute = pathname === "/mail/admin/login";

  if (isStudentProtectedRoute && !user) {
    const returnTo = pathname.startsWith("/mail/") ? pathname.replace(/^\/mail/, "") : pathname;
    const websiteUrl = new URL(origin);
    websiteUrl.searchParams.set("mail_login", "1");
    websiteUrl.searchParams.set("redirect", returnTo);
    return NextResponse.redirect(websiteUrl);
  }

  if (isAdminProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/mail/admin/login";
    url.searchParams.set(
      "redirect",
      pathname.startsWith("/mail/") ? pathname.replace(/^\/mail/, "") : pathname
    );
    return NextResponse.redirect(url);
  }

  if (pathname === "/mail/login") {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = "/mail/inbox";
      return NextResponse.redirect(url);
    }

    return NextResponse.redirect(new URL(`${origin}?mail_login=1`));
  }

  if (isAdminLoginRoute) {
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/login",
    "/inbox/:path*",
    "/settings/:path*",
    "/admin",
    "/admin/:path*",
    "/api/auth/:path*",
    "/api/admin/:path*",
    "/mail",
    "/mail/:path*",
  ],
};
