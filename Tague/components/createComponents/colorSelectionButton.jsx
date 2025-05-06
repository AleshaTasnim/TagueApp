/**
 * ColorSelectionButton.jsx - Dual-option colour selection component
 * 
 * This component provides a customised button for selecting between two colour options
 * (cream/beige and black). It displays a side-by-side toggle interface with visual
 * feedback through blur effects when an option is selected. The component handles
 * state management and passes the selected colour back to the parent component.
 * 
 * Features:
 * - Visual toggle between two colour options
 * - Blur effect to indicate active selection
 * - Callback function to pass selected colour value to parent
 * - SVG-based rendering with dynamic state changes
 */

import React, { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

const ColorSelectionButton = ({ onColorSelect }) => {
  // State to track which side is currently selected
  const [selectedSide, setSelectedSide] = useState(null);
  
  // Define colour values based on the SVG
  const leftColor = '#F3E3D3';
  const rightColor = '#000000';
  
  // Process side selection and notify parent component
  const handleSidePress = (side) => {
    setSelectedSide(side);
    onColorSelect(side === 'left' ? leftColor : rightColor);
  };

  // Generate SVG markup with conditional blur effect based on selection
  const createSvgXml = () => {
    return `
    <svg width="233" height="70" viewBox="0 0 233 70" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Left side (beige) -->
      <g filter="${selectedSide === 'right' ? 'url(#blur_filter)' : ''}">
        <path d="M12 28C12 16.9543 20.9543 8 32 8H117V54H32C20.9543 54 12 45.0457 12 34V28Z" fill="#F3E3D3"/>
        <path d="M85.8501 41.32C84.1648 41.32 82.8741 40.84 81.9781 39.88C81.1035 38.92 80.6661 37.5653 80.6661 35.816V23.784C80.6661 22.0347 81.1035 20.68 81.9781 19.72C82.8741 18.76 84.1648 18.28 85.8501 18.28C87.5355 18.28 88.8155 18.76 89.6901 19.72C90.5861 20.68 91.0341 22.0347 91.0341 23.784V26.152H87.7061V23.56C87.7061 22.1733 87.1195 21.48 85.9461 21.48C84.7728 21.48 84.1861 22.1733 84.1861 23.56V36.072C84.1861 37.4373 84.7728 38.12 85.9461 38.12C87.1195 38.12 87.7061 37.4373 87.7061 36.072V32.648H91.0341V35.816C91.0341 37.5653 90.5861 38.92 89.6901 39.88C88.8155 40.84 87.5355 41.32 85.8501 41.32ZM98.2906 41.32C96.5626 41.32 95.24 40.8293 94.3226 39.848C93.4053 38.8667 92.9466 37.48 92.9466 35.688V23.912C92.9466 22.12 93.4053 20.7333 94.3226 19.752C95.24 18.7707 96.5626 18.28 98.2906 18.28C100.019 18.28 101.341 18.7707 102.259 19.752C103.176 20.7333 103.635 22.12 103.635 23.912V35.688C103.635 37.48 103.176 38.8667 102.259 39.848C101.341 40.8293 100.019 41.32 98.2906 41.32ZM98.2906 38.12C99.5066 38.12 100.115 37.384 100.115 35.912V23.688C100.115 22.216 99.5066 21.48 98.2906 21.48C97.0746 21.48 96.4666 22.216 96.4666 23.688V35.912C96.4666 37.384 97.0746 38.12 98.2906 38.12ZM106.015 18.6H109.535V37.8H115.327V41H106.015V18.6Z" fill="black"/>
      </g>
      
      <!-- Right side (black) -->
      <g filter="${selectedSide === 'left' ? 'url(#blur_filter)' : ''}">
        <path d="M117.25 8H201.25C212.296 8 221.25 16.9543 221.25 28V34C221.25 45.0457 212.296 54 201.25 54H117.25V8Z" fill="black"/>
        <path d="M127.228 41.32C125.5 41.32 124.177 40.8293 123.26 39.848C122.343 38.8667 121.884 37.48 121.884 35.688V23.912C121.884 22.12 122.343 20.7333 123.26 19.752C124.177 18.7707 125.5 18.28 127.228 18.28C128.956 18.28 130.279 18.7707 131.196 19.752C132.113 20.7333 132.572 22.12 132.572 23.912V35.688C132.572 37.48 132.113 38.8667 131.196 39.848C130.279 40.8293 128.956 41.32 127.228 41.32ZM127.228 38.12C128.444 38.12 129.052 37.384 129.052 35.912V23.688C129.052 22.216 128.444 21.48 127.228 21.48C126.012 21.48 125.404 22.216 125.404 23.688V35.912C125.404 37.384 126.012 38.12 127.228 38.12ZM140.073 41.32C138.366 41.32 137.065 40.84 136.169 39.88C135.273 38.8987 134.825 37.5013 134.825 35.688V18.6H138.345V35.944C138.345 36.712 138.494 37.2667 138.793 37.608C139.113 37.9493 139.561 38.12 140.137 38.12C140.713 38.12 141.15 37.9493 141.449 37.608C141.769 37.2667 141.929 36.712 141.929 35.944V18.6H145.321V35.688C145.321 37.5013 144.873 38.8987 143.977 39.88C143.081 40.84 141.779 41.32 140.073 41.32ZM147.828 18.6H153.044C154.857 18.6 156.18 19.0267 157.012 19.88C157.844 20.712 158.26 22.0027 158.26 23.752V25.128C158.26 27.4533 157.492 28.9253 155.956 29.544V29.608C156.809 29.864 157.406 30.3867 157.748 31.176C158.11 31.9653 158.292 33.0213 158.292 34.344V38.28C158.292 38.92 158.313 39.4427 158.356 39.848C158.398 40.232 158.505 40.616 158.676 41H155.092C154.964 40.6373 154.878 40.296 154.836 39.976C154.793 39.656 154.772 39.08 154.772 38.248V34.152C154.772 33.128 154.601 32.4133 154.26 32.008C153.94 31.6027 153.374 31.4 152.564 31.4H151.348V41H147.828V18.6ZM152.628 28.2C153.332 28.2 153.854 28.0187 154.196 27.656C154.558 27.2933 154.74 26.6853 154.74 25.832V24.104C154.74 23.2933 154.59 22.7067 154.292 22.344C154.014 21.9813 153.566 21.8 152.948 21.8H151.348V28.2H152.628Z" fill="#F3E3D3"/>
      </g>
      
      <!-- Filters -->
      <defs>
        <filter id="blur_filter" x="0" y="0" width="233" height="70" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
    </svg>`;
  };

  // Render the component with SVG and interactive touch areas
  return (
    <View style={{ width: 233, height: 70 }}>
      <SvgXml xml={createSvgXml()} width="100%" height="100%" />
      
      {/* Add touch interaction layer over SVG */}
      <View style={{ position: 'absolute', flexDirection: 'row', width: '100%', height: '100%' }}>
        <TouchableOpacity
          onPress={() => handleSidePress('left')}
          style={{ width: '50%', height: '100%' }}
          activeOpacity={0.7}
        />
        <TouchableOpacity
          onPress={() => handleSidePress('right')}
          style={{ width: '50%', height: '100%' }}
          activeOpacity={0.7}
        />
      </View>
    </View>
  );
};

export default ColorSelectionButton;