## Fixes

- **Ghost containers**: Containers and animals added through the GM "Add Item" dialog never got their storage/vehicle zone. The item was stored and counted toward weight, but zone-granting items are filtered out of the item lists (they are meant to render as zone headers), so it became invisible and impossible to delete. All add paths — GM dialog, socket grant, purchase — now share a single zone-creation helper.
- **Self-healing inventories**: Existing saves are repaired on the next inventory write. Missing zones are created for container and animal items that never got one, and legacy zones without an item link are adopted rather than duplicated. Nothing is deleted and no weight changes.
- **Stacked containers**: Zone-granting items are always split to quantity 1, so adding three backpacks yields three usable compartments instead of one zone and triple weight.
- **Unreachable coins**: Coins granted by the GM landed in a zone that had no purse UI, and afterwards neither the GM nor the owner could change the amount. The zone purse now renders for Equipped in both encumbrance modes and for Unsorted in weight mode, and the Unsorted section stays visible while it holds coins. Grant Coins now targets the same zone as every other coin transfer, and weight mode folds otherwise unreachable belt-pouch coins into Equipped.

## Features

- **Party convoy speed**: The inventory header shows your own marching pace next to a party-wide convoy speed — the slowest of every member's own speed and every animal or vehicle they lead — with the bottleneck named. Overloaded animals that cannot move are excluded instead of dragging the whole party to a standstill. Inventory windows now re-render when any party member's load changes, so the value cannot go stale.
