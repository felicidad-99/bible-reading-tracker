import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const protectedPrefixes = [
    "/dashboard",
    "/calendar",
    "/reader",
    "/stats",
    "/settings",
    "/onboarding",
  ];

  const isProtected = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  const isLoggedIn = Boolean(req.auth?.user);

  if (isProtected && !isLoggedIn) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }

  if ((pathname === "/signin" || pathname === "/signup") && isLoggedIn) {
    return Response.redirect(new URL("/dashboard", req.url));
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/calendar/:path*",
    "/reader/:path*",
    "/stats/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
    "/signin",
    "/signup",
  ],
};
