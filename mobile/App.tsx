import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { CitizenScannerScreen } from "./src/screens/CitizenScannerScreen";
import { DriverRouteScreen } from "./src/screens/DriverRouteScreen";

export default function App() {
  const [activeTab, setActiveTab] = useState<"citizen" | "driver">("citizen");
  const [userPoints, setUserPoints] = useState(1420);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Screen Content */}
      <View style={styles.content}>
        {activeTab === "citizen" ? (
          <CitizenScannerScreen
            userId={1}
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
});
