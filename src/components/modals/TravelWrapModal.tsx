import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
  Image,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
// @ts-ignore
import ViewShot, { captureRef } from "react-native-view-shot";
// @ts-ignore
import * as Sharing from "expo-sharing";
import SlideModal from "../SlideModal";
import { Avatar } from "../Avatar";
import { useTheme } from "../../context/ThemeContext";
import { ItineraryItem } from "../../types";

interface TravelWrapModalProps {
  visible: boolean;
  onClose: () => void;
  householdData: any;
  memberProfiles: Record<string, any>;
  currentUserId: string;
  itinerary: ItineraryItem[];
}

const parseDateString = (str: string) => {
  if (!str) return null;
  const cleanStr = str.trim();
  // Check if it's YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    return new Date(cleanStr);
  }
  // Check if it's DD-MM-YYYY or DD/MM/YYYY
  const parts = cleanStr.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
  }
  const d = new Date(cleanStr);
  return isNaN(d.getTime()) ? null : d;
};

const getActivityEmoji = (activityName: string) => {
  const name = activityName.toLowerCase();
  if (name.includes("mountain") || name.includes("hill") || name.includes("trek") || name.includes("peak") || name.includes("climb") || name.includes("mullayanagiri")) {
    return "⛰️";
  }
  if (name.includes("beach") || name.includes("sea") || name.includes("ocean") || name.includes("surf")) {
    return "🏖️";
  }
  if (name.includes("water") || name.includes("falls") || name.includes("lake") || name.includes("river") || name.includes("kayak") || name.includes("raft") || name.includes("zip")) {
    return "🌊";
  }
  if (name.includes("coffee") || name.includes("cafe") || name.includes("breakfast") || name.includes("food") || name.includes("eat")) {
    return "☕";
  }
  if (name.includes("camp") || name.includes("tent") || name.includes("forest") || name.includes("nature")) {
    return "🌲";
  }
  if (name.includes("temple") || name.includes("shrine") || name.includes("church") || name.includes("yana") || name.includes("cave")) {
    return "🛕";
  }
  return "📍";
};



