import { Platform } from 'react-native';
import type { z } from 'zod';
import environment from '../config/environment';
import {
  registerResponseSchema,
  registrationSchema,
  sessionResponseSchema,
} from '../features/tablet-access/tabletAccessSchema';

export type ApiResult<Value> =
  | { kind: 'ok'; value: Value }
  // Network failure, 5xx or 429: retry with back-off (retryAfterMs when given).
  | { kind: 'retry'; retryAfterMs?: number }
  // Other 4xx: do not retry. Branch on status and code only, never message.
  | { kind: 'error'; status: number; code?: string };

const APP_VERSION = '2.0.0-test';

const readCode = (body: unknown) =>
  body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' ? body.code : undefined;

const request = async <Value>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  token: string | undefined,
  schema: z.ZodType<Value> | null,
  body?: object,
): Promise<ApiResult<Value | null>> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const headers: Record<string, string> = { Accept: 'application/json', 'Cache-Control': 'no-store' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${environment.apiBaseUrl}${path}`, {
      method, headers, signal: controller.signal, body: body ? JSON.stringify(body) : undefined,
    });
    const payload: unknown = response.status === 204 ? null : await response.json().catch(() => null);
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After-devicePairing'));
      return { kind: 'retry', retryAfterMs: Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined };
    }
    if (response.status >= 500) return { kind: 'retry' };
    if (!response.ok) return { kind: 'error', status: response.status, code: readCode(payload) };
    if (!schema) return { kind: 'ok', value: null };
    const parsed = schema.safeParse(payload);
    // A malformed success is a contract mismatch, not a transient failure.
    return parsed.success ? { kind: 'ok', value: parsed.data } : { kind: 'error', status: response.status, code: 'invalid_response' };
  } catch {
    return { kind: 'retry' };
  } finally {
    clearTimeout(timeout);
  }
};

const tabletAccessApi = {
  // `deviceToken` upgrades a tablet already paired with a code.
  register: (password: string, deviceToken?: string) =>
    request('POST', '/mc/device/register', deviceToken, registerResponseSchema,
      {
      password,
      platform: Platform.OS === 'android' ? 'android' : 'windows',
      appVersion: APP_VERSION,
    }),
  getRegistration: (tabletToken: string) =>
    request('GET', '/mc/device/registration', tabletToken, registrationSchema),
  changePassword: (tabletToken: string, password: string) =>
    request('PUT', '/mc/device/registration/password', tabletToken, null, { password }),
  // Each call revokes every earlier device token: never run two at once.
  createSession: (tabletToken: string) =>
    request('POST', '/mc/device/registration/session', tabletToken, sessionResponseSchema),
};

export default tabletAccessApi;
