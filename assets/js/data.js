/* ==========================================================================
   VEDARA — Catalog data
   Single source of truth for products, ingredients and FAQs.
   Prices in USD (integers, whole dollars).
   ========================================================================== */

const INGREDIENTS = {
  brahmi: {
    name: "Brahmi",
    sanskrit: "ब्राह्मी",
    latin: "Bacopa monnieri",
    image: "assets/img/brahmi.svg",
    desc: "The creeping herb long called the herb of grace. Its fleshy paired leaves have been infused in warm oil for centuries as the primary coolant remedy for an overheated, irritated scalp.",
    use: "<b>Cools</b> an inflamed scalp and calms heat at the roots."
  },
  bhringraj: {
    name: "Bhringraj",
    sanskrit: "भृंगराज",
    latin: "Eclipta alba",
    image: "assets/img/bhringraj.svg",
    desc: "Literally king of herbs. Its white daisy-like flowers carry an unusual amount of eugenol, and shodhan churna made from it is the classical answer to thinning hair and premature greying.",
    use: "<b>Strengthens</b> roots and supports natural hair density."
  },
  tulsi: {
    name: "Tulsi",
    sanskrit: "तुलसी",
    latin: "Ocimum sanctum",
    image: "assets/img/tulsi.svg",
    desc: "Holy basil is the heart of Ayurvedic daily ritual. Warm tulsi oil is anointed to the chest, throat and scalp as a daily abhyanga to promote steadiness and resilience.",
    use: "<b>Purifies</b> and uplifts — the everyday tonic herb."
  },
  neem: {
    name: "Neem",
    sanskrit: "नीम",
    latin: "Azadirachta indica",
    image: "assets/img/neem.svg",
    desc: "India's most storied purifying botanical. Neem oil has been applied to the face and scalp for well over two millennia to clarify excess oil and settle blemishes.",
    use: "<b>Clarifies</b> excess sebum and calms blemish-prone skin."
  },
  ashwagandha: {
    name: "Ashwagandha",
    sanskrit: "अश्वगन्धा",
    latin: "Withania somnifera",
    image: "assets/img/ashwagandha.svg",
    desc: "The great restorative. Its warming root and leaf oils are massaged into the body to ease physical tension and to bring a sense of settled strength after long days.",
    use: "<b>Warms and restores</b> — ideal for a tired, aching body."
  },
  chandan: {
    name: "Chandan",
    sanskrit: "चन्दन",
    latin: "Santalum album",
    image: "assets/img/chandan.svg",
    desc: "The precious heartwood of Mysore sandalwood, ground fine and steeped cold. Classical facial oils pair it with rose to deliver a clear, lit-from-within complexion.",
    use: "<b>Brightens</b> tone and leaves skin cool to the touch."
  },
  amla: {
    name: "Amla",
    sanskrit: "आमलकी",
    latin: "Phyllanthus emblica",
    image: "assets/img/amla.svg",
    desc: "The richest natural source of vitamin C, and one of the three pillars of classical triphala. Amla oil is used to nourish the scalp and restore hair's natural sheen.",
    use: "<b>Restores</b> shine and softens rough, dry texture."
  },
  multani: {
    name: "Multani Mitti",
    sanskrit: "मुल्तानी मिट्टी",
    latin: "Fuller's earth",
    image: "assets/img/multani-mitti.svg",
    desc: "A mineral clay traded into Punjab for a thousand years and milled without heat, which keeps its minerals intact. It draws out deep-seated oil without stripping the skin.",
    use: "<b>Draws out</b> excess oil and refines the skin surface."
  },
  kalonji: {
    name: "Kalonji",
    sanskrit: "कालोंजी",
    latin: "Nigella sativa",
    image: "assets/img/kalonji.svg",
    desc: "Black seed, referred to in the Hadith as a seed of Paradise. Its warm, peppery oil is a restorative body massage oil that leaves skin notably supple.",
    use: "<b>Warms</b> deep — eases tight muscles and cold skin."
  },
  aloe: {
    name: "Aloe Vera",
    sanskrit: "कुमारी",
    latin: "Aloe barbadensis",
    image: "assets/img/aloe.svg",
    desc: "Kumari, the girl, is the cooling counterpart to warming oils. Blended at a low percentage it soothes heat rash, sun redness and the aftermath of a hard workout.",
    use: "<b>Soothes</b> heat, redness and irritation instantly."
  }
};