export const TravelWrapModal = React.memo(({
  visible,
  onClose,
  householdData,
  memberProfiles,
  currentUserId,
  itinerary,
}: TravelWrapModalProps) => {
  const { isDark } = useTheme();
  const cardRef = useRef<View>(null);

  // 1. Filter approved itinerary items and sort chronologically
  const approvedItinerary = itinerary
    .filter((item) => item.approved)
    .sort((a, b) => {
      const dateA = a.date + " " + a.time;
      const dateB = b.date + " " + b.time;
      return dateA.localeCompare(dateB);
    });

  // 2. Local state for selected milestone IDs (max 10)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (visible && approvedItinerary.length > 0) {
      // Default to checking the first 10 items
      setSelectedIds(approvedItinerary.slice(0, 10).map((item) => item.id));
    }
  }, [visible, itinerary]);

  const handleToggleMilestone = (id: string) => {
    if (selectedIds.includes(id)) {
      // Allow deselecting, but keep at least 1 milestone selected to display a route
      if (selectedIds.length <= 1) {
        Alert.alert("Required", "Please keep at least 1 milestone selected.");
        return;
      }
      setSelectedIds(selectedIds.filter((x) => x !== id));
    } else {
      if (selectedIds.length >= 10) {
        Alert.alert("Limit Reached", "You can highlight up to 10 milestone spots on the map.");
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  // 3. Extract selected items in chronological order
  const selectedMilestones = approvedItinerary.filter((item) =>
    selectedIds.includes(item.id)
  );

  // 4. Calculate Trip Duration
  let durationDays = 8; // default fallback
  if (householdData?.tripDetails?.startDate && householdData?.tripDetails?.endDate) {
    const start = parseDateString(householdData.tripDetails.startDate);
    const end = parseDateString(householdData.tripDetails.endDate);
    if (start && end) {
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (!isNaN(diffDays)) {
        durationDays = diffDays;
      }
    }
  } else if (approvedItinerary.length > 0) {
    const dates = approvedItinerary
      .map((item) => parseDateString(item.date)?.getTime())
      .filter((t): t is number => !!t && !isNaN(t));
    if (dates.length > 0) {
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      const diff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > 0) {
        durationDays = diff;
      }
    }
  }

  // 5. Trip Crew profiles
  const allMembers = householdData?.members || [];
  const currentUserProfile = memberProfiles[currentUserId] || { username: "Traveler" };
  const crewProfiles = allMembers
    .filter((uid: string) => uid !== currentUserId)
    .map((uid: string) => memberProfiles[uid])
    .filter(Boolean);

  const displayCrew = crewProfiles.slice(0, 3);
  const remainingCrewCount = crewProfiles.length - 3;

  // 6. Format Username (e.g. "David Miller" -> "David M.")
  const formatName = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(" ");
    if (parts.length > 1) {
      return `${parts[0]} ${parts[1].charAt(0)}.`;
    }
    return name;
  };

  // 7. Distance covered (User inputted or calculated fallback)
  const distanceInput = householdData?.tripDetails?.distanceTraveled;
  const distanceCoveredText = distanceInput
    ? `${parseFloat(distanceInput).toLocaleString()} km Covered`
    : `${(selectedMilestones.length * 45).toLocaleString()} km Covered (Est.)`;

  // 8. Dynamic SVG Path & Points Construction
  const points = React.useMemo(() => {
    const N = selectedMilestones.length;
    const pts = [];
    if (N === 1) {
      pts.push({ x: 155, y: 220, side: "right" as const });
    } else if (N > 1) {
      const topPad = 50;
      const bottomPad = 50;
      const availH = 440 - topPad - bottomPad;
      const dy = availH / (N - 1);
      for (let i = 0; i < N; i++) {
        const isLeft = i % 2 === 0;
        pts.push({
          x: isLeft ? 65 : 245,
          y: topPad + i * dy,
          side: isLeft ? ("right" as const) : ("left" as const),
        });
      }
    }
    return pts;
  }, [selectedMilestones]);

  const pathD = React.useMemo(() => {
    let dStr = "";
    if (points.length > 1) {
      dStr = `M ${points[0].x},${points[0].y}`;
      const dy = points[1].y - points[0].y;
      for (let i = 1; i < points.length; i++) {
        const pPrev = points[i - 1];
        const pCurr = points[i];
        const isLeftToRight = pPrev.x < pCurr.x;
        
        // Control points matching original curves mathematically but scaled vertically by dy
        const cp1x = isLeftToRight ? 130 : 180;
        const cp2x = isLeftToRight ? 180 : 135;
        
        // Symmetrical vertical tangents
        const cp1y = pPrev.y + dy * 0.25;
        const cp2y = pCurr.y - dy * 0.25;
        
        dStr += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${pCurr.x},${pCurr.y}`;
      }
    }
    return dStr;
  }, [points]);

  // 9. Native Sharing trigger
  const handleShareCard = async () => {
    try {
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 0.95,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Sharing Unavailable", "Sharing is not supported on this device.");
      }
    } catch (error) {
      console.error("ViewShot Capture Error:", error);
      Alert.alert("Error", "Could not generate shareable card image.");
    }
  };

  // Styling palette
  const textMain = isDark ? "#F1F5F9" : "#1E1B4B";
  const textMuted = isDark ? "#94A3B8" : "#475569";
  const cardBg = isDark ? "#111428" : "#E5ECE6";
  const shadowColor = isDark ? "rgba(0,0,0,0.5)" : "rgba(99,102,241,0.06)";

  return (
    <SlideModal visible={visible} onClose={onClose} title="Shareable Trip Wrap">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        
        {/* CARD CONTAINER (The captured element) */}
        <ViewShot
          ref={cardRef}
          options={{ format: "png", quality: 0.95 }}
          style={[styles.cardContainer, { backgroundColor: cardBg }]}
        >
          {/* Header Block */}
          <View style={styles.headerBlock}>
            <View>
              <Image
                source={require("../../../assets/logo_landscape.png")}
                style={{ width: 110, height: 26, tintColor: isDark ? "#FFFFFF" : "#1A1D3B" }}
                resizeMode="contain"
              />
            </View>
            
            <View style={styles.titleContainer}>
              <Text style={[styles.tripTitleText, { color: textMain }]} numberOfLines={1}>
                {householdData?.name || "My Trip"}
              </Text>
            </View>
          </View>

          {/* Top Profile & Metrics Row */}
          <View style={styles.profileMetricRow}>
            {/* Left: Trip Crew Vertical List */}
            <View style={styles.crewCol}>
              <View style={{ gap: 6 }}>
                {displayCrew.map((member: any, idx: number) => (
                  <View key={member.uid || idx} style={styles.crewItem}>
                    <Avatar
                      name={member.username}
                      size={24}
                      bgColor="#6366F1"
                      color="#FFFFFF"
                      photoUrl={member.photoUrl}
                    />
                    <Text style={[styles.crewName, { color: textMain }]} numberOfLines={1}>
                      {formatName(member.username)}
                    </Text>
                  </View>
                ))}
              </View>
              {crewProfiles.length > 3 && (
                <View style={styles.remainingPill}>
                  <Text style={styles.remainingText}>+{remainingCrewCount}</Text>
                </View>
              )}
              <View style={styles.crewBadge}>
                <MaterialIcons name="people" size={12} color="#6366F1" />
                <Text style={styles.crewBadgeText}>Trip Crew ({allMembers.length})</Text>
              </View>
            </View>

            {/* Center: Main User Profile */}
            <View style={styles.centerProfile}>
              <View style={styles.centerAvatarContainer}>
                <Avatar
                  name={currentUserProfile.username}
                  size={64}
                  bgColor="#E0E7FF"
                  color="#4F46E5"
                  photoUrl={currentUserProfile.photoUrl}
                  style={styles.centerAvatar}
                />
              </View>
              <Text style={[styles.profileName, { color: textMain }]}>
                {formatName(currentUserProfile.username)}
              </Text>
              <Text style={styles.profileLocation}>
                {householdData?.tripDetails?.destination || "Traveler"}
              </Text>
            </View>

            {/* Right: Trip Duration Progress Circle */}
            <View style={styles.durationCol}>
              <View style={styles.gaugeContainer}>
                <Svg width={60} height={60} viewBox="0 0 60 60">
                  <Circle
                    cx={30}
                    cy={30}
                    r={24}
                    stroke={isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0"}
                    strokeWidth={4.5}
                    fill="none"
                  />
                  <Circle
                    cx={30}
                    cy={30}
                    r={24}
                    stroke="#6366F1"
                    strokeWidth={4.5}
                    fill="none"
                    strokeDasharray={2 * Math.PI * 24}
                    strokeDashoffset={2 * Math.PI * 24 * 0.25} // 75% ring completion
                    strokeLinecap="round"
                    transform="rotate(-90 30 30)"
                  />
                </Svg>
                <View style={styles.gaugeTextOverlay}>
                  <Text style={[styles.gaugeNum, { color: textMain }]}>{durationDays}</Text>
                  <Text style={styles.gaugeUnit}>Days</Text>
                </View>
              </View>
              <View style={styles.durationBadge}>
                <MaterialIcons name="schedule" size={10} color="#475569" />
                <Text style={styles.durationBadgeText}>DURATION</Text>
              </View>
            </View>
          </View>

          {/* Central Scenic Route panel */}
          <View style={[styles.mapCardOuter, { backgroundColor: isDark ? "#111428" : "#E5ECE6" }]}>
            {/* 2D Landscape background illustration */}
            <Image 
              source={require("../../../assets/travel_card_bg.jpg")} 
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            {isDark && (
              <View 
                style={[
                  StyleSheet.absoluteFillObject, 
                  { backgroundColor: "rgba(15, 23, 42, 0.45)", zIndex: 1 } 
                ]} 
              />
            )}

            {/* Vector Illustration Background Layers */}
            <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">

              {/* Dynamic Winding Road */}
              {selectedMilestones.length > 1 && (
                <>
                  {/* Outer Road Bed */}
                  <Path
                    d={pathD}
                    fill="none"
                    stroke={isDark ? "#334155" : "#EADBB6"}
                    strokeWidth={6}
                    strokeLinecap="round"
                  />
                  {/* Inner Road Bed */}
                  <Path
                    d={pathD}
                    fill="none"
                    stroke={isDark ? "#1E293B" : "#DFCE9F"}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </>
              )}

              {/* Render Milestone Nodes (circular markers on the road) */}
              {selectedMilestones.map((item, index) => {
                const coord = points[index];
                if (!coord) return null;
                const isLast = index === selectedMilestones.length - 1;
                return (
                  <React.Fragment key={item.id}>
                    {/* Outer Circle */}
                    <Circle
                      cx={coord.x}
                      cy={coord.y}
                      r={7}
                      fill={isLast ? "#2E3B84" : "#4D69FF"}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                    {/* Inner Dot */}
                    <Circle
                      cx={coord.x}
                      cy={coord.y}
                      r={2}
                      fill="#FFFFFF"
                    />
                  </React.Fragment>
                );
              })}
            </Svg>

            {/* Render Milestone Text labels absolutely positioned on top (Tooltip above node style) */}
            {selectedMilestones.map((item, index) => {
              const coord = points[index];
              if (!coord) return null;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.absoluteLabelContainer,
                    { 
                      top: coord.y - 34, 
                      left: coord.x - 100 
                    },
                  ]}
                >
                  <View style={styles.milestoneLabelBox}>
                    <Text style={styles.milestoneNameText} numberOfLines={1}>
                      {getActivityEmoji(item.activity)} {index + 1}. {item.activity}
                    </Text>
                  </View>
                  {/* Triangle Pointer */}
                  <View style={styles.trianglePointer} />
                </View>
              );
            })}

            {/* Milestone Footer Footnote */}
            {approvedItinerary.length > selectedMilestones.length && (
              <View style={styles.remainingStopsNote}>
                <Text style={styles.remainingStopsText}>
                  ...and {approvedItinerary.length - selectedMilestones.length} more{"\n"}stops explored!
                </Text>
              </View>
            )}
          </View>

          {/* Footer Details Info panel */}
          <View style={[styles.footerPanel, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0" }]}>
            <View style={styles.footerRow}>
              <Text style={[styles.footerTripName, { color: textMain }]} numberOfLines={1}>
                {householdData?.name || "Karnataka Adventure"}
              </Text>
              <View style={styles.footerStatsRow}>
                <View style={styles.footerStatItem}>
                  <MaterialIcons name="navigation" size={12} color="#6366F1" />
                  <Text style={styles.footerStatText}>{distanceCoveredText}</Text>
                </View>
                <View style={styles.footerStatItem}>
                  <MaterialIcons name="format-list-bulleted" size={12} color="#6366F1" />
                  <Text style={styles.footerStatText}>{approvedItinerary.length} Activities</Text>
                </View>
              </View>
            </View>

            <View style={styles.footerDateRow}>
              <MaterialIcons name="date-range" size={12} color={textMuted} />
              <Text style={styles.footerDateText}>
                {householdData?.tripDetails?.startDate || "TBD"} — {householdData?.tripDetails?.endDate || "TBD"}
              </Text>
            </View>
          </View>
        </ViewShot>

        {/* INTERACTIVE MILESTONE SELECTOR */}
        <View style={styles.interactiveArea}>
          <Text style={[styles.selectorTitle, { color: textMain }]}>
            Customize Card Milestones
          </Text>
          <Text style={styles.selectorSubtitle}>
            Select up to 10 activities to plot on your road-trip path:
          </Text>

          {approvedItinerary.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Text style={styles.emptyStateText}>
                No approved itinerary activities found. Add some to your timeline first!
              </Text>
            </View>
          ) : (
            <View style={styles.checklistCard}>
              {approvedItinerary.map((item) => {
                const isChecked = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleToggleMilestone(item.id)}
                    style={[
                      styles.checkRow,
                      { borderColor: isDark ? "rgba(255,255,255,0.05)" : "#E2E8F0" },
                    ]}
                  >
                    <View style={styles.checkLeft}>
                      <MaterialIcons
                        name={isChecked ? "check-box" : "check-box-outline-blank"}
                        size={20}
                        color={isChecked ? "#6366F1" : "#94A3B8"}
                      />
                      <View>
                        <Text style={[styles.checkActivityText, { color: textMain }]} numberOfLines={1}>
                          {item.activity}
                        </Text>
                        <Text style={styles.checkDateText}>
                          {item.date} at {item.time}
                        </Text>
                      </View>
                    </View>
                    {isChecked && (
                      <View style={styles.numberBadge}>
                        <Text style={styles.numberBadgeText}>
                          {selectedIds.indexOf(item.id) + 1}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* MODAL ACTION BUTTONS */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={handleShareCard}
            style={[styles.actionBtn, styles.primaryBtn]}
          >
            <MaterialIcons name="share" size={20} color="#FFF" />
            <Text style={styles.primaryBtnText}>Share Wrap</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.actionBtn, styles.secondaryBtn, { borderColor: isDark ? "rgba(255,255,255,0.12)" : "#E2E8F0" }]}
          >
            <Text style={[styles.secondaryBtnText, { color: textMain }]}>View Trip Details</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SlideModal>
  );
});

TravelWrapModal.displayName = "TravelWrapModal";

const styles = StyleSheet.create({
  cardContainer: {
    width: 340,
    alignSelf: "center",
    borderRadius: 32,
    padding: 16,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    marginTop: 8,
    marginBottom: 20,
    overflow: "hidden",
  },
  headerBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  logoText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  tagline: {
    fontSize: 8,
    color: "#6366F1",
    fontWeight: "800",
    marginTop: 1,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  titleContainer: {
    maxWidth: 160,
  },
  tripTitleText: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  profileMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  crewCol: {
    width: 90,
    alignItems: "flex-start",
  },
  crewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  crewName: {
    fontSize: 10,
    fontWeight: "700",
  },
  remainingPill: {
    backgroundColor: "#38BDF8",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  remainingText: {
    color: "#FFF",
    fontSize: 8,
    fontWeight: "900",
  },
  crewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 6,
  },
  crewBadgeText: {
    fontSize: 8,
    color: "#6366F1",
    fontWeight: "900",
    textTransform: "uppercase",
  },
  centerProfile: {
    flex: 1,
    alignItems: "center",
  },
  centerAvatarContainer: {
    padding: 3,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "#6366F1",
    marginBottom: 4,
  },
  centerAvatar: {
    borderRadius: 32,
  },
  profileName: {
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  profileLocation: {
    fontSize: 9,
    color: "#6366F1",
    fontWeight: "800",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  durationCol: {
    width: 90,
    alignItems: "center",
  },
  gaugeContainer: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  gaugeTextOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeNum: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 14,
  },
  gaugeUnit: {
    fontSize: 7,
    color: "#6366F1",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  durationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 6,
  },
  durationBadgeText: {
    fontSize: 8,
    color: "#475569",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mapCardOuter: {
    width: "100%",
    height: 440,
    borderRadius: 24,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#1E293B",
  },
  absoluteLabelContainer: {
    position: "absolute",
    width: 200,
    alignItems: "center",
  },
  milestoneLabelBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  trianglePointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF",
    alignSelf: "center",
    marginTop: -1,
  },
  milestoneNameText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#000000",
    flexShrink: 1,
  },
  remainingStopsNote: {
    position: "absolute",
    bottom: 16,
    right: 16,
    alignItems: "flex-end",
  },
  remainingStopsText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    textAlign: "right",
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  footerPanel: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerTripName: {
    fontSize: 13,
    fontWeight: "900",
    flex: 1,
    marginRight: 8,
  },
  footerStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  footerStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerStatText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#6366F1",
  },
  footerDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  footerDateText: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "700",
  },
  interactiveArea: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 2,
  },
  selectorSubtitle: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
    marginBottom: 12,
  },
  emptyStateBox: {
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    fontWeight: "700",
  },
  checklistCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  checkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  checkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  checkActivityText: {
    fontSize: 13,
    fontWeight: "800",
  },
  checkDateText: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "700",
    marginTop: 2,
  },
  numberBadge: {
    backgroundColor: "#6366F1",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  numberBadgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "900",
  },
  actionsRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: "#6366F1",
    flexDirection: "row",
    gap: 6,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryBtn: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
