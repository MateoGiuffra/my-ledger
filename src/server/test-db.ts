import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer | undefined;

export async function startTestDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "test" });
}

export async function stopTestDb() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearTestDb() {
  const cols = await mongoose.connection.db!.collections();
  await Promise.all(cols.map((c) => c.deleteMany({})));
}
