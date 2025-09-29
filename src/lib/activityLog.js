// src/lib/activityLog.js
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

// Ecrit une activité dans Firestore sans bloquer l'UX si ça échoue
export async function logActivity(db, user, activity) {
  try {
    if (!db || !user) return;
    const payload = {
      action: activity?.action || "unknown",
      target: activity?.target ?? null,
      meta: activity?.meta ?? null,
      actor_uid: user.uid,
      actor_email: (user.email || "").toLowerCase(),
      ts: serverTimestamp(),
    };
    await addDoc(collection(db, "activity_logs"), payload);
  } catch (e) {
    console.warn("logActivity failed", e);
  }
}

