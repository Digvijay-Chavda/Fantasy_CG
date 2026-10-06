import type { CardRegistry, GameEvent, PlayerId } from './engine';

const who = (p: PlayerId) => (p === 'player' ? 'You' : 'Enemy');

/** Board cell index -> "B3" style label (column letter, row number). */
export function cellLabel(cell: number, size: number): string {
  return `${String.fromCharCode(65 + (cell % size))}${Math.floor(cell / size) + 1}`;
}

export function describeEvents(events: GameEvent[], cards: CardRegistry, size: number): string[] {
  const name = (id: string) => cards[id]?.name ?? id;
  const lines: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'PLACED':
        lines.push(`${who(e.player)} placed ${name(e.cardId)} at ${cellLabel(e.cell, size)}`);
        break;
      case 'CAPTURED':
        lines.push(
          `  ↳ ${name(e.byCardId)} captured ${name(e.cardId)} at ${cellLabel(e.cell, size)} (${e.side} ${e.attack} > ${e.defense})`,
        );
        break;
      case 'GAME_OVER': {
        const result = e.winner === 'draw' ? 'Draw' : e.winner === 'player' ? 'You win' : 'You lose';
        lines.push(`${result}! ${e.score.player} – ${e.score.ai}`);
        if (e.tiebreak) lines.push(`Cards tied — tiebreak on card strength: you ${e.tiebreak.player}, enemy ${e.tiebreak.ai}`);
        break;
      }
    }
  }
  return lines;
}
