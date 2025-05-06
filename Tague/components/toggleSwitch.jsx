/**
 * ToggleSwitch.jsx - Animated toggle switch component
 * 
 * This component provides an animated toggle switch with customisable labels.
 * Features include:
 * - Smooth animation between states
 * - Customisable left and right labels
 * - Visual indication of active state
 * - Touch interaction on both the switch and labels
 */

import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';

const ToggleSwitch = ({ value, onToggle, leftLabel, rightLabel }) => {
  // Create animated value for the toggle position
  const translateX = React.useRef(new Animated.Value(value ? 1 : 0)).current;
  
  // Update animation when value changes
  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: value ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [value, translateX]);
  
  // Main component render
  return (
    <View className="flex-row items-center justify-center px-2">
      {/* Left label */}
      <TouchableOpacity 
        className="px-1 py-1.5"
        activeOpacity={0.7}
        onPress={() => !value && onToggle()}
      >
        <Text className={`font-montMedium text-sm ${!value ? 'text-black font-montSemiBold' : 'text-black/60'}`}>
          {leftLabel}
        </Text>
      </TouchableOpacity>
      
      {/* Toggle switch background */}
      <TouchableOpacity 
        className="w-20 h-9 rounded-full border-2 border-black bg-[#E0C9B2] justify-center mx-2"
        activeOpacity={0.8}
        onPress={onToggle} 
      >
        {/* Animated slider - We need to use style prop for the animation */}
        <Animated.View 
          className="w-8 h-8 rounded-full bg-black"
          style={{
            transform: [
              {
                translateX: translateX.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 37]
                })
              }
            ]
          }} 
        />
      </TouchableOpacity>
      
      {/* Right label */}
      <TouchableOpacity 
        className="px-1 py-1.5"
        activeOpacity={0.7}
        onPress={() => value && onToggle()}
      >
        <Text className={`font-montMedium text-sm ${value ? 'text-black font-montSemiBold' : 'text-black/60'}`}>
          {rightLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default ToggleSwitch;