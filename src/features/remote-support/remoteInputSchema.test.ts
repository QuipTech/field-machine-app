import remoteInputSchema from './remoteInputSchema';

const pointer = { v: 1, type: 'pointer', action: 'down', x: 0.42, y: 0.61, button: 0 };

test.each([
  pointer,
  { v: 1, type: 'wheel', x: 0, y: 1, deltaX: -120, deltaY: 120 },
  { v: 1, type: 'key', action: 'up', key: 'a', code: 'KeyA', alt: false, ctrl: false, shift: false, meta: false },
  { v: 1, type: 'text', text: 'A café' },
])('accepts bounded control messages', message => {
  expect(remoteInputSchema.safeParse(message).success).toBe(true);
});

test.each([
  { ...pointer, v: 2 },
  { ...pointer, x: -0.1 },
  { ...pointer, y: Infinity },
  { ...pointer, button: 0.5 },
  { ...pointer, action: 'double-click' },
  { v: 1, type: 'text', text: 'a'.repeat(2049) },
])('rejects invalid control messages', message => {
  expect(remoteInputSchema.safeParse(message).success).toBe(false);
});
