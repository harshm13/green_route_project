import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { CitizenScannerScreen } from "./src/screens/CitizenScannerScreen";
import { DriverRouteScreen } from "./src/screens/DriverRouteScreen";
import { loginUser, getCurrentUser } from "./src/services/api";

export default function App() {
  const [activeTab, setActiveTab] = useState<"citizen" | "driver">("citizen");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userPoints, setUserPoints] = useState(1420);

  // Authenticate session on tab change or mount
  useEffect(() => {
    async function authenticateSession() {
      try {
        if (activeTab === "citizen") {
          const user = await loginUser("ananya@sou.edu", "admin123");
          setCurrentUser(user);
          setUserPoints(user.points || 1420);
        } else {
          const driver = await loginUser("rahul@greenroute.driver", "admin123");
          setCurrentUser(driver);
        }
      } catch (err) {
        console.warn("[App Auth] Session sign-in failed:", err);
      }
    }
    authenticateSession();
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* User Session Bar */}
      <View style={styles.sessionBar}>
        <Text style={styles.sessionText}>
          {currentUser
            ? `🟢 Connected: ${currentUser.name} (${currentUser.role.toUpperCase()})`
            : "🟡 Connecting to GreenRoute Platform..."}
        </Text>
      </View>

      {/* Screen Content */}
      <View style={styles.content}>
        {activeTab === "citizen" ? (
          <CitizenScannerScreen
            userId={currentUser?.id}
            currentUser={currentUser}
            onDepositSuccess={(pts) => setUserPoints((prev) => prev + pts)}
          />
        ) : (
          <DriverRouteScreen />
        )}
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={[styles.navItem, activeTab === "citizen" && styles.navItemActive]}
          onPress={() => setActiveTab("citizen")}
        >
          <Text style={styles.navIcon}>📷</Text>
          <Text
            style={[
              styles.navText,
              activeTab === "citizen" && styles.navTextActive,
            ]}
          >
            Citizen Scanner
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, activeTab === "driver" && styles.navItemActive]}
          onPress={() => setActiveTab("driver")}
        >
          <Text style={styles.navIcon}>🚚</Text>
          <Text
            style={[
              styles.navText,
              activeTab === "driver" && styles.navTextActive,
            ]}
          >
            Driver Logistics
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  content: {
    flex: 1,
  },
  navBar: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    justifyContent: "space-around",
  },
  navItem: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  navItemActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  navIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  navText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  navTextActive: {
    color: "#34D399",
    fontWeight: "700",
  },
  sessionBar: {
    backgroundColor: "#1E293B",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sessionText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
});
