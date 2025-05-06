/**
 * CreateModal.jsx - Post creation wizard component
 * 
 * This component provides a step-by-step process for creating a new post with:
 * 1. Image selection and crop to 3:4 aspect ratio
 * 2. Adding interactive product tags at specific points on the image
 * 3. Customizing tag colors
 * 4. Adding caption and uploading the post
 * 
 * Features:
 * - Multi-step creation process with navigation
 * - Interactive tag placement on images
 * - Tag management (add, edit, delete)
 * - Tag color customisation
 * - Image selection and cropping
 * - Caption input with character limit
 * - Firebase Storage and Firestore integration
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs } from 'firebase/firestore';
import { auth, storage, db } from '../../backend/firebaseConfig';
import { icons } from '../../constants/icons';
import TagDetailModal from '../../components/createComponents/tagDetailModal';
import ColorSelectionButton from '../../components/createComponents/colorSelectionButton'


const CreateModal = () => {
  // Main wizard state variables for post creation process
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState(1);
  const [caption, setCaption] = useState('');
  
  // Tag management state variables
  const [tags, setTags] = useState([]);
  const [tagColor, setTagColor] = useState('#F3E3D3'); // Default beige color
  const [colorSelectionMode, setColorSelectionMode] = useState(false);
  const [currentTag, setCurrentTag] = useState({});
  
  // Tag modal state variables
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [editingExistingTag, setEditingExistingTag] = useState(false);

  // References and dimensions for UI layout and tag positioning
  const scrollViewRef = useRef(null);
  const { height: screenHeight } = Dimensions.get('window');
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Style selection state variables for post categorization
  const [postStyles, setPostStyles] = useState([]);
  const [styleOptions, setStyleOptions] = useState(['Casual', 'Formal', 'Sporty', 'Vintage', 'Streetwear', 'Business', 'Bohemian', 'Minimalist']);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [newStyleInput, setNewStyleInput] = useState('');
  const [showNewStyleInput, setShowNewStyleInput] = useState(false);
  const [popularStyles, setPopularStyles] = useState([]);
  const [loadingStyles, setLoadingStyles] = useState(false);

  // Fetch existing styles when reaching the final step
  useEffect(() => {
    if (step === 4) {
      fetchExistingStyles();
    }
  }, [step]);

  // Navigate to next step in the creation wizard
  const handleNext = () => {
    if (!image) {
      Alert.alert('No image selected', 'Please select an image first.');
      return;
    }
    
    // Check if moving from step 2 to step 3 without any tags
    if (step === 2 && tags.length === 0) {
      Alert.alert('No tags added', 'Please add at least one tag before proceeding.');
      return;
    }
    
    setStep(step + 1);
  };

  // Navigate to previous step in the creation wizard
  const handleGoBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Proceed from color selection to final review step
  const handleNextAfterColor = () => {
    setStep(4);
  };

  // Exit the creation process and return to home screen
  const handleExitCreate = () => {
    router.replace("/home")
  }

  // Fetch popular styles from existing posts in Firestore
  const fetchExistingStyles = async () => {
    setLoadingStyles(true);
    try {
      // Query posts collection to get existing styles
      const postsRef = collection(db, "posts");
      const postsSnapshot = await getDocs(postsRef);
      
      // Extract all style arrays from posts and flatten them
      const allStyles = [];
      postsSnapshot.forEach(doc => {
        const postData = doc.data();
        if (postData.styles && Array.isArray(postData.styles)) {
          allStyles.push(...postData.styles);
        }
      });
      
      // Count occurrences of each style
      const styleCounts = {};
      allStyles.forEach(style => {
        styleCounts[style] = (styleCounts[style] || 0) + 1;
      });
      
      // Sort styles by popularity (occurrence count)
      const sortedStyles = Object.keys(styleCounts).sort((a, b) => 
        styleCounts[b] - styleCounts[a]
      );
      
      // Update state with unique styles
      const uniqueStyles = Array.from(new Set([
        ...styleOptions,  // Include default options
        ...sortedStyles   // Add existing styles from posts
      ]));
      
      setStyleOptions(uniqueStyles);
      setPopularStyles(sortedStyles.slice(0, 5)); // Store top 5 most popular
      
    } catch (error) {
      console.error("Error fetching existing styles:", error);
    } finally {
      setLoadingStyles(false);
    }
  };

  // Add a style to the current post
  const handleAddStyle = (style) => {
    if (!postStyles.includes(style)) {
      setPostStyles([...postStyles, style]);
    }
    setShowStyleSelector(false);
  };

  // Remove a style from the current post
  const handleRemoveStyle = (styleToRemove) => {
    setPostStyles(postStyles.filter(style => style !== styleToRemove));
  };

  // Add a new custom style to both options and current post
  const handleAddNewStyle = () => {
    if (newStyleInput.trim() !== '' && !styleOptions.includes(newStyleInput.trim())) {
      const newStyle = newStyleInput.trim();
      // Add to options
      setStyleOptions([...styleOptions, newStyle]);
      // Add to selected styles
      setPostStyles([...postStyles, newStyle]);
      // Reset input
      setNewStyleInput('');
      setShowNewStyleInput(false);
    }
  };

  // Open image picker and handle image selection with cropping
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'We need permissions to access your photos!');
      return;
    }
  
    // First, let the user select an image
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,  
      aspect: [3, 4],  
      quality: 1,      
    });
  
    if (!result.canceled) {
      const selectedImage = result.assets[0];
      
      // Get the dimensions of the selected image
      Image.getSize(selectedImage.uri, async (width, height) => {
        // Calculate the current aspect ratio
        const currentRatio = width / height;
        const targetRatio = 3/4;
        
        // Define a small tolerance for aspect ratio comparison
        const aspectRatioTolerance = 0.05;
        
        // If the image is already very close to 3:4 ratio, use it directly
        if (Math.abs(currentRatio - targetRatio) <= aspectRatioTolerance) {
          console.log('Image already has the correct 3:4 aspect ratio, using as is');
          setImage(selectedImage.uri);
          setImageDimensions({ 
            width, 
            height 
          });
          
          // Clear existing tags when changing image
          setTags([]);
          return;
        }
        
        console.log('Image needs cropping to 3:4 aspect ratio');
        
        // Calculate dimensions for a 3:4 crop
        let cropWidth, cropHeight, cropX, cropY;
        
        if (width / height > targetRatio) {
          // Image is wider than 3:4
          cropHeight = height;
          cropWidth = height * targetRatio;
          cropX = (width - cropWidth) / 2;
          cropY = 0;
        } else {
          // Image is taller than 3:4
          cropWidth = width;
          cropHeight = width / targetRatio;
          cropX = 0;
          cropY = (height - cropHeight) / 2;
        }
        
        try {
          // Use ImageManipulator to crop the image to exact 3:4 ratio
          const croppedImage = await ImageManipulator.manipulateAsync(
            selectedImage.uri,
            [
              {
                crop: {
                  originX: Math.round(cropX),
                  originY: Math.round(cropY),
                  width: Math.round(cropWidth),
                  height: Math.round(cropHeight),
                },
              },
            ],
            { 
              compress: 1.0,
              format: ImageManipulator.SaveFormat.JPEG,
              base64: false 
            }
          );
          
          setImage(croppedImage.uri);
          setImageDimensions({ 
            width: croppedImage.width, 
            height: croppedImage.height 
          });
          
          // Clear existing tags when changing image
          setTags([]);
        } catch (error) {
          console.error('Error cropping image:', error);
          Alert.alert('Error', 'Failed to process the image');
        }
      });
    }
  };

  // Handle image press to add a new tag at the tap location
  const handleImagePress = (event) => {
    // Get tap coordinates from event
    const { locationX, locationY } = event.nativeEvent;
  
    // Get the current container dimensions
    const containerWidth = imageDimensions.width;
    const containerHeight = imageDimensions.height;
    
    if (containerWidth <= 0 || containerHeight <= 0) {
      console.error("Invalid container dimensions for tag placement");
      Alert.alert("Error", "Cannot place tag. Please try again.");
      return;
    }
    
    // Adjust for container borders (2px on each side)
    const adjustedLocationX = locationX - 2; 
    const adjustedLocationY = locationY - 2;
    
    // Calculate positions relative to the image content area (not including borders)
    const innerWidth = containerWidth - 4; // 4px total border width (2px each side)
    const innerHeight = containerHeight - 4; // 4px total border height (2px each side)
    
    // Calculate relative positions (0-1 range) using inner dimensions
    const relativeX = adjustedLocationX / innerWidth;
    const relativeY = adjustedLocationY / innerHeight;
    
    // Store both absolute and relative positions
    setCurrentTag({ 
      position: {
        x: adjustedLocationX, 
        y: adjustedLocationY,
        relativeX, 
        relativeY
      },
      color: tagColor // Set the default color
    });
    
    // Log for debugging
    console.log("Tag placement:", {
      containerDimensions: { width: containerWidth, height: containerHeight },
      innerDimensions: { width: innerWidth, height: innerHeight },
      absolute: { x: adjustedLocationX, y: adjustedLocationY },
      relative: { x: relativeX, y: relativeY }
    });
    
    // For new tags, show the tag modal
    setTagModalVisible(true);
    setEditingExistingTag(false);
  };

  // Handle press on an existing tag marker to edit it
  const handlePressMarker = (tag) => {
    // Extract position information correctly
    const position = tag.position || {};
    
    // Create a currentTag object with consistent structure
    setCurrentTag({
      ...tag,
      position: {
        x: position.x || 0,
        y: position.y || 0,
        relativeX: position.relativeX || 0,
        relativeY: position.relativeY || 0
      },
      color: tag.color || tagColor
    });
    
    // Open modal in edit mode
    setTagModalVisible(true);
    setEditingExistingTag(true);
  };

  // Find a tag in the tags array by its position
  const findTagByPosition = (tagToFind) => {
    if (!tagToFind || !tagToFind.position) return -1;
    
    return tags.findIndex(tag => {
      const position = tag.position || {};
      return (
        position.relativeX === tagToFind.position.relativeX && 
        position.relativeY === tagToFind.position.relativeY
      );
    });
  };

  // Handle color selection for tags
  const handleTagColorSelect = (color) => {
    setTagColor(color);
    
    if (currentTag && currentTag.selectAll) {
      // Update all tags at once
      setTags(
        tags.map((tag) => ({ ...tag, color: color }))
      );
      
      // Keep color selection mode active for "Select All"
      // The user can try multiple colors before deciding
    } else if (currentTag && currentTag.position) {
      // Find the index of the tag to update
      const tagIndex = findTagByPosition(currentTag);
      
      if (tagIndex !== -1) {
        // Create a new array with the updated tag
        const updatedTags = [...tags];
        updatedTags[tagIndex] = {
          ...updatedTags[tagIndex],
          color: color
        };
        setTags(updatedTags);
        
        // Update the current tag color too so the UI reflects it
        setCurrentTag({
          ...currentTag,
          color: color
        });
        
        // Keep color selection mode active
        // This allows trying multiple colors without reselecting the marker
      }
    }
  };

  // Handle press on a tag marker during color selection mode
  const handleColorMarkerPress = (tag) => {
    // Set current tag with proper nested structure
    setCurrentTag({
      ...tag,
      position: tag.position || {
        x: tag.x || 0,
        y: tag.y || 0,
        relativeX: tag.relativeX || 0,
        relativeY: tag.relativeY || 0
      },
      color: tag.color || tagColor
    });
    
    // Activate color selection mode
    setColorSelectionMode(true);
  };

  // Add or update a tag based on data from the TagDetailModal
  const handleAddOrUpdateTag = (tagData, isEditing) => {
    if (isEditing) {
      // Update existing tag
      const tagIndex = findTagByPosition(currentTag);
      
      if (tagIndex !== -1) {
        // Create a new array with the updated tag
        const updatedTags = [...tags];
        updatedTags[tagIndex] = tagData;
        setTags(updatedTags);
      }
    } else {
      // Add new tag
      setTags([...tags, tagData]);
    }
  };

  // Delete a tag from the tags array
  const handleDeleteTagFromModal = (tagToDelete) => {
    const tagIndex = findTagByPosition(tagToDelete);
    
    if (tagIndex !== -1) {
      const updatedTags = [...tags];
      updatedTags.splice(tagIndex, 1);
      setTags(updatedTags);
    }
  };

  // Render a tag marker on the image
  const renderMarker = (tag, index, onPress) => {
    // Extract position from the nested position object
    const position = tag.position || {};
    
    // Get the relative coordinates
    const relativeX = position.relativeX || 0;
    const relativeY = position.relativeY || 0;
    
    if (!relativeX || !relativeY) {
      console.error("Missing position data for tag:", tag);
      return null;
    }
    
    // Calculate display position based on relative coordinates
    const displayX = relativeX * imageDimensions.width;
    const displayY = relativeY * imageDimensions.height;
    
    return (
      <View
        key={index}
        className="absolute z-10"
        style={{
          left: displayX - 12.5, // Center marker (half of marker width)
          top: displayY - 12.5,  // Center marker (half of marker height)
        }}
      >
        <TouchableOpacity
          onPress={() => onPress(tag)}
          className="w-[25px] h-[25px] rounded-full border border-black"
          style={{ backgroundColor: tag.color || '#FFFFFF' }}
        />
      </View>
    );
  };

  // Upload post to Firebase Storage and Firestore
  const handleUploadPost = async () => {
    if (!image) {
      Alert.alert('No image selected', 'Please select an image first.');
      return;
    }
  
    if (tags.length === 0) {
      Alert.alert('No tags added', 'Please add at least one tag before uploading.');
      return;
    }
  
    setUploading(true);
    try {
      // Get the image as a blob directly
      const response = await fetch(image);
      const blob = await response.blob();
  
      // Upload image to Firebase storage
      const storageRef = ref(
        storage,
        `posts/${auth.currentUser.uid}/${Date.now()}.jpg`
      );
      await uploadBytes(storageRef, blob);
      const imageUrl = await getDownloadURL(storageRef);
  
      // Get username from user document
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const username = userDoc.exists() ? userDoc.data().username : 'Unknown';
  
      // Ensure tags have consistent structure before upload
      const formattedTags = tags.map((tag) => {
        // Handle both legacy format and new nested format
        const position = tag.position || {};
        
        // Get relative coordinates from either location
        const relativeX = position.relativeX || tag.relativeX;
        const relativeY = position.relativeY || tag.relativeY;
        
        // Get absolute coordinates from either location
        const absX = position.x || tag.x;
        const absY = position.y || tag.y;
        
        // Ensure we have valid coordinates
        if (!relativeX || !relativeY) {
          console.error("Missing position data for tag:", tag);
          // Use fallback or calculate if missing
          const calculatedRelX = absX / imageDimensions.width;
          const calculatedRelY = absY / imageDimensions.height;
          
          console.log("Using calculated relative position:", calculatedRelX, calculatedRelY);
          
          return {
            position: {
              x: absX,
              y: absY,
              relativeX: calculatedRelX,
              relativeY: calculatedRelY
            },
            brand: tag.brand,
            productName: tag.productName || '',
            price: tag.price || '',
            url: tag.url || '',
            color: tag.color || '#F3E3D3',
            size: tag.size || '',
            itemColor: tag.itemColor || '',
            itemStyle: tag.itemStyle || '',
            productType: tag.productType || ''
          };
        }
        
        // Return the properly structured tag data
        return {
          position: {
            x: absX,
            y: absY,
            relativeX: relativeX,
            relativeY: relativeY
          },
          brand: tag.brand,
          productName: tag.productName || '',
          price: tag.price || '',
          url: tag.url || '',
          color: tag.color || '#F3E3D3',
          size: tag.size || '',
          itemColor: tag.itemColor || '',
          itemStyle: tag.itemStyle || '',
          productType: tag.productType || ''
        };
      });
  
      // Log for debugging
      console.log("Formatted tags for upload:", JSON.stringify(formattedTags, null, 2));
      console.log("Image dimensions for upload:", imageDimensions);
  
      // Add post document to Firestore with tags and detailed image metadata
      await addDoc(collection(db, 'posts'), {
        imageUrl,
        caption: caption.trim(),
        userId: auth.currentUser.uid,
        username,
        createdAt: serverTimestamp(),
        tags: formattedTags,
        styles: postStyles,
        // Store detailed image metadata for precise positioning
        imageMetadata: {
          width: imageDimensions.width,
          height: imageDimensions.height,
          innerWidth: imageDimensions.innerWidth,
          innerHeight: imageDimensions.innerHeight,
          aspectRatio: imageDimensions.width / imageDimensions.height,
          borderWidth: 2, // Store border width for reference
          createdOn: Platform.OS, // Store platform for debugging purposes
        },
      });
      
      Alert.alert('Success', 'Post uploaded successfully!');
      setImage(null);
      setTags([]);
      setCaption('');
      setStep(1);
      router.replace("/profile");
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'There was an issue uploading your post.');
    } finally {
      setUploading(false);
    }
  };

  // Main render function for the create post wizard
  return (
    <SafeAreaView className="flex-1 bg-primary px-6">
      {/* Main exit button */}
      <View className="flex-row items-center justify-between w-full mt-6 mb-3">
        <View className="flex-1" />
        <TouchableOpacity 
          onPress={handleExitCreate} 
          className="p-2"
        >
          <Image source={icons.cross} className="w-8 h-8" />
        </TouchableOpacity>
      </View>

      {/* Main content container */}
      <View className="flex-1 items-center justify-center mt-2">
        {/* ====== STEP 1: IMAGE SELECTION ====== */}
        {step === 1 && (
          <>
            {/* Header text */}
            <Text className="text-6xl font-bregular text-black mb-2">
              create new post
            </Text>
            
            {/* Image preview container with 3:4 aspect ratio */}
            <View className="w-96 bg-[#C9B8A7] border-2 border-black rounded-2xl items-center justify-center mb-8" 
              style={{aspectRatio: 3/4}}>
              {image ? (
                // Display selected image if available
                <Image
                  source={{ uri: image }}
                  className="w-full h-full rounded-2xl"
                  resizeMode="contain"
                />
              ) : (
                // Placeholder text when no image is selected
                <View className="flex items-center px-8">
                  {/* <Text className="text-black font-montRegular">No posts available...</Text> */}
                  <Text className="text-black font-montSemiBold text-center">NOTE for iOS users:{'\n'}</Text>
                  <Text className="text-black font-montRegular text-center">Currently iOS doesn't support 3:4 ratio cropping. Please centre your content in the middle of the crop square.</Text>
                  <Text className="text-black font-montRegular text-center">{'\n'}Apologies for the inconvenience.</Text>
                </View>
                
              )}
            </View>
            
            {/* Image selection button */}
            <TouchableOpacity
              onPress={pickImage}
              className="bg-black py-4 w-full rounded-2xl items-center mb-4"
            >
              <Text className="text-[#E0C9B2] font-montRegular text-lg">
                Pick Image
              </Text>
            </TouchableOpacity>
            
            {/* Navigation button to proceed to next step */}
            <TouchableOpacity
              onPress={handleNext}
              className="py-4 w-full bg-black rounded-2xl items-center mb-4"
            >
              <Text className="text-primary font-montRegular text-lg">Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ====== STEP 2: TAG PLACEMENT ====== */}
        {step === 2 && (
          <>
            <View>
              
            </View>
            {/* Header text */}
            <Text className="text-6xl font-bregular text-black mb-2">
              ADD TAGS
            </Text>
            
            {/* Instructional text for the user */}
            <Text className="text-lg font-montRegular text-black mb-6">
              press anywhere to add a tag
            </Text>

            {/* Interactive image container for tag placement */}
            <View 
              className="w-96 border-2 border-blbetweenack rounded-2xl items-center justify-center mb-8 overflow-hidden" 
              style={{ aspectRatio: 3/4 }}
              onLayout={(event) => {
                // Capture container dimensions to properly position tags
                const { width, height } = event.nativeEvent.layout;
                
                // Calculate inner dimensions (content area excluding borders)
                const innerWidth = width - 4; // 2px border on each side
                const innerHeight = height - 4; // 2px border on each side
                
                // Store dimensions for tag positioning calculations
                setImageDimensions({ 
                  width, 
                  height,
                  innerWidth,
                  innerHeight
                });
              }}
            >
              {/* Touchable area for placing tags */}
              <TouchableOpacity
                activeOpacity={1}
                onPress={handleImagePress}
                className="w-full h-full relative"
              >
                {/* Display the selected image */}
                {image && (
                  <Image
                    source={{ uri: image }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                )}

                {/* Render existing tags as markers on the image */}
                {tags.map((tag, index) => renderMarker(tag, index, handlePressMarker))}
              </TouchableOpacity>
            </View>
            
            {/* Navigation buttons */}
            <TouchableOpacity
              onPress={handleGoBack}
              className="bg-black py-4 w-full rounded-2xl items-center mb-4"
            >
              <Text className="text-primary font-montRegular text-lg">
                Go back
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleNext}
              className="py-4 w-full bg-black rounded-2xl items-center mb-4"
            >
              <Text className="text-primary font-montRegular text-lg">Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ====== STEP 3: TAG COLOR CUSTOMIZATION ====== */}
        {step === 3 && (
          <>
            <View className="flex-row">
              <View className="mt-1">
                {/* Button to select and color all tags at once */}
                <TouchableOpacity
                  onPress={() => {
                    setCurrentTag({selectAll: true});
                    setColorSelectionMode(true);
                  }}
                  className="bg-black p-2 rounded-lg self-start"
                >
                  <Text className="text-primary text-center font-montRegular">Select{'\n'}All{'\n'}Tags</Text>
                </TouchableOpacity>
              </View>

              <View className="ml-4">
                {/* Header text */}
                <Text className="text-5xl text-center font-bregular text-black">
                  PICK TAG COLOUR
                </Text>
                
                {/* Instructional text for the user */}
                <Text className="text-lg font-montRegular text-center text-black mb-2">
                  select each point to pick colour{'\n'} or select all tags
                </Text>
              </View>
            </View>
            
            {/* Image container with tag markers */}
            <View className="w-96 border-2 border-black rounded-2xl items-center justify-center mb-8 overflow-hidden" 
              style={{ aspectRatio: 3/4}}>
              <Image
                source={{ uri: image }}
                className="w-full h-full"
                resizeMode="cover"
              />

              {/* Render all tag markers with their current colors */}
              {tags.map((tag, index) => renderMarker(tag, index, handleColorMarkerPress))}
              
              {/* Color selection overlay - shown only when a tag is selected for coloring */}
              {colorSelectionMode && (
                <>
                  {/* Semi-transparent overlay to focus attention on color selection */}
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => {
                      // Exit color selection mode when tapping outside
                      setColorSelectionMode(false);
                      // Reset selectAll flag if it was set
                      if (currentTag.selectAll) {
                        setCurrentTag({});
                      }
                    }}
                    className="absolute z-10 inset-0 bg-black/40"
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                  />
                  
                  {/* Color selector - positioned dynamically based on selected tag location */}
                  <View className="absolute z-20"
                    style={{
                      // Position at left if marker is in right half, otherwise at right
                      ...(currentTag.position && currentTag.position.x > 150
                        ? {left: 20}
                        : {right: 20}),
                    }}
                  >
                    <ColorSelectionButton 
                      onColorSelect={handleTagColorSelect}
                    />
                  </View>
                  
                  {/* Visual indicator (white ring) around the currently selected tag */}
                  {currentTag && currentTag.position && !currentTag.selectAll && (
                    <View
                      className="absolute z-30"
                      style={{
                        left: currentTag.position.relativeX * imageDimensions.width - 15,
                        top: currentTag.position.relativeY * imageDimensions.height - 15,
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        borderWidth: 2,
                        borderColor: 'white',
                        backgroundColor: 'transparent',
                      }}
                    />
                  )}
                </>
              )}
            </View>
            
            {/* Navigation buttons */}
            <TouchableOpacity
              onPress={() => setStep(2)}
              className="bg-black py-4 w-full rounded-2xl items-center mb-4"
            >
              <Text className="text-primary font-montRegular text-lg">
                Go back
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleNextAfterColor}
              className="bg-black py-4 w-full rounded-2xl items-center mb-4"
            >
              <Text className="text-primary font-montRegular text-lg">Next</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ====== STEP 4: REVIEW AND UPLOAD ====== */}
        {step === 4 && (
          <View className="flex-1 w-full">
            {/* Header text */}
            <Text className="text-6xl font-bregular text-black mb-2 text-center">
              REVIEW & UPLOAD
            </Text>
            
            {/* KeyboardAvoidingView prevents keyboard from hiding form inputs */}
            <KeyboardAvoidingView 
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              className="flex-1"
              keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 20}
            >
              <ScrollView 
                className="flex-1"
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ 
                  paddingBottom: 20,
                  alignItems: 'center'
                }}
                keyboardShouldPersistTaps="handled"
              >
                {/* Final image preview with all tags in place */}
                <View className="w-11/12 border-2 border-black rounded-2xl items-center justify-center mb-8 overflow-hidden" 
                  style={{ aspectRatio: 3/4}}>
                  <Image
                    source={{ uri: image }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                  
                  {/* Display all markers with their final colors */}
                  {tags.map((tag, index) => renderMarker(tag, index, handlePressMarker))}
                </View>
                
                {/* Caption input section */}
                <View className="w-full mb-4 px-4">
                  <Text className="text-xl font-montSemiBold text-black mb-2">
                    Add a caption
                  </Text>
                  <View className="bg-white/50 rounded-lg border-2 border-black overflow-hidden">
                    <TextInput
                      value={caption}
                      onChangeText={setCaption}
                      placeholder="Write a caption for your post..."
                      placeholderTextColor="#00000050"
                      className="p-3 text-lg font-montRegular"
                      multiline
                      numberOfLines={3}
                      maxLength={150}
                      textAlignVertical="top"
                      style={{ minHeight: 80 }}
                    />
                  </View>
                  {/* Character counter for caption */}
                  <Text className="text-xs text-black/50 mt-1 text-right">{caption.length}/150</Text>
                </View>

                {/* Style selection section */}
                <View className="w-full mb-4 px-4">
                  <Text className="text-xl font-montSemiBold text-black mb-2">
                    Add Styles
                  </Text>
                  
                  {/* Display selected styles */}
                  <View className="flex-row flex-wrap mb-2">
                    {postStyles.map((style, index) => (
                      <View key={index} className="bg-black rounded-full px-3 py-3 m-1 flex-row items-center">
                        <Text className="text-m text-primary font-montMedium mr-2">{style}</Text>
                        <TouchableOpacity onPress={() => handleRemoveStyle(style)}>
                          <Image source={icons.deletePrimary} className="w-4 h-4" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  
                  {/* Quick access to popular styles - only shown if we have popular styles */}
                  {popularStyles.length > 0 && !showStyleSelector && !showNewStyleInput && (
                    <View className="mb-3">
                      <Text className="text-sm font-montRegular text-black/70 mb-1">Popular styles:</Text>
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        className="flex-row"
                      >
                        {popularStyles.map((style, index) => (
                          <TouchableOpacity 
                            key={index} 
                            onPress={() => handleAddStyle(style)}
                            className="bg-[#E0C9B2]/70 border border-black mr-2 px-3 py-1 rounded-full"
                          >
                            <Text className="font-montRegular">{style}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                  
                  {/* Style options list - shown when selector is opened */}
                  {showStyleSelector && (
                    <View className="bg-white/80 rounded-lg border-2 border-black p-2 mb-2">
                      <View style={{ maxHeight: 150 }}>
                        <ScrollView 
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                          contentContainerStyle={{ paddingRight: 5 }}
                        >
                          {styleOptions.map((style, index) => (
                            <TouchableOpacity 
                              key={index} 
                              onPress={() => handleAddStyle(style)}
                              className="py-2 border-b border-gray-200"
                            >
                              <Text className="font-montRegular">{style}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  )}
                  
                  {/* Input for new custom style */}
                  {showNewStyleInput ? (
                    <View className="flex-row mb-2">
                      <TextInput
                        className="bg-white/50 font-montRegular p-3 rounded-lg border-2 border-black flex-1 mr-2"
                        placeholder="Enter new style..."
                        placeholderTextColor="#00000050"
                        value={newStyleInput}
                        onChangeText={setNewStyleInput}
                        maxLength={20}
                        autoFocus
                      />
                      <TouchableOpacity
                        onPress={handleAddNewStyle}
                        className="bg-black p-3 rounded-lg mr-2"
                        disabled={!newStyleInput.trim()}
                      >
                        <Text className="text-primary font-montRegular">Add</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setShowNewStyleInput(false);
                          setNewStyleInput('');
                        }}
                        className="bg-[#E0C9B2] border-2 border-black p-3 rounded-lg"
                      >
                        <Text className="text-black font-montRegular">Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View className="flex-row">
                      <TouchableOpacity
                        onPress={() => setShowStyleSelector(!showStyleSelector)}
                        className="bg-black py-3 px-4 rounded-lg mr-2 flex-1"
                      >
                        <Text className="text-center text-primary font-montRegular">
                          {showStyleSelector ? "Hide Styles" : "Select Style"}
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        onPress={() => setShowNewStyleInput(true)}
                        className="bg-[#E0C9B2] border-2 border-black py-3 px-4 rounded-lg"
                      >
                        <Text className="text-center text-secondary font-montRegular">+ New Style</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                
                {/* Navigation and upload buttons */}
                <View className="w-11/12 mb-10">
                  <TouchableOpacity
                    onPress={() => setStep(3)}
                    className="bg-black py-4 w-full rounded-2xl items-center mb-4"
                  >
                    <Text className="text-primary font-montRegular text-lg">
                      Go back
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleUploadPost}
                    disabled={uploading}
                    className={`bg-[#E0C9B2] border-black border-2 py-4 w-full rounded-2xl items-center mb-4 ${
                      uploading ? 'bg-white' : ''
                    }`}
                  >
                    <Text className="text-secondary font-montRegular text-lg">
                      {uploading ? 'Uploading...' : 'Upload Post'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        )}
      </View>

      {/* Tag Detail Modal Component */}
      <TagDetailModal
        visible={tagModalVisible}
        onClose={() => setTagModalVisible(false)}
        onAdd={handleAddOrUpdateTag}
        onDelete={handleDeleteTagFromModal}
        currentTag={currentTag}
        editingExistingTag={editingExistingTag}
        defaultTagColor={tagColor}
      />
    </SafeAreaView>
  );
};

export default CreateModal;