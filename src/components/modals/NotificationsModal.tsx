/*
 * FILE: src/components/modals/NotificationsModal.tsx
 * PURPOSE: Interactive slide modal listing daily action agendas and recent activity feeds.
 *          Filters activities to show only events from other roommates that target the current user.
 * WHERE USED: Dashboard screen notifications bell click trigger.
 */

// Import React hooks
import React from "react";
// Import layout layouts, texts, scrolls, and touch areas
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
// Import vector icons
import { MaterialIcons } from "@expo/vector-icons";
// Import slide modal wrapper
import SlideModal from "../SlideModal";
// Import helper predicting categories/icons matching activity codes
import { getActivityConfig } from "../../utils/activityUtils";

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  agendaItems: any[];
  activities: any[];
  currentUserId: string;
  handleNav: (screenName: "Grocery" | "Expenses" | "Chores" | "Chat") => void;
  isDark: boolean;
}

/**
 * NotificationsModal displays daily agenda tasks and logs feeds.
 */
export const NotificationsModal = React.memo(({
  visible,
  onClose,
  agendaItems,
  activities,
  currentUserId,
  handleNav,
  isDark,
}: NotificationsModalProps) => {
  // Theme color styling variables mapping
  const textMain = isDark ? "#F1F5F9" : "#1A1D3B";
  const textMuted = isDark ? "#A78BFA" : "#4F46E5";
  const muted = isDark ? "#A78BFA" : "#4F46E5";

  // Filter: only show notifications created by OTHER roommates that target me
  const relevantActivities = activities.filter((a) => {
    const isFromOther = a.userId !== currentUserId;
    const isForMe = !a.targetUid || a.targetUid === currentUserId;
    return isFromOther && isForMe;
  });

  return (
    <SlideModal visible={visible} onClose={onClose} title="Notifications">
      <ScrollView style={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        
        {/* SECTION 1: Daily Agenda (Urgent tasks/balances due) */}
        {agendaItems.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text
              style={{
                color: textMuted,
                fontSize: 10,
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 10,
                marginLeft: 4,
              }}
            >
              Daily Agenda
            </Text>
            <View style={{ gap: 10 }}>
              {agendaItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    // Close notification sheet before performing navigation redirects
                    onClose();
                    handleNav(item.navTarget);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 16,
                    borderRadius: 20,
                    backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(99,102,241,0.03)",
                    borderWidth: 1,
                    borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(99,102,241,0.05)",
                  }}
                >
                  {/* Category icon indicator wrapper */}
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: item.color + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <MaterialIcons name={item.icon} size={20} color={item.color} />
                  </View>
                  
                  {/* Agenda titles */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: textMain, fontWeight: "800", fontSize: 13 }}>
                      {item.title}
                    </Text>
                    <Text style={{ color: textMuted, fontSize: 11, marginTop: 4, fontWeight: "600" }}>
                      {item.subtitle}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* SECTION 2: Recent Activity Feed (Logs of roommate updates) */}
        <View>
          <Text
            style={{
              color: textMuted,
              fontSize: 10,
              fontWeight: "900",
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 10,
              marginLeft: 4,
            }}
          >
            Recent Activity
          </Text>
          {relevantActivities.length === 0 ? (
            // Empty state placeholder
            <View style={{ alignItems: "center", paddingVertical: 40 }}>
              <MaterialIcons
                name="notifications-none"
                size={48}
                color={muted}
                style={{ opacity: 0.5 }}
              />
              <Text style={{ color: muted, fontSize: 14, marginTop: 12 }}>
                No new notifications from roommates
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {relevantActivities.map((item, idx) => {
                // Fetch icon configuration matching the activity code type
                const config = getActivityConfig(item.type);
                return (
                  <View
                    key={item.id || idx}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 16,
                      borderRadius: 20,
                      backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(99,102,241,0.03)",
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(99,102,241,0.05)",
                    }}
                  >
                    {/* Activity configuration icon bubble wrapper */}
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: config.color + "20",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <MaterialIcons name={config.icon} size={20} color={config.color} />
                    </View>
                    
                    {/* Activity descriptions */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
                        <Text style={{ color: textMain, fontWeight: "800", fontSize: 13 }}>
                          {item.userName}
                        </Text>
                        <Text style={{ color: textMuted, fontSize: 13, marginHorizontal: 4 }}>
                          {config.label}
                        </Text>
                        <Text style={{ color: textMain, fontWeight: "700", fontSize: 13 }}>
                          {item.title}
                        </Text>
                      </View>
                      
                      {/* Timestamp of the activity */}
                      <Text style={{ color: textMuted, fontSize: 10, marginTop: 4, fontWeight: "600" }}>
                        {item.createdAt?.seconds
                          ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "2-digit",
                              month: "short",
                            })
                          : "Just now"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SlideModal>
  );
});

NotificationsModal.displayName = "NotificationsModal";
