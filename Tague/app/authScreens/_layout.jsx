/**
 * _layout.jsx - Layout for profile-related components
 * 
 * This component defines the navigation stack.
 * 
 * This component has been implemented to respect the navigation structure
 * of the tabs layout.
 * 
 */

import { Stack } from 'expo-router';

/**
 * AuthScreensLayout - Navigation stack configuration
 * Sets up routes for all auth-related screens with no default headers
 */
export default function AuthScreensLayout() {
  return (
    <Stack 
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Upload Profile Pic screen */}
      <Stack.Screen name="uploadProfilePic" />
    
    </Stack>
  );
}