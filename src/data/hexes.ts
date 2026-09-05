import type { Region, Terrain } from "./dayContext";

/**
 * What the Campaign Book says about a hex, in the four lines it prints above
 * every entry.
 *
 * The Referee already knows which hex the party is standing in — it is on the
 * map in front of them. Everything else on the day bar’s context row is
 * derivable from it: the terrain and its Travel Point cost, the region whose
 * encounter column the day reads, the chance of getting lost, and whether
 * anything grows here that the ordinary foraging tables do not cover.
 *
 * The mechanical half is the book’s: the hex name is its label, the terrain
 * and the region are the module’s own vocabulary, and the foraging line is the
 * exception the book grants that hex. The book’s **prose** stays in the book,
 * one click away on the page reference — what the card says about a place it
 * says in this module’s own words (see `flavour` below).
 *
 * 195 hexes: every one the book gives a Terrain line. 57 of them grant
 * something extra to a forager, and all 195 are written up.
 */
export interface HexInfo {
  hex: string;
  /** The book’s own title for the hex, for the Referee to recognise it by. */
  name: string;
  terrain: Terrain;
  /** Travel Points to cross it, as the terrain band costs. */
  cost: number;
  region: Region;
  /** The chance of losing the way, or of an encounter, off the road. */
  lost: string;
  /** The Campaign Book page the hex is described on. */
  page: number;
  /** What else the book says about the check here — what an encounter is likely to be, a ley line crossing. */
  /** The second region, where the hex straddles a boundary and the book names both. */
  alsoRegion?: string;
  note?: string;
  /** What a successful forage turns up here on top of the usual, where the book says so. */
  forage?: string;
  /**
   * What the hex is like, in this module's own words.
   *
   * **Written by hand, one hex at a time, exactly as the bestiary's `flavour`
   * is** — and for the same reason. The Campaign Book opens every hex with a
   * paragraph of Necrotic Gnome's prose, and that paragraph stays in the
   * reader's own copy; what a place *is* is a fact, and these are those facts
   * said again in ordinary English. Dolmenmaster asked for it on 2026-08-28: *"Kannst
   * du genau wie bei den Monstern den Inhalt umschreiben?"*
   *
   * Absent until a hex has been written up. A hex without it still shows its
   * places, its people and its numbers — the card is built to grow.
   */
  flavour?: string[];
  /**
   * The places the book details in this hex, and which of them it marks Hidden.
   *
   * Names, not descriptions: "Wight Falls" and "Smerne's Lost Hoard (Hidden)"
   * are the same kind of information as a creature's Hit Dice. What is inside
   * them is on the page the card links to.
   */
  places?: { name: string; hidden?: true; kind?: string }[];
  /** Named people and beings who live here, with what the book calls them. */
  folk?: { name: string; what: string }[];
  /**
   * The hex's **own** encounter rules, as the book's Lost/encounters line gives
   * them — the half of `note` that is a die roll rather than a reminder.
   *
   * 78 hexes have one. Until 2026-08-29 they were text on a card and nothing
   * more: the encounter roll read the terrain, the region, the season and the
   * way, and a party standing in 0305 was as likely to meet a badger as the
   * marsh lanterns the book puts there. Now the roll consults these.
   *
   * **Written by hand from the pages, not parsed out of `note`.** The book says
   * the same thing eight ways ("Encounters are", "Daytime encounters are",
   * "Nighttime encounters on the road are", "Off-road encounters are",
   * "Encounters by the lakeside are"), and a regex over that is exactly the
   * shape of gate that silently drops records.
   */
  hexEncounter?: HexEncounter[];
  /**
   * Which regional table this hex's encounters actually read, where the book
   * sends the Referee to a different one than the hex's own region.
   *
   * Only 1504, the Barrow Bog: it lies in the Aldweald and rolls on the Table
   * Downs. The region field stays what the book prints, because everything else
   * — the day's context row, the briefing card — means the region the hex is in.
   */
  encounterRegion?: Region;
  /**
   * Type-table results this hex re-rolls once, where the book says to.
   *
   * Only 1310, Granny Wolfsbane's lodge: "If the d8 says the encounter is a
   * Monster, roll it again." She has cleared this hex of them.
   */
  rerollTypes?: ("animal" | "monster" | "mortal" | "sentient")[];
}

/**
 * One line of a hex's Lost/encounters rule, made rollable.
 *
 * Three kinds, because the book writes three different things in the same
 * sentence shape:
 *
 * - **`instead`** (the default, and 70 of the 78) — a chance that what turned
 *   up is this rather than whatever the regional tables would have said. Rolled
 *   *after* the ordinary check succeeds: the hex changes **what** is met, not
 *   whether anything is.
 * - **`colour`** — the encounter still comes off the tables, but the hex has
 *   something to add about it (1009's Grey Blight, 0901's folk who cannot leave
 *   the ring of cairns). Rolled the same way; it adds a line rather than
 *   replacing the creature.
 * - **`chance`** — the hex overrides the terrain's own N-in-6 for that period.
 *   Only 0809, where it is 3-in-6 after dark rather than the bog's 2.
 */
export interface HexEncounter {
  /** How likely, in six. A `chance` entry's is the new base check. */
  chance?: number;
  /**
   * The book states it flatly rather than as a chance, so there is no die.
   *
   * Only 0901: anyone met inside the ring of the Mysterious Cairns is trapped
   * in it too, and that is not a 6-in-6, it is a fact about the place.
   */
  always?: true;
  /** Absent means both; otherwise only by day or only at night. */
  period?: "day" | "night";
  /** What comes, in the book's own words, for the card to print. */
  what: string;
  /**
   * The bestiary name to look the creature up under, where one entry means one
   * kind of creature. Absent for "Red Henry or The Girl With Blue Lips" and the
   * other either/ors, and for named individuals the Monster Book has no page
   * for — the card prints `what` and leaves the stat block to the Referee.
   */
  creature?: string;
  /** The number the book rolls, e.g. "2d4". Absent for a single named being. */
  number?: string;
  /**
   * The ways this rule applies on, where the book narrows it to one.
   *
   * The module knows which way the party is travelling, so "on the road" and
   * "off-road" are checked rather than merely printed.
   */
  way?: ("road" | "track" | "wild")[];
  /**
   * A condition the module cannot check — "by the lakeside", "in the swamp",
   * "in the eastern part of the hex", "on sunny days".
   *
   * Dolmenmaster's call (2026-08-29): these still roll, and the condition is printed
   * on the card in bold so the Referee can wave it off. The card's "the
   * ordinary table instead" button is the other half of that.
   */
  where?: string;
  /**
   * Only on a sunny day. One hex (0811), and the day's weather is rolled and
   * stored already, so this is checked rather than printed.
   */
  sunny?: true;
  /**
   * The chance in six that **the party** is surprised, where the book raises it.
   *
   * The book writes it as "opposing side has a 3-in-6 chance of being
   * surprised" — the side opposing the bandits, who are the ones hiding in the
   * woods. Named for who it happens to, because "opposing" read from the wrong
   * end gives the advantage to exactly the wrong people.
   */
  surpriseParty?: number;
  kind?: "instead" | "colour" | "chance";
}

