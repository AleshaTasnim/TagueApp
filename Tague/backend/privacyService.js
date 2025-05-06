/**
 * privacyService.js - Privacy management service
 * 
 * This service provides functionality for managing user privacy settings
 * and enforcing privacy-related access controls throughout the application.
 * It handles toggling account privacy and checking permissions for profile access.
 * 
 * Features:
 * - Toggle account privacy status (public/private)
 * - Permission verification for profile viewing
 * - Privacy-aware access control for user content
 */

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

const privacyService = {
  // Updates a user's privacy status between public and private
  toggleAccountPrivacy: async (isPrivate) => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');
      
      const userRef = doc(db, 'users', currentUser.uid);
      
      await updateDoc(userRef, {
        isPrivate: isPrivate
      });
      
      return { success: true, isPrivate };
    } catch (error) {
      console.error('Error toggling privacy:', error);
      throw error;
    }
  },
  
  // Determines if the current user has permission to view another user's profile
  canViewProfile: async (targetUserId) => {
    try {
      // If checking own profile, always allow
      const currentUser = auth.currentUser;
      if (!currentUser) return false;
      if (currentUser.uid === targetUserId) return true;
      
      // Get target user data
      const targetUserRef = doc(db, 'users', targetUserId);
      const targetUserDoc = await getDoc(targetUserRef);
      
      if (!targetUserDoc.exists()) return false;
      
      const targetUserData = targetUserDoc.data();
      
      // If target user is public, allow access
      if (!targetUserData.isPrivate) return true;
      
      // If private, check if current user is a follower
      const followers = targetUserData.followers || [];
      return followers.includes(currentUser.uid);
    } catch (error) {
      console.error('Error checking profile access:', error);
      return false;
    }
  }
};

export default privacyService;