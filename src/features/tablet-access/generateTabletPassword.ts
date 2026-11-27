// No 0/O, 1/l/I: the password is read off the screen and typed into the Portal.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const GROUPS = 3;
const GROUP_LENGTH = 4;

// About 70 bits of randomness, shown as `Rk7p-Q2mW-x9tH` (14 characters).
const generateTabletPassword = (random: (bytes: Uint8Array) => Uint8Array = bytes =>
  globalThis.crypto.getRandomValues(bytes)) => {
  const groups: string[] = [];
  for (let group = 0; group < GROUPS; group++) {
    let text = '';
    while (text.length < GROUP_LENGTH) {
      const [byte] = random(new Uint8Array(1));
      // Rejection sampling keeps every character equally likely.
      if (byte !== undefined && byte < 256 - (256 % ALPHABET.length)) text += ALPHABET[byte % ALPHABET.length];
    }
    groups.push(text);
  }
  return groups.join('-');
};

export default generateTabletPassword;
