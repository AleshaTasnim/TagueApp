import { initializeApp } from "firebase/app";
import { 
  initializeAuth, 
  getReactNativePersistence 
} from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";
import { getStorage } from "firebase/storage";
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "", //INSERT API KEY INSIDE THE DOUBLE QUOTES e.g. "1234" NOT e.g. 1234
  authDomain: "tague-8dc9d.firebaseapp.com",
  projectId: "tague-8dc9d",
  storageBucket: "tague-8dc9d.firebasestorage.app",
  messagingSenderId: "72105716601",
  appId: "1:72105716601:web:9efd1e07b2b6e5b0cb1da8",
  measurementId: "G-JMRCF0X9JG"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with AsyncStorage for persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// Initialize Firebase Storage
const storage = getStorage(app);
const db = getFirestore(app);

export { app, auth, storage, db };