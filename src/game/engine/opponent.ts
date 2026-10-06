import type { PlayerId } from './types';

export const opponentOf = (p: PlayerId): PlayerId => (p === 'player' ? 'ai' : 'player');
