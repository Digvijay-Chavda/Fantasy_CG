# InvokeAI prompts for the card art

Target: **1056 x 1408 px (3:4)**, one PNG per card, saved as `public/cards/<card id>.png`.
Layout rules (safe area, number circles, name plate) are in [CARD_ART.md](CARD_ART.md); the overlay guide is `card-art-template.png`.

## InvokeAI settings (FLUX.1 Kontext Dev)
| Setting | Value |
|---|---|
| Width x Height | **1056 x 1408** (aspect 3:4, as in your screenshot) |
| Steps | 28-30 |
| Guidance (CFG) | 3.5 (FLUX uses low guidance; do not raise above ~4.5) |
| Scheduler | Euler |
| Seed | turn **Random off** once you find a look you like, then keep it as a starting point |
| Negative prompt | FLUX / Kontext ignores it. Put every "do not" into the positive prompt (already done in the master prompt below) |
| Consistency | Generate the first card, then use it as the **Kontext reference image** for the rest ("same painting style, same lighting, same colour grade") |

## Master prompt (paste first, then add the card line)

```
dark fantasy trading card illustration, portrait 3:4 composition, full-bleed artwork filling the entire canvas, one single adult character (age 25+), alluring and glamorous, sensual dark romance mood, confident seductive expression, elegant tasteful styling, painterly digital art with sharp detail, dramatic rim lighting, soft glowing highlights on skin and fabric, rich deep black-wine and crimson colour palette with rose and champagne-gold accents, subtle haze and floating embers, cinematic depth of field. Composition: the character's face and the main focal point are centred about 45 percent down from the top, upper body to three-quarter length, calm uncluttered space at the very top and bottom edges and near the left and right edges. No text, no letters, no numbers, no border, no frame, no watermark, no signature, no card layout, no UI.
```

## Card line (append to the master prompt)
Replace the `[...]` with the line for your card.

```
Subject: [LINE FROM THE LIST BELOW]
```

### Common
| Card id | Line |
|---|---|
| `squire` | a young-looking-but-adult (26) squire in a fitted leather and steel cuirass with bare shoulders, tousled hair, holding a short sword, flirtatious half-smile |
| `knight` | a poised armoured knight with a polished silver breastplate cut away at the waist, long cape, resting hands on a sword, steady commanding gaze |
| `archer` | a lithe archer in a tight laced corset and thigh-high leather boots, drawing a longbow, wind in her hair, playful smirk |
| `warrior` | a powerful battle-scarred warrior with a heavy axe, fur-trimmed pauldrons and a sleeveless leather top, athletic build, fierce grin |
| `healer` | a graceful healer in sheer flowing white and rose silk robes, hands glowing with soft warm light, gentle teasing smile |
| `scout` | a nimble scout in a form-fitting dark hooded tunic with a spyglass, one eyebrow raised, mischievous look |
| `brigand` | a roguish brigand with an open-collared linen shirt, red sash and a dagger at the belt, stubble and a wicked smile |
| `pikeman` | a disciplined pikeman in lacquered steel armour holding a long trident-style pike, proud stance, intense stare |
| `militia` | a determined militia fighter in a battered helmet and mismatched armour with a bare midriff, hands on hips, confident |
| `acolyte` | a devout acolyte in a deep crimson hooded robe with a plunging neckline, rosary of amber beads, lips parted in a quiet secret smile |
| `hound` | a wild huntress with a snarling grey war hound at her side, fur-lined leather top, scratches and war paint, predatory eyes |
| `rogue` | a sleek rogue in a tight black leather bodysuit, mask pulled down, twin daggers, sly knowing smile |
| `bard` | a charming bard with a lute, loose open silk blouse and ribbons in the hair, singing with a warm, inviting expression |
| `farmhand` | a sun-kissed farmhand in a loosened linen shirt knotted at the waist, holding a scythe and wheat, relaxed teasing grin |

### Rare
| Card id | Line |
|---|---|
| `mage` | an elegant mage in a slit velvet gown of violet and black, glowing crystal orb floating above her palm, hypnotic gaze |
| `crusader` | a radiant crusader in gleaming gold-and-white armour with a plunging breastplate and flowing red tabard, raised sword, divine glow behind her |
| `ranger` | a sharp-eyed ranger in a forest-green leather corset and cape, arrow nocked, windswept hair, focused alluring stare |
| `pyromancer` | a fiery pyromancer in a revealing ember-red robe with golden trim, flames curling around her fingers, wicked smile lit by firelight |
| `guardian` | a statuesque guardian in sculpted dark armour with bare thighs and a huge tower shield, protective stance, calm intimidating look |
| `assassin` | an assassin in a skin-tight midnight-blue outfit with a plunging neckline, a curved blade held low, shadows pooling around, deadly seductive gaze |
| `druid` | a wild druid crowned with antlers and flowers, body wrapped in vines and leaves, bare shoulders, glowing green eyes, earthy sensual aura |
| `silver-witch` | a silver-haired witch riding a broomstick through a moonlit night, tight black corset dress with a plunging neckline, pointed hat, coy wink |

### Epic
| Card id | Line |
|---|---|
| `demon` | a horned demoness with crimson skin and curling black horns, barbed tail, torn black silk and chains, glowing red eyes, hungry smile, hellfire behind her |
| `archmage` | an imperious archmage in an ornate black and gold gown with high slits and star-map patterns, arcane sigils orbiting her hands, regal and seductive |
| `champion` | a triumphant champion in ornate crimson-and-gold gladiator armour with a laurel crown, sword raised, glowing arena light, magnetic confident presence |
| `drake` | a dragon-blooded drake woman with iridescent scales along her arms and cheeks, small horns, smouldering golden eyes, a coiled dragon behind her |

### Legendary
| Card id | Line |
|---|---|
| `phoenix` | a goddess of the phoenix, hair and gown made of living flame and feathers of gold and crimson, wings spread wide, radiant heat haze, powerful and breathtakingly alluring |
| `lich-queen` | a gothic lich queen in a black-and-violet gown with sheer bone-lace, pale skin, a crown of black thorns, glowing purple eyes, dark magic swirling around, cold seductive smile |

## Per-image workflow
1. Paste master prompt + one card line. Generate at 1056 x 1408.
2. Check it against `card-art-template.png`: the face must sit inside the green box, the four circle zones and the bottom 18% should be calm.
3. If the subject is too close to an edge, add: `centred, plenty of empty space around the character, subject smaller in frame`.
4. For rarity, add **Rare**: `more ornate details, subtle magical glow`; **Epic**: `ornate, powerful aura, striking colour contrast`; **Legendary**: `masterpiece, divine radiant light, extremely detailed, epic scale`.
5. Export PNG, name it `<card id>.png`, drop it into `public/cards/`, refresh the game.

## Notes
- All characters are written as **adults** (25+). Keep that wording in every prompt.
- If a model refuses or blurs an image, soften with "tasteful, elegant, glamour photography style" rather than removing the adult/seductive mood; avoid explicit nudity so the art stays usable.
- To fix a bad face or hands on one card, use InvokeAI's inpainting on that area with the same prompt.
