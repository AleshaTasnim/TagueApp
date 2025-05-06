/**
 * Wardrobe.jsx - Wardrobe navigation screen
 * 
 * This component displays a wardrobe-shaped UI that serves as a navigation hub
 * for the app's organisation features. It includes areas for bookmarked posts,
 * bookmarked tags, and inspiration boards, rendered as an interactive SVG, custom made by me.
 * 
 * Features:
 * - SVG-based wardrobe visual interface
 * - Responsive design that maintains aspect ratio on different screen sizes
 * - Navigation to bookmarked posts, tags, and inspiration boards
 */
import React from 'react';
import { View, Text, TouchableOpacity, Dimensions, SafeAreaView, Alert } from 'react-native';
import Svg, {
  Rect,
  Line,
  Path,
  Text as SvgText,
} from 'react-native-svg';
import { useRouter, router } from 'expo-router';
import { useState, useEffect } from 'react';

const Wardrobe = () => {
  const router = useRouter();
  // State for screen dimensions, updated on device rotation
  const [dimensions, setDimensions] = useState({
    screenWidth: Dimensions.get('window').width,
    screenHeight: Dimensions.get('window').height
  });

  // Calculate SVG dimensions based on screen height
  const svgHeight = dimensions.screenHeight * 0.7; // 70% of screen height
  const svgWidth = Math.min(
    dimensions.screenWidth * 0.9, // Max 90% of screen width
    (svgHeight / 660) * 359 // Maintain aspect ratio based on height
  );

  // Add listener for dimension changes (e.g., rotation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions({
        screenWidth: window.width,
        screenHeight: window.height
      });
    });
    
    return () => subscription?.remove();
  }, []);

  // Navigate to bookmarked posts screen
  const navigateToBookmarkedPosts = () => {
    router.push('../wardrobeScreens/bookmarkedPostsModal');
  };

  // Show alert for upcoming bookmarked tags feature
  const navigateToBookmarkedTags = () => {
    Alert.alert(
      "Coming Soon",
      "Bookmarked Tags feature is currently in development and will be available in a future update!",
      [{ text: "OK", style: "default" }]
    )
  };

  // Navigate to inspiration board collection screen
  const navigateToInspoBoardCollection = () => {
    router.push('../wardrobeScreens/inspoBoardCollection');
  };
  
  // Render the wardrobe UI with interactive elements
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-[#F3E3D3]">
      {/* Title - Outside the SVG */}
      <Text className="font-bregular text-5xl">WARDROBE</Text>
      
      <View className="relative">
        <Svg width={svgWidth} height={svgHeight} viewBox="0 0 359 660">
          {/* Wardrobe outline */}
          <Rect x="2" y="2" width="355" height="656" rx="17" stroke="black" strokeWidth="4" />
          
          {/* Horizontal dividers */}
          <Line y1="481" x2="359" y2="481" stroke="black" strokeWidth="4" />
          
          {/* Vertical divider */}
          <Line x1="180" y1="483" x2="180" y2="4" stroke="black" strokeWidth="4" />
          
          {/* Compartment fills */}
          <Path d="M4 19C4 10.7157 10.7157 4 19 4H178V479H4V19Z" fill="#E0C9B2" />
          <Path d="M20 657C11.1634 657 4 649.837 4 641L3.99999 483L355 483L355 641C355 649.837 347.837 657 339 657L20 657Z" fill="#E0C9B2" />
          <Path d="M356 20C356 11.1634 348.837 4 340 4H182V479H356V20Z" fill="#E0C9B2" />
          
          {/* Horizontal dividers */}
          <Line y1="535" x2="359" y2="535" stroke="black" strokeWidth="4" />
          <Line y1="600" x2="359" y2="600" stroke="black" strokeWidth="4" />

          {/* Door handles */}
          <Rect x="163" y="181" width="5" height="122" rx="2.5" fill="black" />
          <Rect x="191" y="181" width="5" height="122" rx="2.5" fill="black" />
          
          {/* Drawer handles */}
          <Rect x="59" y="506" width="54" height="5" rx="2.5" fill="black" />
          <Rect x="59" y="629" width="54" height="5" rx="2.5" fill="black" />
          <Rect x="242" y="506" width="54" height="5" rx="2.5" fill="black" />
          <Rect x="242" y="629" width="54" height="5" rx="2.5" fill="black" />
        </Svg>
        
        {/* Touchable Areas with Text - Outside the SVG */}
        <TouchableOpacity 
          className="absolute"
          style={{
            left: svgWidth * 0.04,
            top: svgHeight * 0.35,
            width: svgWidth * 0.42,
            height: svgHeight * 0.18,
          }}
          onPress={navigateToBookmarkedPosts}
        >
          <View className="items-center justify-center">
            <Text className="font-bregular text-black text-center text-3xl">BOOKMARKED</Text>
            <Text className="font-bregular text-black text-center text-3xl">POSTS</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="absolute"
          style={{
            left: svgWidth * 0.58,
            top: svgHeight * 0.35,
            width: svgWidth * 0.42,
            height: svgHeight * 0.18,
          }}
          onPress={navigateToBookmarkedTags}
        >
          <View className="items-center justify-center">
            <Text className="font-bregular text-black text-center text-3xl">BOOKMARKED</Text>
            <Text className="font-bregular text-black text-center text-3xl">TAGS</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="absolute"
          style={{
            left: svgWidth * 0.1,
            top: svgHeight * 0.835,
            width: svgWidth * 0.8,
            height: svgHeight * 0.09,
          }}
          onPress={navigateToInspoBoardCollection}
        >
          <View className="items-center justify-center">
            <Text className="font-bregular text-black text-center text-4xl">INSPIRATION BOARDS</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Wardrobe;