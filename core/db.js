// core/db.js - Firebase init & CRUD helpers
// Cấu hình Firebase - thay bằng config thực của project
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
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

/** Lấy toàn bộ dữ liệu một collection */
export function getAll(collection) {
  return db.ref(collection).once('value').then(snap => {
    const data = snap.val() || {};
    return Object.entries(data).map(([key, val]) => ({ _key: key, ...val }));
  });
}

/** Lắng nghe realtime một collection */
export function onSnapshot(collection, callback) {
  const ref = db.ref(collection);
  ref.on('value', snap => {
    const data = snap.val() || {};
    const items = Object.entries(data).map(([key, val]) => ({ _key: key, ...val }));
    callback(items);
  });
  return () => ref.off(); // unsub function
}

/** Thêm bản ghi mới (auto key) */
export function addItem(collection, data) {
  return db.ref(collection).push({ ...data, createdAt: Date.now() });
}

/** Cập nhật bản ghi theo key */
export function updateItem(collection, key, data) {
  return db.ref(`${collection}/${key}`).update({ ...data, updatedAt: Date.now() });
}

/** Xoá bản ghi theo key */
export function deleteItem(collection, key) {
  return db.ref(`${collection}/${key}`).remove();
}

/** Lấy một bản ghi theo key */
export function getItem(collection, key) {
  return db.ref(`${collection}/${key}`).once('value').then(snap => snap.val());
}

/** Tìm kiếm theo một field */
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

/** Format tiền VND */
export function formatVND(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ';
}

/** Parse tiền từ string */
export function parseVND(str) {
  return parseInt((str + '').replace(/[^0-9]/g, '')) || 0;
}
