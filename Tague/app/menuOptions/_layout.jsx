/**
 * _layout.jsx - Layout for menu-related components
 * 
 * This component defines the navigation stack.
 * 
 * This component has been implemented to respect the navigation structure
 * of the tabs layout.
 * 
 */

import { Stack } from 'expo-router';

/**
 * menuOptionsLayout - Navigation stack configuration
 * Sets up routes for all menu-related screens with no default headers
 */
export default function menuOptionsLayout() {
  return (
    <Stack 
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* About screen */}
      <Stack.Screen name="about" />

      {/* Help screen */}
      <Stack.Screen name="help" />

      {/* Settings screen */}
      <Stack.Screen name="settings" />
    
    </Stack>
  );
}