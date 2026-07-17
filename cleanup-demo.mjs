// One-off: delete the 'demo' test participant + all its data from the shared
// abl_* Firestore collections. Run: node cleanup-demo.mjs
import { Firestore } from "@google-cloud/firestore";

const db = new Firestore({ projectId: "project-65b6724f-5ba8-4e67-bf3" });

const snap = await db.collection("abl_participants").where("slug", "==", "demo").get();
if (snap.empty) { console.log("no demo participant found — nothing to delete"); process.exit(0); }

for (const doc of snap.docs) {
  const id = doc.id;
  let n = 0;
  for (const col of ["abl_sessions", "abl_messages", "abl_outputs"]) {
    const s = await db.collection(col).where("participant_id", "==", id).get();
    for (const d of s.docs) { await d.ref.delete(); n++; }
  }
  await db.collection("abl_research").doc(id).delete().catch(() => {});
  await db.collection("abl_qa").doc(id).delete().catch(() => {});
  await doc.ref.delete();
  console.log(`deleted demo participant ${id} (+${n} child docs)`);
}
