import { useGameStore } from '../store/gameStore';
import { Hud } from './Hud';
import { Menu } from './Menu';
import { HowTo, ResultModal } from './Modals';
import { Table } from './Table';
import { audio } from '../render/audio';

export function App() {
  const screen = useGameStore((s) => s.screen);
  return (
    // Audio can only start after a gesture; the first press anywhere unlocks it.
    <div className="app" onPointerDown={() => audio.unlock()}>
      <Table />
      {screen === 'game' && <Hud />}
      {screen === 'menu' && <Menu />}
      <ResultModal />
      <HowTo />
    </div>
  );
}
