import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Button, Modal, Text, TextInput } from 'react-native';
import App from '../App';
import pairingService from '../src/features/pairing/pairingService';
import usePairingStore from '../src/features/pairing/usePairingStore';

jest.mock('../src/features/pairing/pairingService');
jest.mock('../src/native/subscribeToAppResume', () => () => () => undefined);
jest.mock('../src/native/DesignDelivery', () => ({ readJournal: async () => '{"projects":[],"pending":null}' }));

jest.mock('../src/native/PortalTransfer', () => ({
  isSupported: true,
  list: async () => [],
  subscribe: () => ({ remove: () => {} }),
}));
jest.mock('../src/features/connection/useDeviceConnection', () => {
  const store = require('../src/features/pairing/usePairingStore').default;
  const ReactModule = require('react');
  return () =>
    ReactModule.useEffect(() => {
      store.getState().restorePairing();
    }, []);
});

beforeEach(() => {
  jest.resetAllMocks();
  usePairingStore.setState({
    status: 'loading',
    pairedDevice: null,
    error: null,
  });
  jest.mocked(pairingService.readSavedPairing).mockResolvedValue(null);
});

test('opens code popup and shows a saved pairing without starting remote control', async () => {
  const pairedDevice = {
    deviceId: 'a2b1c3d4-1234-4123-8123-123456789012',
    deviceToken: 'test_token',
    machine: {
      id: 'b2b1c3d4-1234-4123-8123-123456789012',
      label: 'ASSET-0042',
    },
  };
  jest.mocked(pairingService.requestPairing).mockResolvedValue(pairedDevice);
  jest.mocked(pairingService.savePairing).mockResolvedValue();
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  if (!renderer) {
    throw new Error('App did not render.');
  }
  const root = renderer.root;
  const pairButton = root
    .findAllByType(Button)
    .find(button => button.props.title === 'Pair this tablet');
  await act(async () => pairButton?.props.onPress());
  await act(async () =>
    root.findByType(TextInput).props.onChangeText('123 456'),
  );
  const submitButton = root
    .findAllByType(Button)
    .find(button => button.props.title === 'Pair tablet');
  await act(async () => {
    await submitButton?.props.onPress();
  });
  expect(pairingService.requestPairing).toHaveBeenCalledWith('123 456');
  const text = root
    .findAllByType(Text)
    .map(node => node.props.children)
    .join(' ');
  expect(text).toContain('ASSET-0042');
  expect(text).toContain('Checking connection');
  expect(root.findAllByType(Modal).every(modal => modal.props.visible === false)).toBe(true);
  await act(async () => root.findByProps({ accessibilityLabel: 'Settings' }).props.onPress());
  const diagnosticsButton = root.findByProps({ title: 'Diagnostics' });
  expect(diagnosticsButton.findByType(Text).props.children).toBe('Diagnostics');
  await act(async () => diagnosticsButton.props.onPress());
  const backButton = root.findByProps({ title: 'Back to settings' });
  expect(backButton.findByType(Text).props.children).toBe('Back to settings');
  await act(async () => backButton.props.onPress());
  expect(root.findByProps({ title: 'Diagnostics' })).toBeDefined();
  expect(
    root
      .findAllByType(Text)
      .some(node =>
        String(node.props.children).includes('Tablet paired with ASSET-0042'),
      ),
  ).toBe(true);
  await act(async () => renderer?.unmount());
});

test('keeps navigation available when a saved pairing is restored', async () => {
  jest.mocked(pairingService.readSavedPairing).mockResolvedValue({
    deviceId: 'a2b1c3d4-1234-4123-8123-123456789012',
    deviceToken: 'test_token',
    machine: {
      id: 'b2b1c3d4-1234-4123-8123-123456789012',
      label: 'ASSET-0042',
    },
  });
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    renderer = ReactTestRenderer.create(<App />);
  });
  if (!renderer) {
    throw new Error('App did not render.');
  }
  const root = renderer.root;
  expect(usePairingStore.getState().status).toBe('paired');
  await act(async () => root.findByProps({ accessibilityLabel: 'Settings' }).props.onPress());
  await act(async () =>
    root.findByProps({ title: 'Diagnostics' }).props.onPress(),
  );
  await act(async () =>
    root.findByProps({ title: 'Back to settings' }).props.onPress(),
  );
  expect(root.findByProps({ title: 'Diagnostics' })).toBeDefined();
  expect(usePairingStore.getState().status).toBe('paired');
  expect(pairingService.requestPairing).not.toHaveBeenCalled();
  await act(async () => renderer?.unmount());
});

test('renders both Windows Files panels without duplicate React keys', async () => {
  jest.mocked(pairingService.readSavedPairing).mockResolvedValue({
    deviceId: 'a2b1c3d4-1234-4123-8123-123456789012',
    deviceToken: 'test_token',
    machine: { id: 'b2b1c3d4-1234-4123-8123-123456789012', label: 'ASSET-0042' },
  });
  const errors = jest.spyOn(console, 'error');
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = ReactTestRenderer.create(<App />); });
    const text = renderer?.root.findAllByType(Text).map(node => node.props.children);
    expect(text).toEqual(expect.arrayContaining(['Files', 'Send to Portal']));
    expect(errors.mock.calls.flat().map(String).join(' ')).not.toContain('with the same key');
  } finally {
    await act(async () => renderer?.unmount());
    errors.mockRestore();
  }
});

