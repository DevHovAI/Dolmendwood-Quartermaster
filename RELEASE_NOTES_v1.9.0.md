The map knows where the party is, and the sheet knows who they are.

## An attribute sheet of the module's own

Page one of the printed Dolmenwood character sheet, in a window: the six scores and their modifiers, the five saves, level and experience, armour and attack, and a portrait.

- **Blocks** are one model for a trait, a class ability, a spell or an extra skill. The module ships no class list, no kindred list and no spell list — a block can be any of them, and your table writes what it plays. Every block is addressable as `@b.<slug>`.
- **No formula language of its own.** References go into a bag and Foundry's own `Roll` resolves them, so the whole dice syntax comes for free: `@str`, `@strMod`, `@level`, `@hp`, `@ac`, `@attack`, the five saves, the three skills, `@b.<slug>`, and the state penalties.
- **The six roll kinds** of the Player's Book (pp144–145): Ability Check, Skill Check, Save, Attack, X-in-6, and a bare formula. A natural 1 always fails and a natural best always succeeds, judged apart from the arithmetic.
- **Weapons roll from the inventory.** All twenty catalogue weapons carry their numbers, so the damage die, melee or missile, and the three range bands come off the equipped row. Strength applies to melee attack and damage, Dexterity to missile attack and not to missile damage. Brace, Charge, Reach, Reload, Splash and Armour piercing are shown and deliberately not computed — each is a ruling.
- **Hunger and exhaustion are kept apart**, because the book keeps them apart: exhaustion is −1 to attack **and** damage, capped at −4; hunger is −1 to −5 on attack plus Speed, and never touches damage. Neither reaches an Ability, Skill or Save.
- **One home per value.** Where OSE has a field, the sheet writes to OSE's; only what OSE has no place for lives in the module's own flag. Token health bars keep working.

## The camp and the morning roll themselves

Six camp duties now roll rather than tick: firewood, the fire, cooking, camaraderie, the watches, and sleep. Where a roll needs a character's own number, it asks which character and shows the score it used.

- **Firewood, three steps.** Under five hours' worth, no campfire; five to seven, a campfire at −1 on the sleep check; eight or more, no penalty. The penalty is dropped wherever the fire bought nothing — with no bedding the table's two rows are identical, so a short fire is never worse than none.
- The **sleep check** feeds the "slept well" clock and the cumulative exhaustion the module already tracked.
- **Firewood comes out of the packs**, as the catalogue's own bundle, and a spent bundle leaves no empty row behind.
- The sleep card **itemises its modifiers** rather than printing one number.
- A **forced march is a longer day, not a faster one**: it buys 50% more Travel Points and stretches the hours to match.

## Every hex on the map says what it is like

All 195 hexes the Campaign Book details now carry a short description in this module's own plain English, the places the book gives them — hidden ones marked as hidden — and the people who live there.

- A **briefing card** is whispered to the Referee whenever the party's hex changes: the travel numbers, the description, the places and people, the ley line or encounter note, and the page.
- The book's own prose stays in the book. What the card carries is said again in ordinary English, and the page reference is one click from the words themselves.
- Reading the pages by hand turned up **a dozen mechanical lines the module had never carried**: missing foraging lines, ley lines, the Ring of Chell on nineteen hexes, and several hexes' own encounter notes.

## The hex gets a vote on what the party meets

Seventy-nine hexes print an encounter rule of their own, and until now nothing rolled them. Now the wandering-monster check consults the hex before it reads the regional tables.

- Three kinds, because the book writes three things in one sentence shape: one that **replaces** what the tables would have said, one that only **adds** to it, and one that **changes the base chance** for that hex.
- Conditions the module can check — night, day, road, off-road, weather — are checked. What it cannot check is printed on the card in bold, and one button rolls the ordinary tables instead, keeping the check, the surprise and the distance as they were.
- A rule that misses is printed too, so it is clear the tables were reached because the hex declined.
- Three hexes raise the **party's own** chance of being surprised; one rolls on a region that is not its own; one sends the type die back when it says Monster.

## The map can be measured, and then it knows

A Foundry scene numbers its own cells from its own corner; that has nothing to do with "1310". Measure two hexes once — stand the token in a hex you know, type the number, press the crosshairs, then do it again one column across — and the module reads the hex off any position on that map.

- The day bar **fills its own hex field**, with the terrain and region the book gives it, and the briefing card fires on the move itself.
- **Travel Points are charged for the hexes crossed**, not the hex landed in: 2 a hex along a road or track, the terrain's own cost when travelling wild, and every hex a drag passes through.
- **A move the party cannot pay for is refused before it happens**, with a message saying what it would have cost and how far they can still get. That is the book's own rule, and it is a setting.
- The **drag ruler counts in Travel Points**: "3 TP (2 left)" under the token before anybody commits, marked when the two do not fit.
- Two measurements, not one, because hex columns are staggered by half a hex and which way they lean is a fact about the map that a single measurement cannot contain.

## Treasure, books and the day bar

- **A creature's hoard and its possessions** roll into a staged loot box. The book's distinction is kept: a hoard is in the lair, possessions are on the body, and the lair check is rolled with the encounter rather than waiting for a button. Loot is reached by walking to it.
- **A book falls open the way a book is bound** — an even page on the left, whatever the PDF's own page offset.
- **An inventory row can be edited whole**, not only renamed: its name, its qualities, its weight and a value only the Referee sees.
- The day bar's **"where are we?" row is two fixed lines** with nothing folded away: the hex, its page and what it fills in, then the season, the settlement, the way and the chance of losing it.

## Compatibility

Foundry VTT v13 minimum, verified on v14.
