/**
 * User Registration Screen
 * 
 * This component handles new user registration with Firebase authentication.
 * It collects username, user's preferred display name, email, and password,
 * creates a Firebase auth account, and stores additional user data in Firestore.
 * 
 * Functional Requirements covered: F1
 */

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
  Modal
} from 'react-native';
import React, { useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { images } from '../../constants/images';
import { icons } from '../../constants/icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { signUpUser } from '../../backend/authService';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../backend/firebaseConfig';

const SignUp = () => {
  /* Form state containing all user registration fields */
  const [form, setForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
  });
  
  /* UI state management */
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  
  /* Animation reference for button press effect */
  const scaleAnim = useRef(new Animated.Value(1)).current;

  /* Handle user registration with Firebase authentication */
  const handleSignUp = async () => {
    // Validate consent is checked
    if (!consentChecked) {
      alert('You must agree to the data collection terms to create an account');
      return;
    }

    setLoading(true);
    try {
      // Create Firebase Auth user
      const user = await signUpUser(form.email, form.password);
      
      // Update user profile with display name
      await updateProfile(user, { displayName: form.displayName });
      
      // Store additional user data in Firestore
      // Start Firestore write but don't await it here for faster UX
      setDoc(doc(db, 'users', user.uid), {
        username: form.username,
        displayName: form.displayName,
        email: form.email,
        createdAt: new Date(),
        consentGiven: true,
        consentDate: new Date(),
        // Default account settings
        isPrivate: false,
        pendingFollowRequests: [],
        followers: [],
        following: [],
        followedStyles: []
      }).then(() => {
        console.log("User data stored in Firestore");
      }).catch((err) => {
        console.error("Error writing user data:", err);
      });
      
      // Navigate to profile picture upload immediately
      // Pass username and displayName as URL parameters
      router.push(`/authScreens/uploadProfilePic?username=${form.username}&displayName=${form.displayName}`);
    } catch (error) {
      alert(error.message);
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

  /* Consent modal component to display data collection terms */
  const ConsentModal = () => {
    return (
      <Modal
        visible={showConsentModal}
        transparent={true}
        animationType="slide"
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-primary p-5 rounded-xl" style={{ maxWidth: '90%', maxHeight: '80%' }}>
            <Text className="text-4xl text-center font-bregular mb-4">Data Collection Consent</Text>
            
            <ScrollView className="mb-4" contentContainerStyle={{ paddingBottom: 10 }}>
              <Text className="text-xl font-montRegular mb-3">
                By using Tague, you agree to our collection and processing of your personal data as outlined below.
              </Text>

              <Text className="text-xl font-montSemiBold mb-3">
                Please note:
              </Text>
              <Text className="text-xl font-montRegular mb-3">
                This app is being developed as part of a university dissertation project and is currently being rolled out to a limited group of participants for research purposes.
              </Text>
              
              <Text className="text-lg font-montSemiBold mb-2">Information We Collect:</Text>
              
              <View className="flex-row mb-2">
                <Text className="text-4xl font-montRegular mr-2">•</Text>
                <Text className="text-xl font-montRegular flex-1">
                  Account Information: We collect information you provide, including your username, display name, and email address.
                </Text>
              </View>
              
              <View className="flex-row mb-2">
                <Text className="text-4xl font-montRegular mr-2">•</Text>
                <Text className="text-xl font-montRegular flex-1">
                  Content You Create: We store the images, messages, and posts that you create, share, or upload to the app.
                </Text>
              </View>
              
              <View className="flex-row mb-2">
                <Text className="text-4xl font-montRegular mr-2">•</Text>
                <Text className="text-xl font-montRegular flex-1">
                  Profile Picture: We collect and store the profile picture you upload.
                </Text>
              </View>
              
              <Text className="text-xl font-montSemiBold mb-2">How We Use Your Information:</Text>
              
              <View className="flex-row mb-2">
                <Text className="text-4xl font-montRegular mr-2">•</Text>
                <Text className="text-xl font-montRegular flex-1">
                  To provide our services and maintain your account
                </Text>
              </View>
              
              <View className="flex-row mb-2">
                <Text className="text-4xl font-montRegular mr-2">•</Text>
                <Text className="text-xl font-montRegular flex-1">
                  To display your content to other users as intended
                </Text>
              </View>
              
              <Text className="text-xl font-montSemiBold mb-2">Data Storage:</Text>
              <Text className="text-xl font-montRegular mb-2">
                We use Firebase to securely store your information. Your content and account details are stored in Firebase, while your account passwords are securely handled by Firebase Authentication and are not accessible to us.
              </Text>
              
              <Text className="text-xl font-montSemiBold mb-2">Your Rights:</Text>
              <Text className="text-xl font-montRegular mb-3">
                You have the right to access, correct, or delete your personal data at any time through your account settings or by contacting us.
              </Text>
              
              <Text className="text-xl font-montRegular mb-4">
                By creating an account, you confirm that you are over 13 years of age and consent to the collection and use of your data as described above.
              </Text>
            </ScrollView>
            
            <TouchableOpacity
              onPress={() => setShowConsentModal(false)}
              className="bg-black py-3 rounded-xl items-center"
            >
              <Text className="text-xl text-white font-montBold">Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
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
            
            {/* Signup Header Text */}
            <Text className="text-center text-2xl text-black mt-5 font-montSemiBold">
              Sign Up to Tague
            </Text>

            {/* Username Input Field */}
            <View className="mt-7 space-y-2">
              <Text className="ml-2 text-lg font-montMedium">Username</Text>
              <TextInput
                className="border border-gray-400 w-full h-14 px-4 bg-white rounded-xl text-black"
                value={form.username}
                placeholder="Enter your username"
                placeholderTextColor="#7b7b8b"
                onChangeText={(text) => setForm({ ...form, username: text })}
                autoCapitalize="none"
              />
            </View>

            {/* Display Name Input Field */}
            <View className="mt-7 space-y-2">
              <Text className="ml-2 text-lg font-montMedium">Display Name</Text>
              <TextInput
                className="border border-gray-400 w-full h-14 px-4 bg-white rounded-xl text-black"
                value={form.displayName}
                placeholder="Enter your display name"
                placeholderTextColor="#7b7b8b"
                onChangeText={(text) => setForm({ ...form, displayName: text })}
              />
            </View>

            {/* Email Input Field */}
            <View className="mt-7 space-y-2">
              <Text className="ml-2 text-lg font-montMedium">Email</Text>
              <TextInput
                className="border border-gray-400 w-full h-14 px-4 bg-white rounded-xl text-black"
                value={form.email}
                placeholder="Enter your email"
                placeholderTextColor="#7b7b8b"
                onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
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
                  value={form.password}
                  placeholder="Enter your password"
                  placeholderTextColor="#7b7b8b"
                  onChangeText={(text) => setForm({ ...form, password: text })}
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

            {/* Consent Checkbox */}
            <View className="flex-row items-center mt-6">
              <TouchableOpacity
                onPress={() => setConsentChecked(!consentChecked)}
                className="mr-3"
              >
                <View className={`w-6 h-6 border-2 rounded ${consentChecked ? 'bg-black border-black' : 'border-gray-500'} justify-center items-center`}>
                  {consentChecked && (
                    <Text className="text-white font-bold">✓</Text>
                  )}
                </View>
              </TouchableOpacity>
              <View className="flex-row flex-wrap">
                <Text className="text-gray-700 font-montRegular">
                  I agree to the 
                </Text>
                <TouchableOpacity onPress={() => setShowConsentModal(true)}>
                  <Text className="text-black underline font-montSemiBold ml-1">
                    data collection and privacy terms
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Create Account Button with Animation */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleSignUp();
                }}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                className={`mt-8 py-4 rounded-xl items-center ${consentChecked ? 'bg-black' : 'bg-gray-400'}`}
                disabled={loading || !consentChecked}
              >
                <Text className="text-white text-lg font-montBold">
                  {loading ? "Signing Up..." : "Create Account"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Login Link */}
            <View className="justify-center pt-5 flex-row items-center">
              <Text className="text-lg font-montRegular text-gray-600">
                Have an account already?
              </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text className="text-lg font-montSemiBold text-black underline ml-1">
                  Login
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Consent Modal */}
      <ConsentModal />
    </SafeAreaView>
  );
};

export default SignUp;