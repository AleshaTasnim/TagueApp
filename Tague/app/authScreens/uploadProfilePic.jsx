/**
 * UploadProfilePic.jsx - Profile picture upload screen
 * 
 * This component handles the initial profile picture upload process for new users.
 * It allows users to select, preview, and upload a profile image or skip this step.
 * The component is shown after account creation or signup, with username passed as a parameter.
 * 
 * Features:
 * - Image selection from device library
 * - Firebase Storage upload integration
 * - User profile update in both Authentication and Firestore
 * - Option to skip profile picture upload
 */
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { storage, auth, db } from '../../backend/firebaseConfig';
import { updateProfile } from 'firebase/auth';
import { icons } from '../../constants/icons';
import { images } from '../../constants/images';

const UploadProfilePic = () => {
  // Get username from navigation parameters
  const { username } = useLocalSearchParams();
  // State for selected image and upload status
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Open image picker to select profile picture from device library
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need permissions to access your photos!');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // Upload the selected image to Firebase Storage and update user profile
  const uploadProfilePicture = async () => {
    if (!image) {
      Alert.alert('No image selected', 'Please choose an image.');
      return;
    }
  
    setUploading(true);
    try {
      const response = await fetch(image);
      const blob = await response.blob();
      
      // Use a consistent filepath pattern without timestamps
      // This matches the pattern used in Profile.jsx
      const fileName = `profilePics/${auth.currentUser.uid}`;
      const storageRef = ref(storage, fileName);
  
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Add cache busting parameter to prevent stale images
      const cacheBustedURL = `${downloadURL}?t=${Date.now()}`;
  
      // Store the URL in Firestore (Database)
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        photoURL: downloadURL, // Store clean URL without cache busting in database
        displayName: username || auth.currentUser.displayName,
        email: auth.currentUser.email,
        updatedAt: new Date(),
      }, { merge: true });
  
      // Optionally update Firebase Auth profile as well
      await updateProfile(auth.currentUser, {
        photoURL: downloadURL, // Store clean URL without cache busting in auth
      });
  
      Alert.alert('Success', 'Profile picture updated!');
      router.replace('/(tabs)/profile');
    } catch (error) {
      console.error('Upload failed:', error);
      Alert.alert('Upload Failed', 'There was an error uploading your image.');
    } finally {
      setUploading(false);
    }
  };  

  // Skip profile picture upload and navigate to profile screen
  const skipProfilePicture = async () => {
    try {
      if (username) {
        await updateProfile(auth.currentUser, { displayName: username });
      }
      router.replace('/(tabs)/profile');
    } catch (error) {
      console.error('Skip failed:', error);
    }
  };
  
  // Render the profile picture upload interface
  return (
    <SafeAreaView className="bg-[#F5E6D8] h-full flex items-center justify-center">
      {/* Welcome heading and logo */}
      <View className="w-full">
        <Text className="text-5xl font-bregular text-center mt-4 mb-2">Welcome To</Text>
        <Image
          source={images.logo}
          resizeMode="contain"
          className="w-full h-[90px]"
        />
        <Text className="text-lg font-montRegular text-center mt-8 mb-8">Upload a profile picture</Text>
      </View>

      {/* Profile image preview area */}
      <View className="items-center justify-center mb-8">
        {image ? (
          <Image source={{ uri: image }} className="w-80 h-80 rounded-full bg-[#E5E5E5] border border-black" />
        ) : (
          <View className="w-80 h-80 rounded-full bg-[#E5E5E5] border border-black" />
        )}
      </View>

      {/* Image selection and upload buttons */}
      <View className="w-full px-8 mt-2 gap-4">
        <TouchableOpacity
          onPress={pickImage}
          className="bg-black py-4 rounded-lg w-full items-center shadow-md"
        >
          <Text className="text-primary font-montRegular text-lg">Pick Image</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={uploadProfilePicture}
          disabled={uploading}
          className="bg-black py-4 rounded-lg w-full items-center shadow-md"
        >
          <Text className="text-primary font-montRegular text-lg">
            {uploading ? 'Uploading...' : 'Upload'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Skip profile picture option */}
      <TouchableOpacity
        onPress={skipProfilePicture}
        className="flex-row items-center mt-8"
      >
        <Image
          source={icons.noImage}
          resizeMode="contain"
          className="w-8 h-8"
        />
        <Text className="text-secondary font-montSemiBold text-xl">Don't want a profile picture</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default UploadProfilePic;