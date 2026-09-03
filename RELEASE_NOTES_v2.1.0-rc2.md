# v2.1.0-rc2 — a test build

Everything in **rc1**, and five things found by playing it. Still a
pre-release: it stays out of `releases/latest`, so worlds on 2.0.0 are not
offered it.

## Fixed since rc1

- **Preparing spells did nothing on a player's screen.** Whether the duty needs
  dice at all is a question about the whole party; which names go on the form is
  a question about the person pressing. The two had become one, so a player
  whose own casters had slept well fell into the "everybody prepared freely"
  branch — which only a Referee's client can carry out. The die now works, and
  a player with nothing to roll is told so.
- **The campfire is no longer a tick a player can set.** It eases the Sleep
  Difficulty for everyone with bedding, so it is read from the camp rather than
  answered on the form — and the Referee's client takes it from the camp state
  rather than from the message, because a disabled box is a courtesy and not a
  lock. The Referee's own tick still stands.
- **The sleep form shows the whole camp again.** Rows that are somebody else's,
  and rows already rolled tonight, are dimmed and read-only, and a row that has
  been rolled shows the bedding recorded for it. Seeing only your own row left
  no way to tell whether anybody else had bedded down.
- **Fetching firewood arrives with your own characters ticked.** Whoever opened
  that form is going for wood.
- **The Referee's whispered cards leave nothing behind on a player's screen.**
  Foundry shows a whispered message that carries dice to everyone and paints it
  as "rolled privately" with `???` — so getting lost, the two wandering-monster
  checks and the watch's mishaps each left a placeholder card in the players'
  log. Those cards are now removed on their clients. The dice sound still plays
  for the table; say if that should go too.

## Testing this build

Install it in the test world by manifest URL — **an existing install will not
find it by pressing Update**, because a pre-release is deliberately not
`latest`:

```
https://github.com/DevHovAI/Dolmendwood-Quartermaster/releases/download/v2.1.0-rc2/module.json
```

Relaunch the world afterwards and reload the browser with Ctrl+F5: Foundry
caches module code.
