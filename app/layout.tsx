import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/authState";
import { AuthGate } from "@/components/auth/AuthGate";

export const metadata: Metadata = {
  title: "YaarRadar — Find",
  description: "Find your friends — straight-line distance and bearing, in real time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
