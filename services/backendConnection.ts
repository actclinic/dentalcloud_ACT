export type BackendConnectionStatus = 'connected' | 'checking' | 'disconnected';
export type BackendLatencyBand = 'fast' | 'normal' | 'slow' | 'unavailable';

type Listener = () => void;
type FetchImplementation = typeof fetch;

const HEALTH_CHECK_TIMEOUT_MS = 8_000;

export const getBackendLatencyBand = (latencyMs: number | null, status: BackendConnectionStatus): BackendLatencyBand => {
  if (status !== 'connected' || latencyMs === null) return 'unavailable';
  if (latencyMs < 50) return 'fast';
  if (latencyMs > 200) return 'slow';
  return 'normal';
};

class BackendConnectionMonitor {
  private status: BackendConnectionStatus = 'checking';
  private backendUrl = '';
  private fetchImplementation: FetchImplementation | null = null;
  private listeners = new Set<Listener>();
  private healthCheckInFlight: Promise<boolean> | null = null;
  private latencyMs: number | null = null;

  configure(backendUrl: string, fetchImplementation: FetchImplementation): void {
    this.backendUrl = backendUrl.replace(/\/$/, '');
    this.fetchImplementation = fetchImplementation;
  }

  getStatus = (): BackendConnectionStatus => this.status;
  getLatencyMs = (): number | null => this.latencyMs;
  getSnapshot = (): string => `${this.status}:${this.latencyMs ?? 'unknown'}`;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setStatus(status: BackendConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }

  private setLatencyMs(latencyMs: number | null): void {
    if (this.latencyMs === latencyMs) return;
    this.latencyMs = latencyMs;
    this.listeners.forEach((listener) => listener());
  }

  markRequestSucceeded(): void {
    this.setStatus('connected');
  }

  markRequestFailed(): void {
    this.setLatencyMs(null);
    this.setStatus('disconnected');
  }

  markBrowserOffline(): void {
    this.setLatencyMs(null);
    this.setStatus('disconnected');
  }

  async checkNow(): Promise<boolean> {
    if (this.healthCheckInFlight) return this.healthCheckInFlight;
    if (!this.backendUrl || !this.fetchImplementation) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.markBrowserOffline();
      return false;
    }

    this.healthCheckInFlight = (async () => {
      const controller = new AbortController();
      const timeout = globalThis.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
      const startedAt = performance.now();
      try {
        const response = await this.fetchImplementation!(`${this.backendUrl}/auth/v1/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Backend health check failed with status ${response.status}.`);
        this.setLatencyMs(Math.round(performance.now() - startedAt));
        this.markRequestSucceeded();
        return true;
      } catch {
        this.markRequestFailed();
        return false;
      } finally {
        globalThis.clearTimeout(timeout);
        this.healthCheckInFlight = null;
      }
    })();

    return this.healthCheckInFlight;
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (!this.fetchImplementation) throw new Error('Backend connection monitor is not configured.');
    try {
      const response = await this.fetchImplementation(input, init);
      // HTTP responses are valid server contact. Permission, validation, and data
      // errors must never trigger an outage overlay.
      this.markRequestSucceeded();
      return response;
    } catch (error) {
      this.markRequestFailed();
      throw error;
    }
  }
}

export const backendConnection = new BackendConnectionMonitor();
