import createTabletAccessStore from './createTabletAccessStore';
import getSecureStore from './SecureStore';

// The tablet's FIELD ID access record, encrypted with an Android Keystore key.
// The key name is allowlisted in SecureStoreModule.kt.
const key = 'field-access.staging.v1';

const tabletAccessStore = createTabletAccessStore({
  isSupported: true,
  read: () => getSecureStore().read(key),
  write: value => getSecureStore().write(key, value),
  remove: () => getSecureStore().remove(key),
});

export default tabletAccessStore;
