import { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (rawServiceAccount) {
        try {
            const serviceAccount = JSON.parse(rawServiceAccount);
            if (serviceAccount.project_id) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                    storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
                });
            }
        } catch (error) {
            console.error('Invalid FIREBASE_SERVICE_ACCOUNT JSON; Firebase Admin not initialized.', error);
        }
    }
}

/** Build the full webhook URL Twilio is calling (must match exactly for signature validation). */
function getWebhookUrl(req: VercelRequest): string {
    const host = req.headers['x-forwarded-host'] || req.headers.host || process.env.VERCEL_URL || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    return `${proto}://${host}/api/webhook`;
}

function buildTwilioMediaAuthHeader(): string | null {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) return null;
    return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Validate Twilio signature when TWILIO_AUTH_TOKEN is set (production)
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (authToken) {
        const signature = req.headers['x-twilio-signature'] as string | undefined;
        const url = getWebhookUrl(req);
        const params = (req.body || {}) as Record<string, string>;
        const isValid = twilio.validateRequest(authToken, signature || '', url, params);
        if (!isValid) {
            console.warn('Twilio webhook: invalid signature');
            return res.status(403).json({ error: 'Invalid signature' });
        }
    } else if (process.env.NODE_ENV === 'production') {
        console.warn('Twilio webhook: TWILIO_AUTH_TOKEN not set; requests are not validated');
    }

    const { Body, From, MediaUrl0, NumMedia } = req.body;

    // 1. Basic Validation

    // Validate E.164 phone number format
    if (typeof From !== 'string' || !/^\+[1-9]\d{1,14}$/.test(From)) {
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message('archive keeper: invalid sender number.');
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twiml.toString());
    }

    // Validate caption length
    if (typeof Body === 'string' && Body.length > 500) {
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message('archive keeper: caption is too long. please keep it under 500 characters.');
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twiml.toString());
    }

    if (!From || parseInt(NumMedia) === 0 || !MediaUrl0) {
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message('archive keeper: no media detected. please text a photo or video to preserve it.');
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twiml.toString());
    }

    try {
        const db = admin.firestore();
        const bucket = admin.storage().bucket();

        // 2. Identify Contributor
        // Matching strategy: try the exact E.164 number first, then a variant with/without
        // the leading '+'. This handles contributors who may have stored their phone number
        // in either format in the database.
        const normalizedFrom = From.replace(/\s/g, '');
        const variants = [normalizedFrom, normalizedFrom.startsWith('+') ? normalizedFrom.slice(1) : `+${normalizedFrom}`];
        let contributorName = 'MMS Submission';
        for (const phone of variants) {
            const snap = await db.collection('contributors').where('phone', '==', phone).get();
            if (!snap.empty) {
                contributorName = snap.docs[0].data().name;
                break;
            }
        }

        // 3. Download Media from Twilio
        const mediaAuthHeader = buildTwilioMediaAuthHeader();
        const response = await fetch(MediaUrl0, mediaAuthHeader
            ? { headers: { Authorization: mediaAuthHeader } }
            : undefined);
        if (!response.ok) throw new Error('Failed to download media from Twilio');

        // Validate file type - only allow image and video MIME types
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
            const twiml = new twilio.twiml.MessagingResponse();
            twiml.message('archive keeper: unsupported file type. please send a photo or video.');
            res.setHeader('Content-Type', 'text/xml');
            return res.status(200).send(twiml.toString());
        }

        // Validate file size - reject files larger than 25MB
        const contentLength = response.headers.get('content-length');
        const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
        if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
            const twiml = new twilio.twiml.MessagingResponse();
            twiml.message('archive keeper: file is too large. please send media under 25MB.');
            res.setHeader('Content-Type', 'text/xml');
            return res.status(200).send(twiml.toString());
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const extension = contentType.split('/')[1] || 'jpg';

        // 4. Upload to Firebase Storage
        const fileName = `gallery/mms_${Date.now()}.${extension}`;
        const file = bucket.file(fileName);
        await file.save(buffer, {
            metadata: { contentType }
        });

        // Make public and get URL (or use getDownloadURL equivalent for admin)
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

        // 5. Create Archive Entry
        const itemId = 'g' + Date.now();
        const galleryItem = {
            id: itemId,
            type: contentType.startsWith('video') ? 'video' : 'image',
            url: publicUrl,
            caption: Body || 'Preserved via MMS',
            contributor: contributorName,
            created_at: new Date().toISOString()
        };

        await db.collection('gallery').doc(itemId).set(galleryItem);

        // 6. Record History
        const historyId = 'h' + Date.now();
        await db.collection('history').doc(historyId).set({
            id: historyId,
            contributor: contributorName,
            action: 'added',
            type: 'gallery',
            itemName: galleryItem.caption,
            timestamp: new Date().toISOString()
        });

        // 7. Success Response to Family Member
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message(`archive keeper: memory preserved. thank you, ${contributorName.toLowerCase()}. it has been added to the family gallery.`);

        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twiml.toString());

    } catch (error: any) {
        console.error('MMS Webhook Error:', error);
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message('archive keeper: error preserving memory. please try again later.');
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twiml.toString());
    }
}
