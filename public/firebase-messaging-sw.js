// Firebase Cloud Messaging service worker.
// This file must live at /firebase-messaging-sw.js (served from the public root).
//
// IMPORTANT: The Firebase config values below are read from the project's
// Firebase initialisation. Because this app loads its Firebase config
// dynamically from localStorage at runtime, these values act as placeholders
// that must be replaced with real values before FCM will work in production.
// The easiest way is to copy the config object from the Firebase console
// (Project settings → Your apps → SDK setup and configuration).

importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  // TODO: Replace with your actual Firebase project config values.
  // These must match the config used when initialising Firebase in the main app.
  apiKey: self.__FIREBASE_API_KEY__ || 'REPLACE_WITH_API_KEY',
  authDomain: self.__FIREBASE_AUTH_DOMAIN__ || 'REPLACE_WITH_AUTH_DOMAIN',
  projectId: self.__FIREBASE_PROJECT_ID__ || 'REPLACE_WITH_PROJECT_ID',
  storageBucket: self.__FIREBASE_STORAGE_BUCKET__ || 'REPLACE_WITH_STORAGE_BUCKET',
  messagingSenderId: self.__FIREBASE_MESSAGING_SENDER_ID__ || 'REPLACE_WITH_MESSAGING_SENDER_ID',
  appId: self.__FIREBASE_APP_ID__ || 'REPLACE_WITH_APP_ID',
});

const messaging = firebase.messaging();

// Handle messages that arrive while the app is in the background or closed.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'New Recipe!', {
    body: body ?? 'A new recipe has been added to the Schafer Family Cookbook.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  });
});
