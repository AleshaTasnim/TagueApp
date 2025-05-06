/**
 * StyleResults.jsx - Style search results component
 * 
 * This component displays and manages the search results for styles in the application.
 * It handles filtering styles to only include those with public posts, tracking user's
 * followed styles, and providing follow/unfollow functionality. It includes loading states,
 * empty states, and optimised rendering for performance.
 * 
 * Features:
 * - Filtering of styles to only show those with public posts
 * - Expandable style cards for detailed viewing
 * - Follow/unfollow capabilities for styles
 * - Tracking of following status
 * - Loading and empty state handling
 * - Optimised rendering with FlatList
 */

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Alert, ActivityIndicator } from 'react-native';
import StyleCard from './styleCard';
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';

const StyleResults = ({ styles, currentQuery, setSearchInputQuery }) => {
  // State to track expanded style
  const [expandedStyleInfo, setExpandedStyleInfo] = useState(null);
  // State to track following status of each style
  const [followingStatus, setFollowingStatus] = useState({});
  // State to track which style is currently being processed for follow/unfollow
  const [processingFollow, setProcessingFollow] = useState(null);
  // State to track filtered styles (only those with public posts)
  const [filteredStyles, setFilteredStyles] = useState([]);
  // State to track loading state
  const [isLoading, setIsLoading] = useState(true);
  
  const currentUser = auth.currentUser;
  
  // Toggle style expansion when a style card is clicked
  const toggleStyleExpansion = (styleInfo) => {
    setExpandedStyleInfo(styleInfo);
  };
  
  // Filter styles to only include those with public posts
  useEffect(() => {
    const filterStylesWithPublicPosts = async () => {
      setIsLoading(true);
      
      try {
        const privacyCache = new Map();
        const stylesWithPublicPosts = [];
        
        for (const styleInfo of styles) {
          const { style, posts } = styleInfo;
          let publicPostCount = 0;
          const publicPosts = [];
          
          // Check each post to see if it's from a public account
          for (const post of posts) {
            const userId = post.userId;
            
            // Use cache if available
            if (privacyCache.has(userId)) {
              if (!privacyCache.get(userId)) {
                publicPostCount++;
                publicPosts.push(post);
              }
              continue;
            }
            
            // Fetch user privacy settings
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const isUserPrivate = userDoc.data().isPrivate || false;
              privacyCache.set(userId, isUserPrivate);
              
              if (!isUserPrivate) {
                publicPostCount++;
                publicPosts.push(post);
              }
            }
          }
          
          // Only include styles with at least one public post
          if (publicPostCount > 0) {
            stylesWithPublicPosts.push({
              ...styleInfo,
              posts: publicPosts, // Only include public posts
              publicPostCount // Store the count for reference
            });
          }
        }
        
        setFilteredStyles(stylesWithPublicPosts);
        
        // If we've filtered out all styles, immediately stop loading
        if (stylesWithPublicPosts.length === 0) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error filtering styles with public posts:", error);
        // Fallback to showing all styles if there's an error
        setFilteredStyles(styles);
        setIsLoading(false);
      }
    };
    
    if (styles.length > 0) {
      filterStylesWithPublicPosts();
    } else {
      setFilteredStyles([]);
      setIsLoading(false);
    }
  }, [styles]);
  
  // Fetch current user's followed styles when component mounts
  useEffect(() => {
    if (currentUser && filteredStyles.length > 0) {
      fetchFollowingStatus();
    }
  }, [currentUser, filteredStyles]);
  
  // Fetch the current user's followed styles list
  const fetchFollowingStatus = async () => {
    try {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      
      const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (currentUserDoc.exists()) {
        // Using followedStyles array specifically for styles, separated from users following
        const followedStyles = currentUserDoc.data().followedStyles || [];
        
        // Create object tracking follow status for each style
        const followStatus = {};
        filteredStyles.forEach(styleInfo => {
          // Using style.style as the identifier
          followStatus[styleInfo.style] = followedStyles.includes(styleInfo.style);
        });
        
        setFollowingStatus(followStatus);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching followed styles status:", error);
      setIsLoading(false);
    }
  };
  
  // Handle following/unfollowing a style
  const handleFollowAction = async (styleId) => {
    if (!currentUser) {
      Alert.alert("Error", "You must be logged in to follow styles.");
      return;
    }
    
    setProcessingFollow(styleId);
    
    try {
      const isFollowing = followingStatus[styleId];
      const currentUserRef = doc(db, "users", currentUser.uid);
      
      // First check if the style document exists in the styles collection
      const styleRef = doc(db, "styles", styleId);
      const styleDoc = await getDoc(styleRef);
      
      if (isFollowing) {
        // Unfollow style
        await updateDoc(currentUserRef, {
          followedStyles: arrayRemove(styleId)
        });
        
        // Only update style document if it exists
        if (styleDoc.exists()) {
          await updateDoc(styleRef, {
            followers: arrayRemove(currentUser.uid)
          });
        }
        
        // Update local state
        setFollowingStatus(prev => ({
          ...prev,
          [styleId]: false
        }));
      } else {
        // Follow style
        await updateDoc(currentUserRef, {
          followedStyles: arrayUnion(styleId)
        });
        
        // If style document doesn't exist, create it with basic info
        if (!styleDoc.exists()) {
          // Create a new style document with the current user as the first follower
          await setDoc(styleRef, {
            style: styleId,
            followers: [currentUser.uid],
            createdAt: serverTimestamp()
          });
        } else {
          // Update existing style document
          await updateDoc(styleRef, {
            followers: arrayUnion(currentUser.uid)
          });
        }
        
        // Update local state
        setFollowingStatus(prev => ({
          ...prev,
          [styleId]: true
        }));
      }
    } catch (error) {
      console.error("Error updating follow status:", error);
      Alert.alert("Error", "Failed to update follow status. Please try again.");
    } finally {
      setProcessingFollow(null);
    }
  };
  
  // Render loading state view
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <ActivityIndicator size="large" color="#000" />
        <Text className="mt-4 font-montRegular text-black/70">
          Loading styles...
        </Text>
      </View>
    );
  }
  
  // Render empty state view when no styles match the search
  if (filteredStyles.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-lg font-montSemiBold text-black/70 text-center">
          No styles found matching "{currentQuery}"
        </Text>
        <Text className="text-base font-montRegular text-black/60 text-center mt-2">
          Try a different search term or check your spelling
        </Text>
      </View>
    );
  }
  
  // Render each style item in the list
  const renderStyleItem = ({ item, index }) => (
    <StyleCard
      styleInfo={item}
      index={index}
      expandedStyleInfo={expandedStyleInfo}
      toggleStyleExpansion={toggleStyleExpansion}
      isFollowing={followingStatus[item.style] || false}
      isProcessingFollow={processingFollow === item.style}
      onFollowAction={() => handleFollowAction(item.style)}
    />
  );
  
  // Render the main list of style results
  return (
    <FlatList
      data={filteredStyles}
      renderItem={renderStyleItem}
      keyExtractor={(item, index) => `style-${index}`}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
      initialNumToRender={8}
      maxToRenderPerBatch={6}
      windowSize={5}
      removeClippedSubviews={true}
    />
  );
};

export default StyleResults;