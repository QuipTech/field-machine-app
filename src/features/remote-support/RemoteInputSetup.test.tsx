import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ActionButton from '../../components/ActionButton';
import access from '../../native/remoteDesktopInputAccess';
import RemoteControlConsent from './RemoteControlConsent';
import RemoteInputSetup from './RemoteInputSetup';
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

let isConsented = false;
let renderer: ReactTestRenderer;

const render = async () => {
  await act(async () => {
    renderer = create(<RemoteInputSetup />);
  });
};

const press = async (title: string) => {
  const button = renderer.root.findAllByType(ActionButton)
    .find(item => item.props.title === title);
  if (!button) throw new Error(`Missing button: ${title}`);
  await act(async () => button.props.onPress());
};

const consentScreens = () => renderer.root.findAllByType(RemoteControlConsent);

beforeEach(() => {
  jest.clearAllMocks();
  isConsented = false;
  useRemoteInputAccessStore.setState({ isServiceEnabled: undefined, hasConsent: undefined });
  jest.mocked(access.isEnabled).mockResolvedValue(false);
  jest.mocked(access.hasConsent).mockImplementation(async () => isConsented);
  jest.mocked(access.isConsentDecided).mockResolvedValue(true);
  jest.mocked(access.openSettings).mockResolvedValue(true);
  jest.mocked(access.setConsent).mockImplementation(async value => {
    isConsented = value;
    return true;
  });
});

afterEach(async () => {
  await act(async () => renderer.unmount());
});

test('opens accessibility settings only after the operator agrees', async () => {
  await render();
  await press('Set up remote control');
  expect(consentScreens()).toHaveLength(1);
  expect(access.openSettings).not.toHaveBeenCalled();
  await press('I agree');
  expect(access.setConsent).toHaveBeenCalledWith(true);
  expect(access.openSettings).toHaveBeenCalledTimes(1);
  expect(consentScreens()).toHaveLength(0);
});

test('declining stores nothing and opens nothing', async () => {
  await render();
  await press('Set up remote control');
  await press('No thanks');
  expect(access.setConsent).not.toHaveBeenCalled();
  expect(access.openSettings).not.toHaveBeenCalled();
  expect(consentScreens()).toHaveLength(0);
});

test('still asks for consent when the service was enabled in settings', async () => {
  jest.mocked(access.isEnabled).mockResolvedValue(true);
  await render();
  await press('Set up remote control');
  await press('I agree');
  expect(access.openSettings).not.toHaveBeenCalled();
  await press('Withdraw consent');
  expect(access.setConsent).toHaveBeenLastCalledWith(false);
});

test('keeps the consent screen open when the choice cannot be saved', async () => {
  jest.mocked(access.setConsent).mockResolvedValue(false);
  await render();
  await press('Set up remote control');
  await press('I agree');
  expect(access.openSettings).not.toHaveBeenCalled();
  expect(consentScreens()[0].props.error).toBeDefined();
});