export const HEXES: HexInfo[] = [
  {
    hex: "0101",
    name: "The Spectral Manse",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 190,
    note: "Encounters are 2-in-6 likely to be with a bewildered banshee (DMB) heading to a ball at the Spectral Manse.",
    forage: "1d2 portions of Bosun's Balm (DPB)",
    flavour: [
      "Standing water and mud to the horizon, nothing growing above boot height.",
      "The wind carries violin music from somewhere ahead.",
      "Push through a thicket of blackthorn and a dark wooden manor stands there, blue-tinged and half-real, firelight behind drawn curtains.",
    ],
    places: [
      { name: "The Spectral Manse", kind: "the half-real manor in the blackthorn; rooms shift, and what you take out of it turns to mist" },
    ],
    folk: [
      { name: "Lord Hobbled-and-Blackened", what: "frost elf courtier, thin as an icicle, imprisoned here; plays the violin manically and begs for a letter to be carried" },
    ],
    hexEncounter: [
      { chance: 2, what: "a bewildered banshee on her way to a ball at the Spectral Manse", creature: "Banshee" },
    ],
  },
  {
    hex: "0102",
    name: "Reedwall",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 191,
    forage: "1d3 portions of Sage Toe (p430)",
    flavour: [
      "Reed banks six feet high and twenty feet thick, bog willow between them — a maze, and hard walking.",
      "Black mud pools slurp underfoot. Bones show in some of them.",
      "At night coloured mist drifts off the mire, and sleeping in it can cost a person their dreams for weeks.",
    ],
    places: [
      { name: "Reedwall", kind: "the reed maze itself; getting lost here costs the whole day, and repeats until the next check says otherwise" },
      { name: "Bones in the Mud", kind: "the pools, and the small treasures left with the dead" },
    ],
  },
  {
    hex: "0103",
    name: "The Golden Goose",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 192,
    flavour: [
      "Carpets of red, orange and ochre moss, mile after mile, and a wind that does not let up.",
      "A band of miserable but determined humans is camped out here, hunting a goose that lays golden eggs.",
      "The goose is real. So is the thing that keeps it.",
    ],
    places: [
      { name: "Sidney's Company", kind: "the camp of the goose hunters, a day short of finding what they are looking for" },
      { name: "Crocus's Cave", kind: "an opening hidden under the moss, down into a stone cave of reeds, bones and shiny things", hidden: true },
    ],
    folk: [
      { name: "Sidney Tew", what: "handsome minor noble in worn travelling finery; brags, shows the golden egg, and will use anyone who helps him" },
      { name: "Crocus", what: "a ten-foot skinless fairy ogre with teeth for fingernails; she lets travellers glimpse the goose to draw them in" },
    ],
  },
  {
    hex: "0104",
    name: "The Phantom Lighthouse",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 193,
    flavour: [
      "Rafts of rotting vegetation drifting on black mud and oily pools; no footing here is trustworthy.",
      "In the north a scrubby island rises out of the bog with a four-storey stone tower on it.",
      "After dark a pale blue beam sweeps the bog from the tower's summit, once around every two minutes.",
    ],
    places: [
      { name: "Lighthouse in the Bog", kind: "the tower on the island — barren and lichen-slick by day, crowded with spectral mariners by night" },
      { name: "The Lantern Room", kind: "the crystal that makes the beam, and the thing wrapped around it" },
    ],
    folk: [
      { name: "The Dredger", what: "an eight-armed cephalopod with milky flesh and three pupil-less eyes, feeding on the lantern's crystal" },
    ],
  },
  {
    hex: "0105",
    name: "The Demesne of the Frore Gryphus",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 194,
    note: "Encounters are 3-in-6 likely to be with the frore gryphus residing in this hex, soaring high above the grasslands in search of prey.",
    flavour: [
      "Long blue-green grass with coneflower and goldenrod through it, and no bird noise at all.",
      "Frost-covered ground in patches at the centre of the hex whatever the season, the ice cracked in webs and cold to stand near.",
      "Sheep, dogs and weathered tents on a hill in the south. The shepherds have been losing animals to something that flies.",
    ],
    places: [
      { name: "Frozen Battleground", kind: "old arrowheads and broken blades, a dead frost giant, and two soldiers frozen mid-fight" },
      { name: "Shepherd Encampment", kind: "tents in the shadow of a ring of boulders, around a cooking fire" },
      { name: "The Nest of the Frore Gryphus", kind: "broken boughs in a copse in the north, five gryphlings in it and their mother often nearby", hidden: true },
    ],
    folk: [
      { name: "Aegnyth Cormick", what: "the shepherds' unofficial leader; wants news from Shrivelbyne, her flock safe and the gryphus gone" },
    ],
    hexEncounter: [
      { chance: 3, what: "the frore gryphus that lives here, hunting over the grasslands" },
    ],
  },
  {
    hex: "0106",
    name: "The Outlook and the Red Monolith",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 195,
    forage: "1d3 portions of Wayfarrow (DPB)",
    flavour: [
      "Pale rock worn by the wind into spires and ridges, standing up out of the trees.",
      "Near the eastern edge a granite crag breaks through the canopy, ivy and bramble to the top, a faint crimson glow above it.",
      "From the summit you can see as far as the Falls of Naon on a clear day.",
    ],
    places: [
      { name: "Granite Crag", kind: "a hundred feet of steep rock; old magical runes and broken human skeletons in the brambles at its foot" },
      { name: "The Red Vorpal Monolith", kind: "twenty feet of crimson light above the summit — a figment most of the year, half-solid in winter" },
    ],
  },
  {
    hex: "0107",
    name: "The Weeping Woman",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 196,
    forage: "1d3 portions of Wolfsbane (DPB)",
    flavour: [
      "Open meadow, and every so often a few bars of pipe music on the wind, from nothing you can point at.",
      "Near the treeline a forty-foot grey outcrop looks like a cloaked woman kneeling and facing west.",
      "Cold water runs from her face like tears and gathers into a stream. Drinking it is where the trouble starts.",
    ],
    places: [
      { name: "The Weeping Woman", kind: "the kneeling stone figure, her spring, and the dancing that follows anyone who hears the music in it" },
    ],
  },
  {
    hex: "0108",
    name: "The Cabbage Plot",
    terrain: "farmland",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 197,
    note: "Encounters are 1-in-6 likely to be with a gang of Murkin's Soldiers.",
    flavour: [
      "Turnip, leek, radish and rye in every direction, with a smell of rotting cabbage over it.",
      "Whole fields of blackened crown cabbages along the West Road — someone poisoned them.",
      "Murkin's soldiers work this hex, press-ganging youths and hunting for whoever did it.",
    ],
    places: [
      { name: "Rotting Cabbages", kind: "the poisoned fields by the road; lingering draws a patrol 2-in-6" },
      { name: "The Crimson Bath", kind: "the leaning inn at Shrivelbyne — poor beds, a fine pie, and a vat of poison behind the cellar barrels" },
    ],
    folk: [
      { name: "Timilda Brumble", what: "elderly shorthorn with a silver nose, keeps the inn; respected elder and the secret head of the plot against Lord Murkin" },
    ],
    hexEncounter: [
      { chance: 1, what: "a gang of Murkin's Soldiers" },
    ],
  },
  {
    hex: "0109",
    name: "Lady Borrid and Murkin's Army",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 198,
    flavour: [
      "Old hazel and chestnut coppices; the paths running north to south are churned up with bootprints.",
      "A high-gabled brick manor with turrets stands among the blackthorn in the north.",
      "A mile into the woods in the south, a ring of tents badly hidden under bracken — forty soldiers mustering for a war.",
    ],
    places: [
      { name: "Lady Borrid's Hunting Lodge", kind: "the manor; the moose head in the entrance hall bellows at anyone who walks in uninvited" },
      { name: "Secret Chamber", kind: "a vault under the cellars — chalices and jewels, a fairy shortbow and twelve fairy arrows", hidden: true },
      { name: "Murkin's Army", kind: "the camp in the southern dell: pike drill, pickled turnips, and morale on the floor" },
    ],
    folk: [
      { name: "Lady Amonie Borrid", what: "hunter in her fifties, famed for slaying the blood wyrm that terrorised Odd; wants the High Wold's war turned back" },
      { name: "Sergeant Crewwin Snidebleat", what: "longhorn knight in burnished plate commanding the camp; loathes Murkin and is only there for the pay" },
    ],
  },
  {
    hex: "0110",
    name: "The Shadow of Lord Gnarlgruff",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 199,
    note: "Encounters are 2-in-6 likely to be with 1d3 devil goats (DMB).",
    flavour: [
      "Holly and hawthorn, dark under the canopy. What lives here moves carefully and keeps watching.",
      "A charnel stench leads to a glade of black poplars with a blackened monolith in it, draped with entrails on a mound of bones.",
      "Devil goats hold the glade and suffer nobody but longhorn breggles to enter.",
    ],
    places: [
      { name: "Devil Goats' Glade", kind: "the monolith, the bone mound and its goats; the bones are worth searching" },
      { name: "Nights of the Full Moon", kind: "the stone wakes, violet-lit, and a voice on the wind rants in an old form of Caprice" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d3 devil goats", creature: "Devil Goat", number: "1d3" },
    ],
  },
  {
    hex: "0111",
    name: "The Wishing Pit",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 200,
    note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    flavour: [
      "Scrubby grass over low fern-capped knolls, old hedges and walls still marking fields nobody works any more.",
      "Hand-painted signs and carvings off the West Road point south to \"the Wishing Pit\".",
      "The trails end at a hill with a ruin on top and a camp of pilgrims and hawkers at its foot.",
    ],
    places: [
      { name: "Wishing Pit Complex", kind: "the old parade ground, its banners and the round tower over the fire pit; wishers burn something precious to change their luck" },
      { name: "The Smugglers' Cave", kind: "the crank room and locked store under the hill — where the sacrifices actually go", hidden: true },
    ],
    folk: [
      { name: "Praephator Lenore", what: "tall, in overly dramatic grey robes and silver holy symbols; runs the wish as a grift and half hopes it works anyway" },
    ],
  },
  {
    hex: "0201",
    name: "Grave of the Aubrathon and Helath Tor",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 201,
    forage: "1d2 portions of Blushing Mandrake (p430)",
    flavour: [
      "Rust-brown bog cut through with slow water, drier hummocks rising out of it.",
      "Small cairns stand on the dry ground, animal skulls set on top of them.",
      "A seven-foot obelisk of black stone stands alone on the heath, and a rocky tor with a cave at its foot rises in the far north.",
    ],
    places: [
      { name: "The Grave of the Aubrathon", kind: "the black obelisk — touching it wounds the Lawful and the Chaotic and heals the Neutral, once a day" },
      { name: "Helath Tor", kind: "the granite hill in the north, its cave mouth reeking and ringed with skull-topped cairns" },
    ],
    folk: [
      { name: "Nanna Wortgrew", what: "eight-foot ogress in rags of velvet, forced Lawful by a saint's amulet she cannot remove; nurses crippled bog animals and hides from Atanuwe" },
    ],
  },
  {
    hex: "0202",
    name: "Oath Isle",
    terrain: "swamp",
    cost: 4,
    region: "northern-scratch",
    lost: "3-in-6",
    page: 202,
    flavour: [
      "Pools and rivulets in every direction, all of it draining into the Upper Hameth, the willows furred with moss.",
      "A heap of mossy stone a hundred yards across sits in the shallows, dark broken-limbed pines creaking on it.",
      "There is a hut on the isle, and smoke coming out of it.",
    ],
    places: [
      { name: "The Knight's Abode", kind: "the shored-up stone hut: one room, a reed bed, drying fish, and good armour on the wall" },
      { name: "The Shrine to St Sedge", kind: "sunk in the swamp in the far north, only the roof ridge showing; dug out and cleaned it grants Bless Weapon", hidden: true },
    ],
    folk: [
      { name: "Sir Tegwyn the Disloyal", what: "silver-bearded knight cursed to age on the isle and never die; welcomes visitors desperately, and feeds them marsh fish" },
    ],
  },
  {
    hex: "0203",
    name: "The Moss Garden",
    terrain: "swamp",
    cost: 4,
    region: "northern-scratch",
    lost: "3-in-6",
    page: 203,
    note: "Encounters are 2-in-6 likely to be with Brawg or Agnes.",
    flavour: [
      "Black pools and mud beds with no path through them, copses of rotting trees between.",
      "Corpses float in the water, heads crushed and bellies opened, every one of them furred with bright green moss.",
      "The moss is a crop. Two trolls farm it, and they are no longer on speaking terms.",
    ],
    places: [
      { name: "The Moss Garden", kind: "the corpse beds the trolls tend, and the border between them they argue over endlessly" },
      { name: "Troll-Hole", kind: "their shared grotto in the middle of the swamp, down a flooded passage — found by long searching, or by following a troll home", hidden: true },
    ],
    folk: [
      { name: "Brawg", what: "pot-bellied troll, lazy and lecherous, oddly gentle with small animals; wants Agnes back but will not apologise first" },
      { name: "Agnes", what: "thin, long-limbed troll, fastidious and sharp-tongued; swims the wetlands ambushing fodder for the farm" },
    ],
    hexEncounter: [
      { chance: 2, what: "Brawg or Agnes, the moss-farming trolls", creature: "Troll" },
    ],
  },
  {
    hex: "0204",
    name: "The Summerstone Uruzzur",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 204,
    alsoRegion: "Dwelmfurgh",
    note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Squelching mud, clumps of purple-leafed reeds, granite spires and boulders standing out of it.",
      "Near the centre the ground dips into a basin a hundred yards across, with a fifteen-foot shard of basalt raised on a marble column in the middle.",
      "The basin looks empty and is not — it is full of invisible water, and four skeletons lie at the bottom reaching up towards the column.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Mud Basin", kind: "the invisible pool, its skeletons, and the fairy mail and arrows still on them" },
      { name: "The Summerstone Uruzzur", kind: "the Wetstone; its runes teach Water Breathing, and touching it buys days of breathing water" },
    ],
    folk: [
      { name: "The Audrune Mestmord", what: "the stone's ward, incorporeal in the ley flow; cannot touch the world, but summons three frost fiends against swimmers" },
    ],
  },
  {
    hex: "0205",
    name: "Wooden Figures",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 205,
    alsoRegion: "Dwelmfurgh",
    note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Quiet grassland with leafless trees standing about in it, songbirds going to and fro.",
      "A thatched wooden cottage in the south-east corner, its front door hanging off the hinges.",
      "Inside: the place torn apart, six broken dolls laid carefully on a workbench, and four dead men rotting on the woodpile out the back.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "The Woodcarver's House", kind: "the cottage, its workshop of staring dolls and good tools, and the open trapdoor in the floor" },
      { name: "Under the House", kind: "a cavern below with an ancient oak in it, acorns glowing silver; wood cut from it and carved into a creature comes alive" },
    ],
    folk: [
      { name: "Ellery Lumley", what: "the woodcarver — red-haired, black-eyed, arm broken; lashed to the oak, starving and delirious" },
      { name: "Minch", what: "her six-foot wooden son, unhinged by his siblings' deaths; he is starving her to death and still bringing her water" },
    ],
  },
  {
    hex: "0206",
    name: "Maidenhead Priory",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 206,
    alsoRegion: "Dwelmfurgh",
    note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Rotting woodland, the floor a litter of fallen trunks and branches, insects over everything.",
      "A crumbling priory stands under the eaves at the northern border, a great stone bust half-buried by its entrance.",
      "From a distance the walls seem to breathe; close up it is a blanket of black beetles that shriek when anyone comes near — a hit point per Turn spent inside.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Maidenhead Priory", kind: "the ruin and its beetles; fire and smoke drive them off only while they burn" },
      { name: "Defiled Crypt", kind: "the founding prior's coffin, its lid broken in two; fit the halves back together and the beetles leave in droves" },
      { name: "The Banner of St Lillibeth", kind: "behind a cascade of moss upstairs, magically preserved — six doves, six healings a day, on holy ground", hidden: true },
    ],
  },
  {
    hex: "0207",
    name: "The Summerstone Radhd",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 207,
    alsoRegion: "Dwelmfurgh",
    note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "A dense tangle of trees where the light gives out; the air is still and heavy and sound comes muffled.",
      "The deeper in you go the darker it gets — attacks at -1 without a light, and torches reach only half as far.",
      "Hooded figures watch from the edge of sight and vanish if anyone swings at them.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "The Shadowed Bower", kind: "the Drune enchantment over the whole hex, dwindling every light in it" },
      { name: "The Summerstone Radhd", kind: "the Stone of Law, lost in a pathless hawthorn tangle; its runes teach Geas, and an oath sworn while touching it binds", hidden: true },
    ],
    folk: [
      { name: "The Audrune Grebglin", what: "the stone's ward, incorporeal; conjures three werephasms against anyone coming within sixty yards of it" },
    ],
  },
  {
    hex: "0208",
    name: "Kolstoke Keep and Illpuke Barrows",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 208,
    flavour: [
      "Rough woodland with waterlogged ditches and ant-mounds, and a low thrumming under all of it.",
      "A blocky keep of dark stone sits on a motte in a clearing, ringed by a spiked ditch and a crenellated wall.",
      "South of it, thirteen mounds in the trees — twelve in a circle and one at the centre, each capped with a twenty-foot stone. Standing among them turns the stomach.",
    ],
    places: [
      { name: "Kolstoke Keep", kind: "Lord Murkin's seat; visitors unwelcome unless they bring gifts or useful secrets, and his mother is in the dungeon for contradicting him" },
      { name: "Illpuke Barrows", kind: "the thirteen mounds — elf bones under the capstones and a forgotten device for measuring the Witching Ring; the Drune want it back" },
    ],
  },
  {
    hex: "0209",
    name: "The Lethean Well",
    terrain: "craggy-forest",
    cost: 4,
    region: "high-wold",
    lost: "3-in-6",
    page: 209,
    forage: "1d2 portions of Woodpurse (p430)",
    flavour: [
      "Trunks and boughs that twist and sway into shapes you keep half-recognising.",
      "One trail leads in, vaulted over by branches and dark as night at midday, pale mist standing in the woods either side of it.",
      "Stray off the trail and cold hands pull you into the black; you turn up hours later with your valuables gone and no memory of where you were.",
    ],
    places: [
      { name: "The Grasping Corridor", kind: "the only way to the lake; carrying an open flame in it makes the things among the trees scream" },
      { name: "The Lethean Well", kind: "a two-mile lake in the crags; an hour in the water cures a curse and leaves an enchantment behind, good or absurd" },
      { name: "The Lethean Door", kind: "a ten-foot portal of pure black in the peaks — with the Duke's invitation it opens on Diuthurnia, without it nothing", hidden: true },
    ],
    folk: [
      { name: "The boggin clan", what: "twelve of them in the lake; they will trade peace, and doses of Lethe, for gems or magic — otherwise they drag bathers down" },
    ],
  },
  {
    hex: "0210",
    name: "Nodding Castle",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 210,
    note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    flavour: [
      "Dripping copses in cold mist, and a drizzle that does not stop.",
      "A grey castle with three crumbling towers stands on a hill at the forest's edge, ringed by thorn trees woven into a palisade.",
      "Seven headless bog corpses claw at the sides of the moat and slide back into the water.",
    ],
    places: [
      { name: "Nodding Castle", kind: "Lord Nodlock's seat — cluttered, debauched, badly garrisoned; the guest suites are seldom empty and entertainers get in easily" },
    ],
    folk: [
      { name: "Tasper Crymehump", what: "a five-foot red-capped mushroom grown on the dead wine taster, doing the job with his skill and his memories; do not mention the cook" },
    ],
  },
  {
    hex: "0211",
    name: "The Tea Tent and the Dreaming Snail",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 211,
    note: "Encounters are 1-in-6 likely (2-in-6 likely at night) to be with 1d3+2 bandits (Level 1 thieves--DMB) and 1d3+2 shorthorns (DMB)-members of the gang based in hex 0311. Opposing side has a 3-in-6 chance of being surprised, due to bandits hiding in the woods.",
    flavour: [
      "Rolling meadow of knee-high grass, with rabbits watching out of all of it.",
      "Bove's Road runs along the wood's edge — open leagues to the south, the old wood brooding to the north.",
      "Halfway across stands a bright pink conical tent with a snail banner and smoke chuffing from a stovepipe. Two mugs of the tea and a traveller is a hit point better.",
    ],
    places: [
      { name: "The Tea Tent", kind: "the tent, the tea, and the man selling it — all three a projection; Dispel Magic ends the scene and wakes what is projecting it" },
      { name: "The Dreaming Snail", kind: "a giant psionic snail a century asleep in a fern thicket north of the road, its shell under a carpet of Mind-Moss", hidden: true },
    ],
    folk: [
      { name: "Smalding Borotrope", what: "the tea seller: rotund, slimy-skinned, wiry moustache, preposterous hat — the snail's dream avatar, and glad of company" },
    ],
    hexEncounter: [
      { chance: 1, period: "day", what: "1d3+2 bandits and 1d3+2 shorthorns of Red Gwen's gang (hex 0311)", surpriseParty: 3 },
      { chance: 2, period: "night", what: "1d3+2 bandits and 1d3+2 shorthorns of Red Gwen's gang (hex 0311)", surpriseParty: 3 },
    ],
  },
  {
    hex: "0301",
    name: "The Ruins of Smerne",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 212,
    note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    forage: "1d2 portions of Horridwort (p430)",
    flavour: [
      "Black water with an oily sheen on it, old peat beds cut about with ditches and collapsed banks.",
      "A village is sinking into the fen — stilt houses down to their doorsteps, stone walls half under the mire, crows shouting at anyone who comes.",
      "A stone wolf still stands at the centre of it, head up and howling, with one word cut into its pedestal.",
    ],
    places: [
      { name: "The Ruins of Smerne", kind: "the drowning village; the word on the wolf's pedestal is \"Egrydgenn\", which is what opens Dewidort's hoard (0607)" },
      { name: "Church and graveyard", kind: "the ribs of a stave church at the north end, gravestones just above the mud — touching them wakes what is under them" },
    ],
    folk: [
      { name: "The Ghosts of Smerne", what: "three dozen spirits in dented wolf's-head helms who speak as one and are starving; ten rations and they go, blessing whoever pitied them" },
    ],
  },
  {
    hex: "0302",
    name: "The Stone Woods",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 213,
    forage: "1d3 portions of Marshwick (DPB)",
    flavour: [
      "Layered sludge in black, brown and red, thick with flies and small creeping newts.",
      "Copses of grey leafless trees stand at odd angles across the bog. Close up they turn out to be stone.",
      "A ten-foot furrow of churned sludge crosses the hex, as though something had been ploughed through it.",
    ],
    places: [
      { name: "Grey, Leafless Trees", kind: "the petrified copses; a bare hand on one buys a moment's vision of the meadow this was before the Lady's cruelties" },
      { name: "Sludge Trail", kind: "the furrow, and what is at the end of it to the north-west" },
      { name: "The Shrine to St Quister", kind: "a granite shrine half-buried and dragging itself five feet a day through the mire; praying at it grants Create Water", hidden: true },
    ],
  },
  {
    hex: "0303",
    name: "Mother Efte's Lair",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 214,
    forage: "1d4 portions of Lilywhite (DPB)",
    flavour: [
      "It is drizzling here, and it always is — heavier the closer you get to the middle.",
      "Festering pools, animal skeletons, crows going round overhead waiting for something.",
      "The riverbank is trapped ground: the madtoms hunt it, and springing a snare brings two dozen of them out of the water.",
      "At the centre, a hundred-yard pool of black water with a twelve-foot newt lying in it, mouth open to the rain.",
    ],
    places: [
      { name: "Riverside Traps", kind: "mantraps along the Hameth, 3-in-6 to meet one on foot or by boat" },
      { name: "Mother Efte's Lair", kind: "the pool, thirty madtoms lolling in her pus, and their sacks of coin and gems sunk at the bottom" },
      { name: "Dais and Podium", kind: "flagstones and a marble podium of clean water that never runs out; the dais commands rain over the whole Scratch, and she knows the words" },
    ],
    folk: [
      { name: "Mother Efte", what: "a twelve-foot giant newt, once a witch's apprentice; she pays for magic to eat, and the necklace she stole is still in her belly" },
    ],
  },
  {
    hex: "0304",
    name: "The Summerstone Sigil",
    terrain: "tangled-forest",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 215,
    alsoRegion: "Dwelmfurgh",
    note: "Encounters are 1-in-6 likely to be with the Audrune Wargfole as he wanders the hex, cleaning the Pointing Statues. Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Mossy paths threading between wet shallows and thickets of blackthorn and nettle that nothing gets through.",
      "White marble statues stand about the woods — hunters, warriors, hermits, woodcutters — and every one of them points towards the middle of the hex.",
      "What they point at is a twenty-foot wicker man burning with green fire that does not consume it, and faces howling silently inside the flame.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Pointing Statues", kind: "the statues themselves: the petrified bodies of the people whose souls are in the pyre" },
      { name: "The Soul Pyre", kind: "the burning wicker man; topple it and the flame dies, the souls go free and the illusion over Sigil lifts" },
      { name: "The Giant Stump", kind: "a twenty-foot mossy stump in the north-west, roots and all — an illusion that cannot be dispelled, hiding the Summerstone Sigil", hidden: true },
    ],
    folk: [
      { name: "The Audrune Wargfole", what: "bent old man with a bone lamp and a skull mask under his cowl; he drains souls to feed the pyre, and misses good ale" },
    ],
    hexEncounter: [
      { chance: 1, what: "the Audrune Wargfole, out cleaning the Pointing Statues", creature: "Drune—Audrune" },
    ],
  },
  {
    hex: "0305",
    name: "The Boggin's Lamp",
    terrain: "bog",
    cost: 3,
    region: "dwelmfurgh",
    lost: "2-in-6",
    page: 216,
    note: "Encounters are 2-in-6 likely to be with 1d4 marsh lanterns (DMB). Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    forage: "1d2 portions of Oddy Sorrel (p430)",
    flavour: [
      "Scrub, mud and shallow pools, no wind and no sound. Lights and strands of mist drift about.",
      "An inn stands in the middle of the trackless bog with its lamps lit at every hour.",
      "Whatever time of day you walked in, its narrow windows look out on night.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "The Boggin's Lamp", kind: "the inn: common lodgings and food, every wine in the Player's Book, no stabling; no scrying reaches inside, and what you carry out of it vanishes in days" },
      { name: "The Shrine to St Dank", kind: "a wooden shrine toppled in the mud by a reeking pool; righted and cleaned it grants Charm Serpents", hidden: true },
    ],
    folk: [
      { name: "Smauvol Oddnum", what: "the landlord — chequered doublet, brass skull necklace; will not discuss a single one of the inn's peculiarities" },
      { name: "Carrington Shydewick", what: "calls herself Mercy Alquip; a thief lying low after robbing the Hall of Sleep, and shopping for the next job" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d4 marsh lanterns", creature: "Marsh Lantern", number: "1d4" },
    ],
  },
  {
    hex: "0306",
    name: "Walker's Void and the Blue Monolith",
    terrain: "tangled-forest",
    cost: 3,
    region: "dwelmfurgh",
    lost: "2-in-6",
    page: 217,
    note: "Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Thickets of bramble and bracken with old overgrown paths crossing through them.",
      "In a clearing, a perfectly round ten-foot pit of black nothing, ropes staked around its rim and something holding them taut.",
      "The ropes hold a ladder, built out of whatever wood came to hand, hanging down out of sight.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Walker's Void", kind: "the bottomless pit and its ladder; two hundred feet down it simply ends, and every ten feet carries a 1% chance the whole thing drops" },
      { name: "Treasure cache", kind: "a corked hole twenty-five feet down: coins, a Drunic owl signet ring, and the letter that ended her old life — she fights to the death for it", hidden: true },
      { name: "The Blue Vorpal Monolith", kind: "twenty feet of azure light in a dell in the east; half-solid in spring, and looking at it then can change a person's alignment daily" },
    ],
    folk: [
      { name: "Walker the Mad Ladderer", what: "white-haired hermit in her late fifties, building the ladder rung by rung towards a bottom that is not there" },
    ],
  },
  {
    hex: "0307",
    name: "Fungal Forms and the Ascension Stone",
    terrain: "hilly-forest",
    cost: 3,
    region: "dwelmfurgh",
    lost: "2-in-6",
    page: 218,
    note: "Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Overgrown paths that cross, double back and spiral into dead ends for no reason anyone can see.",
      "Lumpy, brightly coloured fungus grows in human shapes on the tussocks — hand-sized figures up to twelve-foot giants.",
      "At dusk mouths open in their heads and sigh out coloured spores, and there are words in the sighing about whatever you came here to do.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Humanoid Fungus", kind: "the figures; bland and worthless to eat, and worth standing still for after dark" },
      { name: "Ascension Stone", kind: "a black boulder on a treeless hill at the heart of the maze, carved with a woman borne up by angels and the name ABYGAIL; the Church has hunted the site for 150 years", hidden: true },
    ],
  },
  {
    hex: "0308",
    name: "The Face of the Drune",
    terrain: "hilly-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 219,
    alsoRegion: "Dwelmfurgh",
    note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    forage: "1d2 portions of Rindlewort (p430)",
    flavour: [
      "Granite cliffs in crumbling hillsides, blue-leafed pines leaning off the tops of them.",
      "A fifteen-foot face is cut into one cliff above a shady dale: a stern, bearded man, his pupils bored right through into the dark behind.",
      "Below the beard is a green copper door with Drunic writing on it.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "The Great Stone Face", kind: "the carving, and the sealed door under it — \"Render Magus\", locked by a Level 7 glyph" },
      { name: "Inside the Cave", kind: "the dead Drune's lair: an anatomy of a skull carved across the wall, a rotting bed with an arcane dagger under the mattress, a chest of black robes" },
      { name: "At night", kind: "moonlight through the eyes throws a ghost-script onto the floor — the spell Dimension Door, four hours' study to copy out" },
    ],
    folk: [
      { name: "Tinekin", what: "a three-foot spirit of green Drune fire under the bed, guarding a dead master's useless things and openly desperate for a new one" },
    ],
  },
  {
    hex: "0309",
    name: "Garnack's Tower",
    terrain: "hilly-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 220,
    flavour: [
      "Birches standing out of wet ground, driven up spear-straight through the rot of the bigger trees that fell before them.",
      "A three-storey peel tower held up mostly by its scaffolding stands on a bald hill over the High Road.",
      "The door is old oak carved with wood spirits and swine, battered in towards the hinges by a siege nobody here remembers.",
    ],
    places: [
      { name: "Ramshackle Tower", kind: "the hedge knight's hall: louse-ridden pelts, an armoury, shorthorn quarters, and his own room behind half a dozen locks" },
      { name: "Garnack's Hoard", kind: "a footlocker under the bed: coins, a scarred House Ramius medallion, mead, a runed shin bone, and a Drune map to a tower in the Brinemere (1103)", hidden: true },
      { name: "The Shrine to St Hamfast", kind: "a wooden shrine on a floating moss island — step onto it and it tips into the pond; brought ashore and pruned it grants Speak With Animals", hidden: true },
      { name: "The Twice-Wreathed Door", kind: "a black sphere wreathed in illusory flame and snow in a holly glade; touching it puts you on the fairy road The Narrow Way", hidden: true },
    ],
    folk: [
      { name: "Garnack the Horse", what: "corpulent longhorn hedge knight, one horn broken, entirely humourless; sells his hammer to any campaign and means to marry Ramius's daughter" },
    ],
  },
  {
    hex: "0310",
    name: "The Craven Mounds",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 221,
    note: "Encounters are 2-in-6 likely to be with an insect swarm (DMB)--the flesh-eating beetles that swarm this hex. Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    flavour: [
      "No sound at all, and loose soil that moves: it is full of flesh-eating beetles.",
      "Bare earthen mounds up to ten feet high, each topped with boulders, and every boulder carries a carved face at once tormented and wicked.",
      "After dark the faces drip. The spirits in them seep down into the soil looking for a body to wear.",
      "Sleeping here costs a Save Versus Doom, or you belong to a shadow until dawn or until someone drags you out of the hex.",
    ],
    places: [
      { name: "Mounds and Boulders", kind: "woods-folk chiefs the Drune soul-bound for siding with the Cold Prince; the stone came from nowhere near here" },
      { name: "The Shrine to St Elsa", kind: "the point of a tiled roof in a mound of beetle-ridden soil; dig it out — treat the beetles as an insect swarm — and praying grants Communion", hidden: true },
    ],
    hexEncounter: [
      { chance: 2, what: "an insect swarm — the flesh-eating beetles of this hex", creature: "Insect Swarm" },
    ],
  },
  {
    hex: "0311",
    name: "Bandit Hideout",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 222,
    note: "Daytime encounters are 1-in-6 likely to be with 1d3+2 bandits (Level 1 thieves--DMB) and 1d3+2 shorthorns (DMB)--members of the gang based in this hex. Opposing side has a 3-in-6 chance of being surprised, due to bandits hiding in the woods.",
    flavour: [
      "Tangled oak and elm that nobody walks through, the floor a litter of dead branches and mouse nests.",
      "The southern half is bandit ground: Red Gwen's gang works an eighteen-mile stretch of Bove's Road and comes back here with it.",
      "Net traps, 3-in-6 for anyone crossing — and a patrol along within a few Turns to collect whoever is hanging.",
    ],
    places: [
      { name: "Treehouse", kind: "the hideout across four ancient elms: platforms, hanging bridges, rope ladders and a cargo winch, twenty-two bandits in it", hidden: true },
      { name: "Treasury", kind: "a locked hut by the common platform — coins, furs, ale, wine and weed, and a pair of trousers that make the wearer look like a woodgrue" },
    ],
    folk: [
      { name: "Red Gwen", what: "half-breggle bandit leader in chainmail, tactically brilliant; sells the story that she is Murkin's exiled sister, and grew up an urchin in High-Hankle" },
    ],
    hexEncounter: [
      { chance: 1, period: "day", what: "1d3+2 bandits and 1d3+2 shorthorns of the gang based here", surpriseParty: 3 },
    ],
  },
  {
    hex: "0312",
    name: "Mother Goat's Place",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 223,
    note: "Daytime encounters are 1-in-6 likely to be with 1d3+2 bandits (Level 1 thieves--DMB) and 1d3+2 shorthorns (DMB)--members of the gang based in hex 0311. Opposing side has a 3-in-6 chance of being surprised, due to bandits hiding in the woods. Nighttime encounters are 3-in-6 likely to be with 1d4+2 wolves (DMB), who taunt PCs in growled Woldish and attack if they outnumber the party.",
    flavour: [
      "Quiet grassland with cave-riddled sandstone outcrops standing about in it.",
      "Bove's Road runs through: open plain south as far as you can see, a mile of gentle slope up to the wood in the north.",
      "At a bend near the north-west corner sprawls a ramshackle inn that smells of goat and sounds like an argument.",
    ],
    places: [
      { name: "Mother Goat's Place", kind: "the inn: common lodgings and food, exact change or you wash the dishes, and the best gossip in the High Wold" },
      { name: "The Inn at Night", kind: "wolves come scratching at the doors after sundown; they speak Woldish, they are friends of the house, and one of them is rather more" },
    ],
    folk: [
      { name: "Mother Goat", what: "shorthorn landlady with seven kids and a mop always to hand; collects unusual cheeses and has heard of one that walks about in Dwelmfurgh (0405)" },
    ],
    hexEncounter: [
      { chance: 1, period: "day", what: "1d3+2 bandits and 1d3+2 shorthorns of Red Gwen's gang (hex 0311)", surpriseParty: 3 },
      { chance: 3, period: "night", what: "1d4+2 wolves, who taunt the party in growled Woldish and attack if they outnumber it", creature: "Wolf", number: "1d4+2" },
    ],
  },
  {
    hex: "0401",
    name: "The Hanging Tree",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 224,
    note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    flavour: [
      "Wet ground under heaps of rotting plant matter, and yellowish mist that twists around a traveller as they walk.",
      "A broad, shallow lake of brackish yellow water that nothing living goes near, wisps of mist turning over it at all hours.",
      "By the western shore a great dead tree, five corpses hanging off its branches — and each one is one of you, down to the scars.",
    ],
    places: [
      { name: "Wisp Lake", kind: "the lake; while the gallowgeists are hunting, fog rolls off it and the chance of getting lost rises to 4-in-6" },
      { name: "The Hanging Tree", kind: "the five hanged bodies, each carved with the worst thing the person it copies has done in Dolmenwood" },
    ],
    folk: [
      { name: "Gallowgeists", what: "the hanged of Smerne, undead; they take your face, untie themselves once you are out of sight, and do not stop until you are dead" },
    ],
  },
  {
    hex: "0402",
    name: "The Lady of Spring Unending",
    terrain: "tangled-forest",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 225,
    flavour: [
      "Calm glades of anemones, celandine and bluebells, mild as spring whatever the season, and far too quiet.",
      "Walking in them costs a Save Versus Doom; those who fail wander on in a daze at -2 to attacks and saves until somebody leads them out.",
      "What they wander towards is a palace of white marble spires and crystal cupolas beside a misted pool.",
    ],
    places: [
      { name: "The Ever-Blossoming Death Glades", kind: "the enchanted glades, and what lingering in them does" },
      { name: "The Lady's Palace", kind: "the door is unlocked, the halls are lifeless, and there is no walking back out the way you came" },
      { name: "Vaults", kind: "grey pillared cellars of lifelike statues that used to be people, and a Petrified Fairy Heart on a pedestal in the coldest chamber" },
    ],
    folk: [
      { name: "The Lady of Spring Unending", what: "exiled elf noble, hateful, unable to leave this hex; she will talk to anyone who names her half-sister, and pays a wish for her death" },
    ],
  },
  {
    hex: "0403",
    name: "Queen Arda's Demesne",
    terrain: "tangled-forest",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 226,
    alsoRegion: "Dwelmfurgh",
    note: "Encounters are 1-in-6 likely to be with 1d4 x 10 purple sprites from the Sprite Mound. Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Countless little brooks running down to join the Hameth, and a heavy sweetness on the breeze.",
      "Ten-foot flowers grow along the banks — lilies, peonies, hibiscuses — and their scent puts anyone who lingers into a sleep of several Turns.",
      "In a glade at the centre, five human bodies hang dripping into thimble-sized bowls, with butchers' tables the size of playing cards beside them.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Gigantic Flowers", kind: "the blooms; a petal boiled within a day of picking makes a sleep draught of the same kind" },
      { name: "Shambles", kind: "the open-air abattoir: meat for the sprites' kitchens, bones for the workshops, skulls planted with seeds to feed new flowers" },
      { name: "Sprite Mound", kind: "a ten-foot clay hillock with doorways hidden in the grass; two hundred purple sprites inside, and Arda's treasure behind a tiny locked door", hidden: true },
    ],
    folk: [
      { name: "Queen Arda", what: "purple sprite tyrant with orange insect eyes, certain her dreams foretell her ruling Dolmenwood; tells her subjects the big folk are marauding giants" },
    ],
    hexEncounter: [
      { chance: 1, what: "1d4 x 10 purple sprites out of the Sprite Mound", creature: "Sprite", number: "1d4*10" },
    ],
  },
  {
    hex: "0404",
    name: "The Remembering Mist",
    terrain: "tangled-forest",
    cost: 3,
    region: "dwelmfurgh",
    lost: "2-in-6",
    page: 227,
    note: "Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "The ground falls away eastward in muddy cliffs ten to twenty feet high, hung with ferns and trickling water.",
      "Pockets of pale mist stand about the hex. Going around them adds a Travel Point to everything done here.",
      "Walk into one and it takes a memory: an Intelligence Check to keep it, and it stays gone until you sleep in an inn or a settlement.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "The Remembering Mist", kind: "the pockets; the mist replays what it has taken, so other people's hounds, weddings and battles turn up in it" },
      { name: "The Shrine to St Willofrith", kind: "four carved pillars and a fallen slate roof sinking in a boggy dell; righted, praying there grants Reveal Alignment", hidden: true },
    ],
  },
  {
    hex: "0405",
    name: "Lair of the Cheese-Fiend",
    terrain: "craggy-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 228,
    note: "Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Close, gloomy woods of birch, yew and elm over a carpet of moss, standing puddles everywhere.",
      "In one part of it the skins of large creatures — breggle and human among them — hang sealed and bloated in the trees.",
      "They are full of blood-cheese, and the stink of it leads to a fifteen-foot hut cobbled out of stone, thatch and branch.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Blood-Cheese Sacs", kind: "the hanging skins; investigating them is 2-in-6 to bring their keeper along to check on them" },
      { name: "Giant Hut", kind: "one unlit room — corpses and drying skins from the rafters, a tank of guts, a worktable and cleavers, and a forgotten pouch of kunzites in a corner" },
    ],
    folk: [
      { name: "The Cheese-Fiend", what: "a ten-foot woman made entirely of cheese, mould and all; she hunts to gorge, and would treasure real cheese or milk above anything" },
    ],
  },
  {
    hex: "0406",
    name: "Fungal Bloom Cave",
    terrain: "tangled-forest",
    cost: 3,
    region: "dwelmfurgh",
    lost: "2-in-6",
    page: 229,
    note: "Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Wet air, mud underfoot, and most of the trees rotting where they stand.",
      "A five-foot patch of white mycelium blocks a cave mouth in a hillside and puffs yellow spores at whoever approaches.",
      "Breathe them in and something speaks inside your head: \"We are Bloom.\"",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Inside the Cave", kind: "a fungal growth the size of a small oak at the bottom, and the pale young woman it is slowly taking in" },
      { name: "The Shrine to St Abthius", kind: "a twenty-foot mound of chill purple ooze in an isolated glade with the wooden shrine perfectly preserved inside; six people can dig it out in four hours", hidden: true },
    ],
    folk: [
      { name: "Bloom", what: "the fungal mind in the cave — contemplative, benign, and in love; feed it organic matter and it lets you harvest rare fungi" },
      { name: "Polldra Duskwith", what: "Drune Braithmaid of twenty-one with mushrooms growing in her hair; being assimilated on purpose, and furious with anyone who cuts her out" },
    ],
  },
  {
    hex: "0407",
    name: "Droun Loch",
    terrain: "craggy-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 230,
    note: "Encounters by the lakeside are 2-in-6 likely (3-in-6 likely at night) to be with Red Henry or The Girl With Blue Lips. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "A confusing maze of boulders and crumbling cliff; pale owls watch out of quiet dark pines.",
      "A lake nearly three miles across, ringed by hills that end in sheer drops. Sound goes muted here, as if the water were drinking it out of the air.",
      "Faces seethe just under the surface — the souls of people who jumped, called here by dreams promising power after death.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Droun Loch", kind: "the lake and its drowned souls; owl sigils scratched into the trees mark it as Drune ground, and the shore is 1-in-6 for a scream and a splash" },
      { name: "At Dawn and Dusk", kind: "Drune cottagers out in a rowing boat, skimming souls off the surface in glowing nets for the Lodge at 0507" },
    ],
    folk: [
      { name: "The Girl With Blue Lips", what: "a drowned child still looking for her father's soul and terrified of \"Red Eyes\"; her family necklace is hidden at the foot of his cliff" },
      { name: "Red Henry", what: "a sadistic mercenary the lake's dreams called in; wants blood, and wants the girl down in the water with the rest of them" },
    ],
    hexEncounter: [
      { chance: 2, period: "day", what: "Red Henry or The Girl With Blue Lips", where: "by the lakeside" },
      { chance: 3, period: "night", what: "Red Henry or The Girl With Blue Lips", where: "by the lakeside" },
    ],
  },
  {
    hex: "0408",
    name: "Guardian Gargoyles",
    terrain: "hilly-forest",
    cost: 3,
    region: "dwelmfurgh",
    lost: "2-in-6",
    page: 231,
    note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Paths winding through flower-filled dells between steep, bracken-covered hillocks.",
      "In a dark glen, the green-streaked ruin of a chapel sunk three feet into the mud, its door blocked and its lancet windows smashed in.",
      "Two old gargoyles come down off the steeple to challenge anyone who arrives.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "The Sinking Chapel", kind: "two feet of water and boot-sucking muck inside; the altar has a keyhole in its side and a stair behind it once unlocked" },
      { name: "Flooded Crypt", kind: "four feet of slime under dark water; a Turn or three of searching turns up a reliquary bust of St Sedge with his lost Helm inside" },
    ],
    folk: [
      { name: "Nicodemus", what: "lion-bodied, dragon-headed, dutiful and full of scripture; his tongue detaches, and it is the key to the crypt" },
      { name: "Lucianus", what: "shaped like a spiky-haired dog, slovenly and crotchety; mutters about Nicodemus's holy guardian act and wants out of the binding" },
    ],
  },
  {
    hex: "0409",
    name: "The Hamlet of Galblight",
    terrain: "hilly-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 232,
    note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead. At night there is a 2-in-6 chance of meeting a hunting party of 2d4 sleepwalking shorthorns (DMB) in the woods or in the hamlet itself, roused by the Bicorne's whisper (hex 0510) and looking for people to carry to its lair.",
    forage: "1d2 portions of Parson's Gobble (p430)",
    flavour: [
      "Onion and garlic on the air, and whorled ash trees swaying over a rough floor of ferns.",
      "The old stone High Road crosses the south-eastern corner, with a toll-house straddling it: a shilling a traveller, a gold piece a wagon, and the gate shut at night.",
      "After dark, sleepwalking shorthorns hunt these woods for people to carry off.",
    ],
    places: [
      { name: "The Hamlet of Galblight", kind: "toll-house, a few farmhands' cottages and forty shorthorns, ruled for Lord Ramius by Captain Lockehorn" },
      { name: "The Mannish Miser", kind: "the inn, a converted gaol — common lodgings in the old cells with barred windows, pickled badgers' tongues, and genuinely terrible wine" },
      { name: "Barracks", kind: "a squat shale-roofed building hidden in a fir copse behind the hamlet, the captain and ten soldiers in spartan quarters" },
    ],
    folk: [
      { name: "Captain Cabruc Lockehorn", what: "towering one-eyed longhorn in pompous dress uniform, loyal to Ramius and privately sure his plan for the Bicorne will get people killed" },
      { name: "Harryp", what: "the spirited young shorthorn who runs the Mannish Miser, and is said to drink anyone under the table" },
    ],
    hexEncounter: [
      { chance: 2, period: "night", what: "a hunting party of 2d4 sleepwalking shorthorns, out to carry someone to the Bicorne's pit (hex 0510)", creature: "Breggle—Shorthorn", number: "2d4" },
    ],
  },
  {
    hex: "0410",
    name: "Castle Everdusk",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 233,
    flavour: [
      "Carefully managed woods with wild boar grunting in them and benches set at the edges of the prettier glades.",
      "An avenue of copper beeches leads off Capring Road to a palisaded garrison, and above it a stone keep on a steep bare hill.",
      "Inside, the keep is cold the way ice is cold, whatever they hang on the walls.",
    ],
    places: [
      { name: "The garrison", kind: "barracks and stables at the foot of the hill, pike drill in the courtyard under Lord Ramius's two sons" },
      { name: "Inside the Keep", kind: "oddly proportioned rooms under heavy tapestries; only the studies, where Ramius sits before the fire, feel lived in" },
      { name: "Ancestral crypts", kind: "twisting tomb levels under the hill, the marble monument to Hraigl among them, and a gated stair down to ice caverns frozen since the Cold Prince" },
    ],
    folk: [
      { name: "Lady Berryld Ramius", what: "heir of the house, six and a half feet, pink-eyed and haughty; trained in diplomacy, privately obsessed with the occult and with robbing her uncle Malbleat of his books" },
    ],
  },
  {
    hex: "0411",
    name: "Mannog's Flock",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 234,
    note: "Encounters are 1-in-6 likely (2-in-6 likely at night) to be with 1d3+2 bandits (Level 1 thieves--DMB) and 1d3+2 shorthorns (DMB)-members of the gang based in hex 0311.",
    flavour: [
      "Undulating plains of coarse, knee-deep grass with heather-clad knolls standing in them.",
      "A quarter mile north of Bove's Road sits an old stone farmstead at the forest's edge — two barns, outbuildings, a cottage, and a flock along the eaves.",
      "The sheep have icy, almost human blue eyes, and their grazing is ringed with concealed net traps: 2-in-6 for anyone walking up to them.",
    ],
    places: [
      { name: "Farmstead", kind: "Mannog's place; three garments for sale at a time, and three dolmen pinchers under the bed guarding the closets" },
      { name: "The Flock and Its Wool", kind: "sheep fed on weird woodland fungi; the wool makes garments that change how the wearer looks, and he sells neither wool nor sheep" },
    ],
    folk: [
      { name: "Old Mannog Murderman", what: "hairy, barrel-chested, rude and shrewd, sheep-horn pipe in his teeth; wants strong cider, a bigger flock, and to marry Mother Goat (0312)" },
    ],
    hexEncounter: [
      { chance: 1, period: "day", what: "1d3+2 bandits and 1d3+2 shorthorns of Red Gwen's gang (hex 0311)" },
      { chance: 2, period: "night", what: "1d3+2 bandits and 1d3+2 shorthorns of Red Gwen's gang (hex 0311)" },
    ],
  },
  {
    hex: "0412",
    name: "The Tower of Birds",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 235,
    flavour: [
      "Wild grassland with isolated farmsteads and the odd ruined fortification standing in it.",
      "A tower of dark stone under climbing roses rises out of the arable fields, crows and ravens wheeling round its summit.",
      "An ivy-grown brick wall rings four acres of herb gardens and a swan pond, with four shorthorns on the portcullis.",
    ],
    places: [
      { name: "Inside the Tower", kind: "four storeys of the Order of Warffles: heraldic tapestries, antique furnishings, and a house kept hushed because its commander is in mourning" },
      { name: "The inner garden", kind: "through a low old door, a garden wider than the tower itself, dew-wet and gold-lit, with a marble frore gryphus at its centre that draws the birds in" },
    ],
    folk: [
      { name: "Fannigrew Lockelope", what: "Commander Warffle, sole survivor of the attempt on the Bicorne; knows its lair, its hoard and its breath, and wants her sister's remains and the Order's locket back" },
    ],
  },
  {
    hex: "0501",
    name: "The Bog Hermit",
    terrain: "bog",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 236,
    flavour: [
      "Cloying mist rising off stagnant pools, and the stubs of ancient walls standing about in it.",
      "The Downs Road comes off the last hill out of 0601 and simply stops here — the fens swallow it.",
      "In a copse of wind-twisted trees, a five-foot monolith of black stone; step in among them and the wind dies.",
    ],
    places: [
      { name: "The Sickening Stone", kind: "the monolith in the still copse: a Save Versus Doom to enter, and runes under the lichen that teach the spell Fear" },
      { name: "The Witch's Hut", kind: "one smoking hut among a drowned ruin in the south, nets and dried fish inside and a violet fire in the hearth" },
    ],
    folk: [
      { name: "Helligora Ambe", what: "a witch living as a hermit, frail at forty-five and terrified of the Flayed Queen; she welcomes anyone who will tell her what they saw in the Table Downs" },
      { name: "Whipple", what: "her lamb familiar, black-woolled, weeping blood; once a day it can bleat a name that empties the clearing" },
    ],
  },
  {
    hex: "0502",
    name: "Yrthstone and the People of Zarlac",
    terrain: "tangled-forest",
    cost: 3,
    region: "northern-scratch",
    lost: "2-in-6",
    page: 237,
    note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    flavour: [
      "Black-barked firs that feel like they are watching, and not kindly.",
      "A cluster of mud huts in a glade near the centre: thirteen adults with shaven heads and white cassocks, a Z branded on every forehead, and twelve green-skinned children.",
      "They want to be left alone, and will not talk about themselves or about anything outside these woods.",
    ],
    places: [
      { name: "The People of Zarlac", kind: "the huts and their vegetable patches; press them on the rune and they will start praising their master" },
      { name: "The Nodal Yrthstone", kind: "a thirteen-foot slab of white granite in a fir grove — its runes teach Cannibalise, and touching it starts a curse that takes a pound of flesh a day" },
    ],
    folk: [
      { name: "The Audrune Zarlac", what: "rotund, long-nosed, cordial to a fault; invites visitors to suckle at his breast, and the milk buys weeks of charmed loyalty" },
      { name: "Children of Yrthstone", what: "grown from the flesh the curse takes away — green-skinned, bark under the skin, amoral and fond of the woods" },
    ],
  },
  {
    hex: "0503",
    name: "Eoel \"the Horn\"",
    terrain: "thorny-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 238,
    alsoRegion: "Northern Scr",
    note: "Encounters are 4-in-6 likely to be with the Audrune Morgodh and 1d6 bramblings (DMB). Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    forage: "1d2 portions of Rindlewort (p430)",
    flavour: [
      "Cold mist standing in the hollows, and thorn trees whose bark carries something like leering faces.",
      "The whole hex is under the stone's weight: -2 to attacks and saves for everyone in it, and spells fail 3-in-6.",
      "Its guardian knows the moment anyone crosses in, and comes to find them.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "The Summerstone Eoel", kind: "the Horn, the northernmost warding stone, overgrown in the thorniest part of the wood; its runes teach Dispel Magic", hidden: true },
      { name: "Morgodh's Cottage", kind: "a hovel woven out of thorn bushes, barely separable from the briar; a cellar behind the roots holds platinum and six portions of Dust of Extinguished Ghosts", hidden: true },
    ],
    folk: [
      { name: "The Audrune Morgodh", what: "hulking, cloaked in black and wreathed in sick purple mist; the Drune call him the Destroyer, and he welcomes trespassers for the pleasure of it" },
    ],
    hexEncounter: [
      { chance: 4, what: "the Audrune Morgodh and 1d6 bramblings", creature: "Drune—Audrune" },
    ],
  },
  {
    hex: "0504",
    name: "The Falls of Naon and the Embassy",
    terrain: "craggy-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 239,
    note: "Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "You can hear the falls anywhere in this hex, and feel the spray a mile off.",
      "The Hameth narrows, picks up speed and goes over a two-hundred-foot cliff onto the rocks.",
      "A stair is cut down the western cliff face — slick the whole way, and a careless step wants a Dexterity Check.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Secret door", kind: "half way down the steps, a platform and an open door under fairy glamour; only those who see magic or the invisible find it", hidden: true },
      { name: "The Embassy in the Hidden Caverns", kind: "ice tunnels behind the torrent, and the Cold Prince's embassy still keeping its forms nine centuries after anyone last called" },
      { name: "The Base of the Falls", kind: "Drune cottagers watching from cover, there to make sure no frost elf ever leaves" },
    ],
    folk: [
      { name: "The Ambassador", what: "presides over a household of aides, chefs, butlers and maids; bored to desperation, and afraid of what happens when the fairy food runs out" },
    ],
  },
  {
    hex: "0505",
    name: "Hoarblight Keep and the Isle of Yeth",
    terrain: "craggy-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 240,
    forage: "1d2 portions of Goatsweed (p430)",
    note: "Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "High ground above the lake under misty pine woods; the air does not move and it is cold.",
      "A castle sits on a stone outcrop over Longmere, clad in frost and looking new-built, though it is centuries old.",
      "Out in the water, a cliff-sided isle runs nearly three miles, its chalk faces streaked with guano and riddled with caves.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Hoarblight Keep", kind: "the Cold Prince's old seat: ivy-grown walls with gates and secret doors warded by fairy magic, and grounds of mazes, follies and grottoes that are not empty" },
      { name: "The Isle of Yeth", kind: "untamed forest with no path or glade on top, hundreds of hairbats in the cliff caves below" },
      { name: "The Ruined Tower", kind: "an empty shell at the isle's northern tip; on windswept nights a green glow hangs over it and witches gather in the air above" },
    ],
  },
  {
    hex: "0506",
    name: "The Stone of Repentance",
    terrain: "craggy-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 241,
    note: "Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Lonely pine woods with granite outcrops through them, and a moaning wind that never lets up.",
      "The moaning comes from a ten-foot granite sphere on the strand between the lake and the trees, and it gets close to unbearable as you approach.",
      "The sphere is carved like a Summerstone. It is not one — it is bait.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "The Moaning Sphere", kind: "the false Summerstone; destroy it and an illusory procession of frost elf knights marches out of the lake — and the sphere is back the next day" },
      { name: "The Summerstone Drodh", kind: "the Stone of Repentance inside a ring of trilithons atop a forty-foot crag; its runes teach Hex Weaving, and seeing it costs a save or you forget you were ever there", hidden: true },
    ],
    folk: [
      { name: "The Audrune Rigmirth", what: "his skin and organs are stretched over the megaliths around Drodh; step into the circle and he pulls the stones out of the ground and stands up fifteen feet tall" },
    ],
  },
  {
    hex: "0507",
    name: "Drune Lodge",
    terrain: "craggy-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 242,
    note: "Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Calcified rock formations like skulls, and dripping mossy cliffs stepping down eastward.",
      "The hex itself resists being crossed: a failed save and the party comes out the far side without ever having been here.",
      "Along the north bank of Skull Creek stand black pines fifteen feet through the trunk. Each has a door in it that only a Drune can see.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "The Veiled Wood", kind: "the warding; the Referee rolls the save in secret, and a party that fails simply travels on into the next hex" },
      { name: "Within Drune Lodge", kind: "green flame in hanging stag and owl skulls, the Aegis hall with its iron and silver bells, a library holding every arcane spell, and vaults worth 50,000gp" },
      { name: "The thaumaturgic engine", kind: "a twenty-foot sphere of blackness in a domed chamber, howling as it turns; it is fed on the souls dredged out of Droun Loch (0407)" },
    ],
    folk: [
      { name: "The Elder Phanatarch", what: "keeps the pillared halls below the ossuary, furnished in bone, owl-feather and wolf-fur; scries, reads, and consults nine sacrificed Braithmaids" },
    ],
  },
  {
    hex: "0508",
    name: "The Skeletal Gardener",
    terrain: "craggy-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 243,
    note: "Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Tiers of rough cliff dropping steeply eastward, moss and mould in every lightless crack.",
      "Skull Creek comes through in pools and falls, and the wet rock beside them is covered in scarlet fungus shaped like human organs — brains, hearts, eyes, tongues, fingers.",
      "Somebody tends them. She is a skeleton, and she is happy to talk.",
    ],
    places: [
      { name: "Fungal Organs", kind: "the Numblings garden along the creek; she will not have anyone tampering with it, least of all eating it" },
      { name: "The Ruined Manse", kind: "a roofless heap of stone in a hawthorn ravine, one intact black door leading nowhere — behind a Level 9 glyph is an extra-dimensional laboratory", hidden: true },
    ],
    folk: [
      { name: "Colly", what: "a sentient skeleton in pristine white, runes on her forehead; she has no memory of who made her, only of a grand manor somewhere south" },
    ],
  },
  {
    hex: "0509",
    name: "The Pelloryons",
    terrain: "hilly-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 244,
    alsoRegion: "Dwelmfurgh",
    note: "Ley line crossing Chell/Ywyr: Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. (See p20.) The energies of the Ywyr are siphoned into Chell at this nexus, so visitors feel no additional effects from its presence. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Balmy clearings of towering sunflowers and poppies. It is summer here whatever the calendar says.",
      "Bees drone through it, loudly and often, in a way that gets into your head.",
      "The woods themselves turn walkers around: most people go three miles in and come back out of the edge they entered by.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "The Warding Maze", kind: "for anyone actually looking for the stones the wood closes in — a twilit labyrinth of gibbering spirits and human-faced trees, a Save Versus Spell, and three invisible stalkers if anyone fails" },
      { name: "The Pelloryons", kind: "the three sisters: eighteen-foot limestone pillars carved with the King, the Friar and the Drune of the Triple Compact; their runes teach Invisible Stalker" },
    ],
    folk: [
      { name: "The Audrune Cadraigaunt", what: "hunchbacked, five centuries at his post, an eye-like flame under the cowl and bees around him; the cruellest of the Drune and glad of the work" },
    ],
  },
  {
    hex: "0510",
    name: "The Lair of the Bicorne",
    terrain: "hilly-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 245,
    note: "At night there is a 2-in-6 chance of meeting a hunting party of 2d4 sleepwalking shorthorns (DMB) in these woods, summoned from Galblight (hex 0409) by the Bicorne's whisper and looking for sacrifices to throw into its pit.",
    flavour: [
      "Broken ground choked with bramble and smashed trunks, ruined buildings collapsed into the ditches.",
      "Near the north-west corner a redwood lies where something pulled it out of the earth, and under it is a pit that reeks of blood.",
      "The pit is seventy feet, sheer-sided, and every climber has a 1-in-6 chance of waking what sleeps at the bottom.",
    ],
    places: [
      { name: "The Pit", kind: "sheer, deep, and carpeted at the bottom with Speckled Sporange and Purple Nightcap — 2d20 good specimens of each" },
      { name: "The Bicorne's lair", kind: "a fifty-foot chamber off the pit, filled with old bones; the beast lies in it half-dormant, belching contagion and nightmares" },
      { name: "Treasure hoard", kind: "buried in the bones: coins, three mouldy spell books half-readable, a dented Holy Shield that grants speech with whales, and a locket belonging to Commander Lockelope's dead sister (0412)" },
    ],
    hexEncounter: [
      { chance: 2, period: "night", what: "a hunting party of 2d4 sleepwalking shorthorns from Galblight (hex 0409), looking for sacrifices for the pit", creature: "Breggle—Shorthorn", number: "2d4" },
    ],
  },
  {
    hex: "0511",
    name: "The Inn of the Tankards",
    terrain: "hills",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 246,
    flavour: [
      "Steep-sided, flat-topped hills, a good many of them flying the banners of House Ramius.",
      "At the junction near the centre stands an inn, its ground floor lost behind old trees.",
      "Inside it is conspicuously clean — every wall freshly painted, every surface polished — and every Reaction Roll here takes a -1.",
    ],
    places: [
      { name: "The Inn of the Tankards", kind: "common lodgings and food, elder tea in fine porcelain; the place changes hands often, and the last owner drowned in a well" },
      { name: "The secret chamber", kind: "behind a wine rack in the cellar: years of drawings of the inn by different hands, many with a face in them", hidden: true },
      { name: "The Inn's Secret Nature", kind: "built from a cursed glade's timber and awake ever since; it feeds on strife and works through its owners until they die" },
    ],
    folk: [
      { name: "Crump Elbowgen", what: "shorthorn landlord in a pressed waistcoat, nervous and eager to please; he can tell his wife is not entirely present and wants to sell up" },
      { name: "Nelga Elbowgen", what: "his wife, quiet and forceful, talks of nothing but the inn as though it were a person; sleepwalks to the cellar to draw it by candlelight" },
    ],
  },
  {
    hex: "0512",
    name: "High-Hankle and the Wayward Griffons",
    terrain: "farmland",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 247,
    note: "Encounters are 2-in-6 likely to be with 1d4 knights (Level 1 knights--DMB) and 1d4 griffon trainers with caged wagons, huge nets and braces of hares, out to recapture the griffons on Monk's Hill.",
    flavour: [
      "Old tilled country: hedgerow birds, hooves on the road, cattle complaining.",
      "High-Hankle sprawls in the south of the hex behind a sandstone wall, Castle Perigonne standing up out of the middle of it.",
      "In the north, griffons wheel over a wooded hill and glide out across the farms, looking down at the herds.",
    ],
    places: [
      { name: "The Town of High-Hankle", kind: "capital of the High Wold and famous for its appetites; full description on p150" },
      { name: "Monk's Hill and the Ruined Tower", kind: "three escaped griffons nesting in the upper floors — Sir Waverly pays 1,500gp a head for one returned alive" },
      { name: "The Accursed Grotto", kind: "twenty feet below the tower: a purple-glowing pool with a silver St Howarth at the bottom, ox-faced stalactites dripping something like blood, and a curse in both of them" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d4 knights and 1d4 griffon trainers with caged wagons, nets and braces of hares, out to recapture the griffons on Monk's Hill", creature: "Knight" },
    ],
  },
  {
    hex: "0601",
    name: "The Lonely Grave",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 248,
    flavour: [
      "Old earthworks over the whole hex: mounds, ridges, rings.",
      "Along the ridge the wind takes on a voice, like someone far off shouting a warning. Stop to listen and it is saying a name — whoever in the party has the highest Wisdom.",
      "In a quiet copse at the foot of a hill stands one weathered headstone, centuries old, carrying that same name.",
    ],
    places: [
      { name: "The Lonely Grave", kind: "the headstone, epitaph \"Lord of the Wild\"; three feet down, a coffin with a skeleton built exactly like the person named, its skull smashed in" },
      { name: "Grave Treasures", kind: "on its breast a silver knife that is really a Holy Longsword and a fairy ring against cold — take either and the named sleeper is cursed" },
    ],
  },
  {
    hex: "0602",
    name: "The Hall of the Fomorian",
    terrain: "tangled-forest",
    cost: 3,
    region: "nagwood",
    lost: "2-in-6",
    page: 249,
    note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    forage: "1d2 Shub Eggs (p430)",
    flavour: [
      "Looming firs with a strange pink light around them, and jagged mutant cones over the ground.",
      "At the bottom of a steep dingle, a thirty-foot wall of mirror-smooth marble: the side of a stone platform five hundred feet square, with a stair up each face.",
      "On top of it, alone on a cracked empty expanse, a purple-veined stone dome with a pyramid of scarlet glass at its peak.",
    ],
    places: [
      { name: "Domed Hall", kind: "eighty feet across in filtered red light, a heap of broken statuary under mouldering rugs, and the Scrying Globe on top of it" },
      { name: "The Emerald Door", kind: "seen inside the globe amid blue mist; touching the globe puts a traveller onto the fairy road Buttercup Lane" },
    ],
    folk: [
      { name: "The Fomorian", what: "a fifteen-foot blue giant, beard of writhing worms, a black smudge where the eyes should be; he is waiting for \"Jack-the-Emerald-Cloaked\", and a green cloak and the claim will satisfy him" },
    ],
  },
  {
    hex: "0603",
    name: "The Ruined Cottage",
    terrain: "thorny-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 250,
    alsoRegion: "Northern Scr",
    note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Thickets of brittle, barbed bushes, and a wind that whistles almost like speech.",
      "By a slow stream in a clearing of rotting firs, the charred remains of a cottage: burnt timbers scattered inside the foundation stones, tall grass through the floor.",
      "After dark muffled voices argue near the ruin — ghosts trading secrets, and they keep it up until morning.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Charred Cottage", kind: "the burnt shell and its broken doorstep, where the phantoms gather from dusk" },
    ],
    folk: [
      { name: "Muttering Phantoms", what: "figures of mist and dead leaves, made where someone died holding a dangerous secret; deference buys a trade, a false secret buys an attack in your sleep days later" },
    ],
  },
  {
    hex: "0604",
    name: "Fort Vulgar and the Galoshers' Pool",
    terrain: "thorny-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 251,
    note: "Encounters are 2-in-6 likely to be with 1d3 galoshers in the vicinity of a pond. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Tangled holly and hawthorn, muddy mires, ponds ringed with thorny reeds.",
      "An old stone keep looks down on a village and a ramshackle dock where barge-folk and merchants trade. Hardly anyone lives here permanently.",
      "The place lives in the shadow of Big Chook, whose wails carry off the water.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Fort Vulgar", kind: "keep, village, dock and the Chappily bridge over Quogg's Creek; full settlement description on p146" },
      { name: "The Galoshers' Pool", kind: "a hundred-yard pool of black water rimmed with green scum in the briar to the west; six galoshers in the mud, and what they have kept down there" },
    ],
    folk: [
      { name: "Gherigew Thorncripe", what: "a bard held months under the pool's mud in suspended animation and still alive; wants rescuing, and wants to explain his absence to his lover in Prigwort in song" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d3 galoshers", creature: "Galosher", number: "1d3", where: "in the vicinity of a pond" },
    ],
  },
  {
    hex: "0607",
    name: "Wight Falls and Smerne's Lost Hoard",
    terrain: "craggy-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 254,
    flavour: [
      "Granite bluffs and boulders, a great many of them cut with the owl signs of the Drune.",
      "Skull Creek ends here, falling a hundred feet off a sheer cliff into Lake Longmere; there is a cave behind the water and a bad path down the rock.",
      "The Drune keep away from the falls themselves, which is why what stands in that cave has stood there for centuries.",
    ],
    places: [
      { name: "Wight Falls" },
      { name: "Smerne's Lost Hoard", hidden: true },
      { name: "The Shrine to St Galaunt", hidden: true },
    ],
    folk: [{ name: "Dewidort of Smerne", what: "ghost of a hanged highwayman" }],
  },
  {
    hex: "0608",
    name: "The Snake Witch",
    terrain: "craggy-forest",
    cost: 4,
    region: "dwelmfurgh",
    lost: "3-in-6",
    page: 255,
    note: "Encounters are 2-in-6 likely to be with 1d8 adders (DMB) or 1d3 giant pythons (DMB). Ley line proximity Chell/Ywyr: Arcane spell-casters perceive the distant moaning of the dead and the curious dual sensation of balmy heat and biting cold.",
    forage: "1d4 portions of Spirithame (DPB)",
    flavour: [
      "Gnarled trees clinging to cliffs and jagged slate promontories.",
      "Ravens roost here in great numbers.",
      "Half of what you meet is snakes — adders, or something much larger.",
    ],
    places: [
      { name: "The Snake Witch", kind: "who the hex is named for" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d8 adders, or 1d3 giant pythons" },
    ],
  },
  {
    hex: "0609",
    name: "The Trothstone and the Owl Cave",
    terrain: "hilly-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 256,
    forage: "1d6 portions of Wolfsbane (DPB)",
    flavour: [
      "Steep bracken-covered mounds with boggy pools and slow rivulets at their feet.",
      "An old path runs north-west into the forest off the western road out of Lankshorn.",
    ],
    places: [
      { name: "The Trothstone", kind: "what the old path leads to" },
      { name: "The Owl Cave", kind: "the other half of the hex's name" },
    ],
  },
  {
    hex: "0610",
    name: "Lankston Pool",
    terrain: "hills",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 257,
    flavour: [
      "Rolling hills, mostly sheep, with shepherds' bothies dotted about.",
      "Under the eaves of the wood, marshland around a large murky pool, with a mossed-over sign falling apart beside it.",
    ],
    places: [
      { name: "Marshland and Murky Pool", kind: "the pool the hex is named for" },
      { name: "The Hand of St Howarth", kind: "a mummified left hand that throbs, palm scarred with a Chapes holy symbol that bleeds as if freshly cut", hidden: true },
    ],
  },
  {
    hex: "0611",
    name: "The Magpie Gang",
    terrain: "farmland",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 258,
    flavour: [
      "Deeply rutted lanes under hedgerows ten feet high.",
      "In the north, where the farmland turns to low hills, an ancient gnarled oak sits in a thicket of silver-leafed ivy.",
      "Silver hangs off its branches — bracelets, necklaces, talismans.",
    ],
    places: [
      { name: "Magpie's Oak", kind: "the hung oak in the ivy thicket" },
    ],
    folk: [
      { name: "King Magpie", what: "hunched old man in a beak-hooded cloak of black and white feathers; nails, forks and a whistle tangled in his beard, and a mouthful of silver teeth" },
    ],
  },
  {
    hex: "0612",
    name: "The Staring Stones",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 259,
    forage: "1d3 portions of Moonhaw (DPB). The berries only work if picked at night, by moonlight.",
    flavour: [
      "Rough tussocky grass and enormous thistle patches. Rabbits everywhere.",
      "Moonhaw grows here, but the berries are only magical if you pick them at night under the moon.",
    ],
    places: [
      { name: "The Staring Stones", kind: "the stones the hex is named for" },
    ],
  },
  {
    hex: "0701",
    name: "The Ruined Watchtower",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 260,
    flavour: [
      "Coarse clawed grass that pulls at clothes, and carrion birds calling as if warning people off.",
      "A stone tower on a high hill: empty windows on two floors, none at all on the top, and the door standing open.",
      "Shadows cross those windows while you climb. After dark blue fire runs over the stone and streams up into the sky.",
    ],
    places: [
      { name: "Inside the Tower", kind: "a tapestry of a wolf-skull court below, a feast laid under red candlelight on the middle floor, and the Malachite Mirror on a pedestal at the top with a witch's skeleton at its foot" },
      { name: "Crypt", kind: "behind the tapestry: the lord, the lady and their twelve children in carved coffers, with two crowns, a moonstone rod and a Staff of Striking" },
      { name: "Spirits Awakened", kind: "step onto the middle floor or open a tomb and the feast rots, two spectres rise crowned in red flame, and twelve shades step out of the tapestry" },
    ],
  },
  {
    hex: "0702",
    name: "Drigbolton and the Oath House",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 261,
    note: "Encounters are 2-in-6 likely to be with 2d4 cannibals (see hex 0801), attempting to capture travellers and drag them back to their lair.",
    flavour: [
      "Wet heath clinging between hills crowned with flaming heather.",
      "Drigbolton is cottages, barns, a wooden church and a few dozen goatherds, hanging on just past the Duchy's northern border.",
      "Every dwelling here keeps a locked repast room where the family's mummified ancestors sit at table and are fed at dusk. Nobody will discuss it.",
    ],
    places: [
      { name: "The King Deer", kind: "the inn: three round tables, stools for fifteen, prize goat horns behind the bar, poor lodgings and bitter crab-apple scrumpy" },
      { name: "Church of St Gretchen", kind: "windowless cedar boards under a cone roof and a red carnelian idol of the saint with her bucket and goat; praying there grants Purify Food and Drink" },
      { name: "The Oath House", kind: "a trim old manor in a chalk valley in the north, its central tower plastered with star charts around a brass viewing apparatus" },
    ],
    folk: [
      { name: "Laird Alhoyle Spinnewith IV", what: "pale, enormous grey sideburns, pipe always going; the last of his line, and a sage worth hiring on astronomy, astrology and ley lines" },
    ],
    hexEncounter: [
      { chance: 2, what: "2d4 cannibals of Clan Shaggytree (hex 0801), out to drag travellers back to their lair", number: "2d4" },
    ],
  },
  {
    hex: "0703",
    name: "The Ruins of Midgewarrow",
    terrain: "tangled-forest",
    cost: 3,
    region: "nagwood",
    lost: "2-in-6",
    page: 262,
    note: "Encounters are 2-in-6 likely to be with 2d4 cannibals (see hex 0801), attempting to capture travellers and drag them back to their lair. Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    forage: "1d2 Shub Eggs (p430)",
    flavour: [
      "Swollen, blistered trunks weeping orange sap, and a dull quiet over all of it.",
      "Half a mile out along the old road in either direction, boulders painted with crosses and skulls, faded but legible enough.",
      "At the centre, a town two centuries dead of plague under vines and rot — and in the middle of it a white marble tower without a mark on it.",
    ],
    places: [
      { name: "The Chapel of St Eggort", kind: "down an arched tunnel of moss-covered candle sconces behind still-locked doors; praying at the statue grants Holy Light", hidden: true },
      { name: "The White Tower", kind: "booms aloud when anyone comes near; glyph-locked door, unbreakable glass, four storeys of spotless empty rooms and a sealed door at the top" },
      { name: "The Bedchamber", kind: "not a speck of dust, and a black-haired woman asleep in the bed with purple pustules on her skin; break the stasis and the plague wakes with her" },
    ],
    hexEncounter: [
      { chance: 2, what: "2d4 cannibals of Clan Shaggytree (hex 0801), out to drag travellers back to their lair", number: "2d4" },
    ],
  },
  {
    hex: "0704",
    name: "Derodand Manor",
    terrain: "tangled-forest",
    cost: 3,
    region: "dwelmfurgh",
    lost: "2-in-6",
    page: 263,
    alsoRegion: "Nagwood",
    note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "The stink of rotting sludge off the stagnant pools along Quogg's Creek.",
      "A track turns off the north road into twisted hazel and deep fern; three hundred yards along, a mossy wall, an iron gate patterned with ivy, and a rose-covered manor behind it.",
      "Every room is lit by candles, the way it was done a hundred years ago.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Derodand Manor", kind: "wood-panelled halls, stilted portraits, overflowing shelves; the lady is reclusive and looses four Lankston mastiffs on anyone uninvited" },
      { name: "Attic room", kind: "a secret room with the Service of Calthrounhe on a round table under her witch owl's eye — tea poured at night by candlelight seats the dead at the table, and costs the pourer", hidden: true },
      { name: "Rose Gardens", kind: "statues and follies behind the house: a Green Man temple where the coven gathers, and a marble Forroth raised in memory of the brother it drove mad" },
    ],
    folk: [
      { name: "Lady Emelda Haeroth", what: "Harrowmoor noble, great-aunt to Lady Theatrice, and in secret one of the High Priestesses of the witches of Dolmenwood" },
    ],
  },
  {
    hex: "0705",
    name: "The Scrabey Who Forgot Her Name",
    terrain: "tangled-forest",
    cost: 3,
    region: "dwelmfurgh",
    lost: "2-in-6",
    page: 264,
    note: "Nighttime encounters on the road are 2-in-6 likely to be with the ghost of Dewidort of Smerne (see hex 0607). Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Rolling wood of hillocks and small streams. The trees lean at odd angles, roots clutching at the air.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
      "The hanged highwayman's ghost from 0607 walks the road at night.",
    ],
    places: [
      { name: "The Scrabey's home", kind: "where she is, having forgotten her own name" },
    ],
    hexEncounter: [
      { chance: 2, period: "night", what: "the ghost of Dewidort of Smerne, the highwayman (see hex 0607)", way: ["road"] },
    ],
  },
  {
    hex: "0708",
    name: "The Hamlet of Shagsend",
    terrain: "craggy-forest",
    cost: 4,
    region: "high-wold",
    lost: "3-in-6",
    page: 267,
    alsoRegion: "Dwelmfurgh",
    note: "Nighttime encounters are 3-in-6 likely to be with a Drune cottager (DMB) and 1d4 bramblings (DMB), spying on Shagsend, seeking their lost comrade, Cranthus (imprisoned in Shagsend). Ley line proximity Chell/Ywyr: Arcane spell-casters perceive the distant moaning of the dead and the curious dual sensation of balmy heat and biting cold.",
    flavour: [
      "Green paths and glades winding between sheer slate cliffs topped with trailing bramble.",
      "The hamlet is holding a Drune prisoner named Cranthus.",
      "His comrades know it. At night a Drune cottager and a few bramblings are out there watching the place.",
    ],
    places: [
      { name: "Shagsend", kind: "hamlet — and the cell Cranthus is in" },
    ],
    hexEncounter: [
      { chance: 3, period: "night", what: "a Drune cottager and 1d4 bramblings, spying on Shagsend after their lost comrade Cranthus", creature: "Drune—Cottager" },
    ],
  },
  {
    hex: "0709",
    name: "The Shadholme and Redwraith Manor",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 268,
    flavour: [
      "Dense, oppressive shadow, and a feeling of being watched that the odd echoing of sound does nothing to help.",
      "In the far south, Manor Road runs past the Malbleat family's tomb complex.",
      "You get an audience with Lord Malbleat with an official invitation — or with occult secrets.",
    ],
    places: [
      { name: "The Shadholme", kind: "the Malbleat tombs; a ceremonial lodge at the entrance with ten shorthorn guards" },
      { name: "Redwraith Manor", kind: "oak, chandeliers and goose-feather cushions, under a portrait of a black-horned longhorn" },
    ],
    folk: [
      { name: "Lord Malbleat", what: "master of the manor; sees visitors on his own terms" },
    ],
  },
  {
    hex: "0710",
    name: "Lankshorn and the Animal Orchestra",
    terrain: "farmland",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 269,
    flavour: [
      "Wheat fields, cow pasture, hamlets and muddy lanes, and the smell of dung over all of it.",
      "A bowshot from the eaves of the wood stands Lankshorn — the market town, and the way in from the High Wold.",
      "Longhorn breggles have always ruled it.",
    ],
    places: [
      { name: "The Town of Lankshorn", kind: "market town — full description in the book" },
      { name: "The Triptych", kind: "a fading oil painting whose owner does not know it tells of the Aubrathon stealing a Mirror of Embala from the witches", hidden: true },
      { name: "The Animal Orchestra", kind: "what the hex is named for" },
    ],
  },
  {
    hex: "0711",
    name: "King Pusskin's Road",
    terrain: "farmland",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 270,
    flavour: [
      "Quiet lanes between farmers' fields and windy hilltops.",
      "At the crossroads where Swinescombe Road and a handful of farm tracks meet the Swallop Road, a thatched cottage in apple orchards.",
      "Its sign is a gloved lady's hand holding a doily.",
    ],
    places: [
      { name: "The Quivering Doily", kind: "inn — one private room; Lanklow's scrumpy at 1sp a mug and mead always in stock at 12sp a glass" },
    ],
  },
  {
    hex: "0712",
    name: "The Derelict Windmill",
    terrain: "hills",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 271,
    flavour: [
      "Rough hillsides crossed by sheep paths, cowbells clanking somewhere.",
      "On a bare hilltop, a three-storey windmill with its roof caved in and its sails in rags.",
      "The shreds of sail flap and it sounds like chuckling, from a long way off.",
    ],
    places: [
      { name: "The Derelict Windmill", kind: "the ruin on the hill" },
      { name: "The Cellar", kind: "bootprints down a frosty stair to a door of ice, ajar, a crystal key left in the lock — and a round chamber beyond, iced floor to ceiling", hidden: true },
    ],
  },
  {
    hex: "0801",
    name: "The Caves of Clan Shaggytree",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 272,
    note: "Encounters are 2-in-6 likely to be with 2d4 cannibals, attempting to capture travellers and drag them back to their lair.",
    flavour: [
      "Rocky crags and bare hills with hardly any grass on them, and laughter half-heard on the wind.",
      "Figures stand among the crags that look like malformed giants from a distance; close up each is an eight-foot effigy of human bones lashed with leather under a single downward-staring skull.",
      "The effigies are eyes. The clan is watching through them, and already knows you are here.",
    ],
    places: [
      { name: "Profane Effigies", kind: "the bone figures; pulling a skull off blinds one, and costs the vandal a save or a chortling mouth opens somewhere on their body" },
      { name: "The Caves of Clan Shaggytree", kind: "a stinking maw deep in the defiles, then narrow tunnels echoing with laughter — a clan hall hung with flayed skins, a larder of hanging carcasses, fifty cannibals", hidden: true },
      { name: "The shrine of Atanuwe", kind: "deepest in: a nine-legged stone idol drooling into a pool and whispering to those who supplicate; destroy it and every mutation it caused reverses" },
    ],
    folk: [
      { name: "Sandy and Agnes Shaggytree", what: "criminal runaways who found the caves and the shrine decades ago, and are the parents of all the rest" },
    ],
    hexEncounter: [
      { chance: 2, what: "2d4 of the clan's own cannibals, out to drag travellers back to the caves", number: "2d4" },
    ],
  },
  {
    hex: "0802",
    name: "Avernal Lake",
    terrain: "tangled-forest",
    cost: 3,
    region: "nagwood",
    lost: "2-in-6",
    page: 273,
    note: "Encounters are 2-in-6 likely to be with 2d4 cannibals (see hex 0801), attempting to capture travellers and drag them back to their lair.",
    flavour: [
      "Gnarled old elms and oaks with eye-like whorls in the bark and branches like grasping fingers.",
      "A deep, mist-shrouded lake near the northern border. Trade barges hug the north and west banks and will not go near the southern shore.",
      "A hundred yards offshore stands the half-sunken ruin of a small keep. It looks unoccupied.",
    ],
    places: [
      { name: "Disused dock", kind: "on the northern shore; barges stop here sometimes and will carry a passenger to Fort Vulgar for a gold piece, eight hours down the water" },
      { name: "The Sunken Keep", kind: "the wyrm's lair in the flooded courtyard, entered through a jagged gap at the wall's base; her hoard is under fallen battlement stone above the waterline" },
      { name: "Nights of the Full Moon", kind: "the fairy city Tainglass glitters in the depths; swim down towards it and you may be let in, and lose your memory of everything before" },
    ],
    folk: [
      { name: "Sowynder", what: "a juvenile phlegm wyrm with five golden eyes and a forked tail, sweetly amicable and playing at loneliness; at new-moon dawns witches row out and milk poison from her flank" },
    ],
    hexEncounter: [
      { chance: 2, what: "2d4 cannibals of Clan Shaggytree (hex 0801), out to drag travellers back to their lair", number: "2d4" },
    ],
  },
  {
    hex: "0803",
    name: "The Toll Bridge and Snarkscorn's Camp",
    terrain: "thorny-forest",
    cost: 4,
    region: "nagwood",
    lost: "3-in-6",
    page: 274,
    note: "Random encounters here are 3-in-6 likely to be with 2d4 crookhorns (DMB) under the command of Captain Snarkscorn. Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    forage: "1d2 portions of Woodpurse (p430)",
    flavour: [
      "Trees blackened, twisted and dripping with ochre slime, and worse the further south-east you go.",
      "A mossy arched bridge, six feet wide and twenty long, spans Quogg's Creek. Crookhorns hold it by day and tax everyone across it.",
      "Three hundred yards south is their camp — sixty of them, bonfires and caustic brew at night, and whatever prisoners they are holding.",
    ],
    places: [
      { name: "The Toll Bridge", kind: "Griswold Bridge: 2d20sp a head on foot, the same per crew for boats forced to moor, and robbery outright if they clearly outnumber you" },
      { name: "The Camp of Captain Snarkscorn", kind: "sixty crookhorns sprawled in net-hammocks by day; the Captain's blood-stained pavilion at the centre under four of the toughest" },
      { name: "The Captain's Hoard", kind: "in a pit under the bed with an angry adder on top of it: coins, a fist-sized aquamarine, and a black horn whose oil opens a conversation with the Nag-Lord", hidden: true },
    ],
    folk: [
      { name: "The pavilion's prisoner", what: "a witch, gagged and chained to the tentpole, being kept to be brought before Snarkscorn's master for questioning" },
    ],
    hexEncounter: [
      { chance: 3, what: "2d4 crookhorns under Captain Snarkscorn", creature: "Crookhorn", number: "2d4" },
    ],
  },
  {
    hex: "0804",
    name: "The Summerstone Hadrwyl",
    terrain: "thorny-forest",
    cost: 4,
    region: "nagwood",
    lost: "3-in-6",
    page: 275,
    alsoRegion: "Dwelmfurgh",
    note: "In the eastern part of the hex (outside of Dwelmfurgh), encounters are 2-in-6 likely to be with 1d4 Chaotic treoweres (DMB). Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    flavour: [
      "Cobwebs over everything and spiders in them, with clouds of flies and gnats coming up out of the wet soil.",
      "The eastern half is stunted black-leafed trees with thorny, claw-like branches that wake and grab: Save Versus Hold or take 1d6 from them.",
      "Crookhorn heads on stakes turn up all across the hex — some fresh and gory, some picked clean.",
      "Inside the Ring of Chell, so true fairies sicken here and their magic misfires.",
    ],
    places: [
      { name: "Grasping Thorns", kind: "the corrupted eastern wood, and the line of frozen dead trees where the Ring of Chell runs; beyond it the wood is ordinary again" },
      { name: "The Summerstone Hadrwyl", kind: "the Sagestone in an evergreen glade — within sixty feet it is a save or blind for a day, and touching it lets you read any script written", hidden: true },
    ],
    folk: [
      { name: "The Audrune Hermanach", what: "short and stocky with a long black beard-braid, mostly out as a raven; the heads on stakes are his work, and he wants the crookhorn garrison at 0803 destroyed" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d4 Chaotic treoweres", creature: "Treowere", number: "1d4", where: "in the eastern part of the hex, outside Dwelmfurgh" },
    ],
  },
  {
    hex: "0805",
    name: "Prigmarinn Hill",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    alsoRegion: "Dwelmfurgh",
    lost: "2-in-6",
    page: 276,
    note: "Nighttime encounters on the road are 2-in-6 likely to be with the ghost of Dewidort of Smerne (see hex 0607). Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold.",
    flavour: [
      "Elegant silver birches in chalky soil, over otherwise flat ground.",
      "Every so often a tall hill breaks it up.",
    ],
    places: [
      { name: "Prigmarinn Hill", kind: "the hill the hex is named for" },
    ],
    hexEncounter: [
      { chance: 2, period: "night", what: "the ghost of Dewidort of Smerne, the highwayman (see hex 0607)", way: ["road"] },
    ],
  },
  {
    hex: "0807",
    name: "Ignormwm's Cottage",
    terrain: "swamp",
    cost: 4,
    region: "dwelmfurgh",
    alsoRegion: "Hag's Addle",
    lost: "3-in-6",
    page: 278,
    note: "Ley line crossing Chell/Ywyr: Arcane spell-casters perceive a throbbing warmth from the earth and the chilling cries of gigantic ravens. Within the Ring of Chell (p20): True fairies are afflicted with a spiritual malaise; teleportation and summoning are ineffectual; magic of illusion or charm has a 2-in-6 chance of failure.",
    forage: "1d2 portions of Bosun's Balm (DPB) and 1d3 portions of Lankswith (DPB)",
    flavour: [
      "Thick reed banks and gangly willows through a maze of stinking channels.",
      "Dry ground is hard to come by.",
      "Two ley lines cross here, and inside the Ring of Chell true fairies sicken: no teleporting, no summoning, and illusion or charm fails 2-in-6.",
    ],
    places: [
      { name: "Ignormwm's Cottage", kind: "the cottage the hex is named for" },
    ],
  },
  {
    hex: "0808",
    name: "The House of Merridwyn Scymes",
    terrain: "craggy-forest",
    cost: 4,
    region: "high-wold",
    lost: "3-in-6",
    page: 279,
    note: "Daytime encounters are 2-in-6 likely to be with a Lankshorn town guard (p157) bringing provisions to Merridwyn Scymes's cottage.",
    flavour: [
      "Narrow paths picking their way round sandstone cliffs, above boggy ditches and stinking fen.",
      "In a wooded dell in the south-west, a one-storey thatched cottage beside a cheerful stream — every window shuttered.",
      "A Lankshorn town guard brings food up to it by day.",
    ],
    places: [
      { name: "Shuttered Cottage", kind: "the cottage in the dell" },
    ],
    folk: [
      { name: "Merridwyn Scymes", what: "a magician's nerves, organs and brain in one shapeless mass, in constant agony — her skin murdered her husband" },
    ],
    hexEncounter: [
      { chance: 2, period: "day", what: "a Lankshorn town guard carrying provisions to Merridwyn Scymes's cottage" },
    ],
  },
  {
    hex: "0809",
    name: "Nightworms",
    terrain: "open-forest",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 280,
    note: "After dark, encounters are 3-in-6 likely. Nighttime encounters are 4-in-6 likely to be with 1d8 nightworms.",
    forage: "1d3 portions of Smottlebread (DPB)",
    flavour: [
      "A sandy beech wood full of birdsong.",
      "Red, eyeless worms crawl everywhere in the undergrowth.",
      "After dark the place is three times as dangerous, and what you meet is almost always the worms.",
    ],
    places: [
      { name: "The Ditchway", kind: "the road through, and the chambers off it" },
    ],
    hexEncounter: [
      { chance: 3, period: "night", kind: "chance", what: "after dark this hex is 3-in-6 rather than the bog's usual 2" },
      { chance: 4, period: "night", what: "1d8 nightworms", number: "1d8" },
    ],
  },
  {
    hex: "0810",
    name: "King's Mounds and the Drune Cottage",
    terrain: "open-forest",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 281,
    note: "Daytime encounters are 2-in-6 likely to be with the Braithmaid Pollith Bonewort, roaming the woods singing haunting, magical songs. Nighttime encounters are 2-in-6 likely to be with the barrowbogey Thrattlewhit, creeping to the Drune Cottage to catch a glimpse of his beloved Pollith.",
    flavour: [
      "Rolling ground of birch copses, chestnut glades and bramble thickets.",
      "By day you may hear singing: a Drune braithmaid walks these woods with haunting, magical songs.",
      "By night something else is out — a barrowbogey creeping towards the cottage to catch sight of her.",
    ],
    places: [
      { name: "Ancient Burial Mounds", kind: "the King's Mounds themselves" },
      { name: "The Drune Cottage", kind: "where Pollith lives" },
    ],
    folk: [
      { name: "Pollith Bonewort", what: "Drune braithmaid; sings her way through the woods by day" },
      { name: "Thrattlewhit", what: "chief barrowbogey, hopelessly in love with her" },
    ],
    hexEncounter: [
      { chance: 2, period: "day", what: "the Braithmaid Pollith Bonewort, walking the woods singing magical songs", creature: "Drune—Braithmaid" },
      { chance: 2, period: "night", what: "the barrowbogey Thrattlewhit, creeping to the Drune Cottage for a glimpse of his beloved Pollith", creature: "Barrowbogey" },
    ],
  },
  {
    hex: "0811",
    name: "Cornew Cliffs",
    terrain: "hills",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 282,
    note: "On sunny days, encounters are 2-in-6 likely to be with 2d6 young women from the farms to the north-west.",
    flavour: [
      "Low flat-topped hills, chalky paths crossing each other, boulders scattered about.",
      "On a sunny day you will meet farm girls from the north-west, out gathering Lover's Gasp off the rotting trunks at the wood's edge — the mushrooms are supposed to be lucky in courtship.",
      "They will warn you not to disturb the cornews, a kind of fairy living in burrows in and under those trunks.",
    ],
    places: [
      { name: "Cornew Cliffs", kind: "the hills, and the fairy burrows in the rotting trunks" },
    ],
    hexEncounter: [
      { chance: 2, period: "day", what: "2d6 young women out from the farms to the north-west", number: "2d6", sunny: true },
    ],
  },
  {
    hex: "0812",
    name: "The Shadow Revel",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 283,
    flavour: [
      "Rough tussocky grass with oak copses, and every trunk carries a whorl like a suspicious eye.",
      "A single sandstone monolith stands in a field of thistles — 30 feet tall, 10 across. Scholars of the stones call it Twolgstone.",
      "For 60 feet around it every plant is flattened, as though something had blasted outwards from the stone.",
    ],
    places: [
      { name: "Twolgstone", kind: "the monolith, and the flattened ring around it" },
      { name: "Dancing Shadows", kind: "humanoid shadows in hats, wigs and masks, moving on their own but cast like ordinary shadows" },
    ],
  },
  {
    hex: "0901",
    name: "The Bloodied Altar",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 284,
    note: "Sentient folk encountered within the ring of the Mysterious Cairns are trapped. Some may have read The Inscription, and seek to free themselves by sacrificing others. Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.",
    flavour: [
      "Steep hills, scree slopes and cliffs, the boulders streaked with what looks a great deal like blood.",
      "A ring of cairns, many over ten feet, marks off a wide area at the centre. Cross that line and you cannot leave: paths loop back and the hills move to close you in.",
      "At the middle, a deep cleft in the earth with an old stone altar on its brink, dark-stained, a crude bone knife lying on the slab.",
    ],
    places: [
      { name: "The Bloodied Altar", kind: "the glyphs on its side read themselves into your head: blood daubed on the stone and a humanoid corpse thrown into the cleft, and the land lets you go" },
      { name: "The cleft", kind: "choked with broken bones, and the coins earlier prisoners threw down hoping that would be offering enough" },
      { name: "Hermit's Cave", kind: "brush-hidden at a crag inside the ring: fire pit, furs, bone tools, years of tally marks and church hymns on the walls, and the man who cut them dead in the last chamber", hidden: true },
    ],
    hexEncounter: [
      { always: true, kind: "colour", what: "whoever is met is trapped in the ring as well — and some, having read the Inscription, mean to buy their way out by sacrificing somebody", where: "within the ring of the Mysterious Cairns" },
    ],
  },
  {
    hex: "0902",
    name: "The Battle of the Trees",
    terrain: "tangled-forest",
    cost: 3,
    region: "nagwood",
    lost: "2-in-6",
    page: 285,
    note: "Encounters are 2-in-6 likely to be with a treowere (DMB), either Lawful or Chaotic (see The Battle of the Trees). Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.",
    forage: "ruddy medlars sufficient for 1d6 doses of Moonhaw (DPB)",
    flavour: [
      "Uneven ground riven with ditches and gullies, foul purple vapour drifting up out of the earth.",
      "Somewhere ahead: falling timber and the roaring of monsters.",
      "Near two dozen treoweres a side fighting across a field of upturned trunks — the corrupted ones screaming as they go, the others simply enormous trees holding their ground.",
    ],
    places: [
      { name: "The Battle of the Trees", kind: "eight Chaotic treoweres and sixteen animated trees against six and twelve; a party that joins in can decide it" },
      { name: "Rewards", kind: "the Chaotic side invites whoever helped them to the Nag-Lord's court to be rewarded personally; the Lawful side gives an Arcane Shortbow cut from a treowere dead long ago" },
    ],
    hexEncounter: [
      { chance: 2, what: "a treowere, Lawful or Chaotic, off the battle raging here", creature: "Treowere" },
    ],
  },
  {
    hex: "0903",
    name: "The Besieged Nodal",
    terrain: "tangled-forest",
    cost: 3,
    region: "nagwood",
    lost: "2-in-6",
    page: 286,
    note: "Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.",
    forage: "1d4 Shub Eggs (p430)",
    flavour: [
      "Boggy woods of wind-bent pine cut up by small streams and islets, and a purplish cast to the air.",
      "In a sodden hollow ringed with elder stands a fifteen-foot obelisk of white sandy stone, inlaid with silver runes.",
      "It is under siege. The Nag-Lord's horde comes at it about one night in three, and the defence will not hold much longer.",
    ],
    places: [
      { name: "Tenkystone", kind: "the nodal; its runes teach Word of Doom, and touching it raises a white mist that kills on a failed save and answers a question about the future for whoever lives" },
      { name: "The Nag-Lord's Horde", kind: "harpies and crookhorns lounging in the branches by day; harpies, crookhorns and harridans creeping in by night, meaning to bind the stone to Atanuwe" },
      { name: "Giant Trident", kind: "seven prongs of meteoric iron speared into the ley line two hundred yards south, black ooze seeping from the wound; it is what is jamming the Audrune's magic" },
    ],
    folk: [
      { name: "The Audrune Jhaelloch", what: "scrawny and grey-skinned, a woollen scarf tied over his ears against the harpies' song; he will bargain with anyone who breaks the siege or carries word to Hermanach at 0804" },
    ],
  },
  {
    hex: "0904",
    name: "The Court of the Nag-Lord",
    terrain: "thorny-forest",
    cost: 4,
    region: "nagwood",
    lost: "3-in-6",
    page: 287,
    note: "Encounters are 2-in-6 likely to be with 2d10 vampire bats (DMB), bred by the Nag-Lord to plague its domain. Ley line crossing Hoad/Lamm: Arcane spell-casters perceive the feeling of desperately awakening from a nightmare. (See p18.)",
    flavour: [
      "Decrepit firs and twisted thorn trees dripping pink ooze, and clawed roots that writhe and grab at your legs.",
      "On the steep north shore of the Shub: a great quivering dome of black slime with a hundred-foot tower of gristle rising out of it, ringed by a wall of venomous thorn fifteen feet high and fifteen deep.",
      "The wall parts for anyone who bows low and proclaims themselves Atanuwe's servant. Climbing it instead costs 2d8 and a save against the poison.",
    ],
    places: [
      { name: "Inside the Court", kind: "membranous passages lit by weeping pustules; seventy-five crookhorns, harpies, harridans and corrupt unicorns, and visitors are imprisoned, tormented and eaten alive" },
      { name: "Throne room", kind: "the captured Sargstone behind the throne with a trapped Audrune's face in its energies, the Stag Lord's severed head hanging above, and the Awlflame lying on a table as a toothpick" },
      { name: "Atanuwe's chambers", kind: "up a stair of human bone: jewels, art objects, a pool of liquid gold, and a heap of discarded magical playthings" },
      { name: "Cellars and pantries", kind: "an endless maze of frigid rooms below, holding crushed-sprite wines and the prisoners meant for the feasting tables" },
    ],
    hexEncounter: [
      { chance: 2, what: "2d10 vampire bats, bred by the Nag-Lord to plague its domain", creature: "Bat, Vampire", number: "2d10" },
    ],
  },
  {
    hex: "0905",
    name: "The Mouse Shrine and the Hermitage",
    terrain: "tangled-forest",
    cost: 3,
    region: "valley-of-wise-beasts",
    lost: "2-in-6",
    page: 288,
    note: "Encounters are 2-in-6 likely to be with a patrol of 2d6 crookhorns (DMB) from the garrison at Baron Fragglehorn's tower (hex 1004). They patrol down into the Valley from the tower, meting out terrible and anarchic justice, and try to arrest outsiders and bring them before the Baron. Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.",
    forage: "1d4 portions of Worm-Mallow (p430)",
    flavour: [
      "Broken branches and carelessly felled trunks, with crookhorn hoofprints tracked all through it.",
      "The Baron's patrols come down from his tower in 1004 and hand out justice that is both terrible and arbitrary.",
      "If they find outsiders, they arrest them and take them to him.",
    ],
    places: [
      { name: "The Mouse Shrine", kind: "the shrine the hex is named for" },
      { name: "The Hermitage", kind: "the other half of the name" },
    ],
    hexEncounter: [
      { chance: 2, what: "a patrol of 2d6 crookhorns from the garrison at Baron Fragglehorn's tower (hex 1004)", creature: "Crookhorn", number: "2d6" },
    ],
  },
  {
    hex: "0906",
    name: "The Ruined Abbey of St Clewyd",
    terrain: "craggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 289,
    note: "Encounters are 2-in-6 likely to be with the gloam (DMB) that lairs in the abbey ruins. Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.",
    flavour: [
      "Ragged granite peaks with face-like shapes in their sides, and the wind seems to come out of them.",
      "Where Swinney Road crosses the turreted Chantilope Bridge, an overgrown cobbled avenue branches off to the ruins.",
      "A gloam lairs in them.",
    ],
    places: [
      { name: "The Ruined Abbey of St Clewyd", kind: "the ruins at the end of the avenue" },
      { name: "The Chapel Crypts", kind: "tombs and catacombs under the chapel; the eastern half is torn by a Chaos rift left by the ritual that destroyed the abbey", hidden: true },
    ],
    hexEncounter: [
      { chance: 2, what: "the gloam that lairs in the abbey ruins", creature: "Gloam" },
    ],
  },
  {
    hex: "0907",
    name: "Bafflestone",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 290,
    note: "Encounters are 3-in-6 likely to be with 2d10 wandering Bafflestone Thralls. Ley line crossing Lamm/Ywyr: Arcane spell-casters perceive an incessant, spiralling wailing, as if a gateway to the realm of the dead were nearby.",
    flavour: [
      "Pathless, dismal woods of knotted roots and tangled branches.",
      "The silence is broken by rasping moans.",
      "Whatever the stone does to people, there are 2d10 of them wandering about out here already.",
    ],
    places: [
      { name: "Enfeebling Emanations", kind: "what the Bafflestone puts out, and the save against it" },
      { name: "Bafflestone Thralls", kind: "what happens to those who fail" },
    ],
    hexEncounter: [
      { chance: 3, what: "2d10 wandering Bafflestone Thralls", number: "2d10" },
    ],
  },
  {
    hex: "0908",
    name: "The Hag's Lair",
    terrain: "swamp",
    cost: 4,
    region: "hags-addle",
    lost: "3-in-6",
    page: 291,
    note: "Nighttime encounters are 2-in-6 likely to be with the Hag (p82). Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.",
    forage: "1d6 portions of Bloodcap (p428) or 1d4 portions of Grinning Jenny (p428)",
    flavour: [
      "A confusing tangle of marshy channels, peat bog and mud holes.",
      "Bog-lights flicker over it, and they babble.",
      "Arcane casters feel watched here, by something without pity.",
    ],
    places: [
      { name: "The Soul Pond", kind: "candles with anguished faces twisted into the wax — each one somebody's last" },
    ],
    folk: [{ name: "The Hag", what: "2-in-6 to meet at night; described on p82" }],
    hexEncounter: [
      { chance: 2, period: "night", what: "the Hag herself (p82)" },
    ],
  },
  {
    hex: "0909",
    name: "The Worm's Pit",
    terrain: "craggy-forest",
    cost: 4,
    region: "high-wold",
    lost: "3-in-6",
    page: 292,
    note: "Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.",
    flavour: [
      "Blackened, charred trees stripped of leaves, over hard bare dirt.",
      "A permanent light haze that smells of smoke and cuts down how far you can see.",
      "The fire that did this was not an accident — the Blistered Woods are a curse.",
    ],
    places: [{ name: "The Blistered Woods", kind: "the burnt stretch and the curse behind it" }],
    folk: [
      {
        name: "The Worm",
        what: "40ft earthworm, translucent, lamprey mouth; demands tribute and acts as though it were doing you the favour",
      },
    ],
  },
  {
    hex: "0910",
    name: "Golokstone",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 293,
    note: "Off-road encounters are 2-in-6 likely to be with 1d3+1 bramblings patrolling the region. Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.",
    flavour: [
      "Old thick-trunked trees creaking and groaning. The soil is orange, as though something had soaked into it.",
      "A high-gabled inn stands across the Ditchway like a bridge, with a busy yard and stables behind it full of caravans.",
      "Its sign is a curled bugle with Lord Ramius's portrait on it.",
    ],
    places: [{ name: "The Jaunty Horn", kind: "inn — spans the road; caravans stop here" }],
    folk: [
      {
        name: "Jesibelle Nag",
        what: "landlady, Level 4 fighter; sheepskin, striped trousers, purple boots, arms bare and covered in bangles",
      },
    ],
    hexEncounter: [
      { chance: 2, what: "1d3+1 bramblings on patrol", creature: "Brambling", number: "1d3+1", way: ["wild"] },
    ],
  },
  {
    hex: "0911",
    name: "Shub's Nanna",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 294,
    note: "Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.",
    flavour: [
      "Round moss-covered boulders, waist high, strung out like islands through the green.",
      "By a fast brook of dark water stands an old brick cottage, one and a half storeys of crooked angles, jutting gables and odd cupolas, with grimy windows you cannot see through.",
      "That is where the longhorn crone the locals call Shub's Nanna lives, with her people.",
    ],
    places: [
      { name: "The Crooked Cottage", kind: "her house by the brook" },
      {
        name: "The Shrine to St Thorm",
        kind: "south of the hex: a ruined ivy-grown church full of rooks, ringed with crusted black filth",
        hidden: true,
      },
    ],
    folk: [{ name: "Shub's Nanna", what: "longhorn crone (p47), and her henchfolk" }],
  },
  {
    hex: "0912",
    name: "The Hamlet of Swinescombe",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 295,
    note: "Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.",
    flavour: [
      "Green pasture and orchards, old windmills, fields of oats and barley.",
      "In the north, against the forest, the hamlet looks charming from a distance — thatched farmhouses, crimson barns, usually a lute or fiddle going.",
      "It is not what it looks like. A charcutier here once fed the black filth from 0911 to his pigs, hoping to beat Dreg's famous sausage.",
      "It went through the whole food chain: the pigs became sentient pigfolk, the humans became dull beasts, and the pigs took the houses.",
    ],
    places: [
      { name: "Swinescombe", kind: "hamlet — outlying farms all round it" },
      { name: "The Secret of Swinescombe", kind: "who actually lives in those farmhouses now", hidden: true },
    ],
  },
  {
    hex: "1001",
    name: "The Bogenwood",
    terrain: "tangled-forest",
    cost: 3,
    region: "nagwood",
    lost: "2-in-6",
    page: 296,
    note: "Encounters are 2-in-6 likely (4-in-6 likely if travelling on Quaking Creek) to be with 1d2 bogen.",
    forage: "1d3 portions of Foolscap (p428)",
    flavour: [
      "A rubbery black weed clustered with squeaking bladders carpets the ground.",
      "Piles of battered timber on the slopes above Quaking Creek mark out bogen territory, and the shrill whistling that startles you is meant to.",
      "In the south, trees daubed in blood with braying unicorn heads and nine-pointed stars — the Nag-Lord's marks.",
    ],
    places: [
      { name: "Bogen Territory", kind: "the timber markings and the mounds under the brush; they loathe outsiders and take particular pleasure in throwing rocks at boats" },
      { name: "Burial Pit", kind: "a limestone pit half full of brackish water in a stump-covered glade; crookhorns work the water with long staves, weaving flesh around centuries of bogen bones" },
    ],
    folk: [
      { name: "Bogen", what: "dull-witted giants eight to ten feet tall, hair over every part of them but their three-toed bird feet; they do not speak, only whistle and sigh" },
      { name: "The Huorglein", what: "what is being grown in the pit — twelve feet, scarlet, stag-antlered and shark-toothed, and not finished; drop a corpse in and it wakes early and furious" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d2 bogen", number: "1d2", where: "4-in-6 instead if the party is travelling on Quaking Creek" },
    ],
  },
  {
    hex: "1002",
    name: "The Belching Pools and Br Inemere",
    terrain: "bog",
    cost: 3,
    region: "fever-marsh",
    lost: "2-in-6",
    page: 297,
    forage: "1d3 portions of Marshwick (DPB) or Horridwort (p430)",
    flavour: [
      "Rotting reeds, tarry stinking pools, drifting yellow fog, and belching that breaks the quiet every so often.",
      "Hot pools bubble yellow with sulphur, and the mud banks around them let the gas up in gulps.",
      "The south-eastern corner is knee-deep in wiry black thorn scrub, and past it lies the salt crust of Brinemere.",
    ],
    places: [
      { name: "The Belching Pools", kind: "the sulphur craters and their belching mud banks" },
      { name: "Brinemere", kind: "salt sludge at the heart of the thorns: white crystal crusted over grey water, lifeless and offensively salt" },
      { name: "Lichen nests", kind: "hundreds of carrion storks nest at the western edge; their nests are clad in Horridwort, and a portion of it costs a fight with 1d4 of them" },
    ],
  },
  {
    hex: "1003",
    name: "An Awful Black Slime",
    terrain: "thorny-forest",
    cost: 4,
    region: "nagwood",
    lost: "3-in-6",
    page: 298,
    note: "Encounters are 2-in-6 likely to be with black tentacles (DMB).",
    forage: "1d3 portions of Grue's Ear (DPB) and 1d2 portions of Goatman's Goblet (p428)",
    flavour: [
      "Everything here is coated in a thick black slime, and the whole hex reeks of syrup.",
      "It is on the mud, on the thorn trees and on the surface of the Shub — oily, and no washing it off without soap.",
      "Brain-shaped fruits hang from the twisted trees on rubbery cords, and you can pick as many as you want to carry.",
    ],
    places: [
      { name: "Brain-Like Fruits", kind: "Shub Eggs; harvesting one makes the tree sigh and the cord ooze, and the fruit pulses gently for an hour before going still" },
      { name: "The Shrine to St Faxis", kind: "a slime-coated holy symbol standing out of a pool in a hollow, the round stone shrine sunk under it; recovered and given a statue, praying there grants Circle of Protection", hidden: true },
    ],
    hexEncounter: [
      { chance: 2, what: "black tentacles", creature: "Black Tentacles" },
    ],
  },
  {
    hex: "1004",
    name: "Baron Fragglehorn's Tower",
    terrain: "tangled-forest",
    cost: 3,
    region: "valley-of-wise-beasts",
    lost: "2-in-6",
    page: 299,
    note: "Encounters are 3-in-6 likely to be with a patrol of 2d6 crookhorns (DMB) from the garrison at the Baron's tower. They patrol down into the Valley from the tower, meting out terrible and anarchic justice, and try to arrest outsiders and bring them before the Baron.",
    flavour: [
      "The wide middle of the Valley of Wise Beasts: rolling wooded hillocks and springy grass.",
      "The Baron's tower stands over it, and his crookhorn garrison patrols out of it constantly — three encounters in six are one of his patrols.",
    ],
    places: [
      { name: "Baron Fragglehorn's Tower", kind: "the tower and its crookhorn garrison" },
    ],
    folk: [
      { name: "Baron Fragglehorn", what: "who the patrols drag outsiders in front of (p46)" },
    ],
    hexEncounter: [
      { chance: 3, what: "a patrol of 2d6 crookhorns from the garrison at the Baron's tower (hex 1004)", creature: "Crookhorn", number: "2d6" },
    ],
  },
  {
    hex: "1005",
    name: "Shub's Finger and Stirge Isle",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 300,
    note: "Encounters are 2-in-6 likely to be with 1d4 stirge-owls.",
    flavour: [
      "Hushed oak woods. Very few birds or small animals, and a groaning that comes and goes.",
      "On the west side a small rough path forks off Swinney Road and runs south into the trees.",
    ],
    places: [
      { name: "Shub's Finger", kind: "what the side path leads to" },
      { name: "Stirge Isle", kind: "the island out in the Groaning Loch" },
      { name: "The Shrine in the Cliffs", kind: "an overgrown ledge with a ruined stair down to it, seen from the water past Stirge Isle", hidden: true },
    ],
    hexEncounter: [
      { chance: 2, what: "1d4 stirge-owls", number: "1d4" },
    ],
  },
  {
    hex: "1006",
    name: "The Witch Glade",
    terrain: "craggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 301,
    note: "Encounters are 2-in-6 likely to be with 1d4 witches (eyes of Limwdd--DMB) making their way to the sacred glade. Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    forage: "1d3 portions of Lambent Stinkhorn (p428)",
    flavour: [
      "Paths threading granite outcrops with choked ravines below them.",
      "Witches come through here in ones and twos, on their way to a glade they hold sacred.",
    ],
    places: [
      { name: "Where Men Dare Not Tread", kind: "the sacred glade the witches are walking to" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d4 witches — eyes of Limwdd — on their way to the sacred glade", creature: "Witch", number: "1d4" },
    ],
  },
  {
    hex: "1007",
    name: "The Tower of Frost",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 302,
    flavour: [
      "Gentle woods of willow and elm. Golden motes drift through the air, and they lead travellers south into the swamp.",
      "In a glade of twisted beeches stands a slim, half-collapsed tower, held up by a glittering coat of rime.",
      "The upper windows are sheeted over with ice.",
    ],
    places: [
      { name: "The Tower of Frost", kind: "the rimed ruin in the beech glade" },
      {
        name: "Second floor",
        kind: "the Lady's rooms: High Elfish histories of the Cold Prince, a coffer with 100pp and sixteen quartz at 50gp each",
        hidden: true,
      },
    ],
    folk: [
      {
        name: "Lady Misthraine",
        what: "elf courtier passing as human; 3-in-6 to be at home, four charmed young men serve her",
      },
    ],
  },
  {
    hex: "1008",
    name: "The Flotsam Pools",
    terrain: "swamp",
    cost: 4,
    region: "hags-addle",
    lost: "3-in-6",
    page: 303,
    note: "Daytime encounters are 1-in-6 likely to be with Tekwell Onehorn.",
    forage: "1d3 portions of Hag's Tears (p430) and 1d2 portions of Marshwick (DPB)",
    flavour: [
      "Willows hanging over dreary swamp. Now and then you hear waves, as though the sea were just out of sight.",
      "Small pools of dark brackish water all through this stretch, none of them with a bottom you can see.",
      "After heavy rain they are always swollen; otherwise a 2-in-6 chance they are flooding when you arrive.",
    ],
    places: [{ name: "Flotsam Pools", kind: "bottomless brackish pools; things wash up here" }],
    folk: [{ name: "Tekwell Onehorn", what: "pedlar of what the pools give up — a d12 table of oddities" }],
    hexEncounter: [
      { chance: 1, period: "day", what: "Tekwell Onehorn" },
    ],
  },
  {
    hex: "1009",
    name: "The Anti-Prism",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 304,
    note: "Encountered creatures or people are 3-in-6 likely to be afflicted with the Grey Blight.",
    forage: "1d3 portions of Parson's Gobble (p430)",
    flavour: [
      "Patches of grey bushes, grey flowers and bare trees standing out against otherwise healthy forest.",
      "In the north-west, Harrid's Path runs through a half-mile circle where all the colour bleeds out of everything.",
      "Nothing living makes a sound in there. Only a low pulsing hum.",
    ],
    places: [{ name: "The Anti-Prism", kind: "the colourless circle on Harrid's Path", hidden: true }],
    hexEncounter: [
      { chance: 3, kind: "colour", what: "whatever is met is afflicted with the Grey Blight" },
    ],
  },
  {
    hex: "1010",
    name: "The House of the Harridwn",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 305,
    flavour: [
      "Tall birches full of beetle holes, sighing in the wind. Ants everywhere, and their mounds.",
      "Where the Ditchway crosses Harrid's Path there is an old signpost: north to Hag's Addle, south to the House of the Harridwn, east to the Dreg ferry, west to Lankshorn.",
      "Three miles along the quieter path stands a small homely inn with a sad little barn attached. You will almost certainly be its only guests.",
    ],
    places: [
      { name: "Crossroads and Signpost", kind: "the Ditchway meeting Harrid's Path" },
      { name: "The House of the Harridwn", kind: "inn — sign shows a crowd of children in maroon livery" },
      {
        name: "The Shrine to St Ponch",
        kind: "north-west corner, 200 yards off the Ditchway: a valley buried in Hob's Lewd fungus, 3d6 portions of it, a shrine underneath",
        hidden: true,
      },
    ],
  },
  {
    hex: "1011",
    name: "Brydging Ring",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    lost: "2-in-6",
    page: 306,
    forage: "1d3 portions of Hogscap (DPB) or Prancing Mandrake (p430)",
    flavour: [
      "Wild woods with no paths, choked with brambles and knee-high thistles that flower blue.",
      "About 300 yards in from the southern edge, through the brambles, stands a ring of tall stones under white-leafed ivy.",
      "In the middle of the ring is a heap of human remains — mostly bones, sometimes something fresher, torn apart. No clothes, no gear.",
    ],
    places: [{ name: "Standing Stones", kind: "the ring, and what is piled at the centre of it" }],
  },
  {
    hex: "1012",
    name: "Ancient Worm Tunnels",
    terrain: "meadow",
    cost: 2,
    region: "high-wold",
    lost: "1-in-6",
    page: 307,
    flavour: [
      "Wildflower meadow with ponds full of life, and a hollow moaning carried on the wind.",
      "The grassland is riddled with holes twenty feet across, dropping steeply and then levelling out.",
      "They open into circular tunnels, twenty feet wide, running for miles under the ground. Grass and ferns line the mouths; deeper down it is bare clay.",
    ],
    places: [
      { name: "Colossal Tunnels", kind: "the worm tunnels and their entrances" },
      {
        name: "Bronze Beans",
        kind: "tree beans with bronze skin, 100gp each; the Shadow House in Castle Brackenwold pays 1,000gp just to know where they are",
        hidden: true,
      },
    ],
  },
  {
    hex: "1101",
    name: "Houndmistress Mound",
    terrain: "tangled-forest",
    cost: 3,
    region: "nagwood",
    lost: "2-in-6",
    page: 308,
    note: "Encounters are 2-in-6 likely to be with 1d4 labourers and 1 guard (Level 1 fighter-- DMB) from the expedition based in hex 1201, surveying the exterior of the Houndmistress Mound.",
    flavour: [
      "Tangled trees pressed in close, their greens and browns almost painfully vivid.",
      "A wonky, decaying bridge crosses Quaking Creek at a narrow point beside a swirling pool: safe on foot, 3-in-6 to collapse under a vehicle.",
      "A sixty-foot burial mound under oily black ivy stands in a clearing at the south-eastern edge, a snarling bear's face carved above its entrance.",
    ],
    places: [
      { name: "Fentifey Bridge", kind: "the crossing; people and mounts get over, carts often do not" },
      { name: "Houndmistress Mound", kind: "the entrance is so narrow you go in sideways, and any dogs or wolves with the party start whining and ignoring orders on the approach" },
      { name: "Burial Chamber", kind: "behind a stone that takes a combined Strength of 30 to shift: a mummified noblewoman with a thorned whip, dog skeletons at her feet, and twelve silver dishes and twelve gold bowls about the walls" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d4 labourers and a guard from the expedition in hex 1201, surveying the outside of the Houndmistress Mound" },
    ],
  },
  {
    hex: "1102",
    name: "Mudpots",
    terrain: "bog",
    cost: 3,
    region: "fever-marsh",
    lost: "2-in-6",
    page: 309,
    note: "Encounters are 2-in-6 likely to be with Old Ned.",
    flavour: [
      "Rotten eggs on the air, and mud slurping somewhere out of sight.",
      "Craters of bubbling grey mud pock this part of the marsh, some of them ten-foot chimneys; once a day there is a 3-in-6 chance one goes off close by.",
      "Striped salamanders run between the hot pots and the cooler bog. They are worth fifty gold apiece to the right buyer.",
    ],
    places: [
      { name: "Mudpots", kind: "the craters; the mud runs from pleasantly warm to skin-stripping, and an eruption is a Save Versus Blast" },
      { name: "The Witch's Cottage", kind: "stone and packed dirt among the tallest mudpots, half buried and given away by light on glass; alchemy gear, fire beetles for lamps, and a greenhouse of ripe plants and fungi", hidden: true },
    ],
    folk: [
      { name: "Deidre Loam", what: "hermit witch in her late fifties, grim and strictly transactional; she will trade a day's undisturbed salamander-gathering for Horridwort out of 1002" },
      { name: "Old Ned", what: "her giant salamander, the size of a small horse and radiating heat; affectionate with her, and treats everyone met out in the pots as prey" },
    ],
    hexEncounter: [
      { chance: 2, what: "Old Ned, the witch's giant salamander, out foraging among the mudpots" },
    ],
  },
  {
    hex: "1103",
    name: "The Lightless Tower",
    terrain: "bog",
    cost: 3,
    region: "fever-marsh",
    lost: "2-in-6",
    page: 310,
    flavour: [
      "Sludge-choked pools and sodden fen with hardly any dry ground, and air that feels thick and ailing.",
      "Knee-high black thorn scrub across the north, and the salt crust of Brinemere in the middle of it.",
      "Half a mile off the southern shore lies a flat island of salty mud with a stand of cypress on it, silent and gloomy.",
    ],
    places: [
      { name: "Chantery Isle", kind: "the island in Brinemere and the cypress copse at its crown" },
      { name: "The Lightless Tower", kind: "three storeys of polished jet-black stone, windowless, one black doorway; no scrying reaches it, and every light dims inside" },
      { name: "Upper floor", kind: "behind a wax-sealed trapdoor glyphed by a Level 12 caster: a deadly blue vapour that pours out when it opens, and the Onyx Mirror on a basalt plinth", hidden: true },
    ],
  },
  {
    hex: "1104",
    name: "Cobton-On-The-Shiver and the Giant Egg",
    terrain: "tangled-forest",
    cost: 3,
    region: "valley-of-wise-beasts",
    lost: "2-in-6",
    page: 311,
    note: "Encounters are 2-in-6 likely to be with a patrol of 2d6 crookhorns (DMB) from the garrison at the Baron's tower (hex 1004). They patrol down into the Valley from the tower, meting out terrible and anarchic justice, and try to arrest outsiders and bring them before the Baron.",
    flavour: [
      "Woodland glades in the middle of the Valley of Wise Beasts, dotted with small Cobbin farms.",
      "The Baron's patrols reach down here too.",
    ],
    places: [
      { name: "Cobton-on-the-Shiver", kind: "the Cobbin settlement on the river" },
      { name: "The Giant Egg", kind: "the other half of the hex's name" },
    ],
    hexEncounter: [
      { chance: 2, what: "a patrol of 2d6 crookhorns from the garrison at the Baron's tower (hex 1004)", creature: "Crookhorn", number: "2d6" },
    ],
  },
  {
    hex: "1105",
    name: "Harrowmoor Keep",
    terrain: "craggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 312,
    note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    flavour: [
      "Gloomy rugged woods with jagged fingers of dark granite standing out of them, and a groaning wind off the Loch.",
      "The Groaning Loch is bottomless, cold and restless — unpredictable currents, whirlpools, and kelpies. Boats do not do well on it.",
      "Something enormous and jelly-like lives in the deep of it, roughly spherical, trailing glowing green tentacles.",
    ],
    places: [
      { name: "Harrowmoor Keep", kind: "the keep the hex is named for" },
      { name: "The Groaning Loch", kind: "deep water, whirlpools and kelpies" },
    ],
    folk: [
      { name: "The Forroth", what: "the thing in the abyss of the loch; it can be summoned, and it will talk" },
    ],
  },
  {
    hex: "1106",
    name: "Prigwort and the Swinney Tower",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 313,
    note: "Nighttime encounters on the road are 2-in-6 likely to be with the ghost of Dewidort of Smerne (see hex 0607). Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    flavour: [
      "Golden-leafed beeches swaying and sighing, their eye-like whorls following travellers past.",
      "Prigwort is here — the town, with everything a town has.",
      "On the road at night, the hanged highwayman's ghost from 0607 rides again.",
    ],
    places: [
      { name: "The Town of Prigwort", kind: "town — full description in the book" },
      { name: "The Swinney Tower", kind: "the tower the hex is named for" },
    ],
    folk: [
      { name: "Jilly Jump-at-the-Moon", what: "house bogle, a foot and a half tall, skin like knotted wood" },
    ],
    hexEncounter: [
      { chance: 2, period: "night", what: "the ghost of Dewidort of Smerne, the highwayman (see hex 0607)", way: ["road"] },
    ],
  },
  {
    hex: "1107",
    name: "The Wyrm Cave",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 314,
    flavour: [
      "Paths crossed by small streams, feeding a network of clear still pools.",
      "In the south, a mass of overgrown hazel and holly hides a chasm 60 feet deep that everyone has forgotten about.",
      "At the bottom, nearly lightless, it narrows into a passage with a stream trickling out of it — and the passage goes down for half a mile.",
    ],
    places: [
      { name: "Chasm and Lair", kind: "the hidden chasm and the passage at the bottom", hidden: true },
      {
        name: "Lair of Chasobrithe",
        kind: "the wyrm's hoard: a Fairy Longsword (Mirthful), an ivory casket worth 200gp with a Distillation of Hoarfrost and a map to the lost relics of St Jorrael in 1705",
        hidden: true,
      },
    ],
  },
  {
    hex: "1108",
    name: "Louper's Luncheon",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 315,
    flavour: [
      "Gloomy woods in indigo shadow, full of croaking frogs and toads.",
      "The woodcutters call it the Louping Wood, and you see why at once: every tree of any age has grown a complete loop in its trunk, about halfway up.",
      "Shaping trees like that was a woodcutters' craft here once. Everyone who knew how to do it is dead, and nobody can say whether the practice or the name came first.",
    ],
    places: [{ name: "The Louping Wood", kind: "the looped trees themselves" }],
    folk: [
      {
        name: "Bragwen Hoad",
        what: "witch of the Eye of Hasturiel; quarrelsome unless you talk magic, and wants her wand back from the baker in 1206",
      },
    ],
  },
  {
    hex: "1109",
    name: "Woodcutters' Encampment and Frog Isle",
    terrain: "swamp",
    cost: 4,
    region: "hags-addle",
    lost: "3-in-6",
    page: 316,
    note: "Encounters in the swamp are 2-in-6 likely to be with Father Horsely (p185) and his dog Clewyd.",
    forage: "1d4 portions of Snogglebeard (p430) and 1d2 portions of Witch's Oyster (DPB)",
    flavour: [
      "A wide stretch of black water and twisted copses under permanent rolling mist.",
      "On the edge of it, a woodcutters' settlement grown comfortable on river trade — a main stop between the High Wold, Castle Brackenwold and the south.",
      "At night a pale yellow flame burns in the tower of St Foggarty's church, visible right across the swamp. It is how lost travellers find their way in.",
    ],
    places: [
      { name: "The Woodcutters' Encampment", kind: "settlement — full description on p182" },
      { name: "Isle of the Frogs", kind: "a toppled frog-headed statue; the 5ft head is intact and its tongue cures one ailment, at a price", hidden: true },
    ],
    hexEncounter: [
      { chance: 2, what: "Father Horsely (p185) and his dog Clewyd", where: "in the swamp" },
    ],
  },
  {
    hex: "1110",
    name: "Dreg and Myrrsian's Mill",
    terrain: "tangled-forest",
    cost: 3,
    region: "high-wold",
    alsoRegion: "Aldweald",
    lost: "2-in-6",
    page: 317,
    forage: "1d4 portions of young lantern elm roots, used to brew Ofteritch (DPB)",
    flavour: [
      "Small streams winding through glades of lantern elms, whose seeds hang like lit paper lanterns.",
      "At the widest point of the Hameth sits Dreg — a port and fishing village, and another main stop on the river trade.",
      "Dreg's reputation is thieves, con men and worse, and its many inns are built for exactly that trade.",
    ],
    places: [
      { name: "Dreg", kind: "port village — full description on p140" },
      { name: "Shantywood Isle", kind: "pleasure isle in the rushing water opposite Dreg" },
      { name: "Myrrsian's Mill", kind: "the magician's mill" },
    ],
    folk: [
      {
        name: "Myrrsian the Mutable",
        what: "Level 6 magician who switches between two bodies and will insist the other one is their sibling Vyridan",
      },
    ],
  },
  {
    hex: "1111",
    name: "Nyfward",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    alsoRegion: "High Wold",
    lost: "2-in-6",
    page: 318,
    flavour: [
      "Space does not behave here. Trees and rocks are a different size after you blink, and a path you have already walked comes round again.",
      "On the river bank stands a thin, crooked, windowless stone tower, hundreds of yards high — and invisible from any distance. There is an open arch at the bottom.",
      "You can climb it forever and never reach the top. Each floor is a different size with different contents every time anyone comes back.",
    ],
    places: [
      { name: "Nyfward", kind: "the tower — a marble lion-head fountain on the ground floor, manticores reflected in the pool" },
      { name: "Upper floors", kind: "rolled fresh on each visit: a d20 special encounter and a room, dungeon level = floor number, capped at 7" },
    ],
  },
  {
    hex: "1112",
    name: "The Falls of Nyf",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 319,
    flavour: [
      "Paths crossing through beds of ferns. It all looks deliberately tended, by somebody.",
      "The Hameth drops 100 feet here in white water — one of the great sights of the region.",
      "And one of its great pieces of magic: a boat coming down from the north looks certain to be smashed, and instead is carried over the brink and set down safely below.",
    ],
    places: [
      { name: "The Falls", kind: "the 100ft drop" },
      { name: "The Wondrous Ship-Conveyor", kind: "the magic that takes boats down the falls intact" },
    ],
    folk: [
      {
        name: "Skulp",
        what: "ancient troll; welcoming, then enraged without warning. Grows moss on fresh corpses and prefers woodgrue ones",
      },
    ],
  },
  {
    hex: "1201",
    name: "Ancient Evil",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 320,
    flavour: [
      "A moaning wind that never lets up, under a sky that feels too large and not well disposed.",
      "A recently trodden trail leaves the Downs Road for a mound ringed by concentric ridges three hundred yards across, with tents and wagons camped among them.",
      "An expedition is digging into it, and has just reached a layer of carved stone.",
    ],
    places: [
      { name: "The Excavation", kind: "ten labourers, three guards and a sage; they pay 5gp a head for digging and 15gp to go and check on the teams at 1101 and 1202" },
      { name: "Kul's tomb", kind: "the day after the party arrives the workers break through — the wicker-crowned corpse crumbles in the air and her spirit comes up out of the ground screaming" },
      { name: "The Glammering Gate", kind: "a stone-lintelled portal full of pale mist in a low mound in the south-east; step through and you are on the fairy road the White Way", hidden: true },
    ],
    folk: [
      { name: "Archibald Helmwhit", what: "elderly sage in blue robes and a red smoking cap, as forgetful as he is condescending; certain of great treasure below, and untroubled by his workers' nightmares" },
    ],
  },
  {
    hex: "1202",
    name: "Mound of the Willing Sacrifice",
    terrain: "swamp",
    cost: 4,
    region: "fever-marsh",
    lost: "3-in-6",
    page: 321,
    note: "Encounters are 1-in-6 likely to be with the Willing Sacrifice.",
    flavour: [
      "Thorn trees, chest-high reeds and stinking pools — and sound here is amplified to the point of pain.",
      "On a drier patch stands a sixty-foot burial mound dappled with hanging moss, the reeds around it flattened and pointing away from it.",
      "A snarling bear's face is carved above the entrance, which is narrow enough that you go in side-on.",
    ],
    places: [
      { name: "Reception Chamber", kind: "six bodies a few days dead, faces rictus, hands clamped over bleeding ears, picks and packs beside them — the team sent out from 1201; the wall carvings tell what was done here" },
      { name: "Burial Chamber", kind: "walls scratched deeply and repeatedly over a very long time, and an eight-foot pit forty feet deep with four sealed jars at the bottom, a carved amber totem in each" },
    ],
    folk: [
      { name: "The Willing Sacrifice", what: "a grave-blackened corpse in filthy ceremonial robes, a cracked wooden bear mask strapped to her face and a turquoise glow inside her swollen belly; she comes back the moment anyone reaches the bottom of the pit" },
    ],
    hexEncounter: [
      { chance: 1, what: "the Willing Sacrifice, abroad in the reeds" },
    ],
  },
  {
    hex: "1203",
    name: "The Elder Willows",
    terrain: "tangled-forest",
    cost: 3,
    region: "valley-of-wise-beasts",
    lost: "2-in-6",
    page: 322,
    flavour: [
      "Tangled willow woods thick with vines, ditches full of rotting leaves.",
      "The River Shiver drops into the Valley of Wise Beasts here, over sheer sandstone cliffs a hundred feet high.",
      "Small caves pock the cliff faces.",
    ],
    places: [
      { name: "Longshanks Falls", kind: "the 100ft drop into the Valley, and the caves in its walls" },
    ],
    folk: [
      { name: "Scruff Gobshyte", what: "a crookhorn convicted of failing to say whether the Baron was 'wickedly handsome' or 'handsomely wicked'" },
    ],
  },
  {
    hex: "1204",
    name: "The Breath of the Kelpie",
    terrain: "craggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 323,
    flavour: [
      "Quiet, sighing woods with granite crags and cliffs standing out of them.",
      "The Groaning Loch again: fathomless, cold and unquiet, and few boats are ever seen on it.",
    ],
    places: [
      { name: "The Breath of the Kelpie", kind: "the establishment the hex is named for" },
      { name: "The Groaning Loch", kind: "the same dangerous water" },
    ],
    folk: [
      { name: "Hallyd Ongledrome", what: "the proprietor; late fifties, white hair, monocle, waistcoat and cane, and cultivates every bit of it" },
    ],
  },
  {
    hex: "1205",
    name: "Gorthstone",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 324,
    note: "Encounters are 2-in-6 likely to be with 1d4 elf knights (DMB) in the service of the Earl of Yellow (p32), clad entirely in yellow and mounted on great golden wolves (as dire wolves, DMB). Ley line crossing Hoad/Ywyr: Arcane spell-casters perceive the wailing cries of infants slowly fading into the moans of the dead, repeating in an endless cycle.",
    flavour: [
      "Golden-leafed beeches that seem to lean in and shelter travellers from the weather.",
      "The Earl of Yellow's knights ride through here, all in yellow on great golden wolves.",
      "Where the two ley lines cross, arcane casters hear babies crying, fading into the moans of the dead, over and over.",
    ],
    places: [
      { name: "Gorthstone", kind: "the standing stone the hex is named for" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d4 elf knights of the Earl of Yellow, all in yellow and mounted on great golden wolves", creature: "Elf—Knight", number: "1d4" },
    ],
  },
  {
    hex: "1206",
    name: "The Baker's Dozen",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 325,
    note: "Nighttime encounters on the road are 2-in-6 likely to be with the ghost of Dewidort of Smerne (see hex 0607).",
    flavour: [
      "Dense, unfriendly woods of twisted elm and hawthorn. Plenty of paths, most of them ending in a gloomy nothing.",
      "Half a mile south of the Horse-Eye Road, in a glade, a pretty thatched cottage.",
      "It smells of cinnamon and gingerbread from some way off.",
    ],
    places: [{ name: "The Bakery", kind: "the cottage where Mother and her twelve daughters bake" }],
    folk: [
      {
        name: "Mother",
        what: "baker, and secretly a Level 5 magician; jolly, secretive, and fanatical about her daughters. Has Bragwen Hoad's wand from 1108",
      },
    ],
    hexEncounter: [
      { chance: 2, period: "night", what: "the ghost of Dewidort of Smerne, the highwayman (see hex 0607)", way: ["road"] },
    ],
  },
  {
    hex: "1207",
    name: "Crystal Caves Around Fog Lake",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 326,
    flavour: [
      "Bog-owls booming from the undergrowth all round.",
      "Fog Lake sits in a basin and is nearly always under thick blue-white vapour.",
      "Now and again a gust from the woods clears it away completely. It comes back within half an hour.",
      "Pilgrims come here for the crystal caves — 2d6 of them a day, on the road up from the south-east.",
    ],
    places: [
      { name: "Fog Lake", kind: "the fogged basin and the crystal caves around it" },
    ],
    folk: [
      {
        name: "Duncan Mudmurloe",
        what: "Pollard's manservant from 1209, cooking Azoth on the lake shore in ever larger quantities, and miserable about it",
      },
    ],
  },
  {
    hex: "1208",
    name: "The Ballow-Clefts",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 327,
    note: "Daytime encounters are 2-in-6 likely to be with 2d6 clueless urban pilgrims (everyday mortals--DMB) on their way to the crystal caves at Fog Lake (hex 1207).",
    flavour: [
      "Boggy patches of leafy growth between sharp black boulders.",
      "The road up from the south-east drops into a rock trough so deep that the sun reaches the bottom for a few minutes at noon, if at all — and it stays that way for miles.",
      "The walls run with water and are whorled and folded, like something enormous pressed its fingers into them.",
      "Ankle-high pale flowers carpet the floor of it, despite the dark.",
    ],
    places: [{ name: "Cave Path", kind: "the sunken road to Fog Lake in 1207" }],
    folk: [
      {
        name: "Dandy Prisslewhiff",
        what: "Level 2 bard, a silver-furred grimalkin; knows the secrets of this hex and the ones around it",
      },
    ],
    hexEncounter: [
      { chance: 2, period: "day", what: "2d6 clueless urban pilgrims bound for the crystal caves at Fog Lake (hex 1207)", creature: "Pilgrim", number: "2d6" },
    ],
  },
  {
    hex: "1209",
    name: "Ferneddbole House",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 328,
    note: "Encounters at night are 1-in-6 likely to be with the Moonlit Maw (hex 1311).",
    flavour: [
      "Ponies whinnying, loose shutters clapping, and now and then a giggle from nobody.",
      "A three-storey timbered mansion so overgrown with moss you cannot make out its shape.",
      "Twenty pedigree dwarf ponies in the grounds — the owner calls them his Lovely Oafs.",
    ],
    places: [
      { name: "Moss-Coated Manse", kind: "mansion — cramped, neglected, trees growing in through the windows" },
      { name: "Portrait gallery", kind: "old Pollard family portraits, with Drunic symbols in the oldest" },
    ],
    folk: [
      { name: "Jollie Oistace Pollard", what: "chieftain of the Woodcutters' Encampment; welcoming, then spiteful after dark" },
      { name: "Mudmurloe", what: "his hapless head manservant" },
    ],
    hexEncounter: [
      { chance: 1, period: "night", what: "the Moonlit Maw, hunting out of hex 1311" },
    ],
  },
  {
    hex: "1210",
    name: "Bogwitt Manor",
    terrain: "open-forest",
    cost: 2,
    region: "aldweald",
    lost: "1-in-6",
    page: 329,
    note: "Encounters at night are 1-in-6 likely to be with the Moonlit Maw (hex 1311).",
    flavour: [
      "Wet, mossy ground, full of centipedes that get into everything.",
      "The ancestral seat of House Mulbreck, and it is rotting: cupolas and turrets under a bright crust of fungus that is eating the wood and splitting the stone.",
      "The air indoors is thick with spores. Everyone coughs.",
    ],
    places: [
      { name: "Bogwitt Manor", kind: "manor house — low wall, four towers, 14 house guards" },
      { name: "Interior", kind: "sumptuous rooms ruined by mould; Mottlecap, Devil's Grease and Witch's Purple growing in it" },
      { name: "The Tunnels", kind: "cellars below — the rot comes from down here", hidden: true },
    ],
    folk: [
      { name: "Lord Mulbreck", what: "held in the lowest cellar, so overgrown with fungus he can barely move; a conduit of the Myconom" },
    ],
    hexEncounter: [
      { chance: 1, period: "night", what: "the Moonlit Maw, hunting out of hex 1311" },
    ],
  },
  {
    hex: "1211",
    name: "The Webs of Old Aunt Spindel",
    terrain: "open-forest",
    cost: 2,
    region: "aldweald",
    lost: "1-in-6",
    page: 330,
    note: "Encounters are 4-in-6 likely to be with 1d3 giant spinning spiders (DMB). Perilous Travel The hex is a cat's cradle of rope-like spiders' webs.",
    flavour: [
      "Sticky webs strung through the whole wood, with half-rotted animals hanging in them. It smells of carrion.",
      "Permanently gloomy, and slow going.",
      "Going round the webs costs 1 extra Travel Point for anything you do here. Going through them means a Save Versus Hold or you are stuck — and then a 3-in-6 chance that 1d3 giant spinning spiders turn up within three rounds.",
    ],
    places: [
      { name: "Macabre Marionettes", kind: "a glade where twelve dead people, worked as puppets, act out a play" },
    ],
    folk: [
      { name: "Old Aunt Spindel", what: "giant spider with a woman's face; a cursed puppeteer, quite mad" },
    ],
    hexEncounter: [
      { chance: 4, what: "1d3 giant spinning spiders", creature: "Spinning Spider, Giant", number: "1d3" },
    ],
  },
  {
    hex: "1212",
    name: "The Balm Fields",
    terrain: "meadow",
    cost: 2,
    region: "tithelands",
    lost: "1-in-6",
    page: 331,
    forage: "1d3 portions of Tom-A-Merry (DPB)",
    flavour: [
      "Lush meadow that smells of summer and blossom even in the depth of winter. Full of bees and hares.",
      "The last of the wood opens out here into flat grassland. Cows, sheep and their owners wander about.",
      "On a dewy morning you may find the cows and sheep sitting up together in bonnets, having breakfast — pickled eggs, ham, tea. Their owners will be nearby, trying to put a stop to it.",
    ],
    places: [
      { name: "Picnicking Herds", kind: "the livestock, and their baffled owners" },
      {
        name: "The Golden Gazebo",
        kind: "a small octagonal gold gazebo in the east, roofed with shells and goats' horns — Princess Andromethia's mark; a visitors' book inside",
      },
    ],
  },
  {
    hex: "1301",
    name: "Shivering Bridge and the Burnt Mill",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 332,
    flavour: [
      "The river sighs and shivers through the hills like teeth chattering.",
      "A run-down wooden bridge crosses it, planks missing and dark water churning through the gaps, with crows sitting on the posts watching.",
      "A hundred yards north on the western bank stands the burnt-out shell of a mill, its waterwheel smashed on the bank.",
    ],
    places: [
      { name: "Shivering Bridge", kind: "people and mounts cross safely; a vehicle is 3-in-6 to bring it down" },
      { name: "Burnt Mill", kind: "six ghouls and a headless rider come out to meet travellers, all in decaying old-fashioned finery; the closet under the stairs holds what they have taken" },
      { name: "Cellars", kind: "thirteen charred skeletons — one staked at the centre wearing a medallion whose eye weeps blood — and a secret shelf-lined room with a black tome and dozens of pickled fingers in jars" },
    ],
    folk: [
      { name: "Jayne Turpentine", what: "the spirit of a highway robber on a spectral horse, her own dripping head in one hand and a sabre in the other; she wants murder, and she wants the miller let out" },
    ],
  },
  {
    hex: "1302",
    name: "The Vernal Chapel",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 333,
    forage: "1d3 portions of Worm-Mallow (p430)",
    flavour: [
      "Colonies of doves in the silver birches, cooing together like a psalm.",
      "In a fern-decked glade, the forsaken ruin of a chapel with its spire toppled into a heap of stones.",
      "Wild-eyed hunters watch the glade with shortbows and warn strangers off in the name of \"Queen Incantral, Lady of the Table Downs\".",
    ],
    places: [
      { name: "Ruined Chapel", kind: "the oak door is pitted with old claw marks; inside, a blood wyrm coiled around the altar over five blood-red egg sacs" },
      { name: "Chapel Crypt", kind: "her hoard heaped around an altar, seven ghouls stood paralysed mid-strike at the walls, and the lost Sword of St Sedge lying pristine on top" },
    ],
    folk: [
      { name: "Queen Incantral", what: "a mature blood wyrm, regal and near-human but for bulbous, diamond-faceted blue eyes; boastful, ferociously protective of the clutch, and vulnerable to water" },
      { name: "The Sword of St Sedge", what: "sentient and devout — the spirit of the young nun who died guarding it; it wants the saint's lost shield and helm found, and the helm is in 0408" },
    ],
  },
  {
    hex: "1303",
    name: "The Woodwind Trees",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 334,
    flavour: [
      "Melodies drift through the wood, in harmony with the River Shiver babbling along beside them.",
      "The trees here have leaves from bright pink to reddish-violet, and their trunks and branches are honeycombed with inch-wide holes. That is where the music comes from.",
      "In the largest of them, five wicker spheres hang from the branches like giant fruit, strung together by rickety rope bridges.",
    ],
    places: [
      { name: "Woodwind Trees", kind: "the holed trees that play in the wind" },
      { name: "Treehouse", kind: "five wicker spheres in the biggest tree, joined by rope bridges" },
    ],
  },
  {
    hex: "1304",
    name: "The Hall of Sleep",
    terrain: "craggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 335,
    forage: "1d6 portions of Fenob (DPB)",
    flavour: [
      "Sandstone crags worn — or cut — into strange shapes like gesturing hands. A cool wind off the Loch.",
      "On the northern bank the waves lap at something forlorn.",
      "Nobles are sleeping in the hall here, and they are guarded.",
    ],
    places: [
      { name: "The Hall of Sleep", kind: "where the sleeping nobles lie" },
      { name: "Sleep-Wardens", kind: "the honour guard, in ornamental plate painted with blue flowers; they turn unwanted visitors away" },
    ],
  },
  {
    hex: "1305",
    name: "The Ravine of the Stag Lord",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 336,
    note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    flavour: [
      "Ferns grown far above head height.",
      "In the trackless east of the hex, deer paths lead down to a hidden ravine. Ledges wind to the bottom, where the folded rock makes a natural amphitheatre.",
      "On new moon nights 3d6 stags come down those paths — which only they know — to the chasm floor.",
    ],
    places: [
      { name: "Ravine of the Stag Lord", kind: "the amphitheatre at the bottom" },
      { name: "New Moon Nights", kind: "what gathers there, and a 2-in-6 chance of what comes with them" },
    ],
  },
  {
    hex: "1306",
    name: "The Dung Heap and the Grey Monolith",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 337,
    note: "Encounters are 2-in-6 likely to be with either 1d6 woodgrues (DMB) on their way to the dung heap, or 1d4 elf knights (DMB) of the Earl of Yellow (p32) — all in yellow, on great golden wolves. Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    forage: "1d2 portions of Arrowhame (DPB)",
    flavour: [
      "Old moss-grown way-stones set beside the paths at regular intervals.",
      "Two things bring traffic through here: something the woodgrues are walking to, and the Earl of Yellow's knights, who ride golden wolves and dress entirely in yellow.",
    ],
    places: [
      { name: "The Dung Heap", kind: "what the woodgrues are coming for" },
      { name: "The Grey Monolith", kind: "the standing stone the hex is named for" },
    ],
    hexEncounter: [
      { chance: 2, what: "either 1d6 woodgrues on their way to the dung heap, or 1d4 elf knights of the Earl of Yellow — all in yellow, on great golden wolves" },
    ],
  },
  {
    hex: "1307",
    name: "The Refuge of St Keye",
    terrain: "open-forest",
    cost: 2,
    region: "aldweald",
    lost: "1-in-6",
    page: 338,
    flavour: [
      "Wide glades of old beech and oak, loud with songbirds.",
      "Two miles from the forest edge, an old stone building by the road — well kept, but bare.",
      "Over the oak door, in red calligraphy: The Refuge of St Keye — Pilgrims Welcome.",
    ],
    places: [
      {
        name: "Wayside Monastery",
        kind: "inn — monastic cells at 2sp a night, meals with caraway buns, dinner not after eight; Keye's Balm at 1sp a pint",
      },
    ],
    folk: [
      { name: "Abbot Wiston Spatulard", what: "sixties, run to fat on his own ale; moralises without much conviction" },
    ],
  },
  {
    hex: "1308",
    name: "Scoyfe's Mire",
    terrain: "open-forest",
    cost: 2,
    region: "aldweald",
    lost: "1-in-6",
    page: 339,
    flavour: [
      "Trees shaggy with hanging yellow moss. Vapour sits at head height and you cannot see far.",
      "In the north the ground drops into puddles and tussocks, and there is a pond about 35 feet across, wholly covered in lily pads.",
      "Sickly orange flowers ring it, every one of them turned to face the middle of the water.",
      "Linger there and two figures rise slowly out of the centre.",
    ],
    places: [
      { name: "Noisome Pond", kind: "the lily pond; 1,000gp lies on the bottom near a burst sack", hidden: true },
      { name: "The Hoary Gate", kind: "two 10ft pillars at the centre of the hex" },
    ],
    folk: [
      {
        name: "The Scoyfe",
        what: "two corpse-like men, one riding the other's back, draped in lilies and mire water; they will chase you a mile",
      },
    ],
  },
  {
    hex: "1309",
    name: "Thirligrewe's Orchard",
    terrain: "open-forest",
    cost: 2,
    region: "aldweald",
    lost: "1-in-6",
    page: 340,
    flavour: [
      "Pleasant woods hung with ivy. Sheep and pigs rooting about in the glades.",
      "A small walled orchard with a two-storey cottage leaning hard to one side — the weight of the books inside it.",
      "The crab apples at the back are mauve. Cider made from them works as Sandor's Phantasmal Elixir, one dose a pint.",
    ],
    places: [
      { name: "Thirligrewe's Orchard", kind: "orchard and cottage, property of Castle Brackenwold" },
      { name: "The Roost", kind: "inn — a treehouse in three old beeches, half a mile off, on Camp Road" },
      { name: "Weighty tomes", kind: "an hour's searching her books turns up four arcane scrolls", hidden: true },
    ],
    folk: [
      { name: "Thirligrewe Hangman", what: "orchard tender; fetches help from the Roost if you steal apples" },
      { name: "Zoemina Ladle", what: "landlady of the Roost" },
    ],
  },
  {
    hex: "1310",
    name: "The Lodge of Granny Wolfsbane",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 341,
    note: "Lost/encounters 2-in-6. If the d8 says the encounter is a Monster, roll it again.",
    flavour: [
      "Bleached animal skulls nailed to the tree trunks.",
      "Very quiet — no birds, no animals, as if everything were holding its breath.",
      "One painted wooden cabin with flowerbeds, smoke from the chimney and something good cooking. Barred windows and a barred door.",
    ],
    places: [
      { name: "Wooden Lodge", kind: "cabin — she greets callers with a crossbow" },
      { name: "Main room", kind: "her kill trophies, a weapon rack, dried Wolfsbane" },
      { name: "Back room", kind: "off limits — a potion brewing, 1,218gp in a locked box", hidden: true },
    ],
    folk: [{ name: "Granny Wolfsbane", what: "retired monster-hunter, and a werewolf herself" }],
    rerollTypes: ["monster"],
  },
  {
    hex: "1311",
    name: "The Wolfweald",
    terrain: "meadow",
    cost: 2,
    region: "tithelands",
    lost: "1-in-6",
    page: 342,
    note: "Encounters at night are 4-in-6 likely to be with the Moonlit Maw.",
    flavour: [
      "By day: quiet rolling meadows with groves of dark pine and damp hollows. Sheep, and a few weather-beaten shepherds.",
      "Bodies turn up now and then — animals and travellers, faces frozen in terror, rotting very slowly, left alone by flies and worms.",
      "Ask the shepherds about them and they will not talk. They say only: go and tell Granny Wolfsbane, in 1310.",
      "At night mist pools in the hollows and something enormous howls from dusk to dawn.",
    ],
    places: [
      { name: "By Day", kind: "pasture, shepherds, and the occasional corpse" },
      { name: "At Night", kind: "mist, deep shadow, and the howling" },
    ],
    folk: [
      { name: "The Moonlit Maw", what: "ghost of a werewolf; eats spirits, not flesh. Hunts here and in 1209 and 1210. Only magic or silver harms it" },
    ],
    hexEncounter: [
      { chance: 4, period: "night", what: "the Moonlit Maw itself" },
    ],
  },
  {
    hex: "1312",
    name: "Andromethia's Blossom Fields",
    terrain: "meadow",
    cost: 2,
    region: "tithelands",
    lost: "1-in-6",
    page: 343,
    flavour: [
      "Acres of wildflower in broad bands of colour, against the dark forest to the north-west.",
      "Bluebell, white and yellow daisies, harebell, magenta corncockle through cow parsley, foxglove in the bracken. The air is sweet with it.",
      "The fields look wild but paths run through them, and somebody has been keeping them clear.",
      "Fairies and demi-fey catch a shimmer at the edge of vision: another reality lying over this one.",
    ],
    places: [
      { name: "Blossom Fields", kind: "the meadows themselves, and the tended paths" },
      { name: "A Century of Slumber", kind: "what the fairy realm here does to a visitor's time", hidden: true },
    ],
    folk: [{ name: "Princess Andromethia", what: "fairy princess whose realm overlaps this hex" }],
  },
  {
    hex: "1401",
    name: "Fresh Graves",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 344,
    note: "Nighttime encounters are 3-in-6 likely to be with Grinstead, accompanied by 1d6 wolves (DMB).",
    flavour: [
      "A weak wind carrying the cries of wolves somewhere off in the hills.",
      "A mile south of the Downs Road, a lonely graveyard behind crumbling walls: ten graves, all freshly churned, headstones cut with scripture and no names.",
      "Only one of them has anything in it — a young man, killed days ago.",
    ],
    places: [
      { name: "Parr's Ruin", kind: "a collapsed farmhouse with one room made habitable again, new door and shutters, camping gear and a bundle of religious texts by the bedroll" },
      { name: "Cellar", kind: "stinking of rot, blood dried on the walls, and a jagged opening into a warren of wolf dens that come out among the hills; a locked chest in one of them under 1d6+1 wolves" },
    ],
    folk: [
      { name: "Sister Wilfrinda Parr", what: "a friar held captive here and made to consecrate the bodies so they can be dug up and eaten; she warns travellers off before dark without telling them why" },
      { name: "Grinstead", what: "an undead noble who can feed only on the properly buried; he works the road at night and gives his victims' mounts to the wolves" },
    ],
    hexEncounter: [
      { chance: 3, period: "night", what: "Grinstead the necrophage, with 1d6 wolves" },
    ],
  },
  {
    hex: "1402",
    name: "Mai-Fleur's Unicorn-Hunting Grounds",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 345,
    note: "Encounters are 1-in-6 likely (2-in-6 likely at night) to be with a Wild Hunt (see hex 1502) in pursuit of 1d4 blessed unicorns (DMB).",
    forage: "1d3 portions of Sallow Parsley (DPB)",
    flavour: [
      "Holly trees in profusion, red-berried through the autumn.",
      "The Duke's blessed unicorns live here as stock for his hunts; they cannot leave the grounds, and their own teleporting has been magicked shut.",
      "Near the centre, a pool of glittering water with unicorns drinking at it and gamekeepers standing about nearby, uncomfortably.",
    ],
    places: [
      { name: "The Silver Pool", kind: "drinking heals 1d6+1, and costs a mortal a save against turning Lawful; poachers out of Odd watch from the trees hoping the keepers stray" },
      { name: "The Dungle-Crack", kind: "a ten-foot chasm with no bottom in sight; put a hand more than a foot into it and all of you goes to the fairy road the Narrow Way" },
      { name: "The Shrine to St Torphia", kind: "a wayside shrine carried fifty feet up an oak as the tree grew under it, its obsidian statue thirty feet higher still; put back together, praying grants Remove Poison", hidden: true },
    ],
    folk: [
      { name: "Gamekeepers", what: "monstrous black oaks with slitted red eyes, dormant until a poacher interferes with their charges" },
    ],
    hexEncounter: [
      { chance: 1, period: "day", what: "a Wild Hunt (hex 1502) in pursuit of 1d4 blessed unicorns" },
      { chance: 2, period: "night", what: "a Wild Hunt (hex 1502) in pursuit of 1d4 blessed unicorns" },
    ],
  },
  {
    hex: "1403",
    name: "Odd and the War of the Sprites",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 346,
    flavour: [
      "Trees hung with small glowing flowers in ochre, lilac and mauve.",
      "The village of Odd sits in a glade around a low grassy knoll: thatched huts, animal pens, about ninety people, under House Guillefer.",
      "Two sprite tribes are at war here, and each will tell you at length what the other did — there is a whole table of accusations.",
    ],
    places: [
      { name: "The Village of Odd", kind: "ninety folk under House Guillefer" },
      { name: "Indignities and Insults", kind: "the d6 of what each tribe accuses the other of" },
    ],
  },
  {
    hex: "1404",
    name: "The Merrovore and the Glaring Pylon",
    terrain: "boggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 347,
    note: "Encounters are 2-in-6 likely to be with the merrovore. Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    forage: "2d6 portions of the climbing vine known as Black Clover (p430)",
    flavour: [
      "Forlorn tracks and fern-filled glades, with milk-white climbing vines through them.",
      "The merrovore is out here, and you are as likely to meet it as anything else.",
    ],
    places: [
      { name: "The Glaring Pylon", kind: "the pylon the hex is named for" },
    ],
    folk: [
      { name: "The Merrovore", what: "what the hex is named for, and 2-in-6 of every encounter here" },
    ],
    hexEncounter: [
      { chance: 2, what: "the merrovore" },
    ],
  },
  {
    hex: "1405",
    name: "Orbswallow and the Nutcap Colonies",
    terrain: "fungal-forest",
    cost: 2,
    region: "mulchgrove",
    lost: "1-in-6",
    page: 348,
    note: "Encounters are 2-in-6 likely to be with 2d6 nutcaps (DMB), fluttering around nest-like platforms of woven bark amid the branches of a grove of silver birch.",
    forage: "1d4 portions of Devil's Grease (p428) and 1d4 portions of Blood Canker (DPB)",
    flavour: [
      "A jumble of giant woody toadstools in every colour, and tall finger-like fungus between them.",
      "In a grove of silver birch, nutcaps flutter round nest-platforms woven out of bark.",
    ],
    places: [
      { name: "Orbswallow", kind: "the place the hex is named for" },
      { name: "The Nutcap Colonies", kind: "the bark platforms in the birches" },
    ],
    hexEncounter: [
      { chance: 2, what: "2d6 nutcaps, fluttering about their woven bark platforms in a grove of silver birch", creature: "Nutcap", number: "2d6" },
    ],
  },
  {
    hex: "1406",
    name: "The Golden Wood",
    terrain: "boggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 349,
    note: "Encounters are 2-in-6 likely to be with 1d4 elf knights (DMB) in the service of the Earl of Yellow (p32), clad entirely in yellow and mounted on great golden wolves (as dire wolves, DMB). Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    forage: "1d4 portions of Knobbled Mandrake (p430)",
    flavour: [
      "By day, tiny gold sparks drift down out of the air onto the ground.",
      "At night it runs the other way: soft green motes rise up out of the earth into the sky.",
      "Wet going, and easy to lose your way in.",
    ],
    places: [{ name: "The Golden Wood", kind: "the wood itself, and whatever the motes are" }],
    hexEncounter: [
      { chance: 2, what: "1d4 elf knights of the Earl of Yellow, all in yellow and mounted on great golden wolves", creature: "Elf—Knight", number: "1d4" },
    ],
  },
  {
    hex: "1407",
    name: "The Henchgate",
    terrain: "meadow",
    cost: 2,
    region: "tithelands",
    lost: "1-in-6",
    page: 350,
    flavour: [
      "Clouds of black midges overhead, coming down at you in waves.",
      "Flat plains and farmland around Castle Brackenwold — you can see it on its hill to the south-east — giving way to the forest proper.",
      "Where the Horse-Eye Road goes into the trees stands a natural arch, the Henchgate, straddling the road.",
      "The faces in it speak. They greet travellers by name in Woldish and wish them well, will chat about the weather, and only smile at you if you ask them anything.",
    ],
    places: [
      { name: "Horse-Eye Road", kind: "major trade route; runs the forest edge and plunges in at the north-west corner" },
      { name: "The Henchgate", kind: "the natural gateway over the road, and the faces in it" },
    ],
  },
  {
    hex: "1408",
    name: "Moriggan's Crag",
    terrain: "farmland",
    cost: 2,
    region: "tithelands",
    lost: "1-in-6",
    page: 351,
    flavour: [
      "Windswept fields of crops and scarecrows. Completely flat, apart from one enormous rock.",
      "The Crag is 100 yards high and nearly 200 across, flat on top and jagged at the sides, south of Camp Road and visible for miles.",
      "Ferns, moss and silver-leafed oaks grow all over it. A stair — part cut into the rock, part hanging bridge — winds halfway round and comes out on top at the south side.",
    ],
    places: [
      { name: "Moriggan's Crag", kind: "the rock; 1d6 cragwardens on the summit at any hour" },
      {
        name: "Summer Solstice",
        kind: "on the 18th of Chysting locals light fires on top and dance all night — and the guards stop paying attention",
      },
    ],
  },
  {
    hex: "1409",
    name: "The Stinking Mausoleum",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 352,
    flavour: [
      "Beech and hazel, the ground covered in nut husks.",
      "The whole hex stinks of carrion. You can follow your nose to the source.",
      "A ring of collapsed stone buildings round a tiled courtyard, with an eye-ringed-with-thorns carved over and over into the stone.",
    ],
    places: [
      { name: "The Stinking Mausoleum", kind: "ruins — a white-tiled courtyard with one clear stairway down" },
      { name: "The Crypts", kind: "tunnels below the courtyard", hidden: true },
      { name: "The Central Hall", kind: "200ft domed hall — 2,000sp, 3,000gp, six torcs at 1,200gp, a Staff of Darkness", hidden: true },
    ],
    folk: [
      { name: "The Descendant", what: "a huge, hideous thing sprawled asleep on the hoard; wakes to light or voices" },
    ],
  },
  {
    hex: "1410",
    name: "The Singing Spring",
    terrain: "meadow",
    cost: 2,
    region: "tithelands",
    lost: "1-in-6",
    page: 353,
    note: "Encounters are 2-in-6 likely to be with 1d4 cockatrices (DMB) from the Cockatrice Nest.",
    forage: "1d2 portions of Writhing Mandrake (p430)",
    flavour: [
      "Rough, knee-high grass on gently sloping meadow, crawling with insects.",
      "In the north-west, near the forest edge, wet ground cut by little brooks — frogs, mosquitoes.",
      "Walk through it and you start to hear singing on the wind. Follow it and it leads to the spring.",
    ],
    places: [
      { name: "Buzzing Wetlands", kind: "brooks and marsh where the singing is first heard" },
      { name: "The Singing Spring", kind: "what the song leads to" },
      { name: "The Cockatrice Nest", kind: "twenty cockatrices in old hazels, ringed with petrified victims; 8 eggs at up to 400gp each, plus 600gp and 2,100sp of trinkets" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d4 cockatrices out of the Cockatrice Nest", creature: "Cockatrice", number: "1d4" },
    ],
  },
  {
    hex: "1501",
    name: "The Ruins of Chancton",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 354,
    flavour: [
      "Faint lines of old pathways criss-cross the hills — somebody lived up here once.",
      "The Downs Road comes down a slope through a cluster of ruined buildings around a rocky pool. No church anywhere, and no graveyard.",
      "Intact skeletons stand about the ruins posed in the middle of ordinary work — a wheelbarrow, a roof, a bucket at the pool. Speak aloud and they get up.",
    ],
    places: [
      { name: "Ruined Hamlet", kind: "a thousand years in ruins; the thirty skeletons welcome visitors to \"Chancton\", serve empty plates of stew, and hold a barn dance in the evening" },
      { name: "Healing Spring", kind: "the pool at the centre; a Lawful bather is cured of a disease or healed 1d6+1, and the dead, sadly, get nothing from it" },
    ],
  },
  {
    hex: "1502",
    name: "Duke Mai-Fleur's Hunting Lodge",
    terrain: "hilly-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 355,
    note: "Encounters are 1-in-6 likely (2-in-6 likely at night) to be with a Wild Hunt mustering in the woods around the lodge.",
    forage: "1d4 portions of Gillywort (DPB)",
    flavour: [
      "Rugged knolls dense with holly, and hunting horns sounding somewhere out on the wind.",
      "Two great oaks stand facing each other on a tall hill, a rearing unicorn carved into each living trunk.",
      "Blow a horn there and a shimmering blue mist fills the space between them; walk into it and you are on the Duke's own road.",
    ],
    places: [
      { name: "The Unicorn Gate", kind: "the two carved oaks and the mist that comes up between them" },
      { name: "Duke Mai-Fleur's Hunting Lodge", kind: "a two-storey wooden lodge under a blanket of moss; step onto the porch and the moss peels back off a black door glyphed by a Level 14 caster", hidden: true },
      { name: "Trespassers", kind: "the trophies come off the walls: three bears and two blessed unicorns, morale 12, immune to poison and mind magic" },
    ],
    folk: [
      { name: "Duke Mai-Fleur", what: "half-elf lord crowned with holly and ivy, a burning sunset in his eyes; the finest hunter in Dolmenwood, and looking for game worth the name" },
      { name: "The Wild Hunt", what: "fairy hounds, elf wanderers afoot and mounted, woodgrue horn-blowers and centaurs; they draw no distinction between their quarry and whoever is in the way" },
    ],
    hexEncounter: [
      { chance: 1, period: "day", what: "a Wild Hunt mustering in the woods around the lodge" },
      { chance: 2, period: "night", what: "a Wild Hunt mustering in the woods around the lodge" },
    ],
  },
  {
    hex: "1503",
    name: "Mai-Fleur's Fox-Hunting Grounds",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 356,
    note: "Encounters are 1-in-6 likely (2-in-6 likely at night) to be with a Wild Hunt (see 1502) in pursuit of 2d6 fairy foxes.",
    forage: "1d3 portions of Oddy Sorrel (p430)",
    flavour: [
      "Tree trunks covered in whorls and holes that look far too much like eyes and mouths.",
      "A hundred silver-furred fairy foxes are kept here as game, and they have views about it.",
      "They trap the woods: crossing is a 1-in-2 chance of being snared and yanked twenty feet into the air, with half a dozen of them along directly.",
    ],
    places: [
      { name: "Trapping the Trappers", kind: "the foxes' nets and snares; navigating around them knowingly adds a Travel Point to everything done in the hex" },
      { name: "Fairy Fox Dens", kind: "burrows all through the hex, passable only by something three feet or under: sandy tunnels, cosy lounges, straw nests, larders of hanging game, and gems in every one", hidden: true },
    ],
    hexEncounter: [
      { chance: 1, period: "day", what: "a Wild Hunt (hex 1502) in pursuit of 2d6 fairy foxes" },
      { chance: 2, period: "night", what: "a Wild Hunt (hex 1502) in pursuit of 2d6 fairy foxes" },
    ],
  },
  {
    hex: "1504",
    name: "The Barrow Bog",
    terrain: "boggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 357,
    note: "Use the Table Downs regional encounter table here instead of the Aldweald one. Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    flavour: [
      "Waterlogged ground and stunted twisted trees under permanent mist, and it is eerily quiet.",
      "Ancient burial mounds stand in the bog.",
      "Encounters here read the Table Downs column, not the Aldweald one.",
    ],
    places: [
      { name: "Ancient Burial Mounds", kind: "the barrows the bog is named for" },
    ],
    encounterRegion: "table-downs",
  },
  {
    hex: "1505",
    name: "The Upper Brain of the Myconom",
    terrain: "fungal-forest",
    cost: 2,
    region: "mulchgrove",
    lost: "1-in-6",
    page: 358,
    forage: "1d6 portions of Rotting Mazegill (p428) and 1d4 portions of Grinning Jenny (p428), in addition to the normal results, which are always fungi.",
    flavour: [
      "Huge pale toadstools swaying without much wind. Glistening fungal parasites strangling the rotting trees and undergrowth.",
      "The air carries spore clouds, and breathing them in has consequences.",
    ],
    places: [
      { name: "Spore Clouds", kind: "what fills the air, and what infestation does to a character" },
      { name: "The Upper Brain", kind: "the part of the Myconom that thinks here" },
    ],
  },
  {
    hex: "1506",
    name: "The Ticking Wood",
    terrain: "fungal-forest",
    cost: 2,
    region: "mulchgrove",
    lost: "1-in-6",
    page: 359,
    forage: "1d4 portions of Angel's Lament (p428) and 1d4 portions of Velvet Flounder (p428)",
    flavour: [
      "Huge fungal lattices in many colours, strung between the branches of crooked oaks.",
      "Under the ordinary noises of the wood there is a quiet, steady ticking.",
    ],
    places: [
      { name: "Quiet Ticking", kind: "the sound, and what is making it" },
    ],
    folk: [
      { name: "Briglomb the Clockworker", what: "ancient mossling, four feet tall and gnarled" },
    ],
  },
  {
    hex: "1507",
    name: "Norstone",
    terrain: "boggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 360,
    note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    flavour: [
      "Endless watery ditches and mud-choked paths. Slow, maddening going.",
      "Deep in the quiet beech woods there is a wide glade full of sighing grass — dreamy and welcoming, and at the same time somehow forbidding.",
      "Arcane casters and fairies feel there is something wrong with it.",
    ],
    places: [{ name: "The Unearthly Glade", kind: "the nodal glade, and whatever is wrong with it" }],
    folk: [
      {
        name: "Morthgwail",
        what: "an Audrune in the night-black cloak of his order; lives rough around the glade, eccentric and quick to rage",
      },
    ],
  },
  {
    hex: "1508",
    name: "Castle Brackenwold and Monarch's Hill",
    terrain: "farmland",
    cost: 2,
    region: "tithelands",
    lost: "1-in-6",
    page: 361,
    flavour: [
      "Tilled fields with farms and hamlets scattered through them. Old stones with worn way-markings stand along the roads.",
      "The castle and keep of the Dukes of Brackenwold look down on the southern edge of the wood from a steep rocky hill, with a large town spread out below.",
      "An outer wall rings the lower quarters; a second wall guards the Inner City with its markets, courts and schools.",
    ],
    places: [
      { name: "Castle Brackenwold", kind: "capital of the Duchy — full description in the book" },
      { name: "Monarch's Hill", kind: "the barrow the Grey King keeps, and the fairy road it opens onto", hidden: true },
    ],
    folk: [
      {
        name: "The Grey King",
        what: "shade of a mortal king made warden of the fairy road; civil, and violent if you cross him at the barrow",
      },
    ],
  },
  {
    hex: "1509",
    name: "The Deceiver's Well",
    terrain: "farmland",
    cost: 2,
    region: "tithelands",
    lost: "1-in-6",
    page: 362,
    flavour: [
      "Farmland, loud with milkmaids and livestock.",
      "At a big crossroads there is a cobbled market square, busy with trading, gossip and drinking.",
      "The crowd is thickest around a run-down stone well in the middle of it.",
    ],
    places: [
      {
        name: "Shankswell Cross",
        kind: "market — fresh rations, poultry, livestock, cider at 1sp a pint, basic gear; and the rumour of the day",
      },
      {
        name: "Hawalyeer's Cave",
        kind: "under the well: 32 bloodstones at 50gp each and an Arcane Dagger (Lying); an underground waterway lets her escape",
        hidden: true,
      },
    ],
    folk: [
      {
        name: "Hawalyeer",
        what: "an atacorn living in the cave below, among her hoard of animal bones and broken toys",
      },
    ],
  },
  {
    hex: "1601",
    name: "The Slumbering Giant",
    terrain: "hilly-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 363,
    flavour: [
      "Steep bramble-clad hills with quiet pools between them where the woodland animals drink.",
      "In the north-east the mossy ground quivers and a rank, whistling wind moves the trees. It is breath.",
      "A two-hundred-foot giant lies on his back under moss and lichen, small trees growing on his belly, his hair spread across the forest floor and stirring on its own.",
    ],
    places: [
      { name: "The Slumbering Giant", kind: "asleep several centuries; climbing on him or hurting him is 2-in-6 to wake him, and coming within ten feet of his nose is a save or ill for 1d6 Turns" },
      { name: "Harvesting Treasures", kind: "the hair works as a Rope of Climbing for a week, Shaggy Sage grows under his nails and the clods between his toes are Mawbarg's Jam — every attempt rolls for whether he stirs" },
    ],
    folk: [
      { name: "Fergus the Famished", what: "the last true giant in Dolmenwood and a stunted one by his ancestors' measure; wakes furious and starving, and means to settle both at once" },
    ],
  },
  {
    hex: "1602",
    name: "The Hill of Henlann",
    terrain: "hilly-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 364,
    note: "Encounters are 3-in-6 likely to be with 1d3 witches--eyes of Hasturiel (DMB) on pilgrimage here.",
    flavour: [
      "Paths winding up and around rough hills dotted with wonky cairns.",
      "A low hill ringed with dense thorn trees near the centre is sacred to the witches. Climbing it dries a man's throat until he can barely get a word out.",
      "At the crest: a massive white marble urn, and thirty-five skulls around it, weathered bone-white and mostly jawless, their crowns painted with red clay signs.",
    ],
    places: [
      { name: "Skulls Atop the Hill", kind: "thirty-five corpses buried to the neck; look at the markings and you see yourself burning alive for a moment" },
      { name: "Augury of the Dead", kind: "the dead can report on anything happening in Dolmenwood, in a whispered chorus — the price is 800gp or more in the urn, and Hasturiel itself can be addressed the same way" },
      { name: "The Rosy Gate", kind: "a cave mouth in a valley bottom tangled with wild roses, birdsong and summer air coming out of it; cross the threshold and you are on Buttercup Lane", hidden: true },
    ],
    hexEncounter: [
      { chance: 3, what: "1d3 witches — eyes of Hasturiel — on pilgrimage to the hill", creature: "Witch", number: "1d3" },
    ],
  },
  {
    hex: "1603",
    name: "Endstone and the Embalmed Hamlet",
    terrain: "boggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 365,
    note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    flavour: [
      "Soft, pungent ground littered with blight-mottled leaves, and sickly boughs heavy with swollen fungi.",
      "A mile north of Follyegg Road, rickety buildings stand on stilts over the bog under moss and lichen, with shadows moving inside.",
      "Twenty-one dead people live there. They are shy rather than hostile, and they run a still.",
    ],
    places: [
      { name: "The Hamlet of the Embalmed", kind: "stilt houses, peat baths on the outskirts, and a crude distillery; their whiskey makes a corpse talk for a minute, and they trade a bottle a week — fur garments from Odd for preference" },
      { name: "Endstone", kind: "a fifteen-foot monolith of grey-green rock veined with crimson, half a mile off in the brush; anyone dying within a mile of it gets up again, and its runes teach Animate Dead", hidden: true },
    ],
    folk: [
      { name: "Bertha Bogborn", what: "five centuries dead, blackened and reeking of whiskey, and in charge; she offers two bottles to anyone who kills the Audrune for good, which only works away from the stone" },
      { name: "The Audrune Mathonwy", what: "gaunt, in matted badger fur with knives and spear-hafts still in him; killed many times and always back, hating what the stone made him and wanting the hamlet burned" },
    ],
  },
  {
    hex: "1604",
    name: "Blackeswell and the Drowning Pool",
    terrain: "boggy-forest",
    cost: 4,
    region: "mulchgrove",
    lost: "3-in-6",
    page: 366,
    note: "Encounters are 2-in-6 likely to be with 1d8 toad-children wandering abroad.",
    forage: "1d4 portions of Witch's Purple (p428)",
    flavour: [
      "Dismal grey trees dripping in the mist, with giant white toadstools pushing in from the south.",
      "Toad-children wander about out here.",
    ],
    places: [
      { name: "Blackeswell", kind: "the settlement the hex is named for" },
      { name: "The Drowning Pool", kind: "the other half of the name" },
    ],
    hexEncounter: [
      { chance: 2, what: "1d8 toad-children wandering abroad", number: "1d8" },
    ],
  },
  {
    hex: "1605",
    name: "The Fungal Chasm",
    terrain: "fungal-forest",
    cost: 2,
    region: "mulchgrove",
    lost: "1-in-6",
    page: 367,
    forage: "1d3 portions of Mossmulch (p428) or Wallowmost (DPB), in addition to the normal results, which are always fungi.",
    flavour: [
      "Rubbery antler fungi in black and deep purple tower over your head, dripping sheets and strands of orange slime.",
      "Hundreds of small fungal humanoids — holbies — live down in the chasm.",
    ],
    places: [
      { name: "The Fungal Chasm", kind: "the chasm and the holbies in it" },
      { name: "Dripping Slime", kind: "what comes off the antler fungi overhead" },
    ],
  },
  {
    hex: "1606",
    name: "The Whispering Caves",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 368,
    flavour: [
      "Pleasant beech wood with heaps, mounds and spires of sandstone through it.",
      "In a hillock at the middle of the hex, caves worn into the stone by long-gone water.",
      "Nobody lives in them. They are full of echoing, hissing mockeries of human conversation — a d6 table of what you overhear.",
    ],
    places: [
      { name: "The Whispering Caves", kind: "the empty caves, and what they say" },
    ],
  },
  {
    hex: "1607",
    name: "The Wandering Friars",
    terrain: "open-forest",
    cost: 2,
    region: "aldweald",
    lost: "1-in-6",
    page: 369,
    note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.",
    flavour: [
      "Old hazel and beech coppices, and an enormous number of very curious squirrels.",
      "Twelve friars in severe black hooded robes make their slow way through the trees, chanting in Liturgic — badly, if you happen to speak it.",
      "Speak to them and they stop. What happens next is either a blessing or a curse.",
    ],
    places: [
      { name: "Friars' Boon", kind: "+1 to attack, damage and Morale for a day, and you may join the procession" },
      { name: "Friars' Curse", kind: "doubled over in pain, and a permanent −1 to attack" },
    ],
    folk: [{ name: "The Wandering Friars", what: "twelve of them, chanting their way through the wood" }],
  },
  {
    hex: "1608",
    name: "The Bad Apples",
    terrain: "farmland",
    cost: 2,
    region: "tithelands",
    lost: "1-in-6",
    page: 370,
    flavour: [
      "Windmills, wheat, coppiced lanes and duckponds.",
      "A side-road off King's Road, with a weather-beaten sign: CIDERY ROAD — Home to the Famed and Esteemed Titheland Cider.",
      "It runs for miles past orchards and farmhouses. The trees stand in close sinuous rows, up to their trunks in rotting apples, and there is nobody working them.",
      "The apples are small, oxblood red and syrupy. A mortal who eats one must Save Versus Doom.",
    ],
    places: [
      { name: "Cidery Road", kind: "the side-road and its orchards" },
      { name: "Apple orchards", kind: "unworked rows in mounds of rot; the fruit is dangerous to mortals" },
    ],
    folk: [
      {
        name: "Demozel Hazel",
        what: "elf courtier in a necklace of pigs' teeth the pigs gave her; wants to smell nightmares and argue philosophy with the local pigs",
      },
    ],
  },
  {
    hex: "1701",
    name: "The Grimalkin's Revenge",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 371,
    note: "Encounters are 2-in-6 likely to be with Hilda, furtively travelling between the Ogre Lair and the Secret Cave.",
    forage: "1d6 portions of Groaning Mandrake (p430)",
    flavour: [
      "Grinning faces keep forming in tussocks, clouds and puddles, and are gone the moment you look straight at them.",
      "Along the Downs Road you come on a grimalkin pacing in a circle, muttering to herself.",
      "Her whole litter was killed and eaten by ogres. She has tracked them to a cave in a nearby hill, and she wants help.",
    ],
    places: [
      { name: "The Ogre Lair", kind: "a foul, bone-choked cave in a bare hillside above the road with a stubby chimney on top; seven ogres, and a hole under the maggoty furs holding sapphires and a golden locket" },
      { name: "The Secret Cave", kind: "a mile off: one grimalkin kitten, canisters of dead mice and a few crude wooden toys", hidden: true },
    ],
    folk: [
      { name: "Prissy Longtail", what: "the grimalkin; her plan has the party distracting the ogres while she comes down the chimney, and she will not actually join in until four of them are down" },
      { name: "Hilda", what: "the ogres' human daughter, gentle and out of place among them; she saved one kitten and is raising it in the secret cave, and would hand over the family's treasure as wergild" },
    ],
    hexEncounter: [
      { chance: 2, what: "Hilda, moving furtively between the Ogre Lair and the Secret Cave" },
    ],
  },
  {
    hex: "1702",
    name: "The Balming Grove",
    terrain: "hilly-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 372,
    note: "Encounters are 3-in-6 likely to be with 2 deorling stags (DMB) and 1d6+1 deorling does (DMB). The stags duel each other over breeding rights with one of the does, who observes and judges the fight.",
    flavour: [
      "Milky fungal puddles and towering lichen-coated firs, the bark shredded low down where something has been at it.",
      "Deorlings gather in these hills — duelling over breeding rights and keeping the rites of their Wood God.",
      "In the north-west, low chanting in many voices leads to a copse with off-white needles and soft ochre cones.",
    ],
    places: [
      { name: "The Balming Grove", kind: "a doe matriarch and a choir of twenty-five keeping an unbroken prayer in the glade; visitors are confronted at once and want either apologies and a quick exit, or a tribute" },
      { name: "New Moon Nights", kind: "the prayers turn to ululation and they brew a restorative balm over iron cauldrons for hours; guests who paid tribute are invited back for a dose" },
      { name: "The Shrine to St Primula", kind: "a thirty-foot sinkhole in a dell of fallen trees, the pink-veined marble shrine tumbled at the bottom; reassembled, praying there grants Remove Curse", hidden: true },
    ],
    hexEncounter: [
      { chance: 3, what: "2 deorling stags and 1d6+1 does; the stags are duelling over breeding rights while one of the does judges", creature: "Deorling—Stag" },
    ],
  },
  {
    hex: "1703",
    name: "Meagre's Reach and Redhearth's Rebels",
    terrain: "boggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 373,
    flavour: [
      "Still pools overgrown with algae and lilies. Time dawdles here, and a comfortable listlessness settles on travellers.",
      "Anyone born in this hex feels none of it; fairies and arcane casters can tell the place is wrapped in deep magic bent around time.",
      "The village is antique brick glazed in a dozen bright colours, and full of old people speaking in ways that went out of use long ago.",
    ],
    places: [
      { name: "The Village of Meagre's Reach", kind: "rich clay beds, brickmaking, and the elderly outnumbering the young; full settlement description on p162" },
      { name: "Redhearth's Rebels", kind: "a camp of sodden tents on root-riddled slopes west of the village; they hold that Ygraine keeps the village spellbound, and want weapons, gear and word of Chateau Mauvesse" },
    ],
    folk: [
      { name: "Gemyme Grange", what: "eighteen, fox-faced, nose ring, in an oversized bearskin; the gang's deputy, bored of waiting, and easily turned to any cause that promises danger" },
    ],
  },
  {
    hex: "1704",
    name: "The King of the Woodgrues",
    terrain: "boggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 374,
    flavour: [
      "Sandstone crags sticking out of stinking, fly-ridden bog.",
      "In the middle of the hex there is eccentric pipe music on the wind, and the long beards of moss on the trees sway along with it.",
    ],
    places: [
      { name: "Music on the Wind", kind: "the piping, and what the moss does in time with it" },
      { name: "The King's Grotto", kind: "poor food, every dish sprinkled with powdered moth wings; spiced mead at 1gp a mug" },
    ],
    folk: [
      { name: "The King of the Woodgrues", what: "whose grotto it is" },
    ],
  },
  {
    hex: "1705",
    name: "Stinkhorn Woods",
    terrain: "fungal-forest",
    cost: 2,
    region: "mulchgrove",
    lost: "1-in-6",
    page: 375,
    note: "Encounters are 3-in-6 likely to be with 2d10 giant blood-sucking flies (as stirges-- DMB) or 1d8 giant burrowing beetles (DMB).",
    forage: "1d4 portions of Blood Canker (DPB) or Puck's Ear (p428), in addition to the normal results, which are always fungi.",
    flavour: [
      "Enormous brown-and-cream fungi, unmistakably phallic, with flies all over them.",
      "The whole place stinks of carrion.",
      "Half of what you meet here is a swarm of giant blood-sucking flies or burrowing beetles.",
    ],
    places: [
      { name: "Stinkhorn Woods", kind: "the fungi themselves" },
      { name: "The relics of St Jorrael", kind: "what the map in the wyrm's hoard in 1107 points to", hidden: true },
    ],
    hexEncounter: [
      { chance: 3, what: "2d10 giant blood-sucking flies (as stirges), or 1d8 giant burrowing beetles" },
    ],
  },
  {
    hex: "1706",
    name: "Mosslings and the Yellow Monolith",
    terrain: "boggy-forest",
    cost: 4,
    region: "mulchgrove",
    lost: "3-in-6",
    page: 376,
    note: "Encounters are 2-in-6 likely to be with squirrels and raccoons attempting to pilfer small items from passersby (25% chance of success). They are in the service of the mosslings who live here, and were trained to it.",
    forage: "1d6 portions of Speckled Sporange (p428)",
    flavour: [
      "Wet ground and bramble thickets you cannot get through, with winding paths, little wooden bridges and walkways laid over it.",
      "The squirrels and raccoons here will try to lift small things off you — a quarter of the time they manage it. The mosslings trained them.",
    ],
    places: [
      { name: "The Yellow Monolith", kind: "the standing stone the hex is named for" },
      { name: "Moss ling paths", kind: "the bridges and walkways through the bog" },
    ],
    hexEncounter: [
      { chance: 2, what: "squirrels and raccoons trying to pilfer small items from passers-by (25% chance each of succeeding)" },
    ],
  },
  {
    hex: "1707",
    name: "The Fugitive Witch",
    terrain: "open-forest",
    cost: 2,
    region: "aldweald",
    lost: "1-in-6",
    page: 377,
    note: "Encounters are 2-in-6 likely to be with 2d6 giant ants (DMB) from the nest at The Shrine to St Benester.",
    forage: "1d2 portions of Frondhelm (p430)",
    flavour: [
      "Quiet glades thick with ferns, old oak copses hung with spongy lichen.",
      "There is a nest of giant ants at the shrine, and they range across the whole hex.",
    ],
    places: [
      { name: "The Rainbow Pool", kind: "the pool the hex opens with" },
      { name: "The Shrine to St Benester", kind: "and the ant nest in it" },
    ],
    folk: [
      { name: "Joab Elfwit", what: "witch of the Eye of Limwdd, fifty, tall and willow-thin — the fugitive" },
    ],
    hexEncounter: [
      { chance: 2, what: "2d6 giant ants from the nest at the Shrine to St Benester", creature: "Ant, Giant", number: "2d6" },
    ],
  },
  {
    hex: "1801",
    name: "The Lost Mine",
    terrain: "hilly-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 378,
    flavour: [
      "Overgrown piles of stone through the woods, the remains of a settlement long gone.",
      "The Downs Road passes half a square mile of hillside where nothing grows but ancient stumps and twisted dwarf trees. No bird calls, no animal shows itself.",
      "The mud and standing pools run orange-brown and oxidised green, and the air tastes of copper. Walking about on it costs a save or chemical burns.",
    ],
    places: [
      { name: "Blighted Hillside", kind: "two millennia of mine tailings — lead, mercury, sulphur and arsenic; drinking the water is lethal, and an old smelting pit sits at the foot of the hill" },
      { name: "Into the Mine", kind: "one of four entrances is still open: cleanly snapped human bones along the path, collapsed side tunnels, and a ninety-foot shaft with an orange glow at the bottom" },
      { name: "The Bottom Chamber", kind: "walls veined with copper pulsing like something alive, spikes of fused stone and flesh in the ceiling, and what is standing at the far end" },
    ],
    folk: [
      { name: "Orsath", what: "fourteen feet of bear with copper-needled fur, once a Wood God, its mind gone in arsenic dementia; it holds itself to the wall by crystal until it shakes free" },
    ],
  },
  {
    hex: "1802",
    name: "Chateau Mauvesse and the Dark Mirror",
    terrain: "boggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 379,
    note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    flavour: [
      "Dreary teal-leafed willows drifting their long boughs in the breeze.",
      "The trail from Meagre's Reach crosses marsh and climbs a rocky incline to a sprawling tiered manor above a black lake.",
      "The violet masonry looks permanently lit by an unobscured sunset, and both the gates and the front doorknob welcome you in.",
    ],
    places: [
      { name: "Chateau Mauvesse", kind: "gardens gone over to phosphorescent bracket fungus, courtly music with no locatable source, self-cleaning furnishings, and fairy courtiers throughout" },
      { name: "The nodal crypt", kind: "in the foundations stands the obsidian obelisk Phandrwyl, the hidden fifth nodal of Ywyr, warded so deeply even the Drune cannot perceive it", hidden: true },
      { name: "The Dark Mirror", kind: "the lake reflects a benighted sky at noon; at night, 3-in-6, the Duke's pale swan-ships form on it and dredge up the dreams of Dolmenwood" },
    ],
    folk: [
      { name: "Ygraine Mordlin", what: "the sorceress of the chateau, invariably indisposed with a fatiguing procession of eminent fairies; she may make time to consult on occult matters" },
    ],
  },
  {
    hex: "1803",
    name: "The Lonely Tree",
    terrain: "boggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 380,
    note: "Encounters with humanoids are 3-in-6 likely to be with delirious, elderly individuals fleeing the area.",
    forage: "The chance of foraging is increased by 1-in-6 in this hex.",
    flavour: [
      "Low fog off the sodden earth, silvery sap oozing from the trees, fungi thriving on the rotten trunks.",
      "There is food everywhere here and almost nobody comes for it: abandoned camps along the deer trails, and bloated crows and magpies watching from the upper boughs.",
      "On a hill in the north stands an apple tree as tall as a tower, hung with gnarled rosy fruit, and a few ragged people keeping it company.",
    ],
    places: [
      { name: "The Lonely Tree", kind: "eat the apples and it is a save or you stay the night telling childhood tales; one save a day to break it, and a week in its thrall costs 1d6 Constitution and 3d6 years" },
      { name: "Wayward thralls", kind: "wood tramps, vagabonds, lepers and stray pilgrims gathered at the hill, reciting strange legends in a torpor" },
    ],
    folk: [
      { name: "The tree itself", what: "an intelligence that cannot touch anyone who has not eaten its fruit — not malevolent, only bored and lonely; Ygraine grew it 150 years ago as an early experiment in the temporal magic that later took Meagre's Reach out of the past" },
    ],
    hexEncounter: [
      { chance: 3, what: "delirious, elderly people fleeing the area", where: "only where the encounter would have been with humanoids" },
    ],
  },
  {
    hex: "1804",
    name: "Mumblebole Manor",
    terrain: "boggy-forest",
    cost: 4,
    region: "aldweald",
    lost: "3-in-6",
    page: 381,
    forage: "1d3 portions of Foolscap (p428)",
    flavour: [
      "Uneven woodland full of gullies and pools, and the whole hex smells of ripe cheese.",
      "In the west, ochre fungal tendrils creep over the ground and hang from the trees. That is where the smell comes from.",
    ],
    places: [
      { name: "Cheese Fungus", kind: "the ochre tendrils in the west, and the reek" },
      { name: "Mumblebole Manor", kind: "the manor the hex is named for" },
    ],
    folk: [
      { name: "Blumber", what: "Level 8 fighter, a near-spherical mossling woman: yellow mould for hair, bracket fungus ears, spotted toadstool caps for eyes" },
    ],
  },
  {
    hex: "1805",
    name: "The Willow Mouth",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 382,
    flavour: [
      "An airy wood of little brooks and old bendy willows.",
      "Follow the water downhill and you come to a wide pool under algae and lily pads, ringed with willows.",
      "The animals of the wood will not go near it.",
    ],
    places: [
      { name: "The Willow's Pool", kind: "the pool the animals avoid" },
    ],
  },
  {
    hex: "1806",
    name: "Unearthed Skeleton",
    terrain: "open-forest",
    cost: 2,
    region: "aldweald",
    lost: "1-in-6",
    page: 383,
    flavour: [
      "Woodland carpeted in moss. When the wind turns you catch carrion.",
      "A humanoid giant 300 feet tall lies buried across the middle of the hex. Bits of it still break the surface between the trees: fingertips five feet long, ribs curving twenty feet into the air.",
      "Somebody is digging it up.",
    ],
    places: [
      { name: "The Skeleton", kind: "the buried giant and the bones showing above ground" },
      { name: "Dig Site", kind: "a pit 40ft across and 15 deep by the camp, exposing the skull — on its side, facing west, with a hole in the temple" },
      { name: "Inside the skull", kind: "a 12ft drop through the hole into the excavated interior", hidden: true },
    ],
  },
  {
    hex: "1901",
    name: "The Chalk Giant",
    terrain: "hills",
    cost: 2,
    region: "table-downs",
    lost: "1-in-6",
    page: 384,
    note: "Encounters are 2-in-6 likely to be with a peryton.",
    flavour: [
      "Crows wheeling over rugged chalk downs, with beds of gorse and twisted blue thistle underfoot.",
      "A humanoid figure two hundred feet high is cut into the chalk of a hillside, framed by a carved doorway, and visible for miles.",
      "An old man in a tattered purple robe is crouched on the hilltop, and waves excitedly when he sees you.",
    ],
    places: [
      { name: "The Chalk Giant", kind: "call the name Talorch and the figure animates, opening the doorway behind him onto a shimmering portal" },
      { name: "The Perytons' Nest", kind: "a hundred-foot sheer bluff in the south-west with a nest of brambles and boughs on top: five perytons, a gold necklace and emeralds, and a sealed scroll in a dead brambling's claw" },
      { name: "The Crystal Cave", kind: "purple and mauve crystals over every wall, and an old man's face looking back out of the reflections" },
    ],
    folk: [
      { name: "The Lost Scholar", what: "says he is the last of a party of scholars out of Wyggrabole and begs for his notes back from the nest; he is a dream projection, and is gone if you go back to look for him" },
      { name: "Alhair", what: "an ancient Drune, alive when the Ring of Chell was made, held by crystals that grant eternal life by keeping the soul; cheerful, talkative, generous with what he knows, and not remotely interested in being freed" },
    ],
    hexEncounter: [
      { chance: 2, what: "a peryton", creature: "Peryton" },
    ],
  },
  {
    hex: "1902",
    name: "The Clockwork Man",
    terrain: "hilly-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 385,
    note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.",
    flavour: [
      "Wild woods that are somehow well tended: wildflowers in rows beside the paths, little bridges over the brooks.",
      "A two-storey house of grey stone sits between three hills, ivy up the damp walls and moss hanging off the bowed roof; the windows are broken and the front door is slightly ajar.",
      "Everything inside is ticking.",
    ],
    places: [
      { name: "The Clockmaker's House", kind: "ransacked rooms slowly going to moss, beautifully made silly clocks still running on the walls, and a skeleton in the bed upstairs lying in a black stain" },
      { name: "Unique Clocks", kind: "the Crooked, the Backwards, the Mood and the Merriman; set the Mood Clock's arm to \"Awestruck\" and a secret door opens in the back of the armoire" },
      { name: "Workroom", kind: "shelves of springs, gears and metal sheet, tarps over unfinished contraptions, and a bench of schematics for ridiculous clockwork war machines" },
    ],
    folk: [
      { name: "The Clockwork Man", what: "a brass automaton with a barrel torso and waggling metal moustaches, stood dusty in the corner; wind the key, oil the joints, and he says good morning and wants to see the world" },
    ],
  },
  {
    hex: "1903",
    name: "Merry Lodgings",
    terrain: "hilly-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 386,
    flavour: [
      "Ditches and gullies everywhere, iridescent water standing in the dank bottoms of them.",
      "An enormous silver birch stands in a sunlit glade at the centre, sixty feet clear of the canopy, with woody brackets up its trunk big enough to sit on.",
      "In a valley of foxgloves, a cottage: wood stacked under the eaves, smoke from the chimney, a kettle whistling, and nobody home.",
    ],
    places: [
      { name: "Bracket Outlook", kind: "from the top you can pick out the Table Downs to the north, Chateau Mauvesse on its cliffs (1802) to the north-west, and the white marble tower to the south (1904)" },
      { name: "Woodland Cottage", kind: "the house serves its guests by itself — brooms sweep, kettles pour, chairs pull out, scones bake; one night is welcome, and past breakfast you are physically put out" },
      { name: "Books", kind: "hundreds of them, and among them a notebook in the Witches' Cant on the three Mirrors of Embala and the Aubrathon's theft of the onyx one" },
    ],
  },
  {
    hex: "1904",
    name: "Hoglyn's Spire",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 387,
    flavour: [
      "Tumbled walls and abandoned coppices, ruined steadings showing through the undergrowth here and there.",
      "In the east, a white marble turret still stands intact among mounds of overgrown rubble, its top floor above the treetops.",
    ],
    places: [
      { name: "Ruined Keep and Spire", kind: "the intact marble turret in the rubble" },
    ],
    folk: [
      { name: "Ivol", what: "a Cobbin badger magician in a monocle and a worn wool sweater; the group's self-appointed fairy expert, and mostly wrong" },
    ],
  },
  {
    hex: "1905",
    name: "Madame Thornwaife's Laboratory",
    terrain: "tangled-forest",
    cost: 3,
    region: "aldweald",
    lost: "2-in-6",
    page: 388,
    forage: "1d2 portions of Goatsweed (p430)",
    flavour: [
      "Great colonies of three-eyed ravens roost in the trees.",
      "A jagged shard of dark grey crystal ten feet tall stands in a wide glade carpeted with moss and purple lichen.",
      "She is reclusive, but she will sell her work to a wealthy enough visitor.",
    ],
    places: [
      { name: "The Crystal Shard", kind: "the ten-foot shard in the mossy glade" },
      { name: "Madame Thornwaife's Laboratory", kind: "and what she is willing to sell out of it" },
    ],
    folk: [
      { name: "Madame Thornwaife", what: "reclusive, and sells to money" },
    ],
  },
  {
    hex: "1906",
    name: "Wetherbrooke's Last Show",
    terrain: "open-forest",
    cost: 2,
    region: "aldweald",
    lost: "1-in-6",
    page: 389,
    flavour: [
      "Butterflies through open glades. In winter their wings are rimed with frost.",
      "In a glade near the forest edge stand eight wagons of different sizes, painted in colours that were once bright and are now weathered flat.",
      "Inside the tent: benches and hay bales round a circus ring, and spectral performers and animals blinking in and out, every human face fixed in a grimace.",
    ],
    places: [
      { name: "Abandoned Campsite", kind: "the eight weathered wagons" },
      { name: "Inside the Tent", kind: "the ring, and the show that has not stopped" },
    ],
  },
];

const BY_HEX: ReadonlyMap<string, HexInfo> = new Map(HEXES.map((h) => [h.hex, h]));

/**
 * Look a hex up the way a Referee types it: 0101, 101, or 1-1 all find it.
 *
 * Forgiving on the way in because the number is read off a map at the table,
 * and a leading zero is the first thing to go.
 */
export function hexInfo(input: string | undefined): HexInfo | undefined {
  if (!input) return undefined;
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.length < 2 || digits.length > 4) return undefined;
  return BY_HEX.get(digits.padStart(4, "0"));
}

/**
 * Which of a hex's own encounter rules apply to this moment.
 *
 * The book narrows several of them — to the night, to the road, to a sunny day —
 * and the module knows all three, so they are checked rather than merely
 * printed. What it cannot know ("by the lakeside", "in the eastern part of the
 * hex") is carried on `where` and printed on the card for the Referee to
 * overrule; that was Dolmenmaster's call on 2026-08-29, against the alternative of
 * not rolling them at all.
 */
export function hexRules(
  here: HexInfo | undefined,
  period: "day" | "night",
  way: string,
  sunny: boolean
): { chance?: HexEncounter; instead: HexEncounter[]; colour: HexEncounter[] } {
  const out: { chance?: HexEncounter; instead: HexEncounter[]; colour: HexEncounter[] } = {
    instead: [],
    colour: [],
  };
  for (const rule of here?.hexEncounter ?? []) {
    if (rule.period && rule.period !== period) continue;
    if (rule.way && !rule.way.includes(way as "road" | "track" | "wild")) continue;
    if (rule.sunny && !sunny) continue;
    if (rule.kind === "chance") out.chance ??= rule;
    else if (rule.kind === "colour") out.colour.push(rule);
    else out.instead.push(rule);
  }
  return out;
}
