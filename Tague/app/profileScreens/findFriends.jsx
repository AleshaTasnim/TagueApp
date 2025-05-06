/**
 * findFriends.jsx - User discovery + follow management screen
 * 
 * This component provides a searchable list of users that can be followed.
 * It handles public/private account following logic with different behaviours 
 * for each account type, and manages real-time updates of following status.
 * 
 * Features:
 * - User search functionality with real-time filtering
 * - Follow/unfollow capability with dynamic UI states
 * - Support for private accounts with follow request system
 * - Follow request notifications for private accounts
 * - Pull-to-refresh for latest user data
 * - User profile navigation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, query, limit, doc, updateDoc, 
         arrayUnion, arrayRemove, getDoc, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../backend/firebaseConfig';
import { icons } from '../../constants/icons';
import { router } from 'expo-router';
import { images } from '../../constants/images';

const FindFriends = () => {
  // State variables for users data and UI interactions
  const [users, setUsers] = useState([]);                  // All users from database
  const [filteredUsers, setFilteredUsers] = useState([]);  // Users filtered by search
  const [following, setFollowing] = useState([]);          // IDs of users the current user follows
  const [requestedUsers, setRequestedUsers] = useState([]); // IDs of users with pending follow requests
  
  // UI state variables
  const [loading, setLoading] = useState(true);            // Initial loading state
  const [refreshing, setRefreshing] = useState(false);     // Pull-to-refresh state
  const [searchQuery, setSearchQuery] = useState('');      // Search input text
  const [loadingFollow, setLoadingFollow] = useState(null); // Track which user's follow button is loading
  
  // Current authenticated user reference
  const currentUser = auth.currentUser;

  // Load initial data when component mounts
  useEffect(() => {
    fetchUsers();
    fetchCurrentUserFollowing();
    fetchPendingRequests();
  }, []);
  
  // Filter users based on search query when search text changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => {
        const displayName = user.displayName?.toLowerCase() || '';
        const username = user.username?.toLowerCase() || '';
        const search = searchQuery.toLowerCase();
        
        return displayName.includes(search) || username.includes(search);
      });
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);
  
  // Fetch the list of users the current user is following
  const fetchCurrentUserFollowing = async () => {
    try {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFollowing(userData.following || []);
        }
      }
    } catch (error) {
      console.error("Error fetching following list:", error);
    }
  };
  
  // Fetch users with pending follow requests from the current user
  const fetchPendingRequests = async () => {
    try {
      if (currentUser) {
        // Query notifications collection for pending follow requests sent by current user
        const notificationsRef = collection(db, "notifications");
        const q = query(
          notificationsRef,
          where("type", "==", "follow_request"),
          where("senderId", "==", currentUser.uid),
          where("status", "==", "pending")
        );
        
        const querySnapshot = await getDocs(q);
        const pendingRequestIds = [];
        
        querySnapshot.forEach((doc) => {
          pendingRequestIds.push(doc.data().recipientId);
        });
        
        setRequestedUsers(pendingRequestIds);
      }
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    }
  };
  
  // Fetch all users from Firestore, excluding the current user
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, limit(50)); // Limit to 50 users for performance
      const querySnapshot = await getDocs(q);
      
      const fetchedUsers = [];
      querySnapshot.forEach((doc) => {
        // Don't include current user in the list
        if (doc.id !== currentUser?.uid) {
          fetchedUsers.push({ id: doc.id, ...doc.data() });
        }
      });
      
      setUsers(fetchedUsers);
      setFilteredUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle follow/unfollow action with different logic for private accounts
  const handleFollowToggle = async (userId) => {
    if (!currentUser || loadingFollow) return;
    
    // Set loading state for this specific user
    setLoadingFollow(userId);
    
    try {
      // Get target user data to use in the notification
      const targetUserDocRef = doc(db, "users", userId);
      const targetUserDocSnap = await getDoc(targetUserDocRef);
      
      if (!targetUserDocSnap.exists()) {
        throw new Error("User not found");
      }
      
      const targetUserData = targetUserDocSnap.data();
      const isPrivateAccount = targetUserData.isPrivate === true;
      
      if (following.includes(userId)) {
        // UNFOLLOW: This can be done immediately without a request
        const userDocRef = doc(db, "users", currentUser.uid);
        
        // Remove target user from current user's following list
        await updateDoc(userDocRef, {
          following: arrayRemove(userId)
        });
        
        // Remove current user from target user's followers
        await updateDoc(targetUserDocRef, {
          followers: arrayRemove(currentUser.uid)
        });
        
        // Update local state
        setFollowing(following.filter(id => id !== userId));
        
        // Update the users array with new follower count
        setUsers(users.map(user => {
          if (user.id === userId) {
            const followers = user.followers || [];
            return {
              ...user,
              followers: followers.filter(id => id !== currentUser.uid)
            };
          }
          return user;
        }));
      } else if (requestedUsers.includes(userId)) {
        // If already requested, show alert
        Alert.alert("Follow Request", "Your follow request is still pending.");
      } else {
        if (isPrivateAccount) {
          // PRIVATE ACCOUNT: Send follow request
          // Check if there's already a pending request
          const notificationsRef = collection(db, "notifications");
          const q = query(
            notificationsRef,
            where("type", "==", "follow_request"),
            where("senderId", "==", currentUser.uid),
            where("recipientId", "==", userId),
            where("status", "==", "pending")
          );
          
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            // Request already exists
            Alert.alert("Follow Request", "Your follow request is still pending.");
          } else {
            // Add target user ID to pending follow requests
            await updateDoc(targetUserDocRef, {
              pendingFollowRequests: arrayUnion(currentUser.uid)
            });
            
            // Create a follow request notification
            await addDoc(collection(db, "notifications"), {
              type: "follow_request",
              senderId: currentUser.uid,
              senderName: currentUser.displayName,
              senderPhoto: currentUser.photoURL,
              recipientId: userId,
              recipientName: targetUserData.displayName || "User",
              status: "pending",
              createdAt: serverTimestamp()
            });
            
            console.log("Follow request notification created for user", userId);
            
            // Show confirmation
            Alert.alert("Follow Request", "Your follow request has been sent.");
            
            // Update local requested users state
            setRequestedUsers([...requestedUsers, userId]);
          }
        } else {
          // PUBLIC ACCOUNT: Follow immediately
          const userDocRef = doc(db, "users", currentUser.uid);
          
          // Add target user to current user's following list
          await updateDoc(userDocRef, {
            following: arrayUnion(userId)
          });
          
          // Add current user to target user's followers
          await updateDoc(targetUserDocRef, {
            followers: arrayUnion(currentUser.uid)
          });
          
          // Create a follow notification
          await addDoc(collection(db, "notifications"), {
            type: "follow",
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            senderPhoto: currentUser.photoURL,
            recipientId: userId,
            recipientName: targetUserData.displayName || "User",
            status: "unread",
            createdAt: serverTimestamp()
          });
          
          // Update local state
          setFollowing([...following, userId]);
          
          // Update the users array with new follower count
          setUsers(users.map(user => {
            if (user.id === userId) {
              const followers = user.followers || [];
              return {
                ...user,
                followers: [...followers, currentUser.uid]
              };
            }
            return user;
          }));
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
      Alert.alert("Error", "Failed to process your request. Please try again.");
    } finally {
      // Clear loading state
      setLoadingFollow(null);
    }
  };
  
  // Navigate to user profile when a user item is tapped
  const handleViewProfile = (profileUserId) => {
    // Check if viewing own profile
    if (profileUserId === currentUser?.uid) {
      router.replace('/profile');
    } else {
      router.push({
        pathname: '../profileScreens/userProfile',
        params: { userId: profileUserId }
      });
    }
  };
  
  // Handle pull-to-refresh action to reload all data
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchUsers(), 
      fetchCurrentUserFollowing(),
      fetchPendingRequests()
    ]);
    setRefreshing(false);
  };
  
  // Navigate back with fallback option
  const goBack = () => {
    console.log("Back button pressed");
    try {
      router.back();
    } catch (error) {
      console.error("Navigation error:", error);
      // Alternative navigation if back fails
      router.replace('/');
    }
  };
  
  // Render a single user item in the list
  const renderUserItem = ({ item }) => {
    const isFollowing = following.includes(item.id);
    const isRequested = requestedUsers.includes(item.id);
    const followersCount = item.followers ? item.followers.length : 0;
    const followingCount = item.following ? item.following.length : 0;
    const isLoading = loadingFollow === item.id;
    
    return (
      <TouchableOpacity
        onPress={() => handleViewProfile(item.id)}
        className="mb-3 mx-4 rounded-xl overflow-hidden"
        activeOpacity={0.9}
      >
        {/* Gradient Background */}
        <LinearGradient
          colors={['#F3E3D3', '#E0C9B2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        
        <View className="flex-row items-center p-4">
          {/* User Avatar */}
          <View className="mr-3">
            <Image
              source={item.photoURL ? { uri: item.photoURL } : images.profilePic}
              className="w-16 h-16 rounded-full border-2 border-white"
              resizeMode="cover"
            />
          </View>
          
          {/* User Info */}
          <View className="flex-1">
            <Text className="text-lg font-bregular text-black">
              {item.displayName || 'No Name'}
            </Text>
            <Text className="text-sm font-montRegular text-black/70">
              @{item.username || item.email?.split('@')[0] || 'username'}
            </Text>
            
            {/* Follower Stats */}
            <View className="flex-row mt-1">
              <Text className="text-xs font-montMedium text-black/80">
                <Text className="font-montSemiBold">{followersCount}</Text> follower{followersCount !== 1 ? 's' : ''}
              </Text>
              <Text className="text-xs font-montMedium text-black/80 mx-2">•</Text>
              <Text className="text-xs font-montMedium text-black/80">
                <Text className="font-montSemiBold">{followingCount}</Text> following
              </Text>
            </View>
          </View>
          
          {/* Follow/Following/Requested Button with Loading State */}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation(); // Prevent triggering the parent's onPress
              handleFollowToggle(item.id);
            }}
            disabled={isLoading}
            className={`py-2 px-4 rounded-full min-w-[100px] items-center justify-center
              ${isFollowing 
                ? 'bg-primary border border-black' 
                : isRequested
                  ? 'bg-gray-400 border-2'
                  : 'bg-black'}`}
          >
            {isLoading ? (
              <ActivityIndicator 
                size="small" 
                color={isFollowing ? "black" : "#F3E3D3"} 
              />
            ) : (
              <Text className={`font-montMedium text-sm ${
                isFollowing 
                  ? 'text-black' 
                  : isRequested 
                    ? 'text-white' 
                    : 'text-primary'
              }`}>
                {isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };
  
  // Main component render
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-primary" edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* Back Button */}
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
      
      {/* Header */}
      <View className="items-center border-b border-black/10">
        <Text className="text-4xl pt-4 font-bregular text-black">Find Friends</Text>
      </View>
      
      {/* Search Bar */}
      <View className="px-4 py-3">
        <View className="flex-row items-center bg-white/50 rounded-full px-4 border">
          <Image
            source={icons.search}
            className='w-8 h-8 mr-2'
            resizeMode='contain'
            tintColor='#00000080'
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users..."
            placeholderTextColor="#00000050"
            className="flex-1 text-lg py-3 font-montRegular"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
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
      
      {/* Users List with Loading State */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000000" />
          <Text className="mt-4 text-black/70 font-montRegular">Loading users...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#000000"
              colors={["#000000"]}
            />
          }
          ListEmptyComponent={() => (
            <View className="flex-1 justify-center items-center py-16">
              {searchQuery.length > 0 ? (
                <Text className="text-lg font-montMedium text-black/70 text-center px-8">
                  No users found matching "{searchQuery}"
                </Text>
              ) : (
                <Text className="text-lg font-montMedium text-black/70 text-center px-8">
                  No users found
                </Text>
              )}
            </View>
          )}
          contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
        />
      )}
    </SafeAreaView>
  );
};

export default FindFriends;