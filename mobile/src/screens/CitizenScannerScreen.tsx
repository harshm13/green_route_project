import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { parseSmartBinQr } from "../services/qrScanner";
import { submitQrDeposit } from "../services/api";
import { isWithinGeofence } from "../services/geofence";

interface CitizenScannerProps {
  userId?: number;
  currentUser?: any;
  onDepositSuccess?: (earnedPoints: number) => void;
}

export const CitizenScannerScreen: React.FC<CitizenScannerProps> = ({
  userId,
  currentUser,
  onDepositSuccess,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lockedBinId, setLockedBinId] = useState<number | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState("plastic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Request GPS permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    })();
  }, []);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.titleText}>Camera Permission Required</Text>
        <Text style={styles.subText}>
          GreenRoute needs access to your camera to scan smart bin QR codes and
          verify recyclable items.
        </Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;

    const parsed = parseSmartBinQr(data);
    if (parsed.isValid && parsed.binId !== null) {
      setScanned(true);
      setLockedBinId(parsed.binId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModalVisible(true);
    }
  };

  const handleConfirmDeposit = async () => {
    if (!lockedBinId) return;
    setIsSubmitting(true);
    try {
      const activeUserId = userId || currentUser?.id;
      const res = await submitQrDeposit(
        lockedBinId,
        selectedMaterial,
        userLocation?.latitude,
        userLocation?.longitude,
        activeUserId
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "🎉 Deposit Verified!",
        `${res.message}\nNew Balance: ${res.new_total_points} pts (Streak: ${res.streak} 🔥)`
      );

      setModalVisible(false);
      setScanned(false);
      setLockedBinId(null);
      if (onDepositSuccess) onDepositSuccess(res.earned_points);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit deposit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      >
        <View style={styles.overlay}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>GreenRoute Scanner</Text>
            <Text style={styles.headerSubtitle}>
              Align Smart Bin QR sticker inside targeting box
            </Text>
          </View>

          {/* QR Viewfinder Reticle */}
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <View style={styles.laserLine} />
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <Text style={styles.hintText}>
              📍 GPS Geofencing Active • High-Accuracy Anti-Fraud
            </Text>
          </View>
        </View>
      </CameraView>

      {/* Verified Deposit Confirmation Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>♻️</Text>
            <Text style={styles.modalTitle}>Smart Bin #{lockedBinId} Locked</Text>
            <Text style={styles.modalSubtitle}>
              Select the material you are depositing:
            </Text>

            {/* Material Pills */}
            <View style={styles.pillsRow}>
              {[
                { id: "plastic", label: "🧴 Plastic (+10%)" },
                { id: "organic", label: "🍏 Organic (+15%)" },
                { id: "e-waste", label: "🔋 E-Waste (+50%)" },
                { id: "metal", label: "🥫 Metal" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.pill,
                    selectedMaterial === item.id && styles.pillActive,
                  ]}
                  onPress={() => setSelectedMaterial(item.id)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      selectedMaterial === item.id && styles.pillTextActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleConfirmDeposit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.btnText}>✨ Deposit & Claim Points</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setModalVisible(false);
                setScanned(false);
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#0F172A",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 50,
  },
  header: { alignItems: "center", backgroundColor: "rgba(15,23,42,0.8)", padding: 14, borderRadius: 16 },
  headerTitle: { color: "#34D399", fontSize: 20, fontWeight: "800" },
  headerSubtitle: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  viewfinder: {
    width: 260,
    height: 260,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  corner: { position: "absolute", width: 24, height: 24, borderColor: "#10B981" },
  tl: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  tr: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bl: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  br: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  laserLine: {
    width: "90%",
    height: 2,
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowRadius: 8,
    shadowOpacity: 0.8,
  },
  footer: { backgroundColor: "rgba(15,23,42,0.8)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  hintText: { color: "#38BDF8", fontSize: 11, fontWeight: "600" },
  titleText: { color: "#F8FAFC", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  subText: { color: "#94A3B8", textAlign: "center", marginBottom: 20, fontSize: 14 },
  primaryBtn: {
    backgroundColor: "#10B981",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  btnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: "#1E293B",
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: "center",
  },
  modalEmoji: { fontSize: 44, marginBottom: 8 },
  modalTitle: { color: "#F8FAFC", fontSize: 20, fontWeight: "800", marginBottom: 4 },
  modalSubtitle: { color: "#94A3B8", fontSize: 13, marginBottom: 16 },
  pillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 },
  pill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pillActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  pillText: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
  pillTextActive: { color: "#FFFFFF", fontWeight: "700" },
  cancelBtn: { marginTop: 12, padding: 8 },
  cancelText: { color: "#94A3B8", fontSize: 14 },
});
