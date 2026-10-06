import { z } from 'zod';
import { MAX_RANK } from '../game/engine/constants';
import type { CardDef, CardRegistry, Rarity } from '../game/engine/types';

const rank = z.number().int().min(1).max(MAX_RANK);

const cardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rarity: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']),
  ranks: z.object({ top: rank, right: rank, bottom: rank, left: rank }),
  glyph: z.string().optional(),
});

/** Validates card data at load and returns it as a registry; throws listing every problem. */
export function buildRegistry(cards: CardDef[]): CardRegistry {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    const res = cardSchema.safeParse(c);
    if (!res.success) problems.push(...res.error.issues.map((i) => `${c.id ?? '?'}: ${i.path.join('.')} ${i.message}`));
    if (seen.has(c.id)) problems.push(`${c.id}: duplicate id`);
    seen.add(c.id);
  }
  if (problems.length) throw new Error(['Invalid card data:', ...problems].join('\n'));
  return Object.fromEntries(cards.map((c) => [c.id, c]));
}

const card = (id: string, name: string, rarity: Rarity, glyph: string, [top, right, bottom, left]: [number, number, number, number]): CardDef => ({
  id,
  name,
  rarity,
  glyph,
  ranks: { top, right, bottom, left },
});

// Placeholder set. Rank totals: common 18-20, rare 26-29, epic 35-36, legendary 42-43.
const list: CardDef[] = [
  card('squire', 'Squire', 'COMMON', '🛡️', [4, 6, 3, 5]),
  card('knight', 'Knight', 'COMMON', '⚔️', [6, 5, 4, 5]),
  card('archer', 'Archer', 'COMMON', '🏹', [7, 4, 5, 3]),
  card('warrior', 'Warrior', 'COMMON', '🪓', [5, 7, 3, 5]),
  card('healer', 'Healer', 'COMMON', '✨', [3, 4, 7, 6]),
  card('scout', 'Scout', 'COMMON', '🔭', [8, 3, 4, 5]),
  card('brigand', 'Brigand', 'COMMON', '🗡️', [5, 5, 5, 5]),
  card('pikeman', 'Pikeman', 'COMMON', '🔱', [7, 2, 7, 3]),
  card('militia', 'Militia', 'COMMON', '🪖', [4, 4, 4, 6]),
  card('acolyte', 'Acolyte', 'COMMON', '📿', [6, 3, 6, 4]),
  card('hound', 'War Hound', 'COMMON', '🐺', [5, 8, 2, 4]),
  card('rogue', 'Rogue', 'COMMON', '🥷', [3, 7, 5, 4]),
  card('bard', 'Bard', 'COMMON', '🎻', [4, 5, 6, 5]),
  card('farmhand', 'Farmhand', 'COMMON', '🌾', [4, 4, 5, 6]),

  card('mage', 'Mage', 'RARE', '🔮', [8, 6, 5, 7]),
  card('crusader', 'Crusader', 'RARE', '⚜️', [7, 8, 6, 6]),
  card('ranger', 'Ranger', 'RARE', '🎯', [9, 5, 7, 6]),
  card('pyromancer', 'Pyromancer', 'RARE', '🧙', [8, 9, 4, 6]),
  card('guardian', 'Guardian', 'RARE', '🏰', [5, 7, 9, 8]),
  card('assassin', 'Assassin', 'RARE', '🗡️', [9, 4, 8, 6]),
  card('druid', 'Druid', 'RARE', '🌿', [6, 8, 7, 6]),
  card('silver-witch', 'Silver Witch', 'RARE', '🧹', [7, 7, 7, 7]),

  card('demon', 'Demon', 'EPIC', '👹', [10, 9, 6, 10]),
  card('archmage', 'Archmage', 'EPIC', '🌟', [9, 10, 10, 6]),
  card('champion', 'Champion', 'EPIC', '👑', [8, 10, 9, 9]),
  card('drake', 'Drake', 'EPIC', '🐲', [11, 7, 9, 9]),

  card('phoenix', 'Phoenix', 'LEGENDARY', '🔥', [12, 9, 10, 11]),
  card('lich-queen', 'Lich Queen', 'LEGENDARY', '💀', [11, 12, 9, 11]),
];

export const CARDS: CardRegistry = buildRegistry(list);
/** Every card is a candidate for a hand; two hands are dealt from this pool each game. */
export const CARD_POOL: string[] = list.map((c) => c.id);
