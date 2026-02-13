import { ProfileClient } from "@/components/ProfileClient";
import { getCurrentUserProfile } from "@/lib/auth";

export default async function ProfilePage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    return (
      <div className="space-y-3 bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a2545]">Profile</h1>
        <p className="text-sm text-zinc-500">User profile is unavailable.</p>
      </div>
    );
  }

  return <ProfileClient user={profile} hasPassword={profile.hasPassword} />;
}
