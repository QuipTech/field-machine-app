import { colors } from '../../config/colors';

const screenPeerStyles = `<style>
body { background: ${colors.background}; color: ${colors.text}; font: 14px system-ui; }
button { background: ${colors.primary}; color: ${colors.onPrimary}; border: 1px solid ${colors.primary}; border-radius: 4px; padding: 8px 12px; }
button:active { background: ${colors.primaryDark}; }
button:disabled { background: ${colors.border}; border-color: ${colors.border}; color: ${colors.textSecondary}; }
button:focus-visible, input:focus-visible { outline: 2px solid ${colors.primaryBright}; }
input { accent-color: ${colors.primary}; }
</style>`;

export default screenPeerStyles;
