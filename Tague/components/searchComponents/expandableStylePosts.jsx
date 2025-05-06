/**
 * ExpandableStylePosts.jsx - Component for displaying posts with a specific style
 * 
 * This component renders an expandable section that displays all posts containing
 * a specific style. It is designed to be embedded directly in search results
 * rather than displayed as a modal. The component handles fetching posts with
 * the specified style, filtering by privacy settings, and navigating to post details.
 * 
 * Features:
 * - Expandable content that appears when isExpanded prop is true
 * - Fetches posts containing a specific style from Firestore
 * - Filters out posts from private accounts
 * - Responsive grid layout with 2 columns
 * - Loading, error, and empty state handling
 * - Direct navigation to post detail screens
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { router } from 'expo-router';
import { OptimisedImage } from '../optimisedImage';
import { query, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../backend/firebaseConfig';

const ExpandableStylePosts = ({ styleInfo, onClose, isExpanded }) => {
  // STATE MANAGEMENT
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get screen dimensions for responsive layouts
  const screenWidth = Dimensions.get('window').width;
  const postsItemWidth = (screenWidth - 48) / 2; // 2 columns with padding
  
  // LIFECYCLE HOOKS
  useEffect(() => {
    if (isExpanded && styleInfo) {
      fetchPostsWithStyle();
    }
  }, [isExpanded, styleInfo]);
  
  // DATA FETCHING
  /**
   * Fetches all posts containing the specified style and filters by privacy settings
   */
  const fetchPostsWithStyle = async () => {
    if (!styleInfo || !styleInfo.style) {
      setError('No style information provided');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const { style } = styleInfo;
      
      // Fetch posts and filter by style
      const postsRef = collection(db, "posts");
      const q = query(postsRef);
      const querySnapshot = await getDocs(q);
      
      const matchingPosts = [];
      const privacyCache = new Map();
      
      // Filter posts with matching style and check privacy
      for (const docSnapshot of querySnapshot.docs) {
        const postData = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Check if post has styles field
        if (!postData.styles || !Array.isArray(postData.styles)) continue;
        
        // Check if post has matching style (case-insensitive)
        const hasMatchingStyle = postData.styles.some(postStyle => 
          postStyle.toLowerCase() === style.toLowerCase()
        );
        
        if (!hasMatchingStyle) continue;
        
        // Check user privacy settings
        const userId = postData.userId;
        
        // Skip posts from users with private accounts
        let isUserPrivate = false;
        
        if (privacyCache.has(userId)) {
          isUserPrivate = privacyCache.get(userId);
        } else {
          // Fetch user data to check privacy setting
          const userDoc = await getDoc(doc(db, "users", userId));
          if (userDoc.exists()) {
            isUserPrivate = userDoc.data().isPrivate || false;
            privacyCache.set(userId, isUserPrivate);
          }
        }
        
        // Only include posts from public accounts
        if (!isUserPrivate) {
          matchingPosts.push(postData);
        }
      }
      
      // Fetch user info for all matching posts
      const postsWithUserInfo = await Promise.all(
        matchingPosts.map(async (post) => {
          try {
            const userDoc = await getDoc(doc(db, "users", post.userId));
            const userData = userDoc.exists() ? userDoc.data() : {};
            
            return {
              ...post,
              userDisplayName: userData.displayName || "Unknown",
              username: userData.username || "user",
              userPhotoURL: userData.photoURL || null
            };
          } catch (error) {
            console.error("Error fetching user for post:", error);
            return post;
          }
        })
      );
      
      setPosts(postsWithUserInfo);
    } catch (error) {
      console.error("Error fetching posts with style:", error);
      setError('Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // NAVIGATION FUNCTIONS
  /**
   * Navigates to post detail screen directly without closing any modals
   */
  const navigateToPost = (postId) => {
    try {
      router.push({
        pathname: '/profileScreens/viewUserPost',
        params: { postId }
      });
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };
  
  // RENDER FUNCTIONS
  /**
   * Renders a post item in the grid layout
   */
  const renderPostItem = ({ item, index }) => {
    const isEvenIndex = index % 2 === 0;
    
    return (
      <TouchableOpacity
        className={`mb-4 ${isEvenIndex ? 'pr-2' : 'pl-2'}`}
        style={{ width: postsItemWidth }}
        activeOpacity={0.8}
        onPress={() => navigateToPost(item.id)}
      >
        {/* Post Image */}
        <View className="rounded-lg border-2 border-black overflow-hidden">
          <OptimisedImage
            source={{ uri: item.imageUrl }}
            className="w-full"
            style={{ aspectRatio: 3/4 }}
            resizeMode="cover"
            lowQualityFirst={true}
          />
        </View>
      </TouchableOpacity>
    );
  };
  
  /**
   * Renders empty state when no posts are found
   */
  const renderEmptyState = () => {
    if (loading) return null;
    
    return (
      <View className="my-4 justify-center items-center p-4 bg-black/5 rounded-lg">
        <Text className="text-lg font-montSemiBold text-black/70 text-center mb-2">
          No posts found
        </Text>
        <Text className="text-base font-montRegular text-black/60 text-center">
          We couldn't find any public posts with this style.
        </Text>
      </View>
    );
  };
  
  // If not expanded, don't render anything
  if (!isExpanded) return null;
  
  // MAIN RENDER
  /**
   * Main component render displaying loading states, error messages, or posts
   */
  return (
    <View className="w-full bg-black/5 rounded-lg mb-4 overflow-hidden border-2">
      {/* Content - Loading, Error, or Posts */}
      <View className="px-2 py-4">
        {loading ? (
          <View className="h-32 justify-center items-center">
            <ActivityIndicator size="large" color="#000" />
            <Text className="mt-4 font-montRegular text-black/70">
              Loading posts...
            </Text>
          </View>
        ) : error ? (
          <View className="p-4 bg-red-100 rounded-lg">
            <Text className="font-montSemiBold text-red-700 text-center">
              {error}
            </Text>
          </View>
        ) : posts.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            data={posts}
            renderItem={renderPostItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            scrollEnabled={false} // Disable scrolling inside nested FlatList
            contentContainerStyle={{ paddingHorizontal: 2 }}
          />
        )}
      </View>
    </View>
  );
};

export default ExpandableStylePosts;