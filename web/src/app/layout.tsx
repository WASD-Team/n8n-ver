import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { SidebarNav } from "@/components/SidebarNav";
import { getCurrentUser } from "@/lib/auth";
import { listWorkflows } from "@/lib/versionsStore";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "n8n Version Manager",
  description: "Browse, compare, and restore n8n workflow versions",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasUserCookie = (await cookies()).has("vm_user");
  let workflows = [];
  let currentUser = null;

  if (hasUserCookie) {
    try {
      [workflows, currentUser] = await Promise.all([listWorkflows(), getCurrentUser()]);
    } catch {
      workflows = [];
      currentUser = null;
    }
  }

  if (!hasUserCookie) {
    return (
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#f4f5f9] text-zinc-950`}
        >
          <div className="min-h-dvh w-full">
            <section className="flex min-h-dvh flex-col bg-[#f4f5f9]">
              <div className="flex-1 p-6">{children}</div>
            </section>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#f4f5f9] text-zinc-950`}
      >
        <div className="min-h-dvh w-full">
          <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[260px_1fr]">
            <aside className="flex flex-col border-b border-white/10 bg-[#0f1f3a] text-white md:border-b-0 md:border-r md:border-white/10">
              <div className="px-6 py-6">
                <div className="text-sm font-semibold tracking-wide">n8n Version</div>
                <div className="text-xs text-white/60">Manager console</div>
              </div>
              <SidebarNav workflows={workflows} />
              <div className="mt-auto border-t border-white/10 px-6 py-4 text-xs text-white/60">
                n8n Version Manager · Preview
              </div>
            </aside>
            <section className="flex min-h-full flex-col bg-[#f4f5f9]">
              <div className="flex h-14 items-center justify-between bg-[#0f1f3a] px-6 text-sm text-white">
                <div className="text-white/70">Workspace: n8n Self-hosted</div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-white/70">
                    {currentUser ? `Signed in: ${currentUser.email}` : "Not signed in"}
                  </span>
                  <form
                    action="/api/auth/logout"
                    method="post"
                    className="text-[#ff4d7e] hover:text-[#f43b70]"
                  >
                    <button type="submit">Log Out ▾</button>
                  </form>
                </div>
              </div>
              <div className="flex-1 p-6">{children}</div>
            </section>
          </div>
        </div>
      </body>
    </html>
  );
}
