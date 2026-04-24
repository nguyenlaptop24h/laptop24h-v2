// core/db.js - Firebase init & CRUD helpers

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCDT00j5rXt8IeFHHxkDIuwasi2st_NEyM",
  authDomain:        "quan-li-laptop24h.firebaseapp.com",
  databaseURL:       "https://quan-li-laptop24h-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "quan-li-laptop24h",
  storageBucket:     "quan-li-laptop24h.firebasestorage.app",
  messagingSenderId: "716540645874",
  appId:             "1:716540645874:web:9c16a779fcc4ffd7e19b6b"
};

let db = null;

export async function initDB() {
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  db = firebase.database();
  return db;
}

export function getDB() {
  return db;
}

// ---- CRUD helpers ----

export function getAll(collection) {
  return db.ref(collection).once('value').then(snap => {
    const data = snap.val() || {};
    return Object.entries(data).map(([key, val]) => ({ _key: key, ...val }));
  });
}

export function onSnapshot(collection, callback) {
  const ref = db.ref(collection);
  ref.on('value', snap => {
    const data = snap.val() || {};
    const items = Object.entries(data).map(([key, val]) => {
      const { _key: storedKey, ...rest } = val;
      return { _key: key, ...rest };
    });
    callback(items);
  });
  return () => ref.off('value');
}

export function addItem(collection, data) {
  return db.ref(collection).push({ ...data, createdAt: Date.now() });
}

export function updateItem(collection, key, data) {
  return db.ref(`${collection}/${key}`).update({ ...data, updatedAt: Date.now() });
}

export function deleteItem(collection, key) {
  return db.ref(`${collection}/${key}`).remove();
}

export function getItem(collection, key) {
  return db.ref(`${collection}/${key}`).once('value').then(snap => snap.val());
}

export function queryByField(collection, field, value) {
  return db.ref(collection)
    .orderByChild(field)
    .equalTo(value)
    .once('value')
    .then(snap => {
      const data = snap.val() || {};
      return Object.entries(data).map(([key, val]) => ({ _key: key, ...val }));
    });
}

export function formatVND(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' Ä';
}

export function parseVND(str) {
  return parseInt((str + '').replace(/[^0-9]/g, '')) || 0;
}
