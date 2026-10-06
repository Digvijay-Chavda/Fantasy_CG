import { useEffect, useRef, useState } from 'react';
import { CARDS } from '../../data/cards';
import { capturesFor, handSizes, score } from '../../game/engine';
import { cellLabel } from '../../game/log';
import { useGameStore } from '../../store/gameStore';
import { CardBack, CardFace } from './CardFace';

export function Board() {
  const s = useGameStore();
  const { game } = s;
  const size = game.size;
  const scores = score(game);
  const myTurn = game.active === 'player' && !s.aiThinking && !game.winner;

  const [dragUid, setDragUid] = useState<number | null>(null);
  const [overCell, setOverCell] = useState<number | null>(null);
  // Card being placed (dragged or selected): used to preview captures on hover.
  const activeUid = dragUid ?? s.selectedHand;
  const activeCard = game.hands.player.find((c) => c.uid === activeUid);

  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [s.log.length]);

  const startSize = Math.ceil((size * size) / 2);
  const handSlots = Math.max(startSize, handSizes(size, 'player').player);

  const status = game.winner
    ? game.winner === 'draw' ? 'Draw' : game.winner === 'player' ? 'You win!' : 'You lose'
    : s.aiThinking || game.active === 'ai' ? 'Enemy is thinking…' : 'Your turn — place a card';

  const renderCell = (cell: number) => {
    const placed = game.board[cell];
    const open = !placed && myTurn && activeCard;
    const preview = open && overCell === cell ? capturesFor(game, CARDS, 'player', activeCard.cardId, cell).length : null;
    const cls = [
      'cell',
      open ? 'open' : '',
      overCell === cell && open ? 'drop-over' : '',
      s.lastPlaced === cell ? 'last-placed' : '',
      s.lastFlipped.includes(cell) ? 'flipped' : '',
    ].join(' ');
    return (
      <div
        key={cell}
        className={cls}
        title={cellLabel(cell, size)}
        onClick={() => open && s.placeAt(cell)}
        onDragOver={(e) => {
          if (!placed && myTurn && dragUid !== null) {
            e.preventDefault();
            setOverCell(cell);
          }
        }}
        onDragLeave={() => setOverCell(null)}
        onDrop={(e) => {
          e.preventDefault();
          setOverCell(null);
          if (dragUid !== null && !placed) s.placeCard(dragUid, cell);
          setDragUid(null);
        }}
        onMouseEnter={() => open && setOverCell(cell)}
        onMouseLeave={() => setOverCell(null)}
      >
        {placed ? (
          // The key includes the owner so a capture remounts the card and replays the flip animation.
          <CardFace key={`${placed.uid}-${placed.owner}`} def={CARDS[placed.cardId]!} owner={placed.owner} />
        ) : preview !== null ? (
          <span className="preview">{preview > 0 ? `+${preview}` : ''}</span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="battle">
      <div className="scorebar">
        <div className="score ai">Enemy <b>{scores.ai}</b></div>
        <div className="status">{status}</div>
        <div className="score player">You <b>{scores.player}</b></div>
      </div>

      <div className="hand enemy-hand">
        {Array.from({ length: handSlots }, (_, i) => (i < game.hands.ai.length ? <CardBack key={i} /> : <div key={i} className="card-placeholder" />))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
        {game.board.map((_, cell) => renderCell(cell))}
      </div>

      <div className="hand">
        {Array.from({ length: handSlots }, (_, i) => {
          const c = game.hands.player[i];
          if (!c) return <div key={`empty-${i}`} className="card-placeholder" />;
          return (
            <div
              key={c.uid}
              className={`hand-card ${myTurn ? 'playable' : ''} ${s.selectedHand === c.uid ? 'selected' : ''} ${dragUid === c.uid ? 'dragging' : ''}`}
              draggable={myTurn}
              onClick={() => s.selectHand(c.uid)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(c.uid));
                setDragUid(c.uid);
              }}
              onDragEnd={() => {
                setDragUid(null);
                setOverCell(null);
              }}
            >
              <CardFace def={CARDS[c.cardId]!} owner="player" detailed />
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
        <button onClick={s.restart}>Restart</button>
        <label className="difficulty">
          AI{' '}
          <select value={s.difficulty} onChange={(e) => s.setDifficulty(e.target.value as 'easy' | 'normal')}>
            <option value="easy">Easy</option>
            <option value="normal">Normal</option>
          </select>
        </label>
        {s.error && <span className="error">{s.error}</span>}
      </div>

      {game.winner && (
        <div className="overlay">
          <h1>{game.winner === 'draw' ? 'Draw' : game.winner === 'player' ? 'Victory' : 'Defeat'}</h1>
          <p>{scores.player} – {scores.ai}</p>
          {scores.player === scores.ai && <p className="tiebreak">Cards tied — decided by total card strength</p>}
          <button onClick={s.restart}>Play again</button>
        </div>
      )}
    </div>
  );
}
