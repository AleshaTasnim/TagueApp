import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  StatusBar,
  Dimensions,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  arrayRemove, 
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import { icons } from '../../constants/icons';

const InspoBoardModal = () => {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const { boardId } = useLocalSearchParams();
  const [board, setBoard] = useState(null);
  const [boardPosts, setBoardPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [renderedImages, setRenderedImages] = useState(new Set());
  const [addPostModalVisible, setAddPostModalVisible] = useState(false);
  const [availablePosts, setAvailablePosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Track mounted state
  const isMounted = useRef(true);
  
  // Get current user ID
  const currentUserId = auth.currentUser?.uid;
  
  // Calculate dimensions for the grid
  const screenWidth = Dimensions.get('window').width;
  const itemWidth = (screenWidth - 32) / 3; // 32 accounts for horizontal padding and gaps
  
  /**
   * Screen options component for header configuration
   */
  const ScreenOptions = () => {
    return (
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
    );
  };
  
  // =========================================================================
  // LIFECYCLE HOOKS
  // =========================================================================
  useEffect(() => {
    // Reset state when component mounts
    isMounted.current = true;
    
    // Fetch board data and posts
    if (boardId) {
      fetchBoardData();
    }
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [boardId]);
  
  // =========================================================================
  // DATA FETCHING
  // =========================================================================
  /**
   * Fetches board data and its posts
   */
  const fetchBoardData = async () => {
    if (!isMounted.current || !currentUserId || !boardId) return;
    
    setLoading(true);
    
    try {
      // Get board data
      const boardRef = doc(db, "users", currentUserId, "inspoBoards", boardId);
      const boardDoc = await getDoc(boardRef);
      
      if (!boardDoc.exists()) {
        Alert.alert("Error", "Board not found");
        router.back();
        return;
      }
      
      const boardData = { id: boardDoc.id, ...boardDoc.data() };
      setBoard(boardData);
      
      // Fetch posts referenced in the board
      const postIds = boardData.posts || [];
      
      if (postIds.length === 0) {
        setBoardPosts([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Check if posts are still bookmarked
      const bookmarksRef = collection(db, "users", currentUserId, "bookmarkedPosts");
      const bookmarkDocs = await getDocs(bookmarksRef);
      const bookmarkedPostIds = new Set(bookmarkDocs.docs.map(doc => doc.id));
      
      // Filter out post IDs that are no longer bookmarked
      const validPostIds = postIds.filter(postId => bookmarkedPostIds.has(postId));
      
      // If any posts were removed because they're no longer bookmarked, update the board
      if (validPostIds.length < postIds.length) {
        await updateDoc(boardRef, {
          posts: validPostIds,
          postCount: validPostIds.length,
          updatedAt: serverTimestamp()
        });
        
        // Update local state for board data
        if (boardData.posts) {
          boardData.posts = validPostIds;
          boardData.postCount = validPostIds.length;
        }
      }
      
      // If no valid posts remain, return an empty array
      if (validPostIds.length === 0) {
        setBoardPosts([]);
        setBoard(boardData);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Fetch details for valid posts
      const postPromises = validPostIds.map(async (postId) => {
        try {
          const postRef = doc(db, "posts", postId);
          const postDoc = await getDoc(postRef);
          
          if (postDoc.exists()) {
            return { id: postDoc.id, ...postDoc.data() };
          }
          
          return null;
        } catch (err) {
          console.error("Error fetching post:", err);
          return null;
        }
      });
      
      const fetchedPosts = (await Promise.all(postPromises)).filter(Boolean);
      
      if (isMounted.current) {
        setBoardPosts(fetchedPosts);
        setBoard(boardData);
      }
    } catch (error) {
      console.error("Error fetching board data:", error);
      Alert.alert("Error", "Failed to load board data");
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };
  
  /**
   * Fetches posts that can be added to the board
   */
  const fetchAvailablePosts = async () => {
    if (!isMounted.current || !currentUserId) return;
    
    setLoadingPosts(true);
    
    try {
      // First, get user's bookmarked posts
      const bookmarksRef = collection(db, "users", currentUserId, "bookmarkedPosts");
      const bookmarkDocs = await getDocs(bookmarksRef);
      
      // Create a map of current board posts for quick lookup
      const boardPostIds = new Set(board?.posts || []);
      
      // Process bookmarks
      const userBookmarks = [];
      
      for (const docSnapshot of bookmarkDocs.docs) {
        const bookmark = { id: docSnapshot.id, ...docSnapshot.data() };
        
        // Only include bookmarks that aren't already in the board
        if (bookmark.postId && !boardPostIds.has(bookmark.postId)) {
          // Fetch the original post data for the thumbnail
          try {
            const postRef = doc(db, "posts", bookmark.postId);
            const postDoc = await getDoc(postRef);
            
            if (postDoc.exists()) {
              userBookmarks.push({
                ...bookmark,
                ...postDoc.data(),
                originalPostExists: true
              });
            } else {
              userBookmarks.push(bookmark);
            }
          } catch (err) {
            console.error("Error fetching original post for bookmark:", err);
            userBookmarks.push(bookmark);
          }
        }
      }
      
      if (isMounted.current) {
        setAvailablePosts(userBookmarks);
        setSelectedPosts([]);
      }
    } catch (error) {
      console.error("Error fetching available posts:", error);
      Alert.alert("Error", "Failed to load available posts");
    } finally {
      if (isMounted.current) {
        setLoadingPosts(false);
      }
    }
  };
  
  /**
   * Handle refresh action
   */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBoardData();
  }, []);
  
  // =========================================================================
  // BOARD MANAGEMENT FUNCTIONS
  // =========================================================================
  /**
   * Removes a post from the board
   */
  const removePostFromBoard = async (postId) => {
    if (!currentUserId || !boardId || !postId) return;
    
    Alert.alert(
      "Remove Post",
      "Are you sure you want to remove this post from the board?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setIsProcessing(true);
            
            try {
              const boardRef = doc(db, "users", currentUserId, "inspoBoards", boardId);
              
              // Remove post from the board's posts array
              await updateDoc(boardRef, {
                posts: arrayRemove(postId),
                postCount: (board?.posts?.length || 1) - 1,
                updatedAt: serverTimestamp()
              });
              
              // Update local state
              if (isMounted.current) {
                setBoardPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
                setBoard(prevBoard => ({
                  ...prevBoard,
                  posts: prevBoard.posts.filter(id => id !== postId),
                  postCount: (prevBoard?.posts?.length || 1) - 1,
                  updatedAt: new Date()
                }));
              }
            } catch (error) {
              console.error("Error removing post:", error);
              Alert.alert("Error", "Failed to remove post from board");
            } finally {
              if (isMounted.current) {
                setIsProcessing(false);
              }
            }
          }
        }
      ]
    );
  };
  
  /**
   * Adds selected posts to the board
   */
  const addPostsToBoard = async () => {
    if (!currentUserId || !boardId || selectedPosts.length === 0) return;
    
    setIsProcessing(true);
    
    try {
      const boardRef = doc(db, "users", currentUserId, "inspoBoards", boardId);
      
      // Get current board data
      const boardDoc = await getDoc(boardRef);
      if (!boardDoc.exists()) {
        throw new Error("Board not found");
      }
      
      const boardData = boardDoc.data();
      const currentPosts = boardData.posts || [];
      const postsToAdd = selectedPosts.filter(id => !currentPosts.includes(id));
      
      if (postsToAdd.length === 0) {
        setAddPostModalVisible(false);
        setIsProcessing(false);
        return;
      }
      
      // Add new posts to the board
      const updatedPosts = [...currentPosts, ...postsToAdd];
      
      await updateDoc(boardRef, {
        posts: updatedPosts,
        postCount: updatedPosts.length,
        updatedAt: serverTimestamp()
      });
      
      // Fetch the newly added posts to display them
      const postPromises = postsToAdd.map(async (postId) => {
        try {
          const postRef = doc(db, "posts", postId);
          const postDoc = await getDoc(postRef);
          
          if (postDoc.exists()) {
            return { id: postDoc.id, ...postDoc.data() };
          }
          
          return null;
        } catch (err) {
          console.error("Error fetching added post:", err);
          return null;
        }
      });
      
      const fetchedPosts = (await Promise.all(postPromises)).filter(Boolean);
      
      // Update local state
      if (isMounted.current) {
        setBoardPosts(prevPosts => [...prevPosts, ...fetchedPosts]);
        setBoard(prevBoard => ({
          ...prevBoard,
          posts: updatedPosts,
          postCount: updatedPosts.length,
          updatedAt: new Date()
        }));
        
        setAddPostModalVisible(false);
        setSelectedPosts([]);
      }
      
      Alert.alert("Success", "Posts added to board");
    } catch (error) {
      console.error("Error adding posts to board:", error);
      Alert.alert("Error", "Failed to add posts to board");
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  };
  
  // =========================================================================
  // SELECTION FUNCTIONS
  // =========================================================================
  /**
   * Toggles post selection in the add post modal
   */
  const togglePostSelection = (postId) => {
    setSelectedPosts(prevSelected => {
      if (prevSelected.includes(postId)) {
        return prevSelected.filter(id => id !== postId);
      } else {
        return [...prevSelected, postId];
      }
    });
  };
  
  /**
   * Checks if a post is selected
   */
  const isPostSelected = (postId) => {
    return selectedPosts.includes(postId);
  };
  
  // =========================================================================
  // NAVIGATION FUNCTIONS
  // =========================================================================
  /**
   * Navigate back to the previous screen
   */
  const goBack = () => {
    router.back();
  };
  
  /**
   * Navigate to view post details
   */
  const viewPost = (postId) => {
    router.push({
      pathname: '../profileScreens/viewUserPost',
      params: { postId }
    });
  };
  
  // =========================================================================
  // MODAL FUNCTIONS
  // =========================================================================
  /**
   * Opens the add post modal
   */
  const showAddPostModal = () => {
    fetchAvailablePosts();
    setAddPostModalVisible(true);
  };
  
  // =========================================================================
  // RENDER FUNCTIONS
  // =========================================================================
  
  /**
   * Renders a post item in the grid view
   */
  const renderGridItem = ({ item }) => {
    // Skip rendering if no image URL
    if (!item.imageUrl) {
      return null;
    }
    
    return (
      <TouchableOpacity
        className="overflow-hidden rounded-lg border-2 border-black mb-2 relative"
        style={{ width: itemWidth, height: itemWidth * 4/3, margin: 2 }} // 3:4 aspect ratio
        activeOpacity={0.8}
        onPress={() => viewPost(item.id)}
      >
        <Image
          source={{ uri: item.imageUrl }}
          className="w-full h-full"
          resizeMode="cover"
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
        
        {/* Remove button */}
        <TouchableOpacity
          className="absolute top-2 right-2 bg-black/70 w-8 h-8 rounded-full items-center justify-center"
          onPress={(e) => {
            e.stopPropagation();
            removePostFromBoard(item.id);
          }}
        >
          <Image
            source={icons.deletePrimary}
            className="w-5 h-5"
            resizeMode="contain"
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };
  
  /**
   * Renders a post item in the add post modal
   */
  const renderAvailablePostItem = ({ item }) => {
    // Skip rendering if no image URL
    if (!item.imageUrl) {
      return null;
    }
    
    const isSelected = isPostSelected(item.postId);
    
    return (
      <TouchableOpacity
        className="overflow-hidden rounded-lg border-2 mb-2 relative border-black"
        style={{ width: itemWidth, height: itemWidth * 4/3, margin: 2 }} // 3:4 aspect ratio
        activeOpacity={0.8}
        onPress={() => togglePostSelection(item.postId)}
      >
        <Image
          source={{ uri: item.imageUrl }}
          className="w-full h-full"
          resizeMode="cover"
        />
        
        {/* Selection indicator */}
        {isSelected && (
          <View className="absolute inset-0 bg-black/30 items-center justify-center">
            <View className="bg-primary rounded-full w-12 h-12 items-center justify-center">
              <Image
                source={icons.hanger}
                className="w-8 h-8"
                resizeMode="contain"
                tintColor="#000000"
              />
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };
  
  /**
   * Render placeholder item when loading
   */
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
  
  /**
   * Renders add post modal with fixed SafeAreaView
   */
  const renderAddPostModal = () => (
    <Modal
      visible={addPostModalVisible}
      transparent={false}
      animationType="slide"
      onRequestClose={() => setAddPostModalVisible(false)}
    >
      <SafeAreaView className="flex-1 bg-[#F3E3D3]" edges={['top']}>
        <StatusBar barStyle="dark-content" />
        
        {/* Header */}
        <View className="h-16 justify-center border-b border-black/10">
          <TouchableOpacity 
            onPress={() => setAddPostModalVisible(false)}
            className="absolute top-3 left-3 z-50 items-center justify-center"
          >
            <Image
              source={icons.backArrow}
              className="w-12 h-12"
              resizeMode="contain"
              tintColor="#000"
            />
          </TouchableOpacity>
          
          <View className="items-center">
            <Text className="text-4xl pt-2 font-bregular text-black">Add Posts</Text>
          </View>
          
          <TouchableOpacity 
            className="absolute top-3 right-3 z-50 px-4 py-2 rounded-full bg-black items-center justify-center"
            onPress={addPostsToBoard}
            disabled={isProcessing || selectedPosts.length === 0}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#F3E3D3" />
            ) : (
              <Text className="text-[#F3E3D3] font-montSemiBold">
                Add {selectedPosts.length > 0 ? `(${selectedPosts.length})` : ''}
              </Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* Content */}
        {loadingPosts ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#000" />
            <Text className="mt-4 font-montRegular text-black/70">Loading posts...</Text>
          </View>
        ) : (
          <FlatList
            data={availablePosts}
            renderItem={renderAvailablePostItem}
            keyExtractor={(item) => item.postId || item.id}
            numColumns={3}
            contentContainerStyle={{ padding: 12, paddingBottom: 100 }} // Added more bottom padding
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center py-20">
                <Text className="text-lg font-montMedium text-black/70">No posts available</Text>
                <Text className="text-base font-montRegular text-black/60 text-center mt-2 px-10">
                  You need to bookmark posts before you can add them to a board.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
  
  // =========================================================================
  // MAIN RENDER
  // =========================================================================
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
            <Text className="text-4xl pt-4 font-bregular text-black" numberOfLines={1} ellipsizeMode="tail">
              {board?.name || 'Board'}
            </Text>
          </View>
          
          {!loading && (
            <TouchableOpacity 
              onPress={showAddPostModal}
              className="absolute top-3 right-4 z-50 items-center justify-center"
            >
              <Image
                source={icons.add}
                className="w-14 h-14"
                resizeMode="contain"
                tintColor="#000000"
              />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
      
      {/* Board Info */}
      {board && !loading && (
        <View className="px-4 py-2 flex-row justify-between items-center">
          <Text className="text-base font-montRegular text-black/60">
            {board.postCount || 0} {board.postCount === 1 ? 'post' : 'posts'}
          </Text>
          
          <Text className="text-base font-montRegular text-black/60">
            Created {board.createdAt instanceof Date 
              ? board.createdAt.toLocaleDateString() 
              : new Date().toLocaleDateString()}
          </Text>
        </View>
      )}
      
      {/* Content */}
      {loading ? (
        <FlatList
          data={placeholderData}
          renderItem={renderPlaceholderItem}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={
            <View className="items-center justify-center py-6">
              <ActivityIndicator size="large" color="#000" />
              <Text className="mt-4 font-montRegular text-black/70">Loading board...</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={boardPosts}
          renderItem={renderGridItem}
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
              <Text className="text-lg font-montMedium text-black/70">No posts in this board</Text>
              <Text className="text-base font-montRegular text-black/60 text-center mt-2 px-10">
                Tap the + button to add posts to this board.
              </Text>
            </View>
          }
          extraData={renderedImages.size} // Re-render when images are loaded
        />
      )}
      
      {/* Add Post Modal */}
      {renderAddPostModal()}
    </View>
  );
};

export default InspoBoardModal;