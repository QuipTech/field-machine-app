import environment from '../../config/environment';
import type { PairedDevice } from '../pairing/pairingSchema';

const getTransferPairing = (device: PairedDevice) =>
  `${environment.name}_${device.machine.id.toLowerCase()}_${device.deviceId.toLowerCase()}`;

export default getTransferPairing;
