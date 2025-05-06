/**
 * SideMenu component for app navigation and user actions
 * 
 * Displays user profile information and provides navigation links
 * with slide-in animation and blur background effect
 */

import React, { useRef, useEffect, useState } from 'react';
import { Animated, TouchableOpacity, Text, Dimensions, Pressable, View, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { signOut } from 'firebase/auth';
import { db, auth } from '../../backend/firebaseConfig';
import { getDoc, doc } from 'firebase/firestore';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { icons } from '../../constants/icons';
import { images } from '../../constants/images';

const { width } = Dimensions.get('window');
const AnimatedSafeAreaView = Animated.createAnimatedComponent(SafeAreaView);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// Access the global caches from Home.jsx
// These are the exact same variable names used in Home.jsx
if (typeof global.POSTS_CACHE === 'undefined') {
  global.POSTS_CACHE = {
    following: null,
    friends: null,
    styles: null,
    timestamp: null
  };
}

if (typeof global.IMAGE_CACHE === 'undefined') {
  global.IMAGE_CACHE = new Set();
}

const SideMenu = ({ isVisible, onClose }) => {
  const menuWidth = width * 0.75;
  const slideAnim = useRef(new Animated.Value(menuWidth)).current;
  const blurAnim = useRef(new Animated.Value(0)).current;
  const [showBlur, setShowBlur] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [username, setUsername] = useState([]);
  const isMounted = useRef(true);
  
  const user = auth.currentUser;

  /**
   * Cleanup function for component unmount
   */
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Load user's username from Firestore
   */
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUsername(userData.username || ''); 
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    };
    
    fetchUserData();
  }, [user]);

  /**
   * Handle menu animation based on visibility
   */
  useEffect(() => {
    let slideAnimation;
    let blurAnimation;

    if (isVisible) {
      setShowBlur(true);
      slideAnimation = Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      });
      slideAnimation.start();
      
      blurAnimation = Animated.timing(blurAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: false,
      });
      blurAnimation.start();
    } else {
      slideAnimation = Animated.timing(slideAnim, {
        toValue: menuWidth,
        duration: 250,
        useNativeDriver: true,
      });
      slideAnimation.start();
      
      blurAnimation = Animated.timing(blurAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      });
      blurAnimation.start(() => {
        // Only update state if component is still mounted
        if (isMounted.current) {
          setShowBlur(false);
        }
      });
    }

    // Return cleanup function to stop animations
    return () => {
      if (slideAnimation) slideAnimation.stop();
      if (blurAnimation) blurAnimation.stop();
    };
  }, [isVisible, menuWidth]);

  /**
   * Clear all caches on logout
   */
  const clearAppCaches = () => {
    // Clear the posts cache
    if (global.POSTS_CACHE) {
      global.POSTS_CACHE = {
        following: null,
        friends: null,
        styles: null,
        timestamp: null
      };
    }
    
    // Clear the image cache
    if (global.IMAGE_CACHE) {
      global.IMAGE_CACHE = new Set();
    }
    
    console.log("App caches cleared");
  };

  /**
   * Handle user logout process
   */
  const handleLogout = async () => {
    // Prevent multiple logout attempts
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    
    try {
      // Clear caches BEFORE any animations or state changes
      clearAppCaches();
      
      // Close the menu
      onClose();
      
      // Sign out immediately
      await signOut(auth);
      
      // Wait for animations to complete before navigation
      setTimeout(() => {
        if (isMounted.current) {
          // Force a completely fresh navigation to the login screen
          router.replace({
            pathname: '/login',
            params: { reset: Date.now().toString() }
          });
        }
      }, 350); // Slightly longer than animation duration
      
    } catch (error) {
      console.error('Error during logout:', error);
      if (isMounted.current) {
        setIsLoggingOut(false);
        Alert.alert(
          "Logout Error",
          "There was a problem logging out. Please try again.",
          [{ text: "OK" }]
        );
      }
    }
  };

  /**
   * Render the side menu UI
   */
  return (
    <>
      {/* Blur Background */}
      {showBlur && (
        <Pressable onPress={onClose} className="absolute inset-0 z-40">
          <AnimatedBlurView
            intensity={blurAnim}
            tint="dark"
            className="flex-1"
          />
        </Pressable>
      )}
      
      {/* Animated Menu */}
      <AnimatedSafeAreaView
        edges={['top']}
        className="absolute top-0 bottom-0 right-0 z-50"
        style={{
          width: menuWidth,
          transform: [{ translateX: slideAnim }],
        }}
      >
        {/* Gradient background */}
        <View className="flex-1 overflow-hidden rounded-l-xl">
          <LinearGradient
            colors={['#F3E3D3', '#E0C9B2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          
          {/* Header with close button */}
          <View className="flex-row justify-between items-center px-6 pt-4 pb-6">
            <TouchableOpacity 
              onPress={onClose}
              className="pt-1"
            >
              <Image
                source={icons.cross}
                className="w-6 h-6"
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
          
          {/* User profile section */}
          <View className="px-6 pb-8 mb-4 border-b border-black/10">
            <View className="flex-row items-center">
              <Image
                source={user?.photoURL ? { uri: user.photoURL } : images.profilePic}
                className="w-16 h-16 rounded-full border border-black/20"
                resizeMode="cover"
              />
              <View className="ml-4 flex-1">
                <Text className="text-xl font-montSemiBold text-black">
                  {user?.displayName || 'No Name'}
                </Text>
                <Text className="text-sm font-montRegular text-black/70">
                  @{username}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Menu items */}
          <View className="px-6 flex-1">
            <MenuItem 
              label="Profile" 
              onPress={() => {
                onClose();
                router.push('/profile');
              }}
            />
            
            <MenuItem 
              label="About" 
              onPress={() => {
                onClose();
                router.push('menuOptions/about');
              }}
            />
            
            <MenuItem 
              label="Help" 
              onPress={() => {
                onClose();
                router.push('menuOptions/help');
              }}
            />
            
            <MenuItem 
              label="Settings and privacy" 
              onPress={() => {
                onClose();
                router.push('menuOptions/settings');
              }}
            />
          </View>
          
          {/* Logout button */}
          <View className="px-6 pb-8">
            <TouchableOpacity 
              onPress={handleLogout} 
              className={`bg-black py-3 rounded-xl ${isLoggingOut ? 'opacity-70' : 'opacity-100'}`}
              disabled={isLoggingOut}
            >
              <Text className="text-lg font-montMedium text-primary text-center">
                {isLoggingOut ? 'Logging Out...' : 'Log Out'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedSafeAreaView>
    </>
  );
};

/**
 * Menu item component for consistent styling
 */
const MenuItem = ({ label, onPress }) => {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      className="py-4 border-b border-black/10"
    >
      <Text className="text-lg font-montRegular text-black">
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default SideMenu;