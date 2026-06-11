// ============================================================
//  TEST SIMULATION — proves the SIV runtime storage works.
//
//  It pretends to be a signed-in user having a SIV conversation,
//  saves it through the SAME service the live API uses, reads it
//  back, and checks the 30-day auto-expiry index is in place.
//
//  Run with:  npm run simulate
//
//  - If MONGODB_URI is set in backend/.env, it uses your real
//    Atlas database (writes to a throwaway "sim-*" user, then
//    cleans up).
//  - If not, it boots a temporary in-memory MongoDB so the test
//    can run with no credentials at all.
// ============================================================
import 'dotenv/config';
import { connectDb, disconnectDb, mongoose } from '../src/db.js';
import { upsertUser } from '../src/services/users.js';
import {
  saveSivConversation,
  listSivConversations,
  getSivConversation,
} from '../src/services/sivStore.js';
import { SivConversation } from '../src/models/SivConversation.js';
import { User } from '../src/models/User.js';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { console.log(`  ✓ ${name}`); pass++; }
  else { console.log(`  ✗ ${name}`); fail++; }
}

async function withDatabase(run) {
  if (process.env.MONGODB_URI) {
    console.log('[sim] using real MongoDB from MONGODB_URI\n');
    await connectDb(process.env.MONGODB_URI);
    return run(true);
  }
  console.log('[sim] no MONGODB_URI set — booting a temporary in-memory MongoDB\n');
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  await connectDb(mem.getUri());
  try { return await run(false); }
  finally { await mem.stop(); }
}

async function main() {
  await withDatabase(async (isReal) => {
    const googleId = 'sim-' + Date.now();
    const email = `sim-${Date.now()}@example.com`;
    const sessionId = 'sim-session-' + Date.now();

    try {
      // 1) A user signs in.
      console.log('1. User signs in with Google (simulated)');
      const user = await upsertUser({ googleId, email, name: 'Sim Tester', picture: '' });
      check('user document created in "users" collection', user && user.googleId === googleId);
      check('user has firstSeenAt + lastSeenAt', !!user.firstSeenAt && !!user.lastSeenAt);

      // 2) They have a SIV conversation — saved turn by turn.
      console.log('\n2. SIV conversation happens and is saved');
      await saveSivConversation({
        userId: googleId, email, sessionId,
        messages: [
          { role: 'user', content: 'Should I take the new job offer in Berlin?' },
          { role: 'assistant', content: 'A Standard SIV — five questions, five lenses — feels right. First: what is the real objective behind this move?' },
        ],
      });
      const afterFirst = await getSivConversation(googleId, sessionId);
      check('conversation saved to "siv_conversations" collection', !!afterFirst);
      check('stored in the correct collection name', SivConversation.collection.collectionName === 'siv_conversations');
      check('runtime tagged as "siv"', afterFirst.runtime === 'siv');
      check('2 messages stored', afterFirst.messages.length === 2);
      check('owned by the right user', afterFirst.userId === googleId);
      check('expiresAt is ~30 days out', afterFirst.expiresAt > new Date(Date.now() + 28 * 864e5));

      // 3) More turns arrive — same session should UPDATE, not duplicate.
      console.log('\n3. More turns arrive (same session updates, no duplicate)');
      await saveSivConversation({
        userId: googleId, email, sessionId,
        status: 'complete',
        artefact: { decision: 'Berlin offer', verdict: 'Accept, with a 6-month review' },
        messages: [
          { role: 'user', content: 'Should I take the new job offer in Berlin?' },
          { role: 'assistant', content: 'First: what is the real objective behind this move?' },
          { role: 'user', content: 'Career growth and a change of scene.' },
          { role: 'assistant', content: 'Here is your one-page thinking artefact.' },
        ],
      });
      const all = await listSivConversations(googleId);
      check('still exactly ONE conversation for this session', all.length === 1);
      check('updated to 4 messages', all[0].messages.length === 4);
      check('status moved to "complete"', all[0].status === 'complete');
      check('artefact (final verdict) stored', all[0].artefact && all[0].artefact.verdict.includes('Accept'));

      // 4) Isolation — another user cannot see this conversation.
      console.log('\n4. Another user cannot read this conversation');
      const otherList = await listSivConversations('sim-other-user');
      check('other user sees 0 conversations', otherList.length === 0);

      // 5) The 30-day auto-delete index really exists.
      console.log('\n5. 30-day auto-expiry (TTL index) is configured');
      const indexes = await SivConversation.collection.indexes();
      const ttl = indexes.find((i) => i.expireAfterSeconds !== undefined && i.key && i.key.expiresAt === 1);
      check('TTL index on expiresAt exists', !!ttl);
      check('TTL set to delete at expiresAt (expireAfterSeconds: 0)', ttl && ttl.expireAfterSeconds === 0);

      console.log('\n   (MongoDB removes expired docs within ~60s of expiry — verified by index, not by waiting 30 days.)');

    } finally {
      // Clean up everything this simulation created.
      await SivConversation.deleteMany({ userId: { $in: [googleId] } });
      await User.deleteMany({ googleId });
      if (isReal) console.log('\n[sim] cleaned up test data from your real database');
    }
  });

  await disconnectDb();

  console.log(`\n================  ${pass} passed, ${fail} failed  ================`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error('\n[sim] ERROR:', err);
  disconnectDb().finally(() => process.exit(1));
});
