/**
 * ExplorePage.jsx - Explore page for discovering users' posts and styles
 * 
 * This component displays an explore page with two tabs:
 * - Explore: Shows a grid or scroll view of public posts from other users
 * - Styles: Shows a list of available fashion styles that can be followed
 * 
 * Features:
 * - Tabbed interface for Explore and Styles
 * - Toggle between grid and scroll view for posts
 * - Follow/unfollow styles functionality
 * - Image caching and performance optimisations
 * - Product tags display with SVG rendering
 * - Navigation to user profiles and post details
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  InteractionManager,
  Alert,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { collection, query, orderBy, getDocs, limit, doc, setDoc, getDoc, where, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import { serverTimestamp } from 'firebase/firestore';
import { OptimisedImage, preloadCommonImages, cacheImage } from '../optimisedImage';
import { SvgXml } from 'react-native-svg';
import ToggleSwitch from '../toggleSwitch';
import { LinearGradient } from 'expo-linear-gradient';
import { icons } from '../../constants/icons';

// Global image cache to persist across renders
const IMAGE_CACHE = new Set();

// Persistent cache for posts to avoid reloading
const POSTS_CACHE = {
  data: null,
  styles: null,
  timestamp: null
};

// Custom wrapper to optimize FlatList rendering
const MemoizedPostItem = React.memo(({ item, index, viewMode, renderGridItem, renderScrollItem }) => {
  return viewMode === 'grid' 
    ? renderGridItem({ item, index }) 
    : renderScrollItem({ item, index });
});

// Extract renderItem logic to stabilize function references
const createRenderItem = (viewMode, renderGridItem, renderScrollItem) => 
  ({ item, index }) => (
    <MemoizedPostItem 
      item={item} 
      index={index} 
      viewMode={viewMode} 
      renderGridItem={renderGridItem}
      renderScrollItem={renderScrollItem}
    />
  );

const ExplorePage = () => {
  // STATE MANAGEMENT
  const [posts, setPosts] = useState(POSTS_CACHE.data || []);
  const [styles, setStyles] = useState(POSTS_CACHE.styles || []);
  const [loading, setLoading] = useState(!POSTS_CACHE.data);
  const [stylesLoading, setStylesLoading] = useState(!POSTS_CACHE.styles);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'scroll'
  const [activeTab, setActiveTab] = useState('Explore'); // 'Explore' or 'Styles'
  const [renderedImages, setRenderedImages] = useState(IMAGE_CACHE);
  const [followingStatus, setFollowingStatus] = useState({});
  const [processingFollow, setProcessingFollow] = useState(null);
  
  // Track mounted state
  const isMounted = useRef(true);
  
  // Get current user ID
  const currentUserId = auth.currentUser?.uid;
  
  // Calculate dimensions for the grid
  const screenWidth = Dimensions.get('window').width;
  const itemWidth = (screenWidth - 32) / 3; // 32 accounts for horizontal padding and gaps
  
  // Maintain reference to FlatList
  const flatListRef = useRef(null);
  
  // Track visible post range for optimization
  const visibleRange = useRef({ start: 0, end: 20 });
  
  // LIFECYCLE HOOKS
  
  // Effect to initialise component and fetch data if needed
  useEffect(() => {
    // Reset state when component mounts
    isMounted.current = true;
    
    // Only fetch if cache is invalid or expired (older than 5 minutes)
    const cacheAge = POSTS_CACHE.timestamp ? (Date.now() - POSTS_CACHE.timestamp) : Infinity;
    const shouldFetch = !POSTS_CACHE.data || cacheAge > 5 * 60 * 1000;
    
    if (shouldFetch) {
      fetchPosts();
    } else {
      // Use cached data and pre-cache images in the background
      const filteredPosts = POSTS_CACHE.data.filter(post => post.userId !== currentUserId);
      setPosts(filteredPosts);
      setStyles(POSTS_CACHE.styles || []);
      
      const visiblePosts = filteredPosts.slice(0, 20);
      InteractionManager.runAfterInteractions(() => {
        const imagesToPreCache = visiblePosts
          .filter(post => post.imageUrl)
          .map(post => post.imageUrl);
          
        imagesToPreCache.forEach(url => {
          if (url) {
            cacheImage(url).then(() => {
              if (isMounted.current) {
                setRenderedImages(prev => {
                  const newSet = new Set(prev);
                  newSet.add(url);
                  // Update the global cache
                  IMAGE_CACHE.add(url);
                  return newSet;
                });
              }
            }).catch(() => {});
          }
        });
      });
    }
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [currentUserId]);
  
  // Effect to fetch styles when tab changes to Styles
  useEffect(() => {
    if (activeTab === 'Styles' && (!POSTS_CACHE.styles || styles.length === 0)) {
      fetchStyles();
    }
  }, [activeTab]);
  
  // DATA FETCHING
  
  // Fetches posts for the explore page with privacy filtering
  const fetchPosts = async () => {
    if (!isMounted.current) return;
    setLoading(true);
    
    try {
      // Get a list of public accounts
      const usersRef = collection(db, "users");
      const usersQuery = query(usersRef);
      const usersSnapshot = await getDocs(usersQuery);
      
      // Create a Set of public user IDs
      const publicUserIds = new Set();
      
      // Process all users to determine which ones are public
      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        // Skip the current user
        if (userId === currentUserId) return;
        
        // If account is public, add to visible users
        if (!userData.isPrivate) {
          publicUserIds.add(userId);
        }
      });
      
      // Now fetch posts only from public users
      const postsRef = collection(db, "posts");
      
      // Query that excludes the current user's posts
      const q = query(
        postsRef,
        where("userId", "!=", currentUserId),
        orderBy("userId"), // Required for inequality filters
        orderBy("createdAt", "desc"),
        limit(60) // Fetch a substantial number of posts for exploration
      );
      
      const querySnapshot = await getDocs(q);
      
      // Process in batches to avoid UI blocking
      const fetchedPosts = [];
      const userInfoMap = new Map(); // Cache user data to avoid duplicate fetches
      
      for (const docSnapshot of querySnapshot.docs) {
        const postData = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Only include posts from public users
        if (postData.userId && publicUserIds.has(postData.userId)) {
          fetchedPosts.push(postData);
        }
      }
      
      // Batch fetch user data for all posts
      const uniqueUserIds = [...new Set(fetchedPosts.map(post => post.userId).filter(Boolean))];
      
      // Fetch users in batches of 10
      for (let i = 0; i < uniqueUserIds.length; i += 10) {
        const batchUserIds = uniqueUserIds.slice(i, i + 10);
        
        const userPromises = batchUserIds.map(async userId => {
          try {
            const userDocRef = await getDoc(doc(db, "users", userId));
            return {
              userId,
              userData: userDocRef.exists() ? userDocRef.data() : { displayName: "Unknown", photoURL: null }
            };
          } catch (error) {
            console.error(`Error fetching user ${userId}:`, error);
            return {
              userId,
              userData: { displayName: "Unknown", photoURL: null }
            };
          }
        });
        
        const usersData = await Promise.all(userPromises);
        
        // Add users to the map
        usersData.forEach(({ userId, userData }) => {
          userInfoMap.set(userId, userData);
        });
        
        // Give UI thread a break every batch
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Enrich posts with user data
      const enrichedPosts = fetchedPosts.map(post => ({
        ...post,
        userDisplayName: post.userId && userInfoMap.has(post.userId) 
          ? userInfoMap.get(post.userId).displayName 
          : "Unknown",
        userPhotoURL: post.userId && userInfoMap.has(post.userId) 
          ? userInfoMap.get(post.userId).photoURL 
          : null
      }));
      
      if (isMounted.current) {
        // Update posts state
        setPosts(enrichedPosts);
        
        // Update cache with all posts (including current user's, which we'll filter out in the UI)
        POSTS_CACHE.data = enrichedPosts;
        POSTS_CACHE.timestamp = Date.now();
        
        // Start preloading visible images
        InteractionManager.runAfterInteractions(() => {
          const visiblePosts = enrichedPosts.slice(0, 12);
          const imagesToPreCache = visiblePosts
            .filter(post => post.imageUrl)
            .map(post => post.imageUrl);
            
          imagesToPreCache.forEach(url => {
            if (url) {
              cacheImage(url).then(() => {
                if (isMounted.current) {
                  setRenderedImages(prev => {
                    const newSet = new Set(prev);
                    newSet.add(url);
                    // Update the global cache
                    IMAGE_CACHE.add(url);
                    return newSet;
                  });
                }
              }).catch(() => {});
            }
          });
          
          // Also preload user photos
          visiblePosts
            .filter(post => post.userPhotoURL)
            .forEach(post => {
              if (post.userPhotoURL) {
                cacheImage(post.userPhotoURL).then(() => {
                  if (isMounted.current) {
                    setRenderedImages(prev => {
                      const newSet = new Set(prev);
                      newSet.add(post.userPhotoURL);
                      // Update the global cache
                      IMAGE_CACHE.add(post.userPhotoURL);
                      return newSet;
                    });
                  }
                }).catch(() => {});
              }
            });
        });
      }
    } catch (error) {
      console.error("Error fetching explore posts:", error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };
  
  // Fetches all available styles for the Styles tab
  const fetchStyles = async () => {
    if (!isMounted.current) return;
    setStylesLoading(true);
    
    try {
      // Get current user's followed styles to determine follow status
      let currentUserFollowedStyles = [];
      if (currentUserId) {
        const currentUserDoc = await getDoc(doc(db, "users", currentUserId));
        if (currentUserDoc.exists()) {
          currentUserFollowedStyles = currentUserDoc.data().followedStyles || [];
        }
      }
      
      // Fetch all styles from the styles collection
      const stylesRef = collection(db, "styles");
      const q = query(
        stylesRef,
        orderBy("style") // Order alphabetically
      );
      
      const querySnapshot = await getDocs(q);
      
      // Process styles
      const fetchedStyles = [];
      const followStatus = {};
      
      // First, get styles from the styles collection
      querySnapshot.docs.forEach(docSnapshot => {
        const styleData = { id: docSnapshot.id, ...docSnapshot.data() };
        fetchedStyles.push(styleData);
        
        // Set the following status for this style
        followStatus[styleData.style] = currentUserFollowedStyles.includes(styleData.style);
      });
      
      // Then, collect unique styles from posts if they don't exist in the styles collection
      const postsRef = collection(db, "posts");
      const postsQuery = query(
        postsRef,
        limit(200) // Limit to a reasonable number
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      
      // Create a Set of style names that already exist
      const existingStyles = new Set(fetchedStyles.map(style => style.style));
      
      // Extract unique styles from posts
      postsSnapshot.docs.forEach(docSnapshot => {
        const postData = docSnapshot.data();
        if (postData.styles && Array.isArray(postData.styles)) {
          postData.styles.forEach(styleName => {
            if (!existingStyles.has(styleName)) {
              fetchedStyles.push({
                style: styleName,
                followers: [],
                followersCount: 0
              });
              existingStyles.add(styleName);
              
              // Set the following status for this style
              followStatus[styleName] = currentUserFollowedStyles.includes(styleName);
            }
          });
        }
      });
      
      // Sort alphabetically
      fetchedStyles.sort((a, b) => a.style.localeCompare(b.style));
      
      if (isMounted.current) {
        setStyles(fetchedStyles);
        setFollowingStatus(followStatus);
        
        // Update cache
        POSTS_CACHE.styles = fetchedStyles;
      }
    } catch (error) {
      console.error("Error fetching styles:", error);
    } finally {
      if (isMounted.current) {
        setStylesLoading(false);
        setRefreshing(false);
      }
    }
  };
  
  // Handle refresh action
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    
    // Force a fresh fetch
    POSTS_CACHE.timestamp = null;
    
    if (activeTab === 'Explore') {
      fetchPosts();
    } else {
      fetchStyles();
    }
  }, [activeTab]);
  
  // Handle toggle view mode with performance optimisations
  const handleToggleViewMode = useCallback(() => {
    const newMode = viewMode === 'grid' ? 'scroll' : 'grid';
    
    // Schedule view mode change after current interactions
    InteractionManager.runAfterInteractions(() => {
      if (isMounted.current) {
        setViewMode(newMode);
        
        // Scroll to top when switching modes
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({ offset: 0, animated: false });
        }
      }
    });
  }, [viewMode]);
  
  // STYLES TAB FUNCTIONS
  
  // Navigate to style search results
  const handleViewStyle = (styleName) => {
    // Navigate to search results with the style name as query and filter set to styles
    router.push({
      pathname: '/search/[query]',
      params: { 
        query: encodeURIComponent(styleName), 
        filter: 'styles' 
      }
    });
  };
  
  // Handle following/unfollowing a style
  const handleFollowAction = async (styleName) => {
    if (!currentUserId) {
      Alert.alert("Sign In Required", "You must be signed in to follow styles.");
      return;
    }
    
    setProcessingFollow(styleName);
    
    try {
      const isFollowing = followingStatus[styleName];
      const currentUserRef = doc(db, "users", currentUserId);
      
      // Use the styleName as the document ID in Firestore
      const styleRef = doc(db, "styles", styleName);
      const styleDoc = await getDoc(styleRef);
      
      if (isFollowing) {
        // Unfollow
        await updateDoc(currentUserRef, {
          followedStyles: arrayRemove(styleName)
        });
        
        if (styleDoc.exists()) {
          await updateDoc(styleRef, {
            followers: arrayRemove(currentUserId)
          });
        }
        
        // Update local state
        setFollowingStatus(prev => ({
          ...prev,
          [styleName]: false
        }));
      } else {
        // Follow
        await updateDoc(currentUserRef, {
          followedStyles: arrayUnion(styleName)
        });
        
        if (!styleDoc.exists()) {
          // Create a new style document
          await setDoc(styleRef, {
            style: styleName,
            followers: [currentUserId],
            createdAt: serverTimestamp()
          });
        } else {
          await updateDoc(styleRef, {
            followers: arrayUnion(currentUserId)
          });
        }
        
        // Update local state
        setFollowingStatus(prev => ({
          ...prev,
          [styleName]: true
        }));
      }
    } catch (error) {
      console.error("Error updating style follow status:", error);
      Alert.alert("Error", "Failed to update follow status. Please try again.");
    } finally {
      setProcessingFollow(null);
    }
  };
  
  // SCROLL PERFORMANCE OPTIMISATIONS
  
  // Handle visible items change to optimize rendering
  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length === 0) return;
    
    // Update visible range
    const visibleIndices = viewableItems.map(item => item.index).filter(index => index !== null);
    if (visibleIndices.length > 0) {
      visibleRange.current = {
        start: Math.min(...visibleIndices),
        end: Math.max(...visibleIndices)
      };
    }
    
    // Track which image URLs have been rendered and pre-cache them
    const newImages = [];
    viewableItems.forEach(viewable => {
      if (viewable.item) {
        // Cache post image
        if (viewable.item.imageUrl && !renderedImages.has(viewable.item.imageUrl)) {
          newImages.push(viewable.item.imageUrl);
          cacheImage(viewable.item.imageUrl).catch(() => {});
        }
        
        // Cache user photo when in scroll view
        if (viewMode === 'scroll' && viewable.item.userPhotoURL && !renderedImages.has(viewable.item.userPhotoURL)) {
          newImages.push(viewable.item.userPhotoURL);
          cacheImage(viewable.item.userPhotoURL).catch(() => {});
        }
        
        // Pre-cache next batch of images
        const preloadIndex = viewable.index + 6; // Look ahead 6 items
        if (preloadIndex < posts.length && posts[preloadIndex]) {
          if (posts[preloadIndex].imageUrl && !renderedImages.has(posts[preloadIndex].imageUrl)) {
            newImages.push(posts[preloadIndex].imageUrl);
            cacheImage(posts[preloadIndex].imageUrl).catch(() => {});
          }
          
          if (viewMode === 'scroll' && posts[preloadIndex].userPhotoURL && !renderedImages.has(posts[preloadIndex].userPhotoURL)) {
            newImages.push(posts[preloadIndex].userPhotoURL);
            cacheImage(posts[preloadIndex].userPhotoURL).catch(() => {});
          }
        }
      }
    });
    
    // Update rendered images set if there are new images
    if (newImages.length > 0) {
      setRenderedImages(prev => {
        const newSet = new Set(prev);
        newImages.forEach(url => {
          if (url) {
            newSet.add(url);
            // Update the global cache
            IMAGE_CACHE.add(url);
          }
        });
        return newSet;
      });
    }
  }, [renderedImages, posts, viewMode]);
  
  // Configure viewability
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 20,
    minimumViewTime: 300,
  }), []);
  
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged: handleViewableItemsChanged }
  ]);
  
  // SVG GENERATORS FOR PRODUCT TAGS

  // Creates an SVG for a tag positioned on the left side
  const createLeftTagSvg = useCallback((tag) => {
    const truncateText = (text, maxLength) => {
      if (!text) return "";
      return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
    };
    
    const truncatedBrand = truncateText(tag.brand, 15);
    const truncatedProduct = truncateText(tag.productName, 18);
    const displayPrice = tag.price ? tag.price : "PRICE";
    
    return `
    <svg width="304" height="97" viewBox="0 0 304 97" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Direct connecting line -->
      <line x1="275" y1="44.5" x2="440" y2="44.5" stroke="black" stroke-width="2"/>
      
      <!-- Tag shape -->
      <path fill-rule="evenodd" clip-rule="evenodd" d="M273.137 21.6013C274.54 22.924 275.336 24.7672 275.336 26.6958L275.336 65.1027C275.336 67.0313 274.54 68.8745 273.137 70.1972L255.517 86.8003C254.218 88.0242 252.501 88.7058 250.716 88.7058L11.0003 88.7058C7.13431 88.7058 4.00031 85.5718 4.00031 81.7058L4.00031 8.73923C4.00031 4.87324 7.13432 1.73923 11.0003 1.73923L252.8 1.73926C253.05 1.73926 253.171 2.04431 252.989 2.21541C252.874 2.3242 252.874 2.50775 252.989 2.61654L273.137 21.6013ZM260.569 38.2652C256.492 38.2652 253.186 41.3801 253.186 45.2225C253.186 49.065 256.492 52.1799 260.569 52.1799C264.647 52.1799 267.953 49.065 267.953 45.2225C267.953 41.3801 264.647 38.2652 260.569 38.2652Z" fill="black"/>
      
      <!-- Rectangle inside tag -->
      <rect x="233.592" y="80.009" width="189.587" height="69.5732" rx="5" transform="rotate(-180 233.592 80.009)" fill="#F3E3D3"/>
      
      <!-- Barcode elements -->
      <path d="M53.6377 68.8608L53.6377 66.5417L72.1906 66.5417L72.1906 68.8608L53.6377 68.8608ZM53.6377 64.2226L53.6377 61.9035L72.1906 61.9035L72.1906 64.2226L53.6377 64.2226ZM53.6377 60.744L53.6377 57.2653L72.1906 57.2653L72.1906 60.744L53.6377 60.744ZM53.6377 56.1057L53.6377 53.7866L72.1906 53.7866L72.1906 56.1057L53.6377 56.1057ZM53.6377 52.6271L53.6377 50.308L72.1906 50.308L72.1906 52.6271L53.6377 52.6271ZM53.6377 49.1484L53.6377 45.6698L72.1906 45.6698L72.1906 49.1484L53.6377 49.1484Z" fill="black"/>
      <path d="M53.6377 44.5103L53.6377 42.1911L72.1906 42.1911L72.1906 44.5103L53.6377 44.5103ZM53.6377 39.872L53.6377 37.5529L72.1906 37.5529L72.1906 39.872L53.6377 39.872ZM53.6377 36.3934L53.6377 32.9147L72.1906 32.9147L72.1906 36.3934L53.6377 36.3934ZM53.6377 31.7552L53.6377 29.4361L72.1906 29.4361L72.1906 31.7552L53.6377 31.7552ZM53.6377 28.2765L53.6377 25.9574L72.1906 25.9574L72.1906 28.2765L53.6377 28.2765ZM53.6377 24.7978L53.6377 21.3192L72.1906 21.3192L72.1906 24.7978L53.6377 24.7978Z" fill="black"/>
      
      <!-- Vertical divider line -->
      <line x1="35.0581" y1="86.9666" x2="35.0581" y2="-2.18557e-08" stroke="#F3E3D3" stroke-width="2" stroke-dasharray="3 3"/>
      
      <!-- Brand text -->
      <text x="145" y="40" font-family="BebasNeue" font-size="30" text-anchor="middle" fill="black">${truncatedBrand}</text>
      
      <!-- Product name text -->
      <text x="145" y="70" font-family="BebasNeue" font-size="22" text-anchor="middle" fill="black">${truncatedProduct}</text>
      
      <!-- Price text (rotated) -->
      <text transform="translate(13 45) rotate(90)" font-family="BebasNeue" font-size="22" font-weight="bold" text-anchor="middle" fill="#F3E3D3">${displayPrice}</text>
    </svg>
    `;
  }, []);
  
  // Creates an SVG for a tag positioned on the right side
  const createRightTagSvg = useCallback((tag) => {
    const truncateText = (text, maxLength) => {
      if (!text) return "";
      return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
    };
    
    const truncatedBrand = truncateText(tag.brand, 15);
    const truncatedProduct = truncateText(tag.productName, 18);
    const displayPrice = tag.price ? "£" + tag.price : "PRICE";
    
    return `
      <svg width="305" height="95" viewBox="140 0 305 95" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Direct line without filter -->
        <line x1="4" y1="42.5" x2="169" y2="42.5" stroke="black" stroke-width="2"/>
        
        <!-- Tag shape without filter -->
        <path fill-rule="evenodd" clip-rule="evenodd" d="M171.199 67.1045C169.796 65.7818 169 63.9386 169 62.01V23.6031C169 21.6745 169.796 19.8313 171.199 18.5086L188.819 1.90548C190.118 0.681602 191.835 0 193.62 0H433.336C437.202 0 440.336 3.13401 440.336 7V79.9666C440.336 83.8325 437.202 86.9666 433.336 86.9666H191.535C191.286 86.9666 191.165 86.6615 191.346 86.4904C191.462 86.3816 191.462 86.1981 191.346 86.0893L171.199 67.1045ZM183.767 50.4406C187.844 50.4406 191.15 47.3257 191.15 43.4833C191.15 39.6409 187.844 36.526 183.767 36.526C179.689 36.526 176.383 39.6409 176.383 43.4833C176.383 47.3257 179.689 50.4406 183.767 50.4406Z" fill="black"/>
        
        <rect x="210.744" y="8.69666" width="189.587" height="69.5732" rx="5" fill="#F3E3D3"/>
        <path d="M371.922 68.9935L371.922 66.6744L390.475 66.6744L390.475 68.9935L371.922 68.9935ZM371.922 64.3553L371.922 62.0362L390.475 62.0362L390.475 64.3553L371.922 64.3553ZM371.922 60.8767L371.922 57.398L390.475 57.398L390.475 60.8767L371.922 60.8767ZM371.922 56.2384L371.922 53.9193L390.475 53.9193L390.475 56.2384L371.922 56.2384ZM371.922 52.7598L371.922 50.4407L390.475 50.4407L390.475 52.7598L371.922 52.7598ZM371.922 49.2811L371.922 45.8025L390.475 45.8024L390.475 49.2811L371.922 49.2811Z" fill="black"/>
        <path d="M371.922 44.6429L371.922 42.3238L390.475 42.3238L390.475 44.6429L371.922 44.6429ZM371.922 40.0047L371.922 37.6856L390.475 37.6856L390.475 40.0047L371.922 40.0047ZM371.922 36.5261L371.922 33.0474L390.475 33.0474L390.475 36.5261L371.922 36.5261ZM371.922 31.8878L371.922 29.5687L390.475 29.5687L390.475 31.8878L371.922 31.8878ZM371.922 28.4092L371.922 26.0901L390.475 26.0901L390.475 28.4092L371.922 28.4092ZM371.922 24.9305L371.922 21.4519L390.475 21.4519L390.475 24.9305L371.922 24.9305Z" fill="black"/>
        <line x1="409.278" y1="1.73938" x2="409.278" y2="88.7059" stroke="#F3E3D3" stroke-width="2" stroke-dasharray="3 3"/>
        
        <!-- Brand text -->
        <text x="300" y="40" font-family="BebasNeue" font-size="30" text-anchor="middle" fill="black">${truncatedBrand}</text>
        
        <!-- Product name text -->
        <text x="300" y="70" font-family="BebasNeue" font-size="22" text-anchor="middle" fill="black">${truncatedProduct}</text>
        
        <!-- Price text (rotated) -->
        <text transform="translate(430 45) rotate(-90)" font-family="BebasNeue" font-size="22" font-weight="bold" text-anchor="middle" fill="#F3E3D3">${displayPrice}</text>
      </svg>
    `;
  }, []);

  // RENDER FUNCTIONS
  
  // Renders a post item in the grid view
  const renderGridItem = useCallback(({ item }) => {
    return (
      <TouchableOpacity
        className="overflow-hidden rounded-lg border-2 border-black mb-2"
        style={{ width: itemWidth, height: itemWidth * 4/3, margin: 2 }} // 3:4 aspect ratio
        activeOpacity={0.8}
        onPress={() => {
          router.push({
            pathname: '../profileScreens/viewUserPost',
            params: { postId: item.id }
          });
        }}
      >
        <OptimisedImage
          source={{ uri: item.imageUrl }}
          className="w-full h-full"
          resizeMode="cover"
          lowQualityFirst={true}
          priority="high"
          // Avoid loading indicator for already rendered images
          showLoadingIndicator={!renderedImages.has(item.imageUrl)}
        />
      </TouchableOpacity>
    );
  }, [itemWidth, renderedImages]);
  
  // Renders a post item in the scroll view (similar to Home feed)
  const renderScrollItem = useCallback(({ item, index }) => {
    // Create a touchable component for navigating to user profile
    const UserProfileLink = () => (
      <TouchableOpacity 
        className="flex-row items-center"
        onPress={() => {
          if (item.userId !== auth.currentUser?.uid) {
            router.push({
              pathname: '../profileScreens/userProfile',
              params: { userId: item.userId }
            });
          } else {
            // If it's the current user, navigate to their profile
            router.push('/profile');
          }
        }}
      >
        <Image 
          source={item.userPhotoURL ? { uri: item.userPhotoURL } : require('../../assets/images/profilepic.png')}
          className="w-14 h-14 rounded-full mr-3 border-2 border-black"
          resizeMode="cover"
          // Avoid loading indicator for already loaded user photos
          showLoadingIndicator={item.userPhotoURL && !renderedImages.has(item.userPhotoURL)}
        />
        <Text className="text-black font-montSemiBold">{item.userDisplayName}</Text>
      </TouchableOpacity>
    );
  
    // Create a touchable wrapper to view the post details
    const PostWrapper = ({ children }) => (
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={() => router.push({
          pathname: '../profileScreens/viewUserPost',
          params: { postId: item.id }
        })}
      >
        {children}
      </TouchableOpacity>
    );
    
    // For posts with tags - use alternating layout style
    const isEvenIndex = index % 2 === 0;
    const imageOnLeft = isEvenIndex;
    
    return (
      <View className="bg-[#E0C9B2] p-4 rounded-xl border-4 border-black shadow-sm mb-6">
        {/* Post Header with User Info */}
        <View className="flex-row items-center mb-3">
          <UserProfileLink />
        </View>
        
        {/* Alternating layout for image and tags */}
        <PostWrapper>
          <View className="flex-row justify-between">
            {imageOnLeft ? (
              // Image on left, tags on right layout
              <>
                {/* Image on left */}
                <View className="w-[50%] aspect-[3/4] rounded-lg overflow-hidden border-black border-4">
                  <OptimisedImage
                    source={{ uri: item.imageUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                    lowQualityFirst={true}
                    priority="normal"
                    showLoadingIndicator={!renderedImages.has(item.imageUrl)}
                  />
                  
                  {/* Markers on image - circular dots indicating tagged items */}
                  {item.tags && item.tags.map((tag, tagIndex) => {
                    const position = tag.position || {};
                    const relativeX = position.relativeX || 0;
                    const relativeY = position.relativeY || 0;
                    
                    return (
                      <View
                        key={tagIndex}
                        className="absolute w-[15px] h-[15px] rounded-full border border-black"
                        style={{
                          backgroundColor: tag.color || '#F3E3D3',
                          left: `${relativeX * 100}%`,
                          top: `${relativeY * 100}%`,
                          marginLeft: -12.5,
                          marginTop: -12.5,
                        }}
                      />
                    );
                  })}
                </View>
                
                {/* Tags on right */}
                <View className="w-[50%]">
                  {item.tags && item.tags.map((tag, tagIndex) => {
                    const position = tag.position || {};
                    const relativeY = position.relativeY || 0;
                    
                    // Position the tag at the same height as its marker
                    return (
                      <View 
                        key={tagIndex} 
                        style={{
                          position: 'absolute',
                          top: `${relativeY * 100}%`,
                          width: '100%',
                          height: 97,
                          marginTop: -50, // Center the connecting line with the marker
                        }}
                      >
                        <SvgXml xml={createRightTagSvg(tag)} width="100%" height="100%" />
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              // Tags on left, image on right layout
              <>
                {/* Tags on left */}
                <View className="w-[50%]">
                  {item.tags && item.tags.map((tag, tagIndex) => {
                    const position = tag.position || {};
                    const relativeY = position.relativeY || 0;
                    
                    // Position the tag at the same height as its marker
                    return (
                      <View 
                        key={tagIndex} 
                        style={{
                          position: 'absolute',
                          top: `${relativeY * 100}%`,
                          width: '100%',
                          height: 95,
                          marginTop: -50, // Center the connecting line with the marker
                        }}
                      >
                        <SvgXml xml={createLeftTagSvg(tag)} width="100%" height="100%" />
                      </View>
                    );
                  })}
                </View>
                
                {/* Image on right */}
                <View className="w-[50%] aspect-[3/4] rounded-lg overflow-hidden border-black border-4">
                  <OptimisedImage
                    source={{ uri: item.imageUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                    lowQualityFirst={true}
                    priority="normal"
                    showLoadingIndicator={!renderedImages.has(item.imageUrl)}
                  />
                  
                  {/* Markers on image - circular dots indicating tagged items */}
                  {item.tags && item.tags.map((tag, tagIndex) => {
                    const position = tag.position || {};
                    const relativeX = position.relativeX || 0;
                    const relativeY = position.relativeY || 0;
                    
                    return (
                      <View
                        key={tagIndex}
                        className="absolute w-[15px] h-[15px] rounded-full border border-black"
                        style={{
                          backgroundColor: tag.color || '#F3E3D3',
                          left: `${relativeX * 100}%`,
                          top: `${relativeY * 100}%`,
                          marginLeft: -12.5,
                          marginTop: -12.5,
                        }}
                      />
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </PostWrapper>
        
        <View className={`mt-10 pt-2 } ${item.caption? 'rounded-full border-2 border-black bg-primary flex-row justify-center items-center': ''}`}>
          {/* Caption */}
          {item.caption && (
            <Text className="text-center font-montMedium mb-3">{item.caption}</Text>
          )}
        </View>
        
        {/* Style Tags */}
        {item.styles && item.styles.length > 0 && (
          <View className="flex-row flex-wrap mt-2 justify-center">
            {item.styles.map((style, styleIndex) => (
              <TouchableOpacity 
                key={styleIndex}
                onPress={() => handleViewStyle(style)}
                className="bg-black/10 px-3 py-1 rounded-full mr-2 mb-2"
              >
                <Text className="text-black/70 font-montRegular text-sm">{style}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }, [createLeftTagSvg, createRightTagSvg, renderedImages, handleViewStyle]);
  
  // STYLES TAB RENDER FUNCTIONS
  
  // Renders a style item in the styles list
  const renderStyleItem = useCallback(({ item }) => {
    const styleName = item.style;
    const isProcessing = processingFollow === styleName;
    const isFollowing = followingStatus[styleName] || false;
    
    return (
      <TouchableOpacity 
        onPress={() => handleViewStyle(styleName)}
        className="flex-row items-center p-4 m-2"
      >
        <LinearGradient
          colors={['#F3E3D3', '#E0C9B2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 8 }}
        /> 
        {/* Hashtag Icon */}
        <View className="mr-4 w-16 h-16 rounded-full bg-white/50 items-center justify-center border-2 border-black">
          <Image
            source={icons.hashtag}
            className="w-8 h-8"
            resizeMode="contain"
            tintColor="#000000"
          />
        </View>
        <View className="flex-1">
          <Text className="text-2xl font-bregular text-black">
            {styleName}
          </Text>
          {item.followersCount > 0 && (
            <Text className="text-sm font-montRegular text-black/70">
              {item.followersCount} {item.followersCount === 1 ? 'follower' : 'followers'}
            </Text>
          )}
        </View>

        {/* Follow/Following button */}
        {currentUserId && (
          <TouchableOpacity
            onPress={() => handleFollowAction(styleName)}
            disabled={isProcessing}
            className={`py-2 px-4 rounded-full items-center justify-center ${
              isFollowing 
                ? 'bg-primary border-black border' 
                : 'bg-black'
            }`}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={isFollowing ? "#000000" : "#F3E3D3"} />
            ) : (
              <Text className={`font-montMedium text-sm ${
                isFollowing ? 'text-black' : 'text-primary'
              }`}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }, [followingStatus, processingFollow, currentUserId, handleViewStyle, handleFollowAction]);
  
  // Create a stable renderItem function
  const renderItem = useMemo(() => 
    createRenderItem(viewMode, renderGridItem, renderScrollItem),
  [viewMode, renderGridItem, renderScrollItem]);
  
  // Render placeholder item when loading
  const renderPlaceholderItem = useCallback(({ index }) => {
    return (
      <View
        className="rounded-lg border-2 border-black/30 mb-2 bg-gray-200"
        style={{ 
          width: itemWidth, 
          height: itemWidth * 4/3, 
          margin: 2,
          opacity: 0.7 - (index * 0.05) // Fading effect for placeholders
        }}
      />
    );
  }, [itemWidth]);
  
  // Create placeholder data for loading state
  const placeholderData = useMemo(() => 
    Array(12).fill(0).map((_, index) => ({ id: `placeholder-${index}` })),
  []);
  
  // Render placeholder styles when loading
  const renderPlaceholderStyles = useCallback(() => {
    return Array(8).fill(0).map((_, index) => (
      <View key={`style-placeholder-${index}`} className="flex-row items-center p-4 m-2">
        <LinearGradient
          colors={['#F3E3D3', '#E0C9B2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 8, opacity: 0.5 }}
        />
        <View className="mr-4 w-16 h-16 rounded-full bg-white/30 items-center justify-center" />
        <View className="flex-1">
          <View className="w-32 h-6 bg-white/40 rounded mb-2" />
          <View className="w-20 h-4 bg-white/30 rounded" />
        </View>
        <View className="py-2 px-4 rounded-full bg-black/20 w-20 h-8" />
      </View>
    ));
  }, []);
  
  // FlatList getItemLayout for grid view
  const getItemLayout = useMemo(() => (
    (data, index) => ({
      length: itemWidth * 4/3 + 4, // height + margin
      offset: (itemWidth * 4/3 + 4) * Math.floor(index / 3),
      index,
    })
  ), [itemWidth]);
  
  // MAIN RENDER
  return (
    <View className="flex-1 bg-primary">
      {/* Tab Navigation */}
      <View className="flex-row justify-center border-b border-black/10 pb-1">
        <TouchableOpacity
          className={`px-6 py-2 ${activeTab === 'Explore' ? 'border-b-2 border-black' : ''}`}
          onPress={() => setActiveTab('Explore')}
        >
          <Text className={`text-lg font-montSemiBold ${activeTab === 'Explore' ? 'text-black' : 'text-black/60'}`}>
            Explore
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`px-6 py-2 ${activeTab === 'Styles' ? 'border-b-2 border-black' : ''}`}
          onPress={() => setActiveTab('Styles')}
        >
          <Text className={`text-lg font-montSemiBold ${activeTab === 'Styles' ? 'text-black' : 'text-black/60'}`}>
            Styles
          </Text>
        </TouchableOpacity>
      </View>
      
      {activeTab === 'Styles' ? (
        // Render Styles tab content
        <View className="flex-1">
          {stylesLoading ? (
            // Loading placeholder for styles
            <View className="flex-1 pt-2">
              <ScrollView showsVerticalScrollIndicator={false}>
                {renderPlaceholderStyles()}
              </ScrollView>
            </View>
          ) : (
            // Styles list
            <FlatList
              data={styles}
              renderItem={renderStyleItem}
              keyExtractor={(item, index) => `style-${item.style}-${index}`}
              contentContainerStyle={{ padding: 8 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#000000"
                  colors={["#000000"]}
                />
              }
              ListEmptyComponent={
                <View className="flex-1 justify-center items-center p-6 mt-10">
                  <Text className="text-lg font-montMedium text-black/70 text-center">
                    No styles found
                  </Text>
                  <Text className="mt-3 text-base font-montRegular text-black/60 text-center">
                    We couldn't find any styles. Check back later!
                  </Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      ) : (
        // Render Explore tab content
        <>
          {/* View Mode Toggle */}
          <View className="flex-row justify-center items-center py-3 border-b border-black/10">
            <ToggleSwitch
              value={viewMode === 'scroll'}
              onToggle={handleToggleViewMode}
              leftLabel="Grid View"
              rightLabel="Scroll View"
            />
          </View>
          
          {loading && !refreshing ? (
            // Loading state with placeholder grid
            <View className="flex-1 pt-2">
              <FlatList
                data={placeholderData}
                renderItem={renderPlaceholderItem}
                keyExtractor={(item) => item.id}
                numColumns={3}
                contentContainerStyle={{ padding: 12 }}
                ListHeaderComponent={
                  <View className="items-center justify-center py-6">
                    <ActivityIndicator size="large" color="#000" />
                    <Text className="mt-4 font-montRegular text-black/70">Loading explore feed...</Text>
                  </View>
                }
              />
            </View>
          ) : viewMode === 'grid' ? (
            // Grid View - with optimisations
            <FlatList
              ref={flatListRef}
              key="grid"
              data={posts}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={3}
              contentContainerStyle={{ padding: 12 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#000000"
                  colors={["#000000"]}
                />
              }
              ListEmptyComponent={
                <View className="flex-1 justify-center items-center py-20">
                  <Text className="text-lg font-montMedium text-black/70">No posts found</Text>
                  <Text className="text-base font-montRegular text-black/60 text-center mt-2 px-10">
                    Be the first to share your fashion style!
                  </Text>
                </View>
              }
              // Performance optimisations
              initialNumToRender={24}
              maxToRenderPerBatch={12}
              windowSize={9}
              removeClippedSubviews={false}
              maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
              viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
              getItemLayout={getItemLayout}
              updateCellsBatchingPeriod={50}
              // Memorize dimensions to prevent recalculations
              extraData={renderedImages.size} // Re-render only when rendered images change
            />
          ) : (
            // Scroll View - with optimisations
            <FlatList
              ref={flatListRef}
              key="scroll"
              data={posts}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#000000"
                  colors={["#000000"]}
                />
              }
              ListEmptyComponent={
                <View className="flex-1 justify-center items-center py-20">
                  <Text className="text-lg font-montMedium text-black/70">No posts found</Text>
                  <Text className="text-base font-montRegular text-black/60 text-center mt-2 px-10">
                    Be the first to share your fashion style!
                  </Text>
                </View>
              }
              // Performance optimisations
              initialNumToRender={8}
              maxToRenderPerBatch={4}
              windowSize={7}
              removeClippedSubviews={false}
              onEndReachedThreshold={0.5}
              onEndReached={() => {
                // Load more content when approaching the end
                InteractionManager.runAfterInteractions(() => {
                  // This is empty but helps reduce glitching
                });
              }}
            />
          )}
        </>
      )}
    </View>
  );
};

export default ExplorePage;