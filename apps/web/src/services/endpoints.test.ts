import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './api';
import { buildWebSocketUrl } from './ws';

describe('production endpoint resolution', () => {
  it('keeps relative API paths when VITE_API_URL is unset and joins cleanly when set', () => {
    expect(resolveApiUrl('/api/health', '')).toBe('/api/health');
    expect(resolveApiUrl('/api/health', 'https://api.example.com/')).toBe(
      'https://api.example.com/api/health'
    );
  });

  it('derives WebSocket URL from explicit wsUrl, apiUrl fallback, or browser origin', () => {
    expect(
      buildWebSocketUrl('abc=1', {
        wsUrl: 'wss://ws.example.com/',
        apiUrl: 'https://api.example.com',
      })
    ).toBe('wss://ws.example.com/ws?token=abc%3D1');

    expect(
      buildWebSocketUrl('tok', {
        wsUrl: '',
        apiUrl: 'https://api.example.com/',
      })
    ).toBe('wss://api.example.com/ws?token=tok');

    expect(
      buildWebSocketUrl('tok', {
        wsUrl: '',
        apiUrl: '',
        locationProtocol: 'https:',
        locationHost: 'whisper.vercel.app',
      })
    ).toBe('wss://whisper.vercel.app/ws?token=tok');
  });
});

