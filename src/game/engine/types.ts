export type PlayerId = 'player' | 'ai';
export type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type Side = 'top' | 'right' | 'bottom' | 'left';

/** The number printed on each edge of a card (1..MAX_RANK). */
export type Ranks = Record<Side, number>;

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  ranks: Ranks;
  /** Placeholder glyph until real artwork exists. */
  glyph?: string;
}

export type CardRegistry = Record<string, CardDef>;

export interface CardInstance {
  uid: number;
  cardId: string;
}

/** A card sitting on the board. `owner` is its current colour and changes when it is captured. */
export interface PlacedCard extends CardInstance {
  owner: PlayerId;
}

export interface GameState {
  size: number;
  /** Row-major, index = row * size + col. */
  board: (PlacedCard | null)[];
  hands: Record<PlayerId, CardInstance[]>;
  active: PlayerId;
  /** Number of cards placed so far. */
  moves: number;
  rngState: number;
  /** Set once the board is full. */
  winner: PlayerId | 'draw' | null;
}

export type Action = { type: 'PLACE'; uid: number; cell: number };

export interface Capture {
  cell: number;
  cardId: string;
  /** Side of the placed card that beat the neighbour. */
  side: Side;
  attack: number;
  defense: number;
}

export type GameEvent =
  | { type: 'PLACED'; player: PlayerId; cardId: string; cell: number }
  | ({ type: 'CAPTURED'; by: PlayerId; byCardId: string } & Capture)
  | { type: 'GAME_OVER'; winner: PlayerId | 'draw'; score: Record<PlayerId, number>; tiebreak?: Record<PlayerId, number> };

export interface GameConfig {
  cards: CardRegistry;
  /** Card ids both hands are dealt from. */
  pool: string[];
  seed: number;
  size?: number;
  firstPlayer?: PlayerId;
}

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}