const CATEGORIES = [
  { id: "hair",    label: "Hair & Scalp" },
  { id: "skin",    label: "Skin & Face" },
  { id: "body",    label: "Body & Massage" },
  { id: "calm",    label: "Calm & Sleep" }
];

const CONCERNS = [
  { id: "hairfall",  label: "Hair fall" },
  { id: "dandruff",  label: "Dandruff" },
  { id: "acne",      label: "Acne & blemishes" },
  { id: "dryness",   label: "Dryness" },
  { id: "dullness",  label: "Dullness" },
  { id: "tension",   label: "Tension & aches" },
  { id: "stress",    label: "Stress" },
  { id: "sensitivity", label: "Sensitivity" }
];

const SKIN_TYPES = [
  { id: "all",      label: "All skin types" },
  { id: "dry",      label: "Dry" },
  { id: "oily",     label: "Oily" },
  { id: "normal",   label: "Normal" },
  { id: "sensitive", label: "Sensitive" }
];

/* --- Products ----------------------------------------------------------- */
const PRODUCTS = [
  {
    id: "brahmi-bhringraj",
    name: "Brahmi & Bhringraj Scalp Oil",
    subtitle: "Cooling · Strengthening · 100ml",
    category: "hair",
    concerns: ["hairfall", "dandruff"],
    skin: "all",
    price: 34,
    was: 42,
    art: "bhringraj",
    tag: "Bestseller",
    tagStyle: "gold",
    rating: 4.9,
    reviews: 412,
    short: "A cooling midnight ritual that cools the scalp, curbs shedding and strengthens roots from within.",
    story: "Ayurveda reads an overheated scalp as the root of most shedding. This is the classical answer — a cool, weightless oil built on Brahmi and Bhringraj that sinks in fast, never greasy, and is meant for a weekly ritual before bed.",
    benefits: [
      "Visibly reduces daily shedding within 8–10 weeks",
      "Relieves flaking, itch and a hot, tight scalp",
      "Supports new growth along the hairline and parting",
      "Non-greasy finish — safe to use overnight"
    ],
    howTo: [
      "Part the hair into sections and warm 5–8 drops between the palms.",
      "Massage into the scalp in firm circles for five full minutes.",
      "Leave overnight or for at least two hours, then rinse with lukewarm water.",
      "Use twice weekly, or nightly in the first month."
    ],
    keyIngredients: ["brahmi", "bhringraj", "tulsi"],
    fullIngredients: "Cocos nucifera (coconut) oil, Sesamum indicum (sesame) oil, Bacopa monnieri (brahmi) extract, Eclipta alba (bhringraj) extract, Ocimum sanctum (tulsi) extract, Rosmarinus officinalis (rosemary) leaf oil, Tocopherol.",
    volume: "100 ml / 3.38 fl oz"
  },
  {
    id: "chandan-rose",
    name: "Rakta Chandan Facial Oil",
    subtitle: "Brightening · Cooling · 50ml",
    category: "skin",
    concerns: ["dullness", "acne", "dryness"],
    skin: "all",
    price: 42,
    was: 52,
    art: "chandan",
    tag: "New",
    tagStyle: "terra",
    rating: 4.8,
    reviews: 268,
    short: "Mysore sandalwood and rose, steeped cold for a clear, lit-from-within complexion.",
    story: "Rakta chandan — red sandalwood — is the classical cooling tonic for rakta dhatu, or the skin-bearing tissue. Ground fine and steeped in cold-pressed sesame for twenty-one days, it brings a clarity that no acid blend promises.",
    benefits: [
      "Evens tone and softens the look of old marks",
      "Calms the flush of active blemishes overnight",
      "Deeply hydrates without any oily residue",
      "A naturally cooling finish — ideal for Indian summers"
    ],
    howTo: [
      "Warm three drops between the palms.",
      "Press gently over cleansed, slightly damp skin.",
      "Leave to absorb for five minutes, then finish with a mist of rose water.",
      "Use every night, or three nights a week in cooler months."
    ],
    keyIngredients: ["chandan", "amla", "aloe"],
    fullIngredients: "Sesamum indicum (sesame) oil, Santalum album (sandalwood) extract, Rosa damascena (rose) oil, Phyllanthus emblica (amla) extract, Aloe barbadensis leaf juice, Tocopherol.",
    volume: "50 ml / 1.69 fl oz"
  },
  {
    id: "kansa-body",
    name: "Kansa Ayurvedic Body Oil",
    subtitle: "Nourishing · Warming · 200ml",
    category: "body",
    concerns: ["dryness", "tension"],
    skin: "dry",
    price: 48,
    was: 0,
    art: "kalonji",
    tag: "Ayurveda Classic",
    tagStyle: "",
    rating: 4.9,
    reviews: 631,
    short: "The everyday abhyanga oil, blended for bronzed kansa vessels and deep, lasting softness.",
    story: "Kansa is the copper vessel that has carried oil across the subcontinent for millennia. This blend is built to be massaged slow and firm — Ashwagandha for the ache, Kalonji for the warmth, Multani Mitti for a skin that feels newly made.",
    benefits: [
      "Relieves stiffness after long hours of sitting or travel",
      "Deeply nourishes chronically dry, rough skin",
      "Gives skin a warm, satin slip that lasts all day",
      "Safe over the body and hair tips alike"
    ],
    howTo: [
      "Warm a generous amount until it turns liquid and fragrant.",
      "Massage into warm, slightly damp skin in upward strokes.",
      "For abhyanga, leave for twenty minutes before a warm bath.",
      "Use daily, before the shower, in any season."
    ],
    keyIngredients: ["ashwagandha", "kalonji", "amla"],
    fullIngredients: "Sesamum indicum (sesame) oil, Cocos nucifera (coconut) oil, Withania somnifera (ashwagandha) extract, Nigella sativa (black seed) oil, Phyllanthus emblica (amla) extract, Kaolin (fuller's earth), Tocopherol.",
    volume: "200 ml / 6.76 fl oz"
  },
  {
    id: "tulsi-neem",
    name: "Tulsi Neem Clarifying Oil",
    subtitle: "Purifying · Balancing · 75ml",
    category: "skin",
    concerns: ["acne", "sensitivity"],
    skin: "oily",
    price: 29,
    was: 36,
    art: "neem",
    tag: "Bestseller",
    tagStyle: "gold",
    rating: 4.7,
    reviews: 519,
    short: "A fast-absorbing clarifying oil for congested, blemish-prone skin. No stripping, no rebound.",
    story: "Most clarifying oils strip, then rebound harder. This one does not. Tulsi and Neem are slow-infused into a light jojoba base so the active botanicals arrive without the industrial slap.",
    benefits: [
      "Clears congestion across the forehead and T-zone",
      "Visibly calms active, angry blemishes",
      "Balances oil over time rather than drying it out",
      "Non-comedogenic — layers cleanly under make-up"
    ],
    howTo: [
      "Three to four drops onto cleansed skin.",
      "Press into areas of congestion; do not rub.",
      "Follow with a light moisturiser once absorbed.",
      "Use nightly until the skin settles, then twice weekly."
    ],
    keyIngredients: ["neem", "tulsi", "multani"],
    fullIngredients: "Simmondsia chinensis (jojoba) seed oil, Azadirachta indica (neem) oil, Ocimum sanctum (tulsi) extract, Kaolin (fuller's earth), Melaleuca alternifolia (tea tree) oil, Tocopherol.",
    volume: "75 ml / 2.54 fl oz"
  },
  {
    id: "ashwagandha-night",
    name: "Ashwagandha Night Oil",
    subtitle: "Restorative · Sleep · 150ml",
    category: "calm",
    concerns: ["stress", "tension"],
    skin: "all",
    price: 39,
    was: 46,
    art: "ashwagandha",
    tag: "New",
    tagStyle: "terra",
    rating: 4.9,
    reviews: 197,
    short: "A slow, warm evening massage oil formulated to help the body clock down toward sleep.",
    story: "Ayurvedic sleep practice begins with the body, not the mind. Warm Ashwagandha, Shatavari and a whisper of vetiver — massaged at night — is the oldest way to tell the nervous system the day is done.",
    benefits: [
      "Dissipates the physical tension held through the day",
      "Warms cold hands and feet at bedtime",
      "Calming by scent alone — no synthetic fragrance",
      "Smooths rough, un-nourished skin overnight"
    ],
    howTo: [
      "Massage into the soles of the feet, palms, shoulders and back.",
      "Use a slow, circular rhythm for five minutes.",
      "Cover with cotton and leave overnight.",
      "Use nightly, ideally ninety minutes before sleep."
    ],
    keyIngredients: ["ashwagandha", "kalonji", "tulsi"],
    fullIngredients: "Sesamum indicum (sesame) oil, Withania somnifera (ashwagandha) root extract, Asparagus racemosus (shatavari) extract, Nigella sativa (black seed) oil, Vetiveria zizanioides (vetiver) root oil, Ocimum sanctum (tulsi) extract, Tocopherol.",
    volume: "150 ml / 5.07 fl oz"
  },
  {
    id: "multani-amber",
    name: "Multani Amber Body Oil",
    subtitle: "Brightening · Firms · 150ml",
    category: "body",
    concerns: ["dullness", "dryness"],
    skin: "normal",
    price: 36,
    was: 0,
    art: "multani",
    tag: "",
    tagStyle: "",
    rating: 4.6,
    reviews: 143,
    short: "Fuller's earth and saffron in a warm amber base — the weekly polish for dull, tired skin.",
    story: "A once-a-week body ritual borrowed from the hammam tradition. The clay lifts what has gone dull on the surface; the saffron and sandalwood base leaves the skin feeling silk rather than stripped.",
    benefits: [
      "Lifts dull, rough skin on the whole body",
      "Smooths the look of stretch marks and uneven texture",
      "Leaves a warm, soft glow rather than a tight feel",
      "Excellent as a pre-festival prep"
    ],
    howTo: [
      "Massage onto dry skin before a bath — not damp.",
      "Leave for fifteen minutes, then rinse with lukewarm water.",
      "Follow with a plain body oil to lock in moisture.",
      "Use once a week; not more than twice."
    ],
    keyIngredients: ["multani", "chandan", "amla"],
    fullIngredients: "Sesamum indicum (sesame) oil, Kaolin (fuller's earth), Crocus sativus (saffron) extract, Santalum album (sandalwood) extract, Phyllanthus emblica (amla) extract, Tocopherol.",
    volume: "150 ml / 5.07 fl oz"
  },
  {
    id: "amla-hair",
    name: "Amla & Brahmi Hair Oil",
    subtitle: "Nourishing · Gloss · 100ml",
    category: "hair",
    concerns: ["hairfall", "dryness"],
    skin: "all",
    price: 32,
    was: 39,
    art: "amla",
    tag: "",
    tagStyle: "",
    rating: 4.7,
    reviews: 288,
    short: "Vitamin-rich Amla and Brahmi for softness, gloss and much less breakage at the comb.",
    story: "The everyday hair tonic. Amla brings the shine and Brahmi brings the softness, and together they cut breakage at the point where most of it actually happens — on the comb.",
    benefits: [
      "Reduces breakage and split ends at the comb",
      "Restores natural gloss and body to dull hair",
      "Softens rough, dry lengths and flyaways",
      "Light enough to leave in rather than wash out"
    ],
    howTo: [
      "A few drops along the lengths, mid-shaft to ends.",
      "Comb through gently to distribute.",
      "Leave in or rinse after an hour.",
      "Use daily on dry hair, more often after swimming."
    ],
    keyIngredients: ["amla", "brahmi", "bhringraj"],
    fullIngredients: "Cocos nucifera (coconut) oil, Sesamum indicum (sesame) oil, Phyllanthus emblica (amla) extract, Bacopa monnieri (brahmi) extract, Eclipta alba (bhringraj) extract, Tocopherol.",
    volume: "100 ml / 3.38 fl oz"
  },
  {
    id: "aloe-soothe",
    name: "Aloe Kumari Soothing Oil",
    subtitle: "Cooling · Calming · 75ml",
    category: "skin",
    concerns: ["sensitivity", "acne"],
    skin: "sensitive",
    price: 31,
    was: 0,
    art: "aloe",
    tag: "Sensitive Skin",
    tagStyle: "",
    rating: 4.8,
    reviews: 176,
    short: "The summer oil. Aloe and sandalwood for heat rash, sun redness and post-workout irritation.",
    story: "Built for the three quarters of the year that the average skin does not enjoy. Cold-processed aloe and sandalwood keep it weightless, so it cools without ever clogging a pore.",
    benefits: [
      "Immediate relief from heat rash and sun redness",
      "Settles post-workout and friction irritation",
      "Safe on sensitive and rosacea-prone skin",
      "Non-comedogenic and weightless in summer heat"
    ],
    howTo: [
      "Three drops onto clean skin, or over a light moisturiser.",
      "Pat in with the palm — never drag across.",
      "Refrigerate for an extra cooling effect in summer.",
      "Use as often as needed through the day."
    ],
    keyIngredients: ["aloe", "chandan", "tulsi"],
    fullIngredients: "Cocos nucifera (coconut) oil, Aloe barbadensis leaf juice, Santalum album (sandalwood) extract, Ocimum sanctum (tulsi) extract, Camellia sinensis (green tea) leaf extract, Tocopherol.",
    volume: "75 ml / 2.54 fl oz"
  }
];

