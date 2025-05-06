/**
 * optimisedImage.js - Optimised image loading component for React Native
 * 
 * This component provides advanced image loading optimisations for React Native applications.
 * It implements progressive loading, caching, and performance enhancements to improve
 * the user experience when displaying images, particularly in lists and grids.
 * 
 * Features:
 * - Persistent image cache across app sessions
 * - Progressive loading with low-quality placeholders
 * - Platform-specific optimisations for Android and iOS
 * - Loading indicators with customisable appearance
 * - Prioritisation system for image loading
 * - Global image state tracking to prevent redundant loads
 * - Animated fade-in transitions for smooth visual experience
 */

import { 
  Image, 
  View, 
  ActivityIndicator,
  Platform,
  Animated
} from 'react-native';
import React, { useState, useEffect, useRef, memo } from 'react';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// Global image loading state tracker to maintain state across remounts
const IMAGE_LOAD_STATES = {};

// Main component for optimised image loading with persistent states
const OptimisedImage = memo(({ 
  source, 
  style, 
  className = "", 
  resizeMode = 'cover',
  placeholderColor = '#E0C9B2',
  loadingIndicatorColor = '#000',
  lowQualityFirst = true,
  cacheImages = true,
  priority = 'normal', // 'high', 'normal', 'low'
  placeholderComponent = null,
  showLoadingIndicator = true
}) => {
  // Generate a unique ID for this image source
  const imageId = useRef(
    source && source.uri 
      ? source.uri.split('?')[0] // Remove query params to maintain consistent ID
      : `local_${Math.random()}`
  ).current;
  
  // Initialise or retrieve this image's loading state from global tracker
  if (!IMAGE_LOAD_STATES[imageId]) {
    IMAGE_LOAD_STATES[imageId] = {
      loaded: false,
      cachedUri: null,
      error: false,
      lowQualityLoaded: false
    };
  }
  
  // Local state that reflects the global state
  const [loading, setLoading] = useState(!IMAGE_LOAD_STATES[imageId].loaded);
  const [imageSource, setImageSource] = useState(
    IMAGE_LOAD_STATES[imageId].cachedUri 
      ? { uri: IMAGE_LOAD_STATES[imageId].cachedUri } 
      : source
  );
  const [error, setError] = useState(IMAGE_LOAD_STATES[imageId].error);
  const mountedRef = useRef(true);
  const isAndroid = Platform.OS === 'android';
  const opacity = useRef(
    new Animated.Value(IMAGE_LOAD_STATES[imageId].loaded ? 1 : 0)
  ).current;
  
  // Function to generate a cache key from a URL
  const generateCacheKey = (url) => {
    if (!url) return null;
    // Create a simple hash from the URL (excluding query params)
    const baseUrl = url.split('?')[0];
    const hash = baseUrl.split('').reduce((prevHash, currVal) => 
      (((prevHash << 5) - prevHash) + currVal.charCodeAt(0)) | 0, 0
    );
    return `img_${Math.abs(hash)}.jpg`;
  };

  // Function to check and use cached image with improved cache retrieval
  const getImageFromCache = async (url) => {
    if (!url || !cacheImages) return null;
    
    try {
      const cacheKey = generateCacheKey(url);
      if (!cacheKey) return null;
      
      // For Android, use a persistent directory
      const cacheDir = isAndroid 
        ? `${FileSystem.documentDirectory}image_cache/` 
        : `${FileSystem.cacheDirectory}image_cache/`;
        
      const cachedImagePath = `${cacheDir}${cacheKey}`;
      
      // Check if directory exists
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }
      
      // Check if image is cached
      const imageInfo = await FileSystem.getInfoAsync(cachedImagePath);
      
      if (imageInfo.exists) {
        // Track this cached URI in the global state
        const cacheUri = isAndroid ? `file://${cachedImagePath}` : cachedImagePath;
        IMAGE_LOAD_STATES[imageId].cachedUri = cacheUri;
        return { uri: cacheUri };
      }
      return null;
    } catch (error) {
      console.log('Error checking cache:', error);
      return null;
    }
  };

  // Function to cache image with improved reliability
  const cacheImage = async (url) => {
    if (!url || !cacheImages) return url;
    
    try {
      const cacheKey = generateCacheKey(url);
      if (!cacheKey) return url;
      
      // For Android, use a more persistent storage
      const cacheDir = isAndroid 
        ? `${FileSystem.documentDirectory}image_cache/` 
        : `${FileSystem.cacheDirectory}image_cache/`;
        
      const cachedImagePath = `${cacheDir}${cacheKey}`;
      
      // Create directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(cacheDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      }
      
      // Check if already cached
      const imageInfo = await FileSystem.getInfoAsync(cachedImagePath);
      if (imageInfo.exists) {
        const cacheUri = isAndroid ? `file://${cachedImagePath}` : cachedImagePath;
        IMAGE_LOAD_STATES[imageId].cachedUri = cacheUri;
        return cacheUri;
      }
      
      // Download and cache with proper timeout
      const downloadOptions = isAndroid 
        ? { 
            timeoutInterval: 30000,
            cache: true 
          } 
        : undefined;
        
      const downloadResult = await FileSystem.downloadAsync(url, cachedImagePath, downloadOptions);
      
      if (downloadResult.status === 200) {
        const cacheUri = isAndroid ? `file://${cachedImagePath}` : cachedImagePath;
        IMAGE_LOAD_STATES[imageId].cachedUri = cacheUri;
        return cacheUri;
      } else {
        return url;
      }
    } catch (error) {
      console.log('Error caching image:', error);
      return url;
    }
  };

  // Handle successful image load
  const handleImageLoad = () => {
    if (mountedRef.current) {
      // Update both local and global state
      IMAGE_LOAD_STATES[imageId].loaded = true;
      
      // Fade in the image if not already fully opaque
      if (opacity._value !== 1) {
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }).start();
      }
      
      setLoading(false);
    }
  };

  // Load the image with optimisation - with improved state tracking
  useEffect(() => {
    // If this image is already fully loaded in our global state, just update local state
    if (IMAGE_LOAD_STATES[imageId].loaded && IMAGE_LOAD_STATES[imageId].cachedUri) {
      setImageSource({ uri: IMAGE_LOAD_STATES[imageId].cachedUri });
      setLoading(false);
      opacity.setValue(1);
      return;
    }
    
    // Reset opacity if not already loaded
    if (!IMAGE_LOAD_STATES[imageId].loaded) {
      opacity.setValue(0);
    }
    
    // For local images, load directly
    if (!source || !source.uri || (source.uri && !source.uri.startsWith('http'))) {
      setImageSource(source);
      
      // Still track in global state
      IMAGE_LOAD_STATES[imageId].loaded = true;
      
      // Fade in
      setTimeout(() => {
        if (mountedRef.current) {
          handleImageLoad();
        }
      }, 50);
      return;
    }
    
    const uri = source.uri;
    let isCancelled = false;
    
    // Only load if the image isn't already loading/loaded
    const loadImageWithOptimization = async () => {
      try {
        // Check cache first - use our global cache state if available
        if (IMAGE_LOAD_STATES[imageId].cachedUri) {
          setImageSource({ uri: IMAGE_LOAD_STATES[imageId].cachedUri });
          handleImageLoad();
          return;
        }
        
        const cachedImage = await getImageFromCache(uri);
        if (cachedImage && !isCancelled) {
          if (mountedRef.current) {
            setImageSource(cachedImage);
            handleImageLoad();
          }
          return;
        }
        
        // Progressive loading with low quality first
        if (lowQualityFirst && !isCancelled && !IMAGE_LOAD_STATES[imageId].lowQualityLoaded) {
          const lowQualitySource = isAndroid 
            ? source 
            : { uri: `${uri}?quality=10&width=50` };
            
          if (mountedRef.current) {
            setImageSource(lowQualitySource);
            IMAGE_LOAD_STATES[imageId].lowQualityLoaded = true;
            
            // Partial fade in for low quality
            Animated.timing(opacity, {
              toValue: 0.7,
              duration: 200,
              useNativeDriver: true
            }).start();
          }
        }
        
        // Cache high quality in background
        if (!isCancelled) {
          const cachedPath = await cacheImage(uri);
          
          if (mountedRef.current && !isCancelled) {
            setImageSource({ uri: cachedPath });
            handleImageLoad();
          }
        }
      } catch (error) {
        console.log('Image loading error:', error);
        if (mountedRef.current && !isCancelled) {
          IMAGE_LOAD_STATES[imageId].error = true;
          setImageSource(source);
          setError(true);
          handleImageLoad();
        }
      }
    };
    
    // Set appropriate loading delay based on priority
    let timeout = 0;
    if (priority === 'low') timeout = isAndroid ? 300 : 500;
    if (priority === 'normal') timeout = isAndroid ? 100 : 200;
    if (priority === 'high') timeout = 0;
    
    const timer = setTimeout(() => {
      if (!isCancelled) {
        loadImageWithOptimization();
      }
    }, timeout);
    
    return () => {
      isCancelled = true;
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, [imageId]);

  // Render the placeholder with loading indicator
  const renderPlaceholder = () => {
    if (placeholderComponent) {
      return placeholderComponent;
    }
    
    return (
      <View 
        className="absolute inset-0 justify-center items-center"
        style={{ backgroundColor: placeholderColor }}
      >
        {showLoadingIndicator && <ActivityIndicator size="small" color={loadingIndicatorColor} />}
      </View>
    );
  };

  // Platform-specific props with better performance options
  const platformProps = isAndroid ? {
    progressiveRenderingEnabled: true,  // Use true for Android for better performance
    fadeDuration: 0,                   // Handle fading manually
    fastImage: true
  } : {
    progressiveRenderingEnabled: false,
    fadeDuration: 0                    // Handle fading manually
  };

  // Main render with proper loading states
  return (
    <View 
      className={`relative overflow-hidden ${className}`}
      style={style}
    >
      {/* Only show placeholder if really loading */}
      {(loading || opacity._value < 1) && renderPlaceholder()}
      
      {/* Show image with fade-in animation */}
      {imageSource && (
        <Animated.Image 
          source={imageSource}
          className="w-full h-full bg-transparent"
          style={{ opacity: error ? 0.9 : opacity }}
          resizeMode={resizeMode}
          onLoad={handleImageLoad}
          {...platformProps}
        />
      )}
    </View>
  );
});

