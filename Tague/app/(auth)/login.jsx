/**
 * Authentication Login Screen
 * 
 * This component handles user login functionality with Firebase authentication.
 * It provides a form for email and password entry with haptic feedback,
 * and greeting based on time of day.
 * 
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Image, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  Animated, 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../backend/firebaseConfig";

import { images } from '../../constants/images';
import { icons } from '../../constants/icons';

const Login = () => {
  /* State variables for form inputs, UI controls and animations */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  /* Animation reference for button press effect */
  const scaleAnim = useRef(new Animated.Value(1)).current;

  /* Set greeting message based on time of day */
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning, trendsetter!');
    else if (hour < 18) setGreeting('Good afternoon, fashionista!');
    else setGreeting('Good evening, style icon!');
  }, []);

  /* Handle user login with Firebase authentication */
  const handleLogin = async () => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("User Logged In:", userCredential.user);
      setMessage("Successfully logged in!");
      router.replace('/home'); 
    } catch (error) {
      console.log("Error Logging In:", error.message);
      alert("Error Logging In");
    } finally {
      setLoading(false);
    }
  };

  /* Handle button press-in animation (scale down) */
  const handlePressIn = () => {
    Animated.spring(scaleAnim, { 
      toValue: 0.95, 
      useNativeDriver: true 
    }).start();
  };

  /* Handle button press-out animation (scale back to normal) */
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { 
      toValue: 1, 
      useNativeDriver: true 
    }).start();
  };

  /* Main UI render */
  return (
    <SafeAreaView className="bg-primary h-full">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {/* Back Button */}
          <TouchableOpacity 
            onPress={() => router.back()} 
            className="absolute top-2 left-5 rounded-full"
          >
            <Image 
              source={icons.backArrow} 
              className="w-16 h-16" 
              resizeMode="contain" 
            />
          </TouchableOpacity>

          <View className="flex-1 justify-center px-4">
            {/* Animated Logo */}
            <Animated.View
              style={{ transform: [{ scale: scaleAnim }] }}
            >
              <Image
                source={images.logo}
                resizeMode="contain"
                className="w-full h-[60px]"
              />
            </Animated.View>
            
            {/* Dynamic Time-based Greeting */}
            <Text className="text-center text-2xl text-black mt-5 font-montSemiBold">
              {greeting}
            </Text>

            {/* Email Input Field */}
            <View className="mt-7 space-y-2">
              <Text className="ml-2 text-lg font-montMedium">Email</Text>
              <TextInput
                className="border border-gray-400 w-full h-14 px-4 bg-white rounded-xl text-black"
                value={email}
                placeholder="Enter your email"
                placeholderTextColor="#7b7b8b"
                onChangeText={(text) => setEmail(text)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Input Field with Toggle */}
            <View className="mt-7 space-y-2">
              <Text className="ml-2 text-lg font-montMedium">Password</Text>
              <View className="flex-row items-center border border-gray-400 w-full h-14 px-4 bg-white rounded-xl">
                <TextInput
                  className="flex-1 text-black"
                  value={password}
                  placeholder="Enter your password"
                  placeholderTextColor="#7b7b8b"
                  onChangeText={(text) => setPassword(text)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                {/* Password Visibility Toggle */}
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="ml-2"
                >
                  <Image 
                    source={showPassword ? icons.blindEye : icons.openEye} 
                    className="w-6 h-6" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button with Animation */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleLogin();
                }}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                className="mt-10 bg-black py-4 rounded-xl items-center"
                disabled={loading}
              >
                <Text className="text-white text-lg font-montBold">
                  {loading ? "Logging in..." : "Login"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Sign Up Link */}
            <View className="justify-center pt-5 flex-row items-center">
              <Text className="text-lg font-montRegular text-gray-600">
                Don't have an account?
              </Text>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text className="text-lg font-montSemiBold text-black underline ml-1">
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Login;