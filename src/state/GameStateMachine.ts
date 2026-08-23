import { GamePhase } from '../game/types';

type StateListener = (next: GamePhase, previous: GamePhase) => void;

const TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  [GamePhase.Loading]: [GamePhase.Idle, GamePhase.Disabled],
  [GamePhase.Idle]: [GamePhase.Spinning, GamePhase.BonusIntro, GamePhase.Disabled],
  [GamePhase.Spinning]: [GamePhase.Stopping, GamePhase.Disabled],
  [GamePhase.Stopping]: [GamePhase.Presenting, GamePhase.Disabled],
  [GamePhase.Presenting]: [GamePhase.Idle, GamePhase.Spinning, GamePhase.BonusIntro, GamePhase.Disabled],
  [GamePhase.BonusIntro]: [GamePhase.Spinning, GamePhase.Idle, GamePhase.Disabled],
  [GamePhase.Disabled]: [GamePhase.Loading],
};

export class GameStateMachine {
  private listeners = new Set<StateListener>();

  constructor(private currentState: GamePhase = GamePhase.Loading) {}

  get state(): GamePhase {
    return this.currentState;
  }

  get interactive(): boolean {
    return this.currentState === GamePhase.Idle;
  }

  transition(next: GamePhase): void {
    if (next === this.currentState) return;
    if (!TRANSITIONS[this.currentState].includes(next)) {
      throw new Error(`Invalid game transition: ${this.currentState} -> ${next}`);
    }
    const previous = this.currentState;
    this.currentState = next;
    for (const listener of this.listeners) listener(next, previous);
  }

  onChange(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
