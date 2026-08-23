import { describe, expect, it } from 'vitest';
import { GamePhase } from '../src/game/types';
import { GameStateMachine } from '../src/state/GameStateMachine';

describe('GameStateMachine', () => {
  it('follows a complete paid-spin lifecycle', () => {
    const state = new GameStateMachine();
    state.transition(GamePhase.Idle);
    state.transition(GamePhase.Spinning);
    state.transition(GamePhase.Stopping);
    state.transition(GamePhase.Presenting);
    state.transition(GamePhase.Idle);
    expect(state.state).toBe(GamePhase.Idle);
    expect(state.interactive).toBe(true);
  });

  it('rejects impossible transitions', () => {
    const state = new GameStateMachine();
    expect(() => state.transition(GamePhase.Presenting)).toThrow(/Invalid game transition/);
  });
});
