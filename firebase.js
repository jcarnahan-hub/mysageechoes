// ── SAGEECHOES: Firebase Configuration ──
const firebaseConfig = {
  apiKey: "AIzaSyAceTzNmGdvhxPbjfgEXm2MuNc93ZztcCs",
  authDomain: "mysageechoes.firebaseapp.com",
  projectId: "mysageechoes",
  storageBucket: "mysageechoes.firebasestorage.app",
  messagingSenderId: "580363445801",
  appId: "1:580363445801:web:80194ffcf5a11e7ba7de38"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
console.log("✅ Firebase connected to SageEchoes");
