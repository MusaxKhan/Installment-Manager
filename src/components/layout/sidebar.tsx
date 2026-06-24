"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarBrand, SidebarNav } from "./sidebar-nav";
import type { UserRole } from "@/types/domain";

export function MobileSidebar({ role }: { role: UserRole }) {
  const [open, setOpen] = React.useState(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-border bg-card md:hidden">
          <DialogPrimitive.Title className="sr-only">
            Navigation menu
          </DialogPrimitive.Title>
          <div className="flex items-center justify-between">
            <SidebarBrand />
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="mr-3">
                <X className="h-5 w-5" />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div onClick={() => setOpen(false)}>
            <SidebarNav role={role} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function DesktopSidebar({ role }: { role: UserRole }) {
  return (
    <aside className="hidden w-64 flex-col border-r border-border bg-card md:flex">
      <SidebarBrand />
      <SidebarNav role={role} />
    </aside>
  );
}
