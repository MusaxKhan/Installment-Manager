import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/services/user-service";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default async function AccountPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) {
    redirect("/login");
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Account</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {profile.email}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            You&apos;ll need your current password to set a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm email={profile.email} />
        </CardContent>
      </Card>
    </div>
  );
}