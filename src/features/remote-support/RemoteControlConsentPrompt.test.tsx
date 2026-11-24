import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import access from '../../native/remoteDesktopInputAccess';
import RemoteControlConsent from './RemoteControlConsent';
import RemoteControlConsentPrompt from './RemoteControlConsentPrompt';
import useRemoteInputAccessStore from './useRemoteInputAccessStore';

jest.mock('../../native/remoteDesktopInputAccess', () => ({
  __esModule: true,
  default: {
    isSetupRequired: true,
    isEnabled: jest.fn(),
    hasConsent: jest.fn(),
    isConsentDecided: jest.fn(),
    setConsent: jest.fn(),
    openSettings: jest.fn(),
  },
}));
jest.mock('../../native/subscribeToAppResume', () => ({
  __esModule: true,
  default: () => () => undefined,
}));

let choice: boolean | undefined;
let renderer: ReactTestRenderer;

const render = async () => {
  await act(async () => {
    renderer = create(<RemoteControlConsentPrompt />);
  });
};

const screens = () => renderer.root.findAllByType(RemoteControlConsent);

beforeEach(() => {
  jest.clearAllMocks();
  choice = undefined;
  useRemoteInputAccessStore.setState({
    isServiceEnabled: undefined, hasConsent: undefined, isConsentDecided: undefined,
  });
  jest.mocked(access.isEnabled).mockResolvedValue(false);
  jest.mocked(access.hasConsent).mockImplementation(async () => choice === true);
  jest.mocked(access.isConsentDecided).mockImplementation(async () => choice !== undefined);
  jest.mocked(access.openSettings).mockResolvedValue(true);
  jest.mocked(access.setConsent).mockImplementation(async value => {
    choice = value;
    return true;
  });
});

afterEach(async () => {
  await act(async () => renderer.unmount());
});

test('asks once and opens settings only after agreement', async () => {
  await render();
  expect(screens()).toHaveLength(1);
  expect(access.openSettings).not.toHaveBeenCalled();
  await act(async () => screens()[0].props.onAccept());
  expect(access.setConsent).toHaveBeenCalledWith(true);
  expect(access.openSettings).toHaveBeenCalledTimes(1);
  expect(screens()).toHaveLength(0);
});

test('remembers a declined prompt without opening settings', async () => {
  await render();
  await act(async () => screens()[0].props.onDecline());
  expect(access.setConsent).toHaveBeenCalledWith(false);
  expect(access.openSettings).not.toHaveBeenCalled();
  expect(screens()).toHaveLength(0);
});

test('does not ask again after a saved choice', async () => {
  choice = false;
  await render();
  expect(screens()).toHaveLength(0);
});

test('closes after declining even when the choice cannot be saved', async () => {
  jest.mocked(access.setConsent).mockResolvedValue(false);
  await render();
  await act(async () => screens()[0].props.onDecline());
  expect(screens()).toHaveLength(0);
});
