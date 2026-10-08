import { defineModel } from "./helpers";

export interface IUser {
  _id: string;
  username: string;
  passwordHash: string;
  settings: { fxPlan: number; fxActual?: number; locale: string; tz: string };
  googleTokens?: { enc: string };
  pushTokens: string[];
  alertPrefs?: { types: string[]; hour: number };
  failedLogins?: number;
  lockedUntil?: Date | null;
}

export const User = defineModel<IUser>("User", {
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  settings: {
    fxPlan: { type: Number, default: 1600 },
    fxActual: { type: Number },
    locale: { type: String, default: "es-AR" },
    tz: { type: String, default: "America/Argentina/Buenos_Aires" },
  },
  googleTokens: { enc: String },
  pushTokens: { type: [String], default: [] },
  failedLogins: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  alertPrefs: {
    types: { type: [String], default: ["commitment", "savings", "payday", "debt"] },
    hour: { type: Number, default: 9 },
  },
});