// Utility function to preload and cache common images at app start
const preloadCommonImages = async (urls) => {
  if (!urls || !Array.isArray(urls) || urls.length === 0) return;
  
  // Filter out non-string or empty URLs
  const validUrls = urls.filter(url => typeof url === 'string' && url.trim() !== '');
  
  // Preload in batches with higher concurrency at app start
  const batchSize = Platform.OS === 'android' ? 4 : 10;
  
  console.log(`Preloading ${validUrls.length} common images...`);
  
  for (let i = 0; i < validUrls.length; i += batchSize) {
    const batch = validUrls.slice(i, i + batchSize);
    await Promise.all(batch.map(url => {
      // Create an instance of OptimisedImage internally
      const imageId = url.split('?')[0]; 
      
      return cacheImage(url, imageId).catch(err => {
        console.log(`Failed to preload: ${url}`, err);
        return false;
      });
    }));
    
    // Add a small delay between batches
    if (i + batchSize < validUrls.length) {
      await new Promise(resolve => setTimeout(resolve, Platform.OS === 'android' ? 100 : 50));
    }
  }
  
  console.log('Preloading complete');
};

// Standalone cache function that can be used outside of the component
const cacheImage = async (url, imageId = null) => {
  if (!url) return url;
  
  try {
    const isAndroid = Platform.OS === 'android';
    const id = imageId || url.split('?')[0];
    
    // Create a hash for cache key
    const hash = id.split('').reduce((prevHash, currVal) => 
      (((prevHash << 5) - prevHash) + currVal.charCodeAt(0)) | 0, 0
    );
    const cacheKey = `img_${Math.abs(hash)}.jpg`;
    
    // Cache directory
    const cacheDir = isAndroid 
      ? `${FileSystem.documentDirectory}image_cache/` 
      : `${FileSystem.cacheDirectory}image_cache/`;
      
    const cachedImagePath = `${cacheDir}${cacheKey}`;
    
    // Ensure the directory exists
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }
    
    // Check if image is already cached
    const imageInfo = await FileSystem.getInfoAsync(cachedImagePath);
    if (imageInfo.exists) {
      const cacheUri = isAndroid ? `file://${cachedImagePath}` : cachedImagePath;
      
      // Update global state if we have an imageId
      if (imageId && !IMAGE_LOAD_STATES[imageId]) {
        IMAGE_LOAD_STATES[imageId] = {
          loaded: true,
          cachedUri: cacheUri,
          error: false,
          lowQualityLoaded: true
        };
      }
      
      return cacheUri;
    }
    
    // Not cached, download it
    const downloadOptions = isAndroid 
      ? { timeoutInterval: 20000, cache: true } 
      : undefined;
      
    const downloadResult = await FileSystem.downloadAsync(
      url, 
      cachedImagePath,
      downloadOptions
    );
    
    if (downloadResult.status === 200) {
      const cacheUri = isAndroid ? `file://${cachedImagePath}` : cachedImagePath;
      
      // Update global state if we have an imageId
      if (imageId && !IMAGE_LOAD_STATES[imageId]) {
        IMAGE_LOAD_STATES[imageId] = {
          loaded: true,
          cachedUri: cacheUri,
          error: false,
          lowQualityLoaded: true
        };
      }
      
      return cacheUri;
    }
    
    return url;
  } catch (error) {
    console.log('Error in standalone cache:', error);
    return url;
  }
};

