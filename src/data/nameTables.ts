/**
 * The naming tables the bestiary points at instead of printing names.
 *
 * Twenty-six bestiary entries have no name list of their own and say "See Drune
 * faction, DCB" or "See Human Kindred, DPB" instead. Printing that pointer was
 * honest but still left the Referee turning to another book mid-encounter, so
 * the tables it points at are here and the Name button rolls on them directly.
 *
 * All but one are d20s of the same shape — a row of given names per gender plus
 * a surname, or, for elves, a rustic name and a courtly one. The exception is
 * the saints: two creatures are "typically named after a saint", and what that
 * means is the Shrines of Dolmenwood directory, so all thirty-five of them are
 * the table.
 *
 * The wight is the one entry left pointing nowhere, and rightly: its line reads
 * "Names: Not used."
 */
export interface NameTable {
  label: string;
  /** "Male", "Female", "Unisex", "Surname" — or "Rustic"/"Courtly" for elves. */
  columns: string[];
  /** Twenty rows, one word per column (thirty-five for the saints). */
  rows: string[][];
}

export const NAME_TABLES: Record<string, NameTable> = {
  "breggle": {
    label: "Breggle",
    columns: ["Male", "Female", "Unisex", "Surname"],
    rows: [
      ["Aele", "Aedel", "Addle", "Blathergripe"],
      ["Braembel", "Berrild", "Andred", "Bluegouge"],
      ["Broob", "Bredhr", "Blocke", "Bockbrugh"],
      ["Crump", "Draed", "Clover", "Bockstump"],
      ["Drerdl", "Fannigrew", "Crewwin", "Elbowgen"],
      ["Frennig", "Frandorup", "Curlip", "Forlocke"],
      ["Grerg", "Grendilore", "Eleye", "Hwodlow"],
      ["Gripe", "Grendl", "Ellip", "Lankshorn"],
      ["Llerg", "Grewigg", "Frannidore", "Lockehorn"],
      ["Llrod", "Hildrup", "Ghrend", "Longbeard"],
      ["Lope", "Hraigl", "Grennigore", "Longshanks"],
      ["Mashker", "Hwendl", "Gwendl", "Shankwold"],
      ["Olledg", "Maybel", "Hrannick", "Smallbuck"],
      ["Rheg", "Myrkle", "Hwoldrup", "Snicklebock"],
      ["Shadgore", "Nannigrew", "Lindor", "Snidebleat"],
      ["Shadwell", "Pettigrew", "Merrild", "Snoode"],
      ["Shadwicke", "Rrhimbr", "Smenthard", "Underbleat"],
      ["Shandor", "Shord", "Snerg", "Underbuck"],
      ["Shank", "Smethra", "Wendlow", "Wolder"],
      ["Snerd", "Wheld", "Windor", "Woldleap"],
    ],
  },
  "elf": {
    label: "Elf",
    columns: ["Rustic", "Courtly"],
    rows: [
      ["Bucket-and-Broth", "Begets-Only-Dreams"],
      ["Candle-Bent-Sidewise", "Breath-Upon-Candlelight"],
      ["Glance-Askew-Guillem", "Chalice-of-Duskviolet"],
      ["Jack-of-Many-Colours", "Dream-of-Remembrance"],
      ["Lace-and-Polkadot", "Gleanings-of-Lost-Days"],
      ["Lament-of-Bones-Broken", "Hands-Bound-By-Crows"],
      ["Lightly-Come-Softly", "Impudence-Hath-Victory"],
      ["Lillies-o’er-Heartsight", "Indigo-and-Patchwork"],
      ["Prick-of-the-Nail", "Marry-No-Man"],
      ["Silver-and-Quicksilver", "Morning’s-Last-Mists"],
      ["Spring-to-the-Queen", "Murder-of-Ravens"],
      ["Sprue-Upon-Gallows", "Quavering-of-Night"],
      ["Sun’s-Turning-Tide", "Revenge’s-Sweet-Scent"],
      ["Supper-Before-Noon", "Seven-Steps-At-Dawn"],
      ["Too-Soon-Begotten", "Shade-of-Winter-Betrayal"],
      ["Trick-of-the-Light", "Shallow-Pained-Plight"],
      ["Tryst-about-Town", "Shallow-Spirit’s-Lament"],
      ["Tumble-and-Thimble", "Slips-Behind-Shadows"],
      ["Wine-By-The-Goblet", "Spring-Noon’s-Arrogance"],
      ["Youth-Turned-Curdled", "Violet-and-Clementine"],
    ],
  },
  "grimalkin": {
    label: "Grimalkin",
    columns: ["First Name", "Surname"],
    rows: [
      ["Boots", "Bobblewhisk"],
      ["Fripple", "Cottonsocks"],
      ["Ginger", "Flip-a-tail"],
      ["Jack/Jill", "Flippancy"],
      ["Jaspy", "Fluff-a-kin"],
      ["Jasqueline", "Grimalgrime"],
      ["Kitty", "Grinser"],
      ["Little", "Lickling"],
      ["Lord/Lady", "Milktongue"],
      ["Mogget", "Mogglin"],
      ["Moggle", "Poppletail"],
      ["Monsieur/Madame", "Pouncemouse"],
      ["Nibbles", "Pusskin"],
      ["Penny", "Ratbane"],
      ["Poppet", "Snuffle"],
      ["Prince/Princess", "Tailwhisk"],
      ["Prissy", "Tippler"],
      ["Tippsy", "Whippletongue"],
      ["Tomkin", "Whipsy"],
      ["Toppsy", "Whiskers"],
    ],
  },
  "human": {
    label: "Human",
    columns: ["Male", "Female", "Unisex", "Surname"],
    rows: [
      ["Arfred", "Agnel", "Andred", "Addercapper"],
      ["Brom", "Amonie", "Arda", "Burl"],
      ["Bunk", "Celenia", "Aubrey", "Candleswick"],
      ["Chydewick", "Emelda", "Clement", "Crumwaller"],
      ["Crump", "Gertwinne", "Clewyd", "Dogoode"],
      ["Dimothy", "Gilly", "Dayle", "Dregger"],
      ["Guillem", "Gretchen", "Gemrand", "Dunwallow"],
      ["Henrick", "Gwendolyne", "Hank", "Fraggleton"],
      ["Hogrid", "Hilda", "Lyren", "Gruewater"],
      ["Jappser", "Illabell", "Maude", "Harper"],
      ["Joremey", "Katerynne", "Megynne", "Lank"],
      ["Josprey", "Lillibeth", "Moss", "Logueweave"],
      ["Jymes", "Lillith", "Robyn", "Loomer"],
      ["Mollequip", "Lisabeth", "Rowan", "Malksmilk"],
      ["Rodger", "Mabel", "Sage", "Smith"],
      ["Rogbert", "Maydrid", "Tamrin", "Sunderman"],
      ["Samwise", "Melysse", "Ursequine", "Swinney"],
      ["Shadwell", "Molly", "Waldra", "Tolmen"],
      ["Shank", "Pansy", "Waydred", "Weavilman"],
      ["Sidley", "Roese", "Wendlow", "Wolder"],
    ],
  },
  "mossling": {
    label: "Mossling",
    columns: ["Male", "Female", "Unisex", "Surname"],
    rows: [
      ["Dombo", "Bilibom", "Bendiom", "Barkhop"],
      ["Gobd", "Brimbul", "Blobul", "Conker"],
      ["Gobulom", "Ebbli", "Ebdwol", "Danklow"],
      ["Golobd", "Ghibli", "Glob", "Fernhead"],
      ["Gremo", "Gobbli", "Gombly", "Frother"],
      ["Gwomotom", "Gwedim", "Greblim", "Grimehump"],
      ["Hollogowl", "Higwold", "Gwoodwom", "Hogscap"],
      ["Kabob", "Ibulold", "Hollb", "Mossbeard"],
      ["Kollobom", "Imbwi", "Klolb", "Mossfurrow"],
      ["Limbly", "Klibli", "Kwolotomb", "Mould"],
      ["Loblow", "Klimbim", "Lambop", "Mouldfinger"],
      ["Mobdemold", "Libib", "Morromb", "Mudfoot"],
      ["Nyoma", "Limimb", "Mwoomb", "Mugfoam"],
      ["Obolm", "Marib", "Olob", "Mulchwump"],
      ["Oglom", "Milik", "Oobl", "Mushrump"],
      ["Omb", "Shlirimi", "Shlurbel", "Oddpolyp"],
      ["Shmold", "Shobd", "Smodron", "Puffhelm"],
      ["Slumbred", "Skimbim", "Tomdown", "Smallcheese"],
      ["Umbertop", "Slimpk", "Tomumbolo", "Sodwallow"],
      ["Wobobold", "Smodri", "Worrib", "Twiggler"],
    ],
  },
  "woodgrue": {
    label: "Woodgrue",
    columns: ["Male", "Female", "Unisex", "Surname"],
    rows: [
      ["Bagnack", "Bishga", "Bogfrink", "Bobbleslime"],
      ["Barmcudgel", "Canaghoop", "Bongwretch", "Bogbabble"],
      ["Bloomfext", "Cheruffue", "Chunder", "Bootswap"],
      ["Bunglebone", "Doola", "Danklob", "Chumley"],
      ["Capratt", "Frogfyrr", "Frondbong", "Cobwallop"],
      ["Chimm", "Gruecalle", "Gobblebag", "Drooglight"],
      ["Delgodand", "Hoolbootes", "Hootbra", "Dungobble"],
      ["Drunker", "Maulspoorer", "Longsnipe", "Eggmumble"],
      ["Eortban", "Mogsmote", "Lumpfrisk", "Hogslapper"],
      ["Grunkle", "Molemoch", "Mabmungle", "Hortleswoop"],
      ["Gubber", "Moonmilk", "Mungus", "Hungerslip"],
      ["Gumroot", "Munmun", "Obblehob", "Lankwobble"],
      ["Gunkuss", "Nettaclare", "Oddler", "Moorsnob"],
      ["Kungus", "Oorcha", "Oodler", "Mundersnog"],
      ["Longtittle", "Palliepalm", "Pipplepoke", "Pencecrump"],
      ["Lubbal", "Pimplepook", "Slovend", "Persnickle"],
      ["Olpipes", "Puggump", "Umple", "Shunderbog"],
      ["Runkelgate", "Rolliepolk", "Unclord", "Snodgrass"],
      ["Weepooze", "Sasserpipe", "Undermap", "Wallerbog"],
      ["Wumpus", "Whipsee", "Whoopla", "Woodfuffle"],
    ],
  },
  "crookhorn": {
    label: "Crookhorn",
    columns: ["Male", "Female", "Unisex", "Surname"],
    rows: [
      ["Bart", "Breek", "Addle", "Bludger"],
      ["Billy", "Crag", "Adder", "Boner"],
      ["Broo", "Crewn", "Blocke", "Bugber"],
      ["Broob", "Dank", "Bog", "Clubber"],
      ["Curlip", "Errid", "Cleaver", "Crapshod"],
      ["Grim", "Fanny", "Crewn", "Gouger"],
      ["Grip", "Grewigg", "Curlip", "Grimes"],
      ["Gripe", "Gruw", "Dunder", "Hogbard"],
      ["Hoge", "Lankly", "Frand", "Hogblood"],
      ["Lank", "Nagly", "Grerg", "Hoglick"],
      ["Lope", "Nanna", "Grin", "Limplore"],
      ["Lurp", "Plim", "Gore", "Nagger"],
      ["Org", "Prim", "Hanck", "Nailer"],
      ["Shadgore", "Scrag", "Hod", "Quimmer"],
      ["Shank", "Shim", "Lin", "Shergulp"],
      ["Slurp", "Shoddy", "Meg", "Shiver"],
      ["Snerd", "Slyme", "Mug", "Smollow"],
      ["Snerg", "Slynn", "Shrug", "Sodder"],
      ["Willy", "Smoo", "Sodlow", "Wallow"],
      ["Winder", "Wilda", "Wug", "Wanklore"],
    ],
  },
  "frost-elf": {
    label: "Frost Elf",
    columns: ["Rustic", "Courtly"],
    rows: [
      ["Bearded-With-Rime", "Bitter-Dusk’s-Hallow"],
      ["Blackened-and-Bitter", "Black-Rime-and-Frostbite"],
      ["Blood-on-the-Lip", "Candle’s-Last-Gasp"],
      ["Churned-and-Curdled", "Dawn’s-Feeble-Gleaming"],
      ["Cold-Stroke-of-Midnight", "Frost-Dust-Shadow"],
      ["Flurry-and-Fleet", "Frosted-and-Flawless"],
      ["Frosted-Night’s-Breath", "Frozen-in-Lace"],
      ["Hawthorn-and-Thistledown", "Heart-of-Ice"],
      ["Mantle-of-Snowdrifts", "Hearth’s-Bitter-Gloaming"],
      ["Plum-Frost-and-Medlars", "Howling-Wind’s-Waltz"],
      ["Raven’s-Cold-Call", "Ice-Cap-and-Fox-Gown"],
      ["Shivers-Entwined", "Never-Be-Borrowed"],
      ["Stark-Raving-Sorrow", "Shards-of-Dusk-Mirror"],
      ["Stars’-Breath-Splintered", "Sleet-Under-Foot"],
      ["Sunbeam’s-Last-Breath", "Snowfall-at-Dusk"],
      ["Thankless-and-Spry", "Splendour-of-Morrow"],
      ["Thaw-Never-Comes", "Spring’s-Wilting-of-Heart"],
      ["Time’s-Slow-Ague", "Twine-for-the-May-Ball"],
      ["Tip-of-the-Hat", "Weeps-Until-Morning"],
      ["Woken-too-Early", "Willow’s-Slow-Freezing"],
    ],
  },
  "drune": {
    label: "Drune",
    columns: ["Male", "Female", "Unisex", "Surname"],
    rows: [
      ["Abram", "Aembgyth", "Agred", "Astraleth"],
      ["Aestgrym", "Andramath", "Ambe", "Bonewort"],
      ["Brackborne", "Braithlynne", "Athe", "Broodmoot"],
      ["Brimgord", "Caendrgald", "Eld", "Broomewith"],
      ["Cantcor", "Deregbra", "Frig", "Canker"],
      ["Celleddach", "Eolenn", "Gremd", "Casket"],
      ["Dhrimmlon", "Eostra", "Haldrime", "Chancter"],
      ["Forroth", "Estembra", "Hancith", "Dolmward"],
      ["Grimlocke", "Frigdra", "Hestor", "Doome"],
      ["Hecator", "Glana", "Jhaellen", "Duskwith"],
      ["Hestith", "Gremlith", "Jhorhen", "Hallow"],
      ["Hestobraithe", "Gwentmarg", "Limnis", "Loome"],
      ["Illforridh", "Gwordlith", "Lolldhrimm", "Moonewer"],
      ["Majorus", "Haelleth", "Mandra", "Owlhame"],
      ["Malrubius", "Idralynne", "Mirrod", "Unction"],
      ["Mirroddor", "Lagwynne", "Morda", "Unlight"],
      ["Molloch", "Lestwith", "Oblith", "Vaunte"],
      ["Mordoch", "Polldra", "Obwynd", "Wicker"],
      ["Oglimoth", "Pollith", "Oed", "Wraithmord"],
      ["Waykehald", "Sigdra", "Wakehyld", "Wyrd"],
    ],
  },
  "noble-breggle": {
    label: "Noble Breggle",
    columns: ["Male", "Female", "Unisex", "Surname"],
    rows: [
      ["Amshred", "Aedel", "Aegll", "Barbicant"],
      ["Craglow", "Berryld", "Andred", "Canticreed"],
      ["Eriggwen", "Bethla", "Bllennith", "Cllern"],
      ["Fennig", "Crandragrew", "Crewwin", "Cornicus"],
      ["Frannidore", "Dweldra", "Drangwen", "Furroughby"],
      ["Ghrend", "Fannigrew", "Grennigore", "Hoblewort"],
      ["Gryphius", "Fredreth", "Gwendl", "Houndswort"],
      ["Gwellith", "Grendilore", "Hgwennith", "Hraiglent"],
      ["Hgrlleld", "Hlleth", "Hmenidore", "Llhraigl"],
      ["Hmardrus", "Howand", "Hwandilore", "Lockehorn"],
      ["Hwardlow", "Hraigl", "Llaind", "Lockelope"],
      ["Hwoldwen", "Hrannilde", "Merrild", "Malbleat"],
      ["Llandred", "Lindra", "Pllandred", "Murkin"],
      ["Maindr", "Llemberith", "Pwenth", "Overlocke"],
      ["Nodlore", "Llemmeth", "Shennithold", "Pellicorn"],
      ["Olligore", "Mmereth", "Smenthard", "Ramius"],
      ["Shadgore", "Mregginor", "Snerg", "Shankhollow"],
      ["Smerigore", "Pettigrew", "Thannidreth", "Snidebleat"],
      ["Snide", "Pwettig", "Wendlow", "Wealdleap"],
      ["Wllannoth", "Wendliore", "Windor", "Wealdlore"],
    ],
  },
  "saint": {
    label: "Pluritine saint",
    columns: ["Saint"],
    rows: [
      ["St Quister"],
      ["St Wick"],
      ["St Sedge"],
      ["St Dank"],
      ["St Willofrith"],
      ["St Abthius"],
      ["St Hamfast"],
      ["St Elsa"],
      ["St Pastery"],
      ["St Primula"],
      ["St Galaunt"],
      ["St Gretchen"],
      ["St Eggort"],
      ["St Vinicus"],
      ["St Clewyd"],
      ["St Thorm"],
      ["St Ponch"],
      ["St Hollyhock"],
      ["St Goodenough"],
      ["St Faxis"],
      ["St Horace"],
      ["St Waylaine"],
      ["St Foggarty"],
      ["St Wort"],
      ["St Keye"],
      ["St Signis"],
      ["St Cornice"],
      ["St Gondyw"],
      ["St Jorrael"],
      ["St Gripe"],
      ["St Whittery"],
      ["St Lillibeth"],
      ["St Torphia"],
      ["St Dougan"],
      ["St Benester"],
    ],
  },
};

export function nameTable(id: string | undefined): NameTable | undefined {
  return id ? NAME_TABLES[id] : undefined;
}

/**
 * Which columns hold a name a creature is called by, as opposed to a surname.
 *
 * A roll picks one of these before it picks a row: a creature has one name, not
 * a male one and a female one, and handing the Referee all three to choose from
 * would be handing back the decision they pressed the button to avoid.
 */
export function givenColumns(table: NameTable): number[] {
  const given = table.columns
    .map((c, i) => (c === "Surname" ? -1 : i))
    .filter((i) => i >= 0);
  return given.length ? given : [0];
}

export function surnameColumn(table: NameTable): number {
  return table.columns.indexOf("Surname");
}
