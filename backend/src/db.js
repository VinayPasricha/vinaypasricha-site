// MongoDB connection via Mongoose.
import mongoose from 'mongoose';
import { config } from './config.js';

mongoose.set('strictQuery', true);

export async function connectDb(uri = config.mongoUri) {
  if (!uri) {
    throw new Error('No MongoDB URI provided. Set MONGODB_URI in backend/.env');
  }
  await mongoose.connect(uri, {
    dbName: config.mongoDb,
    // Fail fast instead of hanging for 30s if the cluster is unreachable.
    serverSelectionTimeoutMS: 8000,
  });
  // Ensure TTL and unique indexes defined on the schemas are actually built.
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

export { mongoose };
