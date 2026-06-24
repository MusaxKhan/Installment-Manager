import { redirect } from "next/navigation";
import { DesktopSidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { OfflineSyncProvider } from "@/components/offline/offline-sync-provider";
import { ServiceWorkerRegistration } from "@/components/offline/service-worker-registration";
import { InstallPrompt } from "@/components/offline/install-prompt";
import { getCurrentUserProfile } from "@/lib/services/user-service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  return (
    <OfflineSyncProvider>
      <ServiceWorkerRegistration />
      <div className="flex h-screen overflow-hidden bg-background">
        <DesktopSidebar role={profile.role} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar profile={profile} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
      <InstallPrompt />
    </OfflineSyncProvider>
  );
}
