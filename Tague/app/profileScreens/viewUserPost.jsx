/**
 * viewUserPost.js
 * 
 * A component for displaying details of another user's post when clicked from the home feed.
 * Includes image viewing with interactive product markers/tags, caption display, product tags,
 * user profile information, post interaction functionality (bookmark and like), and comments.
 * 
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Image, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { icons } from '../../constants/icons';
import { images } from '../../constants/images';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { 
  doc, 
  addDoc,
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  arrayUnion,
  arrayRemove,
  increment,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import CommentsModal from './commentModal';
import BoardSelectionModal from './boardSelectionModal';

const ViewUserPost = () => {
  // Clean up listeners when component unmounts
  const commentsListener = useRef(null);
  
  useEffect(() => {
    return () => {
      if (commentsListener.current) {
        commentsListener.current();
      }
    };
  }, []);
  
  /**
   * Screen options component for header configuration
   * Sets headerShown to false to use custom header
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

  // State management for component
  const { postId } = useLocalSearchParams();
  const router = useRouter();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('post');
  
  // Post data and loading states
  const [post, setPost] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Bookmark state
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  
  // Like state
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);
  
  // Comments state
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  
  // Image dimension states for positioning markers
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageOriginalDimensions, setImageOriginalDimensions] = useState({ width: 0, height: 0 });
  const [imageLayout, setImageLayout] = useState(null);

  // Tag modal states for viewing tags
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  
  // Board selection modal state
  const [boardModalVisible, setBoardModalVisible] = useState(false);
  
  // Screen dimensions for responsive layouts
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  /**
   * Fetches user data for the post owner
   */
  useEffect(() => {
    const fetchUserData = async () => {
      if (post?.userId) {
        try {
          const userRef = doc(db, "users", post.userId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            setUserData(userSnap.data());
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    };
    
    fetchUserData();
  }, [post]);

  /**
   * Fetches post data from Firestore based on postId
   */
  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) {
        setError('No post ID provided');
        setLoading(false);
        return;
      }
      
      try {
        const postDocRef = doc(db, "posts", postId);
        const postDoc = await getDoc(postDocRef);
        
        if (postDoc.exists()) {
          const postData = { id: postDoc.id, ...postDoc.data() };
          setPost(postData);
          
          // Set like count
          setLikeCount(postData.likeCount || 0);
          
          // Set comments count
          setCommentsCount(postData.commentsCount || 0);
          
          // Rest of your existing code...
        } else {
          // Post doesn't exist (was deleted)
          setError('Post deleted');
          
          // Handle cleanup if user is logged in
          if (auth.currentUser) {
            try {
              // 1. Remove from bookmarks
              const bookmarkRef = doc(db, "users", auth.currentUser.uid, "bookmarkedPosts", postId);
              await deleteDoc(bookmarkRef).catch(err => console.log("Bookmark already removed or doesn't exist"));
              
              // 2. Remove from all inspiration boards
              const boardsRef = collection(db, "users", auth.currentUser.uid, "inspoBoards");
              const boardsSnapshot = await getDocs(boardsRef);
              
              // Update each board that contains this post
              for (const boardDoc of boardsSnapshot.docs) {
                const boardData = boardDoc.data();
                const posts = boardData.posts || [];
                
                if (posts.includes(postId)) {
                  // Remove from board
                  await updateDoc(boardDoc.ref, {
                    posts: arrayRemove(postId),
                    postCount: Math.max(0, (boardData.postCount || posts.length) - 1),
                    updatedAt: new Date()
                  });
                }
              }
            } catch (cleanupError) {
              console.error("Error cleaning up after deleted post:", cleanupError);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching post:", err);
        setError('Failed to load post');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPost();
  }, [postId]);
  
  /**
   * Checks if post is already bookmarked and liked by the current user
   */
  useEffect(() => {
    const checkUserInteractions = async () => {
      if (!auth.currentUser || !postId) return;
      
      try {
        // Get the post data first
        const postDocRef = doc(db, "posts", postId);
        const postDoc = await getDoc(postDocRef);
        
        if (!postDoc.exists()) {
          return;
        }
        
        const postData = postDoc.data();
        
        // If post is from another user, check privacy settings
        if (postData.userId && postData.userId !== auth.currentUser.uid) {
          // Get current user's following list
          const currentUserRef = doc(db, "users", auth.currentUser.uid);
          const currentUserDoc = await getDoc(currentUserRef);
          const currentUserFollowing = currentUserDoc.exists() ? 
            (currentUserDoc.data().following || []) : [];
          
          // Check if post owner is private and not followed
          const postOwnerRef = doc(db, "users", postData.userId);
          const postOwnerDoc = await getDoc(postOwnerRef);
          
          if (postOwnerDoc.exists()) {
            const postOwner = postOwnerDoc.data();
            
            // If owner is private and current user is not following them
            if (postOwner.isPrivate === true && !currentUserFollowing.includes(postData.userId)) {
              // Force bookmark status to false - user can't bookmark private unfollowed user's posts
              setIsBookmarked(false);
              
              // Remove the bookmark if it exists
              try {
                const bookmarkRef = doc(db, "users", auth.currentUser.uid, "bookmarkedPosts", postId);
                const bookmarkDoc = await getDoc(bookmarkRef);
                
                if (bookmarkDoc.exists()) {
                  await deleteDoc(bookmarkRef);
                  console.log(`Removed bookmark for post ${postId} from private unfollowed user ${postData.userId}`);
                }
              } catch (err) {
                console.error("Error checking/removing bookmark:", err);
              }
              
              // Set likes and other interactions
              const likedBy = postData.likedBy || [];
              setIsLiked(likedBy.includes(auth.currentUser.uid));
              setLikeCount(postData.likeCount || 0);
              return;
            }
          }
        }
        
        // Normal interaction check for public accounts or followed private accounts
        // Check bookmark status
        const userBookmarksRef = collection(db, "users", auth.currentUser.uid, "bookmarkedPosts");
        const bookmarkedPostRef = doc(userBookmarksRef, postId);
        const bookmarkDoc = await getDoc(bookmarkedPostRef);
        setIsBookmarked(bookmarkDoc.exists());
        
        // Check like status
        const likedBy = postData.likedBy || [];
        setIsLiked(likedBy.includes(auth.currentUser.uid));
        setLikeCount(postData.likeCount || 0);
      } catch (error) {
        console.error("Error checking user interactions:", error);
      }
    };
  
    checkUserInteractions();
  }, [postId]);
  
  /**
   * Gets image dimensions if not available from metadata
   */
  useEffect(() => {
    if (post?.imageUrl && !imageOriginalDimensions.width) {
      // If we don't have dimensions from metadata, fetch them from the image
      Image.getSize(post.imageUrl, 
        (width, height) => {
          console.log("Image actual dimensions from getSize:", width, height);
          setImageOriginalDimensions({ width, height });
        },
        (error) => console.error("Failed to get image size:", error)
      );
    }
  }, [post?.imageUrl, imageOriginalDimensions.width]);
  
  /**
   * Sets up real-time listener for comments
   */
  useEffect(() => {
    if (!postId) return;
    
    const commentsRef = collection(db, "posts", postId, "comments");
    const commentsQuery = query(commentsRef, orderBy("createdAt", "desc"));
    
    // Set up real-time listener for comments
    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const commentsData = [];
      let count = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only include comments with valid data
        if (data.userId && data.comment) {
          commentsData.push({
            id: doc.id,
            ...data,
            // Convert Firestore timestamp to JS Date if it exists
            createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
          });
          count++;
        }
      });
      
      setComments(commentsData);
      setCommentsCount(count);
      
      // Update the post's comment count if it differs
      if (post && post.commentsCount !== count) {
        const postRef = doc(db, "posts", postId);
        updateDoc(postRef, { commentsCount: count }).catch(err => {
          console.error("Error updating comment count:", err);
        });
      }
    }, (error) => {
      console.error("Error fetching comments:", error);
    });
    
    commentsListener.current = unsubscribe;
    
    return () => {
      unsubscribe();
    };
  }, [postId, post]);

  /**
   * Handles long press on the bookmark button to show board selection modal
   */
  const handleBookmarkLongPress = () => {
    if (!auth.currentUser) {
      Alert.alert("Sign In Required", "Please sign in to bookmark posts");
      return;
    }
    
    // Check if post owner is private and not followed
    if (post?.userId && post.userId !== auth.currentUser.uid) {
      const checkPrivacy = async () => {
        try {
          // Get current user's following list
          const currentUserRef = doc(db, "users", auth.currentUser.uid);
          const currentUserDoc = await getDoc(currentUserRef);
          const currentUserFollowing = currentUserDoc.exists() ? 
            (currentUserDoc.data().following || []) : [];
          
          // Check post owner's privacy settings
          const postOwnerRef = doc(db, "users", post.userId);
          const postOwnerDoc = await getDoc(postOwnerRef);
          
          if (postOwnerDoc.exists()) {
            const postOwner = postOwnerDoc.data();
            
            // If owner is private and current user is not following them
            if (postOwner.isPrivate === true && !currentUserFollowing.includes(post.userId)) {
              Alert.alert(
                "Cannot Bookmark",
                "You cannot bookmark posts from private accounts you don't follow."
              );
              return;
            }
          }
          
          // If not private or is followed, show board selection modal
          setBoardModalVisible(true);
        } catch (error) {
          console.error("Error checking user privacy:", error);
        }
      };
      
      checkPrivacy();
    } else {
      // For user's own posts or public posts
      setBoardModalVisible(true);
    }
  };
  
  /**
   * Handles the selection of a board from the modal
   */
  const handleBoardSelected = (boardId, success) => {
    if (success) {
      setIsBookmarked(true);
    }
  };
  
  /**
   * Handles bookmark/unbookmark post action
   */
  const toggleBookmark = async () => {
    if (!auth.currentUser) {
      Alert.alert("Sign In Required", "Please sign in to bookmark posts");
      return;
    }
    
    if (!post) return;
    
    setBookmarkLoading(true);
    
    try {
      // Check if post owner is private and not followed
      if (post.userId && post.userId !== auth.currentUser.uid) {
        // Get current user's following list
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const currentUserDoc = await getDoc(currentUserRef);
        const currentUserFollowing = currentUserDoc.exists() ? 
          (currentUserDoc.data().following || []) : [];
        
        // Check post owner's privacy settings
        const postOwnerRef = doc(db, "users", post.userId);
        const postOwnerDoc = await getDoc(postOwnerRef);
        
        if (postOwnerDoc.exists()) {
          const postOwner = postOwnerDoc.data();
          
          // If owner is private and current user is not following them
          if (postOwner.isPrivate === true && !currentUserFollowing.includes(post.userId)) {
            // Cannot bookmark private user's posts when not following
            Alert.alert(
              "Cannot Bookmark",
              "You cannot bookmark posts from private accounts you don't follow."
            );
            setIsBookmarked(false);
            setBookmarkLoading(false);
            return;
          }
        }
      }
      
      // Proceed with normal bookmark toggling
      const userBookmarksRef = collection(db, "users", auth.currentUser.uid, "bookmarkedPosts");
      const bookmarkedPostRef = doc(userBookmarksRef, postId);
      
      if (isBookmarked) {
        // Remove bookmark
        await deleteDoc(bookmarkedPostRef);
        setIsBookmarked(false);
      } else {
        // Add bookmark - store important post data
        const bookmarkData = {
          postId: post.id,
          userId: post.userId,
          imageUrl: post.imageUrl,
          caption: post.caption,
          createdAt: post.createdAt,
          bookmarkedAt: new Date()
        };
        
        await setDoc(bookmarkedPostRef, bookmarkData);
        setIsBookmarked(true);
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      Alert.alert("Error", "Failed to update bookmark");
    } finally {
      setBookmarkLoading(false);
    }
  };
  
  /**
   * Handles like/unlike post action
   */
  const toggleLike = async () => {
    if (!auth.currentUser) {
      Alert.alert("Sign In Required", "Please sign in to like posts");
      return;
    }
    
    if (!post) return;
    
    setLikeLoading(true);
    
    try {
      const postRef = doc(db, "posts", postId);
      
      if (isLiked) {
        // UNLIKE: Remove like from post
        await updateDoc(postRef, {
          likedBy: arrayRemove(auth.currentUser.uid),
          likeCount: increment(-1)
        });
        
        // Delete the associated like notification if it exists
        try {
          // First query for notifications with this postId, current user as sender, and type "like"
          const notificationsRef = collection(db, "notifications");
          const q = query(
            notificationsRef,
            where("postId", "==", postId),
            where("senderId", "==", auth.currentUser.uid),
            where("type", "==", "like")
          );
          
          const querySnapshot = await getDocs(q);
          
          // Delete each matching notification
          const deletePromises = querySnapshot.docs.map(doc => {
            return deleteDoc(doc.ref);
          });
          
          await Promise.all(deletePromises);
          console.log(`Deleted ${deletePromises.length} like notifications for post ${postId}`);
        } catch (notificationError) {
          console.error("Error deleting like notifications:", notificationError);
          // We don't want to fail the unlike operation if notification deletion fails
        }
        
        setIsLiked(false);
        setLikeCount(prevCount => Math.max(0, prevCount - 1));
      } else {
        // LIKE: Add like to post
        await updateDoc(postRef, {
          likedBy: arrayUnion(auth.currentUser.uid),
          likeCount: increment(1)
        });
        
        setIsLiked(true);
        setLikeCount(prevCount => prevCount + 1);
        
        // Only create notification if the current user is not the post owner
        if (post.userId !== auth.currentUser.uid) {
          try {
            // Get current user data for the notification
            const userDocRef = doc(db, "users", auth.currentUser.uid);
            const userDoc = await getDoc(userDocRef);
            const userData = userDoc.exists() ? userDoc.data() : {};
            
            // Create the notification document
            const notificationData = {
              type: "like",
              senderId: auth.currentUser.uid,
              senderName: userData.displayName || auth.currentUser.displayName,
              senderPhoto: userData.photoURL || auth.currentUser.photoURL,
              recipientId: post.userId,
              postId: post.id,
              status: "pending",
              createdAt: serverTimestamp()
            };
            
            await addDoc(collection(db, "notifications"), notificationData);
            console.log("Like notification created");
          } catch (notifError) {
            console.error("Error creating like notification:", notifError);
            // We don't show an error to the user if notification fails
            // because the like itself was successful
          }
        }
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      Alert.alert("Error", "Failed to update like");
    } finally {
      setLikeLoading(false);
    }
  };
  
  /**
   * Opens the comments modal
   */
  const showComments = () => {
    setCommentModalVisible(true);
  };
  
  /**
   * Navigates back to the previous screen
   */
  const goBack = () => {
    router.back();
  };

  /**
   * Navigates to user profile
   */
  const goToUserProfile = () => {
    router.push({
      pathname: './userProfile',
      params: { userId: post.userId }
    });
  };
  
  /**
   * Navigates to style search results
   * @param {string} styleName - The style to search for
   */
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
  
  /**
   * Creates an SVG for a tag (left side style)
   * @param {Object} tag - The tag object containing brand and product info
   * @returns {string} - SVG content as string
   */
  const createTagSvg = (tag) => {
    // Function to truncate text that's too long
    const truncateText = (text, maxLength) => {
      if (!text) return "";
      return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
    };
    
    // Truncate brand and product names
    const truncatedBrand = truncateText(tag.brand, 15);
    const truncatedProduct = truncateText(tag.productName, 18);
    const truncatedPrice = truncateText(tag.price, 7)
    
    
    // SVG for left tag (image on right)
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
      <text transform="translate(13 45) rotate(90)" font-family="BebasNeue" font-size="22" font-weight="bold" text-anchor="middle" fill="#F3E3D3">${truncatedPrice}</text>
    </svg>
    `;
  };

  /**
   * Calculates marker position based on container dimensions and tag data
   * 
   * @param {Object} tag - Tag object containing position data
   * @returns {Object|null} - Calculated position or null if invalid
   */
  const calculateMarkerPosition = (tag) => {
    // Extract position data from tag
    const position = tag.position || {};
    
    // Get the relative coordinates (between 0 and 1)
    const relativeX = position.relativeX;
    const relativeY = position.relativeY;
    
    // Skip if we don't have valid coordinates
    if (relativeX === undefined || relativeY === undefined) {
      console.error(`Marker missing relative coordinates:`, tag);
      return null;
    }
    
    // Get the current container dimensions
    const { width: containerWidth, height: containerHeight } = imageDimensions;
    
    // Calculate absolute positions based on current container dimensions
    const displayX = relativeX * containerWidth;
    const displayY = relativeY * containerHeight;
    
    return {
      displayX,
      displayY,
      color: tag.color || '#F3E3D3'
    };
  };

  /**
   * Renders interactive markers on the image based on tag positions
   * 
   * @returns {JSX.Element|null} - Rendered markers or null if no tags
   */
  const renderMarkers = () => {
    if (!post?.tags || !Array.isArray(post.tags) || post.tags.length === 0) {
      return null;
    }

    return post.tags.map((tag, index) => {
      const position = calculateMarkerPosition(tag);
      
      if (!position) return null;
      
      console.log(`Marker ${index} position:`, {
        tag: tag.brand,
        relativePosition: {
          x: tag.position?.relativeX,
          y: tag.position?.relativeY
        },
        calculatedPosition: {
          x: position.displayX,
          y: position.displayY
        },
        containerDimensions: imageDimensions
      });
      
      return (
        <View
          key={index}
          className="absolute"
          style={{
            left: position.displayX - 12.5,
            top: position.displayY - 12.5,
            zIndex: 50
          }}
        >
          <TouchableOpacity
            className="w-[25px] h-[25px] rounded-full border border-black"
            style={{ backgroundColor: position.color }}
            onPress={() => {
              showTagDetails(tag);
            }}
          />
        </View>
      );
    });
  };

  /**
   * Shows tag details by setting state for modal
   */
  const showTagDetails = (tag) => {
    setSelectedTag(tag);
    setTagModalVisible(true);
  };

  /**
   * Handles the Buy button press for product tags
   */
  const handleBuyPress = () => {
    if (selectedTag?.url) {
      // Open the product URL in browser
      Linking.openURL(selectedTag.url).catch((err) => {
        console.error('Failed to open URL:', err);
        Alert.alert("Error", "Failed to open product link");
      });
    } else {
      Alert.alert("No Link", "This product doesn't have a purchase link");
    }
  };

  /**
   * Handles searching for similar products
   */
  const handleSearchOthers = () => {
    if (selectedTag?.brand || selectedTag?.productName) {
      // Create search query combining brand and product name
      const searchQuery = [selectedTag.brand, selectedTag.productName]
        .filter(Boolean) // Filter out any undefined/null values
        .join(' '); 
          
      if (searchQuery) {
        // First close the modal before navigation
        setTagModalVisible(false);
        
        // Optional: also reset the selected tag
        setSelectedTag(null);
        
        // Then navigate to search results
        router.push({
          pathname: '/search/[query]',
          params: { 
            query: encodeURIComponent(searchQuery), 
            filter: 'tags' 
          }
        });
      } else {
        Alert.alert(
          "Search Error",
          "Not enough product information to search for similar items."
        );
      }
    } else {
      Alert.alert(
        "Search Error",
        "Not enough product information to search for similar items."
      );
    }
  };

  /**
   * Renders the tag details modal with product information
   */
  const renderTagDetailsModal = () => (
    <Modal
      visible={tagModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setTagModalVisible(false)}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-primary w-11/12 rounded-2xl overflow-hidden shadow-lg">
          {/* Tag Details Header */}
          <View className="px-6 py-4">
            <View className="flex-row justify-between items-center">
              <View/>
              <TouchableOpacity onPress={() => setTagModalVisible(false)}>
                <Image
                  source={icons.cross}
                  className="w-8 h-8"
                  tintColor="#000000"
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Tag Details Content */}
          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="px-6 pb-2">
              <View className="items-center">
                {/* Product Brand */}
                {selectedTag?.brand && (
                  <Text className="text-6xl font-bregular">
                    {selectedTag?.brand}
                  </Text>
                )}
                {/* Product Name */}
                {selectedTag?.productName && (
                  <Text className="text-3xl font-bregular mb-4">
                    {selectedTag.productName} 
                  </Text>
                )}
              </View>
              
              {/* Details Section - Display only */}
              <View className="bg-white/30 rounded-xl p-4 mb-5 border-2">
                {/* Price */}
                {selectedTag?.price && (
                  <View className="flex-row mb-3">
                    <Text className="text-lg font-montBold text-black w-24">Price:</Text>
                    <Text className="text-lg font-montMedium text-black flex-1">
                      {selectedTag.price}
                    </Text>
                  </View>
                )}
                                    
                {/* Size */}
                {selectedTag?.size && (
                  <View className="flex-row mb-3">
                    <Text className="text-lg font-montBold text-black w-24">Size:</Text>
                    <Text className="text-lg font-montMedium text-black flex-1">
                      {selectedTag.size}
                    </Text>
                  </View>
                )}
                
                {/* Colour */}
                {selectedTag?.itemColor && (
                  <View className="flex-row mb-3">
                    <Text className="text-lg font-montBold text-black w-24">Colour:</Text>
                    <Text className="text-lg font-montMedium text-black flex-1">
                      {selectedTag.itemColor}
                    </Text>
                  </View>
                )}
                
                {/* Style */}
                {selectedTag?.itemStyle && (
                  <View className="flex-row mb-3">
                    <Text className="text-lg font-montBold text-black w-24">Style:</Text>
                    <Text className="text-lg font-montMedium text-black flex-1">
                      {selectedTag.itemStyle}
                    </Text>
                  </View>
                )}
                
                {/* Product Type */}
                {selectedTag?.productType && (
                  <View className="flex-row mb-3">
                    <Text className="text-lg font-montBold text-black w-24">Type:</Text>
                    <Text className="text-lg font-montMedium text-black flex-1">
                      {selectedTag.productType}
                    </Text>
                  </View>
                )}
              </View>
              
              {/* Action Buttons Section */}
              <View className="mb-5">
                {selectedTag?.url ? (
                  <TouchableOpacity 
                    onPress={handleBuyPress}
                    className="bg-black py-3 rounded-lg items-center mb-4"
                  >
                    <Text className="text-primary font-montSemiBold text-xl">Buy Item</Text>
                  </TouchableOpacity>
                ) : (
                  <View className="py-3 rounded-lg items-center mb-4">
                    <Text className="text-gray-600 font-montMedium text-lg">No Link Attached</Text>
                  </View>
                )}
                
                {/* Search Other Items Button */}
                <TouchableOpacity 
                  onPress={handleSearchOthers}
                  className="flex-row border-2 border-black py-3 rounded-lg justify-center items-center"
                >
                  <Image
                    source={icons.search}
                    className="w-8 h-8"
                    resizeMode="contain"
                  />
                  <Text className="text-black font-montSemiBold text-lg">  Search other items like this</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  /**
   * Renders loading state with spinner
   */
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F3E3D3' }}>
        <ScreenOptions />
        <SafeAreaView style={{ flex: 1 }} className="justify-center items-center">
          <ActivityIndicator size="large" color="#C9B8A7" />
          <Text className="mt-4 text-black/70 font-montRegular">Loading post...</Text>
        </SafeAreaView>
      </View>
    );
  }

  /**
   * Renders error state with message and back button
   */
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F3E3D3' }}>
        <ScreenOptions />
        <SafeAreaView style={{ flex: 1 }} className="justify-center items-center px-6">
          <Text className="text-xl font-montMedium text-black/70">{error}</Text>
          <TouchableOpacity 
            onPress={goBack}
            className="mt-6 bg-black px-8 py-3 rounded-full"
          >
            <Text className="text-primary font-montMedium">Go Back</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  /**
   * Renders the post view tab content
   */
  const renderPostTab = () => {
    return (
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* User Profile Info with loading state */}
        <TouchableOpacity 
          onPress={goToUserProfile}
          className="flex-row items-center px-6 py-4"
        >
          {/* Profile Image with Loading State */}
          {userData === null ? (
            <View className="w-14 h-14 rounded-full mr-3 border-2 border-black items-center justify-center">
              <ActivityIndicator size="small" color="#000" />
            </View>
          ) : (
            <Image 
              source={userData.photoURL ? { uri: userData.photoURL } : images.profilePic}
              className="w-14 h-14 rounded-full mr-3 border-2 border-black"
              resizeMode="cover"
            />
          )}
          
          {/* User Info with Loading State */}
          <View>
            {userData === null ? (
              <>
                <View className="h-5 w-32 rounded mb-1"></View>
                <View className="h-4 w-24 rounded"></View>
              </>
            ) : (
              <>
                <Text className="text-lg text-black font-montSemiBold">
                  {userData.displayName || "User"}
                </Text>
                <Text className="text-m text-black font-montLight">
                  @{userData.username || "user"}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>
        
        {/* Post Image with Interactive Markers */}
        <View className="items-center justify-center mt-2">
          <View 
            className="w-[90%] bg-[#C9B8A7] border-4 border-black rounded-2xl items-center justify-center mb-4 overflow-hidden" 
            style={{aspectRatio: 3/4}}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              
              setImageLayout(event.nativeEvent.layout);
              
              // Calculate inner dimensions accounting for border (4px on each side)
              const innerWidth = width - 8;
              const innerHeight = height - 8;
              
              setImageDimensions({ width: innerWidth, height: innerHeight });
              console.log("Image container dimensions:", innerWidth, innerHeight);
            }}
          >
            <View className="w-full h-full relative">
              {/* Loading indicator while image loads */}
              {imageLoading && (
                <View className="absolute inset-0 z-10 flex justify-center items-center bg-black/5">
                  <ActivityIndicator size="large" color="#C9B8A7" />
                </View>
              )}
              
              {/* Post image */}
              <Image
                source={{ uri: post?.imageUrl }}
                className="w-full h-full rounded-2xl"
                resizeMode="cover"
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => {
                  setImageLoading(false);
                  
                  if (imageOriginalDimensions.width && imageOriginalDimensions.height) {
                    console.log("Image loaded with dimensions comparison:", {
                      originalImage: imageOriginalDimensions,
                      containerDimensions: imageDimensions
                    });
                  }
                }}
              />
              
              {/* Render markers when image is loaded and dimensions are set */}
              {!imageLoading && imageDimensions.width > 0 && renderMarkers()}
            </View>
          </View>
        </View>

        {/* Interaction buttons row */}
        <View className="flex-row justify-center items-center px-4 ">
          {/* Like Button and Count */}
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={toggleLike}
              disabled={likeLoading}
              className="w-10 h-10 items-center justify-center rounded-full"
            >
              {likeLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Image
                  source={isLiked ? icons.liked : icons.like}
                  className="w-10 h-10"
                  tintColor='#000000'
                  resizeMode="contain"
                />
              )}
            </TouchableOpacity>
            <Text className="text-2xl mx-3 font-montMedium text-black/80">{likeCount}</Text>
          </View>
          
          {/* Comment Button and Count */}
          <View className="flex-row items-center">
            <TouchableOpacity 
              onPress={showComments}
              className="w-10 h-10 items-center justify-center rounded-full"
            >
              <Image
                source={icons.comment}
                className="w-9 h-9"
                tintColor='#000000'
                resizeMode="contain"
              />
            </TouchableOpacity>
            <Text className="text-2xl mx-3 font-montMedium text-black/80">{commentsCount}</Text>
          </View>
          
          {/* Bookmark Button */}
          <TouchableOpacity 
            onPress={toggleBookmark}
            onLongPress={handleBookmarkLongPress}
            disabled={bookmarkLoading}
            delayLongPress={500} // Half second delay for long press
            className="w-10 h-10 items-center justify-center rounded-full"
          >
            {bookmarkLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Image
                source={isBookmarked ? icons.bookmarked : icons.bookmark}
                className="w-8 h-8"
                tintColor="#000"
                resizeMode="contain"
              />
            )}
          </TouchableOpacity>
        </View>
        
        {/* Post Details Section */}
        <View className="px-6 py-4">
          {/* Caption section with interaction buttons */}
          <View className="mb-6 bg-[#E0C9B2] border-2 rounded-xl">
            {post?.caption ? (
              <Text className="text-lg font-montMedium p-3 text-black/80 text-center">
                {post.caption}
                {post.captionEdited && (
                  <Text className="text-xs italic text-black/50"> (edited)</Text>
                )}
              </Text>
            ) : (
              <Text className="text-base font-montRegular text-black/50 italic p-3 text-center">
                No caption
              </Text>
            )}                    
          </View>
          
          {/* Styles List Section */}
          {post?.styles ? (
            <View>
              <Text className="text-lg font-montSemiBold text-black mb-3">Styles</Text>
              <View className="flex-row flex-wrap">
                {post.styles.map((style, index) => (
                  <TouchableOpacity 
                    key={index} 
                    className="bg-black/10 px-4 py-2 rounded-full mr-2 mb-2 border-2"
                    onPress={() => handleViewStyle(style)}
                  >
                    <Text className="font-montMedium text-black/80">
                      {style}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ): (
            <View>
              <Text className="text-lg font-montSemiBold text-black mb-3">
              Styles
              </Text>
              <Text className="text-base font-montRegular text-black/50 italic">
                No styles added
              </Text>
            </View>  
          )}
          
          {/* Created At Timestamp */}
          {post?.createdAt && (
            <View className="mt-6 pt-4 border-t border-black/10">
              <Text className="text-sm font-montRegular text-black/50">
                Posted on {post.createdAt && typeof post.createdAt.toDate === 'function' 
                ? `${new Date(post.createdAt.toDate()).toLocaleDateString()} at ${new Date(post.createdAt.toDate()).toLocaleTimeString()}`
                : 'unknown date'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  /**
   * Renders the tags tab content with SVG tags
   */
  const renderTagsTab = () => {
    if (!post?.tags || !Array.isArray(post.tags) || post.tags.length === 0) {
      return (
        <View className="flex-1 justify-center items-center p-6">
          <Text className="text-xl font-montMedium text-black/70 text-center">
            No tags available for this post
          </Text>
        </View>
      );
    }

    return (
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <Text className="text-lg font-montSemiBold text-black mb-4 text-center">
          Tagged Products
        </Text>
        
        {post.tags.map((tag, index) => (
          <TouchableOpacity 
            key={index}
            className="mb-6"
            onPress={() => showTagDetails(tag)}
          >
            <View className="h-[100px] w-full mb-2">
              <SvgXml 
                xml={createTagSvg(tag)} 
                width="100%" 
                height="100%" 
              />
            </View>
            
            {/* Additional details below tag */}
            <View className="bg-black/5 p-3 rounded-lg mx-4">
              {tag.productName && (
                <Text className="font-montMedium text-black mb-1">
                  Product: {tag.productName}
                </Text>
              )}
              {tag.price && (
                <Text className="font-montMedium text-black/80 mb-1">
                  Price: {tag.price}
                </Text>
              )}
              {tag.size && (
                <Text className="font-montRegular text-black/70">
                  Size: {tag.size}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  /**
   * Main component render function
   */
  return (
    <View style={{ flex: 1, backgroundColor: '#F3E3D3' }}>
      <ScreenOptions />
      <StatusBar barStyle="dark-content" />
      
      {/* Fixed Header with elevated z-index */}
      <SafeAreaView edges={['top']} className="bg-primary">
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
            <Text className="text-4xl pt-4 font-bregular text-black">POST</Text>
          </View>
        </View>
      </SafeAreaView>
      
      {/* Tab navigation */}
      <View className="flex-row justify-center mt-2 border-b border-black/10">
        <TouchableOpacity
          className={`px-6 py-2 ${activeTab === 'post' ? 'border-b-2 border-black' : ''}`}
          onPress={() => setActiveTab('post')}
        >
          <Text className={`text-lg font-montMedium ${activeTab === 'post' ? 'text-black' : 'text-black/60'}`}>Post</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`px-6 py-2 ${activeTab === 'tags' ? 'border-b-2 border-black' : ''}`}
          onPress={() => setActiveTab('tags')}
        >
          <Text className={`text-lg font-montMedium ${activeTab === 'tags' ? 'text-black' : 'text-black/60'}`}>
            Tags {post?.tags?.length > 0 ? `(${post.tags.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Tab content */}
      <View className="flex-1">
        {activeTab === 'post' ? renderPostTab() : renderTagsTab()}
      </View>
      
      {/* Modals */}
      {renderTagDetailsModal()}
      
      {/* Board Selection Modal (now imported as a component) */}
      <BoardSelectionModal
        visible={boardModalVisible}
        onClose={() => setBoardModalVisible(false)}
        postId={postId}
        postData={post}
        onBoardSelected={handleBoardSelected}
      />
      
      {/* Using the separate CommentsModal component */}
      <CommentsModal
        visible={commentModalVisible}
        onClose={() => setCommentModalVisible(false)}
        postId={postId}
        comments={comments}
        commentsCount={commentsCount}
        commentText={commentText}
        setCommentText={setCommentText}
        commentLoading={commentLoading}
        setCommentLoading={setCommentLoading}
      />
    </View>
  );
};

export default ViewUserPost;