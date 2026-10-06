import { PLACEHOLDER_CARDS } from '../../data/cards/placeholder';
import { attackTargets, freeSlots, MAX_HAND } from '../../game/engine';
import type { PlayerId, Row, Unit } from '../../game/engine';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../store/gameStore';

/** Throwaway DOM prototype (M1). The real battlefield will be PixiJS (M3). */
export function Battle() {
  const s = useGameStore();
  const { game } = s;
  const me = game.players.player;
  const foe = game.players.ai;
  const selectedUnit = game.units.find((u) => u.uid === s.selectedUnit);
  const targets = selectedUnit ? attackTargets(game, selectedUnit, PLACEHOLDER_CARDS) : [];
  const heroTargetable = targets.some((t) => t.kind === 'HERO');
  const unitTargetable = (uid: number) => targets.some((t) => t.kind === 'UNIT' && t.uid === uid);
  const [dragUid, setDragUid] = useState<number | null>(null);
  const [overSlot, setOverSlot] = useState<string | null>(null);
  const dragCard = dragUid !== null ? PLACEHOLDER_CARDS[me.hand.find((c) => c.uid === dragUid)?.cardId ?? ''] : undefined;
  const selectedCard = dragCard ?? (s.selectedHand ? PLACEHOLDER_CARDS[me.hand.find((c) => c.uid === s.selectedHand)?.cardId ?? ''] : undefined);

  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => logEnd.current?.scrollIntoView({ block: 'nearest' }), [s.log.length]);

  const unitAt = (owner: PlayerId, row: Row, slot: number) =>
    game.units.find((u) => u.owner === owner && u.row === row && u.slot === slot);

  const renderUnit = (u: Unit) => {
    const d = PLACEHOLDER_CARDS[u.cardId]!;
    const mine = u.owner === 'player';
    const cls = ['card', 'unit', mine && u.ready ? 'ready' : '', s.selectedUnit === u.uid ? 'selected' : '', !mine && unitTargetable(u.uid) ? 'targetable' : ''].join(' ');
    return (
      <div className={cls} onClick={() => (mine ? s.selectUnit(u.uid) : unitTargetable(u.uid) && s.attack({ kind: 'UNIT', uid: u.uid }))}>
        <b>{d.name}</b>
        <span>{d.ranged ? '🏹' : '⚔'} {u.power} / ♥ {u.health}</span>
      </div>
    );
  };

  const renderRow = (owner: PlayerId, row: Row) => {
    const free = owner === 'player' && selectedCard?.type === 'CHARACTER' && selectedCard.rows?.includes(row) ? freeSlots(game, 'player', row) : [];
    return (
      <div className="row">
        <div className="row-label">{row === 'FRONT' ? 'Frontline' : 'Backline'}</div>
        {[0, 1, 2].map((slot) => {
          const u = unitAt(owner, row, slot);
          return (
            <div
              key={slot}
              className={`slot ${free.includes(slot) ? 'open' : ''} ${overSlot === `${owner}-${row}-${slot}` ? 'drop-over' : ''}`}
              onClick={() => !u && free.includes(slot) && s.deploy(row, slot)}
              onDragOver={(e) => {
                if (!u && free.includes(slot)) {
                  e.preventDefault();
                  setOverSlot(`${owner}-${row}-${slot}`);
                }
              }}
              onDragLeave={() => setOverSlot(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOverSlot(null);
                if (dragUid !== null && !u && free.includes(slot)) s.deployCard(dragUid, row, slot);
                setDragUid(null);
              }}
            >
              {u ? renderUnit(u) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const hero = (label: string, hp: number, essence: number, max: number, targetable: boolean, handSize: number) => (
    <div className={`hero ${targetable ? 'targetable' : ''}`} onClick={() => targetable && s.attack({ kind: 'HERO' })}>
      <b>{label}</b> ♥ {hp} · ◆ {essence}/{max} · ✋ {handSize}
    </div>
  );

  return (
    <div className="battle">
      {hero('Enemy Hero', foe.heroHealth, foe.essence, foe.maxEssence, heroTargetable, foe.hand.length)}
      {renderRow('ai', 'BACK')}
      {renderRow('ai', 'FRONT')}
      <div
        className={`divider ${dragCard?.type === 'SPELL' ? 'spell-drop' : ''}`}
        onDragOver={(e) => dragCard?.type === 'SPELL' && e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (dragUid !== null && dragCard?.type === 'SPELL') s.selectHand(dragUid);
          setDragUid(null);
        }}
      >
        {dragCard?.type === 'SPELL' ? 'Drop here to cast ' + dragCard.name + ' — ' : ''}Turn {game.turn} — {game.active === 'player' ? 'Your turn' : 'Enemy turn'}{s.aiThinking ? '…' : ''}</div>
      {renderRow('player', 'FRONT')}
      {renderRow('player', 'BACK')}
      {hero('Your Hero', me.heroHealth, me.essence, me.maxEssence, false, me.hand.length)}

      <div className="hand">
        {Array.from({ length: MAX_HAND }, (_, i) => {
          const c = me.hand[i];
          if (!c) return <div key={`empty-${i}`} className="card-placeholder" />;
          const d = PLACEHOLDER_CARDS[c.cardId]!;
          const playable = game.active === 'player' && d.cost <= me.essence && !s.aiThinking;
          return (
            <div
              key={c.uid}
              className={`card ${playable ? 'playable' : ''} ${s.selectedHand === c.uid ? 'selected' : ''} ${dragUid === c.uid ? 'dragging' : ''}`}
              draggable={playable}
              onClick={() => s.selectHand(c.uid)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(c.uid));
                setDragUid(c.uid);
              }}
              onDragEnd={() => {
                setDragUid(null);
                setOverSlot(null);
              }}
            >
              <div className="cost">◆ {d.cost}</div>
              <b>{d.name}</b>
              {d.type === 'CHARACTER' && <span>⚔ {d.power} / ♥ {d.health}</span>}
              <small>{d.text}</small>
            </div>
          );
        })}
      </div>

      <div className="log">
        {s.log.length === 0 && <i>Game log appears here.</i>}
        {s.log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
        <div ref={logEnd} />
      </div>

      <div className="controls">
        <button onClick={s.endTurn} disabled={game.active !== 'player' || s.aiThinking || !!game.winner}>End turn</button>
        <button onClick={s.restart}>Restart</button>
        {s.error && <span className="error">{s.error}</span>}
      </div>

      {game.winner && (
        <div className="overlay">
          <h1>{game.winner === 'player' ? 'Victory' : 'Defeat'}</h1>
          <button onClick={s.restart}>Play again</button>
        </div>
      )}
    </div>
  );
}
