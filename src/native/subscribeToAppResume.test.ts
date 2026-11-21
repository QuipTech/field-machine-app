import subscribeToAppResume from './subscribeToAppResume.windows';
import getDeviceInfo from './DeviceInfo';

jest.mock('./DeviceInfo');
const isAppForeground = jest.fn();
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers();
  jest.mocked(getDeviceInfo).mockReturnValue({ isAppForeground });
});
afterEach(() => {
  jest.useRealTimers();
});

test('validates when the Windows app returns to foreground and removes its timer', async () => {
  isAppForeground.mockResolvedValue(false);
  const onResume = jest.fn();
  const stop = subscribeToAppResume(onResume);
  await flush();
  isAppForeground.mockResolvedValue(true);
  jest.advanceTimersByTime(1000);
  await flush();
  expect(onResume).toHaveBeenCalledTimes(1);
  stop();
  jest.advanceTimersByTime(5000);
  await flush();
  expect(onResume).toHaveBeenCalledTimes(1);
});

test('detects wake from sleep even if foreground did not change', async () => {
  isAppForeground.mockResolvedValue(true);
  const onResume = jest.fn();
  const stop = subscribeToAppResume(onResume);
  await flush();
  jest.setSystemTime(Date.now() + 10000);
  jest.advanceTimersByTime(1000);
  await flush();
  expect(onResume).toHaveBeenCalledTimes(1);
  stop();
});

test('reports missing native support once and never fires after unmount', async () => {
  isAppForeground.mockRejectedValue(new Error('old native build'));
  const onResume = jest.fn();
  const onUnavailable = jest.fn();
  const stop = subscribeToAppResume(onResume, onUnavailable);
  await flush();
  jest.advanceTimersByTime(1000);
  await flush();
  expect(onUnavailable).toHaveBeenCalledTimes(1);
  stop();
  jest.advanceTimersByTime(15000);
  expect(onResume).not.toHaveBeenCalled();
});
