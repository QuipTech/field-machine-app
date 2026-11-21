import deviceSessionRequest from './deviceSessionRequest';

const disconnectDeviceSession = async (deviceToken: string): Promise<void> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const { httpStatus, isRevoked } = await deviceSessionRequest(
      'DELETE',
      deviceToken,
      controller.signal,
    );
    if (httpStatus === 200 || httpStatus === 204 || isRevoked) {
      return;
    }
    throw new Error('Disconnect was not confirmed.');
  } catch {
    // A lost response may mean DELETE succeeded; keep auth for an explicit retry.
    throw new Error(
      'Disconnect could not be confirmed. Saved pairing was kept. Check the Portal and retry Disconnect tablet when online.',
    );
  } finally {
    clearTimeout(timeout);
  }
};

export default disconnectDeviceSession;
