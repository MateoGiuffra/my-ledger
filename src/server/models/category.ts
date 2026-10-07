import { defineModel, ObjectId } from "./helpers";

export interface ICategory {
  _id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  parentId?: string | null;
  isIncome?: boolean;
  deletedAt?: Date | null;
}

export const Category = defineModel<ICategory>("Category", {
  userId: { type: ObjectId, required: true, index: true },
  name: { type: String, required: true, trim: true },
  icon: String,
  color: String,
  parentId: { type: ObjectId, default: null },
  isIncome: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
});
