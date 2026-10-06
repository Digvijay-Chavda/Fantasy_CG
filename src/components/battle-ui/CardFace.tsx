import type { CardDef } from '../../game/engine';

const GLYPH: Record<string, string> = {
  squire: '🛡️', knight: '⚔️', warrior: '🪓', demon: '👹', archer: '🏹',
  mage: '🔮', healer: '✨', fireball: '🔥', rally: '📯', insight: '📖',
};

/** Placeholder artwork: rarity-tinted gradient + glyph. Swap for real art (CardDef.art) in M5. */
function CardArt({ def }: { def: CardDef }) {
  return (
    <div className={`card-art rarity-${def.rarity.toLowerCase()}`}>
      <span>{GLYPH[def.id] ?? (def.type === 'SPELL' ? '✦' : '⚔️')}</span>
    </div>
  );
}

interface Props {
  def: CardDef;
  /** Live stats for units on the board (buffed/damaged). Defaults to the card's printed stats. */
  power?: number;
  health?: number;
  maxHealth?: number;
  compact?: boolean;
}

export function CardFace({ def, power, health, maxHealth, compact }: Props) {
  const isUnit = def.type === 'CHARACTER';
  const hp = health ?? def.health;
  const damaged = maxHealth !== undefined && health !== undefined && health < maxHealth;
  return (
    <div className={`card-face ${compact ? 'compact' : ''}`}>
      {!compact && <div className="gem">{def.cost}</div>}
      <CardArt def={def} />
      <div className="card-name">{def.name}</div>
      {!compact && (
        <div className="card-type">
          {def.type === 'SPELL' ? 'Spell' : def.ranged ? 'Ranged' : 'Unit'} · {def.rarity.toLowerCase()}
        </div>
      )}
      {!compact && <div className="card-text">{def.text}</div>}
      {isUnit && (
        <>
          <div className="stat power">{power ?? def.power}</div>
          <div className={`stat health ${damaged ? 'hurt' : ''}`}>{hp}</div>
        </>
      )}
    </div>
  );
}
