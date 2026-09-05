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

## Wird übersetzt

| Englisch | Deutsch |
|---|---|
| Class | Klasse |
| Character | Charakter (Pl. Charaktere) |
| share / half share | Anteil / halber Anteil |
| Earned | Verdient |
| Credited | Gutgeschrieben |
| Modifier | Modifikator |
| GM / Referee | SL |
| attribute sheet | Attributsbogen |
| party | Gruppe |

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
