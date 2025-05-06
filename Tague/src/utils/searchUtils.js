/**
 * searchUtils.js - Utility functions for search operations
 * 
 * This module provides reusable utility functions for search-related operations
 * across the application. These functions handle common text processing tasks
 * such as truncation, term splitting, key generation, and formatting to ensure
 * consistent behaviour throughout the search functionality.
 */

/**
 * Truncates text that's too long
 */
export const truncateText = (text, maxLength, suffix = "...") => {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength - suffix.length) + suffix : text;
};

/**
 * Splits search text into individual terms
 */
export const getSearchTerms = (searchText) => {
  return searchText.toLowerCase().trim().split(/\s+/);
};

/**
 * Creates a tag key based on brand and product name
 */
export const createTagKey = (brand, productName) => {
  return `${(brand || '').toLowerCase()}:${(productName || '').toLowerCase()}`;
};

/**
 * Checks if an object contains a match for any search term
 */
export const containsSearchTerms = (object, searchTerms, fields) => {
  if (!object || !searchTerms || !fields) return false;
  
  return fields.some(field => {
    const value = (object[field] || '').toLowerCase();
    return searchTerms.some(term => value.includes(term));
  });
};

/**
 * Creates a formatted display text for a tag
 */
export const formatTagDisplay = (tag) => {
  if (!tag) return '';
  
  const brand = tag.brand || '';
  const product = tag.productName || '';
  const price = tag.price ? `${tag.price}` : '';
  
  let display = brand;
  if (product) {
    display += display ? ` - ${product}` : product;
  }
  if (price) {
    display += ` (${price})`;
  }
  
  return display;
};