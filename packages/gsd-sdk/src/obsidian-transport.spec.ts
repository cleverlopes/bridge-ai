import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GSDEvent } from './types.js';
import { GSDEventType } from './types.js';

// Mock node:fs at the module level
vi.mock('node:fs', () => ({
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => false),
}));

// Import after mocking
import { ObsidianTransport } from './obsidian-transport.js';
import * as fs from 'node:fs';

const appendFileSyncMock = vi.mocked(fs.appendFileSync);
const mkdirSyncMock = vi.mocked(fs.mkdirSync);

const makeSessionInitEvent = (): GSDEvent =>
  ({
    type: GSDEventType.SessionInit,
    timestamp: '2026-03-31T10:00:00.000Z',
    sessionId: 'session-abc',
    model: 'test-model',
    tools: ['bash', 'read'],
    cwd: '/tmp',
  }) as GSDEvent;

const makeSessionCompleteEvent = (): GSDEvent =>
  ({
    type: GSDEventType.SessionComplete,
    timestamp: '2026-03-31T10:05:00.000Z',
    sessionId: 'session-abc',
    success: true,
    totalCostUsd: 0.0025,
    durationMs: 30000,
    numTurns: 5,
    result: 'done',
  }) as GSDEvent;

describe('ObsidianTransport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Restore default no-op behavior after reset
    appendFileSyncMock.mockImplementation(() => undefined);
    mkdirSyncMock.mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('creates directory on first event', () => {
    const transport = new ObsidianTransport({ vaultPath: '/vault' });
    transport.onEvent(makeSessionInitEvent());

    expect(mkdirSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('/vault'),
      expect.objectContaining({ recursive: true }),
    );
  });

  it('writes formatted event summary to log file for SessionInit', () => {
    const transport = new ObsidianTransport({ vaultPath: '/vault' });
    transport.onEvent(makeSessionInitEvent());

    expect(appendFileSyncMock).toHaveBeenCalled();
    const calls = appendFileSyncMock.mock.calls;
    const allContent = calls.map(c => c[1] as string).join('');
    expect(allContent).toContain('Session Started');
  });

  it('writes formatted event summary for SessionComplete', () => {
    const transport = new ObsidianTransport({ vaultPath: '/vault' });
    transport.onEvent(makeSessionCompleteEvent());

    const calls = appendFileSyncMock.mock.calls;
    const allContent = calls.map(c => c[1] as string).join('');
    expect(allContent).toContain('Session Complete');
  });

  it('does not throw on unsupported event types (returns null from formatEvent)', () => {
    const transport = new ObsidianTransport({ vaultPath: '/vault' });
    const unknownEvent = {
      type: GSDEventType.StatusChange,
      timestamp: '2026-03-31T10:00:00.000Z',
      sessionId: 'session-xyz',
      status: 'waiting',
    } as GSDEvent;

    expect(() => transport.onEvent(unknownEvent)).not.toThrow();
  });

  it('handles filesystem errors gracefully (no throw)', () => {
    appendFileSyncMock.mockImplementation(() => {
      throw new Error('disk full');
    });
    const transport = new ObsidianTransport({ vaultPath: '/vault' });

    expect(() => transport.onEvent(makeSessionInitEvent())).not.toThrow();
  });

  it('uses custom logFolder if provided', () => {
    const transport = new ObsidianTransport({
      vaultPath: '/vault',
      logFolder: 'custom-logs',
    });
    transport.onEvent(makeSessionInitEvent());

    expect(mkdirSyncMock).toHaveBeenCalledWith(
      expect.stringContaining('custom-logs'),
      expect.anything(),
    );
  });

  it('writes to phases/setup/EXECUTION-LOG.md when projectSlug provided but no phase yet', () => {
    const transport = new ObsidianTransport({ vaultPath: '/vault', projectSlug: 'my-project' });
    transport.onEvent(makeSessionInitEvent());

    const dirs = mkdirSyncMock.mock.calls.map(c => c[0] as string);
    expect(dirs.some(d => d.includes('my-project') && d.includes('setup'))).toBe(true);
    const writes = appendFileSyncMock.mock.calls.map(c => c[0] as string);
    expect(writes.some(p => p.includes('my-project') && p.includes('setup') && p.endsWith('EXECUTION-LOG.md'))).toBe(true);
  });

  it('writes to logFolder/phases/setup/EXECUTION-LOG.md when neither projectSlug nor phase known', () => {
    const transport = new ObsidianTransport({ vaultPath: '/vault' });
    transport.onEvent(makeSessionInitEvent());

    const writes = appendFileSyncMock.mock.calls.map(c => c[0] as string);
    expect(writes.some(p => p.includes('setup') && p.endsWith('EXECUTION-LOG.md'))).toBe(true);
    expect(writes.every(p => !p.match(/\d{4}-\d{2}-\d{2}-pipeline/))).toBe(true);
  });

  it('switches from setup log to phase log once PhaseStart fires', () => {
    const transport = new ObsidianTransport({ vaultPath: '/vault', projectSlug: 'my-project' });
    transport.onEvent(makeSessionInitEvent());

    const phaseStartEvent = {
      type: GSDEventType.PhaseStart,
      timestamp: '2026-03-31T10:01:00.000Z',
      sessionId: 'session-abc',
      phaseNumber: '3',
      phaseName: 'Auth',
    } as GSDEvent;
    transport.onEvent(phaseStartEvent);
    transport.onEvent(makeSessionCompleteEvent());

    const writes = appendFileSyncMock.mock.calls.map(c => c[0] as string);
    expect(writes.some(p => p.includes('03-auth'))).toBe(true);
  });

  it('only initializes the log file once across multiple events', () => {
    const transport = new ObsidianTransport({ vaultPath: '/vault' });
    transport.onEvent(makeSessionInitEvent());
    const callsAfterFirst = mkdirSyncMock.mock.calls.length;
    transport.onEvent(makeSessionCompleteEvent());
    const callsAfterSecond = mkdirSyncMock.mock.calls.length;

    // mkdirSync count should not increase after the first event
    expect(callsAfterSecond).toBe(callsAfterFirst);
  });

  it('close() does not throw', () => {
    const transport = new ObsidianTransport({ vaultPath: '/vault' });
    expect(() => transport.close()).not.toThrow();
  });
});
