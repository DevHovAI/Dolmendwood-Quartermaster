## Fixes

- **GM actions silently did nothing**: Granting an item from the shop, giving an item, a storage zone or coins from a character sheet — none of it took effect when the GM triggered it. Module messages are delivered only to *other* connected clients, but every one of these actions is handled exclusively by the GM, so the message was sent out, discarded by each player, and never executed anywhere. A confirmation still appeared, which made it look as though it had worked. Player-initiated actions such as buying were unaffected, since those genuinely do travel to the GM. All actions now run directly on the GM's own client instead of being sent into the void.
- **Items lost when the GM handed them over**: Giving an item from one character to another removed it from the giver immediately and only then sent it to the recipient. Combined with the bug above, a GM-initiated handover destroyed the item outright. Both halves now run as one operation.
- **Overlapping actions could cancel each other out**: Inventory writes read the current state, modify it and write it back. Two actions running at nearly the same moment both read the same starting point, and the second silently discarded the first. Writes are now processed one after another.
- **Open windows did not refresh**: The refresh broadcast that follows every transaction never reached any window because of a faulty lookup, so the shop's coin display and similar views could show stale numbers until reopened.
- **Shop bought for the wrong character**: Opening the shop from a character's inventory always selected the first party member in the actor directory rather than the character you came from — easy to miss, and the purchase or grant then went to the wrong sheet. The shop now follows the inventory it was opened from, and re-targets even when it is already open.
- **Coin fields ignored their width**: The per-zone coin inputs are styled by Foundry's core stylesheet with a rule that outranks the module's own, so any width set here had no effect. They now size themselves reliably.

## Changes

- **Party overview**: Character name, encumbrance bars and coins stay pinned to the top of each column while the item list scrolls, so you can always tell whose gear you are looking at. The per-column backpack button is gone — clicking anywhere on a column already opens that inventory.
- **Roomier windows**: The party overview and the inventory window both open noticeably wider, capped so they never exceed the available screen width.
- **Less repetition**: The inventory header no longer repeats the travel speed a third time; it is already shown by the encumbrance bar and the convoy bar.
- **Tidier zone controls**: The give and delete buttons at the foot of a storage zone are now icons like their neighbours, instead of stretched labels sitting slightly out of line.
- **Wider coin fields** in each zone's purse, with room for larger amounts.
- **Better icons**: Dog armour, dog food and riding saddle bags no longer all show a horse.
