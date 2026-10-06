export type PlayerId = 'player' | 'ai';
export type CardType = 'CHARACTER' | 'SPELL';
export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type Row = 'FRONT' | 'BACK';
export type AbilityType = 'DAMAGE' | 'HEAL' | 'BUFF' | 'DRAW';
export type TargetType =
  | 'ENEMY_HERO'
  | 'ENEMY_LOWEST_HEALTH'
  | 'ENEMY_RANDOM'
  | 'ALLY_HERO'
  | 'ALLY_ALL';

export interface Ability {
  type: AbilityType;
  trigger: 'ON_PLAY';
  target: TargetType;
  value: number;
}

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  rarity: Rarity;
  cost: number;
  power?: number;
  health?: number;
  /** Rows a character may be deployed to. */
  rows?: Row[];
  /** Ranged units attack without retaliation and may hit any enemy character. */
  ranged?: boolean;
  abilities: Ability[];
  text: string;
}

export type CardRegistry = Record<string, CardDef>;

export interface CardInstance {
  uid: number;
  cardId: string;
}

export interface Unit {
  uid: number;
  cardId: string;
  owner: PlayerId;
  power: number;
  health: number;
  maxHealth: number;
  row: Row;
  slot: number;
  ready: boolean;
}

export interface PlayerState {
  id: PlayerId;
  heroHealth: number;
  essence: number;
  maxEssence: number;
  fatigue: number;
  deck: CardInstance[];
  hand: CardInstance[];
}

export interface GameState {
  turn: number;
  active: PlayerId;
  players: Record<PlayerId, PlayerState>;
  units: Unit[];
  nextUid: number;
  rngState: number;
  winner: PlayerId | null;
}

export type AttackTarget = { kind: 'HERO' } | { kind: 'UNIT'; uid: number };

export type Action =
  | { type: 'PLAY_CARD'; uid: number; row?: Row; slot?: number }
  | { type: 'ATTACK'; attackerUid: number; target: AttackTarget }
  | { type: 'END_TURN' };

export type GameEvent =
  | { type: 'TURN_STARTED'; player: PlayerId; turn: number }
  | { type: 'CARD_DRAWN'; player: PlayerId; cardId: string | null }
  | { type: 'CARD_BURNED'; player: PlayerId; cardId: string }
  | { type: 'CARD_PLAYED'; player: PlayerId; cardId: string; unitUid?: number }
  | { type: 'ATTACK'; attackerUid: number; target: AttackTarget }
  | { type: 'DAMAGE'; target: AttackTarget; owner: PlayerId; amount: number }
  | { type: 'HEAL'; target: AttackTarget; owner: PlayerId; amount: number }
  | { type: 'BUFF'; unitUid: number; power: number }
  | { type: 'UNIT_DIED'; unitUid: number; cardId: string; owner: PlayerId }
  | { type: 'GAME_OVER'; winner: PlayerId };

export interface GameConfig {
  cards: CardRegistry;
  decks: Record<PlayerId, string[]>;
  seed: number;
  firstPlayer?: PlayerId;
}

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}
