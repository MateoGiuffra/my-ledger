import { Account } from "../models/account";
import { Category } from "../models/category";
import { Alert, Commitment, CommitmentOccurrence } from "../models/commitment";
import { DebtEntry, Person } from "../models/debt";
import { plain } from "../models/helpers";
import { Counterparty, ImportBatch, Rule } from "../models/import";
import { Goal, SavingsEntry, SavingsPlan } from "../models/savings";
import { Transaction } from "../models/transaction";
import { User } from "../models/user";

/** Backup completo de los datos del usuario (sin hash de contraseña ni tokens de Google/push). */
export async function exportAll(userId: string) {
  const q = { userId };
  const [user, accounts, categories, rules, counterparties, transactions, importBatches, persons, debtEntries, commitments, occurrences, plan, savingsEntries, goals, alerts] = await Promise.all([
    User.findById(userId).select("username settings alertPrefs").lean(),
    Account.find(q).lean(),
    Category.find(q).lean(),
    Rule.find(q).lean(),
    Counterparty.find(q).lean(),
    Transaction.find(q).lean(),
    ImportBatch.find(q).select("-data").lean(),
    Person.find(q).lean(),
    DebtEntry.find(q).lean(),
    Commitment.find(q).select("-gcalEventId").lean(),
    CommitmentOccurrence.find(q).lean(),
    SavingsPlan.findOne(q).lean(),
    SavingsEntry.find(q).lean(),
    Goal.find(q).lean(),
    Alert.find(q).lean(),
  ]);
  return plain({ exportedAt: new Date().toISOString(), user, accounts, categories, rules, counterparties, transactions, importBatches, persons, debtEntries, commitments, occurrences, plan, savingsEntries, goals, alerts });
}
