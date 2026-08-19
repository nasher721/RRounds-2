/**
 * Feature Components Export Index
 * New clinical features and enhancements
 */

// Critical Value Alerts
export { default as CriticalValueAlerts, AlertBadge, AlertPanel } from '../CriticalValueAlerts';

// Lab Trending
export { default as LabTrendingChart, LabSparkline } from '../labs/LabTrendingChart';

// Shift Handoff
export { default as ShiftHandoff } from '../ShiftHandoff';

// Protocol Checklists
export { default as ProtocolChecklist } from '../ProtocolChecklist';

// Patient Timeline
export { default as PatientTimeline } from '../PatientTimeline';

// Collaboration
export {
  default as CollaborationPresence,
  PresenceIndicator,
  UserAvatar,
  NotificationBell,
  PatientPresence,
  FieldEditingIndicator,
} from '../CollaborationPresence';

// Voice Commands
export { default as VoiceCommandPanel, FloatingVoiceButton } from '../VoiceCommandPanel';

// Analytics Dashboard
export { default as AnalyticsDashboard } from '../AnalyticsDashboard';

// Print Templates
export {
  default as PrintTemplateSelector,
  PrintTemplateSelectorCompact,
} from '../print/PrintTemplateSelector';
