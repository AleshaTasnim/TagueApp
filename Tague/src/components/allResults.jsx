/**
 * AllResults.jsx - Combined search results component
 * 
 * This component displays combined search results from multiple categories (users, posts, tags, styles)
 * in a single view. It provides previews of each result type with options to view full category results.
 * The component handles various interactions including user following, post viewing, and tag expansion.
 * 
 * Features:
 * - Displays sectioned results for users, posts, tags, and styles
 * - Handles user follow/unfollow functionality
 * - Filters posts based on user privacy settings
 * - Provides navigation to detailed results views
 * - Handles empty states for search results
 */

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { OptimisedImage } from '../../components/optimisedImage';
import { images } from '../../constants/images';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import TagCard from './tagCard';
import StyleCard from './styleCard';
import followService from '../../backend/followService';

const AllResults = ({ 
  users, 
  posts, 
  tags, 
  styles, 
  currentQuery, 
  expandedTagInfo, 
  toggleTagExpansion,
  handleFilterChange,
  setSearchInputQuery
}) => {
  const scrollViewRef = useRef(null);
  const currentUser = auth.currentUser;
  
  // State for user follow functionality
  const [userStatuses, setUserStatuses] = useState({});
  const [processingFollow, setProcessingFollow] = useState(null);
  const [visiblePosts, setVisiblePosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  
  // Filter out the current user from users
  const filteredUsers = users.filter(user => user.id !== currentUser?.uid);
  
  // Filter out posts from the current user
  const filteredPosts = currentUser 
    ? posts.filter(post => post.userId !== currentUser.uid)
    : posts;
  
  // Check if we have results in each section
  const hasUsers = filteredUsers.length > 0;
  const hasPosts = visiblePosts.length > 0 && !loadingPosts;
  const hasTags = tags.length > 0;
  const hasStyles = styles.length > 0;

  const [expandedStyleInfo, setExpandedStyleInfo] = useState(null);
  
  // Get screen dimensions for responsive layouts
  const screenWidth = Dimensions.get('window').width;
  const postsItemWidth = (screenWidth - 32) / 3; // 32 accounts for padding and gaps
  
  // Fetch all follow statuses using the centralised service
  useEffect(() => {
    if (currentUser && filteredUsers.length > 0) {
      fetchFollowStatuses();
    }
  }, [currentUser, JSON.stringify(filteredUsers.map(user => user.id))]);

  // Filter posts based on privacy settings
  useEffect(() => {
    if (filteredPosts.length > 0) {
      filterPostsForPrivacy();
    } else {
      setVisiblePosts([]);
      setLoadingPosts(false);
    }
  }, [JSON.stringify(filteredPosts.map(post => post.id))]);
  
  // Fetch follow statuses for all users
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
  
  // Filter posts based on privacy settings
  const filterPostsForPrivacy = async () => {
    if (!filteredPosts || filteredPosts.length === 0) {
      setVisiblePosts([]);
      setLoadingPosts(false);
      return;
    }
    
    try {
      // Create a cache for user privacy settings to minimise database calls
      const privacyCache = new Map();
      
      // Filter posts
      const filteredPostsPrivacy = [];
      
      for (const post of filteredPosts) {
        // Check if we have already cached this user's privacy settings
        let isUserPrivate = false;
        if (privacyCache.has(post.userId)) {
          isUserPrivate = privacyCache.get(post.userId);
        } else {
          // Fetch user data to check privacy setting
          const postUserDoc = await getDoc(doc(db, "users", post.userId));
          if (postUserDoc.exists()) {
            isUserPrivate = postUserDoc.data().isPrivate || false;
            // Cache the result
            privacyCache.set(post.userId, isUserPrivate);
          }
        }
        
        // Only include post if account is not private
        if (!isUserPrivate) {
          filteredPostsPrivacy.push(post);
        }
      }
      
      setVisiblePosts(filteredPostsPrivacy);
    } catch (error) {
      console.error("Error filtering posts for privacy:", error);
      // Fall back to showing only non-current-user posts
      setVisiblePosts([]);
    } finally {
      setLoadingPosts(false);
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

  // Toggle expanded view for style information
  const toggleStyleExpansion = (styleInfo) => {
    setExpandedStyleInfo(styleInfo);
  };
  
  // Function to truncate text that's too long
  const truncateText = (text, maxLength) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
  };
  
  // Render the combined search results view
  return (
    <ScrollView className="flex-1" ref={scrollViewRef}>
      {/* Handle empty state for all sections */}
      {!hasUsers && !hasPosts && !hasTags && !hasStyles && !loadingPosts ? (
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-lg font-montSemiBold text-black/70 text-center">
            No results found matching "{currentQuery}"
          </Text>
          <Text className="text-base font-montRegular text-black/60 text-center mt-2">
            Try a different search term or check your spelling
          </Text>
        </View>
      ) : (
        <>
          {/* Users Section */}
          {hasUsers && (
            <View>
              <View className="flex-row justify-between items-center px-4 pt-4 pb-2">
                <Text className="text-lg font-montSemiBold text-black">Users</Text>
                {filteredUsers.length > 3 && (
                  <TouchableOpacity
                    onPress={() => handleFilterChange('users')}
                  >
                    <Text className="font-montMedium text-black/70">See all</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Display limited number of users in the "all" view */}
              {filteredUsers.slice(0, 3).map(user => {
                const followersCount = user.followers ? user.followers.length : 0;
                const followingCount = user.following ? user.following.length : 0;
                const isProcessingThisUser = processingFollow === user.id;
                
                // Get follow status for this user
                const status = userStatuses[user.id] || {
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
                    key={user.id}
                    onPress={() => {
                      router.push({
                        pathname: '../profileScreens/userProfile',
                        params: { userId: user.id }
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
                            source={user.photoURL ? { uri: user.photoURL } : images.profilePic}
                            className="w-16 h-16 rounded-full border-2 border-white"
                            resizeMode="cover"
                          />
                        </View>
                        
                        {/* User Info */}
                        <View className="flex-1">
                          <Text className="text-lg font-bregular text-black">
                            {user.displayName || 'No Name'}
                          </Text>
                          <Text className="text-sm font-montRegular text-black/70">
                            @{user.username || user.email?.split('@')[0] || 'username'}
                          </Text>
                          
                          {/* Follower Stats */}
                          <View className="flex-row mt-1">
                            <Text className="text-xs font-montMedium text-black/80">
                              <Text className="font-montSemiBold">{followersCount}</Text> 
                              &nbsp;follower{followersCount !== 1 ? 's' : ''}
                            </Text>
                            <Text className="text-xs font-montMedium text-black/80 mx-2">•</Text>
                            <Text className="text-xs font-montMedium text-black/80">
                              <Text className="font-montSemiBold">{followingCount}</Text> following
                            </Text>
                          </View>
                        </View>
                        
                        {/* Follow/Unfollow/Requested Button */}
                        <TouchableOpacity
                          onPress={() => handleFollowAction(user.id)}
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
              })}
            </View>
          )}
          
          {/* Posts Section */}
          {loadingPosts ? (
            <View className="p-6 items-center justify-center">
              <ActivityIndicator size="large" color="#000" />
              <Text className="mt-4 text-base font-montRegular text-black/70">
                Loading posts...
              </Text>
            </View>
          ) : (
            hasPosts && (
              <View className="mb-4">
                <View className="flex-row justify-between items-center px-4 pt-4 pb-2">
                  <Text className="text-lg font-montSemiBold text-black">Posts</Text>
                  {visiblePosts.length > 6 && (
                    <TouchableOpacity
                      onPress={() => handleFilterChange('posts')}
                    >
                      <Text className="font-montMedium text-black/70">See all</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Grid layout for posts in "all" view */}
                <View className="flex-row flex-wrap px-2">
                  {visiblePosts.slice(0, 6).map(post => (
                    <TouchableOpacity
                      key={post.id}
                      className="overflow-hidden rounded-lg border-2 border-black mb-2"
                      style={{ width: postsItemWidth, height: postsItemWidth * 4/3, margin: 2 }}
                      activeOpacity={0.8}
                      onPress={() => {
                        router.push({
                          pathname: '../profileScreens/viewUserPost',
                          params: { postId: post.id }
                        });
                      }}
                    >
                      <OptimisedImage
                        source={{ uri: post.imageUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                        lowQualityFirst={true}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )
          )}
          
          {/* Tags Section using TagCards */}
          {hasTags && (
            <View className="mb-4">
              <View className="flex-row justify-between items-center px-4 pt-4 pb-2">
                <Text className="text-lg font-montSemiBold text-black">Tags</Text>
                {tags.length > 2 && (
                  <TouchableOpacity
                    onPress={() => handleFilterChange('tags')}
                  >
                    <Text className="font-montMedium text-black/70">See all</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Limited number of tags in the "all" view using TagCard component */}
              <View className="px-4">
                {tags.slice(0, 2).map((tagInfo, index) => (
                  <TagCard 
                    key={index}
                    tagInfo={tagInfo}
                    index={index}
                    expandedTagInfo={expandedTagInfo}
                    toggleTagExpansion={toggleTagExpansion}
                  />
                ))}
              </View>
            </View>
          )}
          
          {/* Styles Section - Updated with StyleCard */}
          {hasStyles && (
            <View className="mb-8">
              <View className="flex-row justify-between items-center px-4 pt-4 pb-2">
                <Text className="text-lg font-montSemiBold text-black">Styles</Text>
                {styles.length > 3 && (
                  <TouchableOpacity
                    onPress={() => handleFilterChange('styles')}
                  >
                    <Text className="font-montMedium text-black/70">See all</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {/* Limited number of styles in the "all" view using StyleCard component */}
              <View className="px-4">
                {styles.slice(0, 3).map((styleInfo, index) => (
                  <StyleCard 
                    key={index}
                    styleInfo={styleInfo}
                    index={index}
                    expandedStyleInfo={expandedStyleInfo}
                    toggleStyleExpansion={toggleStyleExpansion}
                  />
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

export default AllResults;