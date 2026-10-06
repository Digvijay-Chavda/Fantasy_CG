import { audio } from '../render/audio';
import { useGameStore } from '../store/gameStore';

export function Menu() {
  const s = useGameStore();
  const { settings, stats } = s;
  const played = stats.wins + stats.losses + stats.draws;

  return (
    <div className="screen menu">
      <div className="menu-card">
        <p className="eyebrow">Dark desire · card duel</p>
        <h1 className="logo">Fantasy <span>CG</span></h1>
        <p className="tagline">Tempt the board. Place your cards, outplay the numbers on their edges and claim every cell.</p>

        <div className="menu-actions">
          {s.canContinue && (
            <button className="primary" onClick={() => { audio.play('select'); s.continueGame(); }}>Continue game</button>
          )}
          <button className={s.canContinue ? '' : 'primary'} onClick={() => { audio.play('select'); s.startNew(); }}>New game</button>
          <button onClick={() => { audio.unlock(); audio.play('select'); s.setHowTo(true); }}>How to play</button>
        </div>

        <div className="row">
          <span className="label">Enemy AI</span>
          <div className="seg">
            {(['easy', 'normal'] as const).map((d) => (
              <button key={d} className={settings.difficulty === d ? 'on' : ''} onClick={() => { audio.unlock(); s.updateSettings({ difficulty: d }); }}>
                {d === 'easy' ? 'Easy' : 'Normal'}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <span className="label">Sound</span>
          <div className="seg">
            <button className={settings.sound ? 'on' : ''} onClick={() => { audio.unlock(); s.updateSettings({ sound: !settings.sound }); }}>{settings.sound ? 'Effects on' : 'Effects off'}</button>
            <button className={settings.music ? 'on' : ''} onClick={() => { audio.unlock(); s.updateSettings({ music: !settings.music }); }}>{settings.music ? 'Music on' : 'Music off'}</button>
            <button className={settings.fast ? 'on' : ''} onClick={() => s.updateSettings({ fast: !settings.fast })}>{settings.fast ? 'Fast' : 'Normal speed'}</button>
          </div>
        </div>

        <div className="stats">
          <div><b>{stats.wins}</b><span>Wins</span></div>
          <div><b>{stats.losses}</b><span>Losses</span></div>
          <div><b>{stats.draws}</b><span>Draws</span></div>
          <div><b>{stats.bestStreak}</b><span>Best streak</span></div>
        </div>
        {played === 0 && <p className="hint">Your record appears here after your first game.</p>}
      </div>
    </div>
  );
}
