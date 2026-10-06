import type { CardRegistry, GameEvent, GameState, PlayerId } from './engine';

const who = (p: PlayerId) => (p === 'player' ? 'You' : 'Enemy');
const whose = (p: PlayerId) => (p === 'player' ? 'your' : "the enemy's");

/**
 * Turns engine events into readable lines. `before` is the state prior to the action,
 * so units that died during it can still be named. The enemy's drawn cards stay hidden.
 */
export function describeEvents(events: GameEvent[], before: GameState, cards: CardRegistry): string[] {
  const cardName = (id: string) => cards[id]?.name ?? id;
  const unit = (uid: number) => before.units.find((u) => u.uid === uid);
  const unitName = (uid: number) => {
    const u = unit(uid);
    return u ? `${whose(u.owner)} ${cardName(u.cardId)}` : 'a unit';
  };
  const target = (t: { kind: 'HERO' } | { kind: 'UNIT'; uid: number }, owner: PlayerId) =>
    t.kind === 'HERO' ? `${whose(owner)} Hero` : unitName(t.uid);

  const lines: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'TURN_STARTED':
        lines.push(`— Turn ${e.turn}: ${e.player === 'player' ? 'your' : "enemy's"} turn —`);
        break;
      case 'CARD_PLAYED': {
        const d = cards[e.cardId];
        const verb = d?.type === 'SPELL' ? 'cast' : 'deployed';
        const text = d?.type === 'SPELL' && d.text ? ` (${d.text})` : '';
        lines.push(`${who(e.player)} ${verb} ${cardName(e.cardId)}${text}`);
        break;
      }
      case 'CARD_DRAWN':
        lines.push(
          e.cardId === null
            ? `${who(e.player)} had no cards left to draw`
            : e.player === 'player'
              ? `You drew ${cardName(e.cardId)}`
              : 'Enemy drew a card',
        );
        break;
      case 'CARD_BURNED':
        lines.push(`${who(e.player)} had a full hand — a card was burned`);
        break;
      case 'UNIT_RECALLED':
        lines.push(`${who(e.player)} returned ${cardName(e.cardId)} to hand`);
        break;
      case 'ATTACK': {
        const a = unit(e.attackerUid);
        const attacker = a ? `${whose(a.owner)} ${cardName(a.cardId)}` : 'A unit';
        const victim = e.target.kind === 'HERO' ? `${a && a.owner === 'player' ? 'the enemy' : 'your'} Hero` : unitName(e.target.uid);
        lines.push(`${attacker} attacked ${victim}`);
        break;
      }
      case 'DAMAGE':
        lines.push(`${target(e.target, e.owner)} took ${e.amount} damage`);
        break;
      case 'HEAL':
        lines.push(`${target(e.target, e.owner)} healed ${e.amount}`);
        break;
      case 'BUFF':
        lines.push(`${unitName(e.unitUid)} gained +${e.power} power`);
        break;
      case 'UNIT_DIED':
        lines.push(`${whose(e.owner)} ${cardName(e.cardId)} died`);
        break;
      case 'GAME_OVER':
        lines.push(e.winner === 'player' ? 'You win!' : 'You lose.');
        break;
    }
  }
  return lines;
}
