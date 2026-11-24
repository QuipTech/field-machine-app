/* global document */
import { AppRegistry } from 'react-native';
import App from '../../App';

AppRegistry.registerComponent('FieldMachine', () => App);
AppRegistry.runApplication('FieldMachine', { rootTag: document.getElementById('app') });
