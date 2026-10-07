import { Account, type IAccount } from "../models/account";
import { Category, type ICategory } from "../models/category";
import { plain } from "../models/helpers";

export async function listAccounts(userId: string) {
  return plain(await Account.find({ userId, deletedAt: null }).sort({ createdAt: 1 }).lean<IAccount[]>());
}

export async function listCategories(userId: string) {
  return plain(await Category.find({ userId, deletedAt: null }).sort({ createdAt: 1 }).lean<ICategory[]>());
}

export async function createAccount(userId: string, d: { name: string; type: IAccount["type"]; currency: "ARS" | "USD" }) {
  return Account.create({ ...d, userId });
}

export async function renameAccount(userId: string, id: string, name: string) {
  await Account.updateOne({ _id: id, userId }, { name });
}

export async function archiveAccount(userId: string, id: string) {
  await Account.updateOne({ _id: id, userId }, { deletedAt: new Date() });
}

export async function createCategory(userId: string, d: { name: string; icon?: string; color?: string; isIncome?: boolean }) {
  return Category.create({ ...d, userId });
}

export async function updateCategory(userId: string, id: string, d: { name?: string; icon?: string; color?: string }) {
  await Category.updateOne({ _id: id, userId }, d);
}

export async function archiveCategory(userId: string, id: string) {
  await Category.updateOne({ _id: id, userId }, { deletedAt: new Date() });
}
