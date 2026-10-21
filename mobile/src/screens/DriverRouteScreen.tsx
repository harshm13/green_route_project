import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Haptics from "expo-haptics";
import { fetchAllBins, SmartBin } from "../services/api";

export const DriverRouteScreen: React.FC = () => {
  const [bins, setBins] = useState<SmartBin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBins();
  }, []);

  const loadBins = async () => {
    setLoading(true);
    const data = await fetchAllBins();
    // Prioritize bins with high fill level for collection
    const sorted = [...data].sort((a, b) => b.fill_level - a.fill_level);
    setBins(sorted);
    setLoading(false);
  };

  const handleMarkCollected = (bin: SmartBin) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Confirm Collection",
      `Mark Bin #${bin.id} (${bin.name}) as emptied?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Emptied",
          onPress: () => {
            setBins((prev) =>
              prev.map((b) =>
                b.id === bin.id ? { ...b, fill_level: 0, is_full: false } : b
              )
            );
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Calculating Optimized Route...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Route Summary Ribbon */}
      <View style={styles.routeHeader}>
        <View>
          <Text style={styles.routeTitle}>🚚 Active Collection Route</Text>
          <Text style={styles.routeSub}>
            Silver Oak University • 4 Critical Stops
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadBins}>
          <Text style={styles.refreshText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Route List */}
      <FlatList
        data={bins}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listPadding}
        renderItem={({ item, index }) => {
          const isCritical = item.fill_level >= 80;
          return (
            <View style={[styles.binCard, isCritical && styles.cardCritical]}>
              <View style={styles.cardHeader}>
                <View style={styles.stopBadge}>
                  <Text style={styles.stopNum}>Stop #{index + 1}</Text>
                </View>
                <Text
                  style={[
                    styles.fillLevel,
                    { color: isCritical ? "#EF4444" : "#10B981" },
                  ]}
                >
                  {item.fill_level}% Full
                </Text>
              </View>

              <Text style={styles.binName}>{item.name}</Text>
              <Text style={styles.binMeta}>
                Zone: {item.zone.toUpperCase()} • 📍 {item.latitude.toFixed(4)}°N,{" "}
                {item.longitude.toFixed(4)}°E
              </Text>

              {/* Action */}
              <TouchableOpacity
                style={[
                  styles.collectBtn,
                  item.fill_level === 0 && styles.collectBtnDone,
                ]}
                onPress={() => handleMarkCollected(item)}
                disabled={item.fill_level === 0}
              >
                <Text style={styles.collectBtnText}>
                  {item.fill_level === 0
                    ? "✅ Collected & Emptied"
                    : "Empty Bin Now"}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
  },
  loadingText: { color: "#94A3B8", marginTop: 12, fontSize: 14 },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#1E293B",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  routeTitle: { color: "#F8FAFC", fontSize: 18, fontWeight: "800" },
  routeSub: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  refreshBtn: { padding: 8 },
  refreshText: { fontSize: 20 },
  listPadding: { padding: 16, gap: 12 },
  binCard: {
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardCritical: {
    borderColor: "rgba(239, 68, 68, 0.4)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  stopBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  stopNum: { color: "#34D399", fontSize: 11, fontWeight: "700" },
  fillLevel: { fontSize: 14, fontWeight: "800" },
  binName: { color: "#F8FAFC", fontSize: 16, fontWeight: "700", marginBottom: 4 },
  binMeta: { color: "#94A3B8", fontSize: 12, marginBottom: 12 },
  collectBtn: {
    backgroundColor: "#059669",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  collectBtnDone: { backgroundColor: "rgba(255,255,255,0.08)" },
  collectBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
});
