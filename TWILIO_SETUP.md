# Twilio MMS Setup Guide

This guide walks you through setting up Twilio so family members can text photos and videos directly to the Family Gallery.

## Overview

**Flow:** Text photo/video → Twilio phone number → Webhook (`/api/webhook`) → Firebase Storage + Firestore gallery

- Family members text a photo or video to your Twilio number
- Twilio forwards the media to your webhook
- The webhook uploads to Firebase Storage, creates a gallery entry in Firestore, and replies with confirmation

## Prerequisites

- [Vercel](https://vercel.com) deployment (the webhook runs as a serverless function)
- [Firebase](https://firebase.google.com) project with Firestore and Storage
- [Twilio](https://www.twilio.com) account

---

## Step 1: Create a Twilio Account

1. Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up (trial accounts get free credits)
3. Verify your email and phone

---

## Step 2: Get a Phone Number with MMS

1. In the [Twilio Console](https://console.twilio.com), go to **Phone Numbers → Manage → Buy a number**
2. Enable **SMS** and **MMS** capabilities
3. Buy a number (US numbers typically cost ~$1.15/month)
4. Note the number (e.g. `+15551234567`)

---

## Step 3: Configure the Webhook URL

1. In Twilio Console, go to **Phone Numbers → Manage → Active numbers**
2. Click your number
3. Under **Messaging configuration**:
   - **A MESSAGE COMES IN**: Webhook
   - **URL**: `https://your-app.vercel.app/api/webhook`
   - **HTTP**: POST

4. Replace `your-app.vercel.app` with your actual Vercel domain (e.g. `schafer-family-cookbook.vercel.app`)

5. Save

---

## Step 4: Set Environment Variables

In your **Vercel** project → **Settings → Environment Variables**, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | `{"type":"service_account","project_id":"...",...}` | Full JSON of your Firebase service account key |
| `TWILIO_AUTH_TOKEN` | `your_auth_token` | From [Twilio Console → Account → Auth Token](https://console.twilio.com) |

### Get `FIREBASE_SERVICE_ACCOUNT`

1. Firebase Console → Project Settings → Service accounts
2. Generate new private key (JSON)
3. Copy the **entire** JSON and paste as the env value (as a single line or escaped)

### Get `TWILIO_AUTH_TOKEN`

1. [Twilio Console](https://console.twilio.com) → Account → Auth Token (show/hide to copy)
2. Keep this secret; it’s used to validate webhook requests

---

## Step 5: Enable Firebase Storage CORS (if needed)

If uploads fail with CORS errors:

1. Create `cors.json`:
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST"],
    "maxAgeSeconds": 3600
  }
]
```

2. Run: `gsutil cors set cors.json gs://YOUR_BUCKET_NAME`

---

## Step 6: Set the Archive Phone in the App

1. Deploy your app to Vercel
2. Log in as an admin
3. Go to **Admin → Gallery**
4. Enter your Twilio number (E.164, e.g. `+15551234567`) in **Twilio Configuration**
5. The number will appear in the Gallery tab for family to use

---

## Step 7: Attribute Photos to Contributors (Optional)

To show the sender’s name instead of "MMS Submission":

1. Go to **Admin → Directory**
2. Click **Phone** next to each contributor
3. Enter their phone number in **E.164** format (e.g. `+15551234567`)
4. When they text from that number, their name is used as the contributor

---

## Testing

1. Text a photo to your Twilio number
2. You should get a reply: *"archive keeper: memory preserved. thank you, [name]. it has been added to the family gallery."*
3. Check the Gallery tab in the app

---

## Troubleshooting

### "archive keeper: no media detected"
- The message had no image/video attached; send a photo or video

### "archive keeper: error preserving memory"
- Check Vercel function logs for details
- Ensure `FIREBASE_SERVICE_ACCOUNT` is valid JSON and has Storage/Firestore access
- Ensure the webhook URL in Twilio matches your deployment exactly (https, no trailing slash)

### 403 Invalid signature
- Ensure `TWILIO_AUTH_TOKEN` matches the Auth Token in Twilio Console
- Ensure the webhook URL in Twilio exactly matches your live URL (including https)

### Local development
- Run `vercel dev` to test the webhook locally (e.g. with ngrok)
- Set `TWILIO_AUTH_TOKEN` in `.env.local` if validating signatures locally

---

## Security Notes

- The webhook validates the `X-Twilio-Signature` header when `TWILIO_AUTH_TOKEN` is set
- Without the token, requests are not validated—always set it in production
- Keep `TWILIO_AUTH_TOKEN` and `FIREBASE_SERVICE_ACCOUNT` secret
