/**
 * Settings.jsx - User settings management screen
 * 
 * This component allows users to manage their account settings and preferences,
 * including account privacy, notification preferences, and access to support resources.
 * It provides toggles for key settings and navigation to additional settings screens.
 * 
 * Features:
 * - Account privacy controls (public/private account)
 * - Notification preference management (placeholder)
 * - Support resources access (placeholder)
 * - Logout functionality
 * - Real-time settings updates via Firebase
 */
import { View, Text, TouchableOpacity, Image, Switch, ScrollView, Alert, ActivityIndicator } from 'react-native';
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { icons } from '../../constants/icons';
import { router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../backend/firebaseConfig';
import privacyService from '../../backend/privacyService';

const Settings = () => {
  // State for toggle switches and loading indicators
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Fetch user's current privacy setting on component mount
  useEffect(() => {
    fetchUserPrivacySettings();
  }, []);
  
  // Retrieve user's privacy settings from Firestore
  const fetchUserPrivacySettings = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsPrivate(userData.isPrivate || false);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching user privacy settings:', error);
      setIsLoading(false);
    }
  };
  
  // Toggle account privacy setting and update in Firestore
  const togglePublicAccount = async () => {
    try {
      setIsUpdating(true);
      
      // Toggle local state immediately for responsive UI
      const newPrivacyValue = !isPrivate;
      setIsPrivate(newPrivacyValue);
      
      // Update Firestore
      await privacyService.toggleAccountPrivacy(newPrivacyValue);
      
      // Show feedback to user
      Alert.alert(
        "Privacy Updated",
        `Your account is now ${newPrivacyValue ? 'private. Only approved followers can see your content' : 'public. Anyone can see your content'}.`,
        [{ text: "OK" }]
      );
    } catch (error) {
      // Revert state on error
      setIsPrivate(previousState => !previousState);
      Alert.alert("Error", "Failed to update privacy settings. Please try again.");
      console.error('Error updating privacy setting:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Render settings screen with all options
  return (
    <SafeAreaView className="bg-primary h-full">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header with back button */}
        <View className="flex-row items-center pb-4 pt-2 px-4">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <Image 
              source={icons.backArrow} 
              className="w-12 h-12" 
              resizeMode="contain" 
            />
          </TouchableOpacity>
          <Text className="flex-1 text-center pt-2 text-4xl font-bregular">Settings</Text>
        </View>
        
        {/* Settings sections */}
        <View className="px-5 py-6">
          {/* Account Settings Section */}
          <View className="mb-6">
            <Text className="text-xl font-montBold mb-4">Account</Text>
            
            {/* Public/Private Account Toggle */}
            <View className="border-2 bg-white rounded-xl p-4 mb-3 shadow-sm">
              <View className="flex-row justify-between items-center">
                <View>
                  <Text className="text-lg font-montMedium mb-1">Account Privacy</Text>
                  {isLoading ? (
                    <Text className="text-gray-500 font-montRegular">Loading settings...</Text>
                  ) : (
                    <Text className="text-gray-500 font-montRegular">
                      {isPrivate 
                        ? 'Your account is private.' 
                        : 'Your account is public.'}
                    </Text>
                  )}
                </View>
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Switch
                    trackColor={{ false: '#E0E0E0', true: '#000000' }}
                    thumbColor={'#FFFFFF'}
                    ios_backgroundColor="#E0E0E0"
                    onValueChange={togglePublicAccount}
                    value={isPrivate}
                    disabled={isLoading}
                  />
                )}
              </View>
            </View>
          
            
            {/* Change Password Option */}
            <TouchableOpacity className="border-2 bg-white rounded-xl p-4 shadow-sm">
              <View className="flex-row justify-between items-center">
                <Text className="text-lg font-montMedium">Change Password (placeholder)</Text>
                <Image 
                  source={icons.hanger} 
                  className="w-6 h-6" 
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Notifications Section */}
          <View className="mb-6">
            <Text className="text-xl font-montBold mb-4">Notifications (placeholders)</Text>
            
            {/* In-App Notifications Toggle */}
            <View className="border-2 bg-white rounded-xl p-4 mb-3 shadow-sm">
              <View className="flex-row justify-between items-center">
                <Text className="text-lg font-montMedium">In-App Notifications</Text>
                <Switch
                  trackColor={{ false: '#E0E0E0', true: '#000000' }}
                  thumbColor={'#FFFFFF'}
                  ios_backgroundColor="#E0E0E0"
                  onValueChange={() => {}}
                  value={true}
                />
              </View>
            </View>
            
            {/* Push Notifications Toggle */}
            <View className="border-2 bg-white rounded-xl p-4 shadow-sm">
              <View className="flex-row justify-between items-center">
                <Text className="text-lg font-montMedium">Push Notifications</Text>
                <Switch
                  trackColor={{ false: '#E0E0E0', true: '#000000' }}
                  thumbColor={'#FFFFFF'}
                  ios_backgroundColor="#E0E0E0"
                  onValueChange={() => {}}
                  value={false}
                />
              </View>
            </View>
          </View>
          
          {/* Support Section */}
          <View className="mb-6">
            <Text className="text-xl font-montBold mb-4">Support (placeholders)</Text>
            
            
            {/* Privacy Policy Option */}
            <TouchableOpacity className="border-2 bg-white rounded-xl p-4 mb-3 shadow-sm">
              <View className="flex-row justify-between items-center">
                <Text className="text-lg font-montMedium">Privacy Policy</Text>
                <Image 
                  source={icons.hanger} 
                  className="w-6 h-6" 
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
            
            {/* Terms of Service Option */}
            <TouchableOpacity className="border-2 bg-white rounded-xl p-4 shadow-sm">
              <View className="flex-row justify-between items-center">
                <Text className="text-lg font-montMedium">Terms of Service</Text>
                <Image 
                  source={icons.hanger} 
                  className="w-6 h-6" 
                  resizeMode="contain"
                />
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Logout Option */}
          <TouchableOpacity className="bg-black rounded-xl p-4 mt-4">
            <Text className="text-white text-center text-lg font-montBold">Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default Settings