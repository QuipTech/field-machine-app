export interface ScreenPeerProps {
  sessionId: string;
  deviceToken: string;
  isConnected: boolean;
  canControl: boolean;
}

export const supportsDesktopControl = false;

const ScreenPeer = (_props: ScreenPeerProps) => null;

export default ScreenPeer;
