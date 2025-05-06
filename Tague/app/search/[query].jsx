/**
 * SearchResults.jsx - Search results screen
 * 
 * This component displays search results for queries entered by users.
 * It provides a tabbed interface to filter results by different categories
 * including users, posts, tags, and styles. The component handles privacy
 * filtering to ensure only public content is shown to non-followers.
 * 
 * Features:
 * - Tabbed navigation between All, Users, Posts, Tags, and Styles
 * - Privacy-aware filtering of search results
 * - Dynamic search result rendering based on active filter
 * - Expandable tag sections for detailed tag exploration
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { icons } from '../../constants/icons';
import { auth, db } from '../../backend/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

// Import tab components
import AllResults from '../../src/components/allResults';
import UserResults from '../../src/components/userResults';
import PostResults from '../../src/components/postResults';
import TagResults from '../../src/components/tagResults';
import StyleResults from '../../src/components/styleResults';

// Import search hooks
import useUserSearch from '../../src/hooks/useUserSearch';
import usePostSearch from '../../src/hooks/usePostSearch';
import useTagSearch from '../../src/hooks/useTagSearch';
import useStyleSearch from '../../src/hooks/useStyleSearch';

const SearchResults = () => {
  // STATE MANAGEMENT
  const params = useLocalSearchParams();
  const { query: encodedQuery, filter: initialFilter } = params;
  const searchQuery = encodedQuery ? decodeURIComponent(encodedQuery) : '';
  
  const [activeFilter, setActiveFilter] = useState(initialFilter || 'all');
  const [currentQuery, setCurrentQuery] = useState(searchQuery || '');
  const [searchInputQuery, setSearchInputQuery] = useState(searchQuery || '');
  
  // State for expandable tag posts section
  const [expandedTagInfo, setExpandedTagInfo] = useState(null);
  
  // Reference for horizontal scroll view
  const tabScrollViewRef = useRef(null);
  
  // Use custom hooks for search functionality
  const { users, isLoadingUsers } = useUserSearch(searchQuery);
  const { posts, isLoadingPosts } = usePostSearch(searchQuery);
  const { tags, isLoadingTags } = useTagSearch(searchQuery);
  const { styles, isLoadingStyles } = useStyleSearch(searchQuery);
  
  // Combined loading state
  const isLoading = isLoadingUsers || isLoadingPosts || isLoadingTags || isLoadingStyles;
  
  // Current user
  const currentUserId = auth.currentUser?.uid;
  
  // State for filtered results (public posts/users/tags/styles only)
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [filteredTags, setFilteredTags] = useState([]);
  const [filteredStyles, setFilteredStyles] = useState([]);
  
  // State to manage loading state of privacy filtering
  const [isFilteringData, setIsFilteringData] = useState(true);
  
  // LIFECYCLE HOOKS
  
  // Update search query when URL parameter changes
  useEffect(() => {
    if (searchQuery) {
      setCurrentQuery(searchQuery);
      setSearchInputQuery(searchQuery);
    }
  }, [searchQuery]);
  
  // Update active filter when navigation parameter changes
  useEffect(() => {
    if (initialFilter) {
      setActiveFilter(initialFilter);
    }
  }, [initialFilter]);
  
  // Filter data based on privacy settings
  useEffect(() => {
    const filterDataForPrivacy = async () => {
      setIsFilteringData(true);
      
      try {
        // Create a privacy cache to minimize database calls
        const privacyCache = new Map();
        
        // Helper function to check if a user is private
        const isUserPrivate = async (userId) => {
          if (privacyCache.has(userId)) {
            return privacyCache.get(userId);
          }
          
          try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
              const isPrivate = userDoc.data().isPrivate || false;
              privacyCache.set(userId, isPrivate);
              return isPrivate;
            }
            return false;
          } catch (error) {
            console.error("Error checking user privacy:", error);
            return false;
          }
        };
        
        // Filter users excluding current user
        const nonCurrentUsers = users.filter(user => user.id !== currentUserId);
        setFilteredUsers(nonCurrentUsers);
        
        // Filter posts excluding private accounts and current user
        const publicPosts = [];
        for (const post of posts) {
          if (post.userId === currentUserId) continue;
          
          const userPrivate = await isUserPrivate(post.userId);
          if (!userPrivate) {
            publicPosts.push(post);
          }
        }
        setFilteredPosts(publicPosts);
        
        // Filter tags to only include those with public posts
        const publicTags = [];
        for (const tagInfo of tags) {
          const publicTagPosts = [];
          
          for (const post of tagInfo.posts) {
            if (post.userId === currentUserId) continue;
            
            const userPrivate = await isUserPrivate(post.userId);
            if (!userPrivate) {
              publicTagPosts.push(post);
            }
          }
          
          if (publicTagPosts.length > 0) {
            publicTags.push({
              ...tagInfo,
              posts: publicTagPosts,
              publicPostCount: publicTagPosts.length
            });
          }
        }
        setFilteredTags(publicTags);
        
        // Filter styles to only include those with public posts
        const publicStyles = [];
        for (const styleInfo of styles) {
          const publicStylePosts = [];
          
          for (const post of styleInfo.posts) {
            if (post.userId === currentUserId) continue;
            
            const userPrivate = await isUserPrivate(post.userId);
            if (!userPrivate) {
              publicStylePosts.push(post);
            }
          }
          
          if (publicStylePosts.length > 0) {
            publicStyles.push({
              ...styleInfo,
              posts: publicStylePosts,
              publicPostCount: publicStylePosts.length
            });
          }
        }
        setFilteredStyles(publicStyles);
        
      } catch (error) {
        console.error("Error filtering data for privacy:", error);
        // Fallback to basic filtering if there's an error
        setFilteredUsers(users.filter(user => user.id !== currentUserId));
        setFilteredPosts(posts.filter(post => post.userId !== currentUserId));
        setFilteredTags(tags);
        setFilteredStyles(styles);
      } finally {
        setIsFilteringData(false);
      }
    };
    
    if (!isLoading && (users.length > 0 || posts.length > 0 || tags.length > 0 || styles.length > 0)) {
      filterDataForPrivacy();
    } else if (!isLoading) {
      // If no data or loading is complete, reset filtering state
      setIsFilteringData(false);
    }
  }, [isLoading, users, posts, tags, styles, currentUserId]);
  
  // NAVIGATION & UI FUNCTIONS
  
  // Handle search form submission
  const handleSearch = () => {
    if (searchInputQuery.trim() === '') return;
    
    // Update URL to reflect new search
    router.replace({
      pathname: '/search/[query]',
      params: { query: encodeURIComponent(searchInputQuery), filter: activeFilter }
    });
  };
  
  // Handle navigation back to previous screen
  const goBack = () => {
    try {
      router.back();
    } catch (error) {
      // Fallback if back navigation fails
      router.replace('/search');
    }
  };
  
  // Handle filter change
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    
    // Close any expanded tag section when switching tabs
    setExpandedTagInfo(null);
    
    // Scroll the tab into view if needed
    if (tabScrollViewRef.current) {
      const tabWidth = 120; // Approximate width of each tab
      const position = ['all', 'users', 'posts', 'tags', 'styles'].indexOf(filter);
      if (position >= 0) {
        tabScrollViewRef.current.scrollTo({ x: position * tabWidth, animated: true });
      }
    }
  };
  
  // Toggle expanded tag section
  const toggleTagExpansion = (tagInfo) => {
    // If the same tag is already expanded, collapse it
    if (expandedTagInfo && 
        expandedTagInfo.tag.brand === tagInfo.tag.brand && 
        expandedTagInfo.tag.productName === tagInfo.tag.productName) {
      setExpandedTagInfo(null);
    } else {
      // Otherwise expand the new tag and collapse any previously expanded one
      setExpandedTagInfo(tagInfo);
      // No auto-scrolling to prevent jarring UX
    }
  };
  
  // RENDER FUNCTIONS
  
  // Renders the content based on the active filter
  const renderContent = () => {
    // Show loading state if data is still loading or being filtered
    if (isLoading || isFilteringData) {
      return (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
          <Text className="mt-4 font-montRegular text-black/70">Searching...</Text>
        </View>
      );
    }
    
    // Switch content based on active filter
    switch (activeFilter) {
      case 'users':
        return (
          <UserResults 
            users={filteredUsers} 
            currentQuery={currentQuery} 
          />
        );
      case 'posts':
        return (
          <PostResults 
            posts={filteredPosts} 
            currentQuery={currentQuery} 
          />
        );
      case 'tags':
        return (
          <TagResults 
            tags={filteredTags} 
            currentQuery={currentQuery}
            expandedTagInfo={expandedTagInfo}
            toggleTagExpansion={toggleTagExpansion}
          />
        );
      case 'styles':
        return (
          <StyleResults 
            styles={filteredStyles} 
            currentQuery={currentQuery}
            setSearchInputQuery={setSearchInputQuery}
          />
        );
      default:
        // 'all' filter - show combined results
        return (
          <AllResults 
            users={filteredUsers}
            posts={filteredPosts}
            tags={filteredTags}
            styles={filteredStyles}
            currentQuery={currentQuery}
            expandedTagInfo={expandedTagInfo}
            toggleTagExpansion={toggleTagExpansion}
            handleFilterChange={handleFilterChange}
            setSearchInputQuery={setSearchInputQuery}
          />
        );
    }
  };
  
  // MAIN RENDER
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-primary">
      <StatusBar barStyle="dark-content" />
      
      {/* Search Header with Back Button */}
      <View className="flex-row items-center px-4 py-3 mr-3 border-b border-black/10">
        <TouchableOpacity onPress={goBack}>
          <Image
            source={icons.backArrow}
            className="w-10 h-10"
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-bregular text-4xl text-center">
            {searchInputQuery}
          </Text>
        </View>
      </View>
      
      {/* Filter Tabs - Horizontal Scrollable */}
      <View>
        <ScrollView 
          horizontal
          ref={tabScrollViewRef}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
          className="py-3 border-b border-black/10"
        >
          <TouchableOpacity
            className={`mx-2 rounded-full px-4 ${activeFilter === 'all' ? 'bg-black' : 'bg-[#E0E0D0] border border-black/20'}`}
            onPress={() => handleFilterChange('all')}
            style={{ height: 30, justifyContent: 'center' }}
          >
            <Text 
              className={`text-center font-montMedium ${activeFilter === 'all' ? 'text-primary' : 'text-black'}`}
            >
              All
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className={`mx-2 rounded-full px-4 ${activeFilter === 'users' ? 'bg-black' : 'bg-[#E0E0D0] border border-black/20'}`}
            onPress={() => handleFilterChange('users')}
            style={{ height: 30, justifyContent: 'center' }}
          >
            <Text 
              className={`text-center font-montMedium ${activeFilter === 'users' ? 'text-primary' : 'text-black'}`}
            >
              Users ({filteredUsers.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className={`mx-2 rounded-full px-4 ${activeFilter === 'posts' ? 'bg-black' : 'bg-[#E0E0D0] border border-black/20'}`}
            onPress={() => handleFilterChange('posts')}
            style={{ height: 30, justifyContent: 'center' }}
          >
            <Text 
              className={`text-center font-montMedium ${activeFilter === 'posts' ? 'text-primary' : 'text-black'}`}
            >
              Posts ({filteredPosts.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className={`mx-2 rounded-full px-4 ${activeFilter === 'tags' ? 'bg-black' : 'bg-[#E0E0D0] border border-black/20'}`}
            onPress={() => handleFilterChange('tags')}
            style={{ height: 30, justifyContent: 'center' }}
          >
            <Text 
              className={`text-center font-montMedium ${activeFilter === 'tags' ? 'text-primary' : 'text-black'}`}
            >
              Tags ({filteredTags.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className={`mx-2 rounded-full px-4 ${activeFilter === 'styles' ? 'bg-black' : 'bg-[#E0E0D0] border border-black/20'}`}
            onPress={() => handleFilterChange('styles')}
            style={{ height: 30, justifyContent: 'center' }}
          >
            <Text 
              className={`text-center font-montMedium ${activeFilter === 'styles' ? 'text-primary' : 'text-black'}`}
            >
              Styles ({filteredStyles.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      
      {/* Search Results Content */}
      <View className="flex-1">
        {renderContent()}
      </View>
    </SafeAreaView>
  );
};

export default SearchResults;