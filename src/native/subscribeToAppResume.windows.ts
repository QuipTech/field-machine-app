import getDeviceInfo from './DeviceInfo';

// RNW 0.85 AppState is always active. Poll foreground locally, not over REST.
// A timer gap also detects waking from suspend while the app remains foreground.
const subscribeToAppResume = (
  onResume: () => void,
  onUnavailable: () => void = () => {},
) => {
  let isStopped = false;
  let isPending = false;
  let wasForeground: boolean | undefined;
  let lastTick = Date.now();
  let hasReportedUnavailable = false;
  const inspect = async () => {
    if (isStopped || isPending) {
      return;
    }
    const now = Date.now();
    const hasResumed = now - lastTick > 3000;
    lastTick = now;
    isPending = true;
    try {
      const isForeground = await getDeviceInfo().isAppForeground();
      if (
        !isStopped &&
        (hasResumed || (wasForeground === false && isForeground))
      ) {
        onResume();
      }
      wasForeground = isForeground;
    } catch {
      if (!isStopped && !hasReportedUnavailable) {
        hasReportedUnavailable = true;
        onUnavailable();
      }
      if (!isStopped && hasResumed) {
        onResume();
      }
    } finally {
      isPending = false;
    }
  };
  inspect();
  const interval = setInterval(inspect, 1000);
  return () => {
    isStopped = true;
    clearInterval(interval);
  };
};

export default subscribeToAppResume;
