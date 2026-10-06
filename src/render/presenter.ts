import type { TableScene } from './TableScene';

/** The store talks to the table through this slot so game logic never imports PixiJS directly. */
let scene: TableScene | null = null;

export const setScene = (s: TableScene | null) => {
  scene = s;
};
export const getScene = () => scene;
