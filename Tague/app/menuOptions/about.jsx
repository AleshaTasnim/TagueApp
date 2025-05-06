/**
 * About.jsx - App information screen
 * 
 * This component displays information about the Tague application,
 * including its purpose, mission, features, and development details.
 * It provides users with context about the app's intended use and background.
 * 
 * Features:
 * - App description and mission statement
 * - Key features overview
 * - Project background and development story
 * - Developer information
 * - Version details
 */
import React from 'react'
import { Text, View, ScrollView, SafeAreaView, TouchableOpacity, Image} from 'react-native'
import { router } from 'expo-router';
import { icons } from '../../constants/icons';


const About = () => {

  // Navigate back to previous screen
  const goBack = () => {
    router.back();
  };

  // Render the about screen content
  return (
    <SafeAreaView className="flex-1 bg-primary">
      {/* Header with back button and title */}
      <View className="flex-row items-center p-2 pt-4">
        <TouchableOpacity 
          onPress={goBack} 
          className="mr-4"
        >
          <Image
            source={icons.backArrow}
            className="w-14 h-14"
            resizeMode="contain"
          />
        </TouchableOpacity>
        <Text className="text-5xl text-center font-bregular pt-">About Tague</Text>
      </View>
      
      {/* Main content in scrollable container */}
      <ScrollView className="flex-1 px-5 py-4">
        {/* App description section */}
        <Text className="text-xl font-bold mb-3">What is Tague?</Text>
        <Text className="text-base mb-4">
          Tague is a fashion-based social media platform designed to allow users to share their outfits, explore styles, and discover new products.
        </Text>
        
        {/* Mission statement section */}
        <Text className="text-xl font-bold mb-3">Our Mission</Text>
        <Text className="text-base mb-4">
          The platform aims to bridge the gap between fashion inspiration and purchase by integrating product links directly into posts, enabling users to transition from discovering outfits to purchasing featured items effortlessly.
        </Text>
        
        {/* Key features list */}
        <Text className="text-xl font-bold mb-3">Key Features</Text>
        <View className="mb-4">
          <Text className="text-base mb-2">• Integrated product links in fashion posts</Text>
          <Text className="text-base mb-2">• Seamless shopping experience for featured items</Text>
          <Text className="text-base mb-2">• User-curated fashion collections and outfit boards</Text>
          <Text className="text-base mb-2">• Fashion-concentrated content discovery</Text>
          <Text className="text-base mb-2">• Easy posting and tagging of fashion items</Text>
        </View>
        
        {/* Project background */}
        <Text className="text-xl font-bold mb-3">Our Story</Text>
        <Text className="text-base mb-6">
          Tague was born from the observation that while platforms like Instagram, Pinterest, and TikTok have become central to showcasing fashion trends, they don't provide users with a smooth way to explore and purchase featured items. As a final year project at Queen Mary University of London, Tague addresses this gap by creating a dedicated fashion-focused social media platform with integrated product linking.
        </Text>
        
        {/* Developer information */}
        <Text className="text-xl font-bold mb-3">Developed By</Text>
        <Text className="text-base mb-1">Alesha Tasnim</Text>
        <Text className="text-base mb-6">BSc Computer Science</Text>
        
        {/* Version information */}
        <Text className="text-base italic text-center text-gray-600 mb-8">
          Version 1.0.0 - 2025
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

export default About