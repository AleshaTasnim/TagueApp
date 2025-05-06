// followService.js
// A centralized service for handling follow/unfollow functionality throughout the app

import { auth, db } from './firebaseConfig';
import { 
    doc, 
    getDoc, 
    updateDoc, 
    arrayUnion, 
    arrayRemove, 
    collection, 
    query, 
    where, 
    getDocs,
    addDoc,
    serverTimestamp,
    deleteDoc 
} from 'firebase/firestore';

/**
 * Checks if the current user is following another user
 */
export const checkFollowStatus = async (targetUserId) => {
    if (!auth.currentUser || !targetUserId) {
        return { isFollowing: false, hasRequestedFollow: false };
    }
    
    try {
        // First check if they're following
        const currentUserDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (currentUserDoc.exists()) {
            const currentUserData = currentUserDoc.data();
            const following = currentUserData.following || [];
            
            // If following, no need to check pending requests
            if (following.includes(targetUserId)) {
                return { isFollowing: true, hasRequestedFollow: false };
            }
        }
        
        // If not following, check if there's a pending request
        const targetUserDoc = await getDoc(doc(db, "users", targetUserId));
        if (targetUserDoc.exists()) {
            const targetUserData = targetUserDoc.data();
            const pendingRequests = targetUserData.pendingFollowRequests || [];
            
            if (pendingRequests.includes(auth.currentUser.uid)) {
                return { isFollowing: false, hasRequestedFollow: true };
            }
        }
        
        return { isFollowing: false, hasRequestedFollow: false };
    } catch (error) {
        console.error("Error checking follow status:", error);
        return { isFollowing: false, hasRequestedFollow: false };
    }
};

/**
 * Checks if another user is following the current user (for "Follow Back" feature)
 */
export const checkIsFollowingMe = async (targetUserId) => {
    if (!auth.currentUser || !targetUserId) {
        return false;
    }
    
    try {
        const currentUserDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (currentUserDoc.exists()) {
            const currentUserData = currentUserDoc.data();
            const followers = currentUserData.followers || [];
            
            return followers.includes(targetUserId);
        }
        return false;
    } catch (error) {
        console.error("Error checking if user is following current user:", error);
        return false;
    }
};

/**
 * Handles follow/unfollow action with privacy-aware request handling
 */
export const handleFollowAction = async (targetUserId, isFollowing, hasRequestedFollow) => {
    if (!auth.currentUser || !targetUserId) {
        throw new Error("User must be logged in to follow others");
    }
    
    try {
        if (isFollowing) {
            // UNFOLLOW - this can be done immediately
            await unfollowUser(targetUserId);
            return { isFollowing: false, hasRequestedFollow: false, action: 'unfollowed' };
            
        } else if (hasRequestedFollow) {
            // REQUEST ALREADY SENT - no action needed
            return { isFollowing: false, hasRequestedFollow: true, action: 'requested' };
            
        } else {
            // NEW FOLLOW ACTION - check privacy and handle appropriately
            const targetUserDoc = await getDoc(doc(db, "users", targetUserId));
            const targetUserData = targetUserDoc.data();
            
            if (targetUserData.isPrivate) {
                // PRIVATE ACCOUNT - send follow request
                await sendFollowRequest(targetUserId, targetUserData);
                return { isFollowing: false, hasRequestedFollow: true, action: 'requested' };
            } else {
                // PUBLIC ACCOUNT - follow directly
                await followUser(targetUserId, targetUserData);
                return { isFollowing: true, hasRequestedFollow: false, action: 'followed' };
            }
        }
    } catch (error) {
        console.error("Error during follow action:", error);
        throw error;
    }
};

/**
 * Internal helper: Directly follows a user (used for public accounts)
 */
const followUser = async (targetUserId, targetUserData) => {
    const currentUserRef = doc(db, "users", auth.currentUser.uid);
    const targetUserRef = doc(db, "users", targetUserId);
    
    // Add target user to current user's following list
    await updateDoc(currentUserRef, {
        following: arrayUnion(targetUserId)
    });
    
    // Add current user to target user's followers list
    await updateDoc(targetUserRef, {
        followers: arrayUnion(auth.currentUser.uid)
    });
    
    // Create a notification for the follow
    await addDoc(collection(db, "notifications"), {
        type: "follow",
        senderId: auth.currentUser.uid,
        senderName: auth.currentUser.displayName,
        senderPhoto: auth.currentUser.photoURL,
        recipientId: targetUserId,
        recipientName: targetUserData.displayName || "User",
        createdAt: serverTimestamp()
    });
};

/**
 * Internal helper: Sends a follow request (used for private accounts)
 */
const sendFollowRequest = async (targetUserId, targetUserData) => {
    // First check if there's already a pending request
    const notificationsRef = collection(db, "notifications");
    const q = query(
        notificationsRef,
        where("type", "==", "follow_request"),
        where("senderId", "==", auth.currentUser.uid),
        where("recipientId", "==", targetUserId),
        where("status", "==", "pending")
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
        // No existing request, send a new one
        const profileUserRef = doc(db, "users", targetUserId);
        
        // Add current user to target user's pending requests
        await updateDoc(profileUserRef, {
            pendingFollowRequests: arrayUnion(auth.currentUser.uid)
        });
        
        // Create a notification
        await addDoc(collection(db, "notifications"), {
            type: "follow_request",
            senderId: auth.currentUser.uid,
            senderName: auth.currentUser.displayName,
            senderPhoto: auth.currentUser.photoURL,
            recipientId: targetUserId,
            recipientName: targetUserData.displayName || "User",
            status: "pending",
            createdAt: serverTimestamp()
        });
    }
};

/**
 * Internal helper: Unfollows a user
 */
const unfollowUser = async (targetUserId) => {
    const currentUserRef = doc(db, "users", auth.currentUser.uid);
    const profileUserRef = doc(db, "users", targetUserId);
    
    // Remove target user from current user's following list
    await updateDoc(currentUserRef, {
        following: arrayRemove(targetUserId)
    });
    
    // Remove current user from target user's followers AND pendingFollowRequests
    await updateDoc(profileUserRef, {
        followers: arrayRemove(auth.currentUser.uid),
        pendingFollowRequests: arrayRemove(auth.currentUser.uid)
    });
    
    // Delete any pending follow request notifications
    const notificationsRef = collection(db, "notifications");
    const q = query(
        notificationsRef,
        where("type", "==", "follow_request"),
        where("senderId", "==", auth.currentUser.uid),
        where("recipientId", "==", targetUserId),
        where("status", "==", "pending")
    );
    
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach(async (document) => {
        await deleteDoc(document.ref);
    });
};

/**
 * Gets formatted button text based on follow status
 */
export const getFollowButtonText = (isFollowing, hasRequestedFollow, isFollowingMe) => {
    if (isFollowing) {
        return { 
            text: 'Following',
            bgColor: 'bg-primary border-black border',
            textColor: 'text-black'
        };
    } else if (hasRequestedFollow) {
        return { 
            text: 'Requested',
            bgColor: 'bg-gray-400',
            textColor: 'text-white'
        };
    } else if (isFollowingMe) {
        return { 
            text: 'Follow Back',
            bgColor: 'bg-black',
            textColor: 'text-primary'
        };
    } else {
        return { 
            text: 'Follow',
            bgColor: 'bg-black',
            textColor: 'text-primary'
        };
    }
};

export default {
    checkFollowStatus,
    checkIsFollowingMe,
    handleFollowAction,
    getFollowButtonText
};