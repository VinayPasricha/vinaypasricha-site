// Business logic for the users collection.
import { User } from '../models/User.js';

// Create the user on first sign-in, or update their profile + lastSeen on return.
export async function upsertUser(profile) {
  const now = new Date();
  const user = await User.findOneAndUpdate(
    { googleId: profile.googleId },
    {
      $set: {
        email: profile.email,
        name: profile.name || '',
        picture: profile.picture || '',
        lastSeenAt: now,
      },
      $setOnInsert: { firstSeenAt: now },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return user;
}
