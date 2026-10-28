/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker (web push).
 * Public Firebase web config only — required for getToken() / background messages.
 */
importScripts(
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyA-IIntsGg8S6BsDPFcvF5oTe8Nr-mvdNc",
  authDomain: "kavachsaathi.firebaseapp.com",
  projectId: "kavachsaathi",
  storageBucket: "kavachsaathi.firebasestorage.app",
  messagingSenderId: "375452318042",
  appId: "1:375452318042:web:53af816e6cb03b0a599b63",
});

firebase.messaging();

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
