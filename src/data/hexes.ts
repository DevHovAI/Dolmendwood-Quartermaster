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
 * **Nothing descriptive is here.** The hex name is a label, the terrain and
 * the region are the module’s own vocabulary, and the foraging line is the
 * mechanical exception the book grants that hex. The prose, the encounters and
 * the locations stay in the book, one click away on the page reference.
 *
 * 168 hexes: every one the book gives a Terrain line. Fifty of them grant
 * something extra to a forager.
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
}

export const HEXES: HexInfo[] = [
  { hex: "0101", name: "The Spectral Manse", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 190, note: "Encounters are 2-in-6 likely to be with a bewildered banshee (DMB) heading to a ball at the Spectral Manse.", forage: "1d2 portions of Bosun's Balm (DPB)" },
  { hex: "0102", name: "Reedwall", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 191 },
  { hex: "0103", name: "The Golden Goose", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 192 },
  { hex: "0104", name: "The Phantom Lighthouse", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 193 },
  { hex: "0105", name: "The Demesne of the Frore Gryphus", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 194, note: "Encounters are 3-in-6 likely to be with the frore gryphus residing in this hex, soaring high above the grasslands in search of prey." },
  { hex: "0106", name: "The Outlook and the Red Monolith", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 195, forage: "1d3 portions of Wayfarrow (DPB)" },
  { hex: "0107", name: "The Weeping Woman", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 196, forage: "1d3 portions of Wolfsbane (DPB)" },
  { hex: "0108", name: "The Cabbage Plot", terrain: "farmland", cost: 2, region: "high-wold", lost: "1-in-6", page: 197, note: "Encounters are 1-in-6 likely to be with a gang of Murkin's Soldiers." },
  { hex: "0109", name: "Lady Borrid and Murkin's Army", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 198 },
  { hex: "0110", name: "The Shadow of Lord Gnarlgruff", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 199, note: "Encounters are 2-in-6 likely to be with 1d3 devil goats (DMB)." },
  { hex: "0111", name: "The Wishing Pit", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 200, note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead." },
  { hex: "0201", name: "Grave of the Aubrathon and Helath Tor", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 201 },
  { hex: "0202", name: "Oath Isle", terrain: "swamp", cost: 4, region: "northern-scratch", lost: "3-in-6", page: 202 },
  { hex: "0203", name: "The Moss Garden", terrain: "swamp", cost: 4, region: "northern-scratch", lost: "3-in-6", page: 203, note: "Encounters are 2-in-6 likely to be with Brawg or Agnes." },
  { hex: "0204", name: "The Summerstone Uruzzur", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 204, alsoRegion: "Dwelmfurgh", note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold." },
  { hex: "0205", name: "Wooden Figures", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 205, alsoRegion: "Dwelmfurgh", note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold." },
  { hex: "0206", name: "Maidenhead Priory", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 206, alsoRegion: "Dwelmfurgh", note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold." },
  { hex: "0207", name: "The Summerstone Radhd", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 207, alsoRegion: "Dwelmfurgh", note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold." },
  { hex: "0208", name: "Kolstoke Keep and Illpuke Barrows", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 208 },
  { hex: "0209", name: "The Lethean Well", terrain: "craggy-forest", cost: 4, region: "high-wold", lost: "3-in-6", page: 209, forage: "1d2 portions of Woodpurse (p430)" },
  { hex: "0210", name: "Nodding Castle", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 210, note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead." },
  { hex: "0211", name: "The Tea Tent and the Dreaming Snail", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 211, note: "Encounters are 1-in-6 likely (2-in-6 likely at night) to be with 1d3+2 bandits (Level 1 thieves--DMB) and 1d3+2 shorthorns (DMB)-members of the gang based in hex 0311." },
  { hex: "0301", name: "The Ruins of Smerne", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 212, note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.", forage: "1d2 portions of Horridwort (p430)" },
  { hex: "0302", name: "The Stone Woods", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 213, forage: "1d3 portions of Marshwick (DPB)" },
  { hex: "0303", name: "Mother Efte's Lair", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 214, forage: "1d4 portions of Lilywhite (DPB)" },
  { hex: "0304", name: "The Summerstone Sigil", terrain: "tangled-forest", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 215, alsoRegion: "Dwelmfurgh" },
  { hex: "0305", name: "The Boggin's Lamp", terrain: "bog", cost: 3, region: "dwelmfurgh", lost: "2-in-6", page: 216, note: "Encounters are 2-in-6 likely to be with 1d4 marsh lanterns (DMB).", forage: "1d2 portions of Oddy Sorrel (p430)" },
  { hex: "0306", name: "Walker's Void and the Blue Monolith", terrain: "tangled-forest", cost: 3, region: "dwelmfurgh", lost: "2-in-6", page: 217 },
  { hex: "0307", name: "Fungal Forms and the Ascension Stone", terrain: "hilly-forest", cost: 3, region: "dwelmfurgh", lost: "2-in-6", page: 218 },
  { hex: "0308", name: "The Face of the Drune", terrain: "hilly-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 219, alsoRegion: "Dwelmfurgh", note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold.", forage: "1d2 portions of Rindlewort (p430)" },
  { hex: "0309", name: "Garnack's Tower", terrain: "hilly-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 220 },
  { hex: "0310", name: "The Craven Mounds", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 221, note: "Encounters are 2-in-6 likely to be with an insect swarm (DMB)--the flesh-eating beetles that swarm this hex." },
  { hex: "0311", name: "Bandit Hideout", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 222, note: "Daytime encounters are 1-in-6 likely to be with 1d3+2 bandits (Level 1 thieves--DMB) and 1d3+2 shorthorns (DMB)--members of the gang based in this hex." },
  { hex: "0312", name: "Mother Goat's Place", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 223, note: "Daytime encounters are 1-in-6 likely to be with 1d3+2 bandits (Level 1 thieves--DMB) and 1d3+2 shorthorns (DMB)--members of the gang based in hex 0311." },
  { hex: "0401", name: "The Hanging Tree", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 224, note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream." },
  { hex: "0402", name: "The Lady of Spring Unending", terrain: "tangled-forest", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 225 },
  { hex: "0403", name: "Queen Arda's Demesne", terrain: "tangled-forest", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 226, alsoRegion: "Dwelmfurgh", note: "Encounters are 1-in-6 likely to be with 1d4 � 10 purple sprites from the Sprite Mound. Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold." },
  { hex: "0404", name: "The Remembering Mist", terrain: "tangled-forest", cost: 3, region: "dwelmfurgh", lost: "2-in-6", page: 227 },
  { hex: "0405", name: "Lair of the Cheese-Fiend", terrain: "craggy-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 228 },
  { hex: "0406", name: "Fungal Bloom Cave", terrain: "tangled-forest", cost: 3, region: "dwelmfurgh", lost: "2-in-6", page: 229 },
  { hex: "0407", name: "Droun Loch", terrain: "craggy-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 230, note: "Encounters by the lakeside are 2-in-6 likely (3-in-6 likely at night) to be with Red Henry or The Girl With Blue Lips." },
  { hex: "0408", name: "Guardian Gargoyles", terrain: "hilly-forest", cost: 3, region: "dwelmfurgh", lost: "2-in-6", page: 231, note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold." },
  { hex: "0409", name: "The Hamlet of Galblight", terrain: "hilly-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 232, note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.", forage: "1d2 portions of Parson's Gobble (p430)" },
  { hex: "0410", name: "Castle Everdusk", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 233 },
  { hex: "0411", name: "Mannog's Flock", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 234, note: "Encounters are 1-in-6 likely (2-in-6 likely at night) to be with 1d3+2 bandits (Level 1 thieves--DMB) and 1d3+2 shorthorns (DMB)-members of the gang based in hex 0311." },
  { hex: "0412", name: "The Tower of Birds", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 235 },
  { hex: "0501", name: "The Bog Hermit", terrain: "bog", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 236 },
  { hex: "0502", name: "Yrthstone and the People of Zarlac", terrain: "tangled-forest", cost: 3, region: "northern-scratch", lost: "2-in-6", page: 237, note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream." },
  { hex: "0503", name: "Eoel \"the Horn\"", terrain: "thorny-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 238, alsoRegion: "Northern Scr", note: "Encounters are 4-in-6 likely to be with the Audrune Morgodh and 1d6 bramblings (DMB).", forage: "1d2 portions of Rindlewort (p430)" },
  { hex: "0504", name: "The Falls of Naon and the Embassy", terrain: "craggy-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 239 },
  { hex: "0505", name: "Hoarblight Keep and the Isle of Yeth", terrain: "craggy-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 240, forage: "1d2 portions of Goatsweed (p430)" },
  { hex: "0506", name: "The Stone of Repentance", terrain: "craggy-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 241 },
  { hex: "0507", name: "Drune Lodge", terrain: "craggy-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 242 },
  { hex: "0508", name: "The Skeletal Gardener", terrain: "craggy-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 243 },
  { hex: "0509", name: "The Pelloryons", terrain: "hilly-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 244, alsoRegion: "Dwelmfurgh", note: "Ley line crossing Chell/Ywyr: Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold. (See p20." },
  { hex: "0510", name: "The Lair of the Bicorne", terrain: "hilly-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 245 },
  { hex: "0511", name: "The Inn of the Tankards", terrain: "hills", cost: 2, region: "high-wold", lost: "1-in-6", page: 246 },
  { hex: "0512", name: "High-Hankle and the Wayward Griffons", terrain: "farmland", cost: 2, region: "high-wold", lost: "1-in-6", page: 247 },
  { hex: "0601", name: "The Lonely Grave", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 248 },
  { hex: "0602", name: "The Hall of the Fomorian", terrain: "tangled-forest", cost: 3, region: "nagwood", lost: "2-in-6", page: 249, note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream.", forage: "1d2 Shub Eggs (p430)" },
  { hex: "0603", name: "The Ruined Cottage", terrain: "thorny-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 250, alsoRegion: "Northern Scr", note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold." },
  { hex: "0604", name: "Fort Vulgar and the Galoshers' Pool", terrain: "thorny-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 251, note: "Encounters are 2-in-6 likely to be with 1d3 galoshers in the vicinity of a pond." },
  { hex: "0607", name: "Wight Falls and Smerne's Lost Hoard", terrain: "craggy-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 254 },
  { hex: "0608", name: "The Snake Witch", terrain: "craggy-forest", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 255, note: "Encounters are 2-in-6 likely to be with 1d8 adders (DMB) or 1d3 giant pythons (DMB).", forage: "1d4 portions of Spirithame (DPB)" },
  { hex: "0609", name: "The Trothstone and the Owl Cave", terrain: "hilly-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 256, forage: "1d6 portions of Wolfsbane (DPB)" },
  { hex: "0610", name: "Lankston Pool", terrain: "hills", cost: 2, region: "high-wold", lost: "1-in-6", page: 257 },
  { hex: "0611", name: "The Magpie Gang", terrain: "farmland", cost: 2, region: "high-wold", lost: "1-in-6", page: 258 },
  { hex: "0612", name: "The Staring Stones", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 259, forage: "1d3 portions of Moonhaw (DPB)" },
  { hex: "0701", name: "The Ruined Watchtower", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 260 },
  { hex: "0702", name: "Drigbolton and the Oath House", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 261, note: "Encounters are 2-in-6 likely to be with 2d4 cannibals (see hex 0801), attempting to capture travellers and drag them back to their lair." },
  { hex: "0703", name: "The Ruins of Midgewarrow", terrain: "tangled-forest", cost: 3, region: "nagwood", lost: "2-in-6", page: 262, note: "Encounters are 2-in-6 likely to be with 2d4 cannibals (see hex 0801), attempting to capture travellers and drag them back to their lair.", forage: "1d2 Shub Eggs (p430)" },
  { hex: "0704", name: "Derodand Manor", terrain: "tangled-forest", cost: 3, region: "dwelmfurgh", lost: "2-in-6", page: 263, alsoRegion: "Nagwood", note: "Ley Line Chell (p18): Arcane spell-casters perceive the curious dual sensation of balmy heat and biting cold." },
  { hex: "0705", name: "The Scrabey Who Forgot Her Name", terrain: "tangled-forest", cost: 3, region: "dwelmfurgh", lost: "2-in-6", page: 264, note: "Nighttime encounters on the road are 2-in-6 likely to be with the ghost of Dewidort of Smerne (see hex 0607)." },
  { hex: "0708", name: "The Hamlet of Shagsend", terrain: "craggy-forest", cost: 4, region: "high-wold", lost: "3-in-6", page: 267, alsoRegion: "Dwelmfurgh", note: "Nighttime encounters are 3-in-6 likely to be with a Drune cottager (DMB) and 1d4 bramblings (DMB), spying on Shagsend, seeking their lost comrade, Cranthus (imprisoned in Shagsend)." },
  { hex: "0709", name: "The Shadholme and Redwraith Manor", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 268 },
  { hex: "0710", name: "Lankshorn and the Animal Orchestra", terrain: "farmland", cost: 2, region: "high-wold", lost: "1-in-6", page: 269 },
  { hex: "0711", name: "King Pusskin's Road", terrain: "farmland", cost: 2, region: "high-wold", lost: "1-in-6", page: 270 },
  { hex: "0712", name: "The Derelict Windmill", terrain: "hills", cost: 2, region: "high-wold", lost: "1-in-6", page: 271 },
  { hex: "0801", name: "The Caves of Clan Shaggytree", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 272, note: "Encounters are 2-in-6 likely to be with 2d4 cannibals, attempting to capture travellers and drag them back to their lair." },
  { hex: "0802", name: "Avernal Lake", terrain: "tangled-forest", cost: 3, region: "nagwood", lost: "2-in-6", page: 273, note: "Encounters are 2-in-6 likely to be with 2d4 cannibals (see hex 0801), attempting to capture travellers and drag them back to their lair." },
  { hex: "0803", name: "The Toll Bridge and Snarkscorn's Camp", terrain: "thorny-forest", cost: 4, region: "nagwood", lost: "3-in-6", page: 274 },
  { hex: "0804", name: "The Summerstone Hadrwyl", terrain: "thorny-forest", cost: 4, region: "nagwood", lost: "3-in-6", page: 275, alsoRegion: "Dwelmfurgh" },
  { hex: "0805", name: "Prigmarinn Hill", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 276, alsoRegion: "Dwelmfurgh", note: "Nighttime encounters on the road are 2-in-6 likely to be with the ghost of Dewidort of Smerne (see hex 0607)." },
  { hex: "0807", name: "Ignormwm's Cottage", terrain: "swamp", cost: 4, region: "dwelmfurgh", lost: "3-in-6", page: 278, alsoRegion: "Hag's Addle", note: "Ley line crossing Chell/Ywyr: Arcane spell-casters perceive a throbbing warmth from the earth and the chilling cries of gigantic ravens.", forage: "1d2 portions of Bosun's Balm (DPB) and 1d3 portions of Lankswith (DPB)" },
  { hex: "0808", name: "The House of Merridwyn Scymes", terrain: "craggy-forest", cost: 4, region: "high-wold", lost: "3-in-6", page: 279, note: "Daytime encounters are 2-in-6 likely to be with a Lankshorn town guard (p157) bringing provisions to Merridwyn Scymes's cottage." },
  { hex: "0809", name: "Nightworms", terrain: "open-forest", cost: 2, region: "high-wold", lost: "1-in-6", page: 280, note: "After dark, encounters are 3-in-6 likely. Nighttime encounters are 4-in-6 likely to be with 1d8 nightworms.", forage: "1d3 portions of Smottlebread (DPB)" },
  { hex: "0810", name: "King's Mounds and the Drune Cottage", terrain: "open-forest", cost: 2, region: "high-wold", lost: "1-in-6", page: 281, note: "Daytime encounters are 2-in-6 likely to be with the Braithmaid Pollith Bonewort, roaming the woods singing haunting, magical songs." },
  { hex: "0811", name: "Cornew Cliffs", terrain: "hills", cost: 2, region: "high-wold", lost: "1-in-6", page: 282, note: "On sunny days, encounters are 2-in-6 likely to be with 2d6 young women from the farms to the north-west." },
  { hex: "0812", name: "The Shadow Revel", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 283 },
  { hex: "0901", name: "The Bloodied Altar", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 284, note: "Sentient folk encountered within the ring of the Mysterious Cairns are trapped. Some may have read The Inscription, and seek to free themselves by sacrificing others." },
  { hex: "0902", name: "The Battle of the Trees", terrain: "tangled-forest", cost: 3, region: "nagwood", lost: "2-in-6", page: 285, note: "Encounters are 2-in-6 likely to be with a treowere (DMB), either Lawful or Chaotic (see The Battle of the Trees).", forage: "ruddy medlars sufficient for 1d6 doses of Moonhaw (DPB)" },
  { hex: "0903", name: "The Besieged Nodal", terrain: "tangled-forest", cost: 3, region: "nagwood", lost: "2-in-6", page: 286, note: "Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.", forage: "1d4 Shub Eggs (p430)" },
  { hex: "0904", name: "The Court of the Nag-Lord", terrain: "thorny-forest", cost: 4, region: "nagwood", lost: "3-in-6", page: 287, note: "Encounters are 2-in-6 likely to be with 2d10 vampire bats (DMB), bred by the Nag-Lord to plague its domain." },
  { hex: "0905", name: "The Mouse Shrine and the Hermitage", terrain: "tangled-forest", cost: 3, region: "valley-of-wise-beasts", lost: "2-in-6", page: 288, note: "Encounters are 2-in-6 likely to be with a patrol of 2d6 crookhorns (DMB) from the garrison at Baron Fragglehorn's tower (hex 1004).", forage: "1d4 portions of Worm-Mallow (p430)" },
  { hex: "0906", name: "The Ruined Abbey of St Clewyd", terrain: "craggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 289, note: "Encounters are 2-in-6 likely to be with the gloam (DMB) that lairs in the abbey ruins. Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence." },
  { hex: "0907", name: "Bafflestone", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 290, note: "Encounters are 3-in-6 likely to be with 2d10 wandering Bafflestone Thralls." },
  { hex: "0908", name: "The Hag's Lair", terrain: "swamp", cost: 4, region: "hags-addle", lost: "3-in-6", page: 291, note: "Nighttime encounters are 2-in-6 likely to be with the Hag (p82). Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence.", forage: "1d6 portions of Bloodcap (p428) or 1d4 portions of Grinning Jenny (p428)" },
  { hex: "0909", name: "The Worm's Pit", terrain: "craggy-forest", cost: 4, region: "high-wold", lost: "3-in-6", page: 292, note: "Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence." },
  { hex: "0910", name: "Golokstone", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 293, note: "Off-road encounters are 2-in-6 likely to be with 1d3+1 bramblings patrolling the region. Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence." },
  { hex: "0911", name: "Shub's Nanna", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 294, note: "Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence." },
  { hex: "0912", name: "The Hamlet of Swinescombe", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 295, note: "Ley line Lamm (p18): Arcane spell-casters feel observed by a pitiless malevolence." },
  { hex: "1001", name: "The Bogenwood", terrain: "tangled-forest", cost: 3, region: "nagwood", lost: "2-in-6", page: 296, note: "Encounters are 2-in-6 likely (4-in-6 likely if travelling on Quaking Creek) to be with 1d2 bogen.", forage: "1d3 portions of Foolscap (p428)" },
  { hex: "1002", name: "The Belching Pools and Br Inemere", terrain: "bog", cost: 3, region: "fever-marsh", lost: "2-in-6", page: 297, forage: "1d3 portions of Marshwick (DPB) or Horridwort (p430)" },
  { hex: "1003", name: "An Awful Black Slime", terrain: "thorny-forest", cost: 4, region: "nagwood", lost: "3-in-6", page: 298, note: "Encounters are 2-in-6 likely to be with black tentacles (DMB).", forage: "1d3 portions of Grue's Ear (DPB) and 1d2 portions of Goatman's Goblet (p428)" },
  { hex: "1004", name: "Baron Fragglehorn's Tower", terrain: "tangled-forest", cost: 3, region: "valley-of-wise-beasts", lost: "2-in-6", page: 299, note: "Encounters are 3-in-6 likely to be with a patrol of 2d6 crookhorns (DMB) from the garrison at the Baron's tower." },
  { hex: "1005", name: "Shub's Finger and Stirge Isle", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 300, note: "Encounters are 2-in-6 likely to be with 1d4 stirge-owls." },
  { hex: "1006", name: "The Witch Glade", terrain: "craggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 301, note: "Encounters are 2-in-6 likely to be with 1d4 witches (eyes of Limwdd--DMB) making their way to the sacred glade.", forage: "1d3 portions of Lambent Stinkhorn (p428)" },
  { hex: "1007", name: "The Tower of Frost", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 302 },
  { hex: "1008", name: "The Flotsam Pools", terrain: "swamp", cost: 4, region: "hags-addle", lost: "3-in-6", page: 303, note: "Daytime encounters are 1-in-6 likely to be with Tekwell Onehorn.", forage: "1d3 portions of Hag's Tears (p430) and 1d2 portions of Marshwick (DPB)" },
  { hex: "1009", name: "The Anti-Prism", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 304, forage: "1d3 portions of Parson's Gobble (p430)" },
  { hex: "1010", name: "The House of the Harridwn", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 305 },
  { hex: "1011", name: "Brydging Ring", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 306, forage: "1d3 portions of Hogscap (DPB) or Prancing Mandrake (p430)" },
  { hex: "1012", name: "Ancient Worm Tunnels", terrain: "meadow", cost: 2, region: "high-wold", lost: "1-in-6", page: 307 },
  { hex: "1101", name: "Houndmistress Mound", terrain: "tangled-forest", cost: 3, region: "nagwood", lost: "2-in-6", page: 308, note: "Encounters are 2-in-6 likely to be with 1d4 labourers and 1 guard (Level 1 fighter-- DMB) from the expedition based in hex 1201, surveying the exterior of the Houndmistress Mound." },
  { hex: "1102", name: "Mudpots", terrain: "bog", cost: 3, region: "fever-marsh", lost: "2-in-6", page: 309, note: "Encounters are 2-in-6 likely to be with Old Ned." },
  { hex: "1103", name: "The Lightless Tower", terrain: "bog", cost: 3, region: "fever-marsh", lost: "2-in-6", page: 310 },
  { hex: "1104", name: "Cobton-On-The-Shiver and the Giant Egg", terrain: "tangled-forest", cost: 3, region: "valley-of-wise-beasts", lost: "2-in-6", page: 311 },
  { hex: "1105", name: "Harrowmoor Keep", terrain: "craggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 312, note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream." },
  { hex: "1106", name: "Prigwort and the Swinney Tower", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 313, note: "Nighttime encounters on the road are 2-in-6 likely to be with the ghost of Dewidort of Smerne (see hex 0607)." },
  { hex: "1107", name: "The Wyrm Cave", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 314 },
  { hex: "1108", name: "Louper's Luncheon", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 315 },
  { hex: "1109", name: "Woodcutters' Encampment and Frog Isle", terrain: "swamp", cost: 4, region: "hags-addle", lost: "3-in-6", page: 316 },
  { hex: "1110", name: "Dreg and Myrrsian's Mill", terrain: "tangled-forest", cost: 3, region: "high-wold", lost: "2-in-6", page: 317, alsoRegion: "Aldweald", forage: "1d4 portions of young lantern elm roots, used to brew Ofteritch (DPB)" },
  { hex: "1111", name: "Nyfward", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 318, alsoRegion: "High Wold" },
  { hex: "1112", name: "The Falls of Nyf", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 319 },
  { hex: "1201", name: "Ancient Evil", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 320 },
  { hex: "1202", name: "Mound of the Willing Sacrifice", terrain: "swamp", cost: 4, region: "fever-marsh", lost: "3-in-6", page: 321, note: "Encounters are 1-in-6 likely to be with the Willing Sacrifice." },
  { hex: "1203", name: "The Elder Willows", terrain: "tangled-forest", cost: 3, region: "valley-of-wise-beasts", lost: "2-in-6", page: 322 },
  { hex: "1204", name: "The Breath of the Kelpie", terrain: "craggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 323 },
  { hex: "1205", name: "Gorthstone", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 324, note: "Encounters are 2-in-6 likely to be with 1d4 elf knights (DMB) in the service of the Earl of Yellow (p32), clad entirely in yellow and mounted on great golden wolves (as dire wolves, DMB)." },
  { hex: "1206", name: "The Baker's Dozen", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 325, note: "Nighttime encounters on the road are 2-in-6 likely to be with the ghost of Dewidort of Smerne (see hex 0607)." },
  { hex: "1207", name: "Crystal Caves Around Fog Lake", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 326 },
  { hex: "1208", name: "The Ballow-Clefts", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 327, note: "Daytime encounters are 2-in-6 likely to be with 2d6 clueless urban pilgrims (everyday mortals--DMB) on their way to the crystal caves at Fog Lake (hex 1207)." },
  { hex: "1209", name: "Ferneddbole House", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 328, note: "Encounters at night are 1-in-6 likely to be with the Moonlit Maw (hex 1311)." },
  { hex: "1210", name: "Bogwitt Manor", terrain: "open-forest", cost: 2, region: "aldweald", lost: "1-in-6", page: 329, note: "Encounters at night are 1-in-6 likely to be with the Moonlit Maw (hex 1311)." },
  { hex: "1211", name: "The Webs of Old Aunt Spindel", terrain: "open-forest", cost: 2, region: "aldweald", lost: "1-in-6", page: 330, note: "Encounters are 4-in-6 likely to be with 1d3 giant spinning spiders (DMB). Perilous Travel The hex is a cat's cradle of rope-like spiders' webs." },
  { hex: "1212", name: "The Balm Fields", terrain: "meadow", cost: 2, region: "tithelands", lost: "1-in-6", page: 331, forage: "1d3 portions of Tom-A-Merry (DPB)" },
  { hex: "1301", name: "Shivering Bridge and the Burnt Mill", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 332 },
  { hex: "1302", name: "The Vernal Chapel", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 333, forage: "1d3 portions of Worm-Mallow (p430)" },
  { hex: "1303", name: "The Woodwind Trees", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 334 },
  { hex: "1304", name: "The Hall of Sleep", terrain: "craggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 335, forage: "1d6 portions of Fenob (DPB)" },
  { hex: "1305", name: "The Ravine of the Stag Lord", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 336, note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead." },
  { hex: "1306", name: "The Dung Heap and the Grey Monolith", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 337, forage: "1d2 portions of Arrowhame (DPB)" },
  { hex: "1307", name: "The Refuge of St Keye", terrain: "open-forest", cost: 2, region: "aldweald", lost: "1-in-6", page: 338 },
  { hex: "1308", name: "Scoyfe's Mire", terrain: "open-forest", cost: 2, region: "aldweald", lost: "1-in-6", page: 339 },
  { hex: "1309", name: "Thirligrewe's Orchard", terrain: "open-forest", cost: 2, region: "aldweald", lost: "1-in-6", page: 340 },
  { hex: "1310", name: "The Lodge of Granny Wolfsbane", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 341 },
  { hex: "1311", name: "The Wolfweald", terrain: "meadow", cost: 2, region: "tithelands", lost: "1-in-6", page: 342, note: "Encounters at night are 4-in-6 likely to be with the Moonlit Maw." },
  { hex: "1312", name: "Andromethia's Blossom Fields", terrain: "meadow", cost: 2, region: "tithelands", lost: "1-in-6", page: 343 },
  { hex: "1401", name: "Fresh Graves", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 344, note: "Nighttime encounters are 3-in-6 likely to be with Grinstead, accompanied by 1d6 wolves (DMB)." },
  { hex: "1402", name: "Mai-Fleur's Unicorn-Hunting Grounds", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 345, note: "Encounters are 1-in-6 likely (2-in-6 likely at night) to be with a Wild Hunt (see hex 1502) in pursuit of 1d4 blessed unicorns (DMB).", forage: "1d3 portions of Sallow Parsley (DPB)" },
  { hex: "1403", name: "Odd and the War of the Sprites", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 346 },
  { hex: "1404", name: "The Merrovore and the Glaring Pylon", terrain: "boggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 347, note: "Encounters are 2-in-6 likely to be with the merrovore. Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead.", forage: "2d6 portions of the climbing vine known as Black Clover (p430)" },
  { hex: "1405", name: "Orbswallow and the Nutcap Colonies", terrain: "fungal-forest", cost: 2, region: "mulchgrove", lost: "1-in-6", page: 348, note: "Encounters are 2-in-6 likely to be with 2d6 nutcaps (DMB), fluttering around nest-like platforms of woven bark amid the branches of a grove of silver birch.", forage: "1d4 portions of Devil's Grease (p428) and 1d4 portions of Blood Canker (DPB)" },
  { hex: "1406", name: "The Golden Wood", terrain: "boggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 349, note: "Encounters are 2-in-6 likely to be with 1d4 elf knights (DMB) in the service of the Earl of Yellow (p32), clad entirely in yellow and mounted on great golden wolves (as dire wolves, DMB).", forage: "1d4 portions of Knobbled Mandrake (p430)" },
  { hex: "1407", name: "The Henchgate", terrain: "meadow", cost: 2, region: "tithelands", lost: "1-in-6", page: 350 },
  { hex: "1408", name: "Moriggan's Crag", terrain: "farmland", cost: 2, region: "tithelands", lost: "1-in-6", page: 351 },
  { hex: "1409", name: "The Stinking Mausoleum", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 352 },
  { hex: "1410", name: "The Singing Spring", terrain: "meadow", cost: 2, region: "tithelands", lost: "1-in-6", page: 353, note: "Encounters are 2-in-6 likely to be with 1d4 cockatrices (DMB) from the Cockatrice Nest.", forage: "1d2 portions of Writhing Mandrake (p430)" },
  { hex: "1501", name: "The Ruins of Chancton", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 354 },
  { hex: "1502", name: "Duke Mai-Fleur's Hunting Lodge", terrain: "hilly-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 355, note: "Encounters are 1-in-6 likely (2-in-6 likely at night) to be with a Wild Hunt mustering in the woods around the lodge.", forage: "1d4 portions of Gillywort (DPB)" },
  { hex: "1503", name: "Mai-Fleur's Fox-Hunting Grounds", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 356, note: "Encounters are 1-in-6 likely (2-in-6 likely at night) to be with a Wild Hunt (see 1502) in pursuit of 2d6 fairy foxes.", forage: "1d3 portions of Oddy Sorrel (p430)" },
  { hex: "1504", name: "The Barrow Bog", terrain: "boggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 357 },
  { hex: "1505", name: "The Upper Brain of the Myconom", terrain: "fungal-forest", cost: 2, region: "mulchgrove", lost: "1-in-6", page: 358, forage: "1d6 portions of Rotting Mazegill (p428) and 1d4 portions of Grinning Jenny (p428), in addition to the normal results, which are always fungi." },
  { hex: "1506", name: "The Ticking Wood", terrain: "fungal-forest", cost: 2, region: "mulchgrove", lost: "1-in-6", page: 359, forage: "1d4 portions of Angel's Lament (p428) and 1d4 portions of Velvet Flounder (p428)" },
  { hex: "1507", name: "Norstone", terrain: "boggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 360, note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream." },
  { hex: "1508", name: "Castle Brackenwold and Monarch's Hill", terrain: "farmland", cost: 2, region: "tithelands", lost: "1-in-6", page: 361 },
  { hex: "1509", name: "The Deceiver's Well", terrain: "farmland", cost: 2, region: "tithelands", lost: "1-in-6", page: 362 },
  { hex: "1601", name: "The Slumbering Giant", terrain: "hilly-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 363 },
  { hex: "1602", name: "The Hill of Henlann", terrain: "hilly-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 364, note: "Encounters are 3-in-6 likely to be with 1d3 witches--eyes of Hasturiel (DMB) on pilgrimage here." },
  { hex: "1603", name: "Endstone and the Embalmed Hamlet", terrain: "boggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 365, note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead." },
  { hex: "1604", name: "Blackeswell and the Drowning Pool", terrain: "boggy-forest", cost: 4, region: "mulchgrove", lost: "3-in-6", page: 366, note: "Encounters are 2-in-6 likely to be with 1d8 toad-children wandering abroad.", forage: "1d4 portions of Witch's Purple (p428)" },
  { hex: "1605", name: "The Fungal Chasm", terrain: "fungal-forest", cost: 2, region: "mulchgrove", lost: "1-in-6", page: 367, forage: "1d3 portions of Mossmulch (p428) or Wallowmost (DPB), in addition to the normal results, which are always fungi." },
  { hex: "1606", name: "The Whispering Caves", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 368 },
  { hex: "1607", name: "The Wandering Friars", terrain: "open-forest", cost: 2, region: "aldweald", lost: "1-in-6", page: 369, note: "Ley line Hoad (p18): Arcane spell-casters perceive the feeling of having just awoken from a dream." },
  { hex: "1608", name: "The Bad Apples", terrain: "farmland", cost: 2, region: "tithelands", lost: "1-in-6", page: 370 },
  { hex: "1701", name: "The Grimalkin's Revenge", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 371, note: "Encounters are 2-in-6 likely to be with Hilda, furtively travelling between the Ogre Lair and the Secret Cave.", forage: "1d6 portions of Groaning Mandrake (p430)" },
  { hex: "1702", name: "The Balming Grove", terrain: "hilly-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 372, note: "Encounters are 3-in-6 likely to be with 2 deorling stags (DMB) and 1d6+1 deorling does (DMB). The stags duel each other over breeding rights with one of the does, who observes and judges the fight." },
  { hex: "1703", name: "Meagre's Reach and Redhearth's Rebels", terrain: "boggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 373 },
  { hex: "1704", name: "The King of the Woodgrues", terrain: "boggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 374 },
  { hex: "1705", name: "Stinkhorn Woods", terrain: "fungal-forest", cost: 2, region: "mulchgrove", lost: "1-in-6", page: 375, note: "Encounters are 3-in-6 likely to be with 2d10 giant blood-sucking flies (as stirges-- DMB) or 1d8 giant burrowing beetles (DMB).", forage: "1d4 portions of Blood Canker (DPB) or Puck's Ear (p428), in addition to the normal results, which are always fungi." },
  { hex: "1706", name: "Mosslings and the Yellow Monolith", terrain: "boggy-forest", cost: 4, region: "mulchgrove", lost: "3-in-6", page: 376, note: "Encounters are 2-in-6 likely to be with squirrels and raccoons attempting to pilfer small items from passersby (25% chance of success).", forage: "1d6 portions of Speckled Sporange (p428)" },
  { hex: "1707", name: "The Fugitive Witch", terrain: "open-forest", cost: 2, region: "aldweald", lost: "1-in-6", page: 377, note: "Encounters are 2-in-6 likely to be with 2d6 giant ants (DMB) from the nest at The Shrine to St Benester.", forage: "1d2 portions of Frondhelm (p430)" },
  { hex: "1801", name: "The Lost Mine", terrain: "hilly-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 378 },
  { hex: "1802", name: "Chateau Mauvesse and the Dark Mirror", terrain: "boggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 379, note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead." },
  { hex: "1803", name: "The Lonely Tree", terrain: "boggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 380, note: "Encounters with humanoids are 3-in-6 likely to be with delirious, elderly individuals fleeing the area.", forage: "The chance of foraging is increased by 1-in-6 in this hex." },
  { hex: "1804", name: "Mumblebole Manor", terrain: "boggy-forest", cost: 4, region: "aldweald", lost: "3-in-6", page: 381, forage: "1d3 portions of Foolscap (p428)" },
  { hex: "1805", name: "The Willow Mouth", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 382 },
  { hex: "1806", name: "Unearthed Skeleton", terrain: "open-forest", cost: 2, region: "aldweald", lost: "1-in-6", page: 383 },
  { hex: "1901", name: "The Chalk Giant", terrain: "hills", cost: 2, region: "table-downs", lost: "1-in-6", page: 384, note: "Encounters are 2-in-6 likely to be with a peryton." },
  { hex: "1902", name: "The Clockwork Man", terrain: "hilly-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 385, note: "Ley line Ywyr (p18): Arcane spell-casters perceive the distant moaning of the dead." },
  { hex: "1903", name: "Merry Lodgings", terrain: "hilly-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 386 },
  { hex: "1904", name: "Hoglyn's Spire", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 387 },
  { hex: "1905", name: "Madame Thornwaife's Laboratory", terrain: "tangled-forest", cost: 3, region: "aldweald", lost: "2-in-6", page: 388, forage: "1d2 portions of Goatsweed (p430)" },
  { hex: "1906", name: "Wetherbrooke's Last Show", terrain: "open-forest", cost: 2, region: "aldweald", lost: "1-in-6", page: 389 },
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
