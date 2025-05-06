/**
 * TagCard.jsx - Tag display component
 * 
 * This component displays product tags in a visually appealing tag format.
 * It handles filtering posts from public accounts, displaying expandable post lists,
 * and provides a consistent interface for browsing tagged products. The component
 * dynamically creates SVG representations of tags with appropriate styling.
 * 
 * Features:
 * - Visual tag representation with SVG graphics
 * - Filtering of posts to only show those from public accounts
 * - Expandable post lists for detailed viewing
 * - Post count display with loading state
 * - Optimised rendering with React.memo
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SvgXml } from 'react-native-svg';
import { OptimisedImage } from '../../components/optimisedImage';
import ExpandableTagPosts from '../../components/searchComponents/expandableTagPosts';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../backend/firebaseConfig';

const TagCard = ({ tagInfo, index, expandedTagInfo, toggleTagExpansion }) => {
  const { tag, posts } = tagInfo;
  const [publicPostsCount, setPublicPostsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Check if this tag is currently expanded
  const isExpanded = expandedTagInfo && 
                    expandedTagInfo.tag.brand === tag.brand && 
                    expandedTagInfo.tag.productName === tag.productName;
  
  // Filter posts to only show those from public accounts
  useEffect(() => {
    const countPublicPosts = async () => {
      setIsLoading(true);
      try {
        // Cache user privacy status to avoid duplicate queries
        const privacyCache = new Map();
        let publicCount = 0;
        
        for (const post of posts) {
          const userId = post.userId;
          
          // Check cache first
          if (privacyCache.has(userId)) {
            if (!privacyCache.get(userId)) {
              // User is not private, count this post
              publicCount++;
            }
            continue;
          }
          
          // Need to check user privacy status
          const userDoc = await getDoc(doc(db, "users", userId));
          if (userDoc.exists()) {
            const isUserPrivate = userDoc.data().isPrivate || false;
            privacyCache.set(userId, isUserPrivate);
            
            if (!isUserPrivate) {
              publicCount++;
            }
          }
        }
        
        setPublicPostsCount(publicCount);
      } catch (error) {
        console.error("Error counting public posts:", error);
        // Fallback to showing all posts count if there's an error
        setPublicPostsCount(posts.length);
      } finally {
        setIsLoading(false);
      }
    };
    
    countPublicPosts();
  }, [posts]);
  
  // Function to truncate text that's too long
  const truncateText = (text, maxLength) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
  };
  
  // Creates an SVG for a tag (left side style)
  const createTagSvg = (tag) => {
    // Truncate brand and product names
    const truncatedBrand = truncateText(tag.brand, 15);
    const truncatedProduct = truncateText(tag.productName, 18);
    
    // SVG for left tag (image on right)
    return `
    <svg width="304" height="97" viewBox="0 0 304 97" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Direct connecting line -->
      <line x1="275" y1="44.5" x2="440" y2="44.5" stroke="black" stroke-width="2"/>
      
      <!-- Tag shape -->
      <path fill-rule="evenodd" clip-rule="evenodd" d="M273.137 21.6013C274.54 22.924 275.336 24.7672 275.336 26.6958L275.336 65.1027C275.336 67.0313 274.54 68.8745 273.137 70.1972L255.517 86.8003C254.218 88.0242 252.501 88.7058 250.716 88.7058L11.0003 88.7058C7.13431 88.7058 4.00031 85.5718 4.00031 81.7058L4.00031 8.73923C4.00031 4.87324 7.13432 1.73923 11.0003 1.73923L252.8 1.73926C253.05 1.73926 253.171 2.04431 252.989 2.21541C252.874 2.3242 252.874 2.50775 252.989 2.61654L273.137 21.6013ZM260.569 38.2652C256.492 38.2652 253.186 41.3801 253.186 45.2225C253.186 49.065 256.492 52.1799 260.569 52.1799C264.647 52.1799 267.953 49.065 267.953 45.2225C267.953 41.3801 264.647 38.2652 260.569 38.2652Z" fill="black"/>
      
      <!-- Rectangle inside tag -->
      <rect x="233.592" y="80.009" width="189.587" height="69.5732" rx="5" transform="rotate(-180 233.592 80.009)" fill="#F3E3D3"/>
      
      <!-- Barcode elements -->
      <path d="M53.6377 68.8608L53.6377 66.5417L72.1906 66.5417L72.1906 68.8608L53.6377 68.8608ZM53.6377 64.2226L53.6377 61.9035L72.1906 61.9035L72.1906 64.2226L53.6377 64.2226ZM53.6377 60.744L53.6377 57.2653L72.1906 57.2653L72.1906 60.744L53.6377 60.744ZM53.6377 56.1057L53.6377 53.7866L72.1906 53.7866L72.1906 56.1057L53.6377 56.1057ZM53.6377 52.6271L53.6377 50.308L72.1906 50.308L72.1906 52.6271L53.6377 52.6271ZM53.6377 49.1484L53.6377 45.6698L72.1906 45.6698L72.1906 49.1484L53.6377 49.1484Z" fill="black"/>
      <path d="M53.6377 44.5103L53.6377 42.1911L72.1906 42.1911L72.1906 44.5103L53.6377 44.5103ZM53.6377 39.872L53.6377 37.5529L72.1906 37.5529L72.1906 39.872L53.6377 39.872ZM53.6377 36.3934L53.6377 32.9147L72.1906 32.9147L72.1906 36.3934L53.6377 36.3934ZM53.6377 31.7552L53.6377 29.4361L72.1906 29.4361L72.1906 31.7552L53.6377 31.7552ZM53.6377 28.2765L53.6377 25.9574L72.1906 25.9574L72.1906 28.2765L53.6377 28.2765ZM53.6377 24.7978L53.6377 21.3192L72.1906 21.3192L72.1906 24.7978L53.6377 24.7978Z" fill="black"/>
      
      <!-- Vertical divider line -->
      <line x1="35.0581" y1="86.9666" x2="35.0581" y2="-2.18557e-08" stroke="#F3E3D3" stroke-width="2" stroke-dasharray="3 3"/>
      
      <!-- Brand text -->
      <text x="145" y="40" font-family="BebasNeue" font-size="30" text-anchor="middle" fill="black">${truncatedBrand}</text>
      
      <!-- Product name text -->
      <text x="145" y="70" font-family="BebasNeue" font-size="22" text-anchor="middle" fill="black">${truncatedProduct}</text>
    </svg>
    `;
  };
  
  // Render the tag card component
  return (
    <TouchableOpacity 
      className="mb-6"
      onPress={() => toggleTagExpansion(tagInfo)}
    >
      {/* Tag SVG - Using fixed height to prevent stretching */}
      <View className="h-[100px] w-full mb-2">
        <SvgXml 
          xml={createTagSvg(tag)} 
          width="100%" 
          height="100%" 
        />
      </View>
      
      {/* Post count below tag */}
      <View className="bg-black/5 p-3 rounded-lg mx-4">
        {isLoading ? (
          <Text className="font-montMedium text-black mb-1">
            Loading posts...
          </Text>
        ) : (
          <Text className="font-montMedium text-black mb-1">
            {publicPostsCount} {publicPostsCount === 1 ? 'post' : 'posts'} found with this tag
          </Text>
        )}
        
        <TouchableOpacity 
          className="bg-black py-1 px-3 rounded-full self-start mt-2"
          onPress={() => toggleTagExpansion(tagInfo)}
        >
          <Text className="font-montMedium text-xs text-primary">
            {isExpanded ? 'Hide Posts' : 'View Posts'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Expandable posts section */}
      {isExpanded && (
        <ExpandableTagPosts 
          tagInfo={tagInfo}
          isExpanded={true}
          onClose={() => toggleTagExpansion(tagInfo)}
        />
      )}
    </TouchableOpacity>
  );
};

export default React.memo(TagCard);