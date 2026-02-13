import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "vm_user";

function buildLogoutResponse(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const origin = host ? `${proto}://${host}` : request.url;
  const loginUrl = new URL("/login", origin);
  const response = NextResponse.redirect(loginUrl, 303);
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function POST(request: NextRequest) {
  return buildLogoutResponse(request);
}

export async function GET(request: NextRequest) {
  return buildLogoutResponse(request);
}
