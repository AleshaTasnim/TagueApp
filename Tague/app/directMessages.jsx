/**
 * DirectMessages Component
 * 
 * This component handles the messaging functionality of the application, allowing users to:
 * - View a list of conversations
 * - Search for users to start new conversations
 * - Send and receive messages in real-time
 * - Mark messages as read
 * 
 * Requirements: F.3, F.7
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, 
  View, 
  Image, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc, 
  addDoc, 
  onSnapshot, 
  Timestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from '../backend/firebaseConfig';

import { icons } from '../constants/icons';
import { images } from '../constants/images';

const DirectMessages = () => {
  // State variables for managing conversations, messages, and UI
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [mutualUsers, setMutualUsers] = useState([]);
  const [searchMode, setSearchMode] = useState(false);
  
  const messagesEndRef = useRef(null);
  const conversationsListener = useRef(null);
  
  // Initialise user data and conversation listener on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        const userDocRef = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDocRef.exists()) {
          setCurrentUser({
            id: auth.currentUser.uid,
            ...userDocRef.data()
          });
        }
      }
    };
    
    fetchUserData();
    setupConversationsListener();
    
    // Clean up listener when component unmounts
    return () => {
      if (conversationsListener.current) {
        conversationsListener.current();
      }
    };
  }, []);
  
  // Fetch mutual users when entering search mode
  useEffect(() => {
    if (searchMode && currentUser) {
      fetchMutualUsers();
    }
  }, [searchMode, currentUser]);

  // Filter users when search query changes
  useEffect(() => {
    if (searchMode && searchQuery) {
      const filtered = mutualUsers.filter(user => 
        user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(mutualUsers);
    }
  }, [searchQuery, mutualUsers]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);
  
  // Listen for real-time message updates when a conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      setLoadingMessages(true);
      
      const messagesRef = collection(db, "conversations", selectedConversation.id, "messages");
      const q = query(messagesRef, orderBy("timestamp", "asc"));
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const messagesList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setMessages(messagesList);
        setLoadingMessages(false);
        
        // Mark messages as read if they were sent by the other person
        const batch = writeBatch(db);
        let updatesNeeded = false;
        
        messagesList.forEach(message => {
          if (!message.read && message.senderId !== auth.currentUser?.uid) {
            const messageRef = doc(db, "conversations", selectedConversation.id, "messages", message.id);
            batch.update(messageRef, { read: true });
            updatesNeeded = true;
          }
        });
        
        // Only commit batch if there are updates to make
        if (updatesNeeded) {
          batch.commit().catch(error => {
            console.error("Error marking messages as read:", error);
          });
        }
      });
      
      // Update conversation read status when selected
      updateConversationReadStatus(selectedConversation.id);
      
      return () => unsubscribe();
    }
  }, [selectedConversation]);

  // Update the current conversation in state when read status changes
  useEffect(() => {
    if (selectedConversation) {
      // Update the conversation in state with zero unread count
      setConversations(prevConversations => 
        prevConversations.map(convo => 
          convo.id === selectedConversation.id
            ? { ...convo, unreadCount: 0 }
            : convo
        )
      );
    }
  }, [selectedConversation]);

  // Set up real-time listener for conversations
  const setupConversationsListener = () => {
    setLoadingConversations(true);
    
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        setLoadingConversations(false);
        return;
      }
      
      // Query conversations where current user is a participant
      const conversationsRef = collection(db, "conversations");
      const q = query(
        conversationsRef,
        where("participants", "array-contains", userId)
      );
      
      // Set up the real-time listener
      const unsubscribe = onSnapshot(q, async (querySnapshot) => {
        // Process conversations and get the other user's information
        const conversationsData = await Promise.all(querySnapshot.docs.map(async (docSnapshot) => {
          const convoData = { id: docSnapshot.id, ...docSnapshot.data() };
          
          // Find the other participant's ID
          const otherUserId = convoData.participants.find(id => id !== userId);
          
          // Get other user's info
          const userDocRef = await getDoc(doc(db, "users", otherUserId));
          const userData = userDocRef.exists() ? userDocRef.data() : {};
          
          // Get the last message
          const messagesRef = collection(db, "conversations", convoData.id, "messages");
          const msgQuery = query(messagesRef, orderBy("timestamp", "desc"), where("timestamp", "!=", null));
          const msgSnapshot = await getDocs(msgQuery);
          
          let lastMessage = null;
          let unreadCount = 0;
          
          if (!msgSnapshot.empty) {
            lastMessage = {
              id: msgSnapshot.docs[0].id,
              ...msgSnapshot.docs[0].data()
            };
            
            // Count unread messages
            msgSnapshot.docs.forEach(doc => {
              const msgData = doc.data();
              if (!msgData.read && msgData.senderId !== userId) {
                unreadCount++;
              }
            });
          }
          
          // If this is the currently selected conversation, set unread count to 0
          if (selectedConversation && selectedConversation.id === convoData.id) {
            unreadCount = 0;
          }
          
          return {
            ...convoData,
            otherUser: {
              id: otherUserId,
              displayName: userData.displayName || "Unknown",
              photoURL: userData.photoURL || null
            },
            lastMessage,
            unreadCount
          };
        }));
        
        // Sort conversations by last message timestamp (newest first)
        const sortedConversations = conversationsData.sort((a, b) => {
          if (!a.lastMessage && !b.lastMessage) return 0;
          if (!a.lastMessage) return 1;
          if (!b.lastMessage) return -1;
          
          return b.lastMessage.timestamp?.toDate() - a.lastMessage.timestamp?.toDate();
        });
        
        setConversations(sortedConversations);
        setLoadingConversations(false);
        setRefreshing(false);
      }, (error) => {
        console.error("Error in conversations listener:", error);
        setLoadingConversations(false);
        setRefreshing(false);
      });
      
      // Store unsubscribe function for cleanup
      conversationsListener.current = unsubscribe;
      
    } catch (error) {
      console.error("Error setting up conversations listener:", error);
      setLoadingConversations(false);
      setRefreshing(false);
    }
  };
  
  // Fetch users who follow the current user back
  const fetchMutualUsers = async () => {
    try {
      if (!currentUser) return;
      
      const following = currentUser.following || [];
      const followers = currentUser.followers || [];
      
      // Find mutual connections (people who follow the user back)
      const mutualConnections = following.filter(followedId => 
        followers.includes(followedId)
      );
      
      if (mutualConnections.length === 0) {
        setMutualUsers([]);
        return;
      }
      
      // Get user data for each mutual connection
      const mutualUsersData = await Promise.all(mutualConnections.map(async (userId) => {
        const userDocRef = await getDoc(doc(db, "users", userId));
        if (userDocRef.exists()) {
          return {
            id: userId,
            ...userDocRef.data()
          };
        }
        return null;
      }));
      
      // Filter out any null values and sort alphabetically by displayName
      const validMutualUsers = mutualUsersData
        .filter(user => user !== null)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      
      setMutualUsers(validMutualUsers);
      setFilteredUsers(validMutualUsers);
    } catch (error) {
      console.error("Error fetching mutual users:", error);
    }
  };
  
  // Handle pull-to-refresh action
  const onRefresh = () => {
    setRefreshing(true);
    // Clean up existing listener
    if (conversationsListener.current) {
      conversationsListener.current();
    }
    // Set up new listener
    setupConversationsListener();
  };
  
  // Mark all messages in a conversation as read
  const updateConversationReadStatus = async (conversationId) => {
    try {
      const messagesRef = collection(db, "conversations", conversationId, "messages");
      const q = query(
        messagesRef, 
        where("senderId", "!=", auth.currentUser?.uid),
        where("read", "==", false)
      );
      
      const querySnapshot = await getDocs(q);
      
      // If there are unread messages, use batch update for better performance
      if (!querySnapshot.empty) {
        const batch = writeBatch(db);
        
        querySnapshot.docs.forEach((docSnapshot) => {
          const messageRef = doc(db, "conversations", conversationId, "messages", docSnapshot.id);
          batch.update(messageRef, { read: true });
        });
        
        await batch.commit();
        
        // Immediately update the conversation in the local state
        setConversations(prevConversations => 
          prevConversations.map(convo => 
            convo.id === conversationId
              ? { ...convo, unreadCount: 0 }
              : convo
          )
        );
      }
    } catch (error) {
      console.error("Error updating read status:", error);
    }
  };
  
  // Create a new conversation or select an existing one
  const createOrSelectConversation = async (otherUser) => {
    try {
      const userId = auth.currentUser?.uid;
      
      // Check if a conversation already exists between these users
      const conversationsRef = collection(db, "conversations");
      const q = query(
        conversationsRef,
        where("participants", "array-contains", userId)
      );
      
      const querySnapshot = await getDocs(q);
      let existingConversation = null;
      
      querySnapshot.docs.forEach(docSnapshot => {
        const convoData = docSnapshot.data();
        if (convoData.participants.includes(otherUser.id)) {
          existingConversation = {
            id: docSnapshot.id,
            ...convoData,
            otherUser: {
              id: otherUser.id,
              displayName: otherUser.displayName,
              photoURL: otherUser.photoURL
            }
          };
        }
      });
      
      if (existingConversation) {
        // Use existing conversation
        setSelectedConversation(existingConversation);
      } else {
        // Create new conversation
        const newConversationRef = await addDoc(collection(db, "conversations"), {
          participants: [userId, otherUser.id],
          createdAt: Timestamp.now()
        });
        
        // Set as selected conversation
        setSelectedConversation({
          id: newConversationRef.id,
          participants: [userId, otherUser.id],
          otherUser: {
            id: otherUser.id,
            displayName: otherUser.displayName,
            photoURL: otherUser.photoURL
          }
        });
      }
      
      // Exit search mode
      setSearchMode(false);
      setSearchQuery('');
    } catch (error) {
      console.error("Error creating/selecting conversation:", error);
    }
  };
  
  // Send a new message to the selected conversation
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    try {
      const userId = auth.currentUser?.uid;
      
      // Add message to Firestore
      await addDoc(
        collection(db, "conversations", selectedConversation.id, "messages"),
        {
          text: newMessage.trim(),
          senderId: userId,
          timestamp: Timestamp.now(),
          read: false
        }
      );
      
      // Update conversation with last message info
      await updateDoc(doc(db, "conversations", selectedConversation.id), {
        lastMessageAt: Timestamp.now(),
        lastMessageText: newMessage.trim(),
        lastMessageSenderId: userId
      });
      
      // Clear input
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Navigate back from conversation view or to previous screen
  const goBack = () => {
    // When going back to conversation list, ensure read status is reflected
    if (selectedConversation) {
      setSelectedConversation(null);
    } else {
      router.back();
    }
  };
  
  // Render a conversation item in the list
  const renderConversationItem = ({ item }) => {
    const lastMessageDate = item.lastMessage?.timestamp?.toDate();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let timeDisplay = ''; 
    
    if (lastMessageDate) {
      if (lastMessageDate.getTime() > today.getTime()) {
        // Today - show time only
        timeDisplay = lastMessageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (lastMessageDate.getTime() > today.getTime() - 86400000) {
        // Yesterday
        timeDisplay = 'Yesterday';
      } else {
        // Older - show date
        timeDisplay = lastMessageDate.toLocaleDateString([], { day: 'numeric', month: 'short' });
      }
    }
    
    return (
      <TouchableOpacity
        className={`flex-row items-center p-4 border-2 m-2 rounded-3xl bg-white/30 ${item.unreadCount > 0 ? 'bg-black/5' : ''}`}
        onPress={() => setSelectedConversation(item)}
      >
        <Image
          source={item.otherUser.photoURL ? { uri: item.otherUser.photoURL } : images.profilePic}
          className="w-14 h-14 rounded-full mr-3 border-2 border-black"
          resizeMode="cover"
          // lowQualityFirst={true}
          // priority="normal"
        />
        
        <View className="flex-1">
          <View className="flex-row justify-between">
            <Text className="text-black font-montSemiBold">
              {item.otherUser.displayName}
            </Text>
            
            {lastMessageDate && (
              <Text className="text-black/50 text-xs font-montRegular">
                {timeDisplay}
              </Text>
            )}
          </View>
          
          <View className="flex-row justify-between mt-1">
            <Text 
              className={`${item.unreadCount > 0 ? 'text-black font-montSemiBold' : 'text-black/70 font-montRegular'} text-sm`}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.lastMessage 
                ? (item.lastMessage.senderId === auth.currentUser?.uid ? 'You: ' : '') + item.lastMessage.text 
                : 'No messages yet'}
            </Text>
            
            {item.unreadCount > 0 && (
              <View className="bg-black rounded-full h-6 w-6 items-center justify-center ml-2">
                <Text className="text-white text-xs font-montSemiBold">
                  {item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Render a user item in the search results
  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      className="flex-row items-center p-4 m-2 border-2 rounded-3xl bg-white/30"
      onPress={() => createOrSelectConversation(item)}
    >
      <Image
        source={item.photoURL ? { uri: item.photoURL } : images.profilePic}
        className="w-14 h-14 rounded-full mr-3 border-2 border-black"
        resizeMode="cover"
        // lowQualityFirst={true}
        // priority="normal"
      />
      
      <View className="flex-1">
        <Text className="text-black font-montSemiBold">
          {item.displayName}
        </Text>
      </View>
    </TouchableOpacity>
  );
  
  // Render a message item in the conversation
  const renderMessageItem = ({ item, index }) => {
    const isSender = item.senderId === auth.currentUser?.uid;
    const showAvatar = !isSender && (index === 0 || messages[index - 1].senderId !== item.senderId);
    const timestamp = item.timestamp?.toDate();
    const timeString = timestamp ? timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    
    return (
      <View className={`flex-row ${isSender ? 'justify-end' : 'justify-start'} mb-3`}>
        {!isSender && showAvatar && (
          <Image
            source={selectedConversation.otherUser.photoURL 
              ? { uri: selectedConversation.otherUser.photoURL } 
              : images.profilePic}
            className="w-8 h-8 rounded-full mr-2 self-end "
            resizeMode="cover"
            // lowQualityFirst={true}
            // priority="normal"
          />
        )}
        
        {!isSender && !showAvatar && <View className="w-8 mr-2" />}
        
        <View className={`px-4 py-2 rounded-2xl max-w-[80%] ${isSender ? 'bg-black rounded-tr-none' : 'bg-[#E0C9B2] rounded-tl-none'}`}>
          <Text className={`${isSender ? 'text-white' : 'text-black'} font-montRegular`}>
            {item.text}
          </Text>
          <Text className={`text-xs ${isSender ? 'text-white/70' : 'text-black/50'} text-right mt-1 font-montRegular`}>
            {timeString}
          </Text>
        </View>
      </View>
    );
  };
  
  // Component to display when there are no conversations
  const EmptyConversationsState = () => (
    <View className="flex-1 justify-center items-center p-6">
      <Text className="text-black/70 font-montSemiBold text-lg mb-2 text-center">
        No Messages Yet
      </Text>
      <Text className="text-black/60 font-montRegular text-center mb-4">
        Start a conversation with your mutual connections
      </Text>
      <TouchableOpacity
        className="bg-black py-3 px-6 rounded-full"
        onPress={() => setSearchMode(true)}
      >
        <Text className="text-primary font-montMedium">New Message</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Component to display when there are no mutual users
  const EmptyMutualUsersState = () => (
    <View className="flex-1 justify-center items-center p-6">
      <Text className="text-black/70 font-montSemiBold text-lg mb-2 text-center">
        No Mutual Connections
      </Text>
      <Text className="text-black/60 font-montRegular text-center mb-4">
        You can only message users who follow you back
      </Text>
      <TouchableOpacity
        className="bg-black py-3 px-6 rounded-full"
        onPress={() => router.push('/profileScreens/findFriends')}
      >
        <Text className="text-primary font-montMedium">Find Friends</Text>
      </TouchableOpacity>
    </View>
  );
  
  // Render the list of conversations
  const renderConversationListView = () => (
    <>
      <View className="flex-row justify-between items-center mx-4 mb-4 pt-2">
        <TouchableOpacity
          onPress={goBack}
        >
          <Image 
            source={icons.backArrow}
            className="w-12 h-12" // Increased size to ensure visibility
            resizeMode="contain" // Added resize mode to ensure proper scaling
          />
        </TouchableOpacity>

        <Text className="text-5xl font-bregular">Messages</Text>
        <TouchableOpacity
          onPress={() => setSearchMode(true)}
          className="p-2" // Added padding to balance with back button
        >
          <Image 
            source={icons.search}
            className="w-8 h-8" 
            resizeMode="contain"
          />
        </TouchableOpacity>
      </View>
      
      {loadingConversations ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={renderConversationItem}
          ListEmptyComponent={EmptyConversationsState}
          onRefresh={onRefresh}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View className="h-px bg-black/10 ml-20" />}
        />
      )}
    </>
  );
  
  // Render the user search view
  const renderUserSearchView = () => (
    <>
      <View className="flex-row items-center mx-4 mb-4 pt-2 gap-4">
        <TouchableOpacity
          onPress={() => {
            setSearchMode(false);
            setSearchQuery('');
          }}
        >
          <Image 
            source={icons.backArrow}
            className="w-12 h-12" 
            resizeMode="contain"
          />
        </TouchableOpacity>
        
        <View className="flex-1 flex-row items-center bg-white/40 rounded-full p-2 border-2">
          <Image source={icons.search} className="w-8 h-8 mr-2" />
          <TextInput
            placeholder="Search friends"
            placeholderTextColor="#000000"
            className="text-lg flex-1 font-montRegular"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Image source={icons.cross} className="w-6 h-6" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      
      <FlatList
        data={filteredUsers}
        keyExtractor={item => item.id}
        renderItem={renderUserItem}
        ListEmptyComponent={EmptyMutualUsersState}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View className="h-px bg-black/10 ml-20" />}
      />
    </>
  );
  
  // Render the conversation detail view
  const renderConversationDetailView = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      {/* Header */}
      <View className="flex-row items-center gap-2 border-b border-black/10">
        <TouchableOpacity
          onPress={() => setSelectedConversation(null)}
          className="p-2"
        >
          <Image 
            source={icons.backArrow} 
            className="w-12 h-12"
            resizeMode="contain"
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="flex-row items-center flex-1"
          onPress={() => {
              router.push({
                pathname: '../profileScreens/userProfile',
                params: { userId: selectedConversation.otherUser.id }
              });
          }}
        >
          <Image
            source={selectedConversation.otherUser.photoURL
              ? { uri: selectedConversation.otherUser.photoURL }
              : images.profilePic}
            className="w-12 h-12 rounded-full mr-3 border-2"
            resizeMode="cover"
            // lowQualityFirst={true}
            // priority="normal"
          />
          
          <Text className="font-montSemiBold text-lg text-black">
            {selectedConversation.otherUser.displayName}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Messages list */}
      {loadingMessages ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
        </View>
      ) : (
        <FlatList
          ref={messagesEndRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={true}
          inverted={false}
          onContentSizeChange={() => {
            if (messagesEndRef.current && messages.length > 0) {
              messagesEndRef.current.scrollToEnd({ animated: false });
            }
          }}
        />
      )}
      
      {/* Message input with reduced padding for iOS */}
      <View className={`flex-row items-center ${Platform.OS === 'ios' ? 'p-4 pb-6' : 'p-4'}`}>
        <TextInput
          className="flex-1 bg-white/50 rounded-full p-4 border-2 mr-2 font-montRegular text-black"
          placeholder="Type a message..."
          placeholderTextColor="#00000080"
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxHeight={100}
        />
        
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Image 
            source={icons.send} 
            className="w-8 h-8" 
            tintColor={newMessage.trim() ? '#000000' : '#00000080'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
  
  // Return the main component based on current state
  return (
    <SafeAreaView edges={['top']} className="bg-primary flex-1 pt-2">
      {selectedConversation ? (
        // Show conversation detail view
        renderConversationDetailView()
      ) : searchMode ? (
        // Show user search view
        renderUserSearchView()
      ) : (
        // Show conversation list view
        renderConversationListView()
      )}
    </SafeAreaView>
  );
};

export default DirectMessages;