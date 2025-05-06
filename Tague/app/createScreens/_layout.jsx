/**
 * _layout.jsx - Layout for create-related components
 * 
 * This component defines the navigation stack.
 * 
 * This component has been implemented to respect the navigation structure
 * of the tabs layout.
 * 
 */

import { Stack } from 'expo-router';

/**
 * CreateScreensLayout - Navigation stack configuration
 * Sets up routes for all create-related screens with no default headers
 */
export default function CreateScreensLayout() {
  return (
    <Stack 
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Create Modal screen */}
      <Stack.Screen name="createModal" />
    
    </Stack>
  );
}