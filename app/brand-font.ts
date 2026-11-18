import localFont from "next/font/local";
export const manrope = localFont({
  src: [
    { path: "./fonts/Manrope-Regular.ttf", weight: "400" },
    { path: "./fonts/Manrope-Medium.ttf", weight: "500" },
    { path: "./fonts/Manrope-SemiBold.ttf", weight: "600" },
    { path: "./fonts/Manrope-Bold.ttf", weight: "700" },
    { path: "./fonts/Manrope-ExtraBold.ttf", weight: "800 900" },
  ],
  display: "swap",
  variable: "--font-manrope",
});
