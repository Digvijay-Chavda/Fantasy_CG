import type { CardDef, PlayerId } from '../../game/engine';

interface Props {
  def: CardDef;
  /** Colour of the card: who currently owns it. */
  owner: PlayerId;
  /** Show the name and rarity (hand cards); board cells stay compact. */
  detailed?: boolean;
}

/** A card with its four numbers on the edges and placeholder art (glyph) in the middle. */
export function CardFace({ def, owner, detailed }: Props) {
  const { top, right, bottom, left } = def.ranks;
  return (
    <div className={`tt-card owner-${owner} rarity-${def.rarity.toLowerCase()} ${detailed ? 'detailed' : ''}`}>
      <span className="rank top">{top}</span>
      <span className="rank left">{left}</span>
      <span className="rank right">{right}</span>
      <span className="rank bottom">{bottom}</span>
      <span className="art">{def.glyph ?? '✦'}</span>
      {detailed && <span className="name">{def.name}</span>}
    </div>
  );
}

/** Face-down card (the enemy's hand). */
export function CardBack() {
  return <div className="tt-card back">?</div>;
}
