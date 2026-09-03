# v2.1.0 — the players take their own dice, and the sheet reads the book

## Players can roll the day's duties

Switch on **Players roll the day's duties**, and the evening stops being a queue
at the Referee's elbow. Every duty a player may roll carries a **key** on the
Referee's strip and inside the Making camp window, and **nothing is open until
that key is turned** — so the evening is handed out a step at a time, foraging
in the afternoon and the camp's work when the party actually makes camp. The
keys fall closed again with the day.

**Three duties are the character's own** — preparing spells, fetching firewood,
bedding down — once per character per day.

**The camp's group steps are the party's** — finding food, the campsite, water,
the fire, cooking, camaraderie, the watches. One roll for everyone; where the
table has named a party leader, theirs. Finding food is a party roll because the
book says so: one Survival Check per travelling group, on the best Skill Target
among them (Player's Book p152).

**Everything else stays the Referee's.** The weather, getting lost and both
wandering-monster checks never appear on a player's bar at all.

A player's die is greyed until it is theirs to press and says why on its
tooltip. The dice are rolled and written on the Referee's client — the day's
state is a world setting — and a refusal comes back as a whisper to the player
it concerns.

The forms ask the person pressing about **their own characters** for the
personal rolls, and about the whole party where the question is the party's: the
watch rota, who eats, and whose packs the wood comes out of. Bedding down lists
the whole camp, with everybody else's rows dimmed and read-only, showing what
they have already rolled. Whether a campfire is burning is read from the camp
rather than answered on the form.

Firewood and sleep **add up** across several rolls instead of the last one
replacing the night's record.

## The attribute sheet reads the book's own tables

Kindred, Alignment and Background offer what the Player's Book prints, as
suggestions rather than a closed list — the same way the Class field has always
worked. **Background and the appearance fields follow the Kindred**, because the
book prints a table per Kindred: fill in the Kindred and the rest suggests that
Kindred's own trades, faces and beliefs.

**Languages are ticked** from Dolmenwood's own tongues, grouped as the book
groups them, and written into the field comma-separated. Anything typed by hand
survives every tick.

**All 36 moon signs**, in the book's wording. Choosing one writes the field
*and* files the effect as a block beside the Kindred traits — where a permanent
rule can actually be read in the middle of a fight, and can be given a roll, a
value or a number of uses like any other block.

## Experience and levelling

An **XP award window**: the session's experience, divided by the book (p25) and
modified by each character's Prime Ability (p22). And the **house-rule
level-up** on the attribute sheet, with all nine Class advancement tables — one
press writes the new Level, the XP threshold, Attack, the five saves and rolled
Hit Points together.

## Fixes

- The Building a fire window laid its rows on top of one another.
- Fire and cooking are one form in two units now: every stepper starts at
  nought, and each row says what is left in the pack as wood or ingredients are
  taken.
- The Appearance section no longer folds itself shut whenever a suggestion is
  taken inside it.
- **The Referee's private rolls leave nothing behind.** Foundry shows a
  whispered message that carries dice to everybody, as "rolled privately" with
  `???` — so getting lost, both wandering-monster checks and the watch each left
  a placeholder card in the players' log. Those messages no longer carry their
  dice, which is what makes them invisible: no card, no notification, no sound.
- The watch's result no longer appears on a player's own strip. Its card is
  whispered; their bar now says only that it was rolled.
- The roll button says what becomes of the answer — announced to the table, or
  whispered to the Referee.
