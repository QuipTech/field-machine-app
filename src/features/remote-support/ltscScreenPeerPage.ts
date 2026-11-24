import environment from '../../config/environment';
import { createScreenPeerPage } from './screenPeerPage';

const ltscScreenPeerPage = createScreenPeerPage(`
const appOrigin = ${JSON.stringify(environment.apiBaseUrl)};
const reportPickerEvent = message => window.parent.postMessage(message, appOrigin);
window.addEventListener('message', event => {
  if (event.origin !== appOrigin || event.source !== window.parent) return;
  if (event.data?.type === 'enable-picker') window.enableFieldScreenPicker(event.data.connection);
  if (event.data?.type === 'stop-picker') window.stopFieldScreenPicker();
});
`);

export default ltscScreenPeerPage;
