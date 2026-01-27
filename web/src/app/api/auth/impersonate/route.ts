import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { email: string };
  if (!body.email) {
    return NextResponse.json({ ok: false, error: "Email is required" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("vm_user", body.email, { httpOnly: true, sameSite: "lax", path: "/" });
  return response;
}

