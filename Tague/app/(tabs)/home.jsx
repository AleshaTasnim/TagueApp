/**
 * Home Component
 * 
 * This file implements the main feed functionality for the Tague app,
 * featuring user-curated tabs (Following, Friends, Styles) and dynamic content loading with
 * optimised image caching and rendering for improved performance (image optimisation).
 * 
 * Requirements covered: F.8, F.9
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Text, 
  View, 
  Image, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Dimensions,
  InteractionManager,
  RefreshControl,
  Platform
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc
} from 'firebase/firestore';
import { OptimisedImage, cacheImage } from '../../components/optimisedImage';
import { icons } from '../../constants/icons';
import { images } from '../../constants/images';
import { auth, db } from '../../backend/firebaseConfig';

// Global image cache to persist across renders
// Modified to use global scope for access from SideMenu
global.IMAGE_CACHE = global.IMAGE_CACHE || new Set();

// Persistent cache for posts to avoid reloading
// Modified to use global scope for access from SideMenu
global.POSTS_CACHE = global.POSTS_CACHE || {
  following: null,
  friends: null,
  styles: null,
  timestamp: null
};

/**
 * Custom memoised wrapper component for post items to prevent unnecessary re-renders
 */
const MemoizedPostItem = React.memo(({ item, index, renderPostItem }) => {
  return renderPostItem({ item, index });
});

/**
 * Factory function to create a stable renderItem function reference
 */
const createRenderItem = (renderPostItem) => 
  ({ item, index }) => (
    <MemoizedPostItem 
      item={item} 
      index={index} 
      renderPostItem={renderPostItem}
    />
  );

