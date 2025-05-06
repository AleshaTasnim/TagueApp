/**
 * BoardSelectionModal.jsx - Inspiration board selection modal
 * 
 * This component displays a modal interface for selecting an existing inspiration
 * board or creating a new one to save a post to. It handles board creation, post 
 * bookmarking, and adding posts to boards through Firebase integration.
 * 
 * Features:
 * - Viewing existing inspiration boards
 * - Creating new inspiration boards
 * - Adding posts to selected boards
 * - Tracking which boards already contain the current post
 * - Automatic bookmarking when adding to a board
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import { icons } from '../../constants/icons';

const BoardSelectionModal = ({
  visible,
  onClose,
  postId,
  postData,
  onBoardSelected
}) => {
  // State for managing boards, loading states, and UI interactions
  const [inspoBoards, setInspoBoards] = useState([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [addingToBoard, setAddingToBoard] = useState(false);
  const [showNewBoardInput, setShowNewBoardInput] = useState(false);
  const [boardsWithPost, setBoardsWithPost] = useState(new Set());

  // Fetch user's inspiration boards when modal becomes visible
  useEffect(() => {
    if (visible) {
      fetchInspoBoards();
    }
  }, [visible]);

  // Retrieve all inspiration boards from Firestore with their post data
  const fetchInspoBoards = async () => {
    if (!auth.currentUser) return;
    
    setLoadingBoards(true);
    
    try {
      const boardsRef = collection(db, "users", auth.currentUser.uid, "inspoBoards");
      const q = query(boardsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const boards = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Create a Set of board IDs that already contain this post
      const boardsContainingPost = new Set();
      boards.forEach(board => {
        if (board.posts && Array.isArray(board.posts) && board.posts.includes(postId)) {
          boardsContainingPost.add(board.id);
        }
      });
      
      setBoardsWithPost(boardsContainingPost);
      setInspoBoards(boards);
    } catch (error) {
      console.error("Error fetching inspiration boards:", error);
    } finally {
      setLoadingBoards(false);
    }
  };

  // Create a new inspiration board and add the current post to it
  const createNewBoard = async () => {
    if (!auth.currentUser || !newBoardName.trim()) {
      Alert.alert("Error", "Please enter a board name");
      return;
    }
    
    setCreatingBoard(true);
    
    try {
      // Create a unique ID for the board
      const boardId = Date.now().toString();
      const boardRef = doc(db, "users", auth.currentUser.uid, "inspoBoards", boardId);
      
      // Board data structure
      const boardData = {
        name: newBoardName.trim(),
        posts: [],
        postCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Add to Firestore
      await setDoc(boardRef, boardData);
      
      // Update local state
      const newBoard = {
        id: boardId,
        ...boardData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setInspoBoards(prevBoards => [newBoard, ...prevBoards]);
      setNewBoardName('');
      setShowNewBoardInput(false);
      
      // Automatically select this board
      addPostToBoard(boardId);
    } catch (error) {
      console.error("Error creating board:", error);
      Alert.alert("Error", "Failed to create inspiration board");
    } finally {
      setCreatingBoard(false);
    }
  };

  // Add the current post to a selected inspiration board
  const addPostToBoard = async (boardId) => {
    if (!auth.currentUser || !boardId || !postId) return;
    
    // Check if post is already in this board
    if (boardsWithPost.has(boardId)) {
      Alert.alert(
        "Already Added",
        "This post is already in this board",
        [{ text: "OK", onPress: () => {} }]
      );
      return;
    }
    
    setAddingToBoard(true);
    
    try {
      // First, ensure post is bookmarked
      const userBookmarksRef = collection(db, "users", auth.currentUser.uid, "bookmarkedPosts");
      const bookmarkedPostRef = doc(userBookmarksRef, postId);
      const bookmarkDoc = await getDoc(bookmarkedPostRef);
      
      // If not already bookmarked, add bookmark
      if (!bookmarkDoc.exists()) {
        const bookmarkData = {
          postId: postId,
          userId: postData.userId,
          imageUrl: postData.imageUrl,
          caption: postData.caption,
          createdAt: postData.createdAt,
          bookmarkedAt: new Date()
        };
        
        await setDoc(bookmarkedPostRef, bookmarkData);
      }
      
      // Now add to the selected board
      const boardRef = doc(db, "users", auth.currentUser.uid, "inspoBoards", boardId);
      const boardDoc = await getDoc(boardRef);
      
      if (boardDoc.exists()) {
        const boardData = boardDoc.data();
        const currentPosts = boardData.posts || [];
        
        // Double-check if post is already in board (shouldn't happen due to our earlier check)
        if (currentPosts.includes(postId)) {
          Alert.alert("Already Added", "This post is already in the selected board");
          onClose();
          setAddingToBoard(false);
          return;
        }
        
        // Add post to board
        const updatedPosts = [...currentPosts, postId];
        
        await updateDoc(boardRef, {
          posts: updatedPosts,
          postCount: updatedPosts.length,
          updatedAt: serverTimestamp()
        });
        
        // Update local state for boards
        setInspoBoards(prevBoards => 
          prevBoards.map(board => 
            board.id === boardId
              ? { 
                  ...board, 
                  posts: updatedPosts,
                  postCount: updatedPosts.length,
                  updatedAt: new Date()
                }
              : board
          )
        );
        
        // Update boardsWithPost set
        setBoardsWithPost(prev => {
          const newSet = new Set(prev);
          newSet.add(boardId);
          return newSet;
        });
        
        // Call callback function if provided
        if (onBoardSelected) {
          onBoardSelected(boardId, true);
        }
        
        Alert.alert("Success", "Post added to board");
      } else {
        Alert.alert("Error", "Board not found");
      }
      
      // Close modal
      onClose();
    } catch (error) {
      console.error("Error adding post to board:", error);
      Alert.alert("Error", "Failed to add post to board");
    } finally {
      setAddingToBoard(false);
    }
  };

  // Render the modal with board selection interface
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-primary rounded-t-3xl p-6 max-h-[70%]">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-4xl font-bregular text-black">ADD TO BOARD</Text>
              <TouchableOpacity onPress={onClose}>
                <Image
                  source={icons.cross}
                  className="w-8 h-8"
                  tintColor="#000000"
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
            
            {/* Create New Board Button */}
            {!showNewBoardInput && (
              <TouchableOpacity 
                className="flex-row items-center bg-black p-4 rounded-lg mb-4"
                onPress={() => setShowNewBoardInput(true)}
              >
                <Image
                  source={icons.edit}
                  className="w-7 h-7 mr-3"
                  tintColor="#F3E3D3"
                  resizeMode="contain"
                />
                <Text className="text-lg font-montSemiBold text-primary">Create New Board</Text>
              </TouchableOpacity>
            )}
            
            {/* New Board Input */}
            {showNewBoardInput && (
              <View className="mb-4 p-4 bg-[#E0C9B2] rounded-lg border-2">
                <Text className="text-3xl text-center font-bregular mb-2">Create New Board</Text>
                <View className="flex-row items-center">
                  <TextInput
                    className="flex-1 bg-white p-3 rounded-lg border-2 mr-2 text-base font-montRegular"
                    placeholder="Enter board name"
                    value={newBoardName}
                    onChangeText={setNewBoardName}
                    maxLength={40}
                    autoFocus
                  />
                </View>
                <View className="flex-row items-center pt-4 gap-4">
                    
                    <TouchableOpacity 
                        onPress={() => {
                            setShowNewBoardInput(false);
                            setNewBoardName('');
                        }}
                        className="flex-1 px-4 py-3 rounded-lg bg-black/10"
                    >
                    <Text className="font-montSemiBold text-center">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={createNewBoard}
                        disabled={creatingBoard || !newBoardName.trim()}
                        className={`flex-1 px-4 py-3 rounded-lg ${newBoardName.trim() ? 'bg-black' : 'bg-black/30'}`}
                    >
                        {creatingBoard ? (
                            <ActivityIndicator color="#F3E3D3" size="small" />
                        ) : (
                            <Text className="text-primary font-montSemiBold text-center">Create</Text>
                        )}
                    </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Boards List */}
            {loadingBoards ? (
              <View className="py-8 items-center">
                <ActivityIndicator size="large" color="#000" />
                <Text className="mt-4 font-montRegular text-black/70">Loading boards...</Text>
              </View>
            ) : (
              <FlatList
                data={inspoBoards}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isInBoard = boardsWithPost.has(item.id);
                  
                  return (
                    <View className={`flex-row items-center justify-between p-4 mb-2 rounded-lg border-2 ${isInBoard ? 'bg-black/20 border-black' : 'bg-white/30 border-black/10'}`}>
                      <View className="flex-1">
                        <Text className="text-lg font-montSemiBold text-black">{item.name}</Text>
                        <Text className="text-sm font-montRegular text-black/60">
                          {item.postCount || 0} {item.postCount === 1 ? 'post' : 'posts'}
                        </Text>
                      </View>
                      
                      {isInBoard ? (
                        <View className="bg-black px-3 py-1 rounded-full">
                          <Text className="text-primary font-montMedium">Added</Text>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          onPress={() => addPostToBoard(item.id)}
                          disabled={addingToBoard}
                          className="w-8 h-8 rounded-full border-2 border-black/30 items-center justify-center"
                        >
                          <Image
                            source={icons.add}
                            className="w-5 h-5"
                            tintColor="#000"
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                  <View className="py-8 items-center">
                    <Text className="text-lg font-montMedium text-black/70 text-center">
                      You don't have any boards yet
                    </Text>
                    <Text className="text-base font-montRegular text-black/60 text-center mt-2">
                      Create your first board to organize your favourite posts
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default BoardSelectionModal;