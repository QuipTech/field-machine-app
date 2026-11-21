import validateSession from '../../services/deviceSessionService';
import recordSessionDiagnostic from './sessionDiagnostics';

// Read-only evidence probe using the old token, before its final in-memory release.
// It never changes state, retries auth, or stores the token in diagnostics.
const probeEndedSession = async (deviceToken: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const result = await validateSession(deviceToken, controller.signal);
    recordSessionDiagnostic(
      'session:after_end',
      `${result.httpStatus} ${result.status} ${result.code}`,
    );
  } catch {
    recordSessionDiagnostic(
      'session:after_end',
      'transport_failure_or_timeout',
    );
  } finally {
    clearTimeout(timeout);
  }
};

export default probeEndedSession;
