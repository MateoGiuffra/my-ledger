import { defineModel, ObjectId } from "./helpers";

export type AccountType = "mp" | "cash" | "card" | "cocos" | "sube";

export interface IAccount {
  _id: string;
  userId: string;
  name: string;
  type: AccountType;
  currency: "ARS" | "USD";
  deletedAt?: Date | null;
}

export const Account = defineModel<IAccount>("Account", {
  userId: { type: ObjectId, required: true, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ["mp", "cash", "card", "cocos", "sube"], required: true },
  currency: { type: String, enum: ["ARS", "USD"], default: "ARS" },
  deletedAt: { type: Date, default: null },
});
