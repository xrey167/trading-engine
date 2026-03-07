const CircuitState = {
  Closed:   'CLOSED',
  Open:     'OPEN',
  HalfOpen: 'HALF_OPEN',
} as const;
type CircuitState = (typeof CircuitState)[keyof typeof CircuitState];

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  readonly resetTimeoutMs: number;
}

export class CircuitBreaker {
  private _state: CircuitState = CircuitState.Closed;
  private failures = 0;
  private lastFailureTime = 0;

  constructor(private readonly opts: CircuitBreakerOptions) {}

  get state(): CircuitState { return this._state; }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this._state === CircuitState.Open) {
      if (Date.now() - this.lastFailureTime >= this.opts.resetTimeoutMs) {
        this._state = CircuitState.HalfOpen;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (e) {
      this.onFailure();
      throw e;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this._state = CircuitState.Closed;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.opts.failureThreshold) {
      this._state = CircuitState.Open;
    }
  }
}
