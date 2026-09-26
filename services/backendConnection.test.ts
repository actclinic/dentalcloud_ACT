import { beforeEach, describe, expect, it, vi } from 'vitest';
import { backendConnection } from './backendConnection';

describe('backendConnection', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    backendConnection.configure('https://clinic.example', fetchMock);
  });

  it('marks a transport failure disconnected and a subsequent backend response connected', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(backendConnection.fetch('https://clinic.example/rest/v1/patients')).rejects.toThrow('Failed to fetch');
    expect(backendConnection.getStatus()).toBe('disconnected');

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await backendConnection.fetch('https://clinic.example/rest/v1/patients');
    expect(backendConnection.getStatus()).toBe('connected');
  });

  it('uses the backend health endpoint to confirm recovery', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(backendConnection.checkNow()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://clinic.example/storage/v1/status', expect.objectContaining({ method: 'GET' }));
    expect(backendConnection.getStatus()).toBe('connected');
  });

  it('keeps the application disconnected while a recovery check is pending', async () => {
    backendConnection.markRequestFailed();
    let resolveHealthCheck: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveHealthCheck = resolve; }));

    const recoveryCheck = backendConnection.checkNow();
    expect(backendConnection.getStatus()).toBe('disconnected');

    resolveHealthCheck?.(new Response(null, { status: 200 }));
    await expect(recoveryCheck).resolves.toBe(true);
    expect(backendConnection.getStatus()).toBe('connected');
  });

});