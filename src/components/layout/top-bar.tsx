import { MobileSidebar } from "@/components/layout/sidebar";
import { GlobalSearch } from "@/components/layout/global-search";
import { OfflineStatusBadge } from "@/components/offline/offline-status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth-actions";
import type { UserProfile } from "@/types/domain";

function initials(name: string | null, email: string): string {
  if (name && name.trim().length > 0) {
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }
  return email[0]?.toUpperCase() ?? "?";
}

export function TopBar({ profile }: { profile: UserProfile }) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-6">
      <div className="flex flex-1 items-center gap-3">
        <MobileSidebar role={profile.role} />
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-3">
        <OfflineStatusBadge />
        <Badge
          variant={profile.role === "admin" ? "default" : "secondary"}
          className="hidden sm:inline-flex"
        >
          {profile.role === "admin" ? "Admin" : "Partner"}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {initials(profile.fullName, profile.email)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium lg:inline">
                {profile.fullName ?? profile.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium text-foreground">
                {profile.fullName ?? "Unnamed user"}
              </p>
              <p className="text-xs font-normal text-muted-foreground">
                {profile.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form action={signOutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="flex w-full items-center gap-2">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
