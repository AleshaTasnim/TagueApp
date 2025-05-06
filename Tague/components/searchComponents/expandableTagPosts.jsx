/**
 * ExpandableTagPosts.jsx - Component for displaying posts with specific tags
 * 
 * This component displays a collection of posts that contain a specific tag.
 * It's designed to be embedded directly in search results instead of a modal.
 * Features include:
 * - Expandable/collapsible display of tagged posts
 * - Privacy-aware filtering to respect user privacy settings
 * - Responsive grid layout based on screen dimensions
 * - Direct navigation to individual posts
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { router } from 'expo-router';
import { icons } from '../../constants/icons';
import { OptimisedImage } from '../optimisedImage';
import { query, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';

const ExpandableTagPosts = ({ tagInfo, onClose, isExpanded }) => {
  // STATE MANAGEMENT
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Get screen dimensions for responsive layouts
  const screenWidth = Dimensions.get('window').width;
  const postsItemWidth = (screenWidth - 48) / 2; // 2 columns with padding
  
  // LIFECYCLE HOOKS
  useEffect(() => {
    if (isExpanded && tagInfo) {
      fetchPostsWithTag();
    }
  }, [isExpanded, tagInfo]);
  
  // DATA FETCHING
  
  // Fetch all posts containing the specified tag and filter for privacy
  const fetchPostsWithTag = async () => {
    if (!tagInfo || !tagInfo.tag) {
      setError('No tag information provided');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    try {
      const { tag } = tagInfo;
      
      // Extract the exact brand and productName for matching
      const exactBrand = tag.brand || '';
      const exactProductName = tag.productName || '';
      
      // If either brand or productName is missing, we can't match exactly
      if (!exactBrand && !exactProductName) {
        setError('Tag information is incomplete');
        setLoading(false);
        return;
      }
      
      // Can't use direct querying for tags since they're in arrays with objects
      // Instead, fetch posts and filter manually
      const postsRef = collection(db, "posts");
      const q = query(postsRef);
      const querySnapshot = await getDocs(q);
      
      const matchingPosts = [];
      const privacyCache = new Map();
      
      // Filter posts with exactly matching tags and filter by privacy
      for (const docSnapshot of querySnapshot.docs) {
        const postData = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Skip if post has no tags
        if (!postData.tags || !Array.isArray(postData.tags)) continue;
        
        // Check if any tag exactly matches the search criteria
        const hasMatchingTag = postData.tags.some(postTag => {
          if (!postTag) return false;
          
          // Check for exact matches on brand and productName
          // We use case-insensitive comparison but require full match (not partial)
          const brandMatches = exactBrand.toLowerCase() === (postTag.brand || '').toLowerCase();
          const productMatches = exactProductName.toLowerCase() === (postTag.productName || '').toLowerCase();
          
          // Both brand and productName must match exactly
          return brandMatches && productMatches;
        });
        
        // Skip if no matching tag found
        if (!hasMatchingTag) continue;
        
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
      console.error("Error fetching posts with tag:", error);
      setError('Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // NAVIGATION FUNCTIONS
  
  // Navigate to post detail screen directly without closing any modals
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
  
  // Render a post item
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
  
  // Render empty state when no posts are found
  const renderEmptyState = () => {
    if (loading) return null;
    
    return (
      <View className="my-4 justify-center items-center p-4 bg-black/5 rounded-lg">
        <Text className="text-lg font-montSemiBold text-black/70 text-center mb-2">
          No posts found
        </Text>
        <Text className="text-base font-montRegular text-black/60 text-center">
          We couldn't find any posts with this exact tag.
        </Text>
      </View>
    );
  };
  
  // Function to truncate text that's too long
  const truncateText = (text, maxLength) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
  };
  
  // If not expanded, don't render anything
  if (!isExpanded) return null;
  
  // MAIN RENDER
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

export default ExpandableTagPosts;