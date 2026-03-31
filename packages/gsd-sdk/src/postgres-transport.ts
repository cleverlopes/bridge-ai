/**
 * PostgreSQL Transport — emits pipeline events to a callback.
 *
 * Implements TransportHandler with a callback-based design so NestJS
 * EventsModule can subscribe. The transport itself has no direct DB
 * dependency — callers wire the callback to their preferred storage layer.
 */

import { type GSDEvent, type TransportHandler } from './types.js';

// ─── PostgresTransport ───────────────────────────────────────────────────────

export interface PostgresTransportOptions {
  /**
   * Callback invoked for each event. The callback should persist the event
   * to PostgreSQL (or any store). Must not throw — errors are silently caught.
   */
  onEvent: (event: GSDEvent) => void | Promise<void>;
  /**
   * Optional callback invoked when the transport closes.
   */
  onClose?: () => void | Promise<void>;
}

export class PostgresTransport implements TransportHandler {
  private readonly eventCallback: (event: GSDEvent) => void | Promise<void>;
  private readonly closeCallback?: () => void | Promise<void>;

  constructor(options: PostgresTransportOptions) {
    this.eventCallback = options.onEvent;
    this.closeCallback = options.onClose;
  }

  onEvent(event: GSDEvent): void {
    try {
      const result = this.eventCallback(event);
      // If callback returns a promise, ignore its result — fire-and-forget
      if (result instanceof Promise) {
        result.catch(() => {
          // Silently ignore async callback errors
        });
      }
    } catch {
      // Must not throw per TransportHandler contract
    }
  }

  close(): void {
    try {
      const result = this.closeCallback?.();
      if (result instanceof Promise) {
        result.catch(() => {});
      }
    } catch {
      // Must not throw per TransportHandler contract
    }
  }
}
