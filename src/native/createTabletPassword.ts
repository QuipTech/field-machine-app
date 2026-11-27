import generateTabletPassword from '../features/tablet-access/generateTabletPassword';

// Windows (LTSC web host) has Web Crypto, so no native call is needed.
const createTabletPassword = async () => generateTabletPassword();

export default createTabletPassword;
