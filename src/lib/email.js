// src/lib/email.js
import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const ADMIN_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_ADMIN_TEMPLATE_ID;
const USER_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_USER_TEMPLATE_ID;

const ORIGIN = window.location.origin;
const APP_NAME = "TelimanShare";
const SUPPORT_EMAIL = "support@telimanlogistique.com";

// Active 5 min si besoin de voir les params réellement envoyés
const DEBUG_EMAILJS = false;
function debugLog(label, payload) {
  if (DEBUG_EMAILJS) {
    console.log(`[EmailJS DEBUG] ${label}`, JSON.stringify(payload, null, 2));
    alert(`[EmailJS DEBUG] ${label}:\n${JSON.stringify(payload, null, 2)}`);
  }
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Email aux ADMINs: notification nouvelle inscription
 * @param {string} adminEmail destinataire admin
 * @param {{ uid: string, email: string, name?: string }} user
 */
export async function sendAdminNewSignup(adminEmail, user) {
  const to_email = normalizeEmail(adminEmail);
  if (!isValidEmail(to_email)) {
    throw new Error(`Admin email invalide: "${to_email}"`);
  }

  const user_email = normalizeEmail(user?.email);
  const user_name = (
    user?.name || (user_email ? user_email.split("@")[0] : "Utilisateur")
  ).trim();
  const approve_url = `${ORIGIN}/demandes?uid=${encodeURIComponent(
    user?.uid || ""
  )}`;

  const params = {
    // ⚠️ doit correspondre au champ "To email" du template EmailJS
    to_email,
    // placeholders de ton template Admin
    user_name,
    user_email,
    approve_url,
  };

  debugLog("sendAdminNewSignup params", params);

  const res = await emailjs.send(
    SERVICE_ID,
    ADMIN_TEMPLATE_ID,
    params,
    PUBLIC_KEY
  );
  return res;
}

/**
 * Email à l'UTILISATEUR: compte approuvé
 * @param {string} userEmail destinataire
 * @param {string} userName  nom (optionnel)
 */
export async function sendUserApproved(userEmail, userName) {
  const to_email = normalizeEmail(userEmail);
  if (!isValidEmail(to_email)) {
    throw new Error(`Email utilisateur invalide: "${to_email}"`);
  }

  const to_name = (userName || to_email.split("@")[0]).trim();
  const login_url = `${ORIGIN}/signin`;

  const params = {
    // ⚠️ doit correspondre au champ "To email" du template EmailJS
    to_email,
    // placeholders de ton template User
    to_name,
    app_name: APP_NAME,
    login_url,
    support_email: SUPPORT_EMAIL,
  };

  debugLog("sendUserApproved params", params);

  const res = await emailjs.send(
    SERVICE_ID,
    USER_TEMPLATE_ID,
    params,
    PUBLIC_KEY
  );
  return res;
}
