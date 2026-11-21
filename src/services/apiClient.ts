import environment from '../config/environment';

const getErrorMessage = (body: unknown): string | undefined => {
  if (typeof body === 'string' && body.length < 500) {
    return body;
  }
  if (Array.isArray(body) && body.every(item => typeof item === 'string')) {
    return body.join(' ').slice(0, 500);
  }
  if (body && typeof body === 'object' && 'message' in body) {
    return getErrorMessage(body.message);
  }
  return undefined;
};

// Pairing is public and one-time. Authenticated refresh awaits its backend contract.
const postPublicJson = async (
  path: string,
  payload: object,
): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${environment.apiBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 429) {
      throw new Error(
        'Too many attempts. Wait at least one minute before trying again.',
      );
    }
    if (response.status === 400) {
      throw new Error(
        getErrorMessage(body) ||
          'The code is invalid, expired, or already used.',
      );
    }
    if (response.status !== 201) {
      throw new Error(
        'The pairing service could not complete this request. Contact support before retrying.',
      );
    }
    return body;
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) {
      throw new Error(
        'Connection interrupted. Pairing may have completed on the server. Check the Portal before trying another code.',
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export default postPublicJson;
