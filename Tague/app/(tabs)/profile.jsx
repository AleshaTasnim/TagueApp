/**
 * Profile.jsx - User profile screen
 * 
 * This component displays the user's profile with their personal information and posts.
 * It provides functionality for viewing and editing profile details, managing the profile
 * picture, tracking followers/following, and displaying user posts in a grid layout.
 * 
 * Features:
 * - Display and edit profile information (bio, username)
 * - Upload, change, or remove profile pictures
 * - View followers and following lists
 * - Display user posts in a grid with navigation to post details
 * - Pull-to-refresh for latest data
 * - Side menu integration
 * - Create new posts via floating action button
 */
import React, { useState, useEffect } from 'react';
import { 
  Image, 
  FlatList, 
  Text, 
  View, 
  TouchableOpacity, 
  RefreshControl, 
  Dimensions, 
  StatusBar,
  Modal,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db, storage } from '../../backend/firebaseConfig';
import { images } from '../../constants/images';
import { icons } from '../../constants/icons';
import SideMenu from '../../components/profileComponents/sideMenu';
import { collection, query, where, orderBy, onSnapshot, getDocs, getDoc, updateDoc, doc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';

const Profile = () => {
  // State variables for user profile, posts, and UI elements
  const user = auth.currentUser;
  const [menuVisible, setMenuVisible] = useState(false);
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = Dimensions.get('window');
  
  // Profile image related state
  const [profileImageModalVisible, setProfileImageModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [cachedProfileImage, setCachedProfileImage] = useState(
    user?.photoURL || null
  );
  
  // User profile data state
  const [userBio, setUserBio] = useState('');
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [username, setUsername] = useState([]);
  const [totalLikes, setTotalLikes] = useState(0);
  
  // Load user profile data from Firestore on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserBio(userData.bio || '');
            setFollowers(userData.followers || []);
            setFollowing(userData.following || []);
            setUsername(userData.username || ''); 
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    };
    
    fetchUserData();
  }, [user]);
  
  // Refresh data when screen comes into focus
  useEffect(() => {
    const unsubscribe = router.addListener?.('focus', () => {
      // Refresh data
      if (user) {
        const fetchData = async () => {
          try {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setUserBio(userData.bio || '');
              setFollowers(userData.followers || []);
              setFollowing(userData.following || []);
            }
          } catch (error) {
            console.error("Error refreshing data:", error);
          }
        };
        fetchData();
      }
    });
    
    return () => unsubscribe && unsubscribe();
  }, [user]);
  
  // Update cached profile image to prevent flickering
  useEffect(() => {
    if (user?.photoURL !== cachedProfileImage) {
      setCachedProfileImage(user?.photoURL || null);
    }
  }, [user?.photoURL]);

  // Fetch user posts from Firestore with real-time updates
  useEffect(() => {
    if (user) {
      const postsRef = collection(db, "posts");
      const q = query(
        postsRef,
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const postsArray = [];
        let likesCount = 0; // Initialize counter for total likes
        
        snapshot.forEach(doc => {
          const postData = doc.data();
          postsArray.push({ id: doc.id, ...postData });
          
          // Check all possible ways likes could be stored
          if (postData.likeCount) {
            // If likeCount field exists, use it directly
            likesCount += postData.likeCount;
          } else if (postData.likedBy && Array.isArray(postData.likedBy)) {
            // If likedBy array exists, count its length
            likesCount += postData.likedBy.length;
          } else if (postData.likes && Array.isArray(postData.likes)) {
            // For backward compatibility if you used 'likes' array before
            likesCount += postData.likes.length;
          }
        });
        
        setPosts(postsArray);
        setTotalLikes(likesCount); // Update the total likes state
      });
      return () => unsubscribe();
    }
  }, [user]);
  

  // Handle pull-to-refresh functionality to refresh user data and posts
  const onRefresh = async () => {
    setRefreshing(true);
    if (user) {
      try {
        // Refresh user bio and followers/following
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserBio(userData.bio || '');
          setFollowers(userData.followers || []);
          setFollowing(userData.following || []);
        }
        
        // Refresh posts and recalculate total likes
        const postsRef = collection(db, "posts");
        const q = query(
          postsRef,
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const postsArray = [];
        let likesCount = 0;
        
        snapshot.forEach(doc => {
          const postData = doc.data();
          postsArray.push({ id: doc.id, ...postData });
          
          // Check all possible ways likes could be stored
          if (postData.likeCount) {
            // If likeCount field exists, use it directly
            likesCount += postData.likeCount;
          } else if (postData.likedBy && Array.isArray(postData.likedBy)) {
            // If likedBy array exists, count its length
            likesCount += postData.likedBy.length;
          } else if (postData.likes && Array.isArray(postData.likes)) {
            // For backward compatibility if you used 'likes' array before
            likesCount += postData.likes.length;
          }
        });
        
        setPosts(postsArray);
        setTotalLikes(likesCount);
      } catch (error) {
        console.error("Error refreshing data:", error);
      }
    }
    setRefreshing(false);
  };    

  // Open device image picker to select a new profile image
  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to change your profile picture!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alert('Failed to select image. Please try again.');
    }
  };

  // Upload selected profile image to Firebase Storage and update user profile
  const uploadProfileImage = async (uri) => {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Use a consistent filepath pattern without timestamps
      // This ensures we always replace the same file
      const storageRef = ref(storage, `profilePics/${user.uid}`);
      
      // Upload image
      await uploadBytes(storageRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      // Add cache busting parameter to force refresh of cached images
      const cacheBustedURL = `${downloadURL}?t=${Date.now()}`;
      
      // Update cached image first to prevent flicker
      setCachedProfileImage(cacheBustedURL);
      
      // Update user profile
      await updateProfile(user, {
        photoURL: downloadURL
      });
      
      // Update user document in Firestore to ensure consistent image path
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        photoURL: downloadURL
      });
      
      // Close modal after successful upload
      setProfileImageModalVisible(false);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Remove current profile image from storage and update user profile
  const handleRemoveImage = async () => {
    if (!cachedProfileImage) {
      setProfileImageModalVisible(false);
      return;
    }

    setUploading(true);
    try {
      // Delete image from storage if it exists
      const storageRef = ref(storage, `profilePics/${user.uid}`);
      
      try {
        await deleteObject(storageRef);
        console.log('Profile image deleted from storage');
      } catch (deleteError) {
        // If image doesn't exist in storage, just continue
        console.log('Image may not exist in storage or could not be deleted:', deleteError);
      }
      
      // Update cached image first
      setCachedProfileImage(null);
      
      // Update user profile
      await updateProfile(user, {
        photoURL: null
      });
      
      // Update user document in Firestore
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        photoURL: null
      });
      
      // Close modal
      setProfileImageModalVisible(false);
    } catch (error) {
      console.error('Error removing image:', error);
      alert('Failed to remove image. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  // Navigate to edit profile screen
  const handleEditProfile = () => {
    router.push('/profileScreens/editProfile');
  };

  // Navigate to create post modal
  const handleAddButton = () => {
    router.push('/createScreens/createModal');
  };

  // Navigate to find friends screen
  const handleFindFriends = () => {
    router.push('/profileScreens/findFriends');
  };

  // Render profile header section with user info and statistics
  const renderHeader = () => (
    <View>
      {/* Profile Header with Gradient Background */}
      <View className={`rounded-b-xl pb-4 mb- overflow-hidden ${Platform.OS === 'android' ? 'pt-4' : undefined}`}>
        
        {/* Menu Button */}
        <View className="flex-row justify-between items-center w-full">
          
          <TouchableOpacity 
            onPress={() => router.push('../profileScreens/notifications')}
            className="p-2"
          >
            <Image
              source={icons.notification}
              className="w-10 h-10"
              resizeMode="contain"
              fadeDuration={0}
              cachePolicy="memory-disk"
              shouldNotifyLoadEvents={false}
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => setMenuVisible(true)}
            className="p-2"
          >
            <Image
              source={icons.menu}
              className="w-10 h-10"
              resizeMode="contain"
              fadeDuration={0}
              cachePolicy="memory-disk"
              shouldNotifyLoadEvents={false}
            />
          </TouchableOpacity>
        </View>

        {/* Profile Info Section */}
        <View className="justify-center items-center pb-2">
          {/* User Display Name */}
          <Text className="text-5xl font-bregular text-black">
            {user?.displayName || 'No Name'}
          </Text>

          {/* Profile Picture with Edit Button */}
          <TouchableOpacity 
            onPress={() => setProfileImageModalVisible(true)}
            className="p-1 rounded-full bg-white shadow-md mb-3"
            activeOpacity={0.8}
          >
            <Image
              source={cachedProfileImage ? { uri: cachedProfileImage } : images.profilePic}
              className="w-32 h-32 rounded-full border-2 border-white"
              resizeMode="cover"
              // Add these properties:
              fadeDuration={0}
              // This tells React Native to prioritize keeping this in memory
              cachePolicy="memory-disk"
              // Prevents reloading when app returns from background
              shouldNotifyLoadEvents={false}
            />
            <View className="absolute bottom-1 right-1 bg-black w-8 h-8 rounded-full items-center justify-center">
              <Image 
                source={icons.edit} 
                className="w-4 h-4" 
                tintColor="#F3E3D3"
                // Add these properties:
                fadeDuration={0}
                // This tells React Native to prioritize keeping this in memory
                cachePolicy="memory-disk"
                // Prevents reloading when app returns from background
                shouldNotifyLoadEvents={false}
              />
            </View>
          </TouchableOpacity>


          {/* Username Badge */}
          <View className="bg-black/10 px-4 py-1 rounded-full mt-2">
            <Text className="text-xl font-montMedium text-black">
              @{username}
            </Text>
          </View>
          
          {/* Profile Action Buttons */}
          <View className="flex-row justify-center mt-3 gap-2">
            {/* Edit Profile Button */}
            <TouchableOpacity 
              onPress={handleEditProfile}
              className="px-6 py-2 bg-black rounded-full flex-row items-center justify-center"
            >
              <Text className="text-primary font-montMedium text-lg mr-1">Edit Profile</Text>
              <Image 
                source={icons.edit} 
                className="w-6 h-6" 
                tintColor="#F3E3D3"
                // Add these properties:
                fadeDuration={0}
                // This tells React Native to prioritize keeping this in memory
                cachePolicy="memory-disk"
                // Prevents reloading when app returns from background
                shouldNotifyLoadEvents={false}
              />
            </TouchableOpacity>

            {/* Find Friends Button */}
            <TouchableOpacity 
              onPress={handleFindFriends}
              className="px-6 py-2 bg-black rounded-full flex-row items-center justify-center"
            >
              <Text className="text-primary font-montMedium text-lg mr-1">Find Friends</Text>
              <Image 
                source={icons.addUser} 
                className="w-6 h-6" 
                tintColor="#F3E3D3"
                // Add these properties:
                fadeDuration={0}
                // This tells React Native to prioritize keeping this in memory
                cachePolicy="memory-disk"
                // Prevents reloading when app returns from background
                shouldNotifyLoadEvents={false}
              />
            </TouchableOpacity>
          </View>
          
          {/* Bio Section */}
          {userBio ? (
            <View className="mt-3 px-8 w-full">
              <Text className="text-lg font-montRegular text-center text-black/80">
                {userBio}
              </Text>
            </View>
          ) : (
            <View className="mt-3 px-8 w-full">
              <Text className="text-lg italic font-montRegular text-center text-black/60">
                No bio yet. Tap 'Edit Profile' to add one.
              </Text>
            </View>
          )}
          
          {/* Stats Section with Dividers */}
          <View className="flex-row justify-center items-center mt-4 px-8">
            {/* Following Count */}
            <TouchableOpacity 
              className="flex-1 items-center"
              onPress={() => following.length > 0 && router.push({
                pathname: '/profileScreens/followingModal',
                params: { userId: user.uid }
              })}
            >
              <Text className="text-m font-montMedium text-black/70">Following</Text>
              <Text className="text-xl font-montSemiBold text-center text-black">{following.length}</Text>
            </TouchableOpacity>
            
            <View className="h-10 w-px bg-black/20" />
            
            {/* Followers Count */}
            <TouchableOpacity 
              className="flex-1 items-center"
              onPress={() => followers.length > 0 && router.push({
                pathname: '/profileScreens/followersModal',
                params: { userId: user.uid }
              })}
            >
              <Text className="text-m font-montMedium text-black/70">Followers</Text>
              <Text className="text-xl font-montSemiBold text-center text-black">{followers.length}</Text>
            </TouchableOpacity>
            
            <View className="h-10 w-px bg-black/20" />
            
            {/* Likes Count */}
            <View className="flex-1 items-center">
              <Text className="text-m font-montMedium text-black/70">Likes</Text>
            <Text className="text-xl font-montSemiBold text-center text-black">{totalLikes}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* My Posts Section Header */}
      <View className="flex-row items-center justify-between px-6 mb-4">
        <Text className="text-2xl font-montSemiBold text-black">My Collection</Text>
        <Text className="text-sm font-montRegular text-black/60">{posts.length} posts</Text>
      </View>
    </View>
  );

  // Calculate grid layout dimensions for post display
  const numColumns = 2;
  const gap = 12;
  const itemWidth = (width - 32 - gap * (numColumns - 1)) / numColumns;
  
  // Render individual post item in the grid
  const renderItem = ({ item, index }) => {
    // Return empty space for placeholder items
    if (item.empty) {
      return <View style={{ width: itemWidth, marginLeft: index % numColumns !== 0 ? gap : 0 }} />;
    }
    
    return (
      <TouchableOpacity 
        style={{ 
          width: itemWidth, 
          marginLeft: index % numColumns !== 0 ? gap : 0,
          marginBottom: gap
        }}
        onPress={() => {
          if (!item.empty) {
            router.push({
              pathname: '/profileScreens/postModal',
              params: { postId: item.id }
            });
          }
        }}
        activeOpacity={0.9}
      >
        {/* Post Image */}
        <View 
          className="rounded-xl overflow-hidden shadow-sm border-4 border-black"
          style={{ aspectRatio: 3/4 }}
        >
          <Image
            source={{ uri: item.imageUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
          
          {/* Tags Count Badge */}
          {item.tags && item.tags.length > 0 && (
            <View className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded-full">
              <Text className="text-xs font-montMedium text-white">
                {item.tags.length} {item.tags.length === 1 ? 'tag' : 'tags'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Format post data to handle odd number of posts with placeholders for grid layout
  const formatData = (dataList, numColumns) => {
    const totalRows = Math.ceil(dataList.length / numColumns);
    let totalItems = totalRows * numColumns;
    
    const formattedData = [...dataList];
    const remainingItems = totalItems - dataList.length;
    
    // Add placeholder items for empty spaces
    for (let i = 0; i < remainingItems; i++) {
      formattedData.push({ id: `empty-${i}`, empty: true });
    }
    
    return formattedData;
  };

  // Main component render with profile data and post grid
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-primary" edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {/* Posts Grid */}
      <FlatList
        key={`flatlist-${numColumns}`}
        data={formatData(posts, numColumns)}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#C9B8A7"
            colors={["#C9B8A7"]}
          />
        }
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => (
          <View className="flex-1 justify-center items-center py-16">
            <Text className="text-xl font-montMedium text-black/70">No posts yet</Text>
            <Text className="text-sm font-montRegular text-black/50 mt-2">
              Create your first post by tapping the + button
            </Text>
          </View>
        )}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={posts.length > 0 ? { justifyContent: 'flex-start' } : undefined}
      />
      
      {/* Floating Add Post Button */}
      <TouchableOpacity 
        onPress={handleAddButton}
        className="absolute bottom-8 right-8 bg-black w-14 h-14 rounded-full justify-center items-center shadow-lg"
        activeOpacity={0.9}
      >
        <Text className="text-primary text-3xl font-bold" style={{ marginTop: -3 }}>+</Text>
      </TouchableOpacity>
      
      {/* Side Menu */}
      <SideMenu isVisible={menuVisible} onClose={() => setMenuVisible(false)} />
      
      {/* Profile Image Modal */}
      <Modal
        visible={profileImageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setProfileImageModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-primary w-11/12 rounded-2xl overflow-hidden">
            {/* Profile Image Display */}
            <View className="w-full aspect-square">
              <Image
                source={cachedProfileImage ? { uri: cachedProfileImage } : images.profilePic}
                className="w-full h-full"
                resizeMode="contain"
              />
            </View>
            
            {/* Action Buttons */}
            <View className="p-6">
              {/* Change Profile Picture Button */}
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={uploading}
                className="bg-black py-4 mb-3 rounded-xl items-center"
              >
                <Text className="text-primary font-montMedium text-lg">
                  {uploading ? 'Uploading...' : 'Change Profile Picture'}
                </Text>
              </TouchableOpacity>
              
              {/* Remove Profile Picture Button */}
              <TouchableOpacity
                onPress={handleRemoveImage}
                disabled={uploading || !cachedProfileImage}
                className={`py-4 mb-3 rounded-xl items-center border-2 border-black ${
                  !cachedProfileImage ? 'opacity-50' : ''
                }`}
              >
                <Text className="text-black font-montMedium text-lg">
                  Remove Profile Picture
                </Text>
              </TouchableOpacity>
              
              {/* Cancel Button */}
              <TouchableOpacity
                onPress={() => setProfileImageModalVisible(false)}
                className="py-4 rounded-xl items-center"
              >
                <Text className="text-black/60 font-montMedium text-lg">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default Profile;