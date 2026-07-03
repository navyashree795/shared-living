import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  ScrollView,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { TripData } from './types';
import SlideModal from '../SlideModal';
import { ItineraryItem } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MAX_WIDTH = 440;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, CARD_MAX_WIDTH);
const PANEL_W = CARD_WIDTH - 40;
const PANEL_H = 300;

// Default dummy dataset matching the structure of your dynamic data layer
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
}

export const TravelWrapCard: React.FC<TravelWrapCardProps> = ({ 
  data = DEFAULT_TRIP_DATA,
  householdId = ""
}) => {
  
  const handleOpenApp = () => {
    const appScheme = `sharedliving://wrap/${householdId || ""}`;
    Linking.openURL(appScheme).catch(() => {
      // Fallback if app isn't installed
      handleDownloadApp();
    });
  };

  const handleDownloadApp = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.jeevan0714.sharedliving');
  };

  // --- Sub-Component Builders ---
  const renderCrewStack = () => {
    const visibleCrew = data.crew.slice(0, data.maxVisibleCrew);
    const extra = data.crew.length - data.maxVisibleCrew;

    return (
      <View style={styles.crewCol}>
        <View style={styles.avatarStack}>
          {visibleCrew.map((member, idx) => (
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

  const renderRoadPanel = () => {
    const roadTop = 145;
    const roadBot = 275;
    const n = data.stops.length;

    // Mathematical calculations parsing the HTML's custom vector road layout geometry
    const getRoadPoint = (y: number) => {
      const t = (300 - y) / (300 - 140);
      const sway = Math.sin(t * Math.PI * 3.2);
      const amplitude = 48 * Math.pow(1 - t, 0.8) + 12;
      const x = (PANEL_W / 2) + sway * (amplitude * (PANEL_W / 400));
      const width = (10 + 390 * Math.pow(1 - t, 2.5)) * (PANEL_W / 400);
      return { x, y, width };
    };

    const leftPoints: string[] = [];
    const rightPoints: string[] = [];
    const centerPoints: string[] = [];
    const steps = 40;

    for (let i = 0; i <= steps; i++) {
      const y = 300 - (i / steps) * (300 - 140);
      const { x, width } = getRoadPoint(y);
      leftPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      rightPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      centerPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }

    const roadSurfacePath = `M ${leftPoints.join(' L ')} L ${[...rightPoints].reverse().join(' L ')} Z`;
    const centerDashesPath = `M ${centerPoints.join(' L ')}`;

    const nodePositions = data.stops.map((stop, i) => {
      const t = i / Math.max(n - 1, 1);
      const y = roadBot - t * (roadBot - roadTop);
      const { x } = getRoadPoint(y);
      const r = 9 - t * 3.5;
      return { x, y, r, stop };
    });

    return (
      <View style={[styles.roadPanel, { width: PANEL_W }]}>
        <View style={styles.roadBgGradient} />
        
        <Svg width={PANEL_W} height={PANEL_H} style={StyleSheet.absoluteFill}>
          {/* Scenic Valley Shapes */}
          <Path d={`M -20 140 L ${PANEL_W * 0.15} 50 L ${PANEL_W * 0.32} 140 Z`} fill="#0284c7" opacity={0.2} />
          <Path d={`M ${PANEL_W * 0.2} 140 L ${PANEL_W * 0.45} 30 L ${PANEL_W * 0.7} 140 Z`} fill="#0284c7" opacity={0.18} />
          <Path d={`M -20 140 L ${PANEL_W + 20} 140 L ${PANEL_W + 20} 300 L -20 300 Z`} fill="#15803d" />
          
          {/* Main Curved Asphalt Surface */}
          <Path d={roadSurfacePath} fill="#475569" />
          
          {/* Dashboard Dotted Center Line Tracking */}
          <Path d={centerDashesPath} stroke="rgba(255,255,255,0.85)" strokeWidth="1.5" strokeDasharray="6,8" fill="none" />

          {/* Perspective Map Stop Coordinates */}
          {nodePositions.map((node, idx) => (
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

        {/* Dynamic Alternating Badge Text Elements */}
        {nodePositions.map((node, i) => {
          const isLeft = i % 2 !== 0;
          const badgeStyle = isLeft 
            ? { top: node.y - 14, left: 10 } 
            : { top: node.y - 14, right: 10 };

          return (
            <View key={i} style={[styles.checkpointBadge, badgeStyle]}>
              <View style={[styles.badgeDot, node.stop.isEnd && styles.badgeDotEnd]} />
              <Text style={styles.badgeText}>{node.stop.emoji} {node.stop.name}</Text>
              <Text style={styles.badgeDay}>Day {node.stop.day}</Text>
            </View>
          );
        })}

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
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <View style={[styles.wrapCard, { width: CARD_WIDTH }]}>
        
        {/* Header Branding Structure */}
        <View style={styles.cardHeader}>
          <View style={styles.brandContainer}>
            <View style={styles.brandIconLogo}>
              <Text style={styles.logoText}>HS</Text>
            </View>
            <View>
              <Text style={styles.brandName}>House Sync</Text>
              <Text style={styles.brandTagline}>TRAVEL WRAP</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.shareBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 14 }}>🔗</Text>
          </TouchableOpacity>
        </View>

        {/* Main Traveler Core Profile Frame */}
        <View style={styles.profileRow}>
          {renderCrewStack()}

          <View style={styles.mainTraveler}>
            <View style={styles.avatarRing}>
              {data.mainTraveler.photoUrl ? (
                <Image source={{ uri: data.mainTraveler.photoUrl }} style={styles.mainAvatar} />
              ) : (
                <View style={[styles.mainAvatar, styles.mainAvatarFallback]}>
                  <Text style={styles.mainAvatarText}>{data.mainTraveler.initials}</Text>
                </View>
              )}
            </View>
            <Text style={styles.travelerName}>{data.mainTraveler.name}</Text>
            <Text style={styles.travelerCity}>{data.mainTraveler.city}</Text>
          </View>

          {renderDurationGauge()}
        </View>

        {/* 3D Curved Perspective Map Rendering */}
        {renderRoadPanel()}

        {/* Metrics/Stats Footer Container */}
        <View style={styles.cardFooter}>
          <View style={styles.footerTopRow}>
            <Text style={styles.tripTitle} numberOfLines={1}>{data.tripName}</Text>
            <View style={styles.statsContainer}>
              <View style={styles.statPill}><Text style={styles.statPillText}>📍 {data.kmCovered}</Text></View>
              <View style={styles.statPill}><Text style={styles.statPillText}>📄 {data.activities} Acts</Text></View>
            </View>
          </View>
          <Text style={styles.footerDate}>📅 {data.startDate} – {data.endDate}</Text>
        </View>
      </View>
    </ScrollView>
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

export const TravelWrapModal: React.FC<TravelWrapModalProps> = ({
  visible,
  onClose,
  householdData,
  memberProfiles,
  currentUserId,
  itinerary,
}) => {
  // 1. Filter approved itinerary items and sort chronologically
  const approvedItinerary = itinerary
    .filter((item) => item.approved)
    .sort((a, b) => {
      const dateA = a.date + " " + a.time;
      const dateB = b.date + " " + b.time;
      return dateA.localeCompare(dateB);
    });

  const selectedMilestones = approvedItinerary.slice(0, 10);

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

  const distanceInput = householdData?.tripDetails?.distanceTraveled;
  const distanceCoveredText = distanceInput
    ? `${parseFloat(distanceInput).toLocaleString()} km`
    : `${(selectedMilestones.length * 45).toLocaleString()} km`;

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

  const stops = selectedMilestones.map((item, idx) => ({
    emoji: getActivityEmoji(item.activity),
    name: item.activity,
    day: parseDateString(item.date) && parseDateString(householdData?.tripDetails?.startDate) 
      ? Math.ceil((parseDateString(item.date)!.getTime() - parseDateString(householdData.tripDetails.startDate)!.getTime()) / (1000 * 60 * 60 * 24)) + 1
      : idx + 1,
    isEnd: idx === selectedMilestones.length - 1,
  }));

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
      <View style={{ flex: 1, backgroundColor: '#0b0d19' }}>
        <TravelWrapCard data={tripData} householdId={householdData?.id || ""} />
      </View>
    </SlideModal>
  );
};

// --- Strict StyleSheet Properties Layout ---
const styles = StyleSheet.create({
  scrollContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: '#0b0d19',
  },
  wrapCard: {
    backgroundColor: '#ffffff',
    borderRadius: 36,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 15,
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
    height: 300,
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
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
    borderTopWidth: 1,
    borderTopColor: 'rgba(99,102,241,0.08)',
    paddingTop: 12,
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
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  btnPrimaryText: {
    color: '#0b0d19',
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
});