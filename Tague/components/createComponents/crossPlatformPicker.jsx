/**
 * crossPlatformPicker.jsx - Platform-specific picker component
 * 
 * This component provides a customised picker with appropriate UI patterns
 * for both iOS and Android platforms. It automatically detects the platform
 * and renders either a native wheel picker (iOS) or a custom list-based
 * picker (Android) with consistent styling across both platforms.
 * 
 * Features:
 * - Modal-based interface with confirm/cancel actions
 * - Native wheel picker experience on iOS
 * - Flat list selection interface on Android
 * - Consistent NativeWind styling with the app design system
 * - Support for dynamic options with highlighted selection state
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
  FlatList,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

const CrossPlatformPicker = ({
  visible,
  title,
  options,
  selectedValue,
  onValueChange,
  onConfirm,
  onCancel
}) => {
  // Store selected value for Android implementation
  const [androidSelectedValue, setAndroidSelectedValue] = useState(selectedValue || '');

  // Handle confirmation with platform-specific logic
  const confirmSelection = () => {
    if (Platform.OS === 'android') {
      onValueChange(androidSelectedValue);
    }
    onConfirm();
  };

  // Render each item in the Android selection list
  const renderAndroidItem = ({ item }) => (
    <TouchableOpacity
      className={`py-3.5 px-5 border-b border-black/10 ${androidSelectedValue === item ? 'bg-black/10' : ''}`}
      onPress={() => {
        setAndroidSelectedValue(item);
        onValueChange(item);
      }}
    >
      <Text className={`font-montRegular text-lg text-black text-center ${androidSelectedValue === item ? 'font-montSemiBold font-bold' : ''}`}>
        {item}
      </Text>
    </TouchableOpacity>
  );

  // Define iOS picker specific styling
  const iosPickerStyle = {
    height: 150,
    fontSize: 20,
    fontFamily: 'Montserrat-Regular',
    color: '#000000'
  };

  // Render the component with modal and platform-specific picker
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-[#E0C9B2] w-[85%] rounded-xl overflow-hidden max-h-[80%]">
          {/* Header with title and action buttons */}
          <View className="flex-row justify-between items-center p-4 border-b border-black">
            <TouchableOpacity onPress={onCancel}>
              <Text className="font-montRegular text-lg text-black">Cancel</Text>
            </TouchableOpacity>
            <Text className="font-montSemiBold text-lg">
              {title}
            </Text>
            <TouchableOpacity onPress={confirmSelection}>
              <Text className="font-montRegular text-lg text-black">
                Done
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Render platform-specific picker interface */}
          <View className="bg-[#F3E3D3] max-h-[300px]">
            {Platform.OS === 'ios' ? (
              // iOS native wheel picker implementation
              <Picker
                selectedValue={selectedValue}
                onValueChange={onValueChange}
                itemStyle={iosPickerStyle}
              >
                {options.map((option) => (
                  <Picker.Item 
                    key={option}
                    label={option}
                    value={option} 
                  />
                ))}
              </Picker>
            ) : (
              // Android custom flatlist implementation
              <FlatList
                data={options}
                renderItem={renderAndroidItem}
                keyExtractor={(item) => item}
                className="max-h-[300px] py-2.5"
                showsVerticalScrollIndicator={true}
                initialScrollIndex={options.indexOf(selectedValue)}
                getItemLayout={(data, index) => (
                  {length: 50, offset: 50 * index, index}
                )}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CrossPlatformPicker;