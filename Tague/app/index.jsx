/**
* Landing Page Component
* 
* This file implements the initial landing page for the Tague app,
* featuring custom-designed tag styled buttons for authentication options.
* 
* Functional Requirements covered: F.1, F.2
*/

import { Image, ScrollView, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Line, Rect, Text as SvgText } from 'react-native-svg';

import { router } from 'expo-router';

import { images } from "../constants/images";
import "../global.css";

/**
* Main app component that renders the landing page
*/
export default function App() {
  return (
    <SafeAreaView className="bg-primary h-full">
      <ScrollView contentContainerStyle={{ height: '100%' }}>
        <View className="w-full justify-center items-center h-full px-4">
        
          {/* Log In Button with shadow styling */}
          <View style={{
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5, // Required for Android
          }}>
            <TouchableOpacity onPress={() => console.log('Log In Pressed') & router.push('/login')}>
              <Svg width="1163" height="104" viewBox="0 0 1150 104" fill="none" transform="translate(450, -30)">
                {/* Direct Connecting Line */}
                <Line x1="260" y1="49.5" x2="1163" y2="49.5" stroke="black" />

                {/* Tag shape */}
                <Path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M263.227 22.0801C264.431 23.3752 265.1 25.0779 265.1 26.8462V70.1718C265.1 71.9401 264.431 73.6428 263.227 74.9379L246.159 93.2974C244.835 94.722 242.978 95.5313 241.032 95.5313L11.0001 95.5313C7.1341 95.5313 4.00009 92.3973 4.00009 88.5313V6.99999C4.00009 3.134 7.13409 -7.62939e-06 11.0001 -7.62939e-06L243.36 -7.62939e-06C243.635 -7.62939e-06 243.778 0.327697 243.591 0.529044V0.529044C243.478 0.649845 243.478 0.83685 243.591 0.957651L263.227 22.0801ZM249.59 40.1231C245.307 40.1231 241.835 43.5448 241.835 47.7656C241.835 51.9865 245.307 55.4081 249.59 55.4081C253.873 55.4081 257.345 51.9865 257.345 47.7656C257.345 43.5448 253.873 40.1231 249.59 40.1231Z"
                  fill="black"
                />

                {/* Rectangle inside tag */}
                <Rect x="216" y="85" width="197" height="75" rx="5" transform="rotate(180 216 85)" fill="#F3E3D3" />

                {/* Authentication Type Text */}
                <SvgText x="10%" y="53%" textAnchor="middle" fontFamily="BebasNeue" fontSize="26" fill="black">
                  Log In
                </SvgText>
              </Svg>
            </TouchableOpacity>
        </View>

        {/* App logo */}
        <Image
          source={images.logo}
          className="w-[200px] h-[84px]"
          resizeMode="contain"
        />
         
        {/* Sign Up Button with shadow styling */}
        <View style={{
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5, // Required for Android
        }}>

        <TouchableOpacity onPress={() => console.log('Sign Up Pressed') & router.push('/signup')}>
          <Svg width="1163" height="104" viewBox="0 0 325 104" fill="none" transform="translate(-35  , 30)">
            {/* Direct Connecting Line */}
            <Line x1="53.9956" y1="46.0313" x2="-1163" y2="46.0313" stroke="black" />
                {/* Tag shape */}
                <Path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M50.8732 73.4512C49.6692 72.1561 49 70.4534 49 68.6851V25.3595C49 23.5912 49.6692 21.8885 50.8732 20.5934L67.9409 2.23391C69.2652 0.809317 71.1226 0 73.0677 0L303.1 0C306.966 0 310.1 3.13401 310.1 7V88.5313C310.1 92.3973 306.966 95.5313 303.1 95.5313H70.7399C70.465 95.5313 70.3222 95.2036 70.5094 95.0022V95.0022C70.6217 94.8814 70.6217 94.6944 70.5094 94.5736L50.8732 73.4512ZM64.5103 55.4082C68.7934 55.4082 72.2656 51.9865 72.2656 47.7657C72.2656 43.5448 68.7934 40.1232 64.5103 40.1232C60.2272 40.1232 56.7551 43.5448 56.7551 47.7657C56.7551 51.9865 60.2272 55.4082 64.5103 55.4082Z"
                  fill="black"
                />
                {/* Rectangle inside tag */}
                <Rect x="98" y="10" width="197" height="76" rx="5" fill="#F3E3D3" />
                {/* Authentication Type Text */}
                <SvgText x="17%" y="53%" textAnchor="middle" fontFamily="BebasNeue" fontSize="26" fill="black">
                  Sign Up
                </SvgText>
              </Svg>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
 );
}