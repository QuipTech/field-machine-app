import { NativeModules } from 'react-native';

interface PickerOrigin {
  open: (html: string) => Promise<string>;
}

const openScreenPickerOrigin = async (html: string) => {
  const origin: PickerOrigin | undefined = NativeModules.FieldMachineScreenPeerOrigin;
  if (!origin) {
    throw new Error('The Windows screen picker module is unavailable.');
  }
  try {
    return await origin.open(html);
  } catch {
    throw new Error('Windows could not start the local screen picker.');
  }
};

export default openScreenPickerOrigin;
