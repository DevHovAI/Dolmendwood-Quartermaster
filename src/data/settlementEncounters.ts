/**
 * What happens in town (Campaign Book, Part Five).
 *
 * **A settlement encounter is nothing like a wilderness one, and the module used
 * to pretend otherwise.** The first cut of the encounter roll sent a party in
 * Prigwort to the Road/Track column of the Encounter Type table and produced
 * ogres in the market square. The Campaign Book gives each of its twelve
 * settlements a d6 table of its own for day and another for night, and those
 * tables are not creatures at all: they are scenes — a named local doing
 * something, a building collapsing, wagons arriving. There is no number
 * appearing, no surprise, no encounter distance. So this is a separate table, a
 * separate roll, and a separate card.
 *
 * Only the chance carries over from the wilderness procedure, because it is the
 * Player's Book that sets it and it is the same wherever the party is standing:
 * 2-in-6 by day and 1-in-6 by night, and only while the characters are actually
 * out and about rather than sitting in an inn (p160).
 *
 * The twelve are the ones the book details. A party in a hamlet it does not
 * cover gets told so rather than given somebody else's table.
 */

export type Settlement =
  | "blackeswell"
  | "castle-brackenwold"
  | "cobton-on-the-shiver"
  | "dreg-and-shantywood-isle"
  | "fort-vulgar"
  | "high-hankle"
  | "lankshorn"
  | "meagres-reach"
  | "odd"
  | "orbswallow"
  | "prigwort"
  | "woodcutters-encampment";

export const SETTLEMENTS: {
  id: Settlement;
  label: string;
  /** The hex it stands in, which is how the campaign map names places. */
  hex: string;
  /** Where its encounter tables are printed. */
  page: number;
  blurb: string;
}[] = [
  { id: "blackeswell", label: "Blackeswell", hex: "1604", page: 125, blurb: "Isolated Mulchgrove village, nearing the utmost decay of its former wealth" },
  { id: "castle-brackenwold", label: "Castle Brackenwold", hex: "1508", page: 129, blurb: "The Castle and the Inner City" },
  { id: "cobton-on-the-shiver", label: "Cobton-on-the-Shiver", hex: "1104", page: 137, blurb: "A thriving village of Cobbins, ruled by cruel crookhorn ruffians" },
  { id: "dreg-and-shantywood-isle", label: "Dreg and Shantywood Isle", hex: "1110", page: 141, blurb: "Rowdy Hameth port-town and the neighbouring isle of ill-repute" },
  { id: "fort-vulgar", label: "Fort Vulgar", hex: "0604", page: 147, blurb: "Trading and military outpost on the haunted shores of Lake Longmere" },
  { id: "high-hankle", label: "High-Hankle", hex: "0512", page: 151, blurb: "Ancient capital of the High Wold and burgeoning town of hedonism" },
  { id: "lankshorn", label: "Lankshorn", hex: "0710", page: 157, blurb: "High Wold market town on the edge of the tangled, breggle-ruled woods" },
  { id: "meagres-reach", label: "Meagre’s Reach", hex: "1703", page: 163, blurb: "Antiquated village dredged out of time by Ygraine’s sorcery" },
  { id: "odd", label: "Odd", hex: "1403", page: 167, blurb: "Drifting on the borders of Fairy. Secret allies of the Drune" },
  { id: "orbswallow", label: "Orbswallow", hex: "1405", page: 171, blurb: "Mossling village in the deep fungal forest of Mulchgrove" },
  { id: "prigwort", label: "Prigwort", hex: "1106", page: 175, blurb: "Famed brewing and market town in the heart of the Wood" },
  { id: "woodcutters-encampment", label: "Woodcutters’ Encampment", hex: "1109", page: 183, blurb: "Archaic village of loggers and wood-crafters on the verge of Hag’s Addle" },
];

/**
 * Each settlement's two d6 tables.
 *
 * Kept verbatim, page references and all: several entries name a local by name
 * and page, and stripping those to "an NPC" would take out the one thing that
 * makes the entry usable at the table. Nothing else of the settlement chapters
 * is copied here — the descriptions, the map keys, and the NPCs themselves stay
 * in the book.
 */
