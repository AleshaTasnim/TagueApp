/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#F3E3D3',
        secondary: '#000000',
        third: "#F2E7E7",
        fourth: "#463F3A",
      },
      fontFamily: {
        bregular: ["BebasNeue"],
        montBlack: ["Montserrat-Black"],
        montBlackItalic: ["Montserrat-BlackItalic"],
        montBold: ["Montserrat-Bold"],
        montBoldItalic: ["Montserrat-BoldItalic"],
        montExtraBold: ["Montserrat-ExtraBold"],
        montExtraBoldItalic: ["Montserrat-ExtraBoldItalic"],
        montExtraLight: ["Montserrat-ExtraLight"],
        montExtraLightItalic: ["Montserrat-ExtraLightItalic"],
        montItalic: ["Montserrat-Italic"],
        montLight: ["Montserrat-Light"],
        montLightItalic: ["Montserrat-LightItalic"],
        montMedium: ["Montserrat-Medium"],
        montMediumItalic: ["Montserrat-MediumItalic"],
        montRegular: ["Montserrat-Regular"],
        montSemiBold: ["Montserrat-SemiBold"],
        montSemiBoldItalic: ["Montserrat-SemiBoldItalic"],
        montThin: ["Montserrat-Thin"],
        montThinItalic: ["Montserrat-ThinItalic"]
      }
    },
  },
  plugins: [],
}