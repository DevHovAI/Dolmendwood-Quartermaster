# Glossar — Deutsch

**Dolmenmasters Entscheidung, 2026-09-04.** Die Regel in einem Satz: **deutsche Prosa,
englische Regelbegriffe.** Die Gruppe spielt aus den englischen Büchern, also
soll ein Begriff, den man am Tisch nachschlägt, im Modul so heißen wie im Buch —
alles andere ist deutsch.

Das hier ist keine Empfehlung, sondern die verbindliche Liste. Wer einen neuen
String übersetzt, schlägt hier nach, bevor er ein Wort erfindet.

## Bleibt englisch

| Begriff | Nicht | Warum |
|---|---|---|
| XP | ~~EP~~ | Steht so im Buch und auf dem Bogen. |
| Level | ~~Stufe~~ | Ebenso. „Aufstieg" als Vorgang ist deutsch erlaubt. |
| STR, INT, WIS, DEX, CON, CHA | ~~ST, IN, WE, GE, KO, CH~~ | Das Spielsystem führt diese Werte selbst; deutsche Kürzel würden vom System abweichen. |
| Prime Ability | ~~Hauptattribut~~ | Distinkter Dolmenwood-Regelbegriff. |
| Ability Score | ~~Attributswert~~ | Ebenso. |
| Kindred | ~~Abstammung, Volk~~ | Ebenso. |
| Retainer | ~~Gefolgsmann, Söldner~~ | Ebenso. Im Deutschen als Substantiv groß. |
| Player's Book, Campaign Book, Monster Book | — | Buchtitel sind Eigennamen. Seitenangabe deutsch: `Player's Book S. 25`. |
| Eigen- und Ortsnamen | — | Prinzell, Lankshorn, Hag's Addle … bleiben, wie sie sind. |
| Slot (Ausrüstung) | ~~Feld~~ | Dolmenmasters Entscheidung, 2026-09-05. Der Gepäckplatz heißt Slot, Plural Slots. **Achtung:** `Feld` bleibt richtig, wo ein *Eingabefeld* gemeint ist („trag das Hex ins Feld ein“) und wo es um Äcker geht. |
| Survival, Skill Target | ~~Überleben, Fertigkeitswert~~ | Regelbegriffe wie Prime Ability. |
| Listen, Search | ~~Lauschen, Suchen~~ | Die anderen beiden gedruckten Skills, gleiche Begründung. |
| Hit Points, Armour Class, Attack, Magic Resistance | ~~Trefferpunkte, Rüstungsklasse~~ | Stehen so auf dem gedruckten Bogen, und OSE führt die Felder unter diesen Namen. |
| Ability Check, Skill Check, Saving Throw, Save, Attack Roll, Reaction Roll | — | Die Namen der Würfe. So schlägt man sie nach. |
| Doom, Ray, Hold, Blast, Spell | — | Die fünf Saves, wie das Buch sie nennt. |
| Strength, Intelligence, Wisdom, Dexterity, Constitution, Charisma | — | Ebenso, ausgeschrieben wie abgekürzt. |
| Melee, Missile | ~~Nahkampf, Fernkampf~~ | Als *Bezeichnung* eines Angriffs oder einer Quality. Die Prosa darum ist deutsch: „Nahkampfschaden“ bleibt richtig. |
| Arcane, Holy | ~~arkan, heilig~~ | Die beiden Zauberarten des Buches (S. 78 und S. 100). |
| Trait | ~~Wesenszug~~ | Der Block-Typ auf dem Attributsbogen. |
| Rank (Zauber) | ~~Grad, Stufe~~ | Regelbegriff. |
| Moon Sign | ~~Mondzeichen~~ | Regelbegriff — **und** der gespeicherte Name der Blockgruppe, unter der ein gewähltes Zeichen abgelegt wird. Der Picker findet den alten Block über genau diesen Namen, um ihn zu ersetzen; eine mit der Sprache wechselnde Überschrift hinterließe einen Charakter mit zwei Moon Signs. |

## Wird übersetzt

| Englisch | Deutsch |
|---|---|
| Class | Klasse |
| Character | Charakter (Pl. Charaktere) |
| share / half share | Anteil / halber Anteil |
| Earned | Verdient |
| Credited | Gutgeschrieben |
| Modifier | Modifikator |
| GM / Referee | Referee (der Referee, maskulin) |
| attribute sheet | Attributsbogen |
| party | Gruppe |
| Alignment | Gesinnung |
| cap (XP-Obergrenze) | Deckel |
| spell credit / charge | Zauberguthaben / Ladung |
| trainer | Lehrmeister |
| background / affiliation | Hintergrund / Zugehörigkeit |
| range band: short, medium, long | kurze, mittlere, weite Entfernung |

`Gesinnung` und `Deckel` sind meine Entscheidung vom 2026-09-06, nicht
Dolmenmasters — beide sind gewöhnliche Wörter statt Dolmenwood-Eigenbegriffe,
und der Deckel ist ohnehin eine Hausregel. Wenn er sie anders haben will, sind
es zwei Zeilen hier und je eine Handvoll Schlüssel.

`Klasse` ist bewusst deutsch: es ist ein gewöhnliches Wort, kein
Dolmenwood-Eigenbegriff, und `"X" ist keine Class, die dieses Modul kennt` liest
sich auf Deutsch schlecht. Gemischte Komposita werden durchgekoppelt:
`Prime-Ability-Modifikator`, `XP-Bonusfeld`.

## Würfel

**Dolmenmasters Entscheidung, 2026-09-05.** Eine Chance von x in sechs heißt
auf Deutsch **`x-von-6`**, nie ~~`x-auf-6`~~. Das gilt überall gleich, auch
bei mehreren Zahlen: `1/2/3-von-6`.

| Englisch | Deutsch |
|---|---|
| 1-in-6 | 1-von-6 |
| 2-in-6 to lose the way | 2-von-6, den Weg zu verlieren |
| chance in six | Chance von sechs |

Die Würfelschreibweise selbst bleibt, wie das Buch sie setzt: `1d6`, `2d10`,
`1d3` — nicht `W6`. Sie steht so auf jedem Blatt, aus dem am Tisch gelesen
wird, und ist damit ein Regelbegriff wie `STR`.

## Regeln für die Schlüssel selbst

- **Kein Schlüssel ist gleichzeitig Text und Zweig.** `Xp.Clear` als Text *und*
  `Xp.Clear.Hint` daneben ist tödlich: Foundry jagt die Datei durch
  `expandObject`, das wirft, und der `catch` ersetzt die **ganze Sprachdatei**
  durch `{}` — jeder String im Modul zeigt dann seinen eigenen Schlüssel an.
  Richtig ist `Xp.Clear.Label` + `Xp.Clear.Hint`. `npm run lang:check` bricht
  darauf ab; das ist der einzige Fehler dort, der die Datei sofort abbricht.
- **Ein Schlüssel pro Satz, mit `{platzhaltern}`** — niemals aus Fragmenten
  zusammengesetzt. Deutsch stellt die Wörter anders; ein aus drei übersetzten
  Bruchstücken geklebter Satz lässt sich nur durch eine Codeänderung umstellen.
- **Plurale über `{{localizeN}}` / `tn()`**, Endungen `.One` und `.Other`.
  Deutsch bildet den Plural nicht durch ein angehängtes „s".
- **Markup nur dort, wo der Schlüssel es selbst trägt** (`<kbd>`, `<strong>`),
  gerendert mit `{{{dreifacher Klammer}}}`. Solche Strings sind hier verfasst,
  nie Nutzereingabe.
- **Beide Dateien halten dieselben Schlüssel und dieselben Platzhalter.**
  `npm run lang:check` prüft das.
