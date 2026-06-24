"use client";

import * as React from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { inviteUserAction } from "@/lib/actions/user-actions";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { OFFLINE_BLOCKED_MESSAGE } from "@/lib/offline/guards";

function SubmitButton({ isOnline }: { isOnline: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || !isOnline}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Sending invite...
        </>
      ) : (
        "Send Invite"
      )}
    </Button>
  );
}

export function InviteUserDialog() {
  const router = useRouter();
  const { isOnline } = useOnlineStatus();
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState(inviteUserAction, null);

  React.useEffect(() => {
    if (state?.success) {
      toast.success("Invitation sent.");
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={!isOnline}
          title={!isOnline ? OFFLINE_BLOCKED_MESSAGE.invite_user : undefined}
        >
          {isOnline ? (
            <UserPlus className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          {isOnline ? "Invite Partner" : "Needs Connection"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a Team Member</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email to set their password and sign in.
            There is no public sign-up — invitations are the only way in.
          </DialogDescription>
        </DialogHeader>

        {!isOnline && (
          <Badge variant="overdue" className="flex w-fit items-center gap-1.5">
            <WifiOff className="h-3.5 w-3.5" />
            {OFFLINE_BLOCKED_MESSAGE.invite_user}
          </Badge>
        )}

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full Name</Label>
            <Input id="fullName" name="fullName" required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select name="role" defaultValue="partner" required>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="partner">Partner</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state?.error && (
            <p className="rounded-md bg-status-overdue-bg px-3 py-2 text-sm text-status-overdue">
              {state.error}
            </p>
          )}

          <DialogFooter>
            <SubmitButton isOnline={isOnline} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
