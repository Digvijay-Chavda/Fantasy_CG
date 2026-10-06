import { useEffect, useRef } from 'react';
import { setScene } from '../render/presenter';
import { TableScene } from '../render/TableScene';
import { useGameStore } from '../store/gameStore';

/** Hosts the PixiJS canvas and wires it to the store. */
export function Table() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const scene = new TableScene();
    let alive = true;
    void scene
      .init(el, {
        onPlace: (uid, cell) => useGameStore.getState().placeCard(uid, cell),
        onScore: (s) => useGameStore.getState().setShownScore(s),
      })
      .then(() => {
        if (!alive) return;
        setScene(scene);
        if (import.meta.env.DEV) (window as unknown as { __scene: TableScene }).__scene = scene;
        useGameStore.getState().attachScene(scene);
      });
    return () => {
      alive = false;
      setScene(null);
      scene.destroy();
    };
  }, []);

  return <div ref={host} className="table" />;
}
