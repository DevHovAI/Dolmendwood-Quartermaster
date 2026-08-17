Everything since v1.5.14: a shared party store, loot boxes, a rebuilt inn, and a
long list of fixes to encumbrance, handovers and the shop.

## Shared party store

A single actor holds containers, pack animals and vehicles the whole party may
use. Its zones appear inside every character's inventory, so anyone can put
things in or take them out without a GM present. Coins can live there too.
Sharing and unsharing is the existing "give zone" operation pointed at the store.

The store gets its own narrower card at the end of the Party Overview, and its
pack animals still count toward the party's marching pace — a shared horse sets
the pace exactly like a privately owned one.

Fixed on the way: giving away a pack animal used to leave a ghost behind. Only
the zone and its contents moved, not the animal itself, so the next write minted
a fresh empty duplicate zone.

## Loot boxes

The GM assembles a hoard privately and releases it to the party in one click.
A released box is announced in chat with a button to open it, and every box is
listed in a Loot window.

- Place a box on the map as a pin, with a chosen icon. Deleting the box takes
  its pin with it.
- Only the Release button ever grants the party access — placing an already
  released box does not reveal it.
- Coins can be split evenly, per denomination rather than by total value:
  turning 7 gp into 700 cp is a trip to a money changer, not arithmetic.
  Whatever will not go round stays in the box.
- Each share shows what it adds to the recipient's load, and turns red when it
  would cost them a speed tier — coins weigh 1 each.

## The inn, rebuilt

The three quality levels are alternatives, not a progression: a fancy house has
no floor to sleep on. Each level now has its own complete tables, and every inn
keeps its own editable copy of them.

- **Four sections** — lodging, food, beverages, extras.
- **A menu that changes by the day.** Food and drink are drawn from the house's
  pools each in-game day. The GM can re-roll, and "New day" clears the day's
  board and makes every inn's menu stale at once.
- **House specialities.** A line marked "always available" is the local brew or
  the signature dish and never enters the draw. A house can be set to serve
  nothing but its own.
- **A board** showing who has already had lodging and food today.
- **Two ways to buy** every line: for the paying character, or standing someone
  else a round — the payer's purse empties either way.
- **Things to carry away.** Drink by the bottle or cask (5 portions for the
  price of 4; 10 for the price of 8), and travel rations at every inn. Any line
  can be pointed at a catalog item to sell goods, with a target zone, an amount,
  and a warning when the weight would cost the buyer a speed tier.
- **The quality of a placed inn is fixed.** A section may still differ from the
  house, for fine rooms above a common kitchen.

Two defects fixed: a character who could not afford a room got it anyway and the
deduction silently did nothing, and with no GM connected the guest was told they
had paid while the purse stayed full.

## Encumbrance and speed

- **Speed 0 is a real state.** Above the maximum load the speed used to be shown
  as 10 ft with a note admitting the character could not move. It is 0 now, and
  an over-capacity animal or vehicle drags the whole party to a halt instead of
  being quietly left behind. Leaving something behind is the deliberate act of
  marking its zone dropped.
- **A dropped zone now drops its container's weight too.** A left-behind
  backpack kept charging its own 50 wt.
- **Bundle weight was wrong.** Two bundles of firewood with half of one used
  came out lighter than they should. Consumables now count units rather than
  scaling every copy by the open bundle's ratio.
- **Pack animals ignored partial contents**, so a half-empty quiver on a horse
  was billed as full.
- **Land vehicles can be given a double team**, with the capacity derived rather
  than stored, so unhitching restores the original rating exactly.
- **A party pace badge** in the Party Overview toolbar. Per-member speeds never
  said how fast the group actually travels.
- The speed colours were reworked for colour-vision deficiency. The old scale
  had two adjacent tiers that were indistinguishable to a red-green-weak reader.

## Inventory

- **Multi-select**: click to select, shift-click to extend, right-click for move,
  give and delete. Dragging one selected row carries the whole selection.
- **Partial amounts** when moving or giving a stack.
- **Consumables stack** instead of opening a second row, and bundles show one
  running total of loose units.
- **One quiver per row**, showing only its fill level. Buying a single arrow
  fills an existing quiver or starts a new one.
- **Giving now asks which zone** it should go into, and offers only zones that
  can take it. Animals and vehicles stay selectable when overloading them is
  merely slow rather than impossible, and say so.
- **Zones left behind can be folded away**, per user.
- Giving with no GM connected used to destroy the item. Every handover now checks
  first.

## Shop

- Stock the shop with your own items — this previously worked only for a shop
  behind a map note, which is why it looked as though the feature did not exist.
- Custom items were listed at their raw price while the purchase charged the
  adjusted one.
- Categories stay expanded, and the catalog no longer jumps to the top after
  every purchase.
- Placement rules are enforced when adding an item, not only when moving it, and
  all zones are offered rather than just "Equipped".

## Under the hood

- Moved to the Foundry v13 type definitions, with a typecheck script. This
  surfaced three real defects that had been invisible.
- One resolver for an inventory row's definition. Custom items had their weight,
  size and tags read correctly but never their uses, which is why a part-empty
  custom container weighed full.
- Fixed a regression that stopped the module loading entirely: all toolbar
  buttons vanished.

## Compatibility

Existing worlds need no migration. Inns that already carry their own edited
tables keep them, and will not pick up the new ration lines until that section is
reset from the book.
