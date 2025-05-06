/**
 * Authentication Layout Component
 * 
 * This component serves as the layout wrapper for the authentication screens.
 * It configures the navigation stack for login and signup screens,
 * hiding the default headers to allow for custom styling.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const AuthLayout = () => {
  return (
    <>
      {/* Authentication Navigation Stack */}
      <Stack>
        {/* Login Screen */}
        <Stack.Screen
          name='login'
          options={{
            headerShown: false
          }}
        />
        
        {/* Signup Screen */}
        <Stack.Screen
          name='signup'
          options={{
            headerShown: false
          }}
        />
      </Stack>

      {/* StatusBar Configuration */}
      <StatusBar 
        backgroundColor="#F3E3D3"
        style="light"
      />
    </>
  );
};

export default AuthLayout;