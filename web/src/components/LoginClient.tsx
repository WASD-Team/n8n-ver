"use client";

import { useState } from "react";

export function LoginClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function login() {
    setStatus(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Login failed");
      window.location.href = "/workflows";
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-zinc-400">Access</div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">Sign in</h1>
        <p className="text-sm text-zinc-500">Use your login and password to continue.</p>
      </div>

      <section className="border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Login</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-field h-10"
              placeholder="email@company.com"
              autoComplete="username"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-field h-10"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
            onClick={login}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
          {status ? <div className="text-xs text-zinc-500">{status}</div> : null}
        </div>
      </section>
    </div>
  );
}
