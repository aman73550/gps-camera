import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function LoginModal({ visible, onClose }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      await login(email, password);
      setEmail("");
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.kav}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />

            <Pressable style={styles.closeBtn} onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
            </Pressable>

            <View style={styles.iconWrap}>
              <View style={styles.iconCircle}>
                <Ionicons name="person" size={36} color={Colors.light.primary} />
              </View>
            </View>

            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>
              Unlock unlimited uploads and sync across devices
            </Text>

            {!!error && (
              <View style={styles.errorWrap}>
                <Ionicons name="alert-circle-outline" size={16} color="#D32F2F" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TextInput
              style={styles.input}
              placeholder="Email address"
              value={email}
              onChangeText={(t) => { setEmail(t); setError(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={Colors.light.textTertiary}
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(""); }}
              secureTextEntry
              placeholderTextColor={Colors.light.textTertiary}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <Pressable
              style={({ pressed }) => [
                styles.loginBtn,
                { opacity: pressed || isLoading ? 0.75 : 1 },
              ]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color="#FFF" />
                  <Text style={styles.loginBtnText}>Sign In</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.guestBtn, { opacity: pressed ? 0.6 : 1 }]}
              onPress={handleClose}
            >
              <Text style={styles.guestText}>Continue as Guest</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  kav: {
    width: "100%",
  },
  sheet: {
    backgroundColor: "#FAFAFA",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 28,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DEDEDE",
    alignSelf: "center",
    marginBottom: 12,
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.surfaceVariant,
    justifyContent: "center",
    alignItems: "center",
  },
  iconWrap: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primaryContainer,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: Colors.light.onSurface,
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  errorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFEBEE",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  input: {
    backgroundColor: "#FFF",
    borderWidth: 1.5,
    borderColor: Colors.light.outline,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.light.onSurface,
    marginBottom: 12,
  },
  loginBtn: {
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  loginBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  guestBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  guestText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.light.textSecondary,
  },
});
