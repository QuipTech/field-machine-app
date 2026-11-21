import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import ActionButton from '../src/components/ActionButton';
import PhaseZeroScreen from '../src/screens/PhaseZeroScreen';

test('shows unverified status and disables Windows actions on this platform', async () => {
  let renderer: ReturnType<typeof ReactTestRenderer.create> | undefined;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<PhaseZeroScreen />);
  });
  if (!renderer) {
    throw new Error('App did not render.');
  }
  const text = renderer.root
    .findAllByType(Text)
    .map(node => node.props.children);
  expect(text).toContain('Windows checks have not run.');
  expect(text).toContain('These checks require Windows.');
  const buttons = renderer.root.findAllByType(ActionButton);
  expect(buttons).toHaveLength(5);
  for (const button of buttons) {
    expect(button.props.disabled).toBe(true);
  }
  await ReactTestRenderer.act(() => renderer?.unmount());
});
