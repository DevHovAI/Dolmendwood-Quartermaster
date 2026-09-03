# v2.1.0-rc3 — a test build

Everything in **rc2**, plus what came out of testing it. Still a pre-release: it
stays out of `releases/latest`, so worlds on 2.0.0 are not offered it.

## The Referee's private rolls really are private now

rc2 tried to remove the placeholder card from the players' chat log and changed
nothing, for a reason Foundry makes plain: the hook that was used fires on an
element the log has **not yet inserted**, so there was nothing to remove.

The dice are now left off the whispered message instead. `ChatMessage#visible`
returns true for a whisper only when the message carries rolls — so without them
the message is invisible by Foundry's own rule, and the chat log skips it
entirely: no card, no notification pip, **no dice sound**, and no 3D dice on a
player's screen. Getting lost, both wandering-monster checks and the watch are
the rolls this covers.

It costs the Referee the 3D dice and the machine-readable roll behind those four
cards. The numbers are printed in the card itself, and every public card still
carries its dice.

Cards left in a player's log by rc1 and rc2 are hidden when the log is redrawn.

## The die now says what becomes of the answer

The roll button promised that every result is whispered to the Referee. That is
true of four duties and false of the other nine — and reading it on **Prepare
spells** is what made that roll look like a secret one. Its card has always been
announced to the table, as have the weather, healing, the camp's work, the
night's sleep and finding food.

## The watch keeps its secret from the players' strip

The watch is a party duty a player may roll, and its card is whispered — but the
strip printed the result under the label, so a player could read who nodded off
straight off their own bar. A secret duty now tells them only that it was
rolled; the Referee still gets the line in full.

## Testing this build

Install by manifest URL — **pressing Update will not find it**, because a
pre-release is deliberately not `latest`:

```
https://github.com/DevHovAI/Dolmendwood-Quartermaster/releases/download/v2.1.0-rc3/module.json
```

Relaunch the world afterwards and reload with Ctrl+F5.
