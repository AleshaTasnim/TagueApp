/**
 * PostResults.jsx - Post search results display component
 * 
 * This component displays search results for posts with privacy filtering.
 * It shows posts in a responsive grid layout while respecting user privacy settings.
 * Features include:
 * - Automatic filtering of posts from private accounts
 * - Responsive grid layout based on screen dimensions
 * - Loading and empty state handling
 * - Direct navigation to post details
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { OptimisedImage } from '../../components/optimisedImage';
import { auth, db } from '../../backend/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const PostResults = ({ posts, currentQuery }) => {
  // Get screen dimensions for responsive layouts
  const screenWidth = Dimensions.get('window').width;
  const postsItemWidth = (screenWidth - 32) / 3; // 32 accounts for padding and gaps
  
  // Get current user
  const currentUser = auth.currentUser;
  const [visiblePosts, setVisiblePosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter for privacy settings
  useEffect(() => {
    filterPostsForPrivacy();
  }, [posts]);
  
  // Filter posts based on privacy settings
  const filterPostsForPrivacy = async () => {
    if (!posts || posts.length === 0) {
      setVisiblePosts([]);
      setLoading(false);
      return;
    }
    
    try {
      // Create a cache for user privacy settings to minimise database calls
      const privacyCache = new Map();
      
      // Filter posts
      const filteredPosts = [];
      
      for (const post of posts) {
        // Skip current user's posts
        if (post.userId === currentUser?.uid) {
          continue;
        }
        
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
          filteredPosts.push(post);
        }
      }
      
      setVisiblePosts(filteredPosts);
    } catch (error) {
      console.error("Error filtering posts for privacy:", error);
      // Fall back to showing only non-current-user posts
      setVisiblePosts(posts.filter(post => post.userId !== currentUser?.uid));
    } finally {
      setLoading(false);
    }
  };
  
  // Handle loading state
  if (loading) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <ActivityIndicator size="large" color="#000" />
        <Text className="mt-4 text-lg font-montRegular text-black/70">
          Loading posts...
        </Text>
      </View>
    );
  }
  
  // Handle empty state
  if (visiblePosts.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-lg font-montSemiBold text-black/70 text-center">
          No posts found matching "{currentQuery}"
        </Text>
        <Text className="text-base font-montRegular text-black/60 text-center mt-2">
          Try a different search term or check your spelling
        </Text>
      </View>
    );
  }
  
  // Render a post item in the grid
  const renderPostItem = ({ item }) => {
    return (
      <TouchableOpacity
        className="overflow-hidden rounded-lg border-2 border-black mb-2"
        style={{ width: postsItemWidth, height: postsItemWidth * 4/3, margin: 2 }} // 3:4 aspect ratio
        activeOpacity={0.8}
        onPress={() => {
          router.push({
            pathname: '../profileScreens/viewUserPost',
            params: { postId: item.id }
          });
        }}
      >
        <OptimisedImage
          source={{ uri: item.imageUrl }}
          className="w-full h-full"
          resizeMode="cover"
          lowQualityFirst={true}
        />
      </TouchableOpacity>
    );
  };
  
  // Main component render
  return (
    <FlatList
      key="posts-grid"
      data={visiblePosts}
      renderItem={renderPostItem}
      keyExtractor={(item) => item.id}
      numColumns={3}
      contentContainerStyle={{ padding: 12 }}
    />
  );
};

export default PostResults;