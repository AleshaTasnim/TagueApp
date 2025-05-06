/**
 * FollowersModal.jsx - Followers list and management screen
 * 
 * This component displays a list of users who follow a particular account.
 * It provides functionality to view followers, follow users from the list,
 * and for account owners to remove followers. The component handles different
 * behaviours based on whether the user is viewing their own followers or
 * someone else's.
 * 
 * Features:
 * - Viewing followers with their profile information
 * - Following/unfollowing users from the followers list
 * - Removing followers (only for the account owner)
 * - Support for follow requests to private accounts
 * - Navigation to user profiles
 * - Loading states for all async operations
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator,
  StatusBar,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import { icons } from '../../constants/icons';
import { images } from '../../constants/images';
import { router, useLocalSearchParams } from 'expo-router';
import followService from '../../backend/followService';

const FollowersModal = () => {
  // Get user ID from route parameters
  const { userId } = useLocalSearchParams();
  
  // State variables for followers data and UI interactions
  const [followersList, setFollowersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingFollower, setRemovingFollower] = useState(null);
  const [processingFollow, setProcessingFollow] = useState(null);
  const [followStatuses, setFollowStatuses] = useState({});
  
  // Current authenticated user reference
  const currentUser = auth.currentUser;
  
  // Load followers data when component mounts
  useEffect(() => {
    if (userId) {
      fetchFollowersData();
    }
  }, [userId]);
  
  // Fetch detailed data for each follower including follow relationships
  const fetchFollowersData = async () => {
    setLoading(true);
    try {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        setFollowersList([]);
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      const followersIds = userData.followers || [];
      
      if (followersIds.length === 0) {
        setFollowersList([]);
        setLoading(false);
        return;
      }
      
      // Get data for each follower
      const users = [];
      
      // Create a tracking object for follow statuses
      const statusObj = {};
      
      for (const followerId of followersIds) {
        const followerDocRef = doc(db, "users", followerId);
        const followerDoc = await getDoc(followerDocRef);
        
        if (followerDoc.exists()) {
          users.push({
            id: followerId,
            ...followerDoc.data()
          });
          
          // Skip checking follow status for current user
          if (currentUser && followerId !== currentUser.uid) {
            // Get follow status from service
            const status = await followService.checkFollowStatus(followerId);
            const isFollowingMe = await followService.checkIsFollowingMe(followerId);
            
            statusObj[followerId] = {
              ...status,
              isFollowingMe
            };
          }
        }
      }
      
      setFollowersList(users);
      setFollowStatuses(statusObj);
    } catch (error) {
      console.error("Error fetching followers:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Remove a user from the followers list (account owner only)
  const handleRemoveFollower = async (followerId) => {
    // Only allow removing followers if viewing the current user's followers
    if (userId !== currentUser?.uid) {
      Alert.alert("Not Allowed", "You can only remove followers from your own profile.");
      return;
    }
    
    setRemovingFollower(followerId);
    
    try {
      // Use the follow service to handle the unfollow action
      // But in reverse - the follower is following the current user
      // so we need to make them unfollow the current user
      
      // We'll manually call these functions since our service is oriented around
      // the current user taking action, not the other way around
      const currentUserRef = doc(db, "users", currentUser.uid);
      const followerRef = doc(db, "users", followerId);
      
      // Remove current user from follower's following list
      await updateDoc(followerRef, {
        following: arrayRemove(currentUser.uid)
      });
      
      // Remove follower from current user's followers list
      await updateDoc(currentUserRef, {
        followers: arrayRemove(followerId),
        pendingFollowRequests: arrayRemove(followerId)
      });
      
      // Update local state to remove the follower
      setFollowersList(followersList.filter(follower => follower.id !== followerId));
      
    } catch (error) {
      console.error("Error removing follower:", error);
      Alert.alert("Error", "Failed to remove follower. Please try again.");
    } finally {
      setRemovingFollower(null);
    }
  };
  
  // Handle follow/unfollow actions for users in the followers list
  const handleFollowAction = async (targetUserId) => {
    if (!currentUser) {
      Alert.alert("Error", "You must be logged in to follow users.");
      return;
    }
    
    // Don't allow following yourself
    if (targetUserId === currentUser.uid) {
      return;
    }
    
    setProcessingFollow(targetUserId);
    
    try {
      const status = followStatuses[targetUserId] || {
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
        setFollowStatuses(prev => ({
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
      setFollowStatuses(prev => ({
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
      const status = followStatuses[targetUserId];
      if (status && !status.hasRequestedFollow) {
        setFollowStatuses(prev => ({
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
  
  // Navigate to a user's profile page
  const handleViewProfile = (profileUserId) => {
    // Navigate to the user profile within the tabs structure
    if (profileUserId === currentUser?.uid) {
      router.replace('/profile');
    } else {
      router.push({
        pathname: '../profileScreens/userProfile',
        params: { userId: profileUserId }
      });
    }
  };
  
  // Navigate back to previous screen
  const goBack = () => {
    router.back();
  };
  
  // Render individual user item in the followers list
  const renderUserItem = ({ item }) => {
    const isRemoving = removingFollower === item.id;
    const isProcessingFollow = processingFollow === item.id;
    const isOwnFollowers = userId === currentUser?.uid;
    const isCurrentUser = item.id === currentUser?.uid;
    
    // Get follow status for this user
    const status = followStatuses[item.id] || {
      isFollowing: false,
      hasRequestedFollow: false,
      isFollowingMe: false
    };
    
    // Get button display info
    const buttonInfo = followService.getFollowButtonText(
      status.isFollowing,
      status.hasRequestedFollow,
      status.isFollowingMe
    );
    
    return (
      <TouchableOpacity 
        onPress={() => handleViewProfile(item.id)}
        className="flex-row items-center p-4 m-2"
      >
        <LinearGradient
          colors={['#F3E3D3', '#E0C9B2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 8 }}
        /> 
        <Image
          source={item.photoURL ? { uri: item.photoURL } : images.profilePic}
          className="w-16 h-16 rounded-full mr-4 border border-white"
          resizeMode="cover"
        />
        <View className="flex-1">
          <Text className="text-2xl font-bregular text-black">
            {item.displayName || 'No Name'}
          </Text>
          <Text className="text-sm font-montRegular text-black/70">
            @{item.username || item.email?.split('@')[0] || 'username'}
          </Text>
        </View>
        
        {isOwnFollowers ? (
          // Show Remove button if viewing own followers
          <TouchableOpacity
            onPress={() => handleRemoveFollower(item.id)}
            disabled={isRemoving}
            className="py-2 px-4 rounded-full bg-primary border-black border items-center justify-center"
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Text className="font-montMedium text-sm text-black">
                Remove
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          // Show Follow/Following button if viewing someone else's followers
          !isCurrentUser && (
            <TouchableOpacity
              onPress={() => handleFollowAction(item.id)}
              disabled={isProcessingFollow}
              className={`py-2 px-4 rounded-full items-center justify-center ${buttonInfo.bgColor}`}
            >
              {isProcessingFollow ? (
                <ActivityIndicator size="small" color={status.isFollowing ? "#000000" : "#F3E3D3"} />
              ) : (
                <Text className={`font-montMedium text-sm ${buttonInfo.textColor}`}>
                  {buttonInfo.text}
                </Text>
              )}
            </TouchableOpacity>
          )
        )}
      </TouchableOpacity>
    );
  };
  
  // Main component render with header and followers list
  return (
    <SafeAreaView className="flex-1 bg-primary" edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header with back button */}
      <View className="h-16 justify-center">
        <TouchableOpacity 
          onPress={goBack}
          className="absolute top-3 left-3 z-50 items-center justify-center"
        >
          <Image
            source={icons.backArrow}
            className="w-12 h-12"
            resizeMode="contain"
          />
        </TouchableOpacity>
        
        <View className="items-center border-b border-black/10">
          <Text className="text-4xl pt-4 font-bregular text-black">Followers</Text>
        </View>
      </View>
      
      {/* Followers list with loading and empty states */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
          <Text className="mt-4 text-black/70 font-montRegular">Loading followers...</Text>
        </View>
      ) : followersList.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-xl font-montMedium text-black/70 text-center">No followers yet</Text>
          <Text className="text-sm font-montRegular text-black/50 mt-2 text-center px-6">
            When people follow you, they'll appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={followersList}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default FollowersModal;