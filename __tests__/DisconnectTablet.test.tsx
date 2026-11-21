import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Button, Text } from 'react-native';
import PairingScreen from '../src/screens/PairingScreen';
import usePairingStore from '../src/features/pairing/usePairingStore';
import pairingService from '../src/features/pairing/pairingService';

jest.mock('../src/features/pairing/pairingService');
const device = {
  deviceId: 'device-1',
  deviceToken: 'test-token',
  machine: { id: 'machine-1', label: 'Test machine' },
};
let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
beforeEach(() => {
  jest.resetAllMocks();
  usePairingStore.setState({
    status: 'paired',
    pairedDevice: device,
    error: null,
  });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
});

test('Disconnect tablet shows progress and returns to code entry after backend success', async () => {
  let confirm: (() => void) | undefined;
  jest.mocked(pairingService.disconnectSession).mockImplementation(
    () =>
      new Promise<void>(resolve => {
        confirm = resolve;
      }),
  );
  await act(async () => {
    renderer = ReactTestRenderer.create(<PairingScreen />);
  });
  if (!renderer) {
    throw new Error('Screen did not render.');
  }
  const root = renderer.root;
  const button = root.findByProps({ title: 'Disconnect tablet' });
  let disconnecting: Promise<void> | undefined;
  await act(async () => {
    disconnecting = button.props.onPress();
  });
  expect(
    root
      .findAllByType(Text)
      .some(node => node.props.children === 'Disconnecting tablet…'),
  ).toBe(true);
  expect(
    root
      .findAllByType(Button)
      .some(node => node.props.title === 'Pair this tablet'),
  ).toBe(false);
  expect(pairingService.forgetPairing).not.toHaveBeenCalled();
  await act(async () => {
    confirm?.();
    await disconnecting;
  });
  expect(root.findByProps({ title: 'Pair this tablet' })).toBeDefined();
  expect(pairingService.disconnectSession).toHaveBeenCalledWith(
    device.deviceToken,
  );
  expect(pairingService.forgetPairing).toHaveBeenCalledTimes(1);
});

test('failed disconnect keeps pairing and offers the same action for retry', async () => {
  jest
    .mocked(pairingService.disconnectSession)
    .mockRejectedValue(
      new Error('Disconnect could not be confirmed. Saved pairing was kept.'),
    );
  await act(async () => {
    renderer = ReactTestRenderer.create(<PairingScreen />);
  });
  if (!renderer) {
    throw new Error('Screen did not render.');
  }
  const root = renderer.root;
  await act(async () => {
    await root.findByProps({ title: 'Disconnect tablet' }).props.onPress();
  });
  expect(root.findByProps({ title: 'Disconnect tablet' })).toBeDefined();
  expect(
    root.findByProps({ accessibilityRole: 'alert' }).props.children,
  ).toContain('Saved pairing was kept');
  expect(usePairingStore.getState().pairedDevice).toBe(device);
  expect(pairingService.forgetPairing).not.toHaveBeenCalled();
});