const Home = () => {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const [activeTab, setActiveTab] = useState('Following');
  const [followingPosts, setFollowingPosts] = useState(global.POSTS_CACHE.following || []);
  const [friendsPosts, setFriendsPosts] = useState(global.POSTS_CACHE.friends || []);
  const [stylesPosts, setStylesPosts] = useState(global.POSTS_CACHE.styles || []);
  const [loading, setLoading] = useState(!global.POSTS_CACHE.following);
  const [stylesLoading, setStylesLoading] = useState(!global.POSTS_CACHE.styles);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowingSomeone, setIsFollowingSomeone] = useState(false);
  const [isFollowingStyles, setIsFollowingStyles] = useState(false);
  const [hasMutualFollowing, setHasMutualFollowing] = useState(false);
  const [renderedImages, setRenderedImages] = useState(global.IMAGE_CACHE);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  
  const isMounted = useRef(true);
  const screenWidth = Dimensions.get('window').width;
  const flatListRef = useRef(null);
  const visibleRange = useRef({ start: 0, end: 5 });
  
  /**
   * Effect hook to listen for authentication state changes
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (isMounted.current) {
        setCurrentUser(user);
        
        if (!user) {
          setFollowingPosts([]);
          setFriendsPosts([]);
          setStylesPosts([]);
          setRenderedImages(new Set());
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, []);
  
  /**
   * Effect hook to handle initial data loading and image caching
   */
  useEffect(() => {
    isMounted.current = true;
    
    if (!currentUser) {
      if (isMounted.current) {
        setLoading(false);
        setStylesLoading(false);
      }
      return;
    }
    
    const cacheAge = global.POSTS_CACHE.timestamp ? (Date.now() - global.POSTS_CACHE.timestamp) : Infinity;
    const shouldFetch = !global.POSTS_CACHE.following || cacheAge > 5 * 60 * 1000;
    
    if (shouldFetch) {
      fetchPosts();
    } else {
      setFollowingPosts(global.POSTS_CACHE.following || []);
      setFriendsPosts(global.POSTS_CACHE.friends || []);
      setStylesPosts(global.POSTS_CACHE.styles || []);
      
      InteractionManager.runAfterInteractions(() => {
        let currentPosts = [];
        if (activeTab === 'Following') {
          currentPosts = global.POSTS_CACHE.following || [];
        } else if (activeTab === 'Friends') {
          currentPosts = global.POSTS_CACHE.friends || [];
        } else if (activeTab === 'Styles') {
          currentPosts = global.POSTS_CACHE.styles || [];
        }
        
        const visiblePosts = currentPosts.slice(0, 5);
        
        const imagesToPreCache = [];
        
        visiblePosts.forEach(post => {
          if (post.imageUrl && !renderedImages.has(post.imageUrl)) {
            imagesToPreCache.push(post.imageUrl);
          }
          
          if (post.userPhotoURL && !renderedImages.has(post.userPhotoURL)) {
            imagesToPreCache.push(post.userPhotoURL);
          }
        });
        
        imagesToPreCache.forEach(url => {
          if (url) {
            cacheImage(url).then(() => {
              if (isMounted.current) {
                setRenderedImages(prev => {
                  const newSet = new Set(prev);
                  newSet.add(url);
                  global.IMAGE_CACHE.add(url);
                  return newSet;
                });
              }
            }).catch(() => {});
          }
        });
      });
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [currentUser]);
  
  /**
   * Optimises rendering by tracking visible items and pre-caching images
   */
  const handleViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length === 0) return;
    
    const visibleIndices = viewableItems.map(item => item.index).filter(index => index !== null);
    if (visibleIndices.length > 0) {
      visibleRange.current = {
        start: Math.min(...visibleIndices),
        end: Math.max(...visibleIndices)
      };
    }
    
    const newImages = [];
    viewableItems.forEach(viewable => {
      if (viewable.item) {
        if (viewable.item.imageUrl && !renderedImages.has(viewable.item.imageUrl)) {
          newImages.push(viewable.item.imageUrl);
          cacheImage(viewable.item.imageUrl).catch(() => {});
        }
        
        if (viewable.item.userPhotoURL && !renderedImages.has(viewable.item.userPhotoURL)) {
          newImages.push(viewable.item.userPhotoURL);
          cacheImage(viewable.item.userPhotoURL).catch(() => {});
        }
        
        const preloadIndex = viewable.index + 2;
        let postsArray = [];
        
        if (activeTab === 'Following') {
          postsArray = followingPosts;
        } else if (activeTab === 'Friends') {
          postsArray = friendsPosts;
        } else if (activeTab === 'Styles') {
          postsArray = stylesPosts;
        }
        
        if (preloadIndex < postsArray.length && postsArray[preloadIndex]) {
          const nextPost = postsArray[preloadIndex];
          
          if (nextPost.imageUrl && !renderedImages.has(nextPost.imageUrl)) {
            newImages.push(nextPost.imageUrl);
            cacheImage(nextPost.imageUrl).catch(() => {});
          }
          
          if (nextPost.userPhotoURL && !renderedImages.has(nextPost.userPhotoURL)) {
            newImages.push(nextPost.userPhotoURL);
            cacheImage(nextPost.userPhotoURL).catch(() => {});
          }
        }
      }
    });
    
    if (newImages.length > 0) {
      setRenderedImages(prev => {
        const newSet = new Set(prev);
        newImages.forEach(url => {
          if (url) {
            newSet.add(url);
            global.IMAGE_CACHE.add(url);
          }
        });
        return newSet;
      });
    }
  }, [renderedImages, followingPosts, friendsPosts, stylesPosts, activeTab]);
  
  /**
   * Configuration for tracking which items are visible in the feed
   */
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 20,
    minimumViewTime: 300,
  }), []);
  
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged: handleViewableItemsChanged }
  ]);
  
  /**
   * Fetches posts for all tabs (Following, Friends, and Styles)
   */
  const fetchPosts = async () => {
    if (!isMounted.current) return;
    
    if (!auth.currentUser) {
      console.error("Cannot fetch posts: User not authenticated");
      if (isMounted.current) {
        setLoading(false);
        setStylesLoading(false);
        setRefreshing(false);
      }
      return;
    }
    
    setLoading(true);
    setStylesLoading(true);
    
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        if (isMounted.current) {
          setLoading(false);
          setStylesLoading(false);
          setRefreshing(false);
        }
        return;
      }
      
      const userDocRef = await getDoc(doc(db, "users", userId));
      if (!userDocRef.exists()) {
        if (isMounted.current) {
          setLoading(false);
          setStylesLoading(false);
          setRefreshing(false);
        }
        return;
      }
      
      const userData = userDocRef.data();
      const following = userData.following || [];
      const followers = userData.followers || [];
      const followedStyles = userData.followedStyles || [];
      
      setIsFollowingSomeone(following.length > 0);
      setIsFollowingStyles(followedStyles.length > 0);
      
      const mutualConnections = following.filter(followedId => 
        followers.includes(followedId)
      );
      
      setHasMutualFollowing(mutualConnections.length > 0);
      
      let followingPostsData = [];
      let mutualPostsData = [];
      
      if (following.length > 0) {
        const postsRef = collection(db, "posts");
        const q = query(
          postsRef,
          where("userId", "in", following),
          orderBy("createdAt", "desc")
        );
        
        const querySnapshot = await getDocs(q);
        
        const fetchedPosts = [];
        const userInfoMap = new Map();
        
        for (const docSnapshot of querySnapshot.docs) {
          const postData = { id: docSnapshot.id, ...docSnapshot.data() };
          fetchedPosts.push(postData);
        }
        
        const uniqueUserIds = [...new Set(fetchedPosts.map(post => post.userId).filter(Boolean))];
        
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
          
          usersData.forEach(({ userId, userData }) => {
            userInfoMap.set(userId, userData);
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        const enrichedPosts = fetchedPosts.map(post => ({
          ...post,
          userDisplayName: post.userId && userInfoMap.has(post.userId) 
            ? userInfoMap.get(post.userId).displayName 
            : "Unknown",
          userPhotoURL: post.userId && userInfoMap.has(post.userId) 
            ? userInfoMap.get(post.userId).photoURL 
            : null
        }));
        
        followingPostsData = enrichedPosts;
        
        if (mutualConnections.length > 0) {
          mutualPostsData = enrichedPosts.filter(post => 
            mutualConnections.includes(post.userId)
          );
        }
      }
      
      let stylesPostsData = [];
      
      if (followedStyles.length > 0) {
        const postsRef = collection(db, "posts");
        
        const stylesQuery = query(
          postsRef,
          where("styles", "array-contains-any", followedStyles),
          orderBy("createdAt", "desc")
        );
        
        const stylesQuerySnapshot = await getDocs(stylesQuery);
        
        const fetchedStylesPosts = [];
        const stylesUserInfoMap = new Map();
        
        for (const docSnapshot of stylesQuerySnapshot.docs) {
          const postData = { id: docSnapshot.id, ...docSnapshot.data() };
          if (postData.userId !== userId) {
            fetchedStylesPosts.push(postData);
          }
        }
        
        const uniqueStylesUserIds = [...new Set(fetchedStylesPosts.map(post => post.userId).filter(Boolean))];
        
        for (let i = 0; i < uniqueStylesUserIds.length; i += 10) {
          const batchUserIds = uniqueStylesUserIds.slice(i, i + 10);
          
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
          
          usersData.forEach(({ userId, userData }) => {
            stylesUserInfoMap.set(userId, userData);
          });
          
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        const enrichedStylesPosts = fetchedStylesPosts.map(post => ({
          ...post,
          userDisplayName: post.userId && stylesUserInfoMap.has(post.userId) 
            ? stylesUserInfoMap.get(post.userId).displayName 
            : "Unknown",
          userPhotoURL: post.userId && stylesUserInfoMap.has(post.userId) 
            ? stylesUserInfoMap.get(post.userId).photoURL 
            : null
        }));
        
        stylesPostsData = enrichedStylesPosts;
      }
      
      if (isMounted.current) {
        setFollowingPosts(followingPostsData);
        setFriendsPosts(mutualPostsData);
        setStylesPosts(stylesPostsData);
        
        global.POSTS_CACHE.following = followingPostsData;
        global.POSTS_CACHE.friends = mutualPostsData;
        global.POSTS_CACHE.styles = stylesPostsData;
        global.POSTS_CACHE.timestamp = Date.now();
        
        InteractionManager.runAfterInteractions(() => {
          let visiblePosts = [];
          
          if (activeTab === 'Following') {
            visiblePosts = followingPostsData.slice(0, 5);
          } else if (activeTab === 'Friends') {
            visiblePosts = mutualPostsData.slice(0, 5);
          } else if (activeTab === 'Styles') {
            visiblePosts = stylesPostsData.slice(0, 5);
          }
          
          visiblePosts.forEach(post => {
            if (post.imageUrl) {
              cacheImage(post.imageUrl).then(() => {
                if (isMounted.current) {
                  setRenderedImages(prev => {
                    const newSet = new Set(prev);
                    newSet.add(post.imageUrl);
                    global.IMAGE_CACHE.add(post.imageUrl);
                    return newSet;
                  });
                }
              }).catch(() => {});
            }
            
            if (post.userPhotoURL) {
              cacheImage(post.userPhotoURL).then(() => {
                if (isMounted.current) {
                  setRenderedImages(prev => {
                    const newSet = new Set(prev);
                    newSet.add(post.userPhotoURL);
                    global.IMAGE_CACHE.add(post.userPhotoURL);
                    return newSet;
                  });
                }
              }).catch(() => {});
            }
          });
        });
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setStylesLoading(false);
        setRefreshing(false);
      }
    }
  };

  /**
   * Handles pull-to-refresh action by reloading posts
   */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    
    global.POSTS_CACHE.timestamp = null;
    fetchPosts();
  }, []);
  
  /**
   * Switches between tabs without triggering a data reload
   */
  const setActiveTabWithoutReload = useCallback((tabName) => {
    setActiveTab(tabName);
    
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, []);
  
  /**
   * Creates an SVG for a tag positioned on the left side
   */
  const createLeftTagSvg = useCallback((tag) => {
    const truncateText = (text, maxLength) => {
      if (!text) return "";
      return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
    };
    
    const truncatedBrand = truncateText(tag.brand, 15);
    const truncatedProduct = truncateText(tag.productName, 18);
    const truncatedPrice = truncateText(tag.price, 18);
    
    return `
    <svg width="304" height="97" viewBox="0 0 304 97" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Direct connecting line -->
      <line x1="275" y1="44.5" x2="440" y2="44.5" stroke="black" stroke-width="2"/>
      
      <!-- Tag shape -->
      <path 
        fill-rule="evenodd" 
        clip-rule="evenodd"
        d="M273.137 21.6013C274.54 22.924 275.336 24.7672 275.336 26.6958L275.336 65.1027C275.336 67.0313 274.54 68.8745 273.137 70.1972L255.517 86.8003C254.218 88.0242 252.501 88.7058 250.716 88.7058L11.0003 88.7058C7.13431 88.7058 4.00031 85.5718 4.00031 81.7058L4.00031 8.73923C4.00031 4.87324 7.13432 1.73923 11.0003 1.73923L252.8 1.73926C253.05 1.73926 253.171 2.04431 252.989 2.21541C252.874 2.3242 252.874 2.50775 252.989 2.61654L273.137 21.6013ZM260.569 38.2652C256.492 38.2652 253.186 41.3801 253.186 45.2225C253.186 49.065 256.492 52.1799 260.569 52.1799C264.647 52.1799 267.953 49.065 267.953 45.2225C267.953 41.3801 264.647 38.2652 260.569 38.2652Z" 
        fill="black"
      />
      
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
      <text transform="translate(13 45) rotate(90)" font-family="BebasNeue" font-size="22" font-weight="bold" text-anchor="middle" fill="#F3E3D3">${truncatedPrice}</text>
    </svg>
    `;
  }, []);
  
  /**
   * Creates an SVG for a tag positioned on the right side
   */
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
  
  /**
   * Renders individual post items with appropriate layout based on index
   */
  const renderPostItem = useCallback(({ item, index }) => {
    if (!auth.currentUser) {
      return null;
    }
    
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
            router.push('/profile');
          }
        }}
      >
        <Image 
          source={item.userPhotoURL ? { uri: item.userPhotoURL } : images.profilePic}
          className="w-14 h-14 rounded-full mr-3 border-2 border-black"
          resizeMode="cover"
          cachePolicy="reload"
          showLoadingIndicator={item.userPhotoURL && !renderedImages.has(item.userPhotoURL)}
        />
        <Text className="text-black font-montSemiBold">{item.userDisplayName}</Text>
      </TouchableOpacity>
    );
  
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
     
    const isEvenIndex = index % 2 === 0;
    const imageOnLeft = isEvenIndex;
    
    return (
      <View className="bg-[#E0C9B2] p-4 rounded-xl border-4 border-black shadow-sm mb-6">
        <View className="flex-row items-center mb-3">
          <UserProfileLink />
        </View>
        
        <PostWrapper>
          <View className="flex-row justify-between">
            {imageOnLeft ? (
              <>
                <View className="w-[50%] aspect-[3/4] rounded-lg overflow-hidden border-black border-4">
                  <OptimisedImage
                    source={{ uri: item.imageUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                    lowQualityFirst={true}
                    priority="normal"
                    showLoadingIndicator={!renderedImages.has(item.imageUrl)}
                  />
                  
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
                
                <View className="w-[50%]">
                  {item.tags && item.tags.map((tag, tagIndex) => {
                    const position = tag.position || {};
                    const relativeY = position.relativeY || 0;
                    
                    return (
                      <View 
                        key={tagIndex} 
                        style={{
                          position: 'absolute',
                          top: `${relativeY * 100}%`,
                          width: '100%',
                          height: 97,
                          marginTop: -50,
                        }}
                      >
                        <SvgXml xml={createRightTagSvg(tag)} width="100%" height="100%" />
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <View className="w-[50%]">
                  {item.tags && item.tags.map((tag, tagIndex) => {
                    const position = tag.position || {};
                    const relativeY = position.relativeY || 0;
                    
                    return (
                      <View 
                        key={tagIndex} 
                        style={{
                          position: 'absolute',
                          top: `${relativeY * 100}%`,
                          width: '100%',
                          height: 95,
                          marginTop: -50,
                        }}
                      >
                        <SvgXml xml={createLeftTagSvg(tag)} width="100%" height="100%" />
                      </View>
                    );
                  })}
                </View>
                
                <View className="w-[50%] aspect-[3/4] rounded-lg overflow-hidden border-black border-4">
                  <OptimisedImage
                    source={{ uri: item.imageUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                    lowQualityFirst={true}
                    priority="normal"
                    showLoadingIndicator={!renderedImages.has(item.imageUrl)}
                  />
                  
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
        
        <View className={`pt-2 } ${item.caption? 'mt-10 rounded-full border-2 border-black bg-primary flex-row justify-center items-center': 'mt-4'}`}>
          {item.caption && (
            <Text className="text-center font-montMedium mb-3">{item.caption}</Text>
          )}
        </View>
        
        {item.styles && item.styles.length > 0 && (
          <View className="flex-row flex-wrap mt-2 justify-center">
            {item.styles.map((style, styleIndex) => (
              <TouchableOpacity 
                key={styleIndex}
                onPress={() => {
                  router.push({
                    pathname: '/search/[query]',
                    params: { 
                      query: encodeURIComponent(style), 
                      filter: 'styles' 
                    }
                  });
                }}
                className="bg-black/10 px-3 py-1 rounded-full mr-2 mb-2"
              >
                <Text className="text-black/70 font-montRegular text-sm">{style}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  }, [createLeftTagSvg, createRightTagSvg, renderedImages]);
  
  /**
   * Creates a stable renderItem function reference
   */
  const renderItem = useMemo(() => 
    createRenderItem(renderPostItem),
  [renderPostItem]);
  
  /**
   * Component shown when user has no content to display in Following tab
   */
  const EmptyFollowingState = useCallback(() => (
    <View className="flex-1 justify-center items-center p-6">
      <Text className="text-black/70 font-montSemiBold text-lg mb-2 text-center">
        {isFollowingSomeone 
          ? "Feed Empty" 
          : "You're not following anyone yet"}
      </Text>
      <Text className="text-black/60 font-montRegular text-center mb-4">
        {isFollowingSomeone
          ? "The people you follow haven't posted anything yet"
          : "Follow other users to see their posts in your feed"}
      </Text>
      <TouchableOpacity
        className="bg-black py-3 px-6 rounded-full"
        onPress={() => router.push('/profileScreens/findFriends')}
      >
        <Text className="text-primary font-montMedium">Find People to Follow</Text>
      </TouchableOpacity>
    </View>
  ), [isFollowingSomeone]);
  
  /**
   * Component shown when user has no mutual followers in Friends tab
   */
  const EmptyFriendsState = useCallback(() => (
    <View className="flex-1 justify-center items-center p-6">
      <Text className="text-black/70 font-montSemiBold text-lg mb-2 text-center">
        No Friends Yet
      </Text>
      <Text className="text-black/60 font-montRegular text-center mb-4">
        "Friends" are people who follow you back. Follow more people to increase your chances of making friends!
      </Text>
      <TouchableOpacity
        className="bg-black py-3 px-6 rounded-full"
        onPress={() => router.push('/profileScreens/findFriends')}
      >
        <Text className="text-primary font-montMedium">Find People to Follow</Text>
      </TouchableOpacity>
    </View>
  ), []);

  /**
   * Component shown when user has no styles followed in Styles tab
   */
  const EmptyStylesState = useCallback(() => (
    <View className="flex-1 justify-center items-center p-6">
      <Text className="text-black/70 font-montSemiBold text-lg mb-2 text-center">
        {isFollowingStyles 
          ? "No Posts Found" 
          : "You're not following any styles yet"}
      </Text>
      <Text className="text-black/60 font-montRegular text-center mb-4">
        {isFollowingStyles
          ? "No posts found with your followed styles"
          : "Follow styles to see related posts in your feed"}
      </Text>
      <TouchableOpacity
        className="bg-black py-3 px-6 rounded-full"
        onPress={() => router.push('/search')}
      >
        <Text className="text-primary font-montMedium">Discover Styles</Text>
      </TouchableOpacity>
    </View>
  ), [isFollowingStyles]);

  /**
   * Renders the complete Home component UI
   */
  return (
    <SafeAreaView edges={['top']} className="bg-primary flex-1">
      {!currentUser ? (
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-black/70 font-montSemiBold text-lg mb-2 text-center">
            Please log in to view your feed
          </Text>
          <TouchableOpacity
            className="bg-black py-3 px-6 rounded-full mt-4"
            onPress={() => router.replace('/login')}
          >
            <Text className="text-primary font-montMedium">Go to Login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View className={`absolute top-7 right-7 ${Platform.OS === 'ios' ? 'mt-10' : ''}`}>
            <TouchableOpacity onPress={() => router.push('../directMessages')}>
              <Image
                source={icons.message}
                className="w-10 h-10"
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <View className="justify-center items-center">
            <Image
              source={images.logo}
              className="w-[180px] h-[84px] mt-6"
              resizeMode="contain"
            />
          </View>

          <View className="flex-row justify-center mt-3">
            <TouchableOpacity
              className={`px-4 py-2 mb-1 ${activeTab === 'Following' ? 'border-b-2 border-black' : ''}`}
              onPress={() => setActiveTabWithoutReload('Following')}
            >
              <Text className="text-lg font-montSemiBold text-black">Following</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-4 py-2 mb-1 ${activeTab === 'Friends' ? 'border-b-2 border-black' : ''}`}
              onPress={() => setActiveTabWithoutReload('Friends')}
            >
              <Text className="text-lg font-montSemiBold text-black">Friends</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`px-4 py-2 mb-1 ${activeTab === 'Styles' ? 'border-b-2 border-black' : ''}`}
              onPress={() => setActiveTabWithoutReload('Styles')}
            >
              <Text className="text-lg font-montSemiBold text-black">Styles</Text>
            </TouchableOpacity>
          </View>

          {(loading && (activeTab === 'Following' || activeTab === 'Friends')) || 
          (stylesLoading && activeTab === 'Styles') ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#000" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              key={activeTab}
              data={activeTab === 'Following' 
                ? followingPosts 
                : activeTab === 'Friends' 
                  ? friendsPosts 
                  : stylesPosts}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
              ListEmptyComponent={
                activeTab === 'Following' 
                  ? EmptyFollowingState 
                  : activeTab === 'Friends'
                    ? EmptyFriendsState
                    : EmptyStylesState
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#000000"
                  colors={["#000000"]}
                />
              }
              showsVerticalScrollIndicator={false}
              initialNumToRender={6}
              maxToRenderPerBatch={3}
              windowSize={5}
              removeClippedSubviews={false}
              onEndReachedThreshold={0.5}
              onEndReached={() => {
                InteractionManager.runAfterInteractions(() => {
                  // This is empty but helps reduce glitching
                });
              }}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
};

export default Home;