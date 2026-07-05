/*
 * FILE: src/components/modals/TravelWrapModal.tsx
 * PURPOSE: Interactive slide modal generating a shareable summary card for ended trips.
 *          Plots milestones along a 3D perspective curved road SVG map, supports screenshot
 *          capture sharing, and lets users toggle up to 10 itinerary stops.
 * WHERE USED: Dashboard screen Travel wrap-up button.
 */

// Import React hooks for managing state parameters, viewport layout dimensions, refs, and mounts
import React, { useState, useEffect, useRef } from 'react';
// Import layout components, style sheets, text blocks, image nodes, touch triggers, scrolls, and alerts
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  ScrollView,
  Alert,
} from 'react-native';
// Import SVG elements for high-performance vector graphics rendering
import Svg, { Circle, Path, Polygon, Defs, LinearGradient, Stop as SvgStop } from 'react-native-svg';
// Import linear gradients library
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
// Import vector icons
import { MaterialIcons } from '@expo/vector-icons';
// Import native sharing library
import * as Sharing from 'expo-sharing';
// Import screenshot capture library
import { captureRef } from 'react-native-view-shot';
// Import sliding slide modal template wrapper
import SlideModal from '../SlideModal';
// Import custom types schemas
import { ItineraryItem } from '../../types';
// Import dark theme contexts
import { useTheme } from '../../context/ThemeContext';

export interface Traveler {
  initials: string;
  name: string;
  city: string;
  photoUrl: string | null;
}

export interface CrewMember {
  initials: string;
  photoUrl: string | null;
}

export interface Stop {
  emoji: string;
  name: string;
  day: number;
  isEnd?: boolean;
}

export interface TripData {
  tripName: string;
  mainTraveler: Traveler;
  startDate: string;
  endDate: string;
  durationDays: number;
  kmCovered: string;
  activities: number;
  crew: CrewMember[];
  maxVisibleCrew: number;
  stops: Stop[];
  totalStops: number;
}

// Get device viewport sizes to fit cards dynamically
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MAX_WIDTH = 440;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, CARD_MAX_WIDTH);
const PANEL_W = CARD_WIDTH - 40;
const PANEL_H = 300;

// Dummy dataset used for testing/layout presentation fallback
const DEFAULT_TRIP_DATA: TripData = {
  tripName: "Karnataka Adventure",
  mainTraveler: { initials: "SJ", name: "Sarah J.", city: "Bangalore", photoUrl: null },
  startDate: "Jan 10",
  endDate: "Jan 18, 2026",
  durationDays: 8,
  kmCovered: "1,250 km",
  activities: 25,
  crew: [
    { initials: "DM", photoUrl: null },
    { initials: "ER", photoUrl: null },
    { initials: "KP", photoUrl: null },
    { initials: "AN", photoUrl: null },
    { initials: "RV", photoUrl: null },
  ],
  maxVisibleCrew: 3,
  stops: [
    { emoji: "📍", name: "Sakleshpur", day: 1 },
    { emoji: "⛰️", name: "Mullayanagiri", day: 3 },
    { emoji: "🌊", name: "Jog Falls", day: 5 },
    { emoji: "🛕", name: "Hampi", day: 7 },
    { emoji: "✈️", name: "Kempegowda Airport", day: 8, isEnd: true },
  ],
  totalStops: 19,
};

interface TravelWrapCardProps {
  data?: TripData;
  householdId?: string | null;
  onClose?: () => void;
}

/**
 * TravelWrapCard compiles the final card container that gets screenshotted.
 */
