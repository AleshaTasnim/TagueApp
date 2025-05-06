/**
 * TagDetailModal.jsx - Product tag creation and editing component
 * 
 * This component provides a modal interface for creating and managing product tags
 * within the app. It handles all aspects of tag creation, editing, and validation
 * with appropriate form controls and visual feedback. The modal displays a live
 * preview of the tag as users input information.
 * 
 * Features:
 * - Create new product tags or edit existing ones
 * - Live SVG preview of the tag being created/edited
 * - Form validation for required fields
 * - Platform-specific picker interfaces for selecting size, colour, and product type
 * - Support for adding custom colours and product types
 * - Web search integration for finding product information
 * - Clipboard integration for URL pasting
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  Linking,
  Image
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SvgXml } from 'react-native-svg';
import { icons } from '../../constants/icons';
import CrossPlatformPicker from './crossPlatformPicker'

const TagDetailModal = ({
  visible,
  onClose,
  onAdd,
  onDelete,
  currentTag = {},
  editingExistingTag = false,
  defaultTagColour = '#F3E3D3',
}) => {
  // State management for form fields and UI
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [showAllFields, setShowAllFields] = useState(true);
  const [modalHeight, setModalHeight] = useState(500);

  // Price and currency selection state
  const [currency, setCurrency] = useState('£')
  const [currencyOptions] = useState(['£', '$', '€', '¥', '₹', 'A$', 'C$', '₣', '₩', '₽', 'R$', '₺']);

  // Size selection state
  const [sizeCountry, setSizeCountry] = useState('UK');
  const [sizeValue, setSizeValue] = useState('');
  const [countryOptions] = useState(['UK', 'US', 'EU', 'INT']);
  const [sizeOptions] = useState(['3XS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '12.5', '13', '13.5', '14', '50', '52', '54', '56', '58', '60', '62' ]);

  // Picker visibility states
  const [showSizeRegionPicker, setShowSizeRegionPicker] = useState(false);
  const [showSizeValuePicker, setShowSizeValuePicker] = useState(false);
  const [showColourPicker, setShowColourPicker] = useState(false);
  const [showProductTypePicker, setShowProductTypePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // Colour selection state
  const [itemColour, setItemColour] = useState('');
  const [colourOptions, setColourOptions] = useState(['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Brown', 'Grey', 'Pink', 'Purple', 'Orange']);
  const [newColourInput, setNewColourInput] = useState('');
  const [showColourInput, setShowColourInput] = useState(false);

  // Product Type selection state
  const [productType, setProductType] = useState('');
  const [productOptions, setProductOptions] = useState(['Dress', 'Abaya', 'Hijab', 'T-Shirt', 'Shirt', 'Trousers', 'Skirt', 'Shorts', 'Leggings', 'Cardigan', 'Jacket', 'Coat', 'Boots', 'Trainers', 'Heels', 'Sandals', 'Socks', 'Underwear', 'Necklace', 'Ring', 'Bracelet', 'Earring', 'Makeup', 'Bag']);
  const [newProductInput, setNewProductInput] = useState('');
  const [showProductInput, setShowProductInput] = useState(false);

  // Temporary values for pickers (to allow cancellation)
  const [tempSizeCountry, setTempSizeCountry] = useState('UK');
  const [tempSizeValue, setTempSizeValue] = useState('');
  const [tempItemColour, setTempItemColour] = useState('');
  const [tempProductType, setTemptProductType] = useState('');
  const [tempCurrency, setTempCurrency] = useState('£');
   
  // References and dimensions
  const scrollViewRef = useRef(null);
  const { height: screenHeight } = Dimensions.get('window');

  // Reset form when modal is closed or populate with existing tag data
  useEffect(() => {
    if (visible) {
      if (!editingExistingTag) {
        setBrand('');
        setProductName('');
        setPrice('');
        setUrl('');
        setSizeCountry('UK');
        setSizeValue('');
        setItemColour('');
        setProductType('');
        setCurrency('£');
        setShowColourInput(false);
        setShowProductInput(false);
      } else if (currentTag) {
        setBrand(currentTag.brand || '');
        setProductName(currentTag.productName || '');
        
        if (currentTag.price) {
          const numericPrice = currentTag.price.replace(/[^\d.]/g, '');
          const currencyMatch = currentTag.price.match(/^[^\d.]+/);
          
          if (currencyMatch && currencyMatch[0]) {
            setCurrency(currencyMatch[0]);
          }
          
          setPrice(numericPrice);
        } else {
          setPrice('');
        }
        
        setUrl(currentTag.url || '');
        
        if (currentTag.size) {
          const sizeParts = currentTag.size.split(' ');
          if (sizeParts.length >= 2) {
            setSizeCountry(sizeParts[0]);
            setSizeValue(sizeParts.slice(1).join(' '));
          }
        }
        
        setItemColour(currentTag.itemColour || '');
        setProductType(currentTag.productType || '');
        setShowColourInput(false);
        setShowProductInput(false);
      }
      
      setShowAllFields(true);
    }
  }, [visible, currentTag, editingExistingTag]);

  // Calculate appropriate modal height when modal opens
  useEffect(() => {
    if (visible) {
      setModalHeight(Math.min(screenHeight * 0.75, 600));
    }
  }, [visible, screenHeight]);

  // Set form values when editing an existing tag
  useEffect(() => {
    if (editingExistingTag && currentTag) {
      setBrand(currentTag.brand || '');
      setProductName(currentTag.productName || '');
      
      if (currentTag.price) {
        const numericPrice = currentTag.price.replace(/[^\d.]/g, '');
        const currencyMatch = currentTag.price.match(/^[^\d.]+/);
        
        if (currencyMatch && currencyMatch[0]) {
          setCurrency(currencyMatch[0]);
        }
        
        setPrice(numericPrice);
      } else {
        setPrice('');
      }
      
      setUrl(currentTag.url || '');
      
      if (currentTag.size) {
        const sizeParts = currentTag.size.split(' ');
        if (sizeParts.length >= 2) {
          setSizeCountry(sizeParts[0]);
          setSizeValue(sizeParts.slice(1).join(' '));
        }
      }
  
      setItemColour(currentTag.itemColour || '');
      setProductType(currentTag.productType || '');
      
      setShowAllFields(true);
    } else {
      setShowAllFields(true);
    }
  }, [currentTag, editingExistingTag, visible]);

  // Validate price has correct format
  const isValidPrice = (value) => {
    return /^\d+(\.\d{1,2})?$/.test(value);
  };

  // Format price with currency symbol
  const formatPrice = (value) => {
    if (!value) return '';
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';
    
    return currency + numValue.toFixed(2);
  };

  // Validate URL format
  const isValidUrl = (urlString) => {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (e) {
      return false;
    }
  };

  // Handle brand input changes with character limit
  const handleBrandChange = (text) => {
    if (text.length <= 35) {
      setBrand(text);
    }
  };

  // Handle product name input changes with character limit
  const handleProductNameChange = (text) => {
    if (text.length <= 70) {
      setProductName(text);
    }
  };

  // Handle price input with formatting
  const handlePriceChange = (text) => {
    const value = text.replace('£', '');
    
    if (/^(\d+)?(\.\d{0,2})?$/.test(value) || value === '') {
      setPrice(value);
    }
  };

  // Open currency picker with current value
  const openCurrencyPicker = () => {
    setTempCurrency(currency);
    setShowCurrencyPicker(true);
  };

  // Confirm currency selection
  const confirmCurrency = () => {
    setCurrency(tempCurrency);
    setShowCurrencyPicker(false);
  };

  // Cancel currency selection
  const cancelCurrency = () => {
    setShowCurrencyPicker(false);
  };

  // Open size region picker with current value
  const openSizeRegionPicker = () => {
    setTempSizeCountry(sizeCountry);
    setShowSizeRegionPicker(true);
  };

  // Confirm size region selection
  const confirmSizeRegion = () => {
    setSizeCountry(tempSizeCountry);
    setShowSizeRegionPicker(false);
  };

  // Cancel size region selection
  const cancelSizeRegion = () => {
    setShowSizeRegionPicker(false);
  };

  // Open size value picker with current or default value
  const openSizeValuePicker = () => {
    setTempSizeValue(sizeValue || sizeOptions[0]);
    setShowSizeValuePicker(true);
  };

  // Confirm size value selection
  const confirmSizeValue = () => {
    setSizeValue(tempSizeValue);
    setShowSizeValuePicker(false);
  };

  // Cancel size value selection
  const cancelSizeValue = () => {
    setShowSizeValuePicker(false);
  };

  // Open colour picker with current or default value
  const openColourPicker = () => {
    setTempItemColour(itemColour || colourOptions[0]);
    setShowColourPicker(true);
  };

  // Confirm colour selection
  const confirmColour = () => {
    setItemColour(tempItemColour);
    setShowColourPicker(false);
  };

  // Cancel colour selection
  const cancelColour = () => {
    setShowColourPicker(false);
  };
   
  // Open product type picker with current or default value
  const openProductPicker = () => {
    setTemptProductType(productType || productOptions[0]);
    setShowProductTypePicker(true);
  };

  // Confirm product type selection
  const confirmProductType = () => {
    setProductType(tempProductType);
    setShowProductTypePicker(false);
  };

  // Cancel product type selection
  const cancelProductType = () => {
    setShowProductTypePicker(false);
  };

  // Add new custom colour to options
  const handleAddNewColour = () => {
    if (newColourInput.trim() !== '' && !colourOptions.includes(newColourInput.trim())) {
      const newColourOptions = [...colourOptions, newColourInput.trim()];
      setColourOptions(newColourOptions);
      setItemColour(newColourInput.trim());
      setNewColourInput('');
      setShowColourInput(false);
    }
  };

  // Add new custom product type to options
  const handleAddNewProductType = () => {
    if (newProductInput.trim() !== '' && !productOptions.includes(newProductInput.trim())) {
      const newProductOptions = [...productOptions, newProductInput.trim()];
      setProductOptions(newProductOptions);
      setProductType(newProductInput.trim());
      setNewProductInput('');
      setShowProductInput(false);
    }
  };

  // Process form submission and add/update tag
  const handleAddTag = () => {
    if (brand.trim() === '') {
      Alert.alert('Missing Information', 'Please enter a brand name.');
      return;
    }
  
    if (productName.trim() === '') {
      Alert.alert('Missing Information', 'Please enter a product name.');
      return;
    }
  
    if (price.trim() === '') {
      Alert.alert('Missing Information', 'Please enter a price.');
      return;
    }
  
    if (url.trim() !== '' && !isValidUrl(url)) {
      Alert.alert('Invalid URL', 'Please enter a valid URL starting with http:// or https://');
      return;
    }
  
    let formattedPrice = price;
    if (!price.includes('.')) {
      formattedPrice = `${price}.00`;
    } else {
      const parts = price.split('.');
      const decimal = parts[1] || '';
      if (decimal.length === 0) {
        formattedPrice = `${parts[0]}.00`;
      } else if (decimal.length === 1) {
        formattedPrice = `${parts[0]}.${decimal}0`;
      }
    }
    
    const finalPrice = `${currency}${formattedPrice}`;
    const sizeString = sizeValue ? `${sizeCountry} ${sizeValue}` : '';
  
    const tagData = {
      position: currentTag.position,
      brand, 
      productName, 
      price: finalPrice, 
      url,
      colour: currentTag.colour || defaultTagColour,
      size: sizeString,
      itemColour,
      productType
    };
  
    onAdd(tagData, editingExistingTag);
    handleCloseTagModal();
  };

  // Open web browser to search for product
  const handleSearchWeb = async () => {
    try {
      let searchQuery = brand;
      if (productName) {
        searchQuery += ' ' + productName;
      }
      
      await Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`);
    } catch (error) {
      console.error('Error opening browser:', error);
      Alert.alert('Error', 'Could not open browser');
    }
  };

  // Delete the current tag
  const handleDeleteTag = () => {
    onDelete(currentTag);
    handleCloseTagModal();
  };

  // Close modal and reset input states
  const handleCloseTagModal = () => {
    setShowColourInput(false);
    setShowProductInput(false);
    onClose();
  };

  // Render SVG preview of the tag being created/edited
  const renderTagPreview = () => {
    const truncateText = (text, maxLength) => {
      if (!text) return "";
      return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
    };
    
    const truncatedBrand = truncateText(brand, 15);
    const truncatedProduct = truncateText(productName, 18);
    
    let displayPrice = "PRICE";
    
    if (price) {
      let formattedAmount = price;
      
      if (!price.includes('.')) {
        formattedAmount = `${price}.00`;
      } else {
        const parts = price.split('.');
        if (parts.length > 1) {
          const decimals = parts[1];
          if (decimals.length === 0) {
            formattedAmount = `${parts[0]}.00`;
          } else if (decimals.length === 1) {
            formattedAmount = `${parts[0]}.${decimals}0`;
          } else {
            formattedAmount = `${parts[0]}.${decimals.substring(0, 2)}`;
          }
        }
      }
      
      displayPrice = `${currency}${formattedAmount}`;
    }
    
    const truncatedPrice = truncateText(displayPrice, 10);
    const currentColourToUse = currentTag.colour || defaultTagColour;
  
    const tagSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 95" fill="none">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M6.199 67.105C4.796 65.782 4 63.939 4 62.01V23.603C4 21.675 4.796 19.831 6.199 18.509L23.819 1.905C25.118 0.682 26.835 0 28.62 0H268.336C272.202 0 275.336 3.134 275.336 7V79.967C275.336 83.833 272.202 86.967 268.336 86.967H26.536C26.286 86.967 26.165 86.662 26.347 86.49C26.462 86.382 26.462 86.198 26.347 86.089L6.199 67.105ZM18.767 50.441C22.844 50.441 26.15 47.326 26.15 43.483C26.15 39.641 22.844 36.526 18.767 36.526C14.689 36.526 11.383 39.641 11.383 43.483C11.383 47.326 14.689 50.441 18.767 50.441Z" fill="black"/>
        <rect x="45.744" y="8.697" width="189.587" height="69.573" rx="5" fill="${currentColourToUse}"/>
        <path d="M206.922 68.993V66.674H225.475V68.993H206.922ZM206.922 64.355V62.036H225.475V64.355H206.922ZM206.922 60.877V57.398H225.475V60.877H206.922ZM206.922 56.238V53.919H225.475V56.238H206.922ZM206.922 52.76V50.441H225.475V52.76H206.922ZM206.922 49.281V45.802H225.475V49.281H206.922Z" fill="black"/>
        <path d="M206.922 44.643V42.324H225.475V44.643H206.922ZM206.922 40.005V37.686H225.475V40.005H206.922ZM206.922 36.526V33.047H225.475V36.526H206.922ZM206.922 31.888V29.569H225.475V31.888H206.922ZM206.922 28.409V26.09H225.475V28.409H206.922ZM206.922 24.93V21.452H225.475V24.93H206.922Z" fill="black"/>
        <line x1="244.278" y1="1.739" x2="244.278" y2="88.706" stroke="${currentColourToUse}" stroke-width="0.5" stroke-dasharray="3 3"/>
        <text x="135" y="40" font-family="BebasNeue" font-size="20" text-anchor="middle" fill="black">${truncatedBrand || "BRAND"}</text>
        <text x="135" y="60" font-family="BebasNeue" font-size="16" text-anchor="middle" fill="black">${truncatedProduct || "PRODUCT NAME"}</text>
        <text transform="translate(268 45) rotate(-90)" font-family="BebasNeue" font-size="22" text-anchor="middle" fill="#F3E3D3">${truncatedPrice}</text>
      </svg>
    `;
  
    return (
      <View
        style={{
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
          backgroundColor: 'transparent',
          width: '100%',
          height: 150,
        }}
      >
        <SvgXml xml={tagSvg} width="100%" height="100%" />
      </View>
    );
  };

  // Render picker modal using CrossPlatformPicker component
  const renderPickerModal = (
    visible, 
    title, 
    options, 
    selectedValue, 
    onValueChange, 
    onConfirm, 
    onCancel
  ) => {
    return (
      <CrossPlatformPicker
        visible={visible}
        title={title}
        options={options}
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
  };

  // Render the complete modal with all form controls
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCloseTagModal}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="bg-[#E0C9B2] w-[90%] rounded-xl p-6 overflow-hidden"
          style={{
            height: modalHeight,
            maxHeight: screenHeight * 0.85,
          }}
        >
          <View className="absolute top-6 right-6 z-10">
            <TouchableOpacity onPress={handleCloseTagModal}>
              <Image
                source={icons.cross}
                className="w-8 h-8"
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
          
          <View className="mt-12 mb-2">
            {renderTagPreview()}
          </View>

          <ScrollView 
            ref={scrollViewRef}
            showsVerticalScrollIndicator={true}
            className="flex-1"
            contentContainerClassName="pb-48"
            style={{
              maxHeight: modalHeight - 220
            }}
          >
            <Text className="text-xl font-montSemiBold mb-2 text-center">
              Brand <Text className="text-red-600">*</Text>
            </Text>
            <View>
              <TextInput
                className="bg-third font-montRegular p-3 rounded-lg mb-1 border border-black"
                placeholder="Brand name..."
                placeholderTextColor="black"
                value={brand}
                onChangeText={handleBrandChange}
                maxLength={35}
              />
              <Text className="text-xs text-gray-700 text-right mb-3">
                {brand.length}/35 characters
              </Text>
            </View>

            {showAllFields && (
              <>
                <Text className="text-xl font-montSemiBold mb-2 text-center">
                  Product Name <Text className="text-red-600">*</Text>
                </Text>
                <View>
                  <TextInput
                    className="bg-third font-montRegular p-3 rounded-lg mb-1 border border-black"
                    placeholder="Product name..."
                    placeholderTextColor="black"
                    value={productName}
                    onChangeText={handleProductNameChange}
                    maxLength={70}
                  />
                  <Text className="text-xs text-gray-700 text-right mb-3">
                    {productName.length}/70 characters
                  </Text>
                </View>

                <Text className="text-xl font-montSemiBold mb-2 text-center">
                  Price <Text className="text-red-600">*</Text>
                </Text>
                <View className="flex-row mb-4">
                  <TouchableOpacity 
                    onPress={openCurrencyPicker}
                    className="bg-third p-3 rounded-lg border border-black mr-2 w-1/3"
                  >
                    <Text className="font-montRegular text-black text-center">{currency}</Text>
                  </TouchableOpacity>
                  <TextInput
                    className="bg-third font-montRegular p-3 rounded-lg flex-1 border border-black"
                    placeholder="00.00"
                    placeholderTextColor="black"
                    value={price}
                    onChangeText={handlePriceChange}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text className="text-xs text-gray-700 text-center mb-4">
                  Tap to select currency and enter price
                </Text>

                <Text className="text-xl font-montSemiBold mb-2 text-center">
                  URL <Text className="text-gray-500">(optional)</Text>
                </Text>
                <TextInput
                  className="bg-third font-montRegular p-3 rounded-lg mb-4 border border-black"
                  placeholder="Enter manually"
                  placeholderTextColor="black"
                  value={url}
                  onChangeText={setUrl}
                />
                <Text className="text-xs text-gray-700 text-center mb-4">
                  OR
                </Text>

                <View className="flex-row items-evenly justify-evenly">
                  <TouchableOpacity 
                    onPress={handleSearchWeb}
                    className="bg-fourth p-3 w-1/2 rounded-3xl border border-black"
                  >
                    <Text className="text-center font-montRegular text-primary">
                      Search the Web
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={async () => {
                      try {
                        const content = await Clipboard.getStringAsync();
                        if (content) {
                          setUrl(content);
                        }
                      } catch (error) {
                        console.error('Error pasting:', error);
                      }
                    }}
                    className="bg-fourth w-1/3 p-3 rounded-3xl border border-black"
                  >
                    <Text className="text-center font-montRegular text-primary">
                      Paste
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text className="text-xl font-montSemiBold mb-2 text-center mt-6">
                  Size <Text className="text-gray-500">(optional)</Text>
                </Text>
                <View className="flex-row mb-2">
                  <TouchableOpacity 
                    onPress={openSizeRegionPicker}
                    className="bg-third p-3 rounded-lg border border-black mr-2 w-1/3"
                  >
                    <Text className="font-montRegular text-black text-center">{sizeCountry}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={openSizeValuePicker}
                    className="bg-third p-3 rounded-lg border border-black flex-1"
                  >
                    <Text className="font-montRegular text-black text-center">
                      {sizeValue || "Select size..."}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-xs text-gray-700 text-center mb-4">
                  Tap to select region and size
                </Text>

                <Text className="text-xl font-montSemiBold mb-2 text-center">
                  Colour <Text className="text-gray-500">(optional)</Text>
                </Text>
                <View className="mb-4">
                  <TouchableOpacity 
                    onPress={openColourPicker}
                    className="bg-third p-3 rounded-lg border border-black mb-2"
                  >
                    <Text className="font-montRegular text-black text-center">
                      {itemColour || "Select colour..."}
                    </Text>
                  </TouchableOpacity>
                  
                  {showColourInput ? (
                    <View className="flex-row">
                      <TextInput
                        className="bg-third font-montRegular p-3 rounded-lg border border-black flex-1 mr-2"
                        placeholder="Enter new colour..."
                        placeholderTextColor="black"
                        value={newColourInput}
                        onChangeText={setNewColourInput}
                        maxLength={20}
                        autoFocus
                      />
                      <TouchableOpacity
                        onPress={handleAddNewColour}
                        className="bg-black p-3 rounded-lg"
                        disabled={!newColourInput.trim()}
                      >
                        <Text className="text-primary font-montRegular">Add</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowColourInput(true)}
                      className="bg-black p-3 rounded-lg"
                    >
                      <Text className="text-center text-primary font-montRegular">+ Add New Colour</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <Text className="text-xl font-montSemiBold mb-2 text-center">
                  Product Type <Text className="text-gray-500">(optional)</Text>
                </Text>
                <View className="mb-4">
                <TouchableOpacity 
                    onPress={openProductPicker}
                    className="bg-third p-3 rounded-lg border border-black mb-2"
                  >
                    <Text className="font-montRegular text-black text-center">
                      {productType || "Select product type..."}
                    </Text>
                  </TouchableOpacity>
                  
                  {showProductInput ? (
                    <View className="flex-row">
                      <TextInput
                        className="bg-third font-montRegular p-3 rounded-lg border border-black flex-1 mr-2"
                        placeholder="Enter new product type..."
                        placeholderTextColor="black"
                        value={newProductInput}
                        onChangeText={setNewProductInput}
                        maxLength={20}
                        autoFocus
                      />
                      <TouchableOpacity
                        onPress={handleAddNewProductType}
                        className="bg-black p-3 rounded-lg"
                        disabled={!newProductInput.trim()}
                      >
                        <Text className="text-primary font-montRegular">Add</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowProductInput(true)}
                      className="bg-black p-3 rounded-lg"
                    >
                      <Text className="text-center text-primary font-montRegular">+ Add New Product Type</Text>
                    </TouchableOpacity>
                  )}
                
                </View>
              </>
            )}
          </ScrollView>
          
          <View 
            style={{
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: -4,
              },
              shadowOpacity: 0.3,
              shadowRadius: 3,
              elevation: 5,
            }}
          >
            <TouchableOpacity
              onPress={handleAddTag}
              className="bg-black p-4 rounded-lg mb-3"
            >
              <Text className="text-[#F3E3D3] text-center text-lg">
                {editingExistingTag ? 'Update Tag' : 'Add Tag'}
              </Text>
            </TouchableOpacity>

            {editingExistingTag && (
              <TouchableOpacity
                onPress={handleDeleteTag}
                className="bg-red-600 p-4 rounded-lg mb-1"
              >
                <Text className="text-white text-center text-lg">
                  Delete Tag
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {renderPickerModal(
        showCurrencyPicker,
        'Select Currency',
        currencyOptions,
        tempCurrency,
        (itemValue) => setTempCurrency(itemValue),
        confirmCurrency,
        cancelCurrency
      )}
      
      {renderPickerModal(
        showSizeRegionPicker,
        'Select Size Region',
        countryOptions,
        tempSizeCountry,
        (itemValue) => setTempSizeCountry(itemValue),
        confirmSizeRegion,
        cancelSizeRegion
      )}

      {renderPickerModal(
        showSizeValuePicker,
        'Select Size',
        sizeOptions,
        tempSizeValue,
        (itemValue) => setTempSizeValue(itemValue),
        confirmSizeValue,
        cancelSizeValue
      )}

      {renderPickerModal(
        showColourPicker,
        'Select Colour',
        colourOptions,
        tempItemColour,
        (itemValue) => setTempItemColour(itemValue),
        confirmColour,
        cancelColour
      )}

      {renderPickerModal(
        showProductTypePicker,
        'Select Product Type',
        productOptions,
        tempProductType,
        (itemValue) => setTemptProductType(itemValue),
        confirmProductType,
        cancelProductType
      )}
    </Modal>
  );
};

export default TagDetailModal;