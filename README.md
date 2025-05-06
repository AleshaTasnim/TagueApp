# Tague - A Fashion-focused Social Media App 

## Project Overview
**Tague** is a fashion-based social media platform designed to allow users to share their outfits, explore styles, and discover new fashion items seamlessly. The platform aims to bridge the gap between fashion inspiration and purchase by integrating product links directly into posts, enabling users to transition from discovering outfits to purchasing featured items effortlessly.

This project is part of my final year undergraduate project at Queen Mary University of London, under the supervision of Madeline Ann Hamilton.

## Try It Now?
1. **Download the Expo Go app** on your mobile device:
   - **iOS:** https://apps.apple.com/us/app/expo-go/id982107779
   - **Android:** https://play.google.com/store/apps/details?id=host.exp.exponent&hl=en_GB
2. **Scan the QR code** below with Expo Go:

   <img src="https://github.com/user-attachments/assets/5e9b6edd-f488-4f9a-9126-9ad6b034b5ee" alt="Scan to Try the App" width="300" />

   - For iOS devices, go the camera app and scan the QR code
   - For Android devices, scan the QR code inside the app

Once scanned, **Tague** will load instantly on your device! 

## Key Features
- **User Authentication**: Users can create accounts, log in, and manage their profiles.
- **Content Sharing**: Users can upload photos, add captions, and tag products with purchase links.
- **Product Discovery**: Integrated product links allow users to explore and purchase items directly from posts.
- **User Interaction**: Users can like, comment, and bookmark posts, as well as follow other users and categories.
- **Inspiration Boards**: Users can create and manage inspiration boards to organise their saved posts.
- **Explore Feed**: A personalised feed allows users to discover new content based on their interests.

## Technologies Used
- **Frontend**: React Native (for cross-platform mobile development), NativeWind (for CSS styling)
- **Backend**: Firebase (for authentication, database, content interaction, messaging and storage)
- **Design**: Figma (for UI/UX design)
- **Programming Language**: JavaScript
- **Version Control**: Git

## Prerequisites for Local Set-Up
Before you begin, make sure you have the following installed on your machine:

- **Git** (to clone the repo)  
- **Node.js & npm** (for package management)  
- **Visual Studio Code** (as the IDE)  
  > Recommended extensions:
  > - Tailwind CSS IntelliSense
  > - Prettier – Code formatter  
  > - React Native Tools
  
- **Expo Go mobile app (for testing on your device)**
  
  - **iOS:** https://apps.apple.com/us/app/expo-go/id982107779
  - **Android:** https://play.google.com/store/apps/details?id=host.exp.exponent&hl=en_GB
 
  - IF THE APP fails to run due to missing expo cli (should not happen), you may run the following command:
  
  ```bash
  npm install --global expo-cli
  ```

## How to Run the Project Locally
1. **Navigate to your chosen directory**
   
   Replace `<path/to/your/dir>` with wherever you’d like the project to live:
   
   ```bash
   cd <path/to/your/dir>
   ```
3. **Clone the repository**
   
   This will create a new Tague-platform folder inside the directory above:
   
   ```bash
   git clone https://github.com/AleshaTasnim/Tague-platform.git
   ```
4. **Open command prompt and change into Tague Directory**;
   
   ```bash
   $ cd TagueApp/Tague
   ```
   **or if you are already in FinalProject Directory**
   
   ```bash
   $ cd Tague
   ```
5. **Install all dependencies**:
   
   ```bash
   npm install
   ```
6. **Insert the API Key into backend/firebaseConfig.js**:
   API Key has been provided in the supporting materials.

7. **Start the Expo server**:
    
   ```bash
   npx expo start
   ```
8. **Scan the QR code to run on your device**:
   
   - For iOS devices, go the camera app and scan the QR code
   - For Android devices, scan the QR code inside the app
   - Follow on screen instructions, and additional commands will be shown in the terminal
9. **End server:**

   Select
   
   ```bash
   CTRL + C
   ```

   to close server. 

   
