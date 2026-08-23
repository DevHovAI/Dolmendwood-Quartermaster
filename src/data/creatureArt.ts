/**
 * A picture for a creature the module puts on the map.
 *
 * None of the books' artwork is shipped or ever will be — these are Foundry's
 * own bundled icons, which every installation already has. The point is not
 * likeness: it is that four different things standing in a clearing look like
 * four different things. A Referee who has placed goblins, wolves and a swarm
 * of stirges needs to tell them apart at a glance, and three identical grey
 * circles is what that looks like without this.
 *
 * **Chosen by name, not at random.** The same creature gets the same picture
 * every time, in this world and in everybody else's, because the choice is a
 * hash of its name. Two species that fall into the same family are pulled apart
 * by that hash, which is why every family is a list rather than one file.
 */

const ART = "icons/creatures";
const ENV = "icons/environment/creatures";
const PEOPLE = "icons/environment/people";

/** Families, each with enough variants that neighbours rarely collide. */
const FAMILIES: Record<string, string[]> = {
  wolf: [
    `${ART}/mammals/wolf-howl-moon-gray.webp`,
    `${ART}/mammals/wolf-howl-moon-black.webp`,
    `${ART}/mammals/wolf-howl-moon-forest-blue.webp`,
    `${ART}/mammals/humanoid-wolf-dog-blue.webp`,
    `${ART}/mammals/wolf-shadow-black.webp`,
    `${ART}/mammals/dog-husky-white-blue.webp`,
    `${ART}/abilities/wolf-howl-moon-white.webp`,
    `${ART}/abilities/wolf-heads-swirl-purple.webp`,
  ],
  horse: [
    `${ENV}/horse-brown.webp`,
    `${ENV}/horse-tan.webp`,
    `${ENV}/horse-white.webp`,
    `${ENV}/horses.webp`,
  ],
  adventurer: [
    `${PEOPLE}/archer.webp`,
    `${PEOPLE}/cleric-grey.webp`,
    `${PEOPLE}/cleric-orange.webp`,
    `${PEOPLE}/infantry.webp`,
    `${PEOPLE}/infantry-armored.webp`,
    `${PEOPLE}/spearfighter.webp`,
    `${PEOPLE}/cavalry.webp`,
    `${PEOPLE}/cavalry-heavy.webp`,
    `${PEOPLE}/charge.webp`,
  ],
  deer: [
    `${ART}/mammals/deer-antlers-green.webp`,
    `${ART}/mammals/deer-antlers-blue.webp`,
    `${ART}/mammals/elk-moose-marked-green.webp`,
    `${ART}/mammals/deer-movement-leap-green.webp`,
  ],
  bat: [
    `${ART}/mammals/bat-giant-tattered-purple.webp`,
    `${ART}/mammals/bats-movement-flying-black.webp`,
    `${ART}/mammals/bat-movement-flying-purple.webp`,
  ],
  goat: [
    `${ART}/mammals/goat-horned-blue.webp`,
    `${ART}/mammals/bull-horned-blue.webp`,
    `${ART}/mammals/ox-buffalo-horned-green.webp`,
    `${ART}/mammals/livestock-pig-green.webp`,
  ],
  rodent: [
    `${ART}/mammals/rodent-rat-green.webp`,
    `${ART}/mammals/rodent-rat-diseaed-gray.webp`,
    `${ART}/mammals/rabbit-movement-glowing-green.webp`,
  ],
  cat: [
    `${ART}/mammals/cat-hunched-glowing-red.webp`,
    `${ART}/mammals/humanoid-cat-skulking-teal.webp`,
    `${ART}/abilities/cougar-pounce-stalk-black.webp`,
  ],
  bear: [
    `${ART}/abilities/bear-roar-bite-brown.webp`,
    `${ART}/abilities/bear-roar-bite-brown-green.webp`,
    `${ART}/claws/claw-bear-paw-swipe-brown.webp`,
  ],
  beast: [
    `${ART}/mammals/beast-horned-scaled-glowing-orange.webp`,
    `${ART}/mammals/livestock-cow-green.webp`,
    `${ART}/mammals/livestock-sheep-green.webp`,
    `${ART}/mammals/spirit-deer-herd-blue.webp`,
  ],
  bird: [
    `${ART}/birds/raptor-hawk-flying.webp`,
    `${ART}/birds/raptor-owl-flying-moon.webp`,
    `${ART}/birds/corvid-flying-wings-purple.webp`,
    `${ART}/birds/birds-flock-fly-yellow.webp`,
    `${ART}/birds/songbird-yellow-flying.webp`,
    `${ART}/birds/chicken-hen-green.webp`,
  ],
  spider: [
    `${ART}/invertebrates/spider-mandibles-brown.webp`,
    `${ART}/invertebrates/spider-dotted-green.webp`,
    `${ART}/invertebrates/spider-pink-purple.webp`,
    `${ART}/invertebrates/spider-large-white-green.webp`,
  ],
  bug: [
    `${ART}/invertebrates/beetle-stag-tan-brown.webp`,
    `${ART}/invertebrates/centipede-brown.webp`,
    `${ART}/invertebrates/ant-strength-green.webp`,
    `${ART}/invertebrates/bug-sixlegged-gray.webp`,
    `${ART}/invertebrates/beetle-grub-larvae-gray.webp`,
    `${ART}/invertebrates/snail-movement-green.webp`,
    `${ART}/invertebrates/leech-attack-green.webp`,
    `${ART}/invertebrates/scorpion-yellow.webp`,
    `${ENV}/bug-beetle-horned-red.webp`,
    `${ENV}/bug-beetle-gold-green.webp`,
    `${ENV}/bug-worm-teeth-green.webp`,
    `${ENV}/bug-worm-pincer-pink.webp`,
    `${ENV}/bug-earthworm.webp`,
    `${ENV}/bug-caterpillar-dotted-green.webp`,
    `${ENV}/bug-tick-red.webp`,
  ],
  swarm: [
    `${ART}/invertebrates/wasp-swarm-attack.webp`,
    `${ART}/invertebrates/wasp-swarm-movement.webp`,
    `${ART}/invertebrates/bee-yellow.webp`,
    `${ART}/invertebrates/fly-wasp-mosquito-green.webp`,
  ],
  snake: [
    `${ART}/reptiles/snake-fangs-bite-green.webp`,
    `${ART}/reptiles/serpent-horned-green.webp`,
    `${ART}/reptiles/snake-poised-white.webp`,
  ],
  reptile: [
    `${ART}/reptiles/lizard-iguana-green.webp`,
    `${ART}/reptiles/chameleon-camouflage-green-brown.webp`,
    `${ART}/reptiles/turtle-shell-glowing-green.webp`,
  ],
  frog: [
    `${ART}/amphibians/bullfrog-glowing-green.webp`,
    `${ART}/amphibians/frog-water-teal.webp`,
    `${ART}/amphibians/treefrog-leaf-green.webp`,
  ],
  fish: [
    `${ART}/fish/fish-carp-green.webp`,
    `${ART}/fish/fish-grouper-tan.webp`,
    `${ART}/fish/fish-pirahna-tan.webp`,
    `${ART}/fish/fish-bluefin-yellow-blue.webp`,
    `${ART}/fish/crab-blue-purple.webp`,
    `${ENV}/fish-trout-grey.webp`,
    `${ENV}/fish-angler-blue.webp`,
    `${ENV}/fish-spotted-orange.webp`,
    `${ENV}/fish-horned-yellow.webp`,
    `${ENV}/crustacean-crab-yellow.webp`,
  ],
  dragon: [
    `${ART}/reptiles/dragon-winged-blue.webp`,
    `${ART}/reptiles/dragon-horned-blue.webp`,
    `${ART}/abilities/dragon-breath-purple.webp`,
  ],
  fairy: [
    `${ART}/magical/fae-fairy-winged-glowing-green.webp`,
    `${ART}/magical/spirit-mischief-fire-blue.webp`,
    `${ART}/magical/spirit-mischief-fire-ice-blue.webp`,
    `${ART}/magical/humanoid-silhouette-glowing-pink.webp`,
    `${ART}/magical/spirit-fear-energy-pink.webp`,
    `${ART}/magical/spirit-poison-smoke-green.webp`,
    `${ART}/magical/spirit-fire-yellow.webp`,
    `${ART}/magical/spirit-earth-stone-magma-yellow.webp`,
    `${ART}/eyes/humanoid-single-purple-blue.webp`,
  ],
  undead: [
    `${ART}/magical/spirit-undead-ghost-blue.webp`,
    `${ART}/magical/spirit-undead-horned-blue.webp`,
    `${ART}/magical/spirit-undead-masked-blue.webp`,
    `${ART}/magical/spirit-undead-winged-ghost.webp`,
    `${ART}/magical/spirit-undead-ghost-purple.webp`,
    `${ART}/magical/spirit-undead-ghost-tan-teal.webp`,
  ],
  construct: [
    `${ART}/magical/construct-gargoyle-stone-gray.webp`,
    `${ART}/magical/construct-stone-earth-gray.webp`,
    `${ART}/magical/construct-golem-stone-blue.webp`,
    `${ART}/magical/construct-face-stone-pink.webp`,
  ],
  ooze: [
    `${ART}/slimes/slime-movement-pseudopods-green.webp`,
    `${ART}/slimes/slime-face-teeth-purple.webp`,
    `${ART}/slimes/slime-bubble-teal.webp`,
    `${ART}/slimes/slime-movement-swirling-blue.webp`,
    `${ART}/slimes/slime-movement-splashing-yellow.webp`,
  ],
  plant: [
    `${ART}/tentacles/tentacle-earth-green.webp`,
    `${ART}/tentacles/tentacles-thing-green.webp`,
    `${ART}/invertebrates/snail-spiral-green.webp`,
  ],
  fungus: [
    `${ART}/slimes/slime-face-hollow-green.webp`,
    `${ART}/slimes/bubbling-purple.webp`,
    `${ART}/tentacles/tentacles-eyes-poisoned-green.webp`,
  ],
  demon: [
    `${ART}/unholy/demon-horned-black-yellow.webp`,
    `${ART}/unholy/demon-fanged-horned-yellow.webp`,
    `${ART}/unholy/demon-winged-horned-orange.webp`,
    `${ART}/unholy/demon-hairy-winged-pink.webp`,
  ],
  monstrosity: [
    `${ART}/magical/humanoid-giant-forest-blue.webp`,
    `${ART}/magical/humanoid-horned-rider.webp`,
    `${ART}/abilities/mouth-teeth-rows-red.webp`,
    `${ART}/eyes/void-single-black-purple.webp`,
    `${ART}/tentacles/tentacle-eyes-yellow-pink.webp`,
    `${ART}/abilities/fang-tooth-venomous.webp`,
    `${ENV}/monster-barbed-carapace-purple.webp`,
    `${ENV}/monster-tentacles-eye-purple.webp`,
    `${ART}/abilities/mouth-teeth-misshapen-pink.webp`,
    `${ART}/eyes/humanoid-single-yellow.webp`,
    `${ART}/claws/claw-curved-jagged-yellow.webp`,
    `${ART}/abilities/tail-strike-bone-orange.webp`,
  ],
  mortal: [
    `${ART}/magical/humanoid-silhouette-green.webp`,
    `${ART}/magical/humanoid-silhouette-dashing-blue.webp`,
    `${ART}/magical/humanoid-silhoette-alien-gray.webp`,
    `${ART}/magical/humanoid-silhouette-aliens-green.webp`,
    `${PEOPLE}/commoner.webp`,
    `${PEOPLE}/group.webp`,
    `${PEOPLE}/infantry-army.webp`,
    `${PEOPLE}/cleric-orange.webp`,
    `${PEOPLE}/archer.webp`,
  ],
};