/* --- FAQs --------------------------------------------------------------- */
const FAQS = [
  {
    cat: "Orders & Shipping",
    items: [
      {
        q: "How long will my order take to arrive?",
        a: "Orders leave our kitchen within one working day. Standard domestic delivery takes 3–5 working days, or 6–9 for the larger 200ml vessels. You will receive a tracking link by email as soon as the parcel is handed to the courier."
      },
      {
        q: "Is there free shipping?",
        a: "Shipping is free on every order over $60. Below that, flat-rate shipping is $6 regardless of how many bottles you add. We ship worldwide, and duties for orders outside the US are calculated at checkout so there is nothing to pay on arrival."
      },
      {
        q: "Do you ship internationally?",
        a: "Yes — we ship to 48 countries. International delivery typically takes 7–14 working days. Please note that some oils contain rose, sandalwood or vetiver, which are subject to import restrictions in a small number of destinations."
      },
      {
        q: "Can I change or cancel my order?",
        a: "You can change or cancel any order for a full hour after placing it, from your confirmation email. After that, email us and we will do our best — if it has not shipped we can usually still help."
      }
    ]
  },
  {
    cat: "The Oils Themselves",
    items: [
      {
        q: "Are your oils cold-pressed and unprocessed?",
        a: "Yes. Every botanical in every bottle is either cold-pressed or slow-steeped. We never heat above 40°C, and we never use hexane extraction, synthetic fragrance, parabens, mineral oil or SLS. If you cannot pronounce an ingredient, it will not be on the label."
      },
      {
        q: "Are these genuine Ayurvedic formulations?",
        a: "Each blend is built on a classical Sanskrit formulation — shodhan churna for the Brahmi and Bhringraj oil, rakta chandan for the facial oil — and then made in a modern GMP-certified, vegan facility in Kerala. We formulate to the tradition rather than translating a Western formula into Sanskrit packaging."
      },
      {
        q: "How long does a bottle last once opened?",
        a: "Six months for oils used on the face, twelve months for body and hair oils, stored away from direct sunlight. Because we use no synthetic preservatives, keep the cap tight and the bottle away from a warm windowsill."
      },
      {
        q: "Are these suitable for sensitive skin?",
        a: "Our Kumari Soothing Oil is formulated specifically for reactive and sensitive skin, and every product is fragrance-light. If you are pregnant, breastfeeding or managing a skin condition, we recommend a patch test on the inner forearm for 24 hours first."
      }
    ]
  },
  {
    cat: "Ingredients & Safety",
    items: [
      {
        q: "Will these oils clog my skin?",
        a: "No. Every product on this page is non-comedogenic and has been tested on oily and acne-prone skin for four weeks. The heavier body oils are intended for the body; for the face, choose Tulsi Neem Clarifying for oily skin or the Amber polish for a weekly treatment."
      },
      {
        q: "Which oil is right for my hair type?",
        a: "For a hot, flaky, shedding scalp, use the Brahmi and Bhringraj Scalp Oil twice a week. For dry, brittle lengths and flyaways, use Amla and Brahmi Hair Oil daily in small amounts. Coloured or chemically treated hair should use the Amla and Brahmi formula — it is gentler and will not lift colour."
      },
      {
        q: "Can I use your oils during pregnancy?",
        a: "Please speak to your doctor first. We recommend avoiding the Ashwagandha Night Oil while pregnant, as ashwagandha is traditionally cautioned against in the second and third trimesters. Our facial and body oils are generally considered gentle, but your practitioner should always have the last word."
      },
      {
        q: "Are the products vegan and cruelty free?",
        a: "Everything we make is vegan, cruelty free and never tested on animals. Our oils are pressed or infused from plant material only — no animal-derived ingredients appear anywhere on our labels."
      }
    ]
  },
  {
    cat: "Using the Oils",
    items: [
      {
        q: "Do I need to heat the oil before use?",
        a: "Only for body massage. Warm it in your palms for a few seconds until it turns liquid and fragrant — never in direct heat on a stove or in a microwave. Facial oils and scalp oils should be used at room temperature, since warmth reduces their cooling effect."
      },
      {
        q: "How long until I see results?",
        a: "For skin, expect visible change within two to three weeks. For hair fall, most people notice a clear difference between weeks eight and twelve, which is the normal cycle a new scalp needs. We publish results from our 90-day study at the bottom of each product page rather than promising overnight transformation."
      },
      {
        q: "Can I layer oils together or with skincare?",
        a: "Yes. Apply lighter oils first and heavier ones last — so a face oil goes on before a balm, and a body oil goes on after a serum. With our range specifically, we do not recommend combining two oils on the face in one night."
      },
      {
        q: "Where do I start if I am new to Ayurvedic oils?",
        a: "Begin with one product, used nightly for three weeks, so you can see how your skin responds without confusing the variables. If your priority is hair, start with the Brahmi and Bhringraj Scalp Oil. If it is skin, start with whichever suits your skin type. Adding a second bottle after that is far better than starting with three."
      }
    ]
  }
];

