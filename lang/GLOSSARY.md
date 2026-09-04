# Glossar — Deutsch

**Leanders Entscheidung, 2026-09-04.** Die Regel in einem Satz: **deutsche Prosa,
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
