import mongoose from "mongoose";

const g = globalThis as unknown as { _mongoose?: { conn?: typeof mongoose; promise?: Promise<typeof mongoose> } };
const cache = (g._mongoose ??= {});

/** Conexión cacheada (sobrevive al hot-reload de dev). */
export async function connectDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Falta MONGODB_URI");
  cache.promise ??= mongoose.connect(uri, { bufferCommands: false });
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = undefined;
    throw e;
  }
  return cache.conn;
}
