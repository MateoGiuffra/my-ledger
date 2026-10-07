import type { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: MongoMemoryServer | undefined;
let usedExternal = false;

/**
 * Si TEST_MONGODB_URI está definido (ej. un Mongo local o FerretDB) se usa con una DB
 * efímera por archivo de test; si no, se levanta mongodb-memory-server.
 */
export async function startTestDb() {
  const external = process.env.TEST_MONGODB_URI;
  if (external) {
    usedExternal = true;
    const dbName = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await mongoose.connect(external, { dbName });
    return;
  }
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "test" });
}

export async function stopTestDb() {
  if (usedExternal) await mongoose.connection.dropDatabase().catch(() => {});
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function clearTestDb() {
  const cols = await mongoose.connection.db!.collections();
  await Promise.all(cols.map((c) => c.deleteMany({})));
}
