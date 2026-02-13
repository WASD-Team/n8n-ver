"use client";

import { useState } from "react";
import type { AppUser, UserProfile } from "@/lib/usersStore";

type ProfilePayload = {
  ok: boolean;
  error?: string;
  profile?: UserProfile;
};

export function ProfileClient(props: { user: AppUser; hasPassword: boolean }) {
  const [displayName, setDisplayName] = useState(props.user.name);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);

  const [hasPassword, setHasPassword] = useState(props.hasPassword);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveName() {
    setSavingName(true);
    setNameStatus(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: displayName }),
      });
      const data = (await res.json()) as ProfilePayload;
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to update name");
      setNameStatus("Saved");
    } catch (err) {
      setNameStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordStatus("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    setPasswordStatus(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
          confirmPassword,
        }),
      });
      const data = (await res.json()) as ProfilePayload;
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to update password");
      setPasswordStatus(hasPassword ? "Password updated" : "Password set");
      setHasPassword(Boolean(data.profile?.hasPassword) || hasPassword || true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-zinc-400">Account</div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">Profile</h1>
        <p className="text-sm text-zinc-500">Update your display name and password.</p>
      </div>

      <section className="border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Display name</h2>
        <p className="text-xs text-zinc-500">This name is shown in audit logs and user lists.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="form-field h-10"
              placeholder="Your name"
            />
          </label>
          <div className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Email</span>
            <div className="flex h-10 items-center border border-zinc-100 bg-zinc-50 px-3 text-sm text-zinc-600">
              {props.user.email}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
            onClick={saveName}
            disabled={savingName}
          >
            {savingName ? "Saving…" : "Save name"}
          </button>
          {nameStatus ? <div className="text-xs text-zinc-500">{nameStatus}</div> : null}
        </div>
      </section>

      <section className="border border-zinc-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">{hasPassword ? "Change password" : "Set password"}</h2>
        <p className="text-xs text-zinc-500">
          {hasPassword
            ? "Enter your current password to update it."
            : "Set a password to secure your account for future login updates."}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {hasPassword ? (
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-zinc-700">Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePassword()}
                className="form-field h-10"
                placeholder="••••••••"
              />
            </label>
          ) : null}
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && savePassword()}
              className="form-field h-10"
              placeholder="Minimum 8 characters"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-zinc-700">Confirm password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && savePassword()}
              className="form-field h-10"
              placeholder="Repeat password"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="h-10 bg-[#ff4d7e] px-4 text-sm font-medium text-white hover:bg-[#f43b70]"
            onClick={savePassword}
            disabled={savingPassword}
          >
            {savingPassword ? "Saving…" : hasPassword ? "Update password" : "Set password"}
          </button>
          {passwordStatus ? <div className="text-xs text-zinc-500">{passwordStatus}</div> : null}
        </div>
      </section>
    </div>
  );
}
