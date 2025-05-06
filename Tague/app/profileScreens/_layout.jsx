/**
 * _layout.jsx - Layout for profile-related components
 * 
 * This component defines the navigation stack for all profile-related screens
 * such as profile editing, finding friends, following/followers lists, and post details.
 * 
 * This component has been implemented to respect the navigation structure
 * of the tabs layout.
 * 
 */

import { Stack } from 'expo-router';

/**
 * ProfileScreensLayout - Navigation stack configuration
 * Sets up routes for all profile-related screens with no default headers
 */
export default function ProfileScreensLayout() {
  return (
    <Stack 
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Profile editing screen */}
      <Stack.Screen name="editProfile" />
      
      {/* User discovery screen */}
      <Stack.Screen name="findFriends" />
      
      {/* Current users Following list modal */}
      <Stack.Screen name="followingModal" />
      
      {/* Current users Followers list modal */}
      <Stack.Screen name="followersModal" />
      
      {/* Notifications screen */}
      <Stack.Screen name="notifications" />
      
      {/* Individual post details modal */}
      <Stack.Screen name="postModal" />

      {/* Create Modal screen */}
      <Stack.Screen name="userProfile" />

      {/* View User Post screen */}
      <Stack.Screen name="viewUserPost" />

      {/* View User Post screen */}
      <Stack.Screen name="commentModal" />

      {/* View User Post screen */}
      <Stack.Screen name="boardSelectionModal" />

    </Stack>
  );
}