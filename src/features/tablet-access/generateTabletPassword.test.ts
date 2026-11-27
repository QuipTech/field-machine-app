import generateTabletPassword from './generateTabletPassword';
import { tabletPasswordSchema } from './tabletAccessSchema';

test('generates a contract-valid password without look-alike characters', () => {
  for (let index = 0; index < 50; index++) {
    const password = generateTabletPassword(bytes => {
      bytes[0] = Math.floor(Math.random() * 256);
      return bytes;
    });
    expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}-[A-HJ-NP-Za-km-z2-9]{4}$/);
    expect(tabletPasswordSchema.safeParse(password).success).toBe(true);
  }
});

test('discards biased random bytes', () => {
  const bytes = [255, 254, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const password = generateTabletPassword(buffer => {
    buffer[0] = bytes.shift() ?? 0;
    return buffer;
  });
  expect(password).toBe('ABCD-EFGH-JKLM');
});
