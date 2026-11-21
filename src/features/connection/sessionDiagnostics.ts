import useConnectionStore from './useConnectionStore';

// Callers supply only fixed labels, validated enums, and numeric HTTP statuses.
// Never pass an Error, auth object, token, or server response into this logger.
const recordSessionDiagnostic = (event: string, detail: string) => {
  const entry = `${new Date().toISOString()} ${event}: ${detail}`;
  useConnectionStore.setState(state => ({
    diagnostics: [...state.diagnostics.slice(-29), entry],
  }));
  console.info(`[machine-session] ${entry}`);
};

export default recordSessionDiagnostic;
