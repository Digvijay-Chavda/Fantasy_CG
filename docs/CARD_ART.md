# Card art specification

## Size
- **Canvas: 1000 x 1400 px, portrait, 5:7** (the proportion of a real poker/tarot card, 1 : 1.4).
- Acceptable minimum: 800 x 1120 px. Any other size works only if it is exactly 5:7; anything else is cropped to fill the card.
- Format: **PNG** (JPG also fine; keep the file name ending in `.png` or tell me to change the loader).
- Content: **full-bleed illustration, no text, no frame, no numbers, no border.** The game draws all of those.

In the game a card is drawn about 140 px wide on a laptop (about 280 px on a retina screen), so 1000 px wide is plenty of headroom.

## What the game draws on top of your art
See `docs/card-art-template.png` (1000 x 1400) for the exact zones. In 1000 x 1400 px terms:

| Overlay | Area | Notes |
|---|---|---|
| Rounded corners | radius ~67 px | corners are cut off |
| Colour frame | ~17 px at the edge | blue = yours, red = enemy's |
| Top number | circle, centre (500, 100), r 77 | keep calm detail here |
| Bottom number | circle, centre (500, 1307), r 77 | |
| Left / right numbers | circles, centre (93, 700) / (907, 700), r 77 | |
| Name plate | text near y 1213, plus a dark fade over the bottom 34 % (y 924-1400) | art there is darkened to ~88 % at the very bottom |
| Gloss + side tint | whole card, subtle | a soft highlight top-left and a coloured tint toward the edges |

## Composition
- **Safe area for the face / focal subject: x 140-860, y 210-1120** (dashed green box in the template).
- Put the main focal point at about **45 % of the height** (y ~ 630).
- Leave the four number zones and the bottom 18 % (y > 1150) free of important detail (hands, weapons, faces).
- Darker, moodier art reads best: the frame, numbers and gloss are light, and the table is dark wine/black.

## Rarity (drawn as a thin inner line, not part of your art)
Common = silver-rose, Rare = pink, Epic = violet, Legendary = gold. Higher rarities can have richer, more detailed art.

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
