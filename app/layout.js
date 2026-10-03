import "./globals.css";
import "./evangel.css";
export const metadata = {
  metadataBase: new URL("https://evangel.fund"),
  robots: { index: false, follow: false },
  title: "Evangel — Build it. Back it. Spread it.",
  description:
    "Rally around e/acc and support open-source workers. Community launches, earned token exposure and transparent funding without an Evangel platform token.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
