The module stops looking like six modules, and the sky arrives.

## One look, everywhere

Every window in the module was built when it was needed and styled the same way, which is to say separately. This release settles all of it at once, which is what makes it a 2.0: nothing here changes a rule, and everything here changes what you are looking at.

- **One type scale, in absolute sizes.** All 267 font sizes were `em`, and containers were themselves reduced — so a shop badge inside a shop item rendered at 8.1 pixels, and fifty-three declarations landed under 11px the same way. Five steps now, 11 to 20 pixels, and the size a rule declares is the size you get.
- **One face, named in every window.** Signika, which ships with Foundry itself — no webfont to fetch and nothing to fail mid-session. Before this, exactly one window named a face at all, so the serif you were seeing was never consistent from window to window. Window titles keep Modesto Condensed.
- **One spacing ladder.** Gaps ran 1, 2, 3, 4, 5, 6, 7, 8, 10 and 12 pixels, mixed with `rem` values, and padding came in some twenty-five combinations. Eight rungs now, and everything sits on one of them.
- **Fixed lanes.** Rows in the inventory, the camp steps and the day bar's chips reserve the width of every control they hold, whether or not it is there — so ticking a box or rolling a die no longer nudges the icons and the text along beside it. A step with nothing to roll still gets the die's lane, empty, so what a step says ends in the same column all the way down.
- **Every window starts the same way**: one head, one shape, one set of colours, one trash can — the same icon for the same thing everywhere.

## The day's weather reaches the map

The 2d6 rolled every morning has been saying what the sky is doing since the day bar was built, and saying it only in words. It now draws it, through **FXMaster**, on the maps you switch it on for.

- **Its own effects, not FXMaster's presets.** Five quiet layers — cloud, fog, whatever is falling, thunder, and a glimmer — built from sizes measured against a real world map. FXMaster's own presets are a demonstration of what it can do, several times denser than this and drawn for a battle map; none of them is used here.
- **The book's effect letters decide whether anything falls**, and the book's words decide what. A row with no impeded-travel, poor-visibility or wet-conditions letter draws no rain and no fog however it is worded — "Brooding thunder" is a dry day, and the firewood roll is about to treat it as one.
- **Two rows name thunder and both get it**, including the dry one: a brooding summer sky is lit from inside without a drop of rain falling, because the book gives that row no wet-conditions letter and the firewood roll is about to agree. A flash every eight seconds or so, not a strobe.
- **Cloud is the ground state and a fair day is the exception.** The fair-day test is not a new one: it is the same question hex 0811 has been asking every morning to decide whether the farm girls are out.
- **The unseasons look like themselves.** A sleepy purple mist is purple, a befuddling green fog is green, and a faint glimmer of Fairy hangs over every day of the year — six times as much of it over Hitching and Vague.
- **Two gates, both off by default**, because a module that redresses your map uninvited is a module you uninstall: a setting to allow it at all, and then a switch per map, beside the Weather duty in the day bar. Weather you have set by hand in FXMaster is never touched.
- One setting decides how much of your map it may cover. It moves quantity only, never the sizes.

## The two toolbar doors become places

The generic shop and the generic inn were reachable from anywhere and permanently open, which made them the only two places in the module that were not places at all.

- **The toolbar shop is a shop you build**: empty at first, keeping to its own shelf, named and stocked before anyone can walk in.
- **The inn opens when you say so** — after it has a name and a grade, not while you are still typing them.
- A shut door is **drawn rather than hidden**, so a player can see there is one and that it is not open yet.

## Smaller things

- **Animals and vehicles are fully editable.** A speed typed wrong on the day the mule was bought no longer stays wrong for the campaign.
- **A tie names everybody in it.** Where several party members share the slowest speed, the pace readout says so — unloading the one it happened to name would not have moved the pace, and the module looked broken.
- **The inventory scrolls sideways rather than squashing** when the window is narrowed, instead of taking the space out of the item names.
- **The character sheet reflows to its own width.** Its three breakpoints were media queries, which ask the browser window rather than the window they were written for, so they had never once fired.
- **Both doors into a map note ask the same question.** The loot browser's two entry points disagreed about whether the party had to be standing there.
- The day bar redraws when you switch scenes, so its per-map controls describe the map in front of you rather than the one you just left.

---

**Compatibility:** Foundry VTT v13, verified on v14. The weather needs [FXMaster](https://foundryvtt.com/packages/fxmaster) and does nothing without it; everything else works as before.