export const SETTLEMENT_ENCOUNTERS: Record<Settlement, { day: string[]; night: string[] }> = {
  "blackeswell": {
    day: [
      "Father Bertil (p126) snooping disapprovingly around Klepp’s workshop, trying to peek through the shutters.",
      "A ruined building collapses. 2d4 villagers begin clearing the rubble.",
      "2d4 villagers erect precarious ladders and scaffolds around the church, preparing to clean its exterior.",
      "2d4 mercenaries (Level 1 fighters—DMB) roll up in 1d4 wagons and proceed to unload at Klepp’s workshop.",
      "2d4 villagers hauling barrels of stinking water from the Blacke to the Fishfop brewery.",
      "2d4 mosslings (DMB) arrive to trade.",
    ],
    night: [
      "The landlady, Gilly-Ann Locke (p126), capering giddily through the square, singing raunchy ballads.",
      "The innkeeper, Arbie Snyde (p126), poking around a derelict building, looking for abandoned treasures.",
      "Sylvain Aster loitering by Klepp’s workshop, listening for the tell-tale sounds of black magic.",
      "The clockwork guardian (p127) bursts out of Klepp’s workshop and runs amok.",
      "An adventuring party (DMB) arrives, covered in sticky orange slime. (They have travelled through the fungal chasm in hex 1605.)",
      "A hungry ochre slime-hulk (DMB) wanders through, sniffing out fresh flesh.",
    ],
  },
  "castle-brackenwold": {
    day: [
      "1d4 longhorns (DMB) and 3d6 shorthorns (DMB)— emissaries of Lord Ramius (p65) sent to the duke.",
      "A pickpocket (Level 1 thief—DMB) charging through the streets, 2d4 soldiers of the town watch pursuing.",
      "20 musicians and carts laden with fancy, orchestral instruments, heading to the Chateau.",
      "A grimalkin (DMB) pedlar laden with herbs to sell to Mistress Waldefroum (p135).",
      "12 pilgrims on their way to the Cathedral of St Signis.",
      "Captain Bogle (p131) and 2d6 nobles (Level 1 knights— DMB) returning from the hunt with several stag heads.",
    ],
    night: [
      "2d4 clerics of St Faxis (Level 1 clerics—DMB) carrying a cloaked man (allegedly a Drune) in silver chains to the holy gaol in the Seminary of the 100 Martyrs.",
      "A troupe of jugglers, fire breathers, and thespians performing in a public square. Pickpockets are rife.",
      "2d4 thieves (Level 1—DMB) sneaking to the Frolicke, seeking a secret passage beneath a merman statue.",
      "A young woman with a curious glint in her eyes (charmed) bearing a report from the Drune to ﻿Bishop Sanguine (p69) on the doings of the Cold Prince.",
      "An adventuring party (DMB) bringing a bound fire elemental (DPB) to Professor Woglemain (p134).",
      "2d4 soldiers of the town watch questioning passersby.",
    ],
  },
  "cobton-on-the-shiver": {
    day: [
      "1d4 cackling crookhorn guards tripping passersby.",
      "2 moles flounder in the river, their boat capsized.",
      "One of the mouse millers (see the Water Mill) with a glazed expression, gazing into empty space.",
      "2d3 crookhorn guards round up everyone in the village to the church to celebrate the Nag-Lord’s birthday (of which there are several per year).",
      "The public hanging of the rat Hackle Kingsley, who has been lingering in the gaol for some months.",
      "1d4 crookhorn guards drag a yelping rabbit—caught with a knife longer than the permitted 6″—to the gaol.",
    ],
    night: [
      "1d3 heretical mice remove the hanged hares from the village square and replace them with unicorn effigies.",
      "Briggsy Bugber (p138) slipping into the mill’s back door to consult with Old Madame Whipthorn (p139).",
      "Loud cheers and merry singing drift from the Dobble-down Tea Rooms—a birthday party.",
      "1d4 crookhorn guards enforcing an impromptu curfew.",
      "Briggsy Bugber (p138) and 2d4 crookhorn guards march through the streets to welcome a visiting party including Baron Fragglehorn (p46) himself.",
      "Wallobry Trundlehorn sneaking round the back of the Shiverston Brewery for a secret meeting of the Grey League.",
    ],
  },
  "dreg-and-shantywood-isle": {
    day: [
      "1d4 longhorns (DMB)—knights in the service of Lord Malbleat (p64)—charge into town, bearing urgent news to Berkmaster Monocleese.",
      "Brother Hogbeard and 1d3 zealots approach PCs asking for a donation to their cause.",
      "2d3 fishermen come to blows outside the Smokehouse over a disagreement about who owns a batch of fish.",
      "1d4 town guards chase a pickpocket through the streets. Onlookers jeer and throw fish guts.",
      "1d4 shifty lads (members of the Boghouse Boys—see p145) staking out the Berkmaster’s manor.",
      "1d3 Hogbeard’s zealots drag a “sinner” to the church.",
    ],
    night: [
      "1d4+1 thugs (as Level 1 thieves—DMB) follow an old lady (Tamrin Tweede, p142) into a dark alleyway. Loud cursing ensues, as the thugs are caught in her Web.",
      "1d4+1 thugs (as Level 1 thieves—DMB), looking for prey.",
      "1d3 farmhands drunkenly bragging about witch-hunting, on their way to a secret meeting in the Boghouse.",
      "A rowdy fistfight between 3d6 sailors (two rival gangs).",
      "2d3 Hogbeard’s zealots, bearing torches, dragging a blindfolded “sinner” into the woods for exorcism.",
      "Folk stumble indoors as a thick mist rolls off the river.",
    ],
  },
  "fort-vulgar": {
    day: [
      "Dockmaster Bogleman (p148) laden with baskets of crab apples or freshly trapped honey badgers.",
      "Father Drabe (p149) chasing after hand-lettered scriptural verses, blown away by a capricious wind.",
      "1d3 knights arguing with a boatman about the taxable value of his wares.",
      "1d3 merchants looking to hire caravan guards. Offering 5gp per person to Castle Brackenwold.",
      "A toothless old Chooker, prophesying doom for all mortals in the insatiable belly of Big Chook.",
      "1d4+1 northerners harassing a meek squire.",
    ],
    night: [
      "1d3 crookhorns (DMB) snoop around in the shadows.",
      "2d6 barge-folk prancing drunkenly on the lakeside cliffs, shouting “come and get us Chookie!”",
      "1d4+1 Chookers circle around passersby, making aggressive clucking and cock-a-doodle-do noises.",
      "A knight in the service of Lady Harrowmoor (p60) charging to the keep, bringing tidings of a force of crookhorns amassing at the ruined abbey (hex 0906).",
      "2d6 zombies, riddled with blood-red worms, emerge from the soil of the soured orchard and go hunting for live brains.",
      "The cockerel-like wailings of Big Chook echo across the lake. Chookers rejoice; others rush indoors.",
    ],
  },
  "high-hankle": {
    day: [
      "2 dandies (Level 1 knights—DMB) duel in a square.",
      "2d4 town guards arresting 1d4 shorthorns (DMB) on false claims of smuggling, demanding a hefty bribe.",
      "2 griffons (DMB) shriek in battle above the Griffonry.",
      "3 grimalkins (DMB) in estray carrying the huge skull of a mogglewomp (DMB) to the Florid Envoy (p153).",
      "Sir Waverly “the Orange” (p152) and 4 knights (Level 3 knights—DMB) parade a noble, chained griffon (DMB) through the streets. Crowds of onlookers cheer.",
      "2d6 urchins roam the streets begging, on their way to their homes in the lower layer of the Escalade.",
    ],
    night: [
      "Venerable Adreline Sumner (p155) and 1d6 acolytes (Level 1 clerics—DMB) marching to the Silent Tower to consult the Order of St Signis on rumours of an undead plague around the ruins of Lankston (hex 0610).",
      "2d4 gentry raucously roam the streets, singing and laughing, after a night at the Balustrade.",
      "2d6 thieves (Level 1 thieves—DMB) set fire to the shop of an artisan who refused to pay their “protection” fees.",
      "A man lies dying, his face burned by acid. He is a guild thief who crossed Bagsley Corundum (p153).",
      "2d6 acolytes (Level 1 clerics—DMB) silently patrol.",
      "2d4 thieves furtively bringing fenced statuettes from Hankle Heirlooms into the lower levels of the Escalade.",
    ],
  },
  "lankshorn": {
    day: [
      "3d6 shorthorn (DMB) soldiers bringing a caged captive to Redwraith Manor for trial before Lord Malbleat.",
      "A company of 2d6 merchants (plus their guards— DMB) from Castle Brackenwold.",
      "A funeral procession of 3d6 townsfolk wearing wooden goat masks, led by Father Dobey (p158).",
      "Berkmaster Baldricke (p159) ordering folk around.",
      "Lord Malbleat (p64) and 2d4 longhorn (DMB) guards demanding impromptu taxes (10% of carried wealth).",
      "Sydewich Maldwort (p160) haggling with a loud foreign pedlar over the price of Memory Dust (p426).",
    ],
    night: [
      "1d4 masked townsfolk furtively daubing “MALBLEAT OUT!” on walls.",
      "2d6 ruffians (Level 1 thieves—DMB), looking for trouble.",
      "3d6 sprites (DMB) causing mischief.",
      "Father Dobey (p158) sneaking into the woods, via the secret passage in the church, to meet with a minion of Lord Malbleat.",
      "Lord Malbleat (p64), 2d4 shorthorn (DMB) guards, and 1d4 longhorn (DMB) nobles driving in a fancy carriage to the Hornstoat’s Rest to demand food and entertainment.",
      "Margerie Stallowmade (p159) gossiping with a barrowbogey (DMB) from hex 0810.",
    ],
  },
  "meagres-reach": {
    day: [
      "1d3 Elders gathered in the village square, cleaning the Frozen with soapy cloths.",
      "12 immigrant brickworkers roll into the village with cartload of iridescent clay from the Dark Mirror.",
      "Panic in the village as a fire breaks out in the brickyard.",
      "Benedict Redhearth (p164) and Reynold Barhaim (p162) quarrel loudly in the village square.",
      "A woman tearfully asking if any have seen her husband, Jock, who has not returned from hunting.",
      "Sister Delora (p164) loudly expels Benedict Redhearth (p164) from the church, stating that malcontents are unwelcome at her services.",
    ],
    night: [
      "A scuffle between 2d6 Redhearth’s Rebels (p164) and a like number of Loyalist brickworkers.",
      "An adventuring party (DMB) carries the bloody, decapitated head of a bestial centaur (DMB) to Smarg’s Turret.",
      "Benedict Redhearth (p164) drunkenly rages through the village, urging all Reach-folk to take up arms and storm Chateau Mauvesse.",
      "A drunk claims the Frozen have returned to life.",
      "A sombre procession through Everslumber Lane, bearing the bones of honoured ancestors.",
      "All-night festivities at the Grizzle and Grouse, as the landlord attempts to find a suitor for his daughter.",
    ],
  },
  "odd": {
    day: [
      "3d6 villagers waving animal heads and pelts on poles, parading to the beast saint statue.",
      "A madcap chase through the village: 1d4 villagers pursuing a mud-spattered pig, escaped from its pen.",
      "A company of 1d4 merchants (DMB) and their guards, heading to the lodge to buy fur garments.",
      "A braithmaid (DMB) bringing a note to the headman.",
      "An elf knight (DMB) in the service of Duke Mai-Fleur, seeking three poachers believed to be in Odd. She pays 30 coins of fairy silver (5gp each) for their capture.",
      "2d4 mosslings (DMB) stumble bleary-eyed into the village, asking for directions to the Sombre Lamb inn.",
    ],
    night: [
      "2d6 drunkards (as Level 1 thieves—DMB) looking for trouble with outsiders.",
      "1d3 Drune cottagers (DMB) slipping into the church, carrying a woman bound in bandages upon a bier.",
      "A monster (roll on the Monsters encounter table, see p114) wanders out of the woods and into the village.",
      "An adventuring party (DMB) with a cart-load of grave goods from the barrows in hex 1504 creep toward the home of the sage, seeking his aid.",
      "A wandering friar (DMB) irately tearing the “sacrilegious” adornments from the beast saint statue.",
      "Briggle (the sage’s grandson) trysting in the churchyard with a braithmaid (DMB).",
    ],
  },
  "orbswallow": {
    day: [
      "A mossling explodes in a puff of slime and spores. This is regarded as a blessing from Blosquom (p173).",
      "1d3 giant mutant snails (DMB) slither into the village and attack the trees.",
      "1d3 traders (Level 1 hunters—DMB) come to buy pipes.",
      "An ochre slime-hulk (DMB) wanders through the village. It ignores mosslings, but attacks others.",
      "3d6 mosslings dance through the village to music played on pot-bellied gourd pipes from the Pipetree.",
      "2d4 nutcaps (DMB) make an aerial raid on the fruits of one of the three trees (roll 1d3 and consult map key).",
    ],
    night: [
      "Coming of age ceremony: a young mossling is bathed in hog-cream beneath the Weaning Arch.",
      "A mushroom-addled mossling stumbles around, ranting about “the coming age of the Myconom.”",
      "An adventuring party (DMB) brings a corpse to the fungal shrine for spore infestation.",
      "2d6 mosslings from an outlying community arrive for a rollicking night out “on the town.” It is difficult for anyone to get any sleep during the ensuing rumpus.",
      "3d6 mosslings singing and making offerings at the fungal shrine. The smiling face of Blosquom (p173) manifests and croons along.",
      "2d4 nutcaps (DMB) make an aerial raid on the fruits of one of the three trees (roll 1d3 and consult map key).",
    ],
  },
  "prigwort": {
    day: [
      "A pedlar bearing bags of fresh herbs to Wyrmspittle’s.",
      "One of Mostlemyre Drouge’s (p180) enigmatic black-wreathed servitors running errands around town.",
      "1d3 Brewmasters overseeing transport of a giant vat of liquid to the Town Hall.",
      "Hague Jerricorn (p178) arguing with a raggedy sailor over the authenticity of an old map she is clutching.",
      "Captain Hogwash (p176) loudly leading wagon-loads of stone to the construction site beside the Abbey Gate.",
      "Dozens of locals bearing the insignia of one of the noble brewing houses, rolling kegs through the streets.",
    ],
    night: [
      "2d3 town guards dragging 1d4 protesting youths (members of Austache’s Bounders—p181) to the gaol.",
      "Austache (p181) and 2d4 gang members drunkenly accosting 1d4 shorthorn travellers on their way to the Oaf in the Oast for a soothing bath.",
      "A Brewmaster surreptitiously reading a note written in glowing golden Sylvan script (from the ﻿Earl of Yellow, promising a shipment of “languid evermore”).",
      "1d6 revellers singing the praises of Maydrid Hydball (p178), whom they all profess their undying love for.",
      "Brash war horns ring out in the woods as a troop of 3d6 crookhorns (DMB) harries 1d6 lost pilgrims.",
      "Wyrmspittle (p179) smoking with a mossling (DMB).",
    ],
  },
  "woodcutters-encampment": {
    day: [
      "Folk flee logs tumbling off a collapsed logging cart. (The Referee may optionally call for a Save Versus Ray to jump out of the way or suffer 1d4 damage.)",
      "A family takes a sickly child to the Kissing Stone.",
      "Father Horsely (p185) leaving for Hag’s Addle, with his dog and a partial map, which he hopes to expand.",
      "A mossling pedlar laden with pipeleaf asks the way to Marrowbold’s Smoke Shop.",
      "Merry locals bedecked with garlands dance through the streets to a wedding at the Oistace Tree.",
      "An elder Woodcutter, dressed in traditional green tweed jacket and tight white breeches, scolds 1d3 youths for disrespectfully laughing beneath an elm.",
    ],
    night: [
      "A tipsy local tolling the Drounbell with mad vigour.",
      "Hagbard Sundiman (p184) and 1d4 Woodcutter elders sneaking off to Ferneddbole House (hex 1209) to spy on the Jollie Oistace, making plans to exorcise him.",
      "Father Horsely (p185) rushes into the village, wide-eyed and bedraggled after a face-to-face encounter with the Hag (p82) in the swamp.",
      "A lost soul (DMB) wanders in from Hag’s Addle.",
      "1d6 bog corpses (DMB) stumble out of the swamp.",
      "Jock Furngle (p185) furtively examining fungal specimens brought by a black-cloaked individual.",
    ],
  },
};

export function settlementInfo(id: Settlement | undefined) {
  return SETTLEMENTS.find((s) => s.id === id);
}
