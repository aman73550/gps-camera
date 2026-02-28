import { Alert } from "react-native";

export function showSignOutAlert(
  logout: () => void,
  navigateToFiles?: () => void,
) {
  Alert.alert(
    "Before You Sign Out",
    "Uploaded photos will no longer sync to your account after signing out.\n\nWant to save any photos to your device gallery first? Open a photo and tap the 'Save' button.",
    [
      {
        text: "Save Photos First",
        style: "cancel",
        onPress: navigateToFiles,
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Sign Out?",
            "Are you sure you want to sign out?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Sign Out", style: "destructive", onPress: logout },
            ],
          );
        },
      },
    ],
  );
}