/**
 * Words in a creature's name that decide its family outright.
 *
 * Read in order, so the specific beats the general: a swamp spider is a spider
 * before it is anything else, and a wolf spider would be too.
 */
const BY_NAME: [RegExp, string][] = [
  [/spider|arachn/i, "spider"],
  [/wolf|hound|\bdog\b|jackal/i, "wolf"],
  [/deer|stag\b|\belk\b|antler/i, "deer"],
  [/\bbats?\b/i, "bat"],
  [/breggle|goat|crookhorn|longhorn|\box\b|\bbull\b|\bcow\b|sheep|swine|\bboar\b|\bpig\b/i, "goat"],
  [/\brats?\b|mouse|\bmole\b|rodent|rabbit|\bhare\b|squirrel|weasel|badger|puggle/i, "rodent"],
  [/\bcats?\b|grimalkin|lynx|panther|cougar/i, "cat"],
  [/bear/i, "bear"],
  [/\bbees?\b|wasp|hornet|swarm|stirge|\bfly\b|midge|termite/i, "swarm"],
  [/beetle|\bants?\b|centipede|worm|grub|leech|slug|snail|scorpion|\btick\b|\bbugs?\b/i, "bug"],
  [/snake|serpent|adder|python|viper/i, "snake"],
  [/lizard|\bnewt\b|salamander|turtle|tortoise|chameleon/i, "reptile"],
  [/frog|toad/i, "frog"],
  [/fish|\bpike\b|catfish|\bcarp\b|\beel\b|\bcrab\b|trout|perch/i, "fish"],
  [/dragon|drake|wyrm|wyvern/i, "dragon"],
  [/horse|steed|\bmare\b|pony|mount\b|donkey|\bmule\b/i, "horse"],
  [/\bbird\b|hawk|\bowl\b|crow\b|raven|corvid|lurkey|merriman|gobble|\bwoad\b|falcon|griffon/i, "bird"],
  [/ghost|wraith|spectre|specter|skeleton|zombie|barrow|wight|banshee|shadow|revenant|haunt/i, "undead"],
  [/gargoyle|golem|statue|scarecrow|construct/i, "construct"],
  [/ooze|slime|jelly|pudding|gelatin/i, "ooze"],
  [/fungus|mushroom|mould|mold|spore|shroom/i, "fungus"],
  [/demon|devil|fiend|\bimps?\b/i, "demon"],
  [/treant|vine|bramble|thorn|root|blossom|flower|weed|plant|moss/i, "plant"],
  [/\belf\b|elves|elf—|fairy|faerie|sprite|pixie|grue|redcap|goblin|\bhob\b|drune|nixie|glaistig/i, "fairy"],
];

