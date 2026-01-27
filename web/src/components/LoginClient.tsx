"use client";

import { useEffect, useState } from "react";

export function LoginClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bootstrapNeeded, setBootstrapNeeded] = useState<boolean | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirm, setAdminConfirm] = useState("");
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadBootstrapState() {
      try {
        const res = await fetch("/api/auth/bootstrap");
        const data = await res.json();
        if (!active) return;
        if (!res.ok || !data.ok) {
          setBootstrapError(data.error ?? "Failed to check bootstrap status");
          setBootstrapNeeded(false);
          return;
        }
        setBootstrapNeeded(Boolean(data.needsBootstrap));
      } catch (err) {
        if (!active) return;
        setBootstrapError(err instanceof Error ? err.message : String(err));
        setBootstrapNeeded(false);
      }
    }
    loadBootstrapState();
    return () => {
      active = false;
    };
  }, []);

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

  async function createAdmin() {
    setAdminStatus(null);
    setIsBootstrapping(true);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify({
          name: adminName,
          email: adminEmail,
          password: adminPassword,
          confirmPassword: adminConfirm,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Failed to create admin");
      }
      window.location.href = "/workflows";
    } catch (err) {
      setAdminStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setIsBootstrapping(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-zinc-400">Access</div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">Sign in</h1>
        <p className="text-sm text-zinc-500">Use your login and password to continue.</p>
      </div>

      {bootstrapError ? (
        <div className="border border-red-200 bg-red-50 p-4 text-xs text-red-700">{bootstrapError}</div>
      ) : null}

      {bootstrapNeeded ? (
        <section className="border border-zinc-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Create admin</h2>
          <p className="mt-1 text-xs text-zinc-500">
            No users found. Create the first admin to continue.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-zinc-700">Name</span>
              <input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="form-field h-10"
                placeholder="Alex Kim"
                autoComplete="name"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-zinc-700">Email</span>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="form-field h-10"
                placeholder="admin@company.com"
                autoComplete="email"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-zinc-700">Password</span>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="form-field h-10"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-zinc-700">Confirm password</span>
              <input
                type="password"
                value={adminConfirm}
                onChange={(e) => setAdminConfirm(e.target.value)}
                className="form-field h-10"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
              onClick={createAdmin}
              disabled={isBootstrapping}
            >
              {isBootstrapping ? "Creating…" : "Create admin"}
            </button>
            {adminStatus ? <div className="text-xs text-zinc-500">{adminStatus}</div> : null}
          </div>
        </section>
      ) : null}

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
            disabled={isSubmitting || bootstrapNeeded === true}
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
          {bootstrapNeeded ? (
            <div className="text-xs text-zinc-500">Create an admin account first.</div>
          ) : null}
          {status ? <div className="text-xs text-zinc-500">{status}</div> : null}
        </div>
      </section>
    </div>
  );
}