/* --- Store configuration ------------------------------------------------ */
const CONFIG = {
  freeShippingAt: 60,
  flatRate: 6,
  currency: "USD",
  symbol: "$"
};

/* --- Sizes / variants --------------------------------------------------- */
const SIZES = [
  { id: "trial",    label: "Trial",    ml: 50,  mult: 0.62 },
  { id: "standard", label: "Standard", ml: 100, mult: 1 },
  { id: "ritual",   label: "Ritual",   ml: 200, mult: 1.78 }
];

const VARIANT_LABEL = {
  trial: "Trial · 50ml",
  standard: "Standard · 100ml",
  ritual: "Ritual · 200ml"
};

/** Unit price for a product at a given size. */
function variantPrice(product, variantId) {
  const size = SIZES.find((s) => s.id === variantId) || SIZES[1];
  return Math.round(product.price * size.mult);
}

function variantWas(product, variantId) {
  if (!product.was) return 0;
  const size = SIZES.find((s) => s.id === variantId) || SIZES[1];
  return Math.round(product.was * size.mult);
}

/** Which size a product defaults to, inferred from its listed volume. */
function defaultSize(product) {
  const v = product.volume || "";
  if (v.startsWith("50")) return "trial";
  if (v.startsWith("200")) return "ritual";
  return "standard";
}