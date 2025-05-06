/**
 * BookmarkedPostsModal.jsx - Bookmarked posts screen
 * 
 * This component displays all posts bookmarked by the current user in a grid layout.
 * It handles privacy-aware filtering to remove posts from private accounts the user no
 * longer follows and automatically maintains consistency with inspiration boards.
 * 
 * Features:
 * - Grid display of bookmarked posts
 * - Pull-to-refresh functionality for content updates
 * - Automatic privacy filtering for bookmarked content
 * - Synchronisation with inspiration boards when bookmarks are removed
 * - Optimised image loading with visual loading indicators
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  Image,
  StatusBar
} from 'react-native';
import { router, Stack } from 'expo-router';
import { collection, query, orderBy, getDocs, doc, getDoc, deleteDoc, runTransaction } from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import { SafeAreaView } from 'react-native-safe-area-context';
import { icons } from '../../constants/icons';

const BookmarkedPostsModal = () => {
  // STATE MANAGEMENT
  const [bookmarkedPosts, setBookmarkedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [renderedImages, setRenderedImages] = useState(new Set());
  
  // Track mounted state to prevent state updates after unmount
  const isMounted = useRef(true);
  
  // Get current user ID
  const currentUserId = auth.currentUser?.uid;
  
  // Calculate dimensions for the grid
  const screenWidth = Dimensions.get('window').width;
  const itemWidth = (screenWidth - 32) / 3; // 32 accounts for horizontal padding and gaps
  
  // Screen options component for header configuration
  const ScreenOptions = () => {
    return (
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
    );
  };
  
  // LIFECYCLE HOOKS
  useEffect(() => {
    // Reset state when component mounts
    isMounted.current = true;
    
    // Fetch bookmarked posts
    fetchBookmarkedPosts();
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // DATA FETCHING
  
  // Updates inspiration board post count when a bookmark is removed
  const updateInspoBoardCounts = async (postId) => {
    if (!currentUserId || !postId) return;
    
    try {
      // Get all inspo boards for the current user
      const inspoBoardsRef = collection(db, "users", currentUserId, "inspoBoards");
      const inspoBoardsSnapshot = await getDocs(inspoBoardsRef);
      
      // Check each board for the removed post
      for (const boardDoc of inspoBoardsSnapshot.docs) {
        const boardData = boardDoc.data();
        const boardRef = doc(db, "users", currentUserId, "inspoBoards", boardDoc.id);
        
        // If this board contains the post ID
        if (boardData.posts && boardData.posts.includes(postId)) {
          // Use a transaction to safely update the post count and remove the post ID
          await runTransaction(db, async (transaction) => {
            // Get the latest board data
            const latestBoardDoc = await transaction.get(boardRef);
            
            if (latestBoardDoc.exists()) {
              const latestBoardData = latestBoardDoc.data();
              const updatedPosts = latestBoardData.posts.filter(id => id !== postId);
              
              // Update the board data
              transaction.update(boardRef, {
                posts: updatedPosts,
                postCount: updatedPosts.length
              });
            }
          });
          
          console.log(`Updated inspo board ${boardDoc.id} - removed post ${postId}`);
        }
      }
    } catch (error) {
      console.error("Error updating inspo board counts:", error);
    }
  };

  // Fetches bookmarked posts from Firestore
  // Modified to respect user privacy settings and update inspo boards
  const fetchBookmarkedPosts = async () => {
    if (!isMounted.current || !currentUserId) return;
    
    setLoading(true);
    
    try {
      // Get user's bookmarked posts collection
      const bookmarksRef = collection(db, "users", currentUserId, "bookmarkedPosts");
      const q = query(bookmarksRef, orderBy("bookmarkedAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      // Get current user's following list
      const currentUserRef = doc(db, "users", currentUserId);
      const currentUserDoc = await getDoc(currentUserRef);
      const currentUserFollowing = currentUserDoc.exists() ? 
        (currentUserDoc.data().following || []) : [];
      
      // Store the fetched data
      const postPromises = querySnapshot.docs.map(async (docSnapshot) => {
        const bookmarkData = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // If the bookmark has a reference to an original post, fetch additional details
        if (bookmarkData.postId) {
          try {
            const postDocRef = doc(db, "posts", bookmarkData.postId);
            const postDoc = await getDoc(postDocRef);
            
            if (postDoc.exists()) {
              const postData = postDoc.data();
              
              // Check if post owner is private and not followed
              if (postData.userId && postData.userId !== currentUserId) {
                const postOwnerRef = doc(db, "users", postData.userId);
                const postOwnerDoc = await getDoc(postOwnerRef);
                
                if (postOwnerDoc.exists()) {
                  const postOwner = postOwnerDoc.data();
                  
                  // If owner is private and current user is not following them, skip this post
                  if (postOwner.isPrivate === true && !currentUserFollowing.includes(postData.userId)) {
                    // Remove bookmark since it's from a private unfollowed user
                    try {
                      await deleteDoc(docSnapshot.ref);
                      
                      // Update inspo board counts for this post
                      await updateInspoBoardCounts(bookmarkData.postId);
                      
                      console.log(`Removed bookmark for post ${bookmarkData.postId} from private unfollowed user ${postData.userId}`);
                    } catch (err) {
                      console.error("Error removing bookmark:", err);
                    }
                    return null;
                  }
                }
              }
              
              // Merge bookmark data with post data
              return {
                ...bookmarkData,
                ...postData,
                originalPostExists: true
              };
            }
          } catch (err) {
            console.error("Error fetching original post:", err);
          }
        }
        
        // Return bookmark data even if original post fetch fails
        return bookmarkData;
      });
      
      // Wait for all post fetches to complete and filter out null entries
      const fetchedPosts = (await Promise.all(postPromises)).filter(Boolean);
      
      if (isMounted.current) {
        setBookmarkedPosts(fetchedPosts);
      }
    } catch (error) {
      console.error("Error fetching bookmarked posts:", error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };
  
  // Handle refresh action
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookmarkedPosts();
  }, []);
  
  // NAVIGATION FUNCTIONS
  
  // Navigate back to the previous screen
  const goBack = () => {
    router.back();
  };
  
  // Navigate to post detail view
  const navigateToPost = (postId) => {
    router.push({
      pathname: '../profileScreens/viewUserPost',
      params: { postId }
    });
  };
  
  // RENDER FUNCTIONS
  
  // Renders a post item in the grid view
  const renderGridItem = ({ item }) => {
    // Skip rendering if no image URL
    if (!item.imageUrl) {
      return null;
    }
    
    return (
      <TouchableOpacity
        className="overflow-hidden rounded-lg border-2 border-black mb-2"
        style={{ width: itemWidth, height: itemWidth * 4/3, margin: 2 }} // 3:4 aspect ratio
        activeOpacity={0.8}
        onPress={() => navigateToPost(item.postId || item.id)}
      >
        <Image
          source={{ uri: item.imageUrl }}
          className="w-full h-full"
          resizeMode="cover"
          onLoadStart={() => {
            // No need to update state here as it causes too many re-renders
          }}
          onLoadEnd={() => {
            if (isMounted.current) {
              setRenderedImages(prev => {
                const newSet = new Set(prev);
                newSet.add(item.imageUrl);
                return newSet;
              });
            }
          }}
        />
        {!renderedImages.has(item.imageUrl) && (
          <View className="absolute inset-0 bg-black/5 justify-center items-center">
            <ActivityIndicator size="small" color="#000" />
          </View>
        )}
      </TouchableOpacity>
    );
  };
  
  // Render placeholder item when loading
  const renderPlaceholderItem = ({ index }) => {
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
  };
  
  // Create placeholder data for loading state
  const placeholderData = Array(12).fill(0).map((_, index) => ({ id: `placeholder-${index}` }));
  
  // MAIN RENDER
  return (
    <View className="flex-1 bg-[#F3E3D3]">
      <ScreenOptions />
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <SafeAreaView edges={['top']} className="bg-[#F3E3D3]">
        <View className="h-16 justify-center">
          <TouchableOpacity 
            onPress={goBack}
            className="absolute top-3 left-3 z-50 items-center justify-center"
          >
            <Image
              source={icons.backArrow}
              className="w-12 h-12"
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          <View className="items-center">
            <Text className="text-4xl pt-4 font-bregular text-black">BOOKMARKED POSTS</Text>
          </View>
        </View>
      </SafeAreaView>
      
      {/* Content */}
      {loading && !refreshing ? (
        // Loading state with placeholder grid
        <FlatList
          data={placeholderData}
          renderItem={renderPlaceholderItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={
            <View className="items-center justify-center py-6">
              <ActivityIndicator size="large" color="#000" />
              <Text className="mt-4 font-montRegular text-black/70">Loading bookmarks...</Text>
            </View>
          }
        />
      ) : (
        // Grid of bookmarked posts
        <FlatList
          data={bookmarkedPosts}
          renderItem={renderGridItem}
          keyExtractor={(item) => item.postId || item.id}
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
              <Text className="text-lg font-montRegular text-black/70">No bookmarks found</Text>
              <Text className="text-base font-montRegular text-black/60 text-center mt-2 px-10">
                When you bookmark posts, they'll appear here.
              </Text>
            </View>
          }
          // Performance optimizations
          initialNumToRender={12}
          maxToRenderPerBatch={6}
          windowSize={7}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
          // Re-render only when rendered images change
          extraData={renderedImages.size}
        />
      )}
    </View>
  );
};

export default BookmarkedPostsModal;