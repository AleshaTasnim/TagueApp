/**
 * _layout.jsx - Layout for wardrobe-related components
 * 
 * This component defines the navigation stack.
 * 
 * This component has been implemented to respect the navigation structure
 * of the tabs layout.
 * 
 */

import { Stack } from 'expo-router';

/**
 * WardrobeScreensLayout - Navigation stack configuration
 * Sets up routes for all wardrobe-related screens with no default headers
 */
export default function WardrobeScreensLayout() {
  return (
    <Stack 
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Bookmarked Posts Modal screen */}
      <Stack.Screen name="bookmarkedPostsModal"  />

      {/* Inspo Board Collection screen */}
      <Stack.Screen name="inspoBoardCollection"  />

      {/* Inspo Board Modal screen */}
      <Stack.Screen name="inspoBoardModal"  />
    
    </Stack>
  );
}