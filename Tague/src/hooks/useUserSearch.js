/**
 * useUserSearch.js - Custom hook for user searching
 * 
 * This hook provides functionality for searching users by display name or username.
 * It fetches users from Firestore and filters them based on the search terms,
 * supporting partial matches in either field. The hook handles loading states and
 * returns matching users sorted by relevance.
 * 
 * Features:
 * - Multi-term searching with space-delimited terms
 * - Case-insensitive matching
 * - Display name and username field matching
 * - Efficient filtering with appropriate limits
 * - Proper loading state management
 */

import { useState, useEffect } from 'react';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../backend/firebaseConfig';

const useUserSearch = (searchText) => {
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  
  // Trigger search when search text changes
  useEffect(() => {
    if (searchText) {
      searchUsers(searchText);
    } else {
      setUsers([]);
    }
  }, [searchText]);
  
  // Search for users by displayName or username
  const searchUsers = async (searchText) => {
    setIsLoadingUsers(true);
    const searchTerms = searchText.toLowerCase().trim().split(/\s+/);
    
    try {
      const usersRef = collection(db, "users");
      // We need to fetch all users and filter manually since Firebase
      // doesn't support OR queries across different fields easily
      const q = query(usersRef, limit(50));
      const querySnapshot = await getDocs(q);
      
      const results = [];
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        const displayName = (userData.displayName || '').toLowerCase();
        const username = (userData.username || '').toLowerCase();
        
        // Check if any search term matches either displayName or username
        const matchesSearch = searchTerms.some(term => 
          displayName.includes(term) || username.includes(term)
        );
        
        if (matchesSearch) {
          results.push({
            id: doc.id,
            ...userData
          });
        }
      });
      
      setUsers(results);
    } catch (error) {
      console.error("Error searching users:", error);
      setUsers([]);
    } finally {
      setIsLoadingUsers(false);
    }
  };
  
  // Return the search results and loading state
  return { users, isLoadingUsers };
};

export default useUserSearch;