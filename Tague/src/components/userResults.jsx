/**
 * UserResults.jsx - User search results component
 * 
 * This component displays and manages the search results for users in the application.
 * It handles follow/unfollow functionality with support for private accounts, tracking
 * following status for each user, and optimised rendering of user cards. The component
 * filters out the current user from search results and provides clear status indicators
 * for follow relationships.
 * 
 * Features:
 * - Follow/unfollow functionality with appropriate status indicators
 * - Support for follow requests to private accounts
 * - Tracking of mutual following relationships ("Follow Back" option)
 * - User stats display (followers and following counts)
 * - Navigation to user profiles
 * - Empty state handling with helpful messages
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, FlatList, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { images } from '../../constants/images';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import followService from '../../backend/followService';

const UserResults = ({ users, currentQuery }) => {
  const [userStatuses, setUserStatuses] = useState({});
  const [processingFollow, setProcessingFollow] = useState(null);
  const currentUser = auth.currentUser;
  
  // Filter out the current user from results
  const filteredUsers = users.filter(user => user.id !== currentUser?.uid);
  
  // Fetch follow statuses for all users when component mounts
  useEffect(() => {
    if (currentUser && filteredUsers.length > 0) {
      fetchFollowStatuses();
    }
  }, [currentUser, JSON.stringify(filteredUsers.map(user => user.id))]);
  
  // Fetch all follow statuses using the centralised service
  const fetchFollowStatuses = async () => {
    try {
      if (!currentUser) return;
      
      const statusObj = {};
      
      for (const user of filteredUsers) {
        // Get follow status from service
        const followStatus = await followService.checkFollowStatus(user.id);
        // Check if this user is following the current user (for "Follow Back" button)
        const isFollowingMe = await followService.checkIsFollowingMe(user.id);
        
        statusObj[user.id] = {
          ...followStatus,
          isFollowingMe
        };
      }
      
      setUserStatuses(statusObj);
    } catch (error) {
      console.error("Error fetching follow statuses:", error);
    }
  };
  
  // Handle following/unfollowing a user using the centralised service
  const handleFollowAction = async (targetUserId) => {
    if (!currentUser) {
      Alert.alert("Error", "You must be logged in to follow users.");
      return;
    }
    
    setProcessingFollow(targetUserId);
    
    try {
      const status = userStatuses[targetUserId] || {
        isFollowing: false,
        hasRequestedFollow: false
      };
      
      // Check if target user has a private account
      let isPrivateAccount = false;
      try {
        const targetUserDoc = await getDoc(doc(db, "users", targetUserId));
        if (targetUserDoc.exists()) {
          isPrivateAccount = targetUserDoc.data().isPrivate || false;
        }
      } catch (err) {
        console.error("Error checking account privacy:", err);
      }
      
      // For private accounts, pre-emptively update UI to avoid delay
      if (isPrivateAccount && !status.isFollowing && !status.hasRequestedFollow) {
        setUserStatuses(prev => ({
          ...prev,
          [targetUserId]: {
            ...prev[targetUserId],
            hasRequestedFollow: true
          }
        }));
      }
      
      // Use the centralised follow service
      const result = await followService.handleFollowAction(
        targetUserId,
        status.isFollowing,
        status.hasRequestedFollow
      );
      
      // Update local state with the actual result
      setUserStatuses(prev => ({
        ...prev,
        [targetUserId]: {
          ...prev[targetUserId],
          isFollowing: result.isFollowing,
          hasRequestedFollow: result.hasRequestedFollow
        }
      }));
      
      // Show appropriate alert for follow requests
      if (result.action === 'requested') {
        Alert.alert("Follow Request", "Your follow request has been sent.");
      }
      
    } catch (error) {
      console.error("Error updating follow status:", error);
      Alert.alert("Error", "Failed to update follow status. Please try again.");
      
      // Reset request status if there was an error
      const status = userStatuses[targetUserId];
      if (status && !status.hasRequestedFollow) {
        setUserStatuses(prev => ({
          ...prev,
          [targetUserId]: {
            ...prev[targetUserId],
            hasRequestedFollow: false
          }
        }));
      }
    } finally {
      setProcessingFollow(null);
    }
  };
  
  // Render empty state when no users match the search
  if (filteredUsers.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-lg font-montSemiBold text-black/70 text-center">
          No users found matching "{currentQuery}"
        </Text>
        <Text className="text-base font-montRegular text-black/60 text-center mt-2">
          Try a different search term or check your spelling
        </Text>
      </View>
    );
  }
  
  // Render a user item in the results list
  const renderUserItem = ({ item }) => {
    const followersCount = item.followers ? item.followers.length : 0;
    const followingCount = item.following ? item.following.length : 0;
    const isProcessingThisUser = processingFollow === item.id;
    
    // Get follow status for this user
    const status = userStatuses[item.id] || {
      isFollowing: false,
      hasRequestedFollow: false,
      isFollowingMe: false
    };
    
    // Get button display info from service
    const buttonInfo = followService.getFollowButtonText(
      status.isFollowing,
      status.hasRequestedFollow,
      status.isFollowingMe
    );
    
    return (
      <TouchableOpacity
        onPress={() => {
          router.push({
            pathname: '../profileScreens/userProfile',
            params: { userId: item.id }
          });
        }}
        className="mb-3 mx-4 rounded-xl overflow-hidden"
        activeOpacity={0.9}
      >
        {/* Background */}
        <View className="bg-[#F3E3D3] p-4">
          <View className="flex-row items-center">
            {/* User Avatar */}
            <View className="mr-3">
              <Image
                source={item.photoURL ? { uri: item.photoURL } : images.profilePic}
                className="w-16 h-16 rounded-full border-2 border-white"
                resizeMode="cover"
              />
            </View>
            
            {/* User Info */}
            <View className="flex-1">
              <Text className="text-lg font-bregular text-black">
                {item.displayName || 'No Name'}
              </Text>
              <Text className="text-sm font-montRegular text-black/70">
                @{item.username || item.email?.split('@')[0] || 'username'}
              </Text>
              
              {/* Follower Stats */}
              <View className="flex-row mt-1">
                <Text className="text-xs font-montMedium text-black/80">
                  <Text className="font-montSemiBold">{followersCount}</Text> follower{followersCount !== 1 ? 's' : ''}
                </Text>
                <Text className="text-xs font-montMedium text-black/80 mx-2">•</Text>
                <Text className="text-xs font-montMedium text-black/80">
                  <Text className="font-montSemiBold">{followingCount}</Text> following
                </Text>
              </View>
            </View>
            
            {/* Follow/Unfollow/Requested Button */}
            <TouchableOpacity
              onPress={() => handleFollowAction(item.id)}
              disabled={isProcessingThisUser}
              className={`py-2 px-4 rounded-full min-w-[90px] items-center justify-center ${buttonInfo.bgColor}`}
            >
              {isProcessingThisUser ? (
                <ActivityIndicator size="small" color={status.isFollowing ? "#000000" : "#F3E3D3"} />
              ) : (
                <Text className={`font-montMedium text-sm ${buttonInfo.textColor}`}>
                  {buttonInfo.text}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Render the main list of user results
  return (
    <FlatList
      key="users-list"
      data={filteredUsers}
      renderItem={renderUserItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingVertical: 12 }}
    />
  );
};

export default UserResults;