import type { ClientWsEnvelope, ServerWsEnvelope } from '@chat/shared';

type EventListener = (envelope: ServerWsEnvelope) => void;
type StatusListener = (connected: boolean) => void;

export interface WebSocketUrlOptions {
  wsUrl?: string;
  apiUrl?: string;
  locationProtocol?: string;
  locationHost?: string;
}

/**
 * Builds the authenticated WebSocket endpoint URL from env config or current browser origin.
 */
export function buildWebSocketUrl(token: string, options: WebSocketUrlOptions = {}): string {
  const explicitWs = (options.wsUrl ?? import.meta.env.VITE_WS_URL ?? '').trim().replace(/\/+$/, '');
  const apiBase = (options.apiUrl ?? import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
  const rawBase = explicitWs || apiBase;

  let baseWsUrl: string;
  if (rawBase) {
    const normalized = rawBase.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
    baseWsUrl = normalized.endsWith('/ws') ? normalized : `${normalized}/ws`;
  } else {
    const locProtocol = options.locationProtocol ?? window.location.protocol;
    const locHost = options.locationHost ?? window.location.host;
    const protocol = locProtocol === 'https:' ? 'wss:' : 'ws:';
    baseWsUrl = `${protocol}//${locHost}/ws`;
  }

  return `${baseWsUrl}?token=${encodeURIComponent(token)}`;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private reconnectTimer: number | null = null;
  private attempt = 0;
  private manualClose = false;
  private readonly listeners = new Set<EventListener>();
  private readonly statusListeners = new Set<StatusListener>();

  connect(token: string): void {
    if (this.ws && this.token === token && this.ws.readyState <= WebSocket.OPEN) {
      return;
    }
    this.disconnect();
    this.token = token;
    this.manualClose = false;
    this.openSocket();
  }

  disconnect(): void {
    this.manualClose = true;
    this.token = null;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.emitStatus(false);
  }

  send(envelope: ClientWsEnvelope): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(JSON.stringify(envelope));
    return true;
  }

  onEvent(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private openSocket(): void {
    if (!this.token) return;
    const url = buildWebSocketUrl(this.token);
    const socket = new WebSocket(url);
    this.ws = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.emitStatus(true);
    };

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as ServerWsEnvelope;
        for (const listener of this.listeners) {
          listener(parsed);
        }
      } catch {
        // Ignore malformed server frame
      }
    };

    socket.onclose = () => {
      if (this.ws === socket) {
        this.ws = null;
      }
      this.emitStatus(false);
      if (!this.manualClose && this.token) {
        const delay = Math.min(1000 * Math.pow(2, this.attempt), 15_000);
        this.attempt += 1;
        this.reconnectTimer = window.setTimeout(() => this.openSocket(), delay);
      }
    };
  }

  private emitStatus(connected: boolean): void {
    for (const listener of this.statusListeners) {
      listener(connected);
    }
  }
}

export const wsManager = new WebSocketManager();

