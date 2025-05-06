/**
 * userProfile.jsx Component
 * 
 * A comprehensive user profile screen that displays user information, stats, and posts.
 * 
 * Features include:
 * - Profile display with user details (name, username, bio, profile picture)
 * - Follow/unfollow functionality with request handling for private accounts
 * - Post grid display with dynamic sizing
 * - Private account access control
 * - Pull-to-refresh functionality
 * - Modal for enlarged profile picture viewing
 * 
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
  ActivityIndicator,
  Modal,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../backend/firebaseConfig';
import { images } from '../../constants/images';
import { icons } from '../../constants/icons';
import { collection, query, where, orderBy, getDocs, getDoc, doc } from 'firebase/firestore';
import { router, useLocalSearchParams } from 'expo-router';
import followService from '../../backend/followService';

const UserProfile = () => {
  // Get user ID from route params
  const params = useLocalSearchParams();
  const profileUserId = params.userId;
  const currentUser = auth.currentUser;
  
  // State management
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [hasRequestedFollow, setHasRequestedFollow] = useState(false);
  const [isFollowingMe, setIsFollowingMe] = useState(false);
  const [isProcessingFollow, setIsProcessingFollow] = useState(false);
  const [hasViewAccess, setHasViewAccess] = useState(false);
  const { width, height } = Dimensions.get('window');
  
  // Profile picture modal state
  const [profilePictureModalVisible, setProfilePictureModalVisible] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [totalLikes, setTotalLikes] = useState(0);
  
  // Load user profile data when the profile ID changes
  useEffect(() => {
    fetchUserProfile();
  }, [profileUserId]);
  
  // Check access permissions and fetch posts when profile data is available
  useEffect(() => {
    if (userProfile) {
      checkAccessAndFetchPosts();
    }
  }, [userProfile, isFollowing]);
  
  // Check follow status when current user or profile ID changes
  useEffect(() => {
    if (currentUser && profileUserId) {
      checkFollowStatus();
    }
  }, [currentUser, profileUserId]);
  
  // Fetch user profile data from Firestore
  const fetchUserProfile = async () => {
    if (!profileUserId) return;
    
    try {
      const userDocRef = doc(db, "users", profileUserId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        setUserProfile(userDoc.data());
      } else {
        console.error("User not found");
        router.back();
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Check if current user has access to view profile content and fetch posts if permitted
  const checkAccessAndFetchPosts = async () => {
    try {
      if (currentUser && currentUser.uid === profileUserId) {
        setHasViewAccess(true);
        fetchUserPosts();
        return;
      }
      
      if (userProfile) {
        const isPrivateAccount = userProfile.isPrivate || false;
        
        if (!isPrivateAccount) {
          setHasViewAccess(true);
          fetchUserPosts();
        } else if (isFollowing) {
          setHasViewAccess(true);
          fetchUserPosts();
        } else {
          setHasViewAccess(false);
          setPosts([]);
        }
      }
    } catch (error) {
      console.error("Error checking profile access:", error);
      setHasViewAccess(false);
    }
  };
  
  // Fetch posts created by the profile user
  const fetchUserPosts = async () => {
    if (!profileUserId) return;
    
    try {
      const postsRef = collection(db, "posts");
      const q = query(
        postsRef,
        where("userId", "==", profileUserId),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const postsArray = [];
      let likesCount = 0;
      
      querySnapshot.forEach((doc) => {
        const postData = doc.data();
        postsArray.push({ id: doc.id, ...postData });
        
        if (postData.likeCount) {
          likesCount += postData.likeCount;
        } else if (postData.likedBy && Array.isArray(postData.likedBy)) {
          likesCount += postData.likedBy.length;
        } else if (postData.likes && Array.isArray(postData.likes)) {
          likesCount += postData.likes.length;
        }
      });
      
      setPosts(postsArray);
      setTotalLikes(likesCount);
    } catch (error) {
      console.error("Error fetching user posts:", error);
    }
  };
  
  // Check follow status and pending requests with the centralised follow service
  const checkFollowStatus = async () => {
    if (!currentUser || !profileUserId) return;
    
    try {
      const followStatus = await followService.checkFollowStatus(profileUserId);
      setIsFollowing(followStatus.isFollowing);
      setHasRequestedFollow(followStatus.hasRequestedFollow);
      
      const isFollowingMe = await followService.checkIsFollowingMe(profileUserId);
      setIsFollowingMe(isFollowingMe);
    } catch (error) {
      console.error("Error checking follow status:", error);
    }
  };
  
  // Handle follow/unfollow actions based on current status
  const handleFollowAction = async () => {
    if (!currentUser || !profileUserId) return;
    setIsProcessingFollow(true);
    
    try {
      const isPrivateAccount = userProfile?.isPrivate || false;
      
      if (isPrivateAccount && !isFollowing && !hasRequestedFollow) {
        setHasRequestedFollow(true);
      }
      
      const result = await followService.handleFollowAction(
        profileUserId, 
        isFollowing, 
        hasRequestedFollow
      );
      
      setIsFollowing(result.isFollowing);
      setHasRequestedFollow(result.hasRequestedFollow);
      
      if (result.action === 'requested') {
        Alert.alert("Follow Request", "Your follow request has been sent.");
      }
      
      await fetchUserProfile();
      
    } catch (error) {
      console.error("Error updating follow status:", error);
      Alert.alert("Error", "Failed to process your request. Please try again.");
      
      if (!hasRequestedFollow) {
        setHasRequestedFollow(false);
      }
    } finally {
      setIsProcessingFollow(false);
    }
  };
  
  // Toggle profile picture modal visibility
  const toggleProfilePictureModal = () => {
    setProfilePictureModalVisible(!profilePictureModalVisible);
  };
  
  // Handle pull-to-refresh functionality with complete state reset
  const onRefresh = async () => {
    setRefreshing(true);
    
    setIsFollowing(false);
    setHasRequestedFollow(false);
    setIsFollowingMe(false);
    setTotalLikes(0);
    
    await fetchUserProfile();
    await checkFollowStatus();
    
    setRefreshing(false);
  };
  
  // Navigate back to previous screen
  const handleBackButton = () => {
    router.back();
  };
  
  // Render the profile picture modal
  const renderProfilePictureModal = () => {
    if (!userProfile) return null;
    
    const profileImageSource = userProfile.photoURL 
      ? { uri: userProfile.photoURL } 
      : images.profilePic;
        
    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={profilePictureModalVisible}
        onRequestClose={toggleProfilePictureModal}
      >
        <View className="flex-1 bg-black/70 justify-center items-center">
          <View className="w-96 h-96 bg-primary rounded-xl p-3 shadow-lg border-4">
            <TouchableOpacity 
              className="absolute -top-3 -right-3 z-10 bg-primary rounded-full p-3 border-4"
              onPress={toggleProfilePictureModal}
            >
              <Image 
                source={icons.cross}
                className="w-6 h-6"
              />
            </TouchableOpacity>
            
            {imageLoading && (
              <View className="absolute inset-0 justify-center items-center">
                <ActivityIndicator size="large" color="#000" />
              </View>
            )}
            
            <Image
              source={profileImageSource}
              className="w-full h-full rounded-lg border-4"
              resizeMode="cover"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
            />
          </View>
          
          <View className="mt-4 bg-black/50 px-6 py-2 rounded-full">
            <Text className="text-xl font-montMedium text-white">
              @{userProfile.username}
            </Text>
          </View>
        </View>
      </Modal>
    );
  };
  
  // Get follow button text and styling based on current follow status
  const getFollowButtonDisplay = () => {
    const buttonInfo = followService.getFollowButtonText(isFollowing, hasRequestedFollow, isFollowingMe);
    return buttonInfo;
  };
  
  // Render the profile header section with user info and stats
  const renderHeader = () => {
    if (!userProfile) {
      return <View className="py-8 items-center"><ActivityIndicator size="large" color="#000" /></View>;
    }
    
    const isPrivateAccount = userProfile.isPrivate || false;
    const followButtonInfo = getFollowButtonDisplay();
    
    return (
      <View>
        <View className="rounded-b-xl pb-4 mb-4 overflow-hidden">
          <View className="absolute top-1 left-1 z-10">
            <TouchableOpacity 
              onPress={handleBackButton}
              className="rounded-full"
            >
              <Image
                source={icons.backArrow}
                className="w-12 h-12"
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <View className="justify-center items-center pt-12 pb-2">
            <Text className="text-5xl pt-2 font-bregular text-black">
              {userProfile.displayName || 'No Name'}
            </Text>

            <TouchableOpacity 
              onPress={toggleProfilePictureModal}
              className="p-1 rounded-full bg-white shadow-md mb-3"
              activeOpacity={0.8}
            >
              <Image
                source={userProfile.photoURL ? { uri: userProfile.photoURL } : images.profilePic}
                className="w-32 h-32 rounded-full border-2 border-white"
                resizeMode="cover"
              />
            </TouchableOpacity>

            <View className="bg-black/10 px-4 py-1 rounded-full mt-2">
              <Text className="text-xl font-montMedium text-black">
                @{userProfile.username}
              </Text>
            </View>
            
            {isPrivateAccount && (
              <View className="bg-black/10 px-4 py-1 rounded-full mt-2 flex-row items-center">
                <Image 
                  source={icons.lock || {uri: 'https://cdn-icons-png.flaticon.com/512/482/482636.png'}}
                  className="w-4 h-4 mr-1"
                  resizeMode="contain"
                />
                <Text className="text-sm font-montMedium text-black/80">
                  Private Account
                </Text>
              </View>
            )}
            
            {currentUser && currentUser.uid !== profileUserId && (
              <TouchableOpacity 
                onPress={handleFollowAction}
                disabled={isProcessingFollow}
                className={`px-6 py-2 mt-3 rounded-full flex-row items-center justify-center ${followButtonInfo.bgColor}`}
              >
                {isProcessingFollow ? (
                  <ActivityIndicator 
                    size="small" 
                    color={isFollowing ? "black" : "#F3E3D3"} 
                  />
                ) : (
                  <>
                    <Text className={`font-montMedium text-lg mr-1 ${followButtonInfo.textColor}`}>
                      {followButtonInfo.text}
                    </Text>
                    {(!isFollowing && !hasRequestedFollow) && (
                      <Image 
                        source={icons.addUser || require('../../assets/icons/addUser.png')}
                        className="w-6 h-6" 
                        tintColor="#F3E3D3"
                      />
                    )}
                  </>
                )}
              </TouchableOpacity>
            )}
            
            {userProfile.bio ? (
              <View className="mt-3 px-8 w-full">
                <Text className="text-lg font-montRegular text-center text-black/80">
                  {userProfile.bio}
                </Text>
              </View>
            ) : (
              <View className="mt-3 px-8 w-full">
                <Text className="text-lg italic font-montRegular text-center text-black/60">
                  No bio.
                </Text>
              </View>
            )}
            
            <View className="flex-row justify-center items-center mt-4 px-8">
              <TouchableOpacity 
                className="flex-1 items-center"
                onPress={() => (userProfile.following?.length > 0) && router.push({
                  pathname: '/profileScreens/followingModal',
                  params: { userId: profileUserId }
                })}
              >
                <Text className="text-m font-montMedium text-black/70">Following</Text>
                <Text className="text-xl font-montSemiBold text-center text-black">
                  {userProfile.following?.length || 0}
                </Text>
              </TouchableOpacity>
              
              <View className="h-10 w-px bg-black/20" />
              
              <TouchableOpacity 
                className="flex-1 items-center"
                onPress={() => (userProfile.followers?.length > 0) && router.push({
                  pathname: '/profileScreens/followersModal',
                  params: { userId: profileUserId }
                })}
              >
                <Text className="text-m font-montMedium text-black/70">Followers</Text>
                <Text className="text-xl font-montSemiBold text-center text-black">
                  {userProfile.followers?.length || 0}
                </Text>
              </TouchableOpacity>
              
              <View className="h-10 w-px bg-black/20" />
              
              <View className="flex-1 items-center">
                <Text className="text-m font-montMedium text-black/70">Likes</Text>
                <Text className="text-xl font-montSemiBold text-center text-black">{totalLikes}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row items-center justify-between px-6 mb-4">
          <Text className="text-2xl font-montSemiBold text-black">Collection</Text>
          <Text className="text-sm font-montRegular text-black/60">{posts.length} posts</Text>
        </View>
      </View>
    );
  };

  // Calculate grid layout dimensions
  const numColumns = 2;
  const gap = 12;
  const itemWidth = (width - 32 - gap * (numColumns - 1)) / numColumns;
  
  // Render individual post item in the grid
  const renderItem = ({ item, index }) => {
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
        activeOpacity={0.9}
        onPress={() => router.push({
          pathname: '../profileScreens/viewUserPost',
          params: { postId: item.id }
        })}
      >
        <View 
          className="rounded-xl overflow-hidden shadow-sm border-4 border-black"
          style={{ aspectRatio: 3/4 }}
        >
          <Image
            source={{ uri: item.imageUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
          
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

  // Format data to handle odd number of posts with placeholder items
  const formatData = (dataList, numColumns) => {
    const totalRows = Math.ceil(dataList.length / numColumns);
    let totalItems = totalRows * numColumns;
    
    const formattedData = [...dataList];
    const remainingItems = totalItems - dataList.length;
    
    for (let i = 0; i < remainingItems; i++) {
      formattedData.push({ id: `empty-${i}`, empty: true });
    }
    
    return formattedData;
  };

  // Render message for private accounts when user doesn't have access
  const renderPrivateAccountMessage = () => {
    const followButtonInfo = getFollowButtonDisplay();
    
    return (
      <View className="flex-1 justify-center items-center p-8">
        <View className="bg-black/5 p-6 rounded-xl items-center">
          <Image 
            source={icons.lock || {uri: 'https://cdn-icons-png.flaticon.com/512/482/482636.png'}}
            className="w-16 h-16 mb-4 opacity-60"
            resizeMode="contain"
          />
          <Text className="text-xl font-montSemiBold text-black/80 text-center mb-2">
            This Account is Private
          </Text>
          <Text className="text-base font-montRegular text-black/60 text-center mb-4">
            Follow this account to see their photos and posts
          </Text>
          
          {currentUser && currentUser.uid !== profileUserId && !hasRequestedFollow && !isFollowing && (
            <TouchableOpacity 
              onPress={handleFollowAction}
              disabled={isProcessingFollow}
              className={`px-6 py-3 rounded-full items-center ${followButtonInfo.bgColor}`}
            >
              {isProcessingFollow ? (
                <ActivityIndicator size="small" color="#F3E3D3" />
              ) : (
                <Text className={followButtonInfo.textColor + " font-montSemiBold"}>
                  {followButtonInfo.text}
                </Text>
              )}
            </TouchableOpacity>
          )}
          
          {hasRequestedFollow && (
            <Text className="text-base font-montMedium text-black/70 text-center">
              Your follow request is pending
            </Text>
          )}
        </View>
      </View>
    );
  };

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }} className="bg-primary" edges={['top']}>
        <StatusBar barStyle="dark-content" />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#000" />
        </View>
      </SafeAreaView>
    );
  }

  // Render main component
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-primary" edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      {renderProfilePictureModal()}
      
      {userProfile?.isPrivate && !hasViewAccess ? (
        <>
          <FlatList
            key="header-only"
            data={[]}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={renderPrivateAccountMessage}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                tintColor="#C9B8A7"
                colors={["#C9B8A7"]}
              />
            }
            contentContainerStyle={{ flexGrow: 1 }}
          />
        </>
      ) : (
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
            </View>
          )}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={posts.length > 0 ? { justifyContent: 'flex-start' } : undefined}
        />
      )}
    </SafeAreaView>
  );
};

export default UserProfile;