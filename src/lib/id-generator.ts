
import { collection, query, where, getDocs, Firestore, limit } from "firebase/firestore";

/**
 * Generates a random 6-character alphanumeric string.
 */
export const generateGuardrailID = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars like 0, O, I, 1
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Checks if a Guardrail ID is unique across all users.
 */
export const isGuardrailIDUnique = async (db: Firestore, id: string): Promise<boolean> => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("guardrailId", "==", id), limit(1));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  } catch (error) {
    // Return false on error to force a retry/regeneration
    return false;
  }
};

/**
 * Generates a unique Guardrail ID, retrying if a collision occurs.
 */
export const getUniqueGuardrailID = async (db: Firestore): Promise<string> => {
  let attempts = 0;
  let id = "";
  let unique = false;

  while (!unique && attempts < 5) {
    id = `GR-${generateGuardrailID()}`;
    unique = await isGuardrailIDUnique(db, id);
    attempts++;
  }
  
  if (!unique) {
    id = `GR-${generateGuardrailID()}${Date.now().toString().slice(-2)}`;
  }
  
  return id;
};
