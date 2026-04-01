import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenRouterProvider } from './openrouter.provider.js';

const makeOkResponse = (body: object, headers: Record<string, string> = {}) => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue(body),
  text: vi.fn().mockResolvedValue(''),
  headers: {
    get: vi.fn((name: string) => headers[name] ?? null),
  },
});

const makeErrorResponse = (status: number, text = '') => ({
  ok: false,
  status,
  json: vi.fn().mockResolvedValue({}),
  text: vi.fn().mockResolvedValue(text),
  headers: { get: vi.fn().mockReturnValue(null) },
});

describe('OpenRouterProvider', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('generate() makes a POST to openrouter.ai with correct headers and body', async () => {
    const provider = new OpenRouterProvider('test-api-key');
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        id: 'gen-123',
        choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    );

    await provider.generate('Hello world', { model: 'anthropic/claude-3' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('openrouter.ai');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-api-key');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['model']).toBe('anthropic/claude-3');
  });

  it('returns GenerationResult with success:true and populated usage', async () => {
    const provider = new OpenRouterProvider('test-api-key');
    mockFetch.mockResolvedValueOnce(
      makeOkResponse(
        {
          id: 'gen-abc',
          choices: [{ message: { content: 'Hello' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        },
        { 'x-openrouter-generation-cost': '0.0015' },
      ),
    );

    const result = await provider.generate('test', {});

    expect(result.success).toBe(true);
    expect(result.sessionId).toBe('gen-abc');
    expect(result.totalCostUsd).toBe(0.0015);
    expect(result.usage.inputTokens).toBe(20);
    expect(result.usage.outputTokens).toBe(10);
    expect(result.numTurns).toBe(1);
  });

  it('returns GenerationResult with success:false on HTTP error', async () => {
    const provider = new OpenRouterProvider('test-api-key');
    mockFetch.mockResolvedValueOnce(makeErrorResponse(429, 'Rate limited'));

    const result = await provider.generate('test', {});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.subtype).toBe('provider_error');
  });

  it('returns success:false on network error', async () => {
    const provider = new OpenRouterProvider('test-api-key');
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await provider.generate('test', {});

    expect(result.success).toBe(false);
    expect(result.error?.subtype).toBe('network_error');
  });

  it('API key does not appear in error messages', async () => {
    const secretKey = 'super-secret-api-key-12345';
    const provider = new OpenRouterProvider(secretKey);
    mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

    const result = await provider.generate('test', {});

    expect(result.error?.messages.join(' ')).not.toContain(secretKey);
  });

  it('uses default model when none provided', async () => {
    const provider = new OpenRouterProvider('test-key');
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        id: 'gen-default',
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      }),
    );

    await provider.generate('prompt', {});

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(typeof body['model']).toBe('string');
    expect((body['model'] as string).length).toBeGreaterThan(0);
  });

  it('returns success:false on JSON parse error', async () => {
    const provider = new OpenRouterProvider('test-key');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
      text: vi.fn().mockResolvedValue(''),
      headers: { get: vi.fn().mockReturnValue(null) },
    });

    const result = await provider.generate('test', {});
    expect(result.success).toBe(false);
    expect(result.error?.subtype).toBe('parse_error');
  });
});
