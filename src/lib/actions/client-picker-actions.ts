"use server";

import { listClientsWithBlacklistStatus } from "@/lib/services/client-service";

export async function getClientsForPicker() {
  const clients = await listClientsWithBlacklistStatus();
  return clients.map((c) => ({
    id: c.id,
    label: `${c.clientCode} — ${c.name}`,
    isBlacklisted: c.isBlacklisted,
    maxOverdueMonths: c.maxOverdueMonths,
  }));
}

/** Full client list for the clients page table — used by the online path */
export async function getClientsList(search?: string) {
  return listClientsWithBlacklistStatus({ search });
}