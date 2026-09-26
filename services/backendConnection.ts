export type BackendConnectionStatus = 'connected' | 'checking' | 'disconnected';

type Listener = () => void;
type FetchImplementation = typeof fetch;

const HEALTH_CHECK_TIMEOUT_MS = 8_000;

class BackendConnectionMonitor {
  private status: BackendConnectionStatus = 'checking';
  private backendUrl = '';
  private fetchImplementation: FetchImplementation | null = null;
  private listeners = new Set<Listener>();
  private healthCheckInFlight: Promise<boolean> | null = null;

  configure(backendUrl: string, fetchImplementation: FetchImplementation): void {
    this.backendUrl = backendUrl.replace(/\/$/, '');
    this.fetchImplementation = fetchImplementation;
  }

  getStatus = (): BackendConnectionStatus => this.status;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setStatus(status: BackendConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.listeners.forEach((listener) => listener());
  }

  markRequestSucceeded(): void {
    this.setStatus('connected');
  }

  markRequestFailed(): void {
    this.setStatus('disconnected');
  }

  markBrowserOffline(): void {
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
      try {
        const response = await this.fetchImplementation!(`${this.backendUrl}/storage/v1/status`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Backend health check failed with status ${response.status}.`);
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
