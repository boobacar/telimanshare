// api/preview.js
// Convert DOCX/XLSX/PPTX to PDF via ConvertAPI (REST) and save into Firebase Storage.
// Expects env vars (set in Vercel Project Settings):
// - CONVERTAPI_SECRET: ConvertAPI secret key
// - FB_STORAGE_BUCKET or VITE_FB_STORAGE_BUCKET: bucket name (e.g., teliman-share.appspot.com)
// - FIREBASE_SERVICE_ACCOUNT: JSON service account (one line, with \n in private_key)

import admin from 'firebase-admin';

let app;
function initAdmin() {
  if (app) return app;
  const svc = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!svc) throw new Error('FIREBASE_SERVICE_ACCOUNT missing');
  const creds = JSON.parse(svc);
  const bucketName = process.env.FB_STORAGE_BUCKET || process.env.VITE_FB_STORAGE_BUCKET;
  if (!bucketName) throw new Error('FB_STORAGE_BUCKET missing');
  app = admin.initializeApp({
    credential: admin.credential.cert(creds),
    storageBucket: bucketName,
  });
  return app;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { url, path, metaId, name } = req.body || {};
    if (!url || !path || !metaId || !name) return res.status(400).json({ error: 'Missing fields' });

    const secret = process.env.CONVERTAPI_SECRET;
    if (!secret) return res.status(501).json({ error: 'CONVERTAPI_SECRET missing' });

    const lower = (name || path).toLowerCase();
    let from = 'docx';
    if (/\.xlsx?$/.test(lower)) from = 'xlsx';
    else if (/\.pptx?$/.test(lower)) from = 'pptx';

    // Trigger conversion
    const endpoint = `https://v2.convertapi.com/convert/${from}/to/pdf?Secret=${encodeURIComponent(secret)}`;
    const payload = {
      Parameters: [
        {
          Name: 'File',
          FileValue: { Url: url },
        },
      ],
    };
    const conv = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!conv.ok) throw new Error('convertapi_failed_' + conv.status);
    const out = await conv.json();
    const fileInfo = out?.Files?.[0];
    if (!fileInfo?.Url) throw new Error('conversion_no_file');

    // Download PDF
    const pdfRes = await fetch(fileInfo.Url);
    if (!pdfRes.ok) throw new Error('download_failed');
    const arr = await pdfRes.arrayBuffer();
    const buffer = Buffer.from(arr);

    // Upload to Firebase Storage
    initAdmin();
    const bucket = admin.storage().bucket();
    const destPath = `previews/${path}.pdf`;
    await bucket.file(destPath).save(buffer, {
      contentType: 'application/pdf',
      metadata: { cacheControl: 'public, max-age=31536000' },
      public: false,
      resumable: false,
    });

    // Update Firestore meta
    const db = admin.firestore();
    await db.collection('metas').doc(metaId).set(
      { preview_pdf_path: destPath, preview_generated_at: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    res.status(200).json({ ok: true, preview: destPath });
  } catch (e) {
    console.error('preview error', e);
    res.status(500).json({ error: String(e?.message || e) });
  }
}