/** The size/type line's own word for what this is, where the name gave nothing. */
const BY_KIND: [RegExp, string][] = [
  [/Undead/i, "undead"],
  [/Bug/i, "bug"],
  [/Fairy/i, "fairy"],
  [/Ooze/i, "ooze"],
  [/Fungus/i, "fungus"],
  [/Construct/i, "construct"],
  [/Dragon/i, "dragon"],
  [/Plant/i, "plant"],
  [/By Kindred/i, "adventurer"],
  [/Demi|Kindred|Mortal/i, "mortal"],
  [/Monstrosity/i, "monstrosity"],
  [/Animal/i, "beast"],
];

/**
 * Stable, name-derived, and spread evenly enough over a short list.
 *
 * FNV-1a rather than the usual `× 31`, because the names that need telling
 * apart are the ones that look alike — "Wolf" and "Wolf, Dire" landed on the
 * same picture under a weaker mix, which is precisely the case this exists for.
 */
function hash(text: string): number {
  let value = 0x811c9dc5;
  for (const character of text.toLowerCase()) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

/**
 * The picture for one creature: the same one every time, different from its
 * neighbour's.
 */
export function creatureArt(name: string, kind?: string): string {
  const family =
    BY_NAME.find(([pattern]) => pattern.test(name))?.[1] ??
    (kind ? BY_KIND.find(([pattern]) => pattern.test(kind))?.[1] : undefined) ??
    "monstrosity";
  const options = FAMILIES[family] ?? FAMILIES.monstrosity;
  return options[hash(name) % options.length];
}
