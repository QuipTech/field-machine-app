import { z } from 'zod';
import createTabletAccessStore from './createTabletAccessStore';
import ltscNativeRequest from './ltscNativeRequest';
import getLtscWebView from './ltscWebView';

// The tablet's FIELD ID access record, encrypted with Windows DPAPI for the
// whole tablet. Only the Windows LTSC host provides it.
const service = 'field-access';

const tabletAccessStore = createTabletAccessStore({
  isSupported: Boolean(getLtscWebView()),
  read: () => ltscNativeRequest(service, 'read', z.string().nullable()),
  write: async value => {
    await ltscNativeRequest(service, 'write', z.null(), { value });
  },
  remove: async () => {
    await ltscNativeRequest(service, 'remove', z.null());
  },
});

export default tabletAccessStore;
