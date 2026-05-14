import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC = [
  /^\/signin/,
  /^\/api\/auth\//,
  /^\/api\/calendar\.ics/,
  /^\/api\/meal-calendar\.ics/,
  /^\/_next/,
  /^\/favicon/,
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (!req.auth) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  runtime: "nodejs",
};
