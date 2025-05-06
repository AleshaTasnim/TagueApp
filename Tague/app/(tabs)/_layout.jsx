/**
 * Main tab navigation layout for a fashion app
 * 
 * This file defines the bottom navigation bar with five main tabs:
 * Home, Search, Create, Wardrobe, and Profile.
 * The navigation uses icon-only tabs with active/inactive states
 * and special handling for the Create tab to open a modal.
 */

import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Tabs, router } from 'expo-router';
import React from 'react';
import { icons } from "../../constants/icons";

/**
 * Renders individual tab icons with appropriate styling
 */
const TabIcon = ({ icon, color, name, focused }) => {
  return (
    <View className="items-center justify-center gap-2">
      <Image 
        source={icon}
        resizeMode="contain"
        tintColor={color}
        className="w-8 h-8 mt-3"
      />
    </View>
  );
};

/**
 * Main tab navigation configuration with five tabs
 */
const TabsLayout = () => {
  return (
    <>
      <Tabs
        screenOptions={{
          // Hide tab labels, using icon-only navigation
          tabBarShowLabel: false,
          
          // Define tab bar colors
          tabBarInactiveTintColor: '#F3E3D3',  // Light cream for inactive tabs
          tabBarActiveTintColor: '#433E3E',    // Dark gray for active tabs
          
          // Black background for tab bar
          tabBarStyle: {
            backgroundColor: '#000000',
            borderBlockColor: '#000000'
          }
        }}
      >
        {/* Home Tab */}
        <Tabs.Screen 
          name="home"
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon 
                icon={icons.home}
                color={color}
                name="Home"
                focused={focused}
              />
            )
          }}
        />
        
        {/* Search Tab */}
        <Tabs.Screen 
          name="search"
          options={{
            title: 'Search',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon 
                icon={icons.search}
                color={color}
                name="Search"
                focused={focused}
              />
            )
          }}
        />
        
        {/* Create Tab - Opens Modal Instead of Tab Screen */}
        <Tabs.Screen
          name="create"
          options={{
            tabBarButton: (props) => {
              const focused = props.accessibilityState.selected;
              const iconColor = focused ? '#433E3E' : '#F3E3D3';

              return (
                <TouchableOpacity
                  {...props}
                  onPress={() => router.push('../createScreens/createModal')}
                  className="items-center justify-center"
                >
                  <Image
                    source={icons.create}
                    resizeMode="contain"
                    tintColor={iconColor}
                    className="w-8 h-8 mt-2"
                  />
                </TouchableOpacity>
              );
            },
          }}
        />
        
        {/* Wardrobe Tab */}
        <Tabs.Screen 
          name="wardrobe"
          options={{
            title: 'Wardrobe',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon 
                icon={icons.wardrobe}
                color={color}
                name="Wardrobe"
                focused={focused}
              />
            )
          }}
        />
        
        {/* Profile Tab */}
        <Tabs.Screen 
          name="profile"
          options={{
            title: 'Profile',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon 
                icon={icons.profile}
                color={color}
                name="Profile"
                focused={focused}
              />
            )
          }}
        />
      </Tabs>
    </>
  );
};

export default TabsLayout;