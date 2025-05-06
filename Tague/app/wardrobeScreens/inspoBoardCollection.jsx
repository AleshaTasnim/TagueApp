import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
  Modal,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import { icons } from '../../constants/icons';

const InspoBoardCollection = () => {
  // =========================================================================
  // STATE MANAGEMENT
  // =========================================================================
  const [inspoBoards, setInspoBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [currentBoard, setCurrentBoard] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Track mounted state
  const isMounted = useRef(true);
  
  // Get current user ID
  const currentUserId = auth.currentUser?.uid;

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
    
    // Fetch inspo boards
    fetchInspoBoards();
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // =========================================================================
  // DATA FETCHING
  // =========================================================================
  /**
   * Fetches inspiration boards from Firestore
   */
  const fetchInspoBoards = async () => {
    if (!isMounted.current || !currentUserId) return;
    
    setLoading(true);
    
    try {
      // Get user's inspo boards collection
      const boardsRef = collection(db, "users", currentUserId, "inspoBoards");
      const q = query(boardsRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      // Store the fetched data
      const boards = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (isMounted.current) {
        setInspoBoards(boards);
      }
    } catch (error) {
      console.error("Error fetching inspo boards:", error);
      Alert.alert("Error", "Failed to load inspiration boards");
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };
  
  // =========================================================================
  // BOARD MANAGEMENT FUNCTIONS
  // =========================================================================
  /**
   * Creates a new inspiration board
   */
  const createBoard = async () => {
    if (!currentUserId || !boardName.trim()) {
      Alert.alert("Error", "Please enter a board name");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Create a unique ID for the board
      const boardId = Date.now().toString();
      const boardRef = doc(db, "users", currentUserId, "inspoBoards", boardId);
      
      // Board data structure
      const boardData = {
        name: boardName.trim(),
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
        createdAt: new Date(), // Use JS Date object for local state
        updatedAt: new Date()
      };
      
      if (isMounted.current) {
        setInspoBoards(prevBoards => [newBoard, ...prevBoards]);
        setBoardName('');
        setCreateModalVisible(false);
      }
      
      Alert.alert("Success", "Inspiration board created");
    } catch (error) {
      console.error("Error creating board:", error);
      Alert.alert("Error", "Failed to create inspiration board");
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  };
  
  /**
   * Updates an existing inspiration board
   */
  const updateBoard = async () => {
    if (!currentUserId || !currentBoard || !boardName.trim()) {
      Alert.alert("Error", "Please enter a board name");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const boardRef = doc(db, "users", currentUserId, "inspoBoards", currentBoard.id);
      
      // Update board data
      const updateData = {
        name: boardName.trim(),
        updatedAt: serverTimestamp()
      };
      
      // Update Firestore
      await updateDoc(boardRef, updateData);
      
      // Update local state
      if (isMounted.current) {
        setInspoBoards(prevBoards => prevBoards.map(board => 
          board.id === currentBoard.id
            ? { ...board, name: boardName.trim(), updatedAt: new Date() }
            : board
        ));
        setBoardName('');
        setCurrentBoard(null);
        setEditModalVisible(false);
      }
      
      Alert.alert("Success", "Board updated successfully");
    } catch (error) {
      console.error("Error updating board:", error);
      Alert.alert("Error", "Failed to update board");
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  };
  
  /**
   * Deletes an inspiration board
   */
  const deleteBoard = async (board) => {
    Alert.alert(
      "Delete Board",
      `Are you sure you want to delete "${board.name}"? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!currentUserId) return;
            
            setIsProcessing(true);
            
            try {
              const boardRef = doc(db, "users", currentUserId, "inspoBoards", board.id);
              
              // Delete from Firestore
              await deleteDoc(boardRef);
              
              // Update local state
              if (isMounted.current) {
                setInspoBoards(prevBoards => prevBoards.filter(b => b.id !== board.id));
              }
              
              Alert.alert("Success", "Board deleted successfully");
            } catch (error) {
              console.error("Error deleting board:", error);
              Alert.alert("Error", "Failed to delete board");
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
   * Navigate to the selected inspo board detail view
   */
  const viewBoard = (board) => {
    router.push({
      pathname: './inspoBoardModal',
      params: { boardId: board.id }
    });
  };
  
  // =========================================================================
  // MODAL FUNCTIONS
  // =========================================================================
  /**
   * Opens create board modal
   */
  const showCreateModal = () => {
    setBoardName('');
    setCreateModalVisible(true);
  };
  
  /**
   * Opens edit board modal
   */
  const showEditModal = (board) => {
    setCurrentBoard(board);
    setBoardName(board.name);
    setEditModalVisible(true);
  };
  
  // =========================================================================
  // RENDER FUNCTIONS
  // =========================================================================
  
  /**
   * Renders an inspiration board item
   */
  const renderBoardItem = ({ item }) => {
    return (
      <View className="mb-4 bg-[#E0C9B2] rounded-xl overflow-hidden border-2 border-black">
        <TouchableOpacity
          className="flex-1 p-4"
          activeOpacity={0.8}
          onPress={() => viewBoard(item)}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-2xl font-bregular text-black">{item.name}</Text>
              <Text className="text-sm font-montRegular text-black/60 mt-1">
                {item.postCount || 0} {item.postCount === 1 ? 'post' : 'posts'}
              </Text>
            </View>
            
            <View className="flex-row">
              {/* Edit Button */}
              <TouchableOpacity
                className="w-10 h-10 mr-2 items-center justify-center"
                onPress={() => showEditModal(item)}
              >
                <Image
                  source={icons.edit}
                  className="w-6 h-6"
                  resizeMode="contain"
                  tintColor="#000"
                />
              </TouchableOpacity>
              
              {/* Delete Button */}
              <TouchableOpacity
                className="w-10 h-10 items-center justify-center"
                onPress={() => deleteBoard(item)}
              >
                <Image
                  source={icons.deletePrimary}
                  className="w-6 h-6"
                  resizeMode="contain"
                  tintColor="#000000"
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };
  
  /**
   * Renders create board modal
   */
  const renderCreateModal = () => (
    <Modal
      visible={createModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setCreateModalVisible(false)}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-[#F3E3D3] w-4/5 rounded-xl overflow-hidden p-5">
          <Text className="text-2xl font-bregular text-black text-center mb-4">
            Create New Board
          </Text>
          
          <TextInput
            className="bg-white border-2 border-black px-4 py-3 rounded-lg text-lg font-montRegular mb-4"
            placeholder="Board Name"
            value={boardName}
            onChangeText={setBoardName}
            maxLength={40}
            autoFocus
          />
          
          <View className="flex-row justify-between">
            <TouchableOpacity
              className="bg-black/10 px-5 py-3 rounded-lg flex-1 mr-2"
              onPress={() => setCreateModalVisible(false)}
              disabled={isProcessing}
            >
              <Text className="text-black font-montSemiBold text-center">Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-black px-5 py-3 rounded-lg flex-1 ml-2"
              onPress={createBoard}
              disabled={isProcessing || !boardName.trim()}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#F3E3D3" />
              ) : (
                <Text className="text-[#F3E3D3] font-montSemiBold text-center">Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
  
  /**
   * Renders edit board modal
   */
  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setEditModalVisible(false)}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-[#F3E3D3] w-4/5 rounded-xl overflow-hidden p-5">
          <Text className="text-2xl font-bregular text-black text-center mb-4">
            Edit Board
          </Text>
          
          <TextInput
            className="bg-white border-2 border-black px-4 py-3 rounded-lg text-lg font-montRegular mb-4"
            placeholder="Board Name"
            value={boardName}
            onChangeText={setBoardName}
            maxLength={40}
            autoFocus
          />
          
          <View className="flex-row justify-between">
            <TouchableOpacity
              className="bg-black/10 px-5 py-3 rounded-lg flex-1 mr-2"
              onPress={() => {
                setEditModalVisible(false);
                setCurrentBoard(null);
                setBoardName('');
              }}
              disabled={isProcessing}
            >
              <Text className="text-black font-montSemiBold text-center">Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="bg-black px-5 py-3 rounded-lg flex-1 ml-2"
              onPress={updateBoard}
              disabled={isProcessing || !boardName.trim()}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#F3E3D3" />
              ) : (
                <Text className="text-[#F3E3D3] font-montSemiBold text-center">Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
            <Text className="text-4xl pt-4 font-bregular text-black">INSPIRATION BOARDS</Text>
          </View>
        </View>
      </SafeAreaView>
      
      {/* Content */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
          <Text className="mt-4 font-montRegular text-black/70">Loading boards...</Text>
        </View>
      ) : (
        <View className="flex-1 px-4">
          {/* Create new board button */}
          <TouchableOpacity
            className="bg-black mt-4 mb-6 py-3 rounded-lg flex-row justify-center items-center"
            onPress={showCreateModal}
          >
            <Image
              source={icons.plus}
              className="w-6 h-6 mr-2"
              resizeMode="contain"
              tintColor="#F3E3D3"
            />
            <Text className="text-[#F3E3D3] font-montSemiBold text-lg">Create New Board</Text>
          </TouchableOpacity>
          
          {/* Boards List */}
          <FlatList
            data={inspoBoards}
            renderItem={renderBoardItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center py-20">
                <Text className="text-lg font-montMedium text-black/70">No boards found</Text>
                <Text className="text-base font-montRegular text-black/60 text-center mt-2 px-10">
                  Create your first inspiration board to organise your favourite posts.
                </Text>
              </View>
            }
          />
        </View>
      )}
      
      {/* Modals */}
      {renderCreateModal()}
      {renderEditModal()}
    </View>
  );
};

export default InspoBoardCollection;