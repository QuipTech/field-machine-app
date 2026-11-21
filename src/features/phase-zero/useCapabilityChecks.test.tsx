import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import getScreenCapture from '../../native/ScreenCapture';
import getInputControl from '../../native/InputControl';
import useCapabilityChecks from './useCapabilityChecks';

jest.mock('../../native/ScreenCapture', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../native/InputControl', () => ({
  __esModule: true,
  default: jest.fn(),
}));

let checks: ReturnType<typeof useCapabilityChecks>;
let renderer: ReturnType<typeof TestRenderer.create>;
const Harness = () => {
  checks = useCapabilityChecks();
  return null;
};

beforeEach(async () => {
  jest.resetAllMocks();
  await act(() => {
    renderer = TestRenderer.create(<Harness />);
  });
});
afterEach(async () => {
  await act(() => renderer.unmount());
});

test('reports missing capture and input modules as blocked', async () => {
  jest.mocked(getScreenCapture).mockReturnValue(null);
  jest.mocked(getInputControl).mockReturnValue(null);
  await act(() => checks.startCapture());
  expect(checks.result).toContain('Blocked: ScreenCapture');
  await act(() => checks.clickTarget());
  expect(checks.result).toContain('Blocked: InputControl');
  expect(checks.isBusy).toBe(false);
});

test('shows native capture evidence and clears the image after stop', async () => {
  const capture = {
    start: jest.fn(async () => {}),
    stop: jest.fn(async () => {}),
    getStatus: jest.fn(async () => 'Frames received: 12'),
    getSnapshot: jest.fn(async () => 'file:///C:/Temp/capture.png'),
  };
  jest.mocked(getScreenCapture).mockReturnValue(capture);
  await act(() => checks.startCapture());
  expect(capture.start).toHaveBeenCalledTimes(1);
  await act(() => checks.inspectCapture());
  expect(checks.result).toBe('Frames received: 12');
  expect(checks.snapshotUri).toBe('file:///C:/Temp/capture.png');
  await act(() => checks.stopCapture());
  expect(capture.stop).toHaveBeenCalledTimes(1);
  expect(checks.snapshotUri).toBeUndefined();
});

test('does not claim input success when native target verification fails', async () => {
  jest.mocked(getInputControl).mockReturnValue({
    clickTestTarget: jest.fn(async () => {
      throw new Error('Target did not receive the click.');
    }),
  });
  await act(() => checks.clickTarget());
  expect(checks.result).toBe('Target did not receive the click.');
  expect(checks.isBusy).toBe(false);
});
