/**
 * styleCard.jsx - Style search result card with expandable post section
 * 
 * This component displays a style as a card with follow/unfollow functionality.
 * It includes an expandable section showing posts related to the style.
 * Features include:
 * - Follow/unfollow action with loading state
 * - Expandable/collapsible post section
 * - Style post count display
 * - Animated expansion indicators
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { icons } from '../../constants/icons';
import ExpandableStylePosts from '../../components/searchComponents/expandableStylePosts';

const StyleCard = ({ 
  styleInfo, 
  index, 
  expandedStyleInfo, 
  toggleStyleExpansion,
  isFollowing,
  isProcessingFollow,
  onFollowAction
}) => {
  // Check if this style is currently expanded
  const isExpanded = expandedStyleInfo && expandedStyleInfo.style === styleInfo.style;
  
  // Get number of posts with this style (only public posts)
  const postsCount = styleInfo.publicPostCount || styleInfo.posts.length;
  
  // Main component render
  return (
    <View className="mb-4">
      {/* Style Card */}
      <TouchableOpacity
        className="rounded-xl overflow-hidden bg-[#F3E3D3]"
        activeOpacity={0.7}
        onPress={() => toggleStyleExpansion(isExpanded ? null : styleInfo)}
      >
        <View className="p-4 flex-row items-center">
          {/* Hashtag Icon */}
          <View className="mr-3">
            <Image
              source={icons.hashtag}
              className="w-8 h-8"
              resizeMode="contain"
              tintColor="#000000"
            />
          </View>
          
          {/* Style Information */}
          <View className="flex-1">
            {/* Style Name */}
            <Text className="font-bregular text-xl text-black">{styleInfo.style}</Text>
            
            {/* Post Count - Updated to show only public posts */}
            <Text className="font-montSemiBold text-sm text-black/80">
              {postsCount} {postsCount === 1 ? 'post' : 'posts'}
            </Text>
          </View>
          
          {/* Follow/Unfollow Button */}
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation(); // Prevent triggering the card's onPress
              onFollowAction();
            }}
            disabled={isProcessingFollow}
            className={`py-2 px-4 rounded-full ${
              isFollowing 
                ? 'bg-primary border-black border' 
                : 'bg-black'
            }`}
          >
            {isProcessingFollow ? (
              <ActivityIndicator size="small" color={isFollowing ? "#000000" : "#F3E3D3"} />
            ) : (
              <Text className={`font-montMedium text-sm ${
                isFollowing ? 'text-black' : 'text-primary'
              }`}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            )}
          </TouchableOpacity>
          
          {/* Expand/Collapse Icon */}
          <View>
            <Image
              source={isExpanded ? icons.chevronUp : icons.chevronDown}
              className="w-6 h-6"
              resizeMode="contain"
              tintColor="#000000"
            />
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Expandable Posts Section */}
      <ExpandableStylePosts
        styleInfo={styleInfo}
        isExpanded={isExpanded}
        onClose={() => toggleStyleExpansion(null)}
      />
    </View>
  );
};

export default StyleCard;