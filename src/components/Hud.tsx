import { useEffect, useRef, useState } from 'react';
import { audio } from '../render/audio';
import { useGameStore } from '../store/gameStore';

function Score({ side, value, label }: { side: 'player' | 'ai'; value: number; label: string }) {
  return (
    <div className={`score ${side}`}>
      <span className="avatar">{side === 'player' ? '🌹' : '😈'}</span>
      <span className="who">{label}</span>
      {/* key remounts the number so it pops each time it changes */}
      <b key={value} className="num">{value}</b>
    </div>
  );
}

export function Hud() {
  const s = useGameStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logOpen) logEnd.current?.scrollIntoView({ block: 'end' });
  }, [logOpen, s.log.length]);

  const { game, settings } = s;
  const status = game.winner
    ? game.winner === 'draw' ? 'Draw' : game.winner === 'player' ? 'Victory' : 'Defeat'
    : game.moves === 0 && !s.busy ? 'Ready'
    : game.active === 'ai' ? 'Enemy turn' : s.busy ? 'Resolving…' : 'Your turn';
  const tone = game.winner ? 'over' : game.active;

  return (
    <>
      <header className="hud">
        <Score side="ai" value={s.shownScore.ai} label={`Enemy · ${settings.difficulty === 'easy' ? 'Easy' : 'Normal'}`} />
        <div className={`status ${tone}`}>
          <span className="dot" />
          {status}
          <small>{game.board.filter((c) => !c).length} cells left</small>
        </div>
        <Score side="player" value={s.shownScore.player} label="You" />
        <button className="icon menu-btn" aria-label="Menu" onClick={() => { audio.play('select'); s.toMenu(); }}>☰</button>
        <button className="icon gear-btn" aria-label="Options" onClick={() => { audio.play('select'); setMenuOpen((o) => !o); }}>⚙</button>
      </header>

      {menuOpen && (
        <div className="popover" onClick={() => setMenuOpen(false)}>
          <div className="popover-card" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => s.updateSettings({ sound: !settings.sound })}>{settings.sound ? '🔊 Sound on' : '🔇 Sound off'}</button>
            <button onClick={() => s.updateSettings({ music: !settings.music })}>{settings.music ? '🎵 Music on' : '🎵 Music off'}</button>
            <button onClick={() => s.updateSettings({ fast: !settings.fast })}>{settings.fast ? '⏩ Fast animations' : '▶ Normal speed'}</button>
            <button onClick={() => { setMenuOpen(false); setLogOpen(true); }}>📜 Game log</button>
            <button onClick={() => { setMenuOpen(false); s.setHowTo(true); }}>❓ How to play</button>
            <button className="danger" onClick={() => { setMenuOpen(false); s.startNew(); }}>⟳ Restart game</button>
          </div>
        </div>
      )}

      <aside className={`log-drawer ${logOpen ? 'open' : ''}`}>
        <div className="log-head">
          <h3>Game log</h3>
          <button className="icon" onClick={() => setLogOpen(false)} aria-label="Close log">✕</button>
        </div>
        <div className="log-body">
          {s.log.length === 0 && <i>Nothing has happened yet.</i>}
          {s.log.map((line, i) => (
            <div key={i} className={line.startsWith('  ') ? 'sub' : line.startsWith('Enemy') ? 'ai' : line.startsWith('You') ? 'player' : ''}>
              {line.trim()}
            </div>
          ))}
          <div ref={logEnd} />
        </div>
      </aside>
    </>
  );
}
