/**
 * TagResults.jsx - Tag search results component
 * 
 * This component displays and manages the search results for product tags in the application.
 * It handles filtering tags to only include those with public posts, displaying loading states,
 * and rendering a list of TagCard components for each matching tag. The component ensures
 * that only tags with at least one post from a public account are displayed.
 * 
 * Features:
 * - Filtering of tags to only show those with public posts
 * - Loading state display
 * - Empty state handling with helpful messages
 * - Optimised rendering with FlatList
 * - Support for expandable tag cards
 */

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import TagCard from './tagCard';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../backend/firebaseConfig';

const TagResults = ({ tags, currentQuery, expandedTagInfo, toggleTagExpansion }) => {
  const [filteredTags, setFilteredTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter out tags with 0 public posts
  useEffect(() => {
    const filterTagsWithPublicPosts = async () => {
      setIsLoading(true);
      
      try {
        const privacyCache = new Map();
        const tagsWithPublicPosts = [];
        
        for (const tagInfo of tags) {
          const { posts } = tagInfo;
          let publicPostCount = 0;
          
          // Check each post to see if it's from a public account
          for (const post of posts) {
            const userId = post.userId;
            
            // Use cache if available
            if (privacyCache.has(userId)) {
              if (!privacyCache.get(userId)) {
                publicPostCount++;
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
              }
            }
          }
          
          // Only include tags with at least one public post
          if (publicPostCount > 0) {
            tagsWithPublicPosts.push({
              ...tagInfo,
              publicPostCount // Add this count for potential future use
            });
          }
        }
        
        setFilteredTags(tagsWithPublicPosts);
      } catch (error) {
        console.error("Error filtering tags with public posts:", error);
        // Fallback to showing all tags if there's an error
        setFilteredTags(tags);
      } finally {
        setIsLoading(false);
      }
    };
    
    filterTagsWithPublicPosts();
  }, [tags]);
  
  // Render loading state
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <ActivityIndicator size="large" color="#000" />
        <Text className="mt-4 font-montRegular text-black/70">
          Loading tags...
        </Text>
      </View>
    );
  }
  
  // Render empty state when no tags match the search
  if (filteredTags.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-lg font-montSemiBold text-black/70 text-center">
          No tags found matching "{currentQuery}"
        </Text>
        <Text className="text-base font-montRegular text-black/60 text-center mt-2">
          Try a different search term or check your spelling
        </Text>
      </View>
    );
  }
  
  // Render a tag card for each item
  const renderTagItem = ({ item, index }) => (
    <TagCard 
      key={index}
      tagInfo={item}
      index={index}
      expandedTagInfo={expandedTagInfo}
      toggleTagExpansion={toggleTagExpansion}
    />
  );
  
  // Render the main list of tag results
  return (
    <FlatList
      data={filteredTags}
      renderItem={renderTagItem}
      keyExtractor={(item, index) => `tag-${index}`}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
      initialNumToRender={8}
      maxToRenderPerBatch={5}
      windowSize={5}
      removeClippedSubviews={true}
    />
  );
};

export default TagResults;