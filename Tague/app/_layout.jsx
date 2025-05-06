/**
 * Root Component - App Entry Point
 * 
 * This file serves as the main entry point for the Tague app.
 * It manages application initialisation, font loading, splash screen,
 * and navigation stack configuration.
 * 
 * Functional Requirements covered: F.1, F.2
 */

import React, { useEffect } from 'react'
import { BackHandler } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SplashScreen, Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import '../backend/firebaseConfig';

/**
 * Prevents the splash screen from automatically hiding
 * Allows manual control over when to hide it (after fonts load)
 */
SplashScreen.preventAutoHideAsync();

/**
 * Main index component that initialises the app
 * Handles font loading and prevents back navigation
 */
const index = () => {
  /**
   * Load custom fonts for the application
   */
  const [fontsLoaded, error] = useFonts({
    "BebasNeue": require("../assets/fonts/BebasNeue-Regular.ttf"),
    "Montserrat-Black": require("../assets/fonts/Montserrat-Black.ttf"),
    "Montserrat-BlackItalic": require("../assets/fonts/Montserrat-BlackItalic.ttf"),
    "Montserrat-Bold": require("../assets/fonts/Montserrat-Black.ttf"),
    "Montserrat-BoldItalic": require("../assets/fonts/Montserrat-BoldItalic.ttf"),
    "Montserrat-ExtraBold": require("../assets/fonts/Montserrat-ExtraBold.ttf"),
    "Montserrat-ExtraBoldItalic": require("../assets/fonts/Montserrat-ExtraBoldItalic.ttf"),
    "Montserrat-ExtraLight": require("../assets/fonts/Montserrat-ExtraLight.ttf"),
    "Montserrat-ExtraLightItalic": require("../assets/fonts/Montserrat-ExtraLightItalic.ttf"),
    "Montserrat-Italic": require("../assets/fonts/Montserrat-Italic.ttf"),
    "Montserrat-Light": require("../assets/fonts/Montserrat-Light.ttf"),
    "Montserrat-LightItalic": require("../assets/fonts/Montserrat-LightItalic.ttf"),
    "Montserrat-Medium": require("../assets/fonts/Montserrat-Medium.ttf"),
    "Montserrat-MediumItalic": require("../assets/fonts/Montserrat-MediumItalic.ttf"),
    "Montserrat-Regular": require("../assets/fonts/Montserrat-Regular.ttf"),
    "Montserrat-SemiBold": require("../assets/fonts/Montserrat-SemiBold.ttf"),
    "Montserrat-SemiBoldItalic": require("../assets/fonts/Montserrat-SemiBoldItalic.ttf"),
    "Montserrat-Thin": require("../assets/fonts/Montserrat-Thin.ttf"),
    "Montserrat-ThinItalic": require("../assets/fonts/Montserrat-ThinItalic.ttf")
  })

  /**
   * Effect to hide splash screen once fonts are loaded
   * Throws error if font loading fails
   */
  useEffect(() => {
    if(error) throw error;
    if(fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded, error])

  /**
   * Effect to disable the Android back button completely for app navigation
   */
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Return true to prevent default back behaviour
      return true;
    });

    return () => backHandler.remove();
  }, []);

  /**
   * Return null if fonts are not yet loaded and no error occurred
   */
  if(!fontsLoaded && !error) return null;

  /**
   * Main application structure with navigation stack configuration
   * All screens have header hidden through screenOptions
   */
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)"/>
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            gestureEnabled: false,
            // This is needed for Android to prevent going back
            gestureDirection: 'horizontal'
          }} 
        />
        <Stack.Screen name="authScreens"/>
        <Stack.Screen
          name="createScreens"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom', 
          }}
        />
        <Stack.Screen 
          name="menuOptions" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }} 
        />
        <Stack.Screen 
          name="profileScreens" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }} 
        />
        <Stack.Screen name="search/[query]"/>
        <Stack.Screen 
          name="wardrobeScreens" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }} 
        />
        <Stack.Screen name="directMessages"/>
        <Stack.Screen name="index"/> 
      </Stack>
    </GestureHandlerRootView>
  )
}

export default index