import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import MachineWorkspace from '../src/app/MachineWorkspace';
import ActionButton from '../src/components/ActionButton';
import environment from '../src/config/environment';
import useConnectionStore from '../src/features/connection/useConnectionStore';
import ScreenPeer from '../src/features/remote-support/ScreenPeer';

const device = {
  deviceId: '6f1c0c1e-3b8f-4f7a-9d55-2a1f6c3b7e10',
  deviceToken: 'mock-device-token',
  machine: { id: 'f75d0b14-f360-42a8-8150-412e60838bae', label: 'Workshop test' },
};
const sessionId = 'a9094967-095c-4379-b14e-24b0de690688';
const route = `${environment.apiBaseUrl}/mc/device/remote-sessions`;
const originalFetch = globalThis.fetch;

interface MockPortalSession {
  id: string;
  deviceId: string;
  machineId: string;
  status: 'requested' | 'active';
  access?: 'prompt' | 'unattended';
  requester: { name: string };
  scope: { view: boolean; control: boolean; record: boolean };
  expiresAt: string;
}

let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
let session: MockPortalSession | null;
const decisions: unknown[] = [];

const startWorkspace = async () => {
  await act(async () => {
    renderer = ReactTestRenderer.create(<MachineWorkspace device={device} delivery={undefined} />);
  });
  if (!renderer) throw new Error('The tablet workspace did not render.');
  return renderer.root;
};

const sendMockPortalRequest = (deviceId = device.deviceId) => {
  session = {
    id: sessionId,
    deviceId,
    machineId: device.machine.id,
    status: 'requested',
    requester: { name: 'Mock Portal support' },
    scope: { view: true, control: false, record: false },
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  };
};

const notifyTablet = async () => {
  await act(async () => {
    useConnectionStore.setState(state => ({ remoteSessionRevision: state.remoteSessionRevision + 1 }));
  });
};

const findButton = (root: ReactTestRenderer.ReactTestInstance, title: string) =>
  root.findAllByType(ActionButton).find(button => button.props.title === title);

const pressButton = async (root: ReactTestRenderer.ReactTestInstance, title: string) => {
  const button = findButton(root, title);
  if (!button) throw new Error(`Missing tablet button: ${title}`);
  await act(async () => button.props.onPress());
};

beforeEach(() => {
  jest.useFakeTimers();
  useConnectionStore.setState({ status: 'connected', remoteSessionRevision: 0 });
  session = null;
  decisions.length = 0;
  globalThis.fetch = async (url: RequestInfo | URL, options?: RequestInit) => {
    if (url === `${route}/current`) {
      return new Response(JSON.stringify({ session }));
    }
    if (url === `${route}/${sessionId}/decision` && options?.method === 'POST' &&
        session?.status === 'requested' && typeof options.body === 'string') {
      const decision: unknown = JSON.parse(options.body);
      decisions.push(decision);
      session = options.body === JSON.stringify({ decision: 'allow', allowControl: false })
        ? { ...session, status: 'active' }
        : null;
      return new Response(JSON.stringify({ session }));
    }
    throw new Error('The mocked workspace made an unexpected request.');
  };
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  globalThis.fetch = originalFetch;
  useConnectionStore.setState(useConnectionStore.getInitialState());
  jest.useRealTimers();
});

test('mock Portal request asks for consent and opens the peer only after approval', async () => {
  const root = await startWorkspace();
  expect(findButton(root, 'Allow view only')).toBeUndefined();

  sendMockPortalRequest();
  await notifyTablet();

  expect(findButton(root, 'Allow view only')).toBeDefined();
  expect(findButton(root, 'Decline')).toBeDefined();
  expect(root.findAllByType(ScreenPeer)).toHaveLength(0);

  await pressButton(root, 'Allow view only');

  expect(decisions).toEqual([{ decision: 'allow', allowControl: false }]);
  expect(findButton(root, 'End session')).toBeDefined();
  expect(root.findByType(ScreenPeer).props).toMatchObject({ sessionId, canControl: false });
});

test('the periodic check finds a request even without a notification and lets the operator decline', async () => {
  const root = await startWorkspace();
  sendMockPortalRequest();
  await act(async () => { jest.advanceTimersByTime(10000); });

  await pressButton(root, 'Decline');

  expect(decisions).toEqual([{ decision: 'decline' }]);
  expect(findButton(root, 'Decline')).toBeUndefined();
  expect(root.findAllByType(ScreenPeer)).toHaveLength(0);
});

test('an unattended session streams at once with no prompt and obeys view only', async () => {
  const root = await startWorkspace();
  session = {
    id: sessionId, deviceId: device.deviceId, machineId: device.machine.id, status: 'active',
    access: 'unattended', requester: { name: 'Sam Support' },
    scope: { view: true, control: false, record: true }, expiresAt: new Date(0).toISOString(),
  };
  await act(async () => { jest.advanceTimersByTime(10000); });

  expect(findButton(root, 'Allow view only')).toBeUndefined();
  expect(findButton(root, 'End session')).toBeDefined();
  expect(root.findByType(ScreenPeer).props).toMatchObject({ sessionId, canControl: false });
  expect(decisions).toEqual([]);
});

test('an incoming request for a different paired device never shows an approval prompt', async () => {
  const root = await startWorkspace();
  sendMockPortalRequest('1436775a-ed54-456b-b770-8fb49c0b2d50');
  await notifyTablet();

  expect(findButton(root, 'Allow view only')).toBeUndefined();
  expect(findButton(root, 'Decline')).toBeUndefined();
  expect(root.findAllByType(ScreenPeer)).toHaveLength(0);
  expect(decisions).toEqual([]);
});
