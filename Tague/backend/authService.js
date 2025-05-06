/**
 * authService.js - Firebase authentication service
 * 
 * This service provides authentication functionality for user signup and login
 * using Firebase Authentication. It handles creating new user accounts and
 * authenticating existing users with email and password.
 * 
 * Features:
 * - User registration with email and password
 * - User authentication with email and password
 * - Error handling for authentication operations
 */

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebaseConfig";

// Creates a new user account with the provided email and password
export const signUpUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

// Authenticates an existing user with email and password
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};