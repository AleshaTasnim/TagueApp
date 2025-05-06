/**
 * useStyleSearch.js - Custom hook for style searching
 * 
 * This hook provides functionality for searching style tags in posts. It processes
 * posts to extract and match styles against search terms, resolving variations in
 * capitalisation by selecting the most common form. The hook handles loading states
 * and returns matching styles with their associated posts.
 * 
 * Features:
 * - Multi-term searching with space-delimited terms
 * - Case-insensitive matching
 * - Style variation resolution (selecting most common capitalisation)
 * - Post association with matched styles
 * - Proper loading state management
 */

import { useState, useEffect } from 'react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../backend/firebaseConfig';

const useStyleSearch = (searchText) => {
  const [styles, setStyles] = useState([]);
  const [isLoadingStyles, setIsLoadingStyles] = useState(false);
  
  // Trigger search when search text changes
  useEffect(() => {
    if (searchText) {
      searchStyles(searchText);
    } else {
      setStyles([]);
    }
  }, [searchText]);
  
  // Search for styles in posts (case-insensitive)
  const searchStyles = async (searchText) => {
    setIsLoadingStyles(true);
    const searchTerms = searchText.toLowerCase().trim().split(/\s+/);
    
    try {
      // Fetch posts to extract unique styles
      const postsRef = collection(db, "posts");
      const q = query(postsRef, limit(100));
      const querySnapshot = await getDocs(q);
      
      // Will hold all matching styles with their associated posts
      const matchingStylesMap = new Map();
      
      // Process all posts to find matching styles
      querySnapshot.forEach((doc) => {
        const postData = { id: doc.id, ...doc.data() };
        
        // Skip posts without styles
        if (!postData.styles || !Array.isArray(postData.styles) || postData.styles.length === 0) {
          return;
        }
        
        // Check each style for matches
        postData.styles.forEach(style => {
          if (!style) return;
          
          const styleText = style.toLowerCase(); // Lowercase for comparison
          
          // Check if any search term matches the style
          const matchesSearch = searchTerms.some(term => styleText.includes(term));
          
          if (matchesSearch) {
            // Use lowercase version as key to group case variations together
            if (!matchingStylesMap.has(styleText)) {
              // Store the style with an array to track associated posts
              // Keep original capitalisation for display
              matchingStylesMap.set(styleText, {
                style: style, // Keep original capitalisation for display
                styleLowercase: styleText, // Lowercase for grouping
                posts: [],
                variations: new Set([style]) // Track different capitalisations
              });
            } else {
              // Add this variation to the set if it's new
              matchingStylesMap.get(styleText).variations.add(style);
            }
            
            // Add this post to the style's associated posts
            matchingStylesMap.get(styleText).posts.push({
              id: postData.id,
              imageUrl: postData.imageUrl,
              userId: postData.userId
            });
          }
        });
      });
      
      // For styles with variations, choose the most common capitalisation
      const processedStylesMap = new Map();
      
      matchingStylesMap.forEach((styleInfo, lowercaseKey) => {
        // Count occurrences of each variation
        const variationCounts = {};
        styleInfo.variations.forEach(variation => {
          variationCounts[variation] = (variationCounts[variation] || 0) + 1;
        });
        
        // Find the most common variation
        let mostCommonVariation = styleInfo.style;
        let maxCount = 0;
        Object.entries(variationCounts).forEach(([variation, count]) => {
          if (count > maxCount) {
            mostCommonVariation = variation;
            maxCount = count;
          }
        });
        
        // Use the most common variation as the display style
        processedStylesMap.set(lowercaseKey, {
          style: mostCommonVariation,
          posts: styleInfo.posts
        });
      });
      
      // Convert the map to an array
      const matchingStyles = Array.from(processedStylesMap.values());
      setStyles(matchingStyles);
    } catch (error) {
      console.error("Error searching styles:", error);
      setStyles([]);
    } finally {
      setIsLoadingStyles(false);
    }
  };
  
  // Return the search results and loading state
  return { styles, isLoadingStyles };
};

export default useStyleSearch;