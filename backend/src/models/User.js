// The "users" collection — one document per person who signs in with Google.
import { mongoose } from '../db.js';

const userSchema = new mongoose.Schema(
  {
    // Google's permanent unique id for this account (the "sub" claim).
    // This is our canonical user id.
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    name: { type: String, default: '' },
    picture: { type: String, default: '' },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  {
    collection: 'users',
    timestamps: false,
  }
);

export const User = mongoose.model('User', userSchema);
