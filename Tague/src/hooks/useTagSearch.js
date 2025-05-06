/**
 * useTagSearch.js - Custom hook for tag searching
 * 
 * This hook provides functionality for searching product tags in posts. It processes
 * posts to extract and match tags against search terms, with sophisticated relevance
 * scoring that prioritises exact matches. The hook handles loading states and returns
 * matching tags with their associated posts sorted by relevance.
 * 
 * Features:
 * - Multi-term searching with space-delimited terms
 * - Exact match prioritisation
 * - Relevance scoring based on match quality
 * - Brand and product name matching
 * - Post association with matched tags
 * - Intelligent result sorting by relevance and post count
 */

import { useState, useEffect } from 'react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../backend/firebaseConfig';

const useTagSearch = (searchText) => {
  const [tags, setTags] = useState([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  
  // Trigger search when search text changes
  useEffect(() => {
    if (searchText) {
      searchTags(searchText);
    } else {
      setTags([]);
    }
  }, [searchText]);
  
  // Search for tags in posts
  const searchTags = async (searchText) => {
    setIsLoadingTags(true);
    const searchTerms = searchText.toLowerCase().trim().split(/\s+/);
    
    try {
      // We need to fetch posts and extract unique tags
      const postsRef = collection(db, "posts");
      const q = query(postsRef, limit(100));
      const querySnapshot = await getDocs(q);
      
      // Will hold all matching tags with their associated posts
      const matchingTagsMap = new Map();
      
      // Process all posts to find matching tags
      querySnapshot.forEach((doc) => {
        const postData = { id: doc.id, ...doc.data() };
        
        // Skip posts without tags
        if (!postData.tags || !Array.isArray(postData.tags) || postData.tags.length === 0) {
          return;
        }
        
        // Check each tag for matches
        postData.tags.forEach(tag => {
          // Only consider tags with brand or productName
          if (!tag.brand && !tag.productName) return;
          
          const brand = (tag.brand || '').toLowerCase();
          const productName = (tag.productName || '').toLowerCase();
          
          // Check if any search term matches either brand or productName
          let matchesSearch = false;
          let exactMatch = false;
          
          // Clean and normalise the search text for exact match comparison
          const cleanSearchText = searchText.toLowerCase().trim();
          const brandProductCombo = `${brand} ${productName}`.trim();
          
          // First check for exact matches (highest priority)
          // Check both the combined text and individual matches
          if (brandProductCombo === cleanSearchText) {
            matchesSearch = true;
            exactMatch = true;
          } else if (brand === cleanSearchText || productName === cleanSearchText) {
            // If only brand or only product name matches exactly
            matchesSearch = true;
            exactMatch = true;
          } else {
            // Otherwise check for partial matches in either field
            matchesSearch = searchTerms.some(term => 
              brand.includes(term) || productName.includes(term)
            );
          }
          
          if (matchesSearch) {
            // Create a unique key for this tag
            const tagKey = `${brand}:${productName}`;
            
            if (!matchingTagsMap.has(tagKey)) {
              // Store the tag with an array to track associated posts
              matchingTagsMap.set(tagKey, {
                tag: {
                  // Copy all tag properties
                  ...tag,
                  // Ensure essential properties exist
                  brand: tag.brand || '',
                  productName: tag.productName || '',
                  price: tag.price || '',
                  color: tag.color || '#F3E3D3',
                },
                posts: [],
                exactMatch: exactMatch,
                relevanceScore: exactMatch ? 100 : 0 // Base relevance score
              });
            }
            
            // Add this post to the tag's associated posts
            matchingTagsMap.get(tagKey).posts.push({
              id: postData.id,
              imageUrl: postData.imageUrl,
              userId: postData.userId
            });
            
            // Update relevance score based on matching terms
            if (!exactMatch) {
              const tagData = matchingTagsMap.get(tagKey);
              searchTerms.forEach(term => {
                // Add score for each term match
                if (brand.includes(term)) tagData.relevanceScore += 5;
                if (productName.includes(term)) tagData.relevanceScore += 3;
              });
            }
          }
        });
      });
      
      // Convert the map to an array and sort by relevance
      const matchingTags = Array.from(matchingTagsMap.values())
        .sort((a, b) => {
          // Sort exact matches first
          if (a.exactMatch && !b.exactMatch) return -1;
          if (!a.exactMatch && b.exactMatch) return 1;
          
          // Then sort by relevance score
          if (a.relevanceScore !== b.relevanceScore) {
            return b.relevanceScore - a.relevanceScore;
          }
          
          // Then by number of posts
          return b.posts.length - a.posts.length;
        });
      
      setTags(matchingTags);
    } catch (error) {
      console.error("Error searching tags:", error);
      setTags([]);
    } finally {
      setIsLoadingTags(false);
    }
  };
  
  // Return the search results and loading state
  return { tags, isLoadingTags };
};

export default useTagSearch;