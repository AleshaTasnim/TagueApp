/**
 * Help.jsx - Help and support screen placeholder
 * 
 * This component displays a placeholder for the future help and support
 * section of the application. 
 * 
 * Features:
 * - Back navigation
 * - Placeholder message for upcoming help functionality
 * - Consistent layout with other app screens
 */
import { View, Text, TouchableOpacity, Image} from 'react-native'
import React from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { icons } from '../../constants/icons'

const Help = () => {

  // Navigate back to previous screen
  const goBack = () => {
    router.back();
  };

  // Render help screen with placeholder message
  return (
    <SafeAreaView
      className="flex-1 bg-primary"
    >
      {/* Header with back button */}
      <View className="flex-row">
        <TouchableOpacity
          onPress={goBack}
          className="flex-1 p-4"
        >
          <Image
            source={icons.backArrow}
            className="w-12 h-12"
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View className="flex-1"></View>
      </View>
      
      {/* Placeholder content indicating future implementation */}
      <View className="flex-1 bg-primary justify-center items-center ">
        <Text className="text-5xl font-bregular"> Help page coming soon</Text>
      </View>
    </SafeAreaView>
  )
}

export default Help