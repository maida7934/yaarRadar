import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/authState";
import { AuthGate } from "@/components/auth/AuthGate";
import { CharacterProvider } from "@/lib/characterState";

export const metadata: Metadata = {
  title: "YaarRadar — Find",
  description: "Find your friends — straight-line distance and bearing, in real time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AuthGate>
            <CharacterProvider>{children}</CharacterProvider>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
