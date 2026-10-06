# Card art specification

## Size
- **Canvas: 1056 x 1408 px, portrait, 3:4** (this is the "3:4, 1056 x 1408" setting in the image generator).
- Any other size works only if it is exactly 3:4 (for example 528 x 704 or 792 x 1056); anything else is cropped to fill the card.
- Format: **PNG** (keep the file name ending in `.png`).
- Content: **full-bleed illustration, no text, no frame, no numbers, no border, square corners.** The game draws all of those.

The card is drawn about 135 px wide on a laptop (about 270 px on a retina screen), so 1056 px wide is plenty of headroom.

## What the game draws on top of your art
See `docs/card-art-template.png` (1056 x 1408) for the exact zones. In 1056 x 1408 px terms:

| Overlay | Area | Notes |
|---|---|---|
| Corners | **square**, nothing is cut off | |
| Colour frame | ~18 px at the edge (and a thin rarity line 28 px in) | blue = yours, red = enemy's |
| Top number | circle, centre (528, 106), r 81 | keep calm detail here |
| Bottom number | circle, centre (528, 1309), r 81 | |
| Left / right numbers | circles, centre (99, 704) / (957, 704), r 81 | |
| Name plate | text near y 1211, plus a dark fade over the bottom 34 % (y 929-1408) | art there is darkened to ~88 % at the very bottom |
| Gloss + side tint | whole card, subtle | a soft highlight top-left and a coloured tint toward the edges |

## Composition
- **Safe area for the face / focal subject: x 148-908, y 211-1126** (dashed green box in the template).
- Put the main focal point at about **45 % of the height** (y ~ 634).
- Leave the four number zones and the bottom 18 % (y > 1155) free of important detail (hands, weapons, faces).
- Dark, moody, high-contrast art reads best: the frame and numbers are light, and the table is black wine and crimson.

## Rarity (drawn as a thin inner line, not part of your art)
Common = pearl, Rare = rose, Epic = violet, Legendary = gold. Higher rarities can have richer, more detailed art.

## File naming
Save each image as `public/cards/<card id>.png`. It is picked up automatically (no code change); refresh the page.

| Card id | Name | Rarity | File |
|---|---|---|---|
| `squire` | Squire | Common | `public/cards/squire.png` |
| `knight` | Knight | Common | `public/cards/knight.png` |
| `archer` | Archer | Common | `public/cards/archer.png` |
| `warrior` | Warrior | Common | `public/cards/warrior.png` |
| `healer` | Healer | Common | `public/cards/healer.png` |
| `scout` | Scout | Common | `public/cards/scout.png` |
| `brigand` | Brigand | Common | `public/cards/brigand.png` |
| `pikeman` | Pikeman | Common | `public/cards/pikeman.png` |
| `militia` | Militia | Common | `public/cards/militia.png` |
| `acolyte` | Acolyte | Common | `public/cards/acolyte.png` |
| `hound` | War Hound | Common | `public/cards/hound.png` |
| `rogue` | Rogue | Common | `public/cards/rogue.png` |
| `bard` | Bard | Common | `public/cards/bard.png` |
| `farmhand` | Farmhand | Common | `public/cards/farmhand.png` |
| `mage` | Mage | Rare | `public/cards/mage.png` |
| `crusader` | Crusader | Rare | `public/cards/crusader.png` |
| `ranger` | Ranger | Rare | `public/cards/ranger.png` |
| `pyromancer` | Pyromancer | Rare | `public/cards/pyromancer.png` |
| `guardian` | Guardian | Rare | `public/cards/guardian.png` |
| `assassin` | Assassin | Rare | `public/cards/assassin.png` |
| `druid` | Druid | Rare | `public/cards/druid.png` |
| `silver-witch` | Silver Witch | Rare | `public/cards/silver-witch.png` |
| `demon` | Demon | Epic | `public/cards/demon.png` |
| `archmage` | Archmage | Epic | `public/cards/archmage.png` |
| `champion` | Champion | Epic | `public/cards/champion.png` |
| `drake` | Drake | Epic | `public/cards/drake.png` |
| `phoenix` | Phoenix | Legendary | `public/cards/phoenix.png` |
| `lich-queen` | Lich Queen | Legendary | `public/cards/lich-queen.png` |

Card ids and names come from `src/data/cards.ts`. The same template and spec apply to every card.
