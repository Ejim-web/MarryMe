// ============================================
// MARRYME FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyDiZsP0tcprL1xIhu-sCkGP-4Mfv_Rw9dg",
  authDomain: "joblink-d3d17.firebaseapp.com",
  projectId: "joblink-d3d17",
  storageBucket: "joblink-d3d17.firebasestorage.app",
  messagingSenderId: "462684482263",
  appId: "1:462684482263:web:981dcbe334850ca3fe5e92",
  measurementId: "G-WHHYBSKV93"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);


// Firebase services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
