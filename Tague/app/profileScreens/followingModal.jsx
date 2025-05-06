/**
 * followingModal.jsx - Following list and managmement screen
 * 
 * This component displays and manages the accounts and styles a user is following.
 * It provides tabbed navigation between users and styles, with appropriate actions
 * for each context. The component handles different behaviours based on whether the
 * user is viewing their own following list or someone else's.
 * 
 * Features:
 * - Tabbed interface for Users and Styles
 * - Unfollow capabilities for accounts and styles (own profile only)
 * - Follow/unfollow actions for other users' accounts
 * - Automatic cleanup of bookmarks when unfollowing private accounts
 * - Profile navigation for followed users
 * - Style search navigation for followed styles
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
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion, collection, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import { icons } from '../../constants/icons';
import { images } from '../../constants/images';
import { router, useLocalSearchParams } from 'expo-router';
import followService from '../../backend/followService';

const FollowingModal = () => {
  // Get user ID from route parameters
  const { userId } = useLocalSearchParams();
  
  // State variables for following data and UI interactions
  const [followingList, setFollowingList] = useState([]);
  const [followedStyles, setFollowedStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stylesLoading, setStylesLoading] = useState(true);
  const [unfollow, setUnfollow] = useState(null);
  const [unfollowStyle, setUnfollowStyle] = useState(null);
  const [processingFollow, setProcessingFollow] = useState(null);
  const [followStatuses, setFollowStatuses] = useState({});
  const [activeTab, setActiveTab] = useState('Users');
  
  // Current authenticated user reference
  const currentUser = auth.currentUser;
  
  // Flag to determine if the current user is viewing their own following
  const isViewingOwnFollowing = currentUser && userId === currentUser.uid;

  // Load appropriate data when tab changes or component mounts
  useEffect(() => {
    if (userId) {
      if (activeTab === 'Users') {
        fetchFollowingData();
      } else if (activeTab === 'Styles') {
        fetchFollowedStyles();
      }
    }
  }, [userId, activeTab]);
  
  // Fetch data for each user that the current profile is following
  const fetchFollowingData = async () => {
    setLoading(true);
    try {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        setFollowingList([]);
        setLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      const followingIds = userData.following || [];
      
      if (followingIds.length === 0) {
        setFollowingList([]);
        setLoading(false);
        return;
      }
      
      // Get data for each following user
      const users = [];
      
      // Create a tracking object for follow statuses
      const statusObj = {};
      
      for (const followingId of followingIds) {
        const followingDocRef = doc(db, "users", followingId);
        const followingDoc = await getDoc(followingDocRef);
        
        if (followingDoc.exists()) {
          users.push({
            id: followingId,
            ...followingDoc.data()
          });
          
          // Skip checking follow status for current user
          if (currentUser && followingId !== currentUser.uid) {
            // Get follow status from service
            const status = await followService.checkFollowStatus(followingId);
            const isFollowingMe = await followService.checkIsFollowingMe(followingId);
            
            statusObj[followingId] = {
              ...status,
              isFollowingMe
            };
          }
        }
      }
      
      setFollowingList(users);
      setFollowStatuses(statusObj);
      
    } catch (error) {
      console.error("Error fetching following:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch styles that the current profile is following
  const fetchFollowedStyles = async () => {
    setStylesLoading(true);
    try {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        setFollowedStyles([]);
        setStylesLoading(false);
        return;
      }
      
      const userData = userDoc.data();
      const followedStylesIds = userData.followedStyles || [];
      
      if (followedStylesIds.length === 0) {
        setFollowedStyles([]);
        setStylesLoading(false);
        return;
      }
      
      // Get data for each followed style
      const styles = [];
      
      for (const styleId of followedStylesIds) {
        // Try to get the style data from the styles collection
        const styleDocRef = doc(db, "styles", styleId);
        const styleDoc = await getDoc(styleDocRef);
        
        if (styleDoc.exists()) {
          // Use the document data if it exists
          styles.push({
            style: styleId,
            ...styleDoc.data(),
            followersCount: (styleDoc.data().followers || []).length
          });
        } else {
          // Create a basic object if the style document doesn't exist
          styles.push({
            style: styleId,
            followers: [],
            followersCount: 0
          });
        }
      }
      
      setFollowedStyles(styles);
      console.log("Styles loaded:", styles.length);
      
    } catch (error) {
      console.error("Error fetching followed styles:", error);
    } finally {
      setStylesLoading(false);
    }
  };

  // Clean up bookmarks and boards after unfollowing a private account
  const cleanupBookmarksAfterUnfollow = async (unfollowedUserId) => {
    if (!auth.currentUser) return;
    
    try {
      // 1. Get all bookmarks
      const bookmarksRef = collection(db, "users", auth.currentUser.uid, "bookmarkedPosts");
      const bookmarksSnapshot = await getDocs(bookmarksRef);
      
      // Check each bookmark
      const bookmarksToRemove = [];
      const postPromises = [];
      
      for (const bookmarkDoc of bookmarksSnapshot.docs) {
        const bookmarkData = bookmarkDoc.data();
        
        // Skip if bookmark doesn't have userId directly
        if (!bookmarkData.userId) {
          // Try to get the post to check its userId
          if (bookmarkData.postId) {
            const postPromise = getDoc(doc(db, "posts", bookmarkData.postId))
              .then(postDoc => {
                if (postDoc.exists() && postDoc.data().userId === unfollowedUserId) {
                  bookmarksToRemove.push(bookmarkDoc.id);
                }
              })
              .catch(err => console.error("Error checking post:", err));
            
            postPromises.push(postPromise);
          }
          continue;
        }
        
        // If bookmark has userId and it matches unfollowed user, mark for removal
        if (bookmarkData.userId === unfollowedUserId) {
          bookmarksToRemove.push(bookmarkDoc.id);
        }
      }
      
      // Wait for all post checks to complete
      await Promise.all(postPromises);
      
      // Remove all marked bookmarks
      const deletePromises = bookmarksToRemove.map(bookmarkId => {
        return deleteDoc(doc(db, "users", auth.currentUser.uid, "bookmarkedPosts", bookmarkId));
      });
      
      await Promise.all(deletePromises);
      console.log(`Removed ${deletePromises.length} bookmarks from unfollowed private user ${unfollowedUserId}`);
      
      // 2. Clean up inspiration boards
      const boardsRef = collection(db, "users", auth.currentUser.uid, "inspoBoards");
      const boardsSnapshot = await getDocs(boardsRef);
      
      // Update each board to remove posts from the unfollowed user
      for (const boardDoc of boardsSnapshot.docs) {
        const boardData = boardDoc.data();
        const boardPosts = boardData.posts || [];
        
        if (boardPosts.length === 0) continue;
        
        // Check each post in the board
        const postsToKeep = [];
        const postsToRemove = [];
        
        for (const postId of boardPosts) {
          try {
            const postDoc = await getDoc(doc(db, "posts", postId));
            
            if (!postDoc.exists()) continue;
            
            const postData = postDoc.data();
            
            // If post is from unfollowed user, mark for removal
            if (postData.userId === unfollowedUserId) {
              postsToRemove.push(postId);
            } else {
              postsToKeep.push(postId);
            }
          } catch (err) {
            console.error(`Error checking board post ${postId}:`, err);
            postsToKeep.push(postId);
          }
        }
        
        // Update board if posts were removed
        if (postsToRemove.length > 0) {
          const boardRef = doc(db, "users", auth.currentUser.uid, "inspoBoards", boardDoc.id);
          await updateDoc(boardRef, {
            posts: postsToKeep,
            postCount: postsToKeep.length,
            updatedAt: serverTimestamp()
          });
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error cleaning up after unfollow:", error);
      return false;
    }
  };

  // Unfollow a user and clean up related data
  const handleUnfollow = async (targetUserId) => {
    // Only allow unfollowing if viewing own following
    if (userId !== currentUser?.uid) {
      Alert.alert("Not Allowed", "You can only unfollow users from your own profile.");
      return;
    }
    
    setUnfollow(targetUserId);
    
    try {
      // Use the follow service to handle the unfollow action
      await followService.handleFollowAction(targetUserId, true, false);
      
      // Check if unfollowed user is private
      const targetUserDoc = await getDoc(doc(db, "users", targetUserId));
      
      if (targetUserDoc.exists() && targetUserDoc.data().isPrivate === true) {
        // Clean up bookmarks and boards if user is private
        await cleanupBookmarksAfterUnfollow(targetUserId);
      }
      
      // Update local state to remove the user from following list
      setFollowingList(followingList.filter(user => user.id !== targetUserId));
      
      // UI updates
      Alert.alert("Success", "User unfollowed successfully");
    } catch (error) {
      console.error("Error unfollowing user:", error);
      Alert.alert("Error", "Failed to unfollow user");
    } finally {
      setUnfollow(null);
    }
  };
  
  // Unfollow a style from the user's followed styles
  const handleUnfollowStyle = async (styleId) => {
    // Only allow unfollow if viewing the current user's following
    if (!isViewingOwnFollowing) {
      Alert.alert("Not Allowed", "You can only unfollow styles from your own profile.");
      return;
    }
    
    setUnfollowStyle(styleId);
    
    try {
      // Remove the style from the current user's followedStyles list
      const currentUserDocRef = doc(db, "users", currentUser.uid);
      await updateDoc(currentUserDocRef, {
        followedStyles: arrayRemove(styleId)
      });
      
      // Remove the current user from the style's followers list
      const styleDocRef = doc(db, "styles", styleId);
      const styleDoc = await getDoc(styleDocRef);
      
      if (styleDoc.exists()) {
        await updateDoc(styleDocRef, {
          followers: arrayRemove(currentUser.uid)
        });
      }
      
      // Update local state to remove the style from followedStyles list
      setFollowedStyles(followedStyles.filter(style => style.style !== styleId));
      
    } catch (error) {
      console.error("Error unfollowing style:", error);
      Alert.alert("Error", "Failed to unfollow style. Please try again.");
    } finally {
      setUnfollowStyle(null);
    }
  };
  
  // Handle follow/unfollow action for a user in the list
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
      // Reset navigation to the profile tab to avoid stacking screens
      router.replace('/profile');
    } else {
      router.push({
        pathname: '../profileScreens/userProfile',
        params: { userId: profileUserId }
      });
    }
  };
  
  // Navigate to style search results
  const handleViewStyle = (styleName) => {
    // Navigate to search results with the style name as query and filter set to styles
    router.push({
      pathname: '/search/[query]',
      params: { 
        query: encodeURIComponent(styleName), 
        filter: 'styles' 
      }
    });
  };
  
  // Navigate back to previous screen
  const goBack = () => {
    router.back();
  };
  
  // Render a user item in the following list
  const renderUserItem = ({ item }) => {
    const isUnfollowing = unfollow === item.id;
    const isProcessingFollow = processingFollow === item.id;
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

        {/* Action Button - changes based on context */}
        {!isCurrentUser && (
          <>
            {isViewingOwnFollowing ? (
              // Show Unfollow button if viewing own following
              <TouchableOpacity
                onPress={() => handleUnfollow(item.id)}
                disabled={isUnfollowing}
                className="py-2 px-4 rounded-full bg-primary border-black border items-center justify-center"
              >
                {isUnfollowing ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text className="font-montMedium text-sm text-black">
                    Unfollow
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              // Show Follow/Following button if viewing someone else's following
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
            )}
          </>
        )}
      </TouchableOpacity>
    );
  };
  
  // Render a style item in the styles list
  const renderStyleItem = ({ item }) => {
    const isUnfollowing = unfollowStyle === item.style;
    
    return (
      <TouchableOpacity 
        onPress={() => handleViewStyle(item.style)}
        className="flex-row items-center p-4 m-2"
      >
        <LinearGradient
          colors={['#F3E3D3', '#E0C9B2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 8 }}
        /> 
        {/* Hashtag Icon */}
        <View className="mr-4 w-16 h-16 rounded-full bg-white/50 items-center justify-center border border-white">
          <Image
            source={icons.hashtag}
            className="w-8 h-8"
            resizeMode="contain"
            tintColor="#000000"
          />
        </View>
        <View className="flex-1">
          <Text className="text-2xl font-bregular text-black">
            {item.style}
          </Text>
        </View>

        {/* Only show unfollow button for own profile */}
        {isViewingOwnFollowing && (
          <TouchableOpacity
            onPress={() => handleUnfollowStyle(item.style)}
            disabled={isUnfollowing}
            className="py-2 px-4 rounded-full bg-primary border-black border items-center justify-center"
          >
            {isUnfollowing ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Text className="font-montMedium text-sm text-black">
                Unfollow
              </Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };
  
  // Users tab content component
  const UsersTab = () => (
    <>
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
          <Text className="mt-4 text-black/70 font-montRegular">Loading following...</Text>
        </View>
      ) : followingList.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-xl font-montMedium text-black/70 text-center">Not following anyone</Text>
          <Text className="text-sm font-montRegular text-black/50 mt-2 text-center px-6">
            When you follow people, they'll appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={followingList}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </>
  );
  
  // Styles tab content component
  const StylesTab = () => (
    <>
      {stylesLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
          <Text className="mt-4 text-black/70 font-montRegular">Loading styles...</Text>
        </View>
      ) : followedStyles.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Text className="text-xl font-montMedium text-black/70 text-center">Not following any styles</Text>
          <Text className="text-sm font-montRegular text-black/50 mt-2 text-center px-6">
            When you follow styles, they'll appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={followedStyles}
          keyExtractor={(item, index) => `style-${item.style}-${index}`}
          renderItem={renderStyleItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </>
  );
  
  // Main component render with tabs and content
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
          <Text className="text-4xl pt-4 font-bregular text-black">Following</Text>
        </View>
      </View>
      
      {/* Tab Navigation */}
      <View className="flex-row border-b border-black/10">
        <TouchableOpacity 
          onPress={() => setActiveTab('Users')}
          className={`flex-1 py-3 items-center justify-center ${activeTab === 'Users' ? 'border-b-2 border-black' : ''}`}
        >
          <Text className={`text-lg font-montMedium ${activeTab === 'Users' ? 'text-black' : 'text-black/50'}`}>
            Users
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => setActiveTab('Styles')}
          className={`flex-1 py-3 items-center justify-center ${activeTab === 'Styles' ? 'border-b-2 border-black' : ''}`}
        >
          <Text className={`text-lg font-montMedium ${activeTab === 'Styles' ? 'text-black' : 'text-black/50'}`}>
            Styles
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Tab Content */}
      <View className="flex-1">
        {activeTab === 'Users' ? <UsersTab /> : <StylesTab />}
      </View>
    </SafeAreaView>
  );
};

export default FollowingModal;