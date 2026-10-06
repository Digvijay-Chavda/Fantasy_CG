import type { CardDef, CardRegistry } from '../../game/engine/types';

const list: CardDef[] = [
  { id: 'squire', name: 'Squire', type: 'CHARACTER', rarity: 'COMMON', cost: 1, power: 1, health: 2, rows: ['FRONT'], abilities: [], text: 'A green recruit.' },
  { id: 'knight', name: 'Knight', type: 'CHARACTER', rarity: 'COMMON', cost: 2, power: 3, health: 3, rows: ['FRONT'], abilities: [], text: 'Reliable frontline.' },
  { id: 'warrior', name: 'Warrior', type: 'CHARACTER', rarity: 'COMMON', cost: 3, power: 4, health: 3, rows: ['FRONT'], abilities: [], text: 'Hits hard.' },
  { id: 'demon', name: 'Demon', type: 'CHARACTER', rarity: 'RARE', cost: 5, power: 6, health: 5, rows: ['FRONT'], abilities: [], text: 'A hulking brute.' },
  { id: 'archer', name: 'Archer', type: 'CHARACTER', rarity: 'COMMON', cost: 2, power: 2, health: 2, rows: ['BACK', 'FRONT'], ranged: true, abilities: [], text: 'Ranged. Takes no retaliation.' },
  {
    id: 'mage', name: 'Mage', type: 'CHARACTER', rarity: 'RARE', cost: 4, power: 3, health: 3, rows: ['BACK', 'FRONT'], ranged: true,
    abilities: [{ type: 'DAMAGE', trigger: 'ON_PLAY', target: 'ENEMY_LOWEST_HEALTH', value: 2 }],
    text: 'Ranged. On play: deal 2 damage to the weakest enemy.',
  },
  {
    id: 'healer', name: 'Healer', type: 'CHARACTER', rarity: 'COMMON', cost: 3, power: 1, health: 3, rows: ['BACK'],
    abilities: [{ type: 'HEAL', trigger: 'ON_PLAY', target: 'ALLY_HERO', value: 4 }],
    text: 'On play: restore 4 health to your Hero.',
  },
  {
    id: 'fireball', name: 'Fireball', type: 'SPELL', rarity: 'COMMON', cost: 3,
    abilities: [{ type: 'DAMAGE', trigger: 'ON_PLAY', target: 'ENEMY_LOWEST_HEALTH', value: 4 }],
    text: 'Deal 4 damage to the weakest enemy (or the Hero if none).',
  },
  {
    id: 'rally', name: 'Rally', type: 'SPELL', rarity: 'RARE', cost: 2,
    abilities: [{ type: 'BUFF', trigger: 'ON_PLAY', target: 'ALLY_ALL', value: 1 }],
    text: 'Your characters gain +1 power.',
  },
  {
    id: 'insight', name: 'Arcane Insight', type: 'SPELL', rarity: 'COMMON', cost: 1,
    abilities: [{ type: 'DRAW', trigger: 'ON_PLAY', target: 'ALLY_HERO', value: 2 }],
    text: 'Draw 2 cards.',
  },
];

export const PLACEHOLDER_CARDS: CardRegistry = Object.fromEntries(list.map((c) => [c.id, c]));