export const TravelWrapCard: React.FC<TravelWrapCardProps> = ({ 
  data = DEFAULT_TRIP_DATA,
  householdId = "",
  onClose
}) => {
  // Reference targeting the card layout node to pass to view shot screenshot captures
  const cardRef = useRef<View>(null);
  
  // Track layout dimensions to offset milestones labels
  const [panelWidth, setPanelWidth] = useState(270);
  const [panelHeight, setPanelHeight] = useState(240);
  
  const { isDark } = useTheme();
  const bgTheme = isDark ? "#0b0d19" : "#F8FAFC";
  
  const btnPrimaryBg = isDark ? "#ffffff" : "#6366f1";
  const btnPrimaryText = isDark ? "#0b0d19" : "#ffffff";
  
  const btnSecondaryBg = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
  const btnSecondaryBorder = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
  const btnSecondaryText = isDark ? "#ffffff" : "#475569";
  
  // Capture screenshot of cardRef container and launch system sharing panel
  const handleShare = async () => {
    try {
      if (!cardRef.current) return;
      
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1.0,
        result: "tmpfile"
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your Travel Wrap!',
          UTI: 'public.png',
        });
      } else {
        Alert.alert("Sharing is not available", "Sharing is not supported on this platform.");
      }
    } catch (error) {
      console.log("Error capturing/sharing card:", error);
      Alert.alert("Error sharing", "An error occurred while generating the image for sharing.");
    }
  };

  // Stack of horizontal profile circle overlays representing crew members
  const renderCrewStack = () => {
    const visibleCrew = data.crew.slice(0, data.maxVisibleCrew);
    const extra = data.crew.length - data.maxVisibleCrew;

    return (
      <View style={styles.crewCol}>
        <View style={styles.avatarStack}>
          {visibleCrew.map((member: CrewMember, idx: number) => (
            <View 
              key={idx} 
              style={[styles.crewAv, { marginLeft: idx === 0 ? 0 : -8, zIndex: idx }]}
            >
              {member.photoUrl ? (
                <Image source={{ uri: member.photoUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.crewAvText}>{member.initials}</Text>
              )}
            </View>
          ))}
          {extra > 0 && (
            <View style={styles.crewPlus}>
              <Text style={styles.crewPlusText}>+{extra}</Text>
            </View>
          )}
        </View>
        <Text style={styles.labelSubText}>👥 Trip Crew ({data.crew.length})</Text>
      </View>
    );
  };

  // Circular duration percentage gauge
  const renderDurationGauge = () => {
    const pct = Math.min(data.durationDays / 14, 1);
    const radius = 27;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (circumference * pct);

    return (
      <View style={styles.durationCol}>
        <View style={styles.gaugeWrap}>
          <Svg width="60" height="60" viewBox="0 0 60 60" style={{ transform: [{ rotate: '-90deg' }] }}>
            <Circle cx="30" cy="30" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="4.5" />
            <Circle 
              cx="30" 
              cy="30" 
              r={radius} 
              fill="none" 
              stroke="#06b6d4" 
              strokeWidth="4.5" 
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.gaugeTextContainer}>
            <Text style={styles.gaugeNum}>{data.durationDays}</Text>
            <Text style={styles.gaugeUnit}>Days</Text>
          </View>
        </View>
        <Text style={styles.labelSubText}>🕒 Duration</Text>
      </View>
    );
  };

  // Renders the 3D perspective road path using dynamic SVG equations
  const renderRoadPanel = () => {
    const roadTop = 145;
    const roadBot = 300;
    const n = data.stops.length;

    // Mathematical formula calculating horizontal sway offsets based on height coords
    const getRoadPoint = (y: number) => {
      const t = (300 - y) / (300 - 145);
      const sway = Math.sin(t * Math.PI * 3.2);
      const amplitude = 48 * Math.pow(1 - t, 0.8) + 12;
      const x = 200 + sway * amplitude;
      const width = 10 + 290 * Math.pow(1 - t, 2.5);
      return { x, y, width };
    };

    const leftPoints: { x: number; y: number }[] = [];
    const rightPoints: { x: number; y: number }[] = [];
    const centerPoints: { x: number; y: number }[] = [];
    const steps = 40;

    // Loop steps to calculate coordinate markers along the curve
    for (let i = 0; i <= steps; i++) {
      const y = roadBot - (i / steps) * (roadBot - roadTop);
      const { x, width } = getRoadPoint(y);
      leftPoints.push({ x: x - width / 2, y });
      rightPoints.push({ x: x + width / 2, y });
      centerPoints.push({ x, y });
    }

    // Join calculated coordinates to create asphalt surface vector path
    const roadSurfacePath = `M ` + leftPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ') + 
                         ` L ` + [...rightPoints].reverse().map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ') + ` Z`;
    const centerDashesPath = `M ` + centerPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');

    // Calculate node coordinates for milestone markers mapping
    const nodePositions = data.stops.map((stop: Stop, i: number) => {
      const t = i / Math.max(n - 1, 1);
      // Keep nodes within safe y-bounds (155 to 282) so they don't clip at top/bottom edges
      const y = 282 - t * (282 - 155);
      const { x } = getRoadPoint(y);
      const r = 9 - t * 3.5;
      
      const physicalY = (y / 300) * panelHeight;
      return { x, y, r, stop, physicalY };
    });

    return (
      <View 
        style={styles.roadPanel}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setPanelWidth(width);
          setPanelHeight(height);
        }}
      >
        <Svg width="100%" height="100%" viewBox="0 0 400 300" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
              <SvgStop offset="0%" stopColor="#bae6fd" />
              <SvgStop offset="50%" stopColor="#e0f2fe" />
              <SvgStop offset="100%" stopColor="#fef9c3" />
            </LinearGradient>
          </Defs>

          {/* Sky Vector Gradient */}
          <Path d="M 0 0 H 400 V 300 H 0 Z" fill="url(#skyGradient)" />

          {/* Mountains background polygons */}
          <Path d="M -20 140 L 60 50 L 130 140 Z" fill="#0284c7" opacity={0.2} />
          <Path d="M 80 140 L 180 30 L 280 140 Z" fill="#0284c7" opacity={0.18} />
          <Path d="M 220 140 L 310 40 L 410 140 Z" fill="#0284c7" opacity={0.22} />
          <Path d="M 300 140 L 370 70 L 440 140 Z" fill="#0369a1" opacity={0.25} />
          
          {/* Valley green grass grass ground */}
          <Path d="M -20 140 L 420 140 L 420 300 L -20 300 Z" fill="#15803d" />
          
          {/* Valley terrain contours */}
          <Path d="M -20 200 Q 100 130, 210 160 T 420 180 L 420 300 L -20 300 Z" fill="#22c55e" opacity={0.55} />
          <Path d="M -20 230 Q 100 180, 200 200 T 420 240 L 420 300 L -20 300 Z" fill="#4ade80" opacity={0.75} />
          <Path d="M -20 265 Q 120 235, 220 250 T 420 265 L 420 300 L -20 300 Z" fill="#166534" opacity="0.9" />
          
          {/* Pines trees polygons left */}
          <Polygon points="28,255 22,268 34,268" fill="#14532d" />
          <Polygon points="28,260 20,275 36,275" fill="#166534" />
          <Polygon points="46,260 41,271 51,271" fill="#14532d" />
          
          {/* Pines trees polygons right */}
          <Polygon points="340,258 334,271 346,271" fill="#14532d" />
          <Polygon points="340,263 332,278 348,278" fill="#166534" />
          <Polygon points="358,262 352,274 364,274" fill="#14532d" />

          {/* Asphalt Road Vector Path */}
          <Path d={roadSurfacePath} fill="#475569" />
          
          {/* Dashboard Dotted center line */}
          <Path d={centerDashesPath} stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" strokeDasharray="6,8" fill="none" />

          {/* Milestone circular checkpoint nodes */}
          {nodePositions.map((node: { x: number; y: number; r: number; stop: Stop }, idx: number) => (
            <React.Fragment key={idx}>
              <Circle 
                cx={node.x} 
                cy={node.y} 
                r={node.r + 4} 
                fill={node.stop.isEnd ? "rgba(234,88,12,0.12)" : "rgba(2,132,199,0.12)"} 
              />
              <Circle 
                cx={node.x} 
                cy={node.y} 
                r={node.r} 
                fill={node.stop.isEnd ? '#ea580c' : '#0284c7'} 
              />
            </React.Fragment>
          ))}
        </Svg>

        {/* Milestone floating text badge labels */}
        {nodePositions.map((node: { x: number; y: number; r: number; stop: Stop; physicalY: number }, i: number) => {
          const isLeft = i % 2 !== 0;
          const badgeStyle = isLeft 
            ? { top: node.physicalY - 14, left: 10 } 
            : { top: node.physicalY - 14, right: 10 };

          return (
            <View key={i} style={[styles.checkpointBadge, badgeStyle]}>
              <View style={[styles.badgeDot, node.stop.isEnd && styles.badgeDotEnd]} />
              <Text style={styles.badgeText}>{node.stop.emoji} {node.stop.name}</Text>
              <Text style={styles.badgeDay}>Day {node.stop.day}</Text>
            </View>
          );
        })}

        {/* Remainder footnote showing count of hidden stops */}
        {data.totalStops - n > 0 && (
          <View style={styles.moreFootnote}>
            <Text style={styles.moreFootnoteText}>
              …and {data.totalStops - n} more{'\n'}stops explored!
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.scrollContainer, { backgroundColor: bgTheme }]}>
      {/* Captured card component container */}
      <View ref={cardRef} style={styles.wrapCard}>
        <ExpoLinearGradient
          colors={['#F5F7FF', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Header brand details */}
        <View style={styles.cardHeader}>
          <View style={styles.brandContainer}>
            <Image
              source={require("../../../assets/adaptive-icon-modified.png")}
              style={{ width: 64, height: 64, marginRight: -2 }}
              resizeMode="contain"
            />
            <View>
              <Text style={{ fontSize: 15, fontWeight: "900", color: "#1e1b4b", letterSpacing: -0.3 }}>
                House Sync
              </Text>
              <Text style={{ fontSize: 8, fontWeight: "800", color: "#6366f1", letterSpacing: 0.4, textTransform: "uppercase" }}>
                Shared Living & Travel Made Easier
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.shareBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 14 }}>🔗</Text>
          </TouchableOpacity>
        </View>

        {/* Profile Avatar stack and duration info ring */}
        <View style={styles.profileRow}>
          {renderCrewStack()}

          <View style={styles.mainTraveler}>
            <ExpoLinearGradient
              colors={['#6366f1', '#06b6d4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRingGradient}
            >
              <View style={styles.avatarRingInner}>
                {data.mainTraveler.photoUrl ? (
                  <Image source={{ uri: data.mainTraveler.photoUrl }} style={styles.mainAvatar} />
                ) : (
                  <View style={[styles.mainAvatar, styles.mainAvatarFallback]}>
                    <Text style={styles.mainAvatarText}>{data.mainTraveler.initials}</Text>
                  </View>
                )}
              </View>
            </ExpoLinearGradient>
            <Text style={styles.travelerName}>{data.mainTraveler.name}</Text>
            <Text style={styles.travelerCity}>{data.mainTraveler.city}</Text>
          </View>

          {renderDurationGauge()}
        </View>

        {/* Curved Perspective Map SVG panel */}
        {renderRoadPanel()}

        {/* Trip summaries stats footer */}
        <View style={styles.cardFooter}>
          <ExpoLinearGradient
            colors={['#6366f1', '#06b6d4', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 2, borderRadius: 1, marginBottom: 10 }}
          />
          <View style={styles.footerTopRow}>
            <View>
              <Text style={styles.tripTitle} numberOfLines={1}>{data.tripName}</Text>
              <View style={{ width: 36, height: 2, borderRadius: 1, backgroundColor: '#6366f1', marginTop: 3 }} />
            </View>
            <View style={styles.statsContainer}>
              <View style={[styles.statPill, { backgroundColor: '#EEF2FF' }]}>
                <Text style={[styles.statPillText, { color: '#6366f1' }]}>📍 {data.kmCovered}</Text>
              </View>
              <View style={[styles.statPill, { backgroundColor: '#ECFEFF' }]}>
                <Text style={[styles.statPillText, { color: '#0891b2' }]}>⚡ {data.activities} Acts</Text>
              </View>
            </View>
          </View>
          <Text style={styles.footerDate}>📅 {data.startDate} – {data.endDate}</Text>
        </View>
      </View>

      {/* Sharing controls action drawer */}
      <View style={styles.actionWrapper}>
        <TouchableOpacity style={styles.btnPrimaryWrapper} onPress={handleShare} activeOpacity={0.85}>
          <ExpoLinearGradient
            colors={['#6366f1', '#06b6d4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnPrimaryGradient}
          >
            <Text style={styles.btnPrimaryText}>🔗 Share Travel Wrap</Text>
          </ExpoLinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.btnSecondary, { backgroundColor: btnSecondaryBg, borderColor: btnSecondaryBorder }]} onPress={onClose} activeOpacity={0.8}>
          <Text style={[styles.btnSecondaryText, { color: btnSecondaryText }]}>Back to Trip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface TravelWrapModalProps {
  visible: boolean;
  onClose: () => void;
  householdData: any;
  memberProfiles: Record<string, any>;
  currentUserId: string;
  itinerary: ItineraryItem[];
}

/**
 * TravelWrapModal triggers modal sheet layers compiling and mapping trip summaries.
 */
export const TravelWrapModal: React.FC<TravelWrapModalProps> = ({
  visible,
  onClose,
  householdData,
  memberProfiles,
  currentUserId,
  itinerary,
}) => {
  const { isDark } = useTheme();
  const textMain = isDark ? "#F1F5F9" : "#1E1B4B";
  const textMuted = isDark ? "#94A3B8" : "#475569";
  const bgTheme = isDark ? "#0b0d19" : "#F8FAFC";
  
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.08)";
  const rowBorder = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)";
  const emptyBg = isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)";
  const rowBgChecked = isDark ? "rgba(99, 102, 241, 0.08)" : "rgba(99, 102, 241, 0.04)";

  // Filter and sort itinerary events chronologically
  const approvedItinerary = itinerary
    .filter((item) => item.approved)
    .sort((a, b) => {
      const dateA = a.date + " " + a.time;
      const dateB = b.date + " " + b.time;
      return dateA.localeCompare(dateB);
    });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Default to selecting the first 5 itinerary checkpoints to populate initial map curves
  useEffect(() => {
    if (visible && approvedItinerary.length > 0) {
      setSelectedIds(approvedItinerary.slice(0, 5).map((item) => item.id));
    }
  }, [visible]);

  // Toggle checklist selection items keeping counts strictly between [1, 10]
  const handleToggleMilestone = (id: string) => {
    if (selectedIds.includes(id)) {
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

  const selectedMilestones = approvedItinerary.filter((item) =>
    selectedIds.includes(item.id)
  );

  // Helper parsing date strings formats cleanly
  const parseDateString = (str: string) => {
    if (!str) return null;
    const cleanStr = str.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
      return new Date(cleanStr);
    }
    const parts = cleanStr.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      } else if (parts[2].length === 4) {
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      }
    }
    const d = new Date(cleanStr);
    return isNaN(d.getTime()) ? null : d;
  };

  // Calculate dynamic duration difference in days between start and end trip bounds
  let durationDays = 8;
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

  // Extract initials and username strings for crew avatar nodes
  const allMembers = householdData?.members || [];
  const currentUserProfile = memberProfiles[currentUserId] || { username: "Traveler" };
  const crewProfiles = allMembers
    .filter((uid: string) => uid !== currentUserId)
    .map((uid: string) => memberProfiles[uid])
    .filter(Boolean);

  const formatInitials = (name: string) => {
    if (!name) return "T";
    const parts = name.trim().split(" ");
    if (parts.length > 1) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const crew = crewProfiles.map((member: any) => ({
    initials: formatInitials(member.username || member.email || ""),
    photoUrl: member.photoUrl || null,
  }));

  const formatName = (name: string) => {
    if (!name) return "";
    const parts = name.trim().split(" ");
    if (parts.length > 1) {
      return `${parts[0]} ${parts[1].charAt(0)}.`;
    }
    return name;
  };

  // Compile final distance covered metrics values
  const distanceInput = householdData?.tripDetails?.distanceTraveled;
  const distanceCoveredText = distanceInput
    ? `${parseFloat(distanceInput).toLocaleString()} km`
    : `${(selectedMilestones.length * 45).toLocaleString()} km`;

  // Map category keywords to custom emojis representing milestone categories
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

  // Compile final array mapping milestones properties to stops schemas
  const stops = selectedMilestones.map((item, idx) => ({
    emoji: getActivityEmoji(item.activity),
    name: item.activity,
    day: parseDateString(item.date) && parseDateString(householdData?.tripDetails?.startDate) 
      ? Math.ceil((parseDateString(item.date)!.getTime() - parseDateString(householdData.tripDetails.startDate)!.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : idx + 1,
    isEnd: idx === selectedMilestones.length - 1,
  }));

  // Compile final aggregated data structure payload
  const tripData: TripData = {
    tripName: householdData?.tripDetails?.destination || householdData?.name || "My Trip",
    mainTraveler: {
      initials: formatInitials(currentUserProfile.username || currentUserProfile.email || "Traveler"),
      name: formatName(currentUserProfile.username || "Traveler"),
      city: householdData?.tripDetails?.destination || "Traveler",
      photoUrl: currentUserProfile.photoUrl || null,
    },
    startDate: householdData?.tripDetails?.startDate || "TBD",
    endDate: householdData?.tripDetails?.endDate || "TBD",
    durationDays,
    kmCovered: distanceCoveredText,
    activities: itinerary.length,
    crew,
    maxVisibleCrew: 3,
    stops,
    totalStops: approvedItinerary.length,
  };

  return (
    <SlideModal visible={visible} onClose={onClose} title="Shareable Trip Wrap">
      <View style={{ flex: 1, backgroundColor: bgTheme, paddingBottom: 24 }}>
        <TravelWrapCard data={tripData} householdId={householdData?.id || ""} onClose={onClose} />

        {/* Milestone checklist customization details container */}
        <View style={styles.interactiveArea}>
          <Text style={[styles.selectorTitle, { color: textMain }]}>
            Customize Card Milestones
          </Text>
          <Text style={[styles.selectorSubtitle, { color: textMuted }]}>
            Select up to 10 activities to plot on your road-trip path:
          </Text>

          {approvedItinerary.length === 0 ? (
            <View style={[styles.emptyStateBox, { backgroundColor: emptyBg }]}>
              <Text style={[styles.emptyStateText, { color: textMuted }]}>
                No approved itinerary activities found. Add some to your timeline first!
              </Text>
            </View>
          ) : (
            <View style={[styles.checklistCard, { borderColor: cardBorder }]}>
              {approvedItinerary.map((item) => {
                const isChecked = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleToggleMilestone(item.id)}
                    style={[
                      styles.checkRow,
                      { 
                        borderColor: rowBorder,
                        backgroundColor: isChecked ? rowBgChecked : 'transparent'
                      },
                    ]}
                  >
                    <View style={styles.checkLeft}>
                      <MaterialIcons
                        name={isChecked ? "check-box" : "check-box-outline-blank"}
                        size={20}
                        color={isChecked ? "#6366F1" : "#94A3B8"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.checkActivityText, { color: textMain }]} numberOfLines={1}>
                          {item.activity}
                        </Text>
                        <Text style={[styles.checkDateText, { color: textMuted }]}>
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
      </View>
    </SlideModal>
  );
};

// --- Strict StyleSheet Properties Layout ---
const styles = StyleSheet.create({
  scrollContainer: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#0b0d19',
  },
  wrapCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 36,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.12)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIconLogo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logoText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  brandName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e1b4b',
  },
  brandTagline: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  crewCol: {
    width: 85,
    alignItems: 'flex-start',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  crewAv: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  crewAvText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#334155',
  },
  crewPlus: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#06b6d4',
    marginLeft: 2,
  },
  crewPlusText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '800',
  },
  labelSubText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#6366f1',
    textTransform: 'uppercase',
  },
  mainTraveler: {
    flex: 1,
    alignItems: 'center',
  },
  avatarRingGradient: {
    padding: 2.5,
    borderRadius: 37,
    marginBottom: 4,
  },
  avatarRingInner: {
    borderRadius: 34,
    padding: 2,
    backgroundColor: '#ffffff',
  },
  avatarRing: {
    padding: 3,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#6366f1',
    marginBottom: 4,
  },
  mainAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  mainAvatarFallback: {
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3730a3',
  },
  travelerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e1b4b',
  },
  travelerCity: {
    fontSize: 9,
    color: '#6366f1',
    fontWeight: '700',
  },
  durationCol: {
    width: 85,
    alignItems: 'center',
  },
  gaugeWrap: {
    position: 'relative',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeTextContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  gaugeNum: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e1b4b',
  },
  gaugeUnit: {
    fontSize: 7,
    color: '#06b6d4',
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  roadPanel: {
    width: '100%',
    height: 240,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    marginVertical: 15,
  },
  roadBgGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e0f2fe',
  },
  checkpointBadge: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284c7',
    marginRight: 6,
  },
  badgeDotEnd: {
    backgroundColor: '#ea580c',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e293b',
    marginRight: 4,
  },
  badgeDay: {
    fontSize: 8,
    color: '#64748b',
    fontWeight: '600',
  },
  moreFootnote: {
    position: 'absolute',
    bottom: 12,
    right: 14,
  },
  moreFootnoteText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'right',
  },
  cardFooter: {
    paddingTop: 4,
  },
  footerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  tripTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e1b4b',
    flex: 1,
    marginRight: 10,
  },
  statsContainer: {
    flexDirection: 'row',
  },
  statPill: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginLeft: 6,
  },
  statPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  footerDate: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  actionWrapper: {
    width: '100%',
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  btnPrimaryWrapper: {
    flex: 1,
    borderRadius: 16,
    marginRight: 8,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  btnPrimaryGradient: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginLeft: 8,
  },
  btnSecondaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  interactiveArea: {
    paddingHorizontal: 4,
    marginTop: 24,
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 2,
  },
  selectorSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
  },
  emptyStateBox: {
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 12,
    textAlign: "center",
    fontWeight: "700",
  },
  checklistCard: {
    borderRadius: 20,
    borderWidth: 1,
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
});