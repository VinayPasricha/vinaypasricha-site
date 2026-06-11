// gen-master-key.mjs — generate the master key AND its three Shamir keeper-pieces (2-of-3).
// Run ONCE at setup. Distribute one piece to each of the three keepers (see ACCOUNTS.md).
// Any TWO pieces recover the key; one alone is useless. In production the live key lives in
// a managed KMS; these three pieces are only the break-glass backup.
import { randomBytes } from 'node:crypto';

const master = randomBytes(32);
console.log('\n=== MASTER KEY (paste into .env as MASTER_KEY_BASE64, then store securely) ===');
console.log(master.toString('base64'));

try {
  const { split } = await import('shamir-secret-sharing');
  const shares = await split(master, 3, 2);                 // 3 pieces, threshold 2
  console.log('\n=== THREE KEEPER PIECES (2-of-3) — give ONE to each keeper, then DELETE this output ===');
  shares.forEach((s, i) => console.log('Keeper ' + (i + 1) + ': ' + Buffer.from(s).toString('base64')));
  console.log('\nAny two of the three recover the key. One alone is useless.\n');
} catch (e) {
  console.log('\n[!] shamir-secret-sharing not installed — run `npm install` first to also print the 3 keeper pieces.');
  console.log('    The master key above is still valid; you just have no split backup yet.\n');
}