// Image cache cleanup utility - call occasionally to prevent unlimited growth
const cleanupImageCache = async (maxAgeMs = 7 * 24 * 60 * 60 * 1000) => { // Default 7 days
  try {
    const isAndroid = Platform.OS === 'android';
    const cacheDir = isAndroid 
      ? `${FileSystem.documentDirectory}image_cache/` 
      : `${FileSystem.cacheDirectory}image_cache/`;
      
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) return;
    
    // List all files in cache directory
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    
    // Get current time for age comparison
    const now = new Date().getTime();
    
    // Check each file and delete old ones
    let deletedCount = 0;
    for (const file of files) {
      try {
        const filePath = `${cacheDir}${file}`;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        // Check if file is old enough to delete
        if (fileInfo.exists && fileInfo.modificationTime) {
          const fileAge = now - fileInfo.modificationTime;
          if (fileAge > maxAgeMs) {
            await FileSystem.deleteAsync(filePath, { idempotent: true });
            deletedCount++;
          }
        }
      } catch (e) {
        // Skip error for this file
      }
    }
    
    console.log(`Cleaned up ${deletedCount} old cached images`);
  } catch (error) {
    console.log('Error cleaning up image cache:', error);
  }
};

export { 
  OptimisedImage, 
  preloadCommonImages, 
  cacheImage, 
  cleanupImageCache 
};