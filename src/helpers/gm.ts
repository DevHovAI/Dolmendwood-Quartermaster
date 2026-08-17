/**
 * Guard for actions that only the GM's client may carry out.
 *
 * Those actions are emitted over the socket and executed on the GM's client.
 * With no GM connected the message goes nowhere, so anything the caller already
 * did locally (removing an item, telling the user it worked) is left standing
 * with no write behind it. Check before that happens.
 *
 * Lives in its own module so both the inventory windows and the shop/inn can use
 * it — PlayerInventoryApp is far too large to import for one helper.
 */
export function requireActiveGM(
  reason = "handovers only work while a GM is online"
): boolean {
  const g = game as Game;
  if (g.user?.isGM) return true;
  if ((g.users?.contents ?? []).some((u) => u.isGM && u.active)) return true;
  ui.notifications?.warn(`No GM is connected — ${reason}.`);
  return false;
}
