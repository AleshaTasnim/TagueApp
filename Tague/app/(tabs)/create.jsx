/**
 * create.jsx - Tab placeholder for create functionality
 * 
 * This component serves as an empty placeholder for the Create tab.
 * The actual create functionality is implemented in the createModal screen,
 * which is opened directly when the user taps the Create tab icon,
 * (createModal.jsx)
 * 
 * This placeholder is necessary to satisfy the Tabs navigator structure
 * while keeping the actual implementation in a modal experience.
 */

import React from 'react';
import { View } from 'react-native';

/**
 * CreatePlaceholder component - Empty placeholder
 * Returns an empty View since all functionality is in createModal
 */
const CreatePlaceholder = () => <View />;

export default CreatePlaceholder;