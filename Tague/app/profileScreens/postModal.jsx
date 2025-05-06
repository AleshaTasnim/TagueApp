/**
 * PostModal.js - Post details screen component
 * 
 * This component displays the details of a post, including:
 * - Full-size image with interactive product markers/tags
 * - Caption with edit functionality
 * - Tagged products list
 * - Post metadata (creation date/time)
 * - Delete post functionality
 * - Interactive buttons for like and comment
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
    Platform,
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { icons } from '../../constants/icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { 
    doc, 
    getDoc, 
    deleteDoc, 
    updateDoc, 
    collection,
    query, 
    orderBy,
    onSnapshot
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage, auth } from '../../backend/firebaseConfig';
import CommentsModal from './commentModal';

const PostModal = () => {
    // =========================================================================
    // COMPONENT CLEANUP
    // =========================================================================
    const commentsListener = useRef(null);
        
    useEffect(() => {
        return () => {
            // Clean up listeners on unmount
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

    // =========================================================================
    // STATE MANAGEMENT
    // =========================================================================
    const { postId } = useLocalSearchParams();
    const router = useRouter();
    
    // Post data and loading states
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageLoading, setImageLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deleting, setDeleting] = useState(false);
    
    // Image dimension states for positioning markers
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [imageOriginalDimensions, setImageOriginalDimensions] = useState({ width: 0, height: 0 });
    const [imageLayout, setImageLayout] = useState(null);
    
    // Edit caption related states
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editedCaption, setEditedCaption] = useState("");
    const [saving, setSaving] = useState(false);

    // Edit tag modal related states
    const [tagModalVisible, setTagModalVisible] = useState(false);
    const [selectedTag, setSelectedTag] = useState(null);
    const [tagUrl, setTagUrl] = useState('');
    const [savingTagUrl, setSavingTagUrl] = useState(false);

    // Comments state
    const [commentModalVisible, setCommentModalVisible] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);
    
    // Interaction states
    const [likeCount, setLikeCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    
    // Screen dimensions for responsive layouts
    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
    
    // =========================================================================
    // DATA FETCHING
    // =========================================================================
    /**
     * Fetches post data from Firestore based on postId
     * Sets post data, caption for editing, and image dimensions if available
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
                    setEditedCaption(postData.caption || "");
                    
                    // Set interaction counts
                    setLikeCount(postData.likeCount || 0);
                    setCommentsCount(postData.commentsCount || 0);
                                        
                    // Check if the user has liked this post
                    if (auth.currentUser) {
                        // Check if liked
                        const likedBy = postData.likedBy || [];
                        setIsLiked(likedBy.includes(auth.currentUser.uid));
                    }
                    
                    // Store original image dimensions if available in metadata
                    if (postData.imageMetadata) {
                        setImageOriginalDimensions({
                            width: postData.imageMetadata.width || 0,
                            height: postData.imageMetadata.height || 0
                        });
                        console.log("Original image dimensions from metadata:", 
                            postData.imageMetadata.width, 
                            postData.imageMetadata.height);
                    }
                    
                    console.log("Post tags:", postData.tags);
                } else {
                    setError('Post not found');
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
     * Get image dimensions if not available from metadata
     * Uses Image.getSize to determine actual image dimensions
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
     * Set up listener for comments
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
                if (data.userId && data.comment) {
                    commentsData.push({
                        id: doc.id,
                        ...data,
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

    // =========================================================================
    // COMMENT FUNCTIONS
    // =========================================================================
    /**
     * Open the comments modal
     */
    const showComments = () => {
        setCommentModalVisible(true);
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

    // =========================================================================
    // EDIT FUNCTIONS
    // =========================================================================
    /**
     * Opens the edit modal and sets the current caption for editing
     */
    const handleEditPost = () => {
        setEditedCaption(post.caption || "");
        setEditModalVisible(true);
    };

    /**
     * Saves the edited caption to Firestore
     * Updates post doc and local state, shows success alert
     */
    const saveEditedPost = async () => {
        setSaving(true);
        try {
            // Check if caption has actually changed
            const hasChanged = editedCaption !== post.caption;
            
            if (hasChanged) {
                const postDocRef = doc(db, "posts", postId);
                
                // Update post with new caption and mark as edited if it wasn't already
                await updateDoc(postDocRef, {
                    caption: editedCaption,
                    captionEdited: true
                });
                
                // Update local state to reflect changes
                setPost({
                    ...post,
                    caption: editedCaption,
                    captionEdited: true
                });
                
                Alert.alert("Success", "Caption updated successfully");
            }
            
            // Close the modal regardless of whether changes were made
            setEditModalVisible(false);
        } catch (err) {
            console.error("Error updating post:", err);
            Alert.alert("Error", "Failed to update caption. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    // =========================================================================
    // INTERACTION FUNCTIONS (PLACEHOLDERS)
    // =========================================================================
    
    // Placeholder functions for the interactive buttons
    const handleLike = () => {
        // No actual functionality
        console.log("Like button pressed");
    };
    
    // =========================================================================
    // DELETE FUNCTIONS
    // =========================================================================
    /**
     * Shows confirmation dialog before deleting post
     */
    const handleDeletePost = () => {
        Alert.alert(
            "Delete Post",
            "Are you sure you want to delete this post? This action cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: deletePost
                }
            ]
        );
    };

    /**
     * Deletes post and associated image from Firestore and Storage
     * Shows success alert and navigates back on completion
     */
    const deletePost = async () => {
        if (!postId) return;
        
        setDeleting(true);
        
        try {
            // First, delete the image from Storage if it exists
            if (post?.imageUrl) {
                try {
                    // Extract the storage path from the image URL
                    const imageUrl = post.imageUrl;
                    
                    // Get the storage path from the URL
                    const urlParts = imageUrl.split('/o/');
                    if (urlParts.length > 1) {
                        let storagePath = urlParts[1];
                        // Remove query parameters if any
                        storagePath = storagePath.split('?')[0];
                        // Decode the URL-encoded path
                        storagePath = decodeURIComponent(storagePath);
                        
                        // Create a reference to the file
                        const imageRef = ref(storage, storagePath);
                        
                        // Delete the image
                        await deleteObject(imageRef);
                        console.log("Image deleted successfully");
                    } else {
                        console.log("Could not parse storage path from URL:", imageUrl);
                    }
                } catch (imageErr) {
                    // Log but continue with post deletion even if image deletion fails
                    console.error("Error deleting image:", imageErr);
                }
            }
            
            // Then delete the post document from Firestore
            const postDocRef = doc(db, "posts", postId);
            await deleteDoc(postDocRef);
            
            // Show success message
            Alert.alert(
                "Success",
                "Post and associated media deleted successfully",
                [
                    {
                        text: "OK",
                        onPress: () => {
                            // Navigate back to the previous screen
                            router.back();
                        }
                    }
                ]
            );
        } catch (err) {
            console.error("Error deleting post:", err);
            Alert.alert("Error", "Failed to delete post. Please try again.");
        } finally {
            setDeleting(false);
        }
    };
    
    // =========================================================================
    // LOADING AND ERROR STATES
    // =========================================================================
    /**
     * Render loading state with spinner
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
     * Render error state with message and back button
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
    
    // =========================================================================
    // MARKER FUNCTIONS
    // =========================================================================
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
     * Each marker is a touchable circle that shows tag details on press
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
                        onPress={() => handleTagPress(tag)}
                    />
                </View>
            );
        });
    };

    // =========================================================================
    // EDIT TAG MODAL FUNCTIONS
    // =========================================================================
    // Add this function to your component to handle opening the tag modal
    const handleTagPress = (tag) => {
        setSelectedTag(tag);
        setTagUrl(tag.url || '');
        setTagModalVisible(true);
    };

    // Add this function to handle saving the updated URL
    const saveTagUrl = async () => {
        if (!selectedTag || !postId) return;
        
        setSavingTagUrl(true);
        
        try {
            // Get the current post data
            const postDocRef = doc(db, "posts", postId);
            const postDoc = await getDoc(postDocRef);
            
            if (!postDoc.exists()) {
                throw new Error("Post not found");
            }
            
            // Update the tag URL in the post data
            const postData = postDoc.data();
            const tags = postData.tags || [];
            
            // Find the tag and update its URL
            const updatedTags = tags.map(tag => {
                // Match the tag based on its unique properties
                if (tag.brand === selectedTag.brand && 
                    tag.productName === selectedTag.productName &&
                    tag.position?.relativeX === selectedTag.position?.relativeX &&
                    tag.position?.relativeY === selectedTag.position?.relativeY) {
                    return {
                        ...tag,
                        url: tagUrl
                    };
                }
                return tag;
            });
            
            // Update the post with the new tags
            await updateDoc(postDocRef, {
                tags: updatedTags
            });
            
            // Update local state
            setPost({
                ...post,
                tags: updatedTags
            });
            
            // Update selected tag
            setSelectedTag({
                ...selectedTag,
                url: tagUrl
            });
            
            // Show success alert
            Alert.alert("Success", "Tag URL updated successfully");
        } catch (err) {
            console.error("Error updating tag URL:", err);
            Alert.alert("Error", "Failed to update tag URL. Please try again.");
        } finally {
            setSavingTagUrl(false);
        }
    };
    
    const renderTagDetailsModal = () => (
        <Modal
            visible={tagModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setTagModalVisible(false)}
        >
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
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
                                
                                
                                {/* Details Section - Display only, not editable */}
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
                                
                                {/* URL Section - Editable */}
                                <View className="mb-5">
                                    <Text className="text-xl font-montSemiBold text-black ml-1 mb-2">Edit Product URL</Text>
                                    
                                    {/* URL Input Field */}
                                    <View className="bg-white/50 rounded-lg border-2  mb-3">
                                        <TextInput
                                            value={tagUrl}
                                            onChangeText={setTagUrl}
                                            placeholder="Enter product URL..."
                                            placeholderTextColor="#00000050"
                                            className="p-3  text-m font-montRegular"
                                            autoCapitalize="none"
                                            keyboardType="url"
                                        />
                                    </View>
                                    
                                    {/* URL Action Buttons */}
                                    <View className="flex-row items-evenly justify-evenly mb-4">
                                        {/* Search Button */}
                                        <TouchableOpacity 
                                            onPress={() => {
                                                if (selectedTag?.brand) {
                                                    const searchTerm = `${selectedTag.brand} ${selectedTag.productName || ''}`.trim();
                                                    // Create a Google search URL with the search term
                                                    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}`;
                                                    
                                                    // Open the URL in the device's browser
                                                    Linking.openURL(searchUrl).catch((err) => {
                                                        console.error('Failed to open search URL:', err);
                                                        Alert.alert("Error", "Failed to open web browser for search");
                                                    });
                                                }
                                            }}
                                            className="bg-black py-2 px-4 rounded-full flex-row items-center"
                                        >
                                            <Image
                                                source={icons.search}
                                                className="w-5 h-5 mr-2"
                                                tintColor="#F3E3D3"
                                                resizeMode="contain"
                                            />
                                            <Text className="text-lg text-primary font-montSemiBold">Search</Text>
                                        </TouchableOpacity>
                                        
                                        {/* Paste Button */}
                                        <TouchableOpacity 
                                            onPress={async () => {
                                                try {
                                                    // Attempt to get clipboard content
                                                    const clipboardContent = await Clipboard.getStringAsync();
                                                    
                                                    if (clipboardContent) {
                                                        // Check if it looks like a URL
                                                        if (clipboardContent.startsWith('http')) {
                                                            setTagUrl(clipboardContent);
                                                        } else {
                                                            Alert.alert("Invalid URL", "Clipboard content is not a valid URL");
                                                        }
                                                    }
                                                } catch (error) {
                                                    console.error("Clipboard error:", error);
                                                    Alert.alert("Error", "Failed to access clipboard");
                                                }
                                            }}
                                            className="py-2 px-4 rounded-full border border-black flex-row items-center"
                                        >
                                            <Image
                                                source={icons.paste}
                                                className="w-5 h-5 mr-2"
                                                resizeMode="contain"
                                            />
                                            <Text className="text-lg text-black font-montSemiBold">Paste</Text>
                                        </TouchableOpacity>
                                    </View>
                                    
                                    {/* Save URL Button */}
                                    <TouchableOpacity 
                                        onPress={saveTagUrl}
                                        disabled={savingTagUrl}
                                        className="bg-secondary py-3 rounded-lg items-center"
                                    >
                                        {savingTagUrl ? (
                                            <ActivityIndicator color="#F3E3D3" size="small" />
                                        ) : (
                                            <Text className="text-primary font-montSemiBold text-xl">Update URL</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
    
    // =========================================================================
    // MAIN RENDER
    // =========================================================================
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
                        <Text className="text-4xl pt-4 font-bregular text-black">POST DETAILS</Text>
                    </View>
                </View>
            </SafeAreaView>
                
            <ScrollView 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* Post Image with Interactive Markers */}
                <View className="items-center justify-center mt-4">
                    <View 
                        className="w-80 bg-[#C9B8A7] border-4 border-black rounded-2xl items-center justify-center mb-4 overflow-hidden" 
                        style={{aspectRatio: 3/4}}
                        onLayout={(event) => {
                            const { width, height } = event.nativeEvent.layout;
                            
                            setImageLayout(event.nativeEvent.layout);
                            
                            // Calculate inner dimensions accounting for border (2px on each side)
                            const innerWidth = width - 4;
                            const innerHeight = height - 4;
                            
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
                <View className="flex-row justify-center items-center px-4 my-4">
                    {/* Like Button and Count */}
                    <View className="flex-row items-center">
                        <TouchableOpacity 
                            onPress={handleLike}
                            className="w-10 h-10 items-center justify-center rounded-full"
                        >
                            <Image
                                source={isLiked ? icons.liked : icons.like}
                                className="w-10 h-10"
                                tintColor='#000000'
                                resizeMode="contain"
                            />
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
                </View>
                
                {/* Post Details Section */}
                <View className="px-6 py-4">
                    {/* Caption section with edit button */}
                    <View className="mb-6">
                        <View className="flex-row justify-between items-center mb-2">
                            <Text className="text-lg font-montSemiBold text-black">Caption</Text>
                            <TouchableOpacity 
                                onPress={handleEditPost}
                                className="bg-black py-1 px-3 rounded-lg"
                            >
                                <Text className="text-primary font-montRegular">Edit</Text>
                            </TouchableOpacity>
                        </View>
                        {post?.caption ? (
                            <Text className="text-base font-montRegular text-black/80">
                                {post.caption}
                                {post.captionEdited && (
                                    <Text className="text-xs italic text-black/50"> (edited)</Text>
                                )}
                            </Text>
                        ) : (
                            <Text className="text-base font-montRegular text-black/50 italic">
                                No caption
                            </Text>
                        )}
                    </View>
                    
                    {/* Tags List Section */}
                    {post?.tags && post.tags.length > 0 && (
                        <View>
                            <Text className="text-lg font-montSemiBold text-black mb-3">Tags</Text>
                            <View className="flex-row flex-wrap">
                                {post.tags.map((tag, index) => {
                                    const tagContent = typeof tag === 'object' 
                                        ? (tag.brand || (tag.position && JSON.stringify(tag.position))) 
                                        : JSON.stringify(tag);
                                        
                                    return (
                                        <View 
                                            key={index} 
                                            className="bg-black/10 px-4 py-2 rounded-full mr-2 mb-2"
                                        >
                                            <Text className="font-montMedium text-black/80">
                                                {tagContent}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Styles List Section */}
                    {post?.styles && post.styles.length > 0 && (
                        <View className="mt-4">
                            <Text className="text-lg font-montSemiBold text-black mb-3">Styles</Text>
                            <View className="flex-row flex-wrap">
                                {post.styles.map((style, index) => (
                                    <View 
                                        key={index} 
                                        className="bg-black/10 px-4 py-2 rounded-full mr-2 mb-2"
                                    >
                                        <Text className="font-montMedium text-black/80">
                                            {style}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                    
                    {/* Delete Post Button */}
                    <View className="mt-6">
                        <TouchableOpacity 
                            onPress={handleDeletePost}
                            disabled={deleting}
                            className="bg-red-500 rounded-full py-3 items-center"
                        >
                            {deleting ? (
                                <ActivityIndicator color="white" size="small" />
                            ) : (
                                <Text className="text-white font-montSemiBold">Delete Post</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                    
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

            {/* Edit Caption Modal */}
            <Modal
                visible={editModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    className="flex-1"
                >
                    <View className="flex-1 justify-end bg-black/50">
                        <View className="bg-primary rounded-t-3xl p-6">
                            {/* Modal Header with Title and Close Button */}
                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-2xl font-montSemiBold text-black">Edit Caption</Text>
                                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                                    <Image
                                        source={icons.cross}
                                        className="w-6 h-6"
                                        resizeMode="contain"
                                    />
                                </TouchableOpacity>
                            </View>
                            
                            {/* Caption Input Field */}
                            <View className="bg-white/50 rounded-lg border border-black/10 mb-2">
                                <TextInput
                                    value={editedCaption}
                                    onChangeText={setEditedCaption}
                                    placeholder="Write a caption for your post..."
                                    placeholderTextColor="#00000050"
                                    className="p-3 text-base font-montRegular"
                                    multiline
                                    numberOfLines={4}
                                    maxLength={150}
                                    textAlignVertical="top"
                                    style={{ minHeight: 100 }}
                                />
                            </View>
                            
                            {/* Character Counter */}
                            <Text className="text-xs text-black/50 mb-6 text-right">
                                {editedCaption.length}/150
                            </Text>
                            
                            {/* Save Button */}
                            <TouchableOpacity
                                onPress={saveEditedPost}
                                disabled={saving}
                                className="bg-black py-4 rounded-lg items-center"
                            >
                                {saving ? (
                                    <ActivityIndicator color="#F3E3D3" size="small" />
                                ) : (
                                    <Text className="text-primary font-montMedium text-lg">Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {renderTagDetailsModal()}
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

export default PostModal;