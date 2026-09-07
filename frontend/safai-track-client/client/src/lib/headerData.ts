export type UserRole = "Ward Officer" | "Citizen" | "Truck Driver" | "City Admin";

export interface UserProfile {
  name: string;
  role: UserRole;
  initials: string;
  email: string;
  phone: string;
  ward: string;
  avatarColor: string;
}

export const DEMO_PROFILES: Record<UserRole, UserProfile> = {
  "Ward Officer": {
    name: "Arif Rahman",
    role: "Ward Officer",
    initials: "AR",
    email: "arif.rahman@dncc.gov.bd",
    phone: "+880 1711-234567",
    ward: "Ward 08 (Dhanmondi)",
    avatarColor: "#E25C48", // Coral
  },
  "Citizen": {
    name: "Ayesha Siddiqua",
    role: "Citizen",
    initials: "AS",
    email: "ayesha.siddiqua@gmail.com",
    phone: "+880 1812-987654",
    ward: "Ward 08 (Dhanmondi Lake Rd)",
    avatarColor: "#3B82F6", // Blue
  },
  "Truck Driver": {
    name: "Kabir Hossain",
    role: "Truck Driver",
    initials: "KH",
    email: "kabir.h@transport.dncc.gov.bd",
    phone: "+880 1913-456789",
    ward: "Vehicle DHK-08 / Ward 08",
    avatarColor: "#10B981", // Emerald
  },
  "City Admin": {
    name: "Dr. Selim Reza",
    role: "City Admin",
    initials: "SR",
    email: "selim.reza@dncc.gov.bd",
    phone: "+880 1713-001122",
    ward: "Dhaka North City Corp (DNCC)",
    avatarColor: "#8B5CF6", // Purple
  },
};

export interface AppNotification {
  id: string;
  role: UserRole;
  title: string;
  message: string;
  timestamp: string;
  category: "alert" | "info" | "success" | "warning";
  read: boolean;
  link?: string;
}

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  // Ward Officer Notifications
  {
    id: "notif-wo-1",
    role: "Ward Officer",
    title: "Critical Overflow Alert",
    message: "Bin B01 (Dhanmondi Lake Road) reached 94% fill. Priority reroute generated.",
    timestamp: "6 min ago",
    category: "alert",
    read: false,
    link: "/driver/route",
  },
  {
    id: "notif-wo-2",
    role: "Ward Officer",
    title: "New Citizen Grievance #ST-2408",
    message: "Citizen Tanvir Ahmed reported 'Overflowing bin beside footbridge'. Assigned to Ward 08.",
    timestamp: "18 min ago",
    category: "warning",
    read: false,
    link: "/citizen/complaints/ST-2408",
  },
  {
    id: "notif-wo-3",
    role: "Ward Officer",
    title: "Morning Route Completed",
    message: "Truck DHK-08 (Driver Kabir Hossain) completed collection. 18.4 km avoided.",
    timestamp: "1 hour ago",
    category: "success",
    read: true,
    link: "/home",
  },
  {
    id: "notif-wo-4",
    role: "Ward Officer",
    title: "Ward Cleanliness KPI",
    message: "Ward 08 daily collection coverage reached 78% (+12% vs. yesterday).",
    timestamp: "3 hours ago",
    category: "info",
    read: true,
    link: "/home",
  },

  // Citizen Notifications
  {
    id: "notif-cit-1",
    role: "Citizen",
    title: "Complaint Status: In Progress",
    message: "Your report #ST-2408 has been acknowledged by Officer Arif Rahman. Field crew dispatched.",
    timestamp: "12 min ago",
    category: "info",
    read: false,
    link: "/citizen/complaints/ST-2408",
  },
  {
    id: "notif-cit-2",
    role: "Citizen",
    title: "Truck Approaching Your Area",
    message: "Collection Truck DHK-08 is within 400m of your street (Dhanmondi Lake Road).",
    timestamp: "25 min ago",
    category: "alert",
    read: false,
    link: "/driver/route",
  },
  {
    id: "notif-cit-3",
    role: "Citizen",
    title: "Complaint #ST-2405 Resolved",
    message: "Mohammadpur Bus Stand bin cleared. Response photo verified by DNCC inspector.",
    timestamp: "Yesterday",
    category: "success",
    read: true,
    link: "/citizen/complaints/ST-2405",
  },
  {
    id: "notif-cit-4",
    role: "Citizen",
    title: "Ward 08 Cleanliness Update",
    message: "Thank you for reporting! Dhanmondi Ward 08 civic rating is 4.8/5.0 this week.",
    timestamp: "2 days ago",
    category: "info",
    read: true,
    link: "/home",
  },

  // Truck Driver Notifications
  {
    id: "notif-drv-1",
    role: "Truck Driver",
    title: "Optimized Route Dispatched",
    message: "Ward 08 Morning Route is ready: 5 priority stops sequenced via Dijkstra algorithm.",
    timestamp: "Just now",
    category: "alert",
    read: false,
    link: "/driver/route",
  },
  {
    id: "notif-drv-2",
    role: "Truck Driver",
    title: "Urgent Priority Bin Added",
    message: "Stop #02 (Lalmatia 06) spiked to 81% fill. Positioned as next immediate pickup.",
    timestamp: "14 min ago",
    category: "warning",
    read: false,
    link: "/driver/route",
  },
  {
    id: "notif-drv-3",
    role: "Truck Driver",
    title: "Fuel Savings Commendation",
    message: "Route adherence saved 4.3 km of driving and estimated 1.8L diesel today.",
    timestamp: "2 hours ago",
    category: "success",
    read: true,
    link: "/home",
  },
  {
    id: "notif-drv-4",
    role: "Truck Driver",
    title: "Depot Maintenance Check",
    message: "Vehicle DHK-08 scheduled for hydraulic sensor check at Ward 08 depot by 17:30 BST.",
    timestamp: "Yesterday",
    category: "info",
    read: true,
    link: "/settings",
  },

  // City Admin Notifications
  {
    id: "notif-adm-1",
    role: "City Admin",
    title: "City-Wide Fleet Report",
    message: "34 out of 38 municipal trucks operational across Dhaka North. Route efficiency: 89%.",
    timestamp: "20 min ago",
    category: "info",
    read: false,
    link: "/home",
  },
  {
    id: "notif-adm-2",
    role: "City Admin",
    title: "High Priority SLA Risk",
    message: "Ward 11 has 2 unresolved complaints pending > 36 hours. Escalation sent to Ward Officer.",
    timestamp: "45 min ago",
    category: "alert",
    read: false,
    link: "/citizen/complaints",
  },
];

export interface SearchItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  badge?: string;
  badgeTone?: "coral" | "lime" | "blue";
  link: string;
  roles?: UserRole[];
}

export const SEARCH_ITEMS: SearchItem[] = [
  // Citizen-specific & general citizen items
  { id: "s-cmp-1", title: "ST-2408: Overflowing bin", subtitle: "Dhanmondi Lake Road · Reported by citizen · In Progress", category: "Complaints", badge: "In Progress", badgeTone: "coral", link: "/citizen/complaints/ST-2408", roles: ["Citizen", "Ward Officer", "City Admin"] },
  { id: "s-cmp-2", title: "ST-2407: Missed collection", subtitle: "Lalmatia Block C · 38 min ago · Pending acknowledgment", category: "Complaints", badge: "Pending", badgeTone: "coral", link: "/citizen/complaints/ST-2407", roles: ["Citizen", "Ward Officer", "City Admin"] },
  { id: "s-cmp-3", title: "ST-2405: Overflowing bin", subtitle: "Mohammadpur Bus Stand · Yesterday · Resolved by crew", category: "Complaints", badge: "Resolved", badgeTone: "lime", link: "/citizen/complaints/ST-2405", roles: ["Citizen", "Ward Officer", "City Admin"] },
  { id: "s-cmp-4", title: "ST-2398: Damaged bin lid", subtitle: "Kalabagan Market Lane · 2 days ago · Resolved with replacement", category: "Complaints", badge: "Resolved", badgeTone: "lime", link: "/citizen/complaints/ST-2398", roles: ["Citizen", "Ward Officer", "City Admin"] },
  { id: "s-c-bin-1", title: "Dhanmondi Lake Road Bin", subtitle: "Public collection bin · Sensor B01 · 94% full", category: "Neighborhood Bins", badge: "94% Full", badgeTone: "coral", link: "/citizen/dashboard", roles: ["Citizen"] },
  { id: "s-c-bin-2", title: "Lalmatia Block C Collection Point", subtitle: "Residential waste depot · Sensor B03 · 81% full", category: "Neighborhood Bins", badge: "81% Full", badgeTone: "coral", link: "/citizen/dashboard", roles: ["Citizen"] },
  { id: "s-c-bin-3", title: "Mohammadpur Bus Stand Bin", subtitle: "Transit lane container · Sensor B04 · 76% full", category: "Neighborhood Bins", badge: "76% Full", badgeTone: "lime", link: "/citizen/dashboard", roles: ["Citizen"] },
  { id: "s-act-1", title: "Report a New Civic Issue", subtitle: "Submit photo & GPS location for fast dispatch", category: "Quick Actions", badge: "Report", badgeTone: "coral", link: "/citizen/report", roles: ["Citizen", "Ward Officer", "City Admin"] },
  { id: "s-act-c2", title: "Track My Open Complaints", subtitle: "Check live audit timeline and field progress", category: "Quick Actions", badge: "Status", badgeTone: "lime", link: "/citizen/complaints", roles: ["Citizen", "City Admin"] },
  { id: "s-act-c3", title: "Citizen Portal Home", subtitle: "View what you reported and what happens next", category: "Quick Actions", badge: "Home", badgeTone: "blue", link: "/citizen/dashboard", roles: ["Citizen", "City Admin"] },

  // Truck Driver-specific items
  { id: "s-drv-rt-1", title: "DHK-08 Dijkstra Priority Route", subtitle: "Ward 08 route · 5 priority stops · 18.4 km saved", category: "My Route & Stops", badge: "Ready", badgeTone: "lime", link: "/driver/route", roles: ["Truck Driver", "City Admin"] },
  { id: "s-drv-st-1", title: "Stop #01: Dhanmondi 08 (Lake Road)", subtitle: "Sensor B01 · 94% fill · ETA: Now · 1.2 km away", category: "My Route & Stops", badge: "Current Stop", badgeTone: "coral", link: "/driver/route", roles: ["Truck Driver", "City Admin"] },
  { id: "s-drv-st-2", title: "Stop #02: Lalmatia 06 (Block C)", subtitle: "Sensor B03 · 81% fill · ETA: 06 min", category: "My Route & Stops", badge: "Next Stop", badgeTone: "coral", link: "/driver/route", roles: ["Truck Driver", "City Admin"] },
  { id: "s-drv-st-3", title: "Stop #03: Mohammadpur 11 (Bus Stand)", subtitle: "Sensor B04 · 76% fill · ETA: 14 min", category: "My Route & Stops", badge: "Sequenced", badgeTone: "blue", link: "/driver/route", roles: ["Truck Driver", "City Admin"] },
  { id: "s-drv-st-4", title: "Stop #04: Adabor 02 (Ring Road)", subtitle: "Sensor B05 · 66% fill · ETA: 22 min", category: "My Route & Stops", badge: "Sequenced", badgeTone: "lime", link: "/driver/route", roles: ["Truck Driver", "City Admin"] },
  { id: "s-drv-bin-1", title: "Assigned Bin B01 - Dhanmondi Lake Footbridge", subtitle: "94% capacity · Heavy commercial volume", category: "Assigned Bins", badge: "94% Fill", badgeTone: "coral", link: "/driver/route", roles: ["Truck Driver", "City Admin"] },
  { id: "s-drv-bin-2", title: "Assigned Bin B03 - Lalmatia Block C", subtitle: "81% capacity · Priority morning collection", category: "Assigned Bins", badge: "81% Fill", badgeTone: "coral", link: "/driver/route", roles: ["Truck Driver", "City Admin"] },
  { id: "s-drv-bin-3", title: "Assigned Bin B04 - Mohammadpur Stand", subtitle: "76% capacity · Scheduled pickup point", category: "Assigned Bins", badge: "76% Fill", badgeTone: "lime", link: "/driver/route", roles: ["Truck Driver", "City Admin"] },
  { id: "s-drv-act-1", title: "Start / Resume Live Route", subtitle: "Turn on live Dijkstra routing and turn navigation", category: "Quick Actions", badge: "Route", badgeTone: "lime", link: "/driver/route", roles: ["Truck Driver", "City Admin"] },
  { id: "s-drv-act-2", title: "Driver Console", subtitle: "Check truck status (DHK-08 / Kabir Hossain)", category: "Quick Actions", badge: "Console", badgeTone: "blue", link: "/driver/dashboard", roles: ["Truck Driver", "City Admin"] },

  // Ward Officer items
  { id: "s-bin-1", title: "Dhanmondi 08 - Lake Road", subtitle: "Sensor B01 · 94% fill · Urgent collection required", category: "Bins & Sensors", badge: "94% Fill", badgeTone: "coral", link: "/driver/route", roles: ["Ward Officer", "City Admin"] },
  { id: "s-bin-2", title: "Lalmatia 06 - Block C", subtitle: "Sensor B03 · 81% fill · Priority stop #2", category: "Bins & Sensors", badge: "81% Fill", badgeTone: "coral", link: "/driver/route", roles: ["Ward Officer", "City Admin"] },
  { id: "s-bin-3", title: "Mohammadpur 11 - Bus Stand", subtitle: "Sensor B04 · 76% fill · Scheduled stop #3", category: "Bins & Sensors", badge: "76% Fill", badgeTone: "coral", link: "/driver/route" },
  { id: "s-bin-4", title: "Kalabagan 03 - Market Lane", subtitle: "Sensor B02 · 61% fill · Moderate load", category: "Bins & Sensors", badge: "61% Fill", badgeTone: "lime", link: "/driver/route", roles: ["Ward Officer", "City Admin"] },
  { id: "s-bin-5", title: "Adabor 02 - Ring Road", subtitle: "Sensor B05 · 33% fill · Low priority", category: "Bins & Sensors", badge: "33% Fill", badgeTone: "lime", link: "/driver/route", roles: ["Ward Officer", "City Admin"] },
  { id: "s-flt-1", title: "Truck DHK-08 (Compactor)", subtitle: "Driver: Kabir Hossain · 1.2 km from Stop #01 · Online", category: "Fleet & Drivers", badge: "Active", badgeTone: "lime", link: "/driver/route", roles: ["Ward Officer", "City Admin"] },
  { id: "s-flt-2", title: "Dijkstra Priority Route (Ward 08)", subtitle: "8 stops sequenced · 18.4 km distance saved", category: "Fleet & Drivers", badge: "Dijkstra", badgeTone: "blue", link: "/driver/route", roles: ["Ward Officer", "City Admin"] },
  { id: "s-act-off-1", title: "Ward Officer Desk", subtitle: "Resolve what your ward can see without losing the trail", category: "Quick Actions", badge: "Desk", badgeTone: "coral", link: "/officer/dashboard", roles: ["Ward Officer", "City Admin"] },
  { id: "s-act-off-2", title: "Review ST-2408 Priority Signal", subtitle: "Dhanmondi Lake Road complaint handoff", category: "Quick Actions", badge: "Review", badgeTone: "coral", link: "/officer/complaints/ST-2408", roles: ["Ward Officer", "City Admin"] },
  { id: "s-act-off-3", title: "Live Operations Overview", subtitle: "Monitor weekly fill signals, coverage & metrics", category: "Quick Actions", badge: "Overview", badgeTone: "blue", link: "/home", roles: ["Ward Officer", "City Admin"] },

  // City Admin & Wards
  { id: "s-wrd-1", title: "Ward 08 - Dhanmondi", subtitle: "North Dhaka zone · 12 priority bins · Active operations hub", category: "Wards & Locations", badge: "Ward 08", badgeTone: "blue", link: "/home", roles: ["City Admin"] },
  { id: "s-wrd-2", title: "Ward 11 - Mohammadpur", subtitle: "North Dhaka zone · 6 bins · Cleanliness index 82%", category: "Wards & Locations", badge: "Ward 11", badgeTone: "blue", link: "/home", roles: ["City Admin"] },
  { id: "s-wrd-3", title: "Ward 05 - Kalabagan", subtitle: "North Dhaka zone · 8 bins · Cleanliness index 79%", category: "Wards & Locations", badge: "Ward 05", badgeTone: "blue", link: "/home", roles: ["City Admin"] },
  { id: "s-act-adm-1", title: "System & Workspace Settings", subtitle: "Configure notification thresholds & sensor intervals", category: "Quick Actions", badge: "Config", badgeTone: "blue", link: "/settings", roles: ["City Admin"] },
];
