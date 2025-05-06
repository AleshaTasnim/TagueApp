/**
 * commentsModal.jsx - Post comments interface
 * 
 * This component displays a modal that allows users to view, add, and delete comments
 * on posts. It handles fetching the post author information, managing comment state,
 * and creating notifications when new comments are added.
 * 
 * Features:
 * - Viewing all comments for a post with user information
 * - Adding new comments with real-time updates
 * - Deleting comments (for comment owners only)
 * - Visual indication of post author's comments
 * - Automatic notifications to post owners
 * - Keyboard-aware layout adjustments
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc, addDoc, updateDoc, deleteDoc, collection, increment, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import { icons } from '../../constants/icons';
import { images } from '../../constants/images';

const CommentsModal = ({
  visible,
  onClose,
  postId,
  comments,
  commentsCount,
  commentText,
  setCommentText,
  commentLoading,
  setCommentLoading
}) => {
  // State for tracking post information and author
  const [postAuthorId, setPostAuthorId] = useState(null);
  const [postData, setPostData] = useState(null);

  // Fetch post author data when modal opens
  useEffect(() => {
    if (visible && postId) {
      const fetchPostAuthor = async () => {
        try {
          const postRef = doc(db, "posts", postId);
          const postDoc = await getDoc(postRef);
          
          if (postDoc.exists()) {
            const data = postDoc.data();
            setPostAuthorId(data.userId);
            setPostData({
              id: postId,
              ...data
            });
          }
        } catch (error) {
          console.error("Error fetching post author:", error);
        }
      };
      
      fetchPostAuthor();
    }
  }, [visible, postId]);

  // Reset keyboard state when modal opens
  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
    }
  }, [visible]);

  // Create notification for the post owner when someone comments
  const createCommentNotification = async (commentData, commentId) => {
    // Skip notification if the commenter is the post owner
    if (auth.currentUser.uid === postAuthorId) return;
    
    try {
      // Create the notification document
      const notificationData = {
        type: "comment",
        senderId: auth.currentUser.uid,
        senderName: commentData.displayName,
        senderPhoto: commentData.photoURL,
        recipientId: postAuthorId,
        postId: postId,
        commentId: commentId,
        commentPreview: commentData.comment.length > 50 
          ? `${commentData.comment.substring(0, 47)}...` 
          : commentData.comment,
        status: "pending",
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, "notifications"), notificationData);
      console.log("Comment notification created");
    } catch (error) {
      console.error("Error creating comment notification:", error);
      // We don't want to show an error to the user if notification fails
      // as the comment itself was successful
    }
  };

  // Add a new comment to the post
  const addComment = async () => {
    if (!auth.currentUser) {
      Alert.alert("Sign In Required", "Please sign in to comment on posts");
      return;
    }
    
    if (!commentText.trim()) {
      return;
    }
    
    setCommentLoading(true);
    
    try {
      const commentsRef = collection(db, "posts", postId, "comments");
      
      // Get current user data for the comment
      const userDocRef = doc(db, "users", auth.currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.exists() ? userDoc.data() : {};
      
      // Create comment object
      const commentData = {
        userId: auth.currentUser.uid,
        username: userData.username || "User",
        displayName: userData.displayName || "User",
        photoURL: userData.photoURL || null,
        comment: commentText.trim(),
        createdAt: serverTimestamp()
      };
      
      // Add comment to Firestore
      const docRef = await addDoc(commentsRef, commentData);
      
      // Update post document with incremented comment count
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        commentsCount: increment(1)
      });
      
      // Create notification for post owner
      await createCommentNotification(commentData, docRef.id);
      
      // Clear the input field
      setCommentText('');
      
      // We don't need to update the comments state manually since the listener will handle it
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert("Error", "Failed to add comment");
    } finally {
      setCommentLoading(false);
    }
  };

  // Delete a comment and remove associated notification
  const deleteComment = async (commentId) => {
    if (!auth.currentUser) {
      Alert.alert("Error", "You must be signed in to delete comments");
      return;
    }
    
    // Confirm before deletion
    Alert.alert(
      "Delete Comment",
      "Are you sure you want to delete this comment?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setCommentLoading(true);
              
              // Delete the comment document
              const commentRef = doc(db, "posts", postId, "comments", commentId);
              await deleteDoc(commentRef);
              
              // Update post document with decremented comment count
              const postRef = doc(db, "posts", postId);
              await updateDoc(postRef, {
                commentsCount: increment(-1)
              });
              
              // Delete associated notification if it exists
              try {
                // Import the missing query and where functions
                const { query, where, getDocs } = require('firebase/firestore');
                
                // First query for notifications with this commentId
                const notificationsRef = collection(db, "notifications");
                const q = query(
                  notificationsRef,
                  where("commentId", "==", commentId),
                  where("type", "==", "comment")
                );
                
                const querySnapshot = await getDocs(q);
                
                // Delete each matching notification
                const deletePromises = querySnapshot.docs.map(doc => {
                  return deleteDoc(doc.ref);
                });
                
                await Promise.all(deletePromises);
                console.log(`Deleted ${deletePromises.length} notifications associated with comment`);
              } catch (notificationError) {
                console.error("Error deleting notifications:", notificationError);
                // We don't want to fail the whole operation if notification deletion fails
              }
              
              // No need to manually update state as the listener will handle it
              
              // Display success message
              Alert.alert("Success", "Comment deleted successfully");
            } catch (error) {
              console.error("Error deleting comment:", error);
              Alert.alert("Error", "Failed to delete comment");
            } finally {
              setCommentLoading(false);
            }
          }
        }
      ]
    );
  };

  // Render a single comment item in the list
  const renderCommentItem = ({ item }) => {
    // Format the timestamp
    const formattedDate = item.createdAt ? 
      new Date(item.createdAt).toLocaleDateString(undefined, { 
        day: 'numeric', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit'
      }) : '';
    
    // Check if current user is the comment author
    const isCommentAuthor = auth.currentUser && item.userId === auth.currentUser.uid;
    
    // Check if comment is from the post author
    const isPostAuthor = item.userId === postAuthorId;
    
    return (
      <View className="px-5 py-4 m-2 rounded-3xl border-2 bg-white/30">
        <View className="flex-row items-center mb-2">
          <Image 
            source={item.photoURL ? { uri: item.photoURL } : images.profilePic}
            className="w-12 h-12 rounded-full mr-2"
            resizeMode="cover"
          />
          <View className="flex-1 flex-row items-center">
            <Text className="text-lg font-montSemiBold text-black">{item.displayName || item.username}</Text>
            
            {/* Show "Author" badge if the comment is from post creator */}
            {isPostAuthor && (
              <View className="bg-black/80 px-3 py-1 rounded-full ml-2">
                <Text className="text-xs text-white font-montSemiBold">Author</Text>
              </View>
            )}
          </View>
          <Text className="text-sm text-black/50">{formattedDate}</Text>
          
          {/* Delete button - only visible to comment author */}
          {isCommentAuthor && (
            <TouchableOpacity 
              onPress={() => deleteComment(item.id)}
              className="ml-2"
            >
              <Image
                source={icons.deletePrimary}
                className="w-6 h-6"
                tintColor="#FF0000"
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>
        <Text className="text-lg text-black font-montMedium m-2">{item.comment}</Text>
      </View>
    );
  };

  // Skip rendering if modal is not visible
  if (!visible) return null;

  // Main render for the comments modal
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View className="flex-1 bg-black/50">
        <SafeAreaView className="flex-1" edges={['top']}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 justify-end"
            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
          >
            <View className="h-[85%] bg-[#F3E3D3] rounded-t-3xl overflow-hidden">
              {/* Header with title and close button */}
              <View className="flex-row justify-between items-center px-4 py-4 border-b border-black/10">
                <Text className="text-4xl font-bregular text-black">Comments ({commentsCount})</Text>
                <TouchableOpacity onPress={onClose} className="p-1">
                  <Image
                    source={icons.cross}
                    className="w-8 h-8"
                    tintColor="#000000"
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              </View>
              
              {/* Comments list or empty state */}
              <View className="flex-1 pb-16">
                {comments.length > 0 ? (
                  <FlatList
                    data={comments}
                    renderItem={renderCommentItem}
                    keyExtractor={item => item.id}
                    showsVerticalScrollIndicator={false}
                  />
                ) : (
                  <View className="flex-1 justify-center items-center">
                    <Text className="text-black/70 font-montRegular text-lg">No comments yet</Text>
                    <Text className="text-black/50 font-montRegular text-base mt-2">Be the first to comment!</Text>
                  </View>
                )}
              </View>
              
              {/* Comment input field at bottom */}
              <View className="absolute bottom-0 left-0 right-0 border-t border-black/50 bg-[#F3E3D3] px-4 py-4 mb-4">
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <View className="flex-row items-center">
                    <TextInput
                      className="flex-1 bg-white/30 rounded-3xl px-6 py-4 mr-2 border-2 font-montMedium text-base"
                      placeholder="Add a comment..."
                      value={commentText}
                      onChangeText={(text) => setCommentText(text)}
                      multiline
                      maxLength={500}
                    />
                    
                    <TouchableOpacity 
                      onPress={addComment}
                      disabled={commentLoading || !commentText.trim()}
                      className="w-11 h-11 justify-center items-center"
                    >
                      {commentLoading ? (
                        <ActivityIndicator size="small" color="#F3E3D3" />
                      ) : (
                        <Image
                          source={icons.send}
                          className="w-8 h-8"
                          tintColor={commentText.trim() ? '#000000' : '#00000050'}
                          resizeMode="contain"
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

export default CommentsModal;