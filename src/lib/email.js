import emailjs from "@emailjs/browser";

const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;

const TEMPLATE_ADMIN = import.meta.env.VITE_EMAILJS_ADMIN_TEMPLATE_ID; // -> nouvelle inscription
const TEMPLATE_USER = import.meta.env.VITE_EMAILJS_USER_TEMPLATE_ID; // -> inscription approuvée

let inited = false;
export function initEmail() {
  if (!inited) {
    if (!PUBLIC_KEY)
      console.warn("EmailJS: VITE_EMAILJS_PUBLIC_KEY manquante.");
    emailjs.init(PUBLIC_KEY);
    inited = true;
  }
}

/** Envoi aux admins (boucle sur la liste) */
export async function sendAdminNewSignup({
  toEmails,
  appName,
  userName,
  userEmail,
  approveUrl,
}) {
  initEmail();
  const tasks = (toEmails || []).map((to_email) =>
    emailjs.send(SERVICE_ID, TEMPLATE_ADMIN, {
      to_email,
      app_name: appName,
      user_name: userName || "",
      user_email: userEmail || "",
      approve_url: approveUrl || "",
    })
  );
  return Promise.allSettled(tasks);
}

/** Envoi à l'utilisateur approuvé */
export async function sendUserApproved({ toEmail, toName, appName, loginUrl }) {
  initEmail();
  return emailjs.send(SERVICE_ID, TEMPLATE_USER, {
    to_email: toEmail,
    to_name: toName || "",
    app_name: appName,
    login_url: loginUrl || "",
  });
}
