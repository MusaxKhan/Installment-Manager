/**
 * Operations that are NEVER allowed to queue offline.
 *
 * Profit distribution and withdrawals rely on atomic, row-locked
 * Postgres functions (distribute_contract_profit,
 * create_withdrawal_with_balance_check) specifically to prevent
 * double-distribution and double-withdrawal under concurrent access.
 * That guarantee only exists with a live connection to the database.
 * If we let these queue offline:
 *   - Two partners could each queue a withdrawal for the same investor
 *     while offline, both reading a stale "available balance" cached
 *     locally, and both succeed once synced — overdrawing the investor.
 *   - A contract could be marked complete offline and queued for
 *     distribution twice if the device's outbox retried after a
 *     partial failure, since there's no row lock protecting a queue.
 *
 * Rather than try to make these safe offline (which would mean
 * re-implementing distributed locking on a phone), we just don't let
 * them happen offline. The UI disables the relevant actions and shows
 * a clear "this needs a connection" message instead.
 */
export const ONLINE_ONLY_OPERATIONS = [
  "distribute_profit",
  "create_withdrawal",
  "invite_user",
  "create_investor",
  "create_business_phase",
  "add_investment",
] as const;

export type OnlineOnlyOperation = (typeof ONLINE_ONLY_OPERATIONS)[number];

export const OFFLINE_BLOCKED_MESSAGE: Record<OnlineOnlyOperation, string> = {
  distribute_profit:
    "Profit distribution needs a live connection — it's protected against double-payouts in a way that only works online. Try again once you're back online.",
  create_withdrawal:
    "Withdrawals need a live connection to safely check the investor's available balance. Try again once you're back online.",
  invite_user:
    "Inviting a team member needs a live connection to send the email invite.",
  create_investor:
    "Adding an investor needs a live connection right now — this keeps investor records simple to reconcile. Try again once you're back online.",
  create_business_phase:
    "Creating a business phase needs a live connection — it closes the previous phase as part of the same action.",
  add_investment:
    "Recording an investor's investment needs a live connection right now, since it feeds directly into profit-split math.",
};

/**
 * Operations that CAN be queued offline and synced later. Each maps to
 * an OutboxOperationType in lib/offline/db.ts.
 */
export const OFFLINE_CAPABLE_OPERATIONS = [
  "create_client",
  "update_client",
  "create_contract",
  "record_payment",
] as const;
