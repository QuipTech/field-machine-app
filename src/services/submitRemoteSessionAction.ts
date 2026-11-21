import environment from '../config/environment';

export type RemoteSessionAction =
  | { decision: 'allow'; allowControl: boolean }
  | { decision: 'decline' }
  | 'end';

const submitRemoteSessionAction = async (
  token: string, id: string, action: RemoteSessionAction, signal: AbortSignal,
) => {
  const operation = action === 'end' ? 'end' : 'decision';
  const response = await fetch(
    `${environment.apiBaseUrl}/mc/device/remote-sessions/${encodeURIComponent(id)}/${operation}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: action === 'end' ? undefined : JSON.stringify(action),
      signal,
    },
  );
  if (!response.ok) {
    throw new Error('Could not confirm the remote session action.');
  }
};

export default submitRemoteSessionAction;

