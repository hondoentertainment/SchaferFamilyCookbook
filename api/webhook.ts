import { NextApiRequest, NextApiResponse } from 'next';
import twilio from 'twilio';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (serviceAccount.project_id) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
        });
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { Body, From, MediaUrl0, NumMedia } = req.body;

    // 1. Basic Validation
    if (!From || parseInt(NumMedia) === 0 || !MediaUrl0) {
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message("archive keeper: no media detected. please text a photo or video to preserve it.");
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twiml.toString());
    }

    try {
        const db = admin.firestore();
        const bucket = admin.storage().bucket();

        // 2. Identify Contributor
        const contributorsSnapshot = await db.collection('contributors').where('phone', '==', From).get();
        let contributorName = "MMS Submission";
        if (!contributorsSnapshot.empty) {
            contributorName = contributorsSnapshot.docs[0].data().name;
        }

        // 3. Download Media from Twilio
        const response = await fetch(MediaUrl0);
        if (!response.ok) throw new Error("Failed to download media from Twilio");
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || 'image/jpeg';
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
            caption: Body || "Preserved via MMS",
            contributor: contributorName,
            created_at: new Date().toISOString()
        };

        await db.collection('gallery').doc(itemId).set(galleryItem);

        // 6. Record History
        await db.collection('history').doc('h' + Date.now()).set({
            id: 'h' + Date.now(),
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
        console.error("MMS Webhook Error:", error);
        const twiml = new twilio.twiml.MessagingResponse();
        twiml.message("archive keeper: error preserving memory. please try again later.");
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twiml.toString());
    }
}
