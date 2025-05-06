/**
 * usePostSearch.js - Custom hook for post searching
 * 
 * This hook provides functionality for searching posts by caption and tag information.
 * It uses a two-pass filtering approach to efficiently match posts against search terms,
 * and enriches the results with user information. The hook handles loading states and
 * returns filtered posts based on the provided search query.
 * 
 * Features:
 * - Multi-term searching with space-delimited terms
 * - Caption and product tag matching
 * - User information enrichment for matched posts
 * - Optimised filtering with two-pass approach
 * - Proper loading state management
 */

import { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, doc, getDoc, limit } from 'firebase/firestore';
import { db } from '../../backend/firebaseConfig';

const usePostSearch = (searchText) => {
  const [posts, setPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  
  // Trigger search when search text changes
  useEffect(() => {
    if (searchText) {
      searchPosts(searchText);
    } else {
      setPosts([]);
    }
  }, [searchText]);
  
  // Search for posts by caption and tags information
  const searchPosts = async (searchText) => {
    setIsLoadingPosts(true);
    const searchTerms = searchText.toLowerCase().trim().split(/\s+/);
    
    try {
      const postsRef = collection(db, "posts");
      // We need to fetch posts and filter manually for complex searches
      const q = query(postsRef, orderBy("createdAt", "desc"), limit(100));
      const querySnapshot = await getDocs(q);
      
      const fetchedPosts = [];
      const postsToProcessFurther = [];
      
      // First-pass filter: check captions
      querySnapshot.forEach((doc) => {
        const postData = doc.data();
        const caption = (postData.caption || '').toLowerCase();
        
        // Check if any search term matches the caption
        const matchesCaption = searchTerms.some(term => 
          caption.includes(term)
        );
        
        // Check if post has tags that might match
        const hasTags = postData.tags && postData.tags.length > 0;
        
        if (matchesCaption) {
          // Direct caption match
          fetchedPosts.push({
            id: doc.id,
            ...postData,
            // We'll need to add user info later
          });
        } else if (hasTags) {
          // Has tags that might match - needs further checking
          postsToProcessFurther.push({
            id: doc.id,
            ...postData
          });
        }
      });
      
      // Second-pass filter: check tags for remaining posts
      for (const post of postsToProcessFurther) {
        if (!post.tags) continue;
        
        const matchesTags = post.tags.some(tag => {
          const brand = (tag.brand || '').toLowerCase();
          const productName = (tag.productName || '').toLowerCase();
          
          return searchTerms.some(term => 
            brand.includes(term) || productName.includes(term)
          );
        });
        
        if (matchesTags) {
          fetchedPosts.push(post);
        }
      }
      
      // Fetch user info for all matching posts
      const postsWithUserInfo = await Promise.all(
        fetchedPosts.map(async (post) => {
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
      console.error("Error searching posts:", error);
      setPosts([]);
    } finally {
      setIsLoadingPosts(false);
    }
  };
  
  // Return the search results and loading state
  return { posts, isLoadingPosts };
};

export default usePostSearch;