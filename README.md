# Fantasy_CG

Dark-fantasy PvE card game (player vs AI). Currently a playable **M1 combat prototype** with a throwaway DOM UI; see [PLAN.md](PLAN.md) for the roadmap and [HANDOVER.md](HANDOVER.md) for architecture and resume notes.

## Run

```
npm install
npm run dev        # play the prototype
npm test           # engine rules + AI tests
npm run typecheck
npm run build
```

## How to play

- Each side has a 30 HP Hero, a 3-slot Frontline and a 3-slot Backline.
- You gain +1 max Essence each turn (cap 10) and spend it on cards.
- **Deploy a unit:** drag it from your hand onto a highlighted slot (or click the card, then the slot).
- **Cast a spell:** drag it onto the divider bar (or just click it).
- **Attack:** click a ready (gold-bordered) unit, then a highlighted enemy. The enemy Hero can only be hit once their Frontline is empty. Ranged units (🏹) attack from anywhere without retaliation.
- The game log shows everything the enemy does; its drawn cards stay hidden.

## Structure

- `src/game/` — headless, deterministic engine (pure reducer, seeded RNG, event log) and the AI. No React/PixiJS (enforced by a test).
- `src/data/` — placeholder cards and starter deck.
- `src/store/` — Zustand store (UI state + engine snapshot + game log).
- `src/components/battle-ui/` — DOM battle screen with drag and drop.
