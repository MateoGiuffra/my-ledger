import mongoose, { Schema, type SchemaOptions } from "mongoose";

export { mongoose, Schema };
export const ObjectId = Schema.Types.ObjectId;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Def = Record<string, any>;

/**
 * Crea (o reutiliza, por hot-reload) un modelo con timestamps.
 * La definición va tipada como Record<string, any>: la inferencia de tipos de Schema de
 * Mongoose es carísima para tsc; el tipo del documento lo damos nosotros con la interfaz T.
 */
export function defineModel<T>(name: string, def: Def, opts: SchemaOptions = {}, init?: (s: Schema) => void) {
  const existing = mongoose.models[name];
  if (existing) return existing as unknown as mongoose.Model<T>;
  const schema = new Schema(def as never, { timestamps: true, ...opts }) as Schema;
  init?.(schema);
  return mongoose.model(name, schema) as unknown as mongoose.Model<T>;
}

/** Documento lean → JSON plano (ids a string, fechas a ISO) para pasar a Client Components. */
export function plain<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc));
}
