import { PLACEHOLDER_CARDS } from '../cards/placeholder';

/** Two copies of every placeholder card (20 cards). */
export const STARTER_DECK: string[] = Object.keys(PLACEHOLDER_CARDS).flatMap((id) => [id, id]);
