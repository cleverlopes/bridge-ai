import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from './gemini.provider.js';

const makeOkResponse = (body: object) => ({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue(body),
  headers: { get: vi.fn().mockReturnValue(null) },
});

const makeErrorResponse = (status: number, body: object = {}) => ({
  ok: false,
  status,
  json: vi.fn().mockResolvedValue(body),
  headers: { get: vi.fn().mockReturnValue(null) },
});

describe('GeminiProvider', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('generate() calls Gemini REST API with correct model in URL', async () => {
    const provider = new GeminiProvider('test-gemini-key');
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        candidates: [{ content: { parts: [{ text: 'Hello' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
      }),
    );

    await provider.generate('test prompt', { model: 'gemini-2.0-flash' });

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('gemini-2.0-flash');
    expect(url).toContain('generativelanguage.googleapis.com');
  });

  it('includes API key in URL', async () => {
    const provider = new GeminiProvider('my-test-key-xyz');
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
      }),
    );

    await provider.generate('test', {});

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('my-test-key-xyz');
  });

  it('returns success:true with text and token counts', async () => {
    const provider = new GeminiProvider('test-key');
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        candidates: [{ content: { parts: [{ text: 'Generated text' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 },
      }),
    );

    const result = await provider.generate('prompt', {});

    expect(result.success).toBe(true);
    expect(result.usage.inputTokens).toBe(20);
    expect(result.usage.outputTokens).toBe(10);
    expect(result.numTurns).toBe(1);
    expect(result.totalCostUsd).toBe(0);
  });

  it('handles 400 error gracefully (success:false, error.subtype set)', async () => {
    const provider = new GeminiProvider('test-key');
    mockFetch.mockResolvedValueOnce(
      makeErrorResponse(400, {
        error: { code: 400, message: 'Invalid request' },
      }),
    );

    const result = await provider.generate('bad prompt', {});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.subtype).toBe('provider_error');
    expect(result.error?.messages[0]).toContain('Invalid request');
  });

  it('handles 429 rate limit error gracefully', async () => {
    const provider = new GeminiProvider('test-key');
    mockFetch.mockResolvedValueOnce(
      makeErrorResponse(429, {
        error: { code: 429, message: 'Resource exhausted' },
      }),
    );

    const result = await provider.generate('test', {});

    expect(result.success).toBe(false);
    expect(result.error?.subtype).toBe('provider_error');
  });

  it('handles network errors gracefully', async () => {
    const provider = new GeminiProvider('test-key');
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await provider.generate('test', {});

    expect(result.success).toBe(false);
    expect(result.error?.subtype).toBe('network_error');
  });

  it('handles JSON parse errors gracefully', async () => {
    const provider = new GeminiProvider('test-key');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new Error('invalid json')),
    });

    const result = await provider.generate('test', {});

    expect(result.success).toBe(false);
    expect(result.error?.subtype).toBe('parse_error');
  });

  it('uses default model when none is provided', async () => {
    const provider = new GeminiProvider('test-key');
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2, totalTokenCount: 7 },
      }),
    );

    await provider.generate('test', {});

    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('gemini-');
  });

  it('treats 200 response with body.error as provider_error', async () => {
    const provider = new GeminiProvider('test-key');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        error: { code: 403, message: 'API not enabled' },
      }),
      headers: { get: vi.fn().mockReturnValue(null) },
    });

    const result = await provider.generate('test', {});

    expect(result.success).toBe(false);
    expect(result.error?.subtype).toBe('provider_error');
    expect(result.error?.messages[0]).toContain('API not enabled');
  });

  it('uses zero token counts when usageMetadata is absent', async () => {
    const provider = new GeminiProvider('test-key');
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }],
      }),
    );

    const result = await provider.generate('test', {});

    expect(result.success).toBe(true);
    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
  });

  it('network_error uses fallback message for non-Error throws', async () => {
    const provider = new GeminiProvider('test-key');
    mockFetch.mockRejectedValueOnce('timeout');

    const result = await provider.generate('test', {});

    expect(result.success).toBe(false);
    expect(result.error?.subtype).toBe('network_error');
    expect(result.error?.messages).toContain('Network error');
  });
});
