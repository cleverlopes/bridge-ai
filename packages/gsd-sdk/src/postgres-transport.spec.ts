import { describe, it, expect, vi } from 'vitest';
import { PostgresTransport } from './postgres-transport.js';
import type { GSDEvent } from './types.js';
import { GSDEventType } from './types.js';

const makeEvent = (): GSDEvent => ({
  type: GSDEventType.SessionInit,
  timestamp: new Date().toISOString(),
  sessionId: 'test-session',
  model: 'test-model',
  tools: [],
  cwd: '/tmp',
} as GSDEvent);

describe('PostgresTransport', () => {
  it('onEvent() calls the provided callback with the event', () => {
    const onEvent = vi.fn();
    const transport = new PostgresTransport({ onEvent });
    const event = makeEvent();

    transport.onEvent(event);

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it('errors in synchronous callback do not throw', () => {
    const onEvent = vi.fn(() => {
      throw new Error('callback error');
    });
    const transport = new PostgresTransport({ onEvent });

    expect(() => transport.onEvent(makeEvent())).not.toThrow();
  });

  it('errors in async callback do not propagate to the stream', async () => {
    const onEvent = vi.fn().mockRejectedValue(new Error('async error'));
    const transport = new PostgresTransport({ onEvent });

    expect(() => transport.onEvent(makeEvent())).not.toThrow();
    // Allow microtask queue to flush
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  it('close() calls onClose callback if provided', () => {
    const onClose = vi.fn();
    const transport = new PostgresTransport({ onEvent: vi.fn(), onClose });

    transport.close();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('close() does not throw if no onClose callback is provided', () => {
    const transport = new PostgresTransport({ onEvent: vi.fn() });
    expect(() => transport.close()).not.toThrow();
  });

  it('close() handles errors in onClose gracefully', () => {
    const onClose = vi.fn(() => {
      throw new Error('close error');
    });
    const transport = new PostgresTransport({ onEvent: vi.fn(), onClose });

    expect(() => transport.close()).not.toThrow();
  });

  it('multiple events are each dispatched to the callback', () => {
    const onEvent = vi.fn();
    const transport = new PostgresTransport({ onEvent });

    transport.onEvent(makeEvent());
    transport.onEvent(makeEvent());
    transport.onEvent(makeEvent());

    expect(onEvent).toHaveBeenCalledTimes(3);
  });
});
