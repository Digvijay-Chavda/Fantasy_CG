import { audio } from '../render/audio';
import { useGameStore } from '../store/gameStore';

export function ResultModal() {
  const s = useGameStore();
  const { game, stats } = s;
  if (!s.resultOpen || !game.winner) return null;
  const won = game.winner === 'player';
  const draw = game.winner === 'draw';
  const total = game.board.reduce((acc, c) => acc + (c ? 1 : 0), 0);
  const counts = { player: s.shownScore.player, ai: s.shownScore.ai };
  const tied = counts.player === counts.ai;

  return (
    <div className="screen result">
      <div className={`result-card ${draw ? 'draw' : won ? 'win' : 'lose'}`}>
        <p className="eyebrow">{draw ? 'Stalemate' : won ? 'The board is yours' : 'The board is lost'}</p>
        <h2>{draw ? 'Draw' : won ? 'Victory' : 'Defeat'}</h2>
        <div className="final">
          <div className="player"><b>{counts.player}</b><span>You</span></div>
          <div className="vs">of {total}</div>
          <div className="ai"><b>{counts.ai}</b><span>Enemy</span></div>
        </div>
        {tied && <p className="hint">Cards were tied — decided by total card strength.</p>}
        <p className="record">
          Record {stats.wins}–{stats.losses}–{stats.draws}
          {stats.streak > 1 && <> · 🔥 {stats.streak} win streak</>}
        </p>
        <div className="menu-actions">
          <button className="primary" onClick={() => { audio.play('select'); s.startNew(); }}>Play again</button>
          <button onClick={() => { audio.play('select'); s.closeResult(); s.toMenu(); }}>Menu</button>
          <button onClick={() => { audio.play('select'); s.closeResult(); }}>View board</button>
        </div>
      </div>
    </div>
  );
}

export function HowTo() {
  const s = useGameStore();
  if (!s.howTo) return null;
  return (
    <div className="screen modal" onClick={() => s.setHowTo(false)}>
      <div className="howto" onClick={(e) => e.stopPropagation()}>
        <h2>How to play</h2>
        <ol>
          <li><b>Two hands, one board.</b> Each side is dealt 8 cards. The enemy&apos;s hand stays hidden.</li>
          <li><b>Read the edges.</b> Every card has four numbers: top, right, bottom and left.</li>
          <li><b>Place a card</b> on any empty cell — drag it there, or tap the card and then the cell.</li>
          <li><b>Capture.</b> Each touching enemy card flips to your colour if your number on that edge is <em>higher</em> than theirs on the facing edge. Your 12 beats their 11; ties do nothing. Flips never chain.</li>
          <li><b>Win.</b> When the board is full, whoever owns the most cards wins. A tie is broken by total card strength.</li>
        </ol>
        <p className="hint">Tip: weak edges facing empty cells are easy targets — save your strongest cards for captures.</p>
        <button className="primary" onClick={() => { audio.play('select'); s.setHowTo(false); }}>Got it</button>
      </div>
    </div>
  );
}
