# v2.1.0-rc1 — a test build

**A pre-release, for trying the players' half on a second client.** It is
deliberately kept out of `releases/latest`, so worlds on 2.0.0 stay where they
are. Nothing here has been played through yet.

## Players can roll the day's duties

The table switches it on (*Players roll the day's duties*), and the Referee then
hands out the evening a piece at a time: every duty a player could roll carries
a **key** on the Referee's strip and inside the Making camp window, and nothing
is open until that key is turned. Keys fall closed again with the day.

- **Three duties are the character's own** — preparing spells, fetching
  firewood, bedding down. Once per character per day.
- **The camp's group steps are the party's** — finding food, the campsite,
  water, the fire, cooking, camaraderie, the watches. One roll for everyone; if
  the table has named a party leader, theirs.
- **Everything else stays the Referee's** — the weather, getting lost, and both
  wandering-monster checks never appear on a player's bar at all.

A player's die is greyed until it is theirs to press, and says why on its
tooltip. The dice are rolled and written on the Referee's client, because the
day's state is a world setting; a refusal comes back as a whisper.

The dialogs now ask the person pressing about **their own characters** for the
personal rolls, and about the whole party where the question is the party's —
the watch rota, who eats, and what wood comes out of the packs.

Firewood and sleep **add up** across several rolls instead of the last one
replacing the night's record.

## The attribute sheet reads the book's own tables

Kindred, Alignment and Background offer what the Player's Book prints — and the
background and appearance suggestions **follow the Kindred**, because the book
prints a table per Kindred. Languages are ticked from a list of Dolmenwood's
tongues and written into the field comma-separated; anything typed by hand
survives.

**All 36 moon signs**, with the book's own wording. Choosing one writes the
field *and* files the effect as a block beside the Kindred traits, where a
permanent rule can actually be read mid-fight.

## Fixes

- The Building a fire window laid its rows on top of each other.
- Fire and cooking now work the same way: every stepper starts at nought, and
  each row says what is left in the pack as wood or ingredients are taken.
- The Appearance section no longer folds itself shut every time a suggestion is
  taken inside it.

## Testing this build

Install it in the test world by manifest URL:

```
https://github.com/DevHovAI/Dolmendwood-Quartermaster/releases/download/v2.1.0-rc1/module.json
```

It will not offer itself as an update to anybody else.
