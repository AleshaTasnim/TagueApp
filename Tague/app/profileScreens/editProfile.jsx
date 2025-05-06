/**
 * editProfile.jsx - User profile editing screen
 * 
 * This component allows users to edit their profile information, including display name
 * and bio text. Changes are synchronized between Firebase Authentication and Firestore
 * to maintain consistent user data across the application.
 * 
 * Features:
 * - Display name editing with character limit and validation
 * - Bio text editing with character limit
 * - Real-time character count indicators
 * - Loading states for both initial data fetch and save operations
 * - Form validation with error messages
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../../backend/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { router } from 'expo-router';
import { icons } from '../../constants/icons';

const EditProfile = () => {
  // State variables for form fields and loading states
  const [loading, setLoading] = useState(false);         // Save operation loading state
  const [initialLoading, setInitialLoading] = useState(true);  // Initial data loading state
  const [displayName, setDisplayName] = useState('');    // User's display name
  const [username, setUsername] = useState('');          // User's username (derived from email)
  const [bio, setBio] = useState('');                    // User's bio text
  
  const user = auth.currentUser;  // Current authenticated user
  
  // Load user data from Firebase Auth and Firestore on component mount
  useEffect(() => {
    const loadUserData = async () => {
      if (user) {
        // Set display name from Firebase Auth
        setDisplayName(user.displayName || '');
        // Set username from email (temporary implementation)
        setUsername(user.email?.split('@')[0] || '');
                
        try {
          // Get additional user data from Firestore
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setBio(userData.bio || '');
          }
        } catch (error) {
          console.error("Error loading user data:", error);
          Alert.alert("Error", "Failed to load your profile information");
        } finally {
          setInitialLoading(false);
        }
      }
    };
    
    loadUserData();
  }, [user]);
  
  // Save updated profile information to Firebase Auth and Firestore
  const handleSave = async () => {
    // Validate display name is not empty
    if (!displayName.trim()) {
      Alert.alert("Required", "Please enter a display name");
      return;
    }
    
    setLoading(true);
    
    try {
      // Update display name in Firebase Auth
      await updateProfile(user, {
        displayName: displayName.trim()
      });
      
      // Update user data in Firestore
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        updatedAt: new Date()
      });
      
      // Show success message and navigate back
      Alert.alert(
        "Success", 
        "Your profile has been updated",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      console.error("Error updating profile:", error);
      Alert.alert("Error", "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Navigate back with fallback logic to home if navigation fails
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
  
  // Display loading indicator while fetching initial data
  if (initialLoading) {
    return (
      <SafeAreaView className="flex-1 bg-primary">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#000" />
          <Text className="mt-4 text-black/70 font-montRegular">Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  // Main component render with form fields
  return (
    <SafeAreaView className="flex-1 bg-primary items-center"
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header with Back Button and Save Action */}
        <View className="h-16 justify-center">
          {/* Back Button */}
          <TouchableOpacity 
            onPress={goBack}
            className="absolute top-3 left-3 z-50"
          >
            <Image
              source={icons.backArrow}
              className="w-12 h-12"
              resizeMode="contain"
            />
          </TouchableOpacity>
          
          {/* Header Title */}
          <View className="items-center border-b border-black/10">
            <Text className="text-4xl pt-4 font-bregular text-black">Edit Profile</Text>
          </View>
          
          {/* Save Button in Header */}
          <TouchableOpacity 
            onPress={handleSave}
            disabled={loading}
            className="absolute right-4 z-10"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text className="text-black font-montSemiBold">Save</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          className="flex-1 px-5"
        >
          {/* Profile Edit Form Card */}
          <View className="mt-4 mb-8 rounded-xl overflow-hidden border-black border bg-[#E0C9B2]">
            {/* Gradient Background */}
            {/* <LinearGradient
              colors={['#F3E3D3', '#E0C9B2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            /> */}
            
            <View className="p-6">
              {/* Display Name Field */}
              <View className="mb-2">
                <Text className="text-xl text-center font-montSemiBold mb-2 text-black">Display Name</Text>
                <View className="bg-primary rounded-lg border-black border overflow-hidden">
                  <TextInput
                    value={displayName}
                    textAlign='center'
                    onChangeText={setDisplayName}
                    placeholder="Your display name"
                    placeholderTextColor="#00000050"
                    className="text-4xl font-bregular px-4 py-4 pb-2"
                    maxLength={30}
                  />
                </View>
                {/* Character Counter */}
                <Text className="text-m text-black/50 mt-1 text-right">{displayName.length}/30</Text>
              </View>
                        
              {/* Bio Field */}
              <View>
                <Text className="text-xl text-center font-montSemiBold mb-2 text-black">Bio</Text>
                <View className="bg-primary rounded-lg border-black border overflow-hidden">
                  <TextInput
                    value={bio}
                    textAlign='center'
                    onChangeText={setBio}
                    placeholder="Tell us about yourself..."
                    placeholderTextColor="#00000050"
                    className="text-lg p-3 font-montRegular"
                    multiline
                    numberOfLines={5}
                    maxLength={150}
                    textAlignVertical="top"
                    style={{ minHeight: 100 }}
                  />
                </View>
                {/* Character Counter */}
                <Text className="text-m text-black/50 mt-1 text-right">{bio.length}/150</Text>
              </View>
            </View>
          </View>
          
          {/* Explanatory Text */}
          <View className="mb-5 px-2">
            <Text className="text-sm font-montRegular text-black/70 text-center">
              Your username appears on your profile. Your display name is shown on your posts and comments.
            </Text>
          </View>
          
          {/* Primary Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={loading}
            className="bg-black py-4 rounded-xl items-center mb-8"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#F3E3D3" />
            ) : (
              <Text className="text-primary font-montMedium text-lg">Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EditProfile;