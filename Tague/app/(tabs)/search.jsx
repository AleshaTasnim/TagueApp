import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { icons } from '../../constants/icons';
import ExplorePage from '../../components/searchComponents/explorePage';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../backend/firebaseConfig';

const Search = () => {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState('');
  const [showExplore, setShowExplore] = useState(true);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  // =========================================================================
  // LIFECYCLE HOOKS
  // =========================================================================
  useEffect(() => {
    // Load recent searches from storage (could be AsyncStorage in a real app)
    const loadRecentSearches = async () => {
      // In a real app, Tague would load from AsyncStorage or similar, for now example searches are provided
      const savedSearches = [
        'summer fits',
        'streetwear',
        'vela',
        'leopard'
      ];
      setRecentSearches(savedSearches);
    };
    
    loadRecentSearches();
  }, []);
  
  // Fetch suggestions when search query changes
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      fetchAutocompleteSuggestions(searchQuery);
    } else {
      setAutocompleteSuggestions([]);
      // Hide recent searches when query is completely cleared
      if (searchQuery === '') {
        setShowRecentSearches(false);
      }
    }
  }, [searchQuery]);
  
  // =========================================================================
  // SEARCH AUTOCOMPLETE SUGGESTIONS
  // =========================================================================
  /**
   * Fetch autocomplete suggestions based on search query
   */
  const fetchAutocompleteSuggestions = async (query) => {
    if (query.trim().length === 0) return;
    
    setIsLoadingSuggestions(true);
    const searchTermLower = query.toLowerCase().trim();
    
    try {
      // Get suggestions from various sources
      const usernameSuggestions = await fetchUsernameSuggestions(searchTermLower);
      const tagSuggestions = await fetchTagTextSuggestions(searchTermLower);
      const styleSuggestions = await fetchStyleTextSuggestions(searchTermLower);
      
      // Combine all suggestions and remove duplicates
      const allSuggestions = [...usernameSuggestions, ...tagSuggestions, ...styleSuggestions];
      const uniqueSuggestions = [...new Set(allSuggestions)];
      
      // Sort suggestions - exact matches first, then starts with, then contains
      const sortedSuggestions = uniqueSuggestions.sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        // Exact matches
        if (aLower === searchTermLower && bLower !== searchTermLower) return -1;
        if (bLower === searchTermLower && aLower !== searchTermLower) return 1;
        
        // Starts with
        if (aLower.startsWith(searchTermLower) && !bLower.startsWith(searchTermLower)) return -1;
        if (bLower.startsWith(searchTermLower) && !aLower.startsWith(searchTermLower)) return 1;
        
        // Sort alphabetically within same priority
        return aLower.localeCompare(bLower);
      });
      
      // Limit to 10 suggestions for performance
      setAutocompleteSuggestions(sortedSuggestions.slice(0, 10));
      
    } catch (error) {
      console.error("Error fetching autocomplete suggestions:", error);
      setAutocompleteSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };
  
  /**
   * Fetch username suggestions
   */
  const fetchUsernameSuggestions = async (searchTerm) => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, limit(20));
    const querySnapshot = await getDocs(q);
    
    const suggestions = [];
    
    querySnapshot.forEach((doc) => {
      const userData = doc.data();
      
      // Check displayName
      if (userData.displayName) {
        const displayName = userData.displayName.toLowerCase();
        if (displayName.includes(searchTerm) && !suggestions.includes(userData.displayName)) {
          suggestions.push(userData.displayName);
        }
      }
      
      // Check username
      if (userData.username) {
        const username = userData.username.toLowerCase();
        if (username.includes(searchTerm) && !suggestions.includes(userData.username)) {
          suggestions.push(userData.username);
        }
      }
    });
    
    return suggestions;
  };
  
  /**
   * Fetch tag text suggestions (brand and productName)
   */
  const fetchTagTextSuggestions = async (searchTerm) => {
    const postsRef = collection(db, "posts");
    const q = query(postsRef, limit(30));
    const querySnapshot = await getDocs(q);
    
    const suggestions = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      
      if (postData.tags && Array.isArray(postData.tags)) {
        postData.tags.forEach(tag => {
          // Check brand
          if (tag.brand) {
            const brand = tag.brand.toLowerCase();
            if (brand.includes(searchTerm) && !suggestions.includes(tag.brand)) {
              suggestions.push(tag.brand);
            }
          }
          
          // Check productName
          if (tag.productName) {
            const productName = tag.productName.toLowerCase();
            if (productName.includes(searchTerm) && !suggestions.includes(tag.productName)) {
              suggestions.push(tag.productName);
            }
          }
        });
      }
    });
    
    return suggestions;
  };
  
  /**
   * Fetch style text suggestions
   */
  const fetchStyleTextSuggestions = async (searchTerm) => {
    const postsRef = collection(db, "posts");
    const q = query(postsRef, limit(30));
    const querySnapshot = await getDocs(q);
    
    const suggestions = [];
    
    querySnapshot.forEach((doc) => {
      const postData = doc.data();
      
      if (postData.styles && Array.isArray(postData.styles)) {
        postData.styles.forEach(style => {
          if (style) {
            const styleLower = style.toLowerCase();
            if (styleLower.includes(searchTerm) && !suggestions.includes(style)) {
              suggestions.push(style);
            }
          }
        });
      }
    });
    
    return suggestions;
  };
  
  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================
  /**
   * Handle query input changes
   */
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    
    // If text is empty, return to explore view but decide about recent searches
    if (text.length === 0) {
      setShowExplore(true);
      // Don't hide recent searches when they've manually cleared the search
      // They might want to select from recent searches
    } else {
      setShowExplore(false);
      // Show recent searches when the search bar has content
      if (!showRecentSearches) {
        setShowRecentSearches(true);
      }
    }
  };
  
  /**
   * Handle search submission
   */
  const handleSearch = () => {
    if (searchQuery.trim() === '') return;
    
    // Save to recent searches
    if (!recentSearches.includes(searchQuery)) {
      const updatedSearches = [searchQuery, ...recentSearches.slice(0, 4)];
      setRecentSearches(updatedSearches);
      // In a real app, save to AsyncStorage here
    }
    
    // Navigate to search results
    router.push({
      pathname: '/search/[query]',
      params: { query: encodeURIComponent(searchQuery) }
    });
  };
  
  /**
   * Handle suggestion tap - sets the search text and initiates search
   */
  const handleSuggestionTap = (suggestion) => {
    setSearchQuery(suggestion);
    
    // Save to recent searches
    if (!recentSearches.includes(suggestion)) {
      const updatedSearches = [suggestion, ...recentSearches.slice(0, 4)];
      setRecentSearches(updatedSearches);
      // In a real app, save to AsyncStorage here
    }
    
    // Immediately initiate search
    router.push({
      pathname: '/search/[query]',
      params: { query: encodeURIComponent(suggestion) }
    });
  };
  
  /**
   * Handle recent search tap
   */
  const handleRecentSearchTap = (query) => {
    router.push({
      pathname: '/search/[query]',
      params: { query: encodeURIComponent(query) }
    });
  };
  
  /**
   * Handle back button press - return to explore view
   */
  const handleBackPress = () => {
    setSearchQuery('');
    setShowExplore(true);
    setShowRecentSearches(false);
  };
  
  /**
   * Clear search input
   */
  const clearSearch = () => {
    setSearchQuery('');
    setShowExplore(true);
    setShowRecentSearches(false);
  };
  
  /**
   * Clear all recent searches
   */
  const clearRecentSearches = () => {
    setRecentSearches([]);
    // In a real app, clear from AsyncStorage here
  };
  
  // =========================================================================
  // RENDER COMPONENTS
  // =========================================================================
  /**
   * Render recent searches section
   */
  const renderRecentSearches = () => {
    if (recentSearches.length === 0) return null;
    
    return (
      <View className="px-4 pb-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-lg font-montSemiBold text-black">Recent Searches</Text>
          <TouchableOpacity onPress={clearRecentSearches}>
            <Text className="text-sm font-montMedium text-black/70">Clear All</Text>
          </TouchableOpacity>
        </View>
        
        {recentSearches.map((search, index) => (
          <TouchableOpacity
            key={index}
            className="flex-row items-center py-3 border-b border-black/10"
            onPress={() => handleRecentSearchTap(search)}
          >
            <Image
              source={icons.search}
              className="w-5 h-5 mr-3"
              resizeMode="contain"
              tintColor="#00000080"
            />
            <Text className="flex-1 font-montRegular text-black">{search}</Text>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setRecentSearches(recentSearches.filter((_, i) => i !== index));
                // In a real app, update AsyncStorage here
              }}
            >
              <Image
                source={icons.cross}
                className="w-5 h-5"
                resizeMode="contain"
                tintColor="#00000080"
              />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  };
  
  /**
   * Render autocompletion suggestions
   */
  const renderAutocompleteSuggestions = () => {
    if (isLoadingSuggestions) {
      return (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color="#000" />
          <Text className="mt-2 font-montRegular text-black/60">Finding suggestions...</Text>
        </View>
      );
    }
    
    if (autocompleteSuggestions.length === 0) {
      // No suggestions found but user is typing
      return (
        <View className="px-4 pt-2">
          <Text className="text-base font-montMedium text-black/70 mb-3">
            Press enter to search for "{searchQuery}"
          </Text>
          
          <TouchableOpacity 
            className="flex-row items-center py-3 border-b border-black/10"
            onPress={handleSearch}
          >
            <Image
              source={icons.search}
              className="w-5 h-5 mr-3"
              resizeMode="contain"
              tintColor="#00000080"
            />
            <Text className="font-montRegular text-black">Search for <Text className="font-montMedium">"{searchQuery}"</Text></Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-row items-center py-3 border-b border-black/10"
            onPress={() => {
              router.push({
                pathname: '/search/[query]',
                params: { query: encodeURIComponent(searchQuery), filter: 'users' }
              });
            }}
          >
            <Image
              source={icons.profile}
              className="w-5 h-5 mr-3"
              resizeMode="contain"
              tintColor="#00000080"
            />
            <Text className="font-montRegular text-black">Find users matching <Text className="font-montMedium">"{searchQuery}"</Text></Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            className="flex-row items-center py-3 border-b border-black/10"
            onPress={() => {
              router.push({
                pathname: '/search/[query]',
                params: { query: encodeURIComponent(searchQuery), filter: 'posts' }
              });
            }}
          >
            <Image
              source={icons.gallery}
              className="w-5 h-5 mr-3"
              resizeMode="contain"
              tintColor="#00000080"
            />
            <Text className="font-montRegular text-black">Find posts about <Text className="font-montMedium">"{searchQuery}"</Text></Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    // Render autocomplete suggestions
    return (
      <View className="px-4 pt-2">
        <Text className="text-base font-montMedium text-black/70 mb-1">
          Suggestions
        </Text>
        
        {autocompleteSuggestions.map((suggestion, index) => {
          // Highlight the matching part of the suggestion
          const suggestionLower = suggestion.toLowerCase();
          const queryLower = searchQuery.toLowerCase();
          const matchIndex = suggestionLower.indexOf(queryLower);
          
          let beforeMatch = suggestion;
          let match = '';
          let afterMatch = '';
          
          if (matchIndex !== -1) {
            beforeMatch = suggestion.substring(0, matchIndex);
            match = suggestion.substring(matchIndex, matchIndex + searchQuery.length);
            afterMatch = suggestion.substring(matchIndex + searchQuery.length);
          }
          
          return (
            <TouchableOpacity
              key={index}
              className="flex-row items-center py-3 border-b border-black/10"
              onPress={() => handleSuggestionTap(suggestion)}
            >
              <Image
                source={icons.search}
                className="w-5 h-5 mr-3"
                resizeMode="contain"
                tintColor="#00000080"
              />
              <Text className="font-montRegular text-black">
                {beforeMatch}
                <Text className="font-montSemiBold text-black">{match}</Text>
                {afterMatch}
              </Text>
            </TouchableOpacity>
          );
        })}
        
        {/* Search button at the bottom */}
        <TouchableOpacity 
          className="flex-row items-center justify-center py-3 mt-3 mb-4 rounded-full bg-black"
          onPress={handleSearch}
        >
          <Image
            source={icons.search}
            className="w-5 h-5 mr-2"
            resizeMode="contain"
            tintColor="#F3E3D3"
          />
          <Text className="font-montMedium text-primary">
            Search for "{searchQuery}"
          </Text>
        </TouchableOpacity>
      </View>
    );
  };
  
  // =========================================================================
  // MAIN RENDER
  // =========================================================================
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-primary">
      <StatusBar barStyle="dark-content" />
      
      {/* Search Header */}
      <View className="px-4 py-3 border-b border-black/10 bg-primary">
        <View className="flex-row items-center">
          {/* Back button - only visible when searching */}
          {!showExplore && (
            <TouchableOpacity 
              onPress={handleBackPress}
              className="mr-3"
            >
              <Image
                source={icons.backArrow}
                className="w-10 h-10"
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
          
          <View className={`flex-row items-center bg-white/50 rounded-full px-4 border-2 flex-1`}>
            <Image
              source={icons.search}
              className="w-8 h-8 mr-2"
              resizeMode="contain"
              tintColor="#000000"
            />
            <TextInput
              value={searchQuery}
              onChangeText={handleSearchChange}
              onSubmitEditing={handleSearch}
              onFocus={() => setShowRecentSearches(true)}
              placeholder="Search users and posts..."
              placeholderTextColor="#00000050"
              className="flex-1 text-lg py-3 font-montRegular"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Image
                  source={icons.cross}
                  className="w-5 h-5"
                  resizeMode="contain"
                  tintColor="#00000080"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      
      {/* Content Area */}
      {showExplore ? (
        // Show explore content when not searching
        <>
          {/* Only show recent searches if the search bar is focused */}
          {showRecentSearches && renderRecentSearches()}
          
          {/* Embedded Explore Page - now placed directly under search bar */}
          <ExplorePage />
        </>
      ) : (
        // Show search suggestions when typing
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          {/* Recent searches */}
          {renderRecentSearches()}
          
          {/* Autocomplete suggestions */}
          {renderAutocompleteSuggestions()}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default Search;