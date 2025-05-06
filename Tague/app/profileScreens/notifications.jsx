/**
 * Notifications.jsx - Notification management interface
 * 
 * This component displays and manages the user's notifications, including
 * follow requests, likes, comments, and follow actions. It handles rendering
 * different notification types and provides appropriate actions for each type.
 * 
 * Features:
 * - Different display formats for various notification types
 * - Follow request accept/decline actions with Firestore updates
 * - Notification dismissal and read status management
 * - Relative time formatting for notification timestamps
 * - Navigation to user profiles and related posts
 * - Loading states and empty state handling
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { icons } from '../../constants/icons';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  deleteDoc, 
  addDoc,
  serverTimestamp, 
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import followService from '../../backend/followService';

const Notifications = () => {
  // State variables for notifications data and UI interactions
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingNotification, setProcessingNotification] = useState(null);
  
  // Current authenticated user reference
  const currentUser = auth.currentUser;

  // Navigate back to previous screen
  const goBack = () => {
    router.back();
  };
  
  // Load notifications when component mounts
  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
    } else {
      setLoading(false);
    }
  }, [currentUser]);
  
  // Fetch and process notifications from Firestore
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const notificationsRef = collection(db, "notifications");
      const q = query(
        notificationsRef,
        where("recipientId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const notificationsData = [];
      
      for (const docSnapshot of querySnapshot.docs) {
        const notificationData = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Skip follow requests that have been responded to
        if (
          notificationData.type === "follow_request" && 
          (notificationData.status === "accepted" || notificationData.status === "declined")
        ) {
          continue;
        }
        
        // Skip other notification types that have been read
        if (
          notificationData.type !== "follow_request" && 
          notificationData.status === "read"
        ) {
          continue;
        }
        
        // Get sender info if not already included
        if (!notificationData.senderName || !notificationData.senderPhoto) {
          try {
            const senderDocRef = doc(db, "users", notificationData.senderId);
            const senderDocSnap = await getDoc(senderDocRef);
            if (senderDocSnap.exists()) {
              const senderData = senderDocSnap.data();
              notificationData.senderName = senderData.displayName;
              notificationData.senderPhoto = senderData.photoURL;
            }
          } catch (error) {
            console.error("Error fetching sender info:", error);
          }
        }
        
        // Get post thumbnail for like and comment notifications
        if (
          notificationData.postId && 
          (notificationData.type === "like" || notificationData.type === "comment")
        ) {
          try {
            const postDocRef = doc(db, "posts", notificationData.postId);
            const postDocSnap = await getDoc(postDocRef);
            if (postDocSnap.exists()) {
              notificationData.postImage = postDocSnap.data().imageUrl;
            }
          } catch (error) {
            console.error("Error fetching post thumbnail:", error);
          }
        }
        
        notificationsData.push(notificationData);
      }
      
      setNotifications(notificationsData);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      Alert.alert("Error", "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };
  
  // Handle accepting a follow request notification
  const handleAccept = async (notification) => {
    setProcessingNotification(notification.id);
    try {
      // 1. Update the current user's followers list
      await updateDoc(doc(db, "users", currentUser.uid), {
        followers: arrayUnion(notification.senderId),
        pendingFollowRequests: arrayRemove(notification.senderId) // Remove from pending requests
      });
      
      // 2. Update the sender's following list
      await updateDoc(doc(db, "users", notification.senderId), {
        following: arrayUnion(currentUser.uid)
      });
      
      // 3. Mark the notification as accepted
      await updateDoc(doc(db, "notifications", notification.id), {
        status: "accepted",
        respondedAt: serverTimestamp()
      });
      
      // 4. Create a new follow notification for the sender
      try {
        await addDoc(collection(db, "notifications"), {
          type: "follow_accepted",
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          senderPhoto: currentUser.photoURL,
          recipientId: notification.senderId,
          status: "unread",
          createdAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Error creating acceptance notification:", error);
        // Non-critical error, don't block the process
      }
      
      // 5. Update local state to remove the notification
      setNotifications(notifications.filter(n => n.id !== notification.id));
      
      // Success message
      Alert.alert("Success", "Follow request accepted");
    } catch (error) {
      console.error("Error accepting follow request:", error);
      Alert.alert("Error", "Failed to accept follow request");
    } finally {
      setProcessingNotification(null);
    }
  };
  
  // Handle declining a follow request notification
  const handleDecline = async (notification) => {
    setProcessingNotification(notification.id);
    try {
      // 1. Remove the sender from the pending follow requests list
      await updateDoc(doc(db, "users", currentUser.uid), {
        pendingFollowRequests: arrayRemove(notification.senderId)
      });
      
      // 2. Mark the notification as declined
      await updateDoc(doc(db, "notifications", notification.id), {
        status: "declined",
        respondedAt: serverTimestamp()
      });
      
      // 3. Update local state to remove the notification
      setNotifications(notifications.filter(n => n.id !== notification.id));
    } catch (error) {
      console.error("Error declining follow request:", error);
      Alert.alert("Error", "Failed to decline follow request");
    } finally {
      setProcessingNotification(null);
    }
  };
  
  // Mark notification as read and remove from the active list
  const handleDismiss = async (notification) => {
    setProcessingNotification(notification.id);
    try {
      // Mark the notification as read
      await updateDoc(doc(db, "notifications", notification.id), {
        status: "read",
        readAt: serverTimestamp()
      });
      
      // Update local state
      setNotifications(notifications.filter(n => n.id !== notification.id));
    } catch (error) {
      console.error("Error dismissing notification:", error);
      Alert.alert("Error", "Failed to dismiss notification");
    } finally {
      setProcessingNotification(null);
    }
  };
  
  // Navigate to a user's profile page
  const navigateToUserProfile = (userId) => {
    if (!userId) return;
    
    if (userId === currentUser.uid) {
      router.replace('/profile');
    } else {
      router.push({
        pathname: '../profileScreens/userProfile',
        params: { userId }
      });
    }
  };
  
  // Navigate to view a specific post
  const navigateToPost = (postId) => {
    if (!postId) return;
    
    router.push({
      pathname: '../profileScreens/viewUserPost',
      params: { postId }
    });
  };
  
  // Render a follow request notification item
  const renderFollowRequest = (item) => {
    const isProcessing = processingNotification === item.id;
    const timeAgo = item.createdAt ? formatTimeAgo(item.createdAt.toDate()) : '';

    return (
      <View className="flex-row mr-2">
        {/* User avatar */}
        <TouchableOpacity onPress={() => navigateToUserProfile(item.senderId)}>
          <Image
            source={item.senderPhoto ? { uri: item.senderPhoto } : require('../../assets/images/profilepic.png')}
            className="w-16 h-16 rounded-full border-2 border-black"
            resizeMode="cover"
          />
        </TouchableOpacity>
        
        {/* Notification content */}
        <View className="flex-1 ml-4 justify-center">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigateToUserProfile(item.senderId)}>
              <Text className="font-montSemiBold text-lg text-black">
                {item.senderName || "User"}
              </Text>
            </TouchableOpacity>
            {timeAgo && (
              <Text className="text-xs text-black/50 ml-2">
                {timeAgo}
              </Text>
            )}
          </View>
          <Text className="font-montRegular text-black/70">
            wants to follow you
          </Text>
        </View>
        
        {/* Accept/Decline buttons */}
        <View className="flex-row items-center">
          {isProcessing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <TouchableOpacity
                onPress={() => handleAccept(item)}
                className="px-3 mr-1 py-2 border-2 rounded-full bg-primary"
              >
                <Text className="text-secondary font-montMedium">Accept</Text>
                
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDecline(item)}
                className="px-1"
              >
                <Image
                  source={icons.deletePrimary}
                  className="w-6 h-6"
                  tintColor={'#000000'}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };
  
  // Render a like notification item
  const renderLikeNotification = (item) => {
    const isProcessing = processingNotification === item.id;
    const timeAgo = item.createdAt ? formatTimeAgo(item.createdAt.toDate()) : '';
    
    return (
      <View className="flex-row mr-2 items-center">
        {/* User avatar */}
        <TouchableOpacity onPress={() => navigateToUserProfile(item.senderId)}>
          <Image
            source={item.senderPhoto ? { uri: item.senderPhoto } : require('../../assets/images/profilepic.png')}
            className="w-16 h-16 rounded-full border-2 border-black"
            resizeMode="cover"
          />
        </TouchableOpacity>
        
        {/* Notification content */}
        <View className="flex-1 ml-4 justify-center">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigateToUserProfile(item.senderId)}>
              <Text className="font-montSemiBold text-lg text-black">
                {item.senderName || "User"}
              </Text>
            </TouchableOpacity>
            {timeAgo && (
              <Text className="text-xs text-black/50 ml-2">
                {timeAgo}
              </Text>
            )}
          </View>
          <Text className="font-montRegular text-black/70">
            liked your post
          </Text>
        </View>
        
        {/* Post thumbnail and dismiss button */}
        <View className="flex-row items-center">
          {isProcessing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              {item.postImage && (
                <TouchableOpacity 
                  onPress={() => navigateToPost(item.postId)}
                  className="mr-3"
                >
                  <Image 
                    source={{ uri: item.postImage }}
                    className="w-16 h-20 rounded-lg border-2 border-black"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleDismiss(item)}
                className="pl-1 py-1"
              >
                <Image
                  source={icons.deletePrimary}
                  className="w-6 h-6"
                  tintColor={'#000000'}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };
  
  // Render a comment notification item
  const renderCommentNotification = (item) => {
    const isProcessing = processingNotification === item.id;
    const timeAgo = item.createdAt ? formatTimeAgo(item.createdAt.toDate()) : '';
    
    return (
      <View className="flex-row mr-2 items-center">
        {/* User avatar */}
        <TouchableOpacity onPress={() => navigateToUserProfile(item.senderId)}>
          <Image
            source={item.senderPhoto ? { uri: item.senderPhoto } : require('../../assets/images/profilepic.png')}
            className="w-16 h-16 rounded-full border-2 border-black"
            resizeMode="cover"
          />
        </TouchableOpacity>
        
        {/* Notification content */}
        <View className="flex-1 ml-4 justify-center">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigateToUserProfile(item.senderId)}>
              <Text className="font-montSemiBold text-lg text-black">
                {item.senderName || "User"}
              </Text>
            </TouchableOpacity>
            {timeAgo && (
              <Text className="text-xs text-black/50 ml-2">
                {timeAgo}
              </Text>
            )}
          </View>
          <Text className="font-montRegular text-black/70">
            commented on your post
            {item.commentPreview ? `: "${item.commentPreview}"` : ''}
          </Text>
        </View>
        
        {/* Post thumbnail and dismiss button */}
        <View className="flex-row items-center">
          {isProcessing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              {item.postImage && (
                <TouchableOpacity 
                  onPress={() => navigateToPost(item.postId)}
                  className="mr-3"
                >
                  <Image 
                    source={{ uri: item.postImage }}
                    className="w-16 h-20 rounded-lg border-2 border-black"
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleDismiss(item)}
                className="pl-1 py-1"
              >
                <Image
                  source={icons.deletePrimary}
                  className="w-6 h-6"
                  tintColor={'#000000'}
                />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };
  
  // Format timestamp to relative time (e.g. "2h ago")
  const formatTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else if (diffInSeconds < 604800) { // 7 days
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    } else {
      // Format date for older notifications
      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
    }
  };

  // Render a follow notification item
  const renderFollowNotification = (item) => {
    const isProcessing = processingNotification === item.id;
    const timeAgo = item.createdAt ? formatTimeAgo(item.createdAt.toDate()) : '';
    
    return (
      <View className="flex-row mr-2 items-center">
        {/* User avatar */}
        <TouchableOpacity onPress={() => navigateToUserProfile(item.senderId)}>
          <Image
            source={item.senderPhoto ? { uri: item.senderPhoto } : require('../../assets/images/profilepic.png')}
            className="w-16 h-16 rounded-full border-2 border-black"
            resizeMode="cover"
          />
        </TouchableOpacity>
        
        {/* Notification content */}
        <View className="flex-1 ml-4 justify-center">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigateToUserProfile(item.senderId)}>
              <Text className="font-montSemiBold text-lg text-black">
                {item.senderName || "User"}
              </Text>
            </TouchableOpacity>
            {timeAgo && (
              <Text className="text-xs text-black/50 ml-2">
                {timeAgo}
              </Text>
            )}
          </View>
          <Text className="font-montRegular text-black/70">
            started following you
          </Text>
        </View>
        
        {/* Dismiss button */}
        <View className="flex-row items-center">
          {isProcessing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <TouchableOpacity
              onPress={() => handleDismiss(item)}
              className="pl-1 py-1"
            >
              <Image
                source={icons.deletePrimary}
                className="w-6 h-6"
                tintColor={'#000000'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render a follow request accepted notification item
  const renderFollowAcceptedNotification = (item) => {
    const isProcessing = processingNotification === item.id;
    const timeAgo = item.createdAt ? formatTimeAgo(item.createdAt.toDate()) : '';
    
    return (
      <View className="flex-row mr-2 items-center">
        {/* User avatar */}
        <TouchableOpacity onPress={() => navigateToUserProfile(item.senderId)}>
          <Image
            source={item.senderPhoto ? { uri: item.senderPhoto } : require('../../assets/images/profilepic.png')}
            className="w-16 h-16 rounded-full border-2 border-black"
            resizeMode="cover"
          />
        </TouchableOpacity>
        
        {/* Notification content */}
        <View className="flex-1 ml-4 justify-center">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => navigateToUserProfile(item.senderId)}>
              <Text className="font-montSemiBold text-lg text-black">
                {item.senderName || "User"}
              </Text>
            </TouchableOpacity>
            {timeAgo && (
              <Text className="text-xs text-black/50 ml-2">
                {timeAgo}
              </Text>
            )}
          </View>
          <Text className="font-montRegular text-black/70">
            accepted your follow request
          </Text>
        </View>
        
        {/* Dismiss button */}
        <View className="flex-row items-center">
          {isProcessing ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <TouchableOpacity
              onPress={() => handleDismiss(item)}
              className="pl-1 py-1"
            >
              <Image
                source={icons.deletePrimary}
                className="w-6 h-6"
                tintColor={'#000000'}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };
  
  // Render a notification based on its type
  const renderNotification = ({ item }) => {
    return (
      <View className="mx-4 my-2 rounded-3xl overflow-hidden border-2 p-4 bg-white/30">
        {item.type === "follow_request" && renderFollowRequest(item)}
        {item.type === "follow" && renderFollowNotification(item)}
        {item.type === "follow_accepted" && renderFollowAcceptedNotification(item)}
        {item.type === "like" && renderLikeNotification(item)}
        {item.type === "comment" && renderCommentNotification(item)}
        
        {/* Add a fallback for unknown notification types */}
        {!["follow_request", "follow", "follow_accepted", "like", "comment"].includes(item.type) && (
          <View className="flex-row mr-2 items-center">
            <Text className="font-montRegular text-black/70">
              New notification: {item.type}
            </Text>
            <TouchableOpacity
              onPress={() => handleDismiss(item)}
              className="ml-auto"
            >
              <Image
                source={icons.deletePrimary}
                className="w-6 h-6"
                tintColor={'#000000'}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // Render empty state when no notifications are present
  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-4">
      <Image
        source={icons.notifications} // Use your notification icon or another suitable icon
        className="w-20 h-20 opacity-50 mb-4"
        resizeMode="contain"
      />
      <Text className="text-xl font-montSemiBold text-black/70 text-center mb-2">
        No notifications yet
      </Text>
      <Text className="text-sm font-montRegular text-black/50 text-center">
        You'll see notifications when people follow you, like or comment on your posts.
      </Text>
    </View>
  );

  // Main component render with header and notifications list
  return (
    <SafeAreaView className="flex-1 bg-primary">
      {/* Header with back button */}
      <View className="flex-row items-center pt-4 px-4">
        <TouchableOpacity 
          onPress={goBack}
        >
          <Image
            source={icons.backArrow}
            className="w-14 h-14"
            resizeMode="contain"
          />
        </TouchableOpacity>
        
        <Text className="flex-1 text-6xl mt-4 text-center font-bregular">
          Notifications
        </Text>
      </View>
      
      {/* Content area with loading, empty, and notification states */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
          <Text className="text-black/70 font-montRegular mt-4">
            Loading notifications...
          </Text>
        </View>
      ) : notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 16, flexGrow: 1 }}
          ListEmptyComponent={renderEmptyState}
          refreshing={loading}
          onRefresh={fetchNotifications}
        />
      ) : (
        renderEmptyState()
      )}
    </SafeAreaView>
  );
};

export default Notifications;