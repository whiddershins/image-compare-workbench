import type { AssetId, Side } from '../domain/model';

export type SideLoadState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly assetId: AssetId; readonly token: number }
  | {
      readonly status: 'ready';
      readonly assetId: AssetId;
      readonly token: number;
      readonly url: string;
    }
  | {
      readonly status: 'error';
      readonly assetId: AssetId;
      readonly token: number;
      readonly message: string;
    };

/**
 * Per-side latest-selection-wins load tracker.
 * Domain selection updates immediately; this only tracks decode presentation.
 */
export class SelectionLoader {
  private tokens: Record<Side, number> = { a: 0, b: 0 };
  private states: Record<Side, SideLoadState> = {
    a: { status: 'idle' },
    b: { status: 'idle' },
  };

  getState(side: Side): SideLoadState {
    return this.states[side];
  }

  /** Begin a new request; returns the token for this request. */
  begin(side: Side, assetId: AssetId): number {
    const token = ++this.tokens[side];
    this.states[side] = { status: 'loading', assetId, token };
    return token;
  }

  /**
   * Complete only if token still matches.
   * Returns true if applied.
   */
  complete(
    side: Side,
    token: number,
    assetId: AssetId,
    url: string,
  ): boolean {
    if (this.tokens[side] !== token) return false;
    this.states[side] = { status: 'ready', assetId, token, url };
    return true;
  }

  fail(side: Side, token: number, assetId: AssetId, message: string): boolean {
    if (this.tokens[side] !== token) return false;
    this.states[side] = { status: 'error', assetId, token, message };
    return true;
  }

  isCurrent(side: Side, token: number): boolean {
    return this.tokens[side] === token;
  }

  currentToken(side: Side): number {
    return this.tokens[side];
  }

  reset(side?: Side): void {
    if (side) {
      this.tokens[side] += 1;
      this.states[side] = { status: 'idle' };
    } else {
      this.tokens = { a: this.tokens.a + 1, b: this.tokens.b + 1 };
      this.states = { a: { status: 'idle' }, b: { status: 'idle' } };
    }
  }

  /**
   * For tests: simulate out-of-order completion.
   */
  snapshot(): {
    tokens: Record<Side, number>;
    states: Record<Side, SideLoadState>;
  } {
    return {
      tokens: { ...this.tokens },
      states: { a: this.states.a, b: this.states.b },
    };
  }
}
