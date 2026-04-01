import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GSDEventStream } from './event-stream.js';
import type { GSDEvent, TransportHandler } from './types.js';
import { GSDEventType } from './types.js';

const makeEvent = (overrides: Partial<GSDEvent> = {}): GSDEvent =>
  ({
    type: GSDEventType.SessionComplete,
    timestamp: new Date().toISOString(),
    sessionId: 'test-session',
    success: true,
    totalCostUsd: 0.001,
    durationMs: 1000,
    numTurns: 2,
    result: 'done',
    ...overrides,
  }) as GSDEvent;

const makeTransport = (): TransportHandler & { receivedEvents: GSDEvent[] } => {
  const receivedEvents: GSDEvent[] = [];
  return {
    receivedEvents,
    onEvent: vi.fn((event: GSDEvent) => {
      receivedEvents.push(event);
    }),
    close: vi.fn(),
  };
};

describe('GSDEventStream', () => {
  let stream: GSDEventStream;

  beforeEach(() => {
    stream = new GSDEventStream();
  });

  describe('emitEvent()', () => {
    it('emits "event" on the EventEmitter', () => {
      const listener = vi.fn();
      stream.on('event', listener);

      const event = makeEvent();
      stream.emitEvent(event);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('emits the event type as a named event', () => {
      const listener = vi.fn();
      stream.on(GSDEventType.SessionComplete, listener);

      const event = makeEvent();
      stream.emitEvent(event);

      expect(listener).toHaveBeenCalledWith(event);
    });
  });

  describe('addTransport()', () => {
    it('registered transport receives events via onEvent()', () => {
      const transport = makeTransport();
      stream.addTransport(transport);

      const event = makeEvent();
      stream.emitEvent(event);

      expect(transport.onEvent).toHaveBeenCalledWith(event);
      expect(transport.receivedEvents).toHaveLength(1);
    });

    it('multiple transports all receive the same event', () => {
      const t1 = makeTransport();
      const t2 = makeTransport();
      stream.addTransport(t1);
      stream.addTransport(t2);

      const event = makeEvent();
      stream.emitEvent(event);

      expect(t1.onEvent).toHaveBeenCalledWith(event);
      expect(t2.onEvent).toHaveBeenCalledWith(event);
    });

    it('transport errors do not propagate to the stream', () => {
      const badTransport: TransportHandler = {
        onEvent: vi.fn(() => {
          throw new Error('transport exploded');
        }),
        close: vi.fn(),
      };
      stream.addTransport(badTransport);

      expect(() => stream.emitEvent(makeEvent())).not.toThrow();
    });
  });

  describe('removeTransport()', () => {
    it('removed transport no longer receives events', () => {
      const transport = makeTransport();
      stream.addTransport(transport);
      stream.removeTransport(transport);

      stream.emitEvent(makeEvent());

      expect(transport.onEvent).not.toHaveBeenCalled();
    });
  });

  describe('closeAll()', () => {
    it('calls close() on all transports and clears them', () => {
      const t1 = makeTransport();
      const t2 = makeTransport();
      stream.addTransport(t1);
      stream.addTransport(t2);

      stream.closeAll();

      expect(t1.close).toHaveBeenCalledTimes(1);
      expect(t2.close).toHaveBeenCalledTimes(1);

      // After closeAll, new events should not reach transports
      stream.emitEvent(makeEvent());
      expect(t1.onEvent).not.toHaveBeenCalled();
    });

    it('ignores errors thrown by transport.close()', () => {
      const badTransport: TransportHandler = {
        onEvent: vi.fn(),
        close: vi.fn(() => {
          throw new Error('close failed');
        }),
      };
      stream.addTransport(badTransport);

      expect(() => stream.closeAll()).not.toThrow();
    });
  });

  describe('getCost()', () => {
    it('returns zero cost before any events', () => {
      const cost = stream.getCost();
      expect(cost.session).toBe(0);
      expect(cost.cumulative).toBe(0);
    });

    it('tracks cost after emitting a result event', () => {
      const resultEvent = {
        type: 'result',
        session_id: 'session-1',
        subtype: 'success',
        total_cost_usd: 0.005,
        duration_ms: 1000,
        num_turns: 2,
        usage: {},
      };

      stream.mapAndEmit(resultEvent as Parameters<GSDEventStream['mapAndEmit']>[0]);

      const cost = stream.getCost();
      expect(cost.cumulative).toBe(0.005);
    });
  });

  describe('mapSDKMessage()', () => {
    it('returns null for non-actionable message types', () => {
      expect(stream.mapSDKMessage({ type: 'user' } as Parameters<GSDEventStream['mapSDKMessage']>[0])).toBeNull();
      expect(stream.mapSDKMessage({ type: 'auth_status' } as Parameters<GSDEventStream['mapSDKMessage']>[0])).toBeNull();
    });

    it('maps system/init message to SessionInit event', () => {
      const msg = {
        type: 'system',
        subtype: 'init',
        session_id: 'session-1',
        model: 'claude-3',
        tools: ['bash'],
        cwd: '/tmp',
      };

      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event).not.toBeNull();
      expect(event?.type).toBe(GSDEventType.SessionInit);
    });

    it('maps result/success message to SessionComplete event', () => {
      const msg = {
        type: 'result',
        subtype: 'success',
        session_id: 'session-1',
        total_cost_usd: 0.01,
        duration_ms: 5000,
        num_turns: 3,
        usage: {},
        result: 'done',
      };

      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.SessionComplete);
    });

    it('maps result/error message to SessionError event', () => {
      const msg = {
        type: 'result',
        subtype: 'max_turns_exceeded',
        session_id: 'session-1',
        total_cost_usd: 0.001,
        duration_ms: 1000,
        num_turns: 50,
        usage: {},
        errors: ['Max turns exceeded'],
      };

      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.SessionError);
    });

    it('maps system/api_retry message to APIRetry event', () => {
      const msg = {
        type: 'system',
        subtype: 'api_retry',
        session_id: 'session-1',
        attempt: 2,
        max_retries: 3,
        retry_delay_ms: 1000,
        error_status: 429,
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.APIRetry);
    });

    it('maps system/status message to StatusChange event', () => {
      const msg = { type: 'system', subtype: 'status', session_id: 's1', status: 'running' };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.StatusChange);
    });

    it('maps system/task_started message to TaskStarted event', () => {
      const msg = {
        type: 'system',
        subtype: 'task_started',
        session_id: 's1',
        task_id: 'task-1',
        description: 'Running tests',
        task_type: 'auto',
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.TaskStarted);
    });

    it('maps system/task_progress message to TaskProgress event', () => {
      const msg = {
        type: 'system',
        subtype: 'task_progress',
        session_id: 's1',
        task_id: 'task-1',
        description: 'step 2',
        usage: { total_tokens: 500, tool_uses: 3, duration_ms: 5000 },
        last_tool_name: 'bash',
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.TaskProgress);
    });

    it('returns null for system/task_progress without usage', () => {
      const msg = { type: 'system', subtype: 'task_progress', session_id: 's1' };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event).toBeNull();
    });

    it('maps system/task_notification to TaskNotification event', () => {
      const msg = {
        type: 'system',
        subtype: 'task_notification',
        session_id: 's1',
        task_id: 'task-1',
        status: 'completed',
        summary: 'done',
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.TaskNotification);
    });

    it('maps system/compact_boundary to CompactBoundary event when compact_metadata present', () => {
      const msg = {
        type: 'system',
        subtype: 'compact_boundary',
        session_id: 's1',
        compact_metadata: { trigger: 'auto' as const, pre_tokens: 8000 },
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.CompactBoundary);
    });

    it('returns null for compact_boundary without compact_metadata', () => {
      const msg = { type: 'system', subtype: 'compact_boundary', session_id: 's1' };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event).toBeNull();
    });

    it('maps tool_progress message to ToolProgress event', () => {
      const msg = {
        type: 'tool_progress',
        session_id: 's1',
        tool_name: 'bash',
        tool_use_id: 'use-1',
        elapsed_time_seconds: 2.5,
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.ToolProgress);
    });

    it('maps tool_use_summary message to ToolUseSummary event', () => {
      const msg = {
        type: 'tool_use_summary',
        session_id: 's1',
        summary: 'ran 3 tools',
        preceding_tool_use_ids: ['use-1', 'use-2'],
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.ToolUseSummary);
    });

    it('maps rate_limit_event to RateLimit event', () => {
      const msg = {
        type: 'rate_limit_event',
        session_id: 's1',
        rate_limit_info: { status: 'limited', resetsAt: 1234567890, utilization: 0.95 },
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.RateLimit);
    });

    it('maps stream_event to StreamEvent', () => {
      const msg = {
        type: 'stream_event',
        session_id: 's1',
        event: { delta: { text: 'hello' } },
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.StreamEvent);
    });

    it('maps assistant message with text block to AssistantText event', () => {
      const msg = {
        type: 'assistant',
        session_id: 's1',
        message: {
          content: [{ type: 'text', text: 'Hello, world!' }],
        },
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.AssistantText);
    });

    it('maps assistant message with tool_use block to ToolCall event', () => {
      const msg = {
        type: 'assistant',
        session_id: 's1',
        message: {
          content: [{ type: 'tool_use', id: 'tu-1', name: 'bash', input: { command: 'ls' } }],
        },
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event?.type).toBe(GSDEventType.ToolCall);
    });

    it('returns null for assistant message with empty content', () => {
      const msg = {
        type: 'assistant',
        session_id: 's1',
        message: { content: [] },
      };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event).toBeNull();
    });

    it('returns null for unknown system subtypes', () => {
      const msg = { type: 'system', subtype: 'hook_started', session_id: 's1' };
      const event = stream.mapSDKMessage(msg as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event).toBeNull();
    });

    it('returns null for unknown top-level message types', () => {
      const event = stream.mapSDKMessage({ type: 'prompt_suggestion' } as Parameters<GSDEventStream['mapSDKMessage']>[0]);
      expect(event).toBeNull();
    });
  });

  describe('mapAndEmit()', () => {
    it('emits event if mapped successfully', () => {
      const listener = vi.fn();
      stream.on('event', listener);

      stream.mapAndEmit({
        type: 'system',
        subtype: 'init',
        session_id: 's1',
        model: 'claude',
        tools: [],
        cwd: '/tmp',
      } as Parameters<GSDEventStream['mapAndEmit']>[0]);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('does not emit if message maps to null', () => {
      const listener = vi.fn();
      stream.on('event', listener);

      stream.mapAndEmit({ type: 'user' } as Parameters<GSDEventStream['mapAndEmit']>[0]);

      expect(listener).not.toHaveBeenCalled();
    });

    it('returns the mapped event', () => {
      const result = stream.mapAndEmit({
        type: 'result',
        subtype: 'success',
        session_id: 's1',
        total_cost_usd: 0,
        duration_ms: 100,
        num_turns: 1,
        usage: {},
        result: 'ok',
      } as Parameters<GSDEventStream['mapAndEmit']>[0]);

      expect(result?.type).toBe(GSDEventType.SessionComplete);
    });
  });
});
