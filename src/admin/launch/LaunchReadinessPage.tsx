import { AlarmClock, AlertTriangle, CheckCircle2, ClipboardCheck, Clock3, DatabaseZap, Download, FileText, Gauge, GitBranch, ListChecks, MessageSquare, Search, Send, Siren, ScrollText, ShieldCheck, UserCheck, Wrench } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { AdminSession } from '../../App'
import DataTable from '../../components/admin/DataTable'
import MetricCard from '../../components/admin/MetricCard'
import PageHeader from '../../components/admin/PageHeader'
import StatusPill from '../../components/admin/StatusPill'
import LaunchClosureEvidencePackView from './LaunchClosureEvidencePackView'
import LaunchCommunicationsApprovalView from './LaunchCommunicationsApprovalView'
import LaunchDeliveryEvidenceLedgerView from './LaunchDeliveryEvidenceLedgerView'
import LaunchAuditArchiveVaultView from './LaunchAuditArchiveVaultView'
import LaunchFinalAuditRoomView from './LaunchFinalAuditRoomView'
import LaunchRecipientResponseMonitorView from './LaunchRecipientResponseMonitorView'
import LaunchSendReviewQueueView from './LaunchSendReviewQueueView'
import { getActionExecutionConfig } from '../../lib/admin-actions/actionExecutionContract'
import { queueAdminActionRequest, runAdminAction } from '../../lib/admin-actions/actionGateway'
import { createAdminActionScope, useLocalAdminActionRequests } from '../../lib/admin-actions/actionRequests'
import { useLocalApprovalChecklistStates } from '../../lib/admin-actions/approvalEvidencePacks'
import { useLocalExecutionHandoffReadinessStates } from '../../lib/admin-actions/executionHandoffReadiness'
import { useLocalMockServerExecutions } from '../../lib/admin-actions/mockServerExecutor'
import { useLocalAuditEvents } from '../../lib/audit/auditLog'
import {
  buildLaunchEvidenceLedger,
  getLaunchEvidenceTone,
} from '../../lib/launch-readiness/launchEvidenceLedger'
import {
  buildLaunchArtifactManifest,
  getLaunchArtifactManifestTone,
  getLaunchArtifactStatusTone,
} from '../../lib/launch-readiness/launchArtifactManifest'
import {
  buildLaunchArtifactManifestHtml,
  getLaunchArtifactManifestFilename,
} from '../../lib/launch-readiness/launchArtifactManifestExport'
import {
  getLaunchHandoffDecisionTone,
  getSuggestedHandoffDecision,
  launchHandoffDecisions,
  saveLaunchHandoffApproval,
  useLaunchHandoffApprovals,
  type LaunchHandoffDecision,
} from '../../lib/launch-readiness/launchHandoffApprovals'
import {
  buildLaunchFollowUpRegister,
  getLaunchFollowUpPriorityTone,
  getLaunchFollowUpStatusTone,
  launchFollowUpStatuses,
  saveLaunchFollowUpRecord,
  useLaunchFollowUpRecords,
  type LaunchFollowUpItem,
  type LaunchFollowUpStatus,
} from '../../lib/launch-readiness/launchFollowUpRegister'
import {
  buildLaunchWatchtower,
  getLaunchWatchSignalTone,
  getLaunchWatchTone,
  saveLaunchWatchCheck,
  useLaunchWatchChecks,
} from '../../lib/launch-readiness/launchWatchtower'
import {
  buildLaunchExecutiveBrief,
  getLaunchExecutiveBriefTone,
} from '../../lib/launch-readiness/launchExecutiveBrief'
import {
  buildLaunchBackendReadinessMatrix,
  getLaunchBackendMatrixTone,
  launchBackendReadinessMatrixBoundaryRule,
  type LaunchBackendMatrixRow,
} from '../../lib/launch-readiness/launchBackendReadinessMatrix'
import {
  buildBackendImplementationWorkbench,
  getBackendImplementationPriorityTone,
  getBackendImplementationWorkTone,
  launchBackendImplementationWorkbenchBoundaryRule,
  launchBackendImplementationWorkStatuses,
  saveBackendImplementationWorkRecord,
  useBackendImplementationWorkRecords,
  type BackendImplementationWorkItem,
  type BackendImplementationWorkStatus,
} from '../../lib/launch-readiness/backendImplementationWorkbench'
import {
  backendHandlerSpecBoundaryRule,
  backendHandlerSpecStatuses,
  buildBackendHandlerSpecHtml,
  buildBackendHandlerSpecRegister,
  getBackendHandlerSpecFilename,
  getBackendHandlerSpecGateTone,
  getBackendHandlerSpecRiskTone,
  getBackendHandlerSpecStatusTone,
  saveBackendHandlerSpecReview,
  useBackendHandlerSpecReviews,
  type BackendHandlerSpec,
  type BackendHandlerSpecStatus,
} from '../../lib/launch-readiness/backendHandlerSpecs'
import {
  backendHandlerReadinessBoardBoundaryRule,
  buildBackendHandlerReadinessBoard,
  getBackendHandlerReadinessRiskTone,
  getBackendHandlerReadinessTone,
  type BackendHandlerReadinessCard,
} from '../../lib/launch-readiness/backendHandlerReadinessBoard'
import {
  backendEngineeringHandoffPacketBoundaryRule,
  backendEngineeringHandoffPacketStatuses,
  buildBackendEngineeringHandoffPacketHtml,
  buildBackendEngineeringHandoffRegister,
  getBackendEngineeringChecklistTone,
  getBackendEngineeringHandoffPacketFilename,
  getBackendEngineeringHandoffPacketRiskTone,
  getBackendEngineeringHandoffPacketTone,
  saveBackendEngineeringHandoffPacketReview,
  useBackendEngineeringHandoffPacketReviews,
  type BackendEngineeringHandoffPacket,
  type BackendEngineeringHandoffPacketStatus,
} from '../../lib/launch-readiness/backendEngineeringHandoffPackets'
import {
  backendServerHandlerTestMatrixBoundaryRule,
  backendServerHandlerTestMatrixStatuses,
  buildBackendServerHandlerTestMatrix,
  buildBackendServerHandlerTestMatrixHtml,
  getBackendServerHandlerTestMatrixFilename,
  getBackendServerHandlerTestRiskTone,
  getBackendServerHandlerTestTone,
  saveBackendServerHandlerTestRecord,
  useBackendServerHandlerTestRecords,
  type BackendServerHandlerTestMatrixStatus,
  type BackendServerHandlerTestRow,
} from '../../lib/launch-readiness/backendServerHandlerTestMatrix'
import {
  backendServerTestEvidencePackBoundaryRule,
  backendServerTestEvidencePackStatuses,
  buildBackendServerTestEvidencePackHtml,
  buildBackendServerTestEvidencePackRegister,
  getBackendServerTestEvidenceItemTone,
  getBackendServerTestEvidencePackFilename,
  getBackendServerTestEvidencePackTone,
  getBackendServerTestEvidenceRiskTone,
  saveBackendServerTestEvidencePackRecord,
  useBackendServerTestEvidencePackRecords,
  type BackendServerTestEvidencePack,
  type BackendServerTestEvidencePackStatus,
} from '../../lib/launch-readiness/backendServerTestEvidencePacks'
import {
  backendExecutionReadinessBoundaryRule,
  backendExecutionReadinessStatuses,
  buildBackendExecutionReadinessDashboard,
  buildBackendExecutionReadinessHtml,
  getBackendExecutionReadinessCheckTone,
  getBackendExecutionReadinessFilename,
  getBackendExecutionReadinessRiskTone,
  getBackendExecutionReadinessTone,
  saveBackendExecutionReadinessRecord,
  useBackendExecutionReadinessRecords,
  type BackendExecutionReadinessRow,
  type BackendExecutionReadinessStatus,
} from '../../lib/launch-readiness/backendExecutionReadinessDashboard'
import {
  buildTrustedHandlerDeploymentChecklist,
  buildTrustedHandlerDeploymentHtml,
  getTrustedHandlerDeploymentCheckTone,
  getTrustedHandlerDeploymentFilename,
  getTrustedHandlerDeploymentRiskTone,
  getTrustedHandlerDeploymentTone,
  saveTrustedHandlerDeploymentRecord,
  trustedHandlerDeploymentBoundaryRule,
  trustedHandlerDeploymentStatuses,
  useTrustedHandlerDeploymentRecords,
  type TrustedHandlerDeploymentItem,
  type TrustedHandlerDeploymentStatus,
} from '../../lib/launch-readiness/trustedHandlerDeploymentChecklist'
import {
  backendReleaseCommandBoundaryRule,
  backendReleaseCommandStatuses,
  buildBackendReleaseCommandCenter,
  buildBackendReleaseCommandHtml,
  getBackendReleaseCommandCheckTone,
  getBackendReleaseCommandFilename,
  getBackendReleaseCommandRiskTone,
  getBackendReleaseCommandTone,
  saveBackendReleaseCommandRecord,
  useBackendReleaseCommandRecords,
  type BackendReleaseCommandItem,
  type BackendReleaseCommandStatus,
} from '../../lib/launch-readiness/backendReleaseCommandCenter'
import {
  backendWatchMonitorBoundaryRule,
  backendWatchMonitorStatuses,
  buildBackendWatchHtml,
  buildBackendWatchMonitor,
  getBackendWatchFilename,
  getBackendWatchMonitorTone,
  getBackendWatchRiskTone,
  getBackendWatchSignalTone,
  saveBackendWatchRecord,
  useBackendWatchRecords,
  type BackendWatchItem,
  type BackendWatchMonitorStatus,
} from '../../lib/launch-readiness/backendWatchMonitor'
import {
  backendClosureEvidenceBoundaryRule,
  backendClosureEvidenceStatuses,
  buildBackendClosureEvidenceBinder,
  buildBackendClosureEvidenceHtml,
  getBackendClosureEvidenceCheckTone,
  getBackendClosureEvidenceFilename,
  getBackendClosureEvidenceRiskTone,
  getBackendClosureEvidenceTone,
  saveBackendClosureEvidenceRecord,
  useBackendClosureEvidenceRecords,
  type BackendClosureEvidenceItem,
  type BackendClosureEvidenceStatus,
} from '../../lib/launch-readiness/backendClosureEvidenceBinder'
import {
  buildProductionGuardrailHtml,
  buildProductionGuardrailMatrix,
  getProductionGuardrailCheckTone,
  getProductionGuardrailFilename,
  getProductionGuardrailRiskTone,
  getProductionGuardrailTone,
  productionGuardrailBoundaryRule,
  productionGuardrailStatuses,
  saveProductionGuardrailRecord,
  useProductionGuardrailRecords,
  type ProductionGuardrailItem,
  type ProductionGuardrailStatus,
} from '../../lib/launch-readiness/productionGuardrailMatrix'
import {
  buildExecutiveGoNoGoHtml,
  buildExecutiveGoNoGoRoom,
  executiveGoNoGoBoundaryRule,
  executiveGoNoGoDecisions,
  getExecutiveGoNoGoFilename,
  getExecutiveGoNoGoTone,
  saveExecutiveGoNoGoRecord,
  useExecutiveGoNoGoRecords,
  type ExecutiveGoNoGoDecision,
} from '../../lib/launch-readiness/executiveGoNoGoRoom'
import {
  buildLaunchWarRoomTimeline,
  buildLaunchWarRoomTimelineHtml,
  getLaunchWarRoomMetricTone,
  getLaunchWarRoomTimelineFilename,
  getLaunchWarRoomTone,
  launchWarRoomBoundaryRule,
  saveLaunchWarRoomPulse,
  useLaunchWarRoomPulses,
} from '../../lib/launch-readiness/launchWarRoomTimeline'
import {
  buildLaunchCommandSavedViewHtml,
  buildLaunchCommandSavedViews,
  getLaunchCommandSavedViewFilename,
  getLaunchCommandSavedViewTone,
  launchCommandSavedViewBoundaryRule,
  saveLaunchCommandSavedViewRecord,
  useLaunchCommandSavedViewRecords,
  type LaunchCommandSavedView,
  type LaunchCommandSavedViewSurface,
} from '../../lib/launch-readiness/launchCommandSavedViews'
import {
  buildLaunchExceptionSlaBoard,
  buildLaunchExceptionSlaHtml,
  formatLaunchSlaDuration,
  formatLaunchSlaRemaining,
  getLaunchExceptionSlaFilename,
  getLaunchExceptionSlaLevelTone,
  getLaunchExceptionSlaReviewTone,
  getLaunchExceptionSlaStatusTone,
  launchExceptionSlaBoundaryRule,
  saveLaunchExceptionSlaRecord,
  useLaunchExceptionSlaRecords,
  type LaunchExceptionSlaItem,
  type LaunchExceptionSlaReviewStatus,
  type LaunchExceptionSlaStatus,
} from '../../lib/launch-readiness/launchExceptionSlaBoard'
import {
  buildLaunchOwnerDailyBrief,
  buildLaunchOwnerDailyBriefHtml,
  getLaunchOwnerDailyBriefFilename,
  getLaunchOwnerDailyBriefStatusTone,
  launchOwnerDailyBriefBoundaryRule,
  saveLaunchOwnerDailyBriefRecord,
  useLaunchOwnerDailyBriefRecords,
  type LaunchOwnerDailyBrief,
  type LaunchOwnerDailyBriefDecision,
  type LaunchOwnerDailyBriefDecisionStatus,
} from '../../lib/launch-readiness/launchOwnerDailyBrief'
import {
  buildLaunchEvidencePacketAssembler,
  buildLaunchEvidencePacketHtml,
  getLaunchEvidencePacketFilename,
  getLaunchEvidencePacketItemTone,
  getLaunchEvidencePacketStatusTone,
  launchEvidencePacketBoundaryRule,
  saveLaunchEvidencePacketRecord,
  useLaunchEvidencePacketRecords,
  type LaunchEvidencePacket,
  type LaunchEvidencePacketItem,
  type LaunchEvidencePacketItemStatus,
  type LaunchEvidencePacketSurface,
} from '../../lib/launch-readiness/launchEvidencePacketAssembler'
import {
  buildLaunchPostLaunchWatchtower,
  buildLaunchPostLaunchWatchtowerHtml,
  getLaunchPostLaunchWatchtowerFilename,
  getLaunchPostLaunchWatchtowerMetricTone,
  getLaunchPostLaunchWatchtowerTone,
  launchPostLaunchWatchtowerBoundaryRule,
  saveLaunchPostLaunchWatchtowerRecord,
  useLaunchPostLaunchWatchtowerRecords,
  type LaunchPostLaunchSignal,
  type LaunchPostLaunchSignalStatus,
  type LaunchPostLaunchSurface,
  type LaunchPostLaunchWatchtower,
} from '../../lib/launch-readiness/launchPostLaunchWatchtower'
import {
  buildLaunchPostLaunchIncidentCommander,
  buildLaunchPostLaunchIncidentHtml,
  getLaunchPostLaunchIncidentFilename,
  getLaunchPostLaunchIncidentMetricTone,
  getLaunchPostLaunchIncidentSeverityTone,
  getLaunchPostLaunchIncidentStatusTone,
  getLaunchPostLaunchIncidentStepTone,
  launchPostLaunchIncidentBoundaryRule,
  saveLaunchPostLaunchIncidentRecord,
  useLaunchPostLaunchIncidentRecords,
  type LaunchPostLaunchIncidentCommander,
  type LaunchPostLaunchIncidentPacket,
  type LaunchPostLaunchIncidentSeverity,
  type LaunchPostLaunchIncidentStatus,
} from '../../lib/launch-readiness/launchPostLaunchIncidentCommander'
import {
  buildLaunchCommsApprovalCenter,
  buildLaunchCommsApprovalHtml,
  getLaunchCommsApprovalFilename,
  saveLaunchCommsApprovalRecord,
  useLaunchCommsApprovalRecords,
  type LaunchCommsApprovalCenter,
  type LaunchCommsApprovalDraft,
  type LaunchCommsApprovalStatus,
} from '../../lib/launch-readiness/launchCommunicationsApprovalCenter'
import {
  buildLaunchSendReviewHtml,
  buildLaunchSendReviewQueue,
  getLaunchSendReviewFilename,
  saveLaunchSendReviewRecord,
  useLaunchSendReviewRecords,
  type LaunchSendReviewItem,
  type LaunchSendReviewItemStatus,
  type LaunchSendReviewQueue,
} from '../../lib/launch-readiness/launchSendReviewQueue'
import {
  buildLaunchDeliveryEvidenceHtml,
  buildLaunchDeliveryEvidenceLedger,
  getLaunchDeliveryEvidenceFilename,
  saveLaunchDeliveryEvidenceRecord,
  useLaunchDeliveryEvidenceRecords,
  type LaunchDeliveryEvidenceItem,
  type LaunchDeliveryEvidenceItemStatus,
  type LaunchDeliveryEvidenceLedger,
} from '../../lib/launch-readiness/launchDeliveryEvidenceLedger'
import {
  buildLaunchRecipientResponseHtml,
  buildLaunchRecipientResponseMonitor,
  getLaunchRecipientResponseFilename,
  saveLaunchRecipientResponseRecord,
  useLaunchRecipientResponseRecords,
  type LaunchRecipientResponseItem,
  type LaunchRecipientResponseItemStatus,
  type LaunchRecipientResponseMonitor,
} from '../../lib/launch-readiness/launchRecipientResponseMonitor'
import {
  buildLaunchClosureEvidenceHtml,
  buildLaunchClosureEvidencePack,
  getLaunchClosureEvidenceFilename,
  saveLaunchClosureEvidenceRecord,
  useLaunchClosureEvidenceRecords,
  type LaunchClosureEvidenceItem,
  type LaunchClosureEvidenceItemStatus,
  type LaunchClosureEvidencePack,
} from '../../lib/launch-readiness/launchClosureEvidencePack'
import {
  buildLaunchFinalAuditHtml,
  buildLaunchFinalAuditRoom,
  getLaunchFinalAuditFilename,
  saveLaunchFinalAuditRecord,
  useLaunchFinalAuditRecords,
  type LaunchFinalAuditItem,
  type LaunchFinalAuditItemStatus,
  type LaunchFinalAuditRoom,
} from '../../lib/launch-readiness/launchFinalAuditRoom'
import {
  buildLaunchAuditArchiveHtml,
  buildLaunchAuditArchiveVault,
  getLaunchAuditArchiveFilename,
  saveLaunchAuditArchiveRecord,
  useLaunchAuditArchiveRecords,
  type LaunchAuditArchiveItem,
  type LaunchAuditArchiveItemStatus,
  type LaunchAuditArchiveVault,
} from '../../lib/launch-readiness/launchAuditArchiveVault'
import {
  buildLaunchExecutiveBriefHtml,
  getLaunchExecutiveBriefFilename,
} from '../../lib/launch-readiness/launchExecutiveBriefExport'
import {
  buildLaunchCommandMode,
  getLaunchCommandItemTone,
  type LaunchCommandItem,
} from '../../lib/launch-readiness/launchCommandMode'
import {
  buildLaunchClosureChecklist,
  getLaunchClosureDecisionTone,
  getLaunchClosureItemTone,
} from '../../lib/launch-readiness/launchClosureChecklist'
import {
  buildLaunchClosureSnapshotHtml,
  getLaunchClosureSnapshotFilename,
} from '../../lib/launch-readiness/launchClosureSnapshotExport'
import {
  saveLaunchClosureSnapshot,
  useLaunchClosureSnapshots,
  type LaunchClosureSnapshot,
} from '../../lib/launch-readiness/launchClosureSnapshots'
import {
  getLatestPacketByCommandItem,
  getLaunchDecisionPacketStatusTone,
  reviewLaunchDecisionPacket,
  saveLaunchDecisionPacket,
  useLaunchDecisionPackets,
  type LaunchDecisionPacket,
  type LaunchDecisionPacketReviewStatus,
  type LaunchDecisionPacketStatus,
} from '../../lib/launch-readiness/launchDecisionPackets'
import {
  buildLaunchDecisionPacketHtml,
  getLaunchDecisionPacketFilename,
} from '../../lib/launch-readiness/launchDecisionPacketExport'
import {
  buildLaunchReadinessModel,
  getLaunchGateTone,
  getLaunchSeverityTone,
  type LaunchGate,
  type LaunchGateArea,
} from '../../lib/launch-readiness/launchReadiness'
import {
  buildLaunchReviewReportHtml,
  getLaunchReviewReportFilename,
} from '../../lib/launch-readiness/launchReviewReport'
import {
  getLatestSignOffByGate,
  getLaunchSignOffDecisionTone,
  launchSignOffDecisions,
  launchSignOffOwners,
  saveLaunchGateSignOff,
  useLaunchGateSignOffs,
  type LaunchSignOffDecision,
} from '../../lib/launch-readiness/launchSignOffs'
import { usePlatformData } from '../../lib/platform-data/PlatformDataContext'
import { hasPermission, roleLabels } from '../../lib/permissions/permissions'

interface LaunchReadinessPageProps {
  session: AdminSession
  onOpenActionRequests: () => void
}

const areaFilters: Array<'All' | LaunchGateArea> = ['All', 'Data', 'Security', 'Operations', 'Support', 'Finance', 'Agents', 'Integrations']
type LaunchViewMode = 'command' | 'matrix' | 'implementation' | 'specs' | 'readiness' | 'engHandoff' | 'testMatrix' | 'testEvidence' | 'executionReady' | 'deployChecklist' | 'releaseCommand' | 'backendWatch' | 'backendClosure' | 'productionGuardrails' | 'goNoGo' | 'warRoom' | 'savedViews' | 'exceptionSla' | 'ownerBrief' | 'evidencePacket' | 'postLaunch' | 'incidentCommand' | 'communications' | 'sendReview' | 'deliveryEvidence' | 'recipientResponse' | 'closurePack' | 'finalAudit' | 'auditArchive' | 'closure' | 'brief' | 'manifest' | 'approval' | 'followup' | 'watch' | 'detail'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function LaunchReadinessPage({ session, onOpenActionRequests }: LaunchReadinessPageProps) {
  const { data, dataSourceKind, status, sourceLabel, readViewDiagnostics } = usePlatformData()
  const localRequests = useLocalAdminActionRequests()
  const localAuditEvents = useLocalAuditEvents()
  const localMockServerExecutions = useLocalMockServerExecutions()
  const [localApprovalStates] = useLocalApprovalChecklistStates()
  const [localHandoffReadinessStates] = useLocalExecutionHandoffReadinessStates()
  const signOffs = useLaunchGateSignOffs()
  const decisionPackets = useLaunchDecisionPackets()
  const closureSnapshots = useLaunchClosureSnapshots()
  const handoffApprovals = useLaunchHandoffApprovals()
  const followUpRecords = useLaunchFollowUpRecords()
  const watchChecks = useLaunchWatchChecks()
  const backendImplementationRecords = useBackendImplementationWorkRecords()
  const backendHandlerSpecReviews = useBackendHandlerSpecReviews()
  const engineeringHandoffPacketReviews = useBackendEngineeringHandoffPacketReviews()
  const serverHandlerTestRecords = useBackendServerHandlerTestRecords()
  const serverTestEvidencePackRecords = useBackendServerTestEvidencePackRecords()
  const backendExecutionReadinessRecords = useBackendExecutionReadinessRecords()
  const trustedHandlerDeploymentRecords = useTrustedHandlerDeploymentRecords()
  const backendReleaseCommandRecords = useBackendReleaseCommandRecords()
  const backendWatchRecords = useBackendWatchRecords()
  const backendClosureEvidenceRecords = useBackendClosureEvidenceRecords()
  const productionGuardrailRecords = useProductionGuardrailRecords()
  const executiveGoNoGoRecords = useExecutiveGoNoGoRecords()
  const launchWarRoomPulseRecords = useLaunchWarRoomPulses()
  const launchSavedViewRecords = useLaunchCommandSavedViewRecords()
  const launchExceptionSlaRecords = useLaunchExceptionSlaRecords()
  const launchOwnerDailyBriefRecords = useLaunchOwnerDailyBriefRecords()
  const launchEvidencePacketRecords = useLaunchEvidencePacketRecords()
  const launchPostLaunchWatchtowerRecords = useLaunchPostLaunchWatchtowerRecords()
  const launchPostLaunchIncidentRecords = useLaunchPostLaunchIncidentRecords()
  const launchCommsApprovalRecords = useLaunchCommsApprovalRecords()
  const launchSendReviewRecords = useLaunchSendReviewRecords()
  const launchDeliveryEvidenceRecords = useLaunchDeliveryEvidenceRecords()
  const launchRecipientResponseRecords = useLaunchRecipientResponseRecords()
  const launchClosureEvidenceRecords = useLaunchClosureEvidenceRecords()
  const launchFinalAuditRecords = useLaunchFinalAuditRecords()
  const launchAuditArchiveRecords = useLaunchAuditArchiveRecords()
  const [selectedArea, setSelectedArea] = useState<'All' | LaunchGateArea>('All')
  const [selectedId, setSelectedId] = useState('')
  const [selectedMatrixId, setSelectedMatrixId] = useState('')
  const [selectedImplementationId, setSelectedImplementationId] = useState('')
  const [selectedHandlerSpecId, setSelectedHandlerSpecId] = useState('')
  const [selectedReadinessCardId, setSelectedReadinessCardId] = useState('')
  const [selectedEngineeringPacketId, setSelectedEngineeringPacketId] = useState('')
  const [selectedServerTestRowId, setSelectedServerTestRowId] = useState('')
  const [selectedServerEvidencePackId, setSelectedServerEvidencePackId] = useState('')
  const [selectedExecutionReadinessRowId, setSelectedExecutionReadinessRowId] = useState('')
  const [selectedTrustedDeploymentItemId, setSelectedTrustedDeploymentItemId] = useState('')
  const [selectedReleaseCommandItemId, setSelectedReleaseCommandItemId] = useState('')
  const [selectedBackendWatchItemId, setSelectedBackendWatchItemId] = useState('')
  const [selectedBackendClosureItemId, setSelectedBackendClosureItemId] = useState('')
  const [selectedProductionGuardrailItemId, setSelectedProductionGuardrailItemId] = useState('')
  const [selectedExecutiveGoNoGoItemId, setSelectedExecutiveGoNoGoItemId] = useState('')
  const [selectedWarRoomEventId, setSelectedWarRoomEventId] = useState('')
  const [selectedSavedViewId, setSelectedSavedViewId] = useState('')
  const [selectedExceptionSlaItemId, setSelectedExceptionSlaItemId] = useState('')
  const [selectedOwnerBriefDecisionId, setSelectedOwnerBriefDecisionId] = useState('')
  const [selectedEvidencePacketItemId, setSelectedEvidencePacketItemId] = useState('')
  const [selectedPostLaunchSignalId, setSelectedPostLaunchSignalId] = useState('')
  const [selectedPostLaunchIncidentId, setSelectedPostLaunchIncidentId] = useState('')
  const [selectedLaunchCommsDraftId, setSelectedLaunchCommsDraftId] = useState('')
  const [selectedLaunchSendReviewItemId, setSelectedLaunchSendReviewItemId] = useState('')
  const [selectedLaunchDeliveryEvidenceItemId, setSelectedLaunchDeliveryEvidenceItemId] = useState('')
  const [selectedLaunchRecipientResponseItemId, setSelectedLaunchRecipientResponseItemId] = useState('')
  const [selectedLaunchClosureEvidenceItemId, setSelectedLaunchClosureEvidenceItemId] = useState('')
  const [selectedLaunchFinalAuditItemId, setSelectedLaunchFinalAuditItemId] = useState('')
  const [selectedLaunchAuditArchiveItemId, setSelectedLaunchAuditArchiveItemId] = useState('')
  const [exceptionSlaOwnerFilter, setExceptionSlaOwnerFilter] = useState('All')
  const [notice, setNotice] = useState('')
  const [signOffDecision, setSignOffDecision] = useState<LaunchSignOffDecision>('Assigned')
  const [signOffOwner, setSignOffOwner] = useState('Owner')
  const [signOffNote, setSignOffNote] = useState('')
  const [handoffDecision, setHandoffDecision] = useState<LaunchHandoffDecision>('Held')
  const [handoffOwner, setHandoffOwner] = useState('Owner')
  const [handoffConditionNote, setHandoffConditionNote] = useState('')
  const [handoffAcceptedRisk, setHandoffAcceptedRisk] = useState('')
  const [selectedFollowUpId, setSelectedFollowUpId] = useState('')
  const [followUpStatus, setFollowUpStatus] = useState<LaunchFollowUpStatus>('Open')
  const [followUpOwner, setFollowUpOwner] = useState('Owner')
  const [followUpNote, setFollowUpNote] = useState('')
  const [implementationStatus, setImplementationStatus] = useState<BackendImplementationWorkStatus>('Planning')
  const [implementationOwner, setImplementationOwner] = useState('Engineering')
  const [implementationNote, setImplementationNote] = useState('')
  const [handlerSpecStatus, setHandlerSpecStatus] = useState<BackendHandlerSpecStatus>('Draft')
  const [handlerSpecOwner, setHandlerSpecOwner] = useState('Engineering')
  const [handlerSpecNote, setHandlerSpecNote] = useState('')
  const [engineeringPacketStatus, setEngineeringPacketStatus] = useState<BackendEngineeringHandoffPacketStatus>('Draft')
  const [engineeringPacketOwner, setEngineeringPacketOwner] = useState('Engineering')
  const [engineeringPacketNote, setEngineeringPacketNote] = useState('')
  const [serverTestStatus, setServerTestStatus] = useState<BackendServerHandlerTestMatrixStatus>('Review')
  const [serverTestOwner, setServerTestOwner] = useState('Engineering')
  const [serverTestNote, setServerTestNote] = useState('')
  const [serverEvidenceStatus, setServerEvidenceStatus] = useState<BackendServerTestEvidencePackStatus>('Evidence Review')
  const [serverEvidenceOwner, setServerEvidenceOwner] = useState('Engineering')
  const [serverEvidenceLocation, setServerEvidenceLocation] = useState('')
  const [serverEvidenceNote, setServerEvidenceNote] = useState('')
  const [executionReadinessStatus, setExecutionReadinessStatus] = useState<BackendExecutionReadinessStatus>('Review Only')
  const [executionReadinessOwner, setExecutionReadinessOwner] = useState('Engineering')
  const [executionReadinessNote, setExecutionReadinessNote] = useState('')
  const [trustedDeploymentStatus, setTrustedDeploymentStatus] = useState<TrustedHandlerDeploymentStatus>('Needs Build Plan')
  const [trustedDeploymentOwner, setTrustedDeploymentOwner] = useState('Engineering')
  const [trustedDeploymentNote, setTrustedDeploymentNote] = useState('')
  const [releaseCommandStatus, setReleaseCommandStatus] = useState<BackendReleaseCommandStatus>('Build Planning')
  const [releaseCommandOwner, setReleaseCommandOwner] = useState('Engineering')
  const [releaseCommandWindow, setReleaseCommandWindow] = useState('')
  const [releaseCommandNote, setReleaseCommandNote] = useState('')
  const [backendWatchStatus, setBackendWatchStatus] = useState<BackendWatchMonitorStatus>('Watch')
  const [backendWatchOwner, setBackendWatchOwner] = useState('Engineering')
  const [backendWatchNote, setBackendWatchNote] = useState('')
  const [backendClosureStatus, setBackendClosureStatus] = useState<BackendClosureEvidenceStatus>('Evidence Review')
  const [backendClosureOwner, setBackendClosureOwner] = useState('Engineering')
  const [backendClosurePacketLocation, setBackendClosurePacketLocation] = useState('')
  const [backendClosureNote, setBackendClosureNote] = useState('')
  const [productionGuardrailStatus, setProductionGuardrailStatus] = useState<ProductionGuardrailStatus>('Guardrail Review')
  const [productionGuardrailOwner, setProductionGuardrailOwner] = useState('Engineering')
  const [productionGuardrailNote, setProductionGuardrailNote] = useState('')
  const [executiveGoNoGoDecision, setExecutiveGoNoGoDecision] = useState<ExecutiveGoNoGoDecision>('No Go')
  const [executiveGoNoGoOwner, setExecutiveGoNoGoOwner] = useState('Owner')
  const [executiveGoNoGoConditionNote, setExecutiveGoNoGoConditionNote] = useState('')
  const [executiveGoNoGoAcceptedRisk, setExecutiveGoNoGoAcceptedRisk] = useState('')
  const [viewMode, setViewMode] = useState<LaunchViewMode>('command')
  const [selectedPacketId, setSelectedPacketId] = useState('')
  const [packetReviewOwner, setPacketReviewOwner] = useState('Owner')
  const [packetReviewNote, setPacketReviewNote] = useState('')
  const canRecordReview = hasPermission(session.role, 'settings.view')
  const canSignOff = hasPermission(session.role, 'settings.manage')
  const canExport = hasPermission(session.role, 'reports.export')
  const canQueueAction = hasPermission(session.role, 'admin_actions.manage')
  const canReviewPackets = hasPermission(session.role, 'admin_actions.manage')
  const canManageFollowUps = hasPermission(session.role, 'admin_actions.manage')
  const canManageImplementation = hasPermission(session.role, 'admin_actions.manage')
  const canReviewHandlerSpecs = hasPermission(session.role, 'admin_actions.manage')
  const canReviewHandlerReadiness = hasPermission(session.role, 'admin_actions.manage')
  const canManageEngineeringHandoff = hasPermission(session.role, 'admin_actions.manage')
  const canManageServerHandlerTests = hasPermission(session.role, 'admin_actions.manage')
  const canManageServerTestEvidence = hasPermission(session.role, 'admin_actions.manage')
  const canManageExecutionReadiness = hasPermission(session.role, 'admin_actions.manage')
  const canManageTrustedDeployment = hasPermission(session.role, 'admin_actions.manage')
  const canManageReleaseCommand = hasPermission(session.role, 'admin_actions.manage')
  const canManageBackendWatch = hasPermission(session.role, 'admin_actions.manage')
  const canManageBackendClosure = hasPermission(session.role, 'admin_actions.manage')
  const canManageProductionGuardrails = hasPermission(session.role, 'admin_actions.manage')
  const canRecordExecutiveGoNoGo = hasPermission(session.role, 'settings.manage')
  const canRecordWarRoomPulse = hasPermission(session.role, 'settings.view')
  const canViewSavedViews = hasPermission(session.role, 'saved_views.view')
  const canSaveLaunchSavedViews = hasPermission(session.role, 'saved_views.manage')
  const canReviewLaunchSla = hasPermission(session.role, 'notifications.manage')
  const actionRequests = useMemo(() => [
    ...localRequests,
    ...data.adminActionRequests.filter(request => !localRequests.some(localRequest => localRequest.id === request.id)),
  ], [data.adminActionRequests, localRequests])
  const auditEvents = useMemo(() => [
    ...localAuditEvents,
    ...data.auditEvents.filter(event => !localAuditEvents.some(localEvent => localEvent.id === event.id)),
  ], [data.auditEvents, localAuditEvents])
  const executionConfig = getActionExecutionConfig(import.meta.env)

  const model = useMemo(() => buildLaunchReadinessModel({
    data,
    dataSourceKind,
    status,
    readViewDiagnostics,
    actionRequests,
  }), [actionRequests, data, dataSourceKind, readViewDiagnostics, status])
  const evidenceLedger = useMemo(() => buildLaunchEvidenceLedger({
    model,
    auditEvents,
    actionRequests,
    readViewDiagnostics,
    signOffs,
    decisionPackets,
  }), [actionRequests, auditEvents, decisionPackets, model, readViewDiagnostics, signOffs])
  const latestSignOffByGate = useMemo(() => getLatestSignOffByGate(signOffs), [signOffs])
  const latestPacketByCommandItem = useMemo(() => getLatestPacketByCommandItem(decisionPackets), [decisionPackets])
  const selectedPacket = useMemo(() => (
    decisionPackets.find(packet => packet.id === selectedPacketId) ?? decisionPackets[0]
  ), [decisionPackets, selectedPacketId])
  const packetOwnerOptions = useMemo(() => Array.from(new Set([
    ...launchSignOffOwners,
    ...decisionPackets.map(packet => packet.owner),
    ...decisionPackets.map(packet => packet.followUpOwner).filter((owner): owner is string => Boolean(owner)),
  ])), [decisionPackets])
  const latestClosureSnapshot = closureSnapshots[0]
  const latestHandoffApproval = handoffApprovals[0]
  const latestWatchCheck = watchChecks[0]
  const commandMode = useMemo(() => buildLaunchCommandMode({
    gates: model.gates,
    actionRequests,
    signOffsByGate: latestSignOffByGate,
    generatedAt: model.generatedAt,
  }), [actionRequests, latestSignOffByGate, model.generatedAt, model.gates])
  const closureModel = useMemo(() => buildLaunchClosureChecklist({
    model,
    evidenceLedger,
    actionRequests,
    readViewDiagnostics,
    signOffs,
    decisionPackets,
    dataSourceKind,
    dataStatus: status,
  }), [actionRequests, dataSourceKind, decisionPackets, evidenceLedger, model, readViewDiagnostics, signOffs, status])
  const executiveBrief = useMemo(() => buildLaunchExecutiveBrief({
    readinessModel: model,
    closureModel,
    commandMode,
    evidenceLedger,
    decisionPackets,
    closureSnapshots,
    signOffs,
    sourceLabel,
    dataStatus: status,
  }), [closureModel, closureSnapshots, commandMode, decisionPackets, evidenceLedger, model, signOffs, sourceLabel, status])
  const artifactManifest = useMemo(() => buildLaunchArtifactManifest({
    readinessModel: model,
    closureModel,
    commandMode,
    evidenceLedger,
    executiveBrief,
    decisionPackets,
    closureSnapshots,
    signOffs,
    actionRequests,
    readViewDiagnostics,
    sourceLabel,
    dataSourceKind,
    dataStatus: status,
  }), [actionRequests, closureModel, closureSnapshots, commandMode, dataSourceKind, decisionPackets, evidenceLedger, executiveBrief, model, readViewDiagnostics, signOffs, sourceLabel, status])
  const followUpRegister = useMemo(() => buildLaunchFollowUpRegister({
    manifest: artifactManifest,
    latestHandoffApproval,
    actionRequests,
    closureModel,
    readViewDiagnostics,
    records: followUpRecords,
  }), [actionRequests, artifactManifest, closureModel, followUpRecords, latestHandoffApproval, readViewDiagnostics])
  const selectedFollowUp = useMemo(() => (
    followUpRegister.items.find(item => item.id === selectedFollowUpId) ?? followUpRegister.nextItem ?? followUpRegister.items[0]
  ), [followUpRegister.items, followUpRegister.nextItem, selectedFollowUpId])
  const followUpOwnerOptions = useMemo(() => Array.from(new Set([
    ...launchSignOffOwners,
    ...followUpRegister.items.map(item => item.owner),
  ])), [followUpRegister.items])
  const watchtower = useMemo(() => buildLaunchWatchtower({
    readinessModel: model,
    manifest: artifactManifest,
    followUpRegister,
    latestHandoffApproval,
    actionRequests,
    readViewDiagnostics,
  }), [actionRequests, artifactManifest, followUpRegister, latestHandoffApproval, model, readViewDiagnostics])
  const backendMatrix = useMemo(() => buildLaunchBackendReadinessMatrix({
    data,
    actionRequests,
    auditEvents,
    mockServerExecutions: localMockServerExecutions,
    approvalStates: localApprovalStates,
    handoffReadinessStates: localHandoffReadinessStates,
    executionConfig,
  }), [actionRequests, auditEvents, data, executionConfig, localApprovalStates, localHandoffReadinessStates, localMockServerExecutions])
  const backendImplementationWorkbench = useMemo(() => buildBackendImplementationWorkbench({
    matrix: backendMatrix,
    records: backendImplementationRecords,
  }), [backendImplementationRecords, backendMatrix])
  const backendHandlerSpecRegister = useMemo(() => buildBackendHandlerSpecRegister({
    workbench: backendImplementationWorkbench,
    reviews: backendHandlerSpecReviews,
  }), [backendHandlerSpecReviews, backendImplementationWorkbench])
  const backendHandlerReadinessBoard = useMemo(() => buildBackendHandlerReadinessBoard({
    specRegister: backendHandlerSpecRegister,
  }), [backendHandlerSpecRegister])
  const backendEngineeringHandoffRegister = useMemo(() => buildBackendEngineeringHandoffRegister({
    specRegister: backendHandlerSpecRegister,
    readinessBoard: backendHandlerReadinessBoard,
    reviews: engineeringHandoffPacketReviews,
  }), [backendHandlerReadinessBoard, backendHandlerSpecRegister, engineeringHandoffPacketReviews])
  const backendServerHandlerTestMatrix = useMemo(() => buildBackendServerHandlerTestMatrix({
    handoffRegister: backendEngineeringHandoffRegister,
    records: serverHandlerTestRecords,
  }), [backendEngineeringHandoffRegister, serverHandlerTestRecords])
  const backendServerTestEvidencePackRegister = useMemo(() => buildBackendServerTestEvidencePackRegister({
    matrix: backendServerHandlerTestMatrix,
    records: serverTestEvidencePackRecords,
  }), [backendServerHandlerTestMatrix, serverTestEvidencePackRecords])
  const backendExecutionReadinessDashboard = useMemo(() => buildBackendExecutionReadinessDashboard({
    evidenceRegister: backendServerTestEvidencePackRegister,
    actionRequests,
    mockServerExecutions: localMockServerExecutions,
    auditEvents,
    executionConfig,
    records: backendExecutionReadinessRecords,
  }), [actionRequests, auditEvents, backendExecutionReadinessRecords, backendServerTestEvidencePackRegister, executionConfig, localMockServerExecutions])
  const trustedHandlerDeploymentChecklist = useMemo(() => buildTrustedHandlerDeploymentChecklist({
    executionDashboard: backendExecutionReadinessDashboard,
    actionRequests,
    records: trustedHandlerDeploymentRecords,
  }), [actionRequests, backendExecutionReadinessDashboard, trustedHandlerDeploymentRecords])
  const backendReleaseCommandCenter = useMemo(() => buildBackendReleaseCommandCenter({
    deploymentChecklist: trustedHandlerDeploymentChecklist,
    actionRequests,
    records: backendReleaseCommandRecords,
  }), [actionRequests, backendReleaseCommandRecords, trustedHandlerDeploymentChecklist])
  const backendWatchMonitor = useMemo(() => buildBackendWatchMonitor({
    releaseCommandCenter: backendReleaseCommandCenter,
    actionRequests,
    auditEvents,
    mockServerExecutions: localMockServerExecutions,
    records: backendWatchRecords,
  }), [actionRequests, auditEvents, backendReleaseCommandCenter, backendWatchRecords, localMockServerExecutions])
  const backendClosureEvidenceBinder = useMemo(() => buildBackendClosureEvidenceBinder({
    watchMonitor: backendWatchMonitor,
    records: backendClosureEvidenceRecords,
  }), [backendClosureEvidenceRecords, backendWatchMonitor])
  const productionGuardrailMatrix = useMemo(() => buildProductionGuardrailMatrix({
    closureBinder: backendClosureEvidenceBinder,
    records: productionGuardrailRecords,
  }), [backendClosureEvidenceBinder, productionGuardrailRecords])
  const executiveGoNoGoRoom = useMemo(() => buildExecutiveGoNoGoRoom({
    readinessModel: model,
    closureModel,
    executiveBrief,
    artifactManifest,
    latestHandoffApproval,
    followUpRegister,
    watchtower,
    backendClosureEvidenceBinder,
    productionGuardrailMatrix,
    evidenceLedger,
    actionRequests,
    readViewDiagnostics,
    sourceLabel,
    dataSourceKind,
    dataStatus: status,
    records: executiveGoNoGoRecords,
  }), [
    actionRequests,
    artifactManifest,
    backendClosureEvidenceBinder,
    closureModel,
    dataSourceKind,
    evidenceLedger,
    executiveBrief,
    executiveGoNoGoRecords,
    followUpRegister,
    latestHandoffApproval,
    model,
    productionGuardrailMatrix,
    readViewDiagnostics,
    sourceLabel,
    status,
    watchtower,
  ])
  const launchWarRoomTimeline = useMemo(() => buildLaunchWarRoomTimeline({
    readinessModel: model,
    evidenceLedger,
    auditEvents,
    actionRequests,
    mockServerExecutions: localMockServerExecutions,
    signOffs,
    decisionPackets,
    closureSnapshots,
    handoffApprovals,
    followUpRegister,
    followUpRecords,
    watchChecks,
    backendImplementationRecords,
    backendHandlerSpecReviews,
    engineeringHandoffPacketReviews,
    serverHandlerTestRecords,
    serverTestEvidencePackRecords,
    backendExecutionReadinessRecords,
    trustedHandlerDeploymentRecords,
    backendReleaseCommandRecords,
    backendWatchRecords,
    backendClosureEvidenceRecords,
    productionGuardrailRecords,
    executiveGoNoGoRoom,
    executiveGoNoGoRecords,
    pulseRecords: launchWarRoomPulseRecords,
  }), [
    actionRequests,
    auditEvents,
    backendClosureEvidenceRecords,
    backendExecutionReadinessRecords,
    backendHandlerSpecReviews,
    backendImplementationRecords,
    backendReleaseCommandRecords,
    backendWatchRecords,
    closureSnapshots,
    decisionPackets,
    engineeringHandoffPacketReviews,
    evidenceLedger,
    executiveGoNoGoRecords,
    executiveGoNoGoRoom,
    followUpRecords,
    followUpRegister,
    handoffApprovals,
    launchWarRoomPulseRecords,
    localMockServerExecutions,
    model,
    productionGuardrailRecords,
    serverHandlerTestRecords,
    serverTestEvidencePackRecords,
    signOffs,
    trustedHandlerDeploymentRecords,
    watchChecks,
  ])
  const launchCommandSavedViews = useMemo(() => buildLaunchCommandSavedViews({
    readinessModel: model,
    commandMode,
    launchWarRoomTimeline,
    executiveGoNoGoRoom,
    productionGuardrailMatrix,
    backendClosureEvidenceBinder,
    followUpRegister,
    evidenceLedger,
    records: launchSavedViewRecords,
  }), [
    backendClosureEvidenceBinder,
    commandMode,
    evidenceLedger,
    executiveGoNoGoRoom,
    followUpRegister,
    launchSavedViewRecords,
    launchWarRoomTimeline,
    model,
    productionGuardrailMatrix,
  ])
  const launchExceptionSlaBoard = useMemo(() => buildLaunchExceptionSlaBoard({
    commandMode,
    launchWarRoomTimeline,
    launchCommandSavedViews,
    executiveGoNoGoRoom,
    productionGuardrailMatrix,
    backendClosureEvidenceBinder,
    followUpRegister,
    records: launchExceptionSlaRecords,
  }), [
    backendClosureEvidenceBinder,
    commandMode,
    executiveGoNoGoRoom,
    followUpRegister,
    launchCommandSavedViews,
    launchExceptionSlaRecords,
    launchWarRoomTimeline,
    productionGuardrailMatrix,
  ])
  const launchOwnerDailyBrief = useMemo(() => buildLaunchOwnerDailyBrief({
    readinessModel: model,
    commandMode,
    launchWarRoomTimeline,
    launchCommandSavedViews,
    launchExceptionSlaBoard,
    executiveGoNoGoRoom,
    followUpRegister,
    evidenceLedger,
    records: launchOwnerDailyBriefRecords,
  }), [
    commandMode,
    evidenceLedger,
    executiveGoNoGoRoom,
    followUpRegister,
    launchCommandSavedViews,
    launchExceptionSlaBoard,
    launchOwnerDailyBriefRecords,
    launchWarRoomTimeline,
    model,
  ])
  const launchEvidencePacket = useMemo(() => buildLaunchEvidencePacketAssembler({
    readinessModel: model,
    closureModel,
    artifactManifest,
    executiveGoNoGoRoom,
    launchOwnerDailyBrief,
    launchExceptionSlaBoard,
    launchCommandSavedViews,
    launchWarRoomTimeline,
    productionGuardrailMatrix,
    backendClosureEvidenceBinder,
    followUpRegister,
    evidenceLedger,
    records: launchEvidencePacketRecords,
  }), [
    artifactManifest,
    backendClosureEvidenceBinder,
    closureModel,
    evidenceLedger,
    executiveGoNoGoRoom,
    followUpRegister,
    launchCommandSavedViews,
    launchEvidencePacketRecords,
    launchExceptionSlaBoard,
    launchOwnerDailyBrief,
    launchWarRoomTimeline,
    model,
    productionGuardrailMatrix,
  ])
  const launchPostLaunchWatchtower = useMemo(() => buildLaunchPostLaunchWatchtower({
    data,
    launchEvidencePacket,
    launchWatchtower: watchtower,
    watchChecks,
    backendWatchMonitor,
    followUpRegister,
    launchWarRoomTimeline,
    closureModel,
    actionRequests,
    records: launchPostLaunchWatchtowerRecords,
  }), [
    actionRequests,
    backendWatchMonitor,
    closureModel,
    data,
    followUpRegister,
    launchEvidencePacket,
    launchPostLaunchWatchtowerRecords,
    launchWarRoomTimeline,
    watchChecks,
    watchtower,
  ])
  const launchPostLaunchIncidentCommander = useMemo(() => buildLaunchPostLaunchIncidentCommander({
    data,
    postLaunchWatchtower: launchPostLaunchWatchtower,
    launchWarRoomTimeline,
    actionRequests,
    records: launchPostLaunchIncidentRecords,
  }), [
    actionRequests,
    data,
    launchPostLaunchIncidentRecords,
    launchPostLaunchWatchtower,
    launchWarRoomTimeline,
  ])
  const launchCommsApprovalCenter = useMemo(() => buildLaunchCommsApprovalCenter({
    incidentCommander: launchPostLaunchIncidentCommander,
    records: launchCommsApprovalRecords,
  }), [launchCommsApprovalRecords, launchPostLaunchIncidentCommander])
  const launchSendReviewQueue = useMemo(() => buildLaunchSendReviewQueue({
    communicationsCenter: launchCommsApprovalCenter,
    records: launchSendReviewRecords,
  }), [launchCommsApprovalCenter, launchSendReviewRecords])
  const launchDeliveryEvidenceLedger = useMemo(() => buildLaunchDeliveryEvidenceLedger({
    sendReviewQueue: launchSendReviewQueue,
    records: launchDeliveryEvidenceRecords,
  }), [launchDeliveryEvidenceRecords, launchSendReviewQueue])
  const launchRecipientResponseMonitor = useMemo(() => buildLaunchRecipientResponseMonitor({
    deliveryEvidenceLedger: launchDeliveryEvidenceLedger,
    records: launchRecipientResponseRecords,
  }), [launchDeliveryEvidenceLedger, launchRecipientResponseRecords])
  const launchClosureEvidencePack = useMemo(() => buildLaunchClosureEvidencePack({
    responseMonitor: launchRecipientResponseMonitor,
    records: launchClosureEvidenceRecords,
  }), [launchClosureEvidenceRecords, launchRecipientResponseMonitor])
  const launchFinalAuditRoom = useMemo(() => buildLaunchFinalAuditRoom({
    readinessModel: model,
    closureModel,
    communicationsCenter: launchCommsApprovalCenter,
    sendReviewQueue: launchSendReviewQueue,
    deliveryEvidenceLedger: launchDeliveryEvidenceLedger,
    recipientResponseMonitor: launchRecipientResponseMonitor,
    closureEvidencePack: launchClosureEvidencePack,
    records: launchFinalAuditRecords,
  }), [
    closureModel,
    launchClosureEvidencePack,
    launchCommsApprovalCenter,
    launchDeliveryEvidenceLedger,
    launchFinalAuditRecords,
    launchRecipientResponseMonitor,
    launchSendReviewQueue,
    model,
  ])
  const launchAuditArchiveVault = useMemo(() => buildLaunchAuditArchiveVault({
    finalAuditRoom: launchFinalAuditRoom,
    records: launchAuditArchiveRecords,
  }), [launchAuditArchiveRecords, launchFinalAuditRoom])
  const exceptionSlaOwnerOptions = useMemo(() => [
    'All',
    ...Array.from(new Set(launchExceptionSlaBoard.items.map(item => item.owner))).sort((a, b) => a.localeCompare(b)),
  ], [launchExceptionSlaBoard.items])
  const exceptionSlaItems = useMemo(() => exceptionSlaOwnerFilter === 'All'
    ? launchExceptionSlaBoard.items
    : launchExceptionSlaBoard.items.filter(item => item.owner === exceptionSlaOwnerFilter),
  [exceptionSlaOwnerFilter, launchExceptionSlaBoard.items])

  const rows = useMemo(() => model.gates.filter(gate => selectedArea === 'All' || gate.area === selectedArea), [model.gates, selectedArea])
  const selectedGate = rows.find(gate => gate.id === selectedId) ?? rows[0] ?? model.gates[0]
  const selectedMatrixRow = backendMatrix.rows.find(row => row.id === selectedMatrixId) ?? backendMatrix.rows[0]
  const selectedImplementationItem = backendImplementationWorkbench.items.find(item => item.id === selectedImplementationId) ?? backendImplementationWorkbench.nextItem ?? backendImplementationWorkbench.items[0]
  const selectedHandlerSpec = backendHandlerSpecRegister.specs.find(spec => spec.id === selectedHandlerSpecId) ?? backendHandlerSpecRegister.nextSpec ?? backendHandlerSpecRegister.specs[0]
  const selectedReadinessCard = backendHandlerReadinessBoard.cards.find(card => card.id === selectedReadinessCardId) ?? backendHandlerReadinessBoard.nextCard ?? backendHandlerReadinessBoard.cards[0]
  const selectedReadinessSpec = selectedReadinessCard
    ? backendHandlerSpecRegister.specs.find(spec => spec.id === selectedReadinessCard.specId)
    : undefined
  const selectedEngineeringPacket = backendEngineeringHandoffRegister.packets.find(packet => packet.id === selectedEngineeringPacketId) ?? backendEngineeringHandoffRegister.nextPacket ?? backendEngineeringHandoffRegister.packets[0]
  const selectedServerTestRow = backendServerHandlerTestMatrix.rows.find(row => row.id === selectedServerTestRowId) ?? backendServerHandlerTestMatrix.nextRow ?? backendServerHandlerTestMatrix.rows[0]
  const selectedServerEvidencePack = backendServerTestEvidencePackRegister.packs.find(pack => pack.id === selectedServerEvidencePackId) ?? backendServerTestEvidencePackRegister.nextPack ?? backendServerTestEvidencePackRegister.packs[0]
  const selectedExecutionReadinessRow = backendExecutionReadinessDashboard.rows.find(row => row.id === selectedExecutionReadinessRowId) ?? backendExecutionReadinessDashboard.nextRow ?? backendExecutionReadinessDashboard.rows[0]
  const selectedTrustedDeploymentItem = trustedHandlerDeploymentChecklist.items.find(item => item.id === selectedTrustedDeploymentItemId) ?? trustedHandlerDeploymentChecklist.nextItem ?? trustedHandlerDeploymentChecklist.items[0]
  const selectedReleaseCommandItem = backendReleaseCommandCenter.items.find(item => item.id === selectedReleaseCommandItemId) ?? backendReleaseCommandCenter.nextItem ?? backendReleaseCommandCenter.items[0]
  const selectedBackendWatchItem = backendWatchMonitor.items.find(item => item.id === selectedBackendWatchItemId) ?? backendWatchMonitor.nextItem ?? backendWatchMonitor.items[0]
  const selectedBackendClosureItem = backendClosureEvidenceBinder.items.find(item => item.id === selectedBackendClosureItemId) ?? backendClosureEvidenceBinder.nextItem ?? backendClosureEvidenceBinder.items[0]
  const selectedProductionGuardrailItem = productionGuardrailMatrix.items.find(item => item.id === selectedProductionGuardrailItemId) ?? productionGuardrailMatrix.nextItem ?? productionGuardrailMatrix.items[0]
  const selectedExecutiveGoNoGoItem = executiveGoNoGoRoom.items.find(item => item.id === selectedExecutiveGoNoGoItemId) ?? executiveGoNoGoRoom.nextItem ?? executiveGoNoGoRoom.items[0]
  const selectedWarRoomEvent = launchWarRoomTimeline.events.find(event => event.id === selectedWarRoomEventId) ?? launchWarRoomTimeline.nextEvent ?? launchWarRoomTimeline.events[0]
  const selectedSavedView = launchCommandSavedViews.views.find(view => view.id === selectedSavedViewId) ?? launchCommandSavedViews.views[0]
  const selectedExceptionSlaItem = exceptionSlaItems.find(item => item.id === selectedExceptionSlaItemId)
    ?? launchExceptionSlaBoard.items.find(item => item.id === selectedExceptionSlaItemId)
    ?? exceptionSlaItems[0]
    ?? launchExceptionSlaBoard.items[0]
  const selectedOwnerBriefDecision = launchOwnerDailyBrief.decisions.find(decision => decision.id === selectedOwnerBriefDecisionId)
    ?? launchOwnerDailyBrief.nextDecision
    ?? launchOwnerDailyBrief.decisions[0]
  const selectedEvidencePacketItem = launchEvidencePacket.items.find(item => item.id === selectedEvidencePacketItemId)
    ?? launchEvidencePacket.nextItem
    ?? launchEvidencePacket.items[0]
  const selectedPostLaunchSignal = launchPostLaunchWatchtower.signals.find(signal => signal.id === selectedPostLaunchSignalId)
    ?? launchPostLaunchWatchtower.nextSignal
    ?? launchPostLaunchWatchtower.signals[0]
  const selectedPostLaunchIncident = launchPostLaunchIncidentCommander.incidents.find(incident => incident.id === selectedPostLaunchIncidentId)
    ?? launchPostLaunchIncidentCommander.nextIncident
    ?? launchPostLaunchIncidentCommander.incidents[0]
  const selectedLaunchCommsDraft = launchCommsApprovalCenter.drafts.find(draft => draft.id === selectedLaunchCommsDraftId)
    ?? launchCommsApprovalCenter.nextDraft
    ?? launchCommsApprovalCenter.drafts[0]
  const selectedLaunchSendReviewItem = launchSendReviewQueue.items.find(item => item.id === selectedLaunchSendReviewItemId)
    ?? launchSendReviewQueue.nextItem
    ?? launchSendReviewQueue.items[0]
  const selectedLaunchDeliveryEvidenceItem = launchDeliveryEvidenceLedger.items.find(item => item.id === selectedLaunchDeliveryEvidenceItemId)
    ?? launchDeliveryEvidenceLedger.nextItem
    ?? launchDeliveryEvidenceLedger.items[0]
  const selectedLaunchRecipientResponseItem = launchRecipientResponseMonitor.items.find(item => item.id === selectedLaunchRecipientResponseItemId)
    ?? launchRecipientResponseMonitor.nextItem
    ?? launchRecipientResponseMonitor.items[0]
  const selectedLaunchClosureEvidenceItem = launchClosureEvidencePack.items.find(item => item.id === selectedLaunchClosureEvidenceItemId)
    ?? launchClosureEvidencePack.nextItem
    ?? launchClosureEvidencePack.items[0]
  const selectedLaunchFinalAuditItem = launchFinalAuditRoom.items.find(item => item.id === selectedLaunchFinalAuditItemId)
    ?? launchFinalAuditRoom.nextItem
    ?? launchFinalAuditRoom.items[0]
  const selectedLaunchAuditArchiveItem = launchAuditArchiveVault.items.find(item => item.id === selectedLaunchAuditArchiveItemId)
    ?? launchAuditArchiveVault.nextItem
    ?? launchAuditArchiveVault.items[0]
  const selectedSignOff = selectedGate ? latestSignOffByGate.get(selectedGate.id) : undefined
  const launchTone = getLaunchGateTone(model.status)
  const scoreTone = model.status === 'Blocked' ? 'danger' : model.status === 'Watch' ? 'warn' : 'ok'
  const implementationOwnerOptions = useMemo(() => Array.from(new Set([
    ...launchSignOffOwners,
    ...backendImplementationWorkbench.items.map(item => item.owner),
  ])), [backendImplementationWorkbench.items])
  const handlerSpecOwnerOptions = useMemo(() => Array.from(new Set([
    ...launchSignOffOwners,
    ...backendHandlerSpecRegister.specs.map(spec => spec.owner),
  ])), [backendHandlerSpecRegister.specs])
  const engineeringPacketOwnerOptions = useMemo(() => Array.from(new Set([
    'Engineering',
    ...launchSignOffOwners,
    ...backendEngineeringHandoffRegister.packets.map(packet => packet.productOwner),
    ...backendEngineeringHandoffRegister.packets.map(packet => packet.engineeringOwner),
  ])), [backendEngineeringHandoffRegister.packets])
  const serverTestOwnerOptions = useMemo(() => Array.from(new Set([
    'Engineering',
    ...launchSignOffOwners,
    ...backendServerHandlerTestMatrix.rows.map(row => row.productOwner),
    ...backendServerHandlerTestMatrix.rows.map(row => row.engineeringOwner),
  ])), [backendServerHandlerTestMatrix.rows])
  const serverEvidenceOwnerOptions = useMemo(() => Array.from(new Set([
    'Engineering',
    ...launchSignOffOwners,
    ...backendServerTestEvidencePackRegister.packs.map(pack => pack.productOwner),
    ...backendServerTestEvidencePackRegister.packs.map(pack => pack.engineeringOwner),
  ])), [backendServerTestEvidencePackRegister.packs])
  const executionReadinessOwnerOptions = useMemo(() => Array.from(new Set([
    'Engineering',
    ...launchSignOffOwners,
    ...backendExecutionReadinessDashboard.rows.map(row => row.productOwner),
    ...backendExecutionReadinessDashboard.rows.map(row => row.engineeringOwner),
  ])), [backendExecutionReadinessDashboard.rows])
  const trustedDeploymentOwnerOptions = useMemo(() => Array.from(new Set([
    'Engineering',
    ...launchSignOffOwners,
    ...trustedHandlerDeploymentChecklist.items.map(item => item.productOwner),
    ...trustedHandlerDeploymentChecklist.items.map(item => item.engineeringOwner),
  ])), [trustedHandlerDeploymentChecklist.items])
  const releaseCommandOwnerOptions = useMemo(() => Array.from(new Set([
    'Engineering',
    ...launchSignOffOwners,
    ...backendReleaseCommandCenter.items.map(item => item.productOwner),
    ...backendReleaseCommandCenter.items.map(item => item.engineeringOwner),
    ...backendReleaseCommandCenter.items.map(item => item.releaseOwner),
  ])), [backendReleaseCommandCenter.items])
  const backendWatchOwnerOptions = useMemo(() => Array.from(new Set([
    'Engineering',
    ...launchSignOffOwners,
    ...backendWatchMonitor.items.map(item => item.productOwner),
    ...backendWatchMonitor.items.map(item => item.engineeringOwner),
    ...backendWatchMonitor.items.map(item => item.releaseOwner),
    ...backendWatchMonitor.items.map(item => item.watchOwner),
  ])), [backendWatchMonitor.items])
  const backendClosureOwnerOptions = useMemo(() => Array.from(new Set([
    'Engineering',
    ...launchSignOffOwners,
    ...backendClosureEvidenceBinder.items.map(item => item.productOwner),
    ...backendClosureEvidenceBinder.items.map(item => item.engineeringOwner),
    ...backendClosureEvidenceBinder.items.map(item => item.releaseOwner),
    ...backendClosureEvidenceBinder.items.map(item => item.watchOwner),
    ...backendClosureEvidenceBinder.items.map(item => item.closureOwner),
  ])), [backendClosureEvidenceBinder.items])
  const productionGuardrailOwnerOptions = useMemo(() => Array.from(new Set([
    'Engineering',
    ...launchSignOffOwners,
    ...productionGuardrailMatrix.items.map(item => item.productOwner),
    ...productionGuardrailMatrix.items.map(item => item.engineeringOwner),
    ...productionGuardrailMatrix.items.map(item => item.closureOwner),
    ...productionGuardrailMatrix.items.map(item => item.guardrailOwner),
  ])), [productionGuardrailMatrix.items])

  useEffect(() => {
    if (!selectedGate) return
    setSignOffOwner(selectedGate.owner)
    setSignOffDecision(selectedGate.status === 'Ready' ? 'Approved' : 'Assigned')
    setSignOffNote('')
  }, [selectedGate?.id, selectedGate?.owner, selectedGate?.status])

  useEffect(() => {
    setHandoffDecision(getSuggestedHandoffDecision(artifactManifest.status))
    setHandoffOwner('Owner')
    setHandoffConditionNote('')
    setHandoffAcceptedRisk('')
  }, [artifactManifest.status])

  useEffect(() => {
    if (!decisionPackets.length) {
      setSelectedPacketId('')
      return
    }
    if (!decisionPackets.some(packet => packet.id === selectedPacketId)) {
      setSelectedPacketId(decisionPackets[0].id)
    }
  }, [decisionPackets, selectedPacketId])

  useEffect(() => {
    if (!launchCommandSavedViews.views.length) {
      setSelectedSavedViewId('')
      return
    }
    if (!launchCommandSavedViews.views.some(view => view.id === selectedSavedViewId)) {
      setSelectedSavedViewId(launchCommandSavedViews.views[0].id)
    }
  }, [launchCommandSavedViews.views, selectedSavedViewId])

  useEffect(() => {
    if (!launchExceptionSlaBoard.items.length) {
      setSelectedExceptionSlaItemId('')
      return
    }
    if (!launchExceptionSlaBoard.items.some(item => item.id === selectedExceptionSlaItemId)) {
      setSelectedExceptionSlaItemId(launchExceptionSlaBoard.items[0].id)
    }
  }, [launchExceptionSlaBoard.items, selectedExceptionSlaItemId])

  useEffect(() => {
    if (!launchOwnerDailyBrief.decisions.length) {
      setSelectedOwnerBriefDecisionId('')
      return
    }
    if (!launchOwnerDailyBrief.decisions.some(decision => decision.id === selectedOwnerBriefDecisionId)) {
      setSelectedOwnerBriefDecisionId((launchOwnerDailyBrief.nextDecision ?? launchOwnerDailyBrief.decisions[0]).id)
    }
  }, [launchOwnerDailyBrief.decisions, launchOwnerDailyBrief.nextDecision, selectedOwnerBriefDecisionId])

  useEffect(() => {
    if (!launchEvidencePacket.items.length) {
      setSelectedEvidencePacketItemId('')
      return
    }
    if (!launchEvidencePacket.items.some(item => item.id === selectedEvidencePacketItemId)) {
      setSelectedEvidencePacketItemId((launchEvidencePacket.nextItem ?? launchEvidencePacket.items[0]).id)
    }
  }, [launchEvidencePacket.items, launchEvidencePacket.nextItem, selectedEvidencePacketItemId])

  useEffect(() => {
    if (!launchPostLaunchWatchtower.signals.length) {
      setSelectedPostLaunchSignalId('')
      return
    }
    if (!launchPostLaunchWatchtower.signals.some(signal => signal.id === selectedPostLaunchSignalId)) {
      setSelectedPostLaunchSignalId((launchPostLaunchWatchtower.nextSignal ?? launchPostLaunchWatchtower.signals[0]).id)
    }
  }, [launchPostLaunchWatchtower.nextSignal, launchPostLaunchWatchtower.signals, selectedPostLaunchSignalId])

  useEffect(() => {
    if (!launchPostLaunchIncidentCommander.incidents.length) {
      setSelectedPostLaunchIncidentId('')
      return
    }
    if (!launchPostLaunchIncidentCommander.incidents.some(incident => incident.id === selectedPostLaunchIncidentId)) {
      setSelectedPostLaunchIncidentId((launchPostLaunchIncidentCommander.nextIncident ?? launchPostLaunchIncidentCommander.incidents[0]).id)
    }
  }, [launchPostLaunchIncidentCommander.incidents, launchPostLaunchIncidentCommander.nextIncident, selectedPostLaunchIncidentId])

  useEffect(() => {
    if (!launchCommsApprovalCenter.drafts.length) {
      setSelectedLaunchCommsDraftId('')
      return
    }
    if (!launchCommsApprovalCenter.drafts.some(draft => draft.id === selectedLaunchCommsDraftId)) {
      setSelectedLaunchCommsDraftId((launchCommsApprovalCenter.nextDraft ?? launchCommsApprovalCenter.drafts[0]).id)
    }
  }, [launchCommsApprovalCenter.drafts, launchCommsApprovalCenter.nextDraft, selectedLaunchCommsDraftId])

  useEffect(() => {
    if (!launchSendReviewQueue.items.length) {
      setSelectedLaunchSendReviewItemId('')
      return
    }
    if (!launchSendReviewQueue.items.some(item => item.id === selectedLaunchSendReviewItemId)) {
      setSelectedLaunchSendReviewItemId((launchSendReviewQueue.nextItem ?? launchSendReviewQueue.items[0]).id)
    }
  }, [launchSendReviewQueue.items, launchSendReviewQueue.nextItem, selectedLaunchSendReviewItemId])

  useEffect(() => {
    if (!launchDeliveryEvidenceLedger.items.length) {
      setSelectedLaunchDeliveryEvidenceItemId('')
      return
    }
    if (!launchDeliveryEvidenceLedger.items.some(item => item.id === selectedLaunchDeliveryEvidenceItemId)) {
      setSelectedLaunchDeliveryEvidenceItemId((launchDeliveryEvidenceLedger.nextItem ?? launchDeliveryEvidenceLedger.items[0]).id)
    }
  }, [launchDeliveryEvidenceLedger.items, launchDeliveryEvidenceLedger.nextItem, selectedLaunchDeliveryEvidenceItemId])

  useEffect(() => {
    if (!launchRecipientResponseMonitor.items.length) {
      setSelectedLaunchRecipientResponseItemId('')
      return
    }
    if (!launchRecipientResponseMonitor.items.some(item => item.id === selectedLaunchRecipientResponseItemId)) {
      setSelectedLaunchRecipientResponseItemId((launchRecipientResponseMonitor.nextItem ?? launchRecipientResponseMonitor.items[0]).id)
    }
  }, [launchRecipientResponseMonitor.items, launchRecipientResponseMonitor.nextItem, selectedLaunchRecipientResponseItemId])

  useEffect(() => {
    if (!launchClosureEvidencePack.items.length) {
      setSelectedLaunchClosureEvidenceItemId('')
      return
    }
    if (!launchClosureEvidencePack.items.some(item => item.id === selectedLaunchClosureEvidenceItemId)) {
      setSelectedLaunchClosureEvidenceItemId((launchClosureEvidencePack.nextItem ?? launchClosureEvidencePack.items[0]).id)
    }
  }, [launchClosureEvidencePack.items, launchClosureEvidencePack.nextItem, selectedLaunchClosureEvidenceItemId])

  useEffect(() => {
    if (!launchFinalAuditRoom.items.length) {
      setSelectedLaunchFinalAuditItemId('')
      return
    }
    if (!launchFinalAuditRoom.items.some(item => item.id === selectedLaunchFinalAuditItemId)) {
      setSelectedLaunchFinalAuditItemId((launchFinalAuditRoom.nextItem ?? launchFinalAuditRoom.items[0]).id)
    }
  }, [launchFinalAuditRoom.items, launchFinalAuditRoom.nextItem, selectedLaunchFinalAuditItemId])

  useEffect(() => {
    if (!launchAuditArchiveVault.items.length) {
      setSelectedLaunchAuditArchiveItemId('')
      return
    }
    if (!launchAuditArchiveVault.items.some(item => item.id === selectedLaunchAuditArchiveItemId)) {
      setSelectedLaunchAuditArchiveItemId((launchAuditArchiveVault.nextItem ?? launchAuditArchiveVault.items[0]).id)
    }
  }, [launchAuditArchiveVault.items, launchAuditArchiveVault.nextItem, selectedLaunchAuditArchiveItemId])

  useEffect(() => {
    if (!followUpRegister.items.length) {
      setSelectedFollowUpId('')
      return
    }
    if (!followUpRegister.items.some(item => item.id === selectedFollowUpId)) {
      setSelectedFollowUpId((followUpRegister.nextItem ?? followUpRegister.items[0]).id)
    }
  }, [followUpRegister.items, followUpRegister.nextItem, selectedFollowUpId])

  useEffect(() => {
    if (!selectedPacket) return
    setPacketReviewOwner(selectedPacket.followUpOwner ?? selectedPacket.owner)
    setPacketReviewNote(selectedPacket.reviewNote ?? '')
  }, [selectedPacket?.id, selectedPacket?.owner, selectedPacket?.followUpOwner, selectedPacket?.reviewNote])

  useEffect(() => {
    if (!selectedFollowUp) return
    setFollowUpStatus(selectedFollowUp.status)
    setFollowUpOwner(selectedFollowUp.owner)
    setFollowUpNote(selectedFollowUp.note ?? '')
  }, [selectedFollowUp?.id, selectedFollowUp?.status, selectedFollowUp?.owner, selectedFollowUp?.note])

  useEffect(() => {
    if (!selectedImplementationItem) return
    setImplementationStatus(selectedImplementationItem.status)
    setImplementationOwner(selectedImplementationItem.owner)
    setImplementationNote(selectedImplementationItem.note ?? '')
  }, [
    selectedImplementationItem?.id,
    selectedImplementationItem?.status,
    selectedImplementationItem?.owner,
    selectedImplementationItem?.note,
  ])

  useEffect(() => {
    if (!selectedHandlerSpec) return
    setHandlerSpecStatus(selectedHandlerSpec.status)
    setHandlerSpecOwner(selectedHandlerSpec.owner)
    setHandlerSpecNote(selectedHandlerSpec.note ?? '')
  }, [
    selectedHandlerSpec?.id,
    selectedHandlerSpec?.status,
    selectedHandlerSpec?.owner,
    selectedHandlerSpec?.note,
  ])

  useEffect(() => {
    if (!selectedEngineeringPacket) return
    setEngineeringPacketStatus(selectedEngineeringPacket.status)
    setEngineeringPacketOwner(selectedEngineeringPacket.engineeringOwner)
    setEngineeringPacketNote(selectedEngineeringPacket.note ?? '')
  }, [
    selectedEngineeringPacket?.id,
    selectedEngineeringPacket?.status,
    selectedEngineeringPacket?.engineeringOwner,
    selectedEngineeringPacket?.note,
  ])

  useEffect(() => {
    if (!selectedServerTestRow) return
    setServerTestStatus(selectedServerTestRow.status)
    setServerTestOwner(selectedServerTestRow.engineeringOwner)
    setServerTestNote(selectedServerTestRow.note ?? '')
  }, [
    selectedServerTestRow?.id,
    selectedServerTestRow?.status,
    selectedServerTestRow?.engineeringOwner,
    selectedServerTestRow?.note,
  ])

  useEffect(() => {
    if (!selectedServerEvidencePack) return
    setServerEvidenceStatus(selectedServerEvidencePack.status)
    setServerEvidenceOwner(selectedServerEvidencePack.engineeringOwner)
    setServerEvidenceLocation(selectedServerEvidencePack.evidenceLocation ?? `Platform Admin / Launch Gate / Server Test Evidence / ${selectedServerEvidencePack.handlerKey}`)
    setServerEvidenceNote(selectedServerEvidencePack.note ?? '')
  }, [
    selectedServerEvidencePack?.id,
    selectedServerEvidencePack?.status,
    selectedServerEvidencePack?.engineeringOwner,
    selectedServerEvidencePack?.evidenceLocation,
    selectedServerEvidencePack?.note,
    selectedServerEvidencePack?.handlerKey,
  ])

  useEffect(() => {
    if (!selectedExecutionReadinessRow) return
    setExecutionReadinessStatus(selectedExecutionReadinessRow.status)
    setExecutionReadinessOwner(selectedExecutionReadinessRow.engineeringOwner)
    setExecutionReadinessNote(selectedExecutionReadinessRow.note ?? '')
  }, [
    selectedExecutionReadinessRow?.id,
    selectedExecutionReadinessRow?.status,
    selectedExecutionReadinessRow?.engineeringOwner,
    selectedExecutionReadinessRow?.note,
  ])

  useEffect(() => {
    if (!selectedTrustedDeploymentItem) return
    setTrustedDeploymentStatus(selectedTrustedDeploymentItem.status)
    setTrustedDeploymentOwner(selectedTrustedDeploymentItem.engineeringOwner)
    setTrustedDeploymentNote(selectedTrustedDeploymentItem.note ?? '')
  }, [
    selectedTrustedDeploymentItem?.id,
    selectedTrustedDeploymentItem?.status,
    selectedTrustedDeploymentItem?.engineeringOwner,
    selectedTrustedDeploymentItem?.note,
  ])

  useEffect(() => {
    if (!selectedReleaseCommandItem) return
    setReleaseCommandStatus(selectedReleaseCommandItem.status)
    setReleaseCommandOwner(selectedReleaseCommandItem.releaseOwner)
    setReleaseCommandWindow(selectedReleaseCommandItem.releaseWindow)
    setReleaseCommandNote(selectedReleaseCommandItem.note ?? '')
  }, [
    selectedReleaseCommandItem?.id,
    selectedReleaseCommandItem?.status,
    selectedReleaseCommandItem?.releaseOwner,
    selectedReleaseCommandItem?.releaseWindow,
    selectedReleaseCommandItem?.note,
  ])

  useEffect(() => {
    if (!selectedBackendWatchItem) return
    setBackendWatchStatus(selectedBackendWatchItem.status)
    setBackendWatchOwner(selectedBackendWatchItem.watchOwner)
    setBackendWatchNote(selectedBackendWatchItem.note ?? '')
  }, [
    selectedBackendWatchItem?.id,
    selectedBackendWatchItem?.status,
    selectedBackendWatchItem?.watchOwner,
    selectedBackendWatchItem?.note,
  ])

  useEffect(() => {
    if (!selectedBackendClosureItem) return
    setBackendClosureStatus(selectedBackendClosureItem.status)
    setBackendClosureOwner(selectedBackendClosureItem.closureOwner)
    setBackendClosurePacketLocation(selectedBackendClosureItem.packetLocation)
    setBackendClosureNote(selectedBackendClosureItem.note ?? '')
  }, [
    selectedBackendClosureItem?.id,
    selectedBackendClosureItem?.status,
    selectedBackendClosureItem?.closureOwner,
    selectedBackendClosureItem?.packetLocation,
    selectedBackendClosureItem?.note,
  ])

  useEffect(() => {
    if (!selectedProductionGuardrailItem) return
    setProductionGuardrailStatus(selectedProductionGuardrailItem.status)
    setProductionGuardrailOwner(selectedProductionGuardrailItem.guardrailOwner)
    setProductionGuardrailNote(selectedProductionGuardrailItem.note ?? '')
  }, [
    selectedProductionGuardrailItem?.id,
    selectedProductionGuardrailItem?.status,
    selectedProductionGuardrailItem?.guardrailOwner,
    selectedProductionGuardrailItem?.note,
  ])

  useEffect(() => {
    setExecutiveGoNoGoDecision(executiveGoNoGoRoom.decision)
    setExecutiveGoNoGoOwner(selectedExecutiveGoNoGoItem?.owner ?? executiveGoNoGoRoom.latestRecord?.owner ?? 'Owner')
    setExecutiveGoNoGoConditionNote(executiveGoNoGoRoom.latestRecord?.conditionNote ?? '')
    setExecutiveGoNoGoAcceptedRisk(executiveGoNoGoRoom.latestRecord?.acceptedRisk ?? '')
  }, [
    executiveGoNoGoRoom.decision,
    executiveGoNoGoRoom.latestRecord?.acceptedRisk,
    executiveGoNoGoRoom.latestRecord?.conditionNote,
    executiveGoNoGoRoom.latestRecord?.owner,
    selectedExecutiveGoNoGoItem?.owner,
  ])

  const recordLaunchReview = (gate: LaunchGate) => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: `Launch Gate / ${gate.area}`,
      actionKey: `launch_gate.${gate.id}.reviewed.mock`,
      actionLabel: `Reviewed launch gate: ${gate.title}`,
      severity: gate.status === 'Blocked' ? 'critical' : gate.status === 'Watch' ? 'warning' : 'notice',
      metadata: {
        gateId: gate.id,
        area: gate.area,
        status: gate.status,
        severity: gate.severity,
        scoreImpact: gate.scoreImpact,
        linkedSurface: gate.linkedSurface,
      },
    })
    setNotice(result.ok ? `${gate.title} review recorded.` : result.message)
  }

  const recordMatrixReview = (row: LaunchBackendMatrixRow) => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: `Launch Backend Matrix / ${row.area}`,
      actionKey: `launch_backend_matrix.${row.id}.reviewed.mock`,
      actionLabel: `Reviewed backend readiness matrix gate: ${row.title}`,
      severity: row.status === 'Blocked' ? 'critical' : row.status === 'Watch' || row.status === 'Missing' ? 'warning' : 'notice',
      metadata: {
        matrixRowId: row.id,
        area: row.area,
        status: row.status,
        score: row.score,
        metric: row.metric,
        owner: row.owner,
        matrixScore: backendMatrix.score,
        matrixStatus: backendMatrix.status,
        readyCount: backendMatrix.readyCount,
        watchCount: backendMatrix.watchCount,
        blockedCount: backendMatrix.blockedCount,
        missingCount: backendMatrix.missingCount,
        mutationApplied: false,
      },
    })
    setNotice(result.ok ? `${row.title} matrix review recorded.` : result.message)
  }

  const recordImplementationWorkUpdate = (
    item: BackendImplementationWorkItem,
    nextStatus: BackendImplementationWorkStatus = implementationStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Backend Implementation / ${item.area}`,
      actionKey: `launch_gate.backend_implementation.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} backend implementation work: ${item.title}`,
      severity: nextStatus === 'Blocked'
        ? 'critical'
        : item.priority === 'Critical' || nextStatus === 'Planning' || nextStatus === 'In Review'
          ? 'warning'
          : 'notice',
      metadata: {
        workItemId: item.id,
        matrixRowId: item.matrixRowId,
        previousStatus: item.status,
        nextStatus,
        priority: item.priority,
        area: item.area,
        type: item.type,
        owner: implementationOwner,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        dependencies: item.dependencies,
        dependencyCount: item.dependencies.length,
        blockedAcceptanceChecks: item.acceptanceChecks.filter(check => check.status === 'Blocked').length,
        missingAcceptanceChecks: item.acceptanceChecks.filter(check => check.status === 'Missing').length,
        note: implementationNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveBackendImplementationWorkRecord({
      item,
      status: nextStatus,
      owner: implementationOwner,
      note: implementationNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedImplementationId(record.itemId)
    setNotice(`${record.status} recorded for ${item.title}.`)
  }

  const queueImplementationWorkRequest = (item: BackendImplementationWorkItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Backend implementation: ${item.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.scope }),
      reason: `${item.nextStep} Evidence: ${item.evidence}`,
      rollbackNotes: item.rollbackRequirement,
      severity: item.priority === 'Critical' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.backend_implementation.action_request_queued.mock',
      auditActionLabel: `Queued backend implementation work request: ${item.title}`,
      handlerKey: item.handlerKey,
      handlerLabel: item.handlerLabel,
      handlerDescription: `${item.handlerLabel} must satisfy acceptance checks, permission checks, audit logging, and rollback proof before production execution.`,
      metadata: {
        workItemId: item.id,
        matrixRowId: item.matrixRowId,
        status: item.status,
        priority: item.priority,
        area: item.area,
        type: item.type,
        owner: item.owner,
        dependencies: item.dependencies,
        dependencyCount: item.dependencies.length,
        acceptanceChecks: item.acceptanceChecks.map(check => ({
          id: check.id,
          label: check.label,
          status: check.status,
        })),
        auditRequirement: item.auditRequirement,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${item.title} queued in Admin Action Requests.` : result.message)
  }

  const recordHandlerSpecReview = (
    spec: BackendHandlerSpec,
    nextStatus: BackendHandlerSpecStatus = handlerSpecStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Backend Handler Spec / ${spec.handlerKey}`,
      actionKey: `launch_gate.backend_handler_spec.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} backend handler spec: ${spec.handlerLabel}`,
      severity: nextStatus === 'Blocked'
        ? 'critical'
        : nextStatus === 'Needs Review' || spec.risk === 'Critical'
          ? 'warning'
          : 'notice',
      metadata: {
        specId: spec.id,
        workItemId: spec.workItemId,
        matrixRowId: spec.matrixRowId,
        previousStatus: spec.status,
        nextStatus,
        risk: spec.risk,
        owner: handlerSpecOwner,
        handlerKey: spec.handlerKey,
        handlerLabel: spec.handlerLabel,
        endpoint: spec.endpoint,
        method: spec.method,
        permission: spec.permission,
        mutationMode: spec.mutationMode,
        humanConfirmationRequired: spec.humanConfirmationRequired,
        dryRunRequired: spec.dryRunRequired,
        idempotencyRequired: spec.idempotencyRequired,
        blockedGates: spec.approvalGates.filter(gate => gate.status === 'Blocked').length,
        reviewGates: spec.approvalGates.filter(gate => gate.status === 'Review').length,
        note: handlerSpecNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const review = saveBackendHandlerSpecReview({
      spec,
      status: nextStatus,
      owner: handlerSpecOwner,
      note: handlerSpecNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedHandlerSpecId(review.specId)
    setNotice(`${review.status} recorded for ${spec.handlerLabel}.`)
  }

  const queueHandlerSpecRequest = (spec: BackendHandlerSpec) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Backend handler spec: ${spec.handlerLabel}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: spec.scope }),
      reason: `${spec.acceptanceSummary} Endpoint: ${spec.method} ${spec.endpoint}.`,
      rollbackNotes: spec.rollbackPlan,
      severity: spec.risk === 'Critical' || spec.status === 'Blocked' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.backend_handler_spec.action_request_queued.mock',
      auditActionLabel: `Queued backend handler spec request: ${spec.handlerLabel}`,
      handlerKey: spec.handlerKey,
      handlerLabel: spec.handlerLabel,
      handlerDescription: `${spec.handlerLabel} must implement ${spec.method} ${spec.endpoint} with ${spec.permission}, audit logging, idempotency, dry-run proof, and rollback handling.`,
      metadata: {
        specId: spec.id,
        workItemId: spec.workItemId,
        matrixRowId: spec.matrixRowId,
        status: spec.status,
        risk: spec.risk,
        owner: spec.owner,
        endpoint: spec.endpoint,
        method: spec.method,
        permission: spec.permission,
        mutationMode: spec.mutationMode,
        blockedGates: spec.approvalGates.filter(gate => gate.status === 'Blocked').length,
        reviewGates: spec.approvalGates.filter(gate => gate.status === 'Review').length,
        requestFields: spec.requestFields.map(field => field.name),
        responseFields: spec.responseFields.map(field => field.name),
        auditFields: spec.auditFields.map(field => field.name),
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${spec.handlerLabel} spec queued in Admin Action Requests.` : result.message)
  }

  const exportHandlerSpec = (spec: BackendHandlerSpec) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Backend Handler Spec / ${spec.handlerKey}`,
      actionKey: 'launch_gate.backend_handler_spec.exported.mock',
      actionLabel: `Exported backend handler spec: ${spec.handlerLabel}`,
      severity: spec.status === 'Blocked' ? 'warning' : 'notice',
      metadata: {
        specId: spec.id,
        handlerKey: spec.handlerKey,
        handlerLabel: spec.handlerLabel,
        endpoint: spec.endpoint,
        method: spec.method,
        permission: spec.permission,
        status: spec.status,
        risk: spec.risk,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildBackendHandlerSpecHtml(spec, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getBackendHandlerSpecFilename(spec)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${spec.handlerLabel} handler spec exported and recorded in Audit Logs.`)
  }

  const recordHandlerReadinessBoardReview = (card?: BackendHandlerReadinessCard) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: card ? `Backend Handler Readiness / ${card.handlerKey}` : 'Backend Handler Readiness Board',
      actionKey: card
        ? `launch_gate.backend_handler_readiness.${card.laneId}.reviewed.mock`
        : `launch_gate.backend_handler_readiness.${backendHandlerReadinessBoard.status.toLowerCase()}.reviewed.mock`,
      actionLabel: card
        ? `Reviewed handler readiness card: ${card.handlerLabel}`
        : `Reviewed backend handler readiness board: ${backendHandlerReadinessBoard.status}`,
      severity: backendHandlerReadinessBoard.status === 'Blocked' || card?.status === 'Blocked'
        ? 'critical'
        : backendHandlerReadinessBoard.status === 'Review' || card?.status === 'Review'
          ? 'warning'
          : 'notice',
      metadata: {
        boardStatus: backendHandlerReadinessBoard.status,
        totalHandlers: backendHandlerReadinessBoard.totalCount,
        blockedHandlers: backendHandlerReadinessBoard.blockedCount,
        reviewHandlers: backendHandlerReadinessBoard.reviewCount,
        draftHandlers: backendHandlerReadinessBoard.draftCount,
        readyHandlers: backendHandlerReadinessBoard.readyCount,
        approvedHandlers: backendHandlerReadinessBoard.approvedCount,
        ownerCount: backendHandlerReadinessBoard.ownerCount,
        endpointCount: backendHandlerReadinessBoard.endpointCount,
        mutationCandidateCount: backendHandlerReadinessBoard.mutationCandidateCount,
        cardId: card?.id,
        specId: card?.specId,
        handlerKey: card?.handlerKey,
        handlerLabel: card?.handlerLabel,
        owner: card?.owner,
        permission: card?.permission,
        endpoint: card?.endpoint,
        handoffStatus: card?.handoffStatus,
        blockerCount: card?.blockerCount,
        reviewGateCount: card?.reviewGateCount,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok
      ? card
        ? `${card.handlerLabel} readiness review recorded.`
        : 'Handler readiness board review recorded.'
      : result.message)
  }

  const recordEngineeringHandoffPacketReview = (
    packet: BackendEngineeringHandoffPacket,
    nextStatus: BackendEngineeringHandoffPacketStatus = engineeringPacketStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Engineering Handoff Packet / ${packet.handlerKey}`,
      actionKey: `launch_gate.engineering_handoff_packet.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} engineering handoff packet: ${packet.handlerLabel}`,
      severity: nextStatus === 'Blocked' || packet.status === 'Blocked'
        ? 'critical'
        : nextStatus === 'Review' || nextStatus === 'Draft' || packet.risk === 'Critical'
          ? 'warning'
          : 'notice',
      metadata: {
        packetId: packet.id,
        specId: packet.specId,
        readinessCardId: packet.readinessCardId,
        previousStatus: packet.status,
        nextStatus,
        recommendedStatus: packet.recommendedStatus,
        risk: packet.risk,
        productOwner: packet.productOwner,
        engineeringOwner: engineeringPacketOwner,
        handlerKey: packet.handlerKey,
        handlerLabel: packet.handlerLabel,
        endpoint: packet.endpoint,
        method: packet.method,
        permission: packet.permission,
        mutationMode: packet.mutationMode,
        blockerCount: packet.blockerCount,
        reviewGateCount: packet.reviewGateCount,
        readyGateCount: packet.readyGateCount,
        testChecklistBlocked: packet.testChecklist.filter(check => check.status === 'Blocked').length,
        testChecklistReview: packet.testChecklist.filter(check => check.status === 'Review').length,
        acceptanceCriteriaBlocked: packet.launchAcceptanceCriteria.filter(check => check.status === 'Blocked').length,
        acceptanceCriteriaReview: packet.launchAcceptanceCriteria.filter(check => check.status === 'Review').length,
        dryRunRequired: packet.dryRunRequired,
        humanConfirmationRequired: packet.humanConfirmationRequired,
        idempotencyRequired: packet.idempotencyRequired,
        note: engineeringPacketNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const review = saveBackendEngineeringHandoffPacketReview({
      packet,
      status: nextStatus,
      engineeringOwner: engineeringPacketOwner,
      note: engineeringPacketNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedEngineeringPacketId(review.packetId)
    setNotice(`${review.status} recorded for ${packet.handlerLabel}.`)
  }

  const queueEngineeringHandoffPacket = (packet: BackendEngineeringHandoffPacket) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Engineering handoff: ${packet.handlerLabel}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: packet.handlerKey }),
      reason: `${packet.handoffSummary} Endpoint: ${packet.method} ${packet.endpoint}.`,
      rollbackNotes: packet.rollbackPlan,
      severity: packet.risk === 'Critical' || packet.status === 'Blocked' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.engineering_handoff_packet.action_request_queued.mock',
      auditActionLabel: `Queued engineering handoff packet: ${packet.handlerLabel}`,
      handlerKey: packet.handlerKey,
      handlerLabel: packet.handlerLabel,
      handlerDescription: `${packet.handlerLabel} must satisfy server permission checks, test checklist, launch acceptance criteria, idempotency, dry-run proof, rollback proof, and immutable audit logging before production execution.`,
      metadata: {
        packetId: packet.id,
        specId: packet.specId,
        readinessCardId: packet.readinessCardId,
        status: packet.status,
        recommendedStatus: packet.recommendedStatus,
        risk: packet.risk,
        productOwner: packet.productOwner,
        engineeringOwner: packet.engineeringOwner,
        endpoint: packet.endpoint,
        method: packet.method,
        permission: packet.permission,
        mutationMode: packet.mutationMode,
        testChecklist: packet.testChecklist.map(check => ({
          id: check.id,
          label: check.label,
          status: check.status,
        })),
        launchAcceptanceCriteria: packet.launchAcceptanceCriteria.map(check => ({
          id: check.id,
          label: check.label,
          status: check.status,
        })),
        rollbackPlan: packet.rollbackPlan,
        auditPlan: packet.auditPlan,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${packet.handlerLabel} handoff packet queued in Admin Action Requests.` : result.message)
  }

  const exportEngineeringHandoffPacket = (packet: BackendEngineeringHandoffPacket) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Engineering Handoff Packet / ${packet.handlerKey}`,
      actionKey: 'launch_gate.engineering_handoff_packet.exported.mock',
      actionLabel: `Exported engineering handoff packet: ${packet.handlerLabel}`,
      severity: packet.status === 'Blocked' || packet.risk === 'Critical' ? 'warning' : 'notice',
      metadata: {
        packetId: packet.id,
        specId: packet.specId,
        readinessCardId: packet.readinessCardId,
        handlerKey: packet.handlerKey,
        handlerLabel: packet.handlerLabel,
        endpoint: packet.endpoint,
        method: packet.method,
        permission: packet.permission,
        status: packet.status,
        risk: packet.risk,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildBackendEngineeringHandoffPacketHtml(packet, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getBackendEngineeringHandoffPacketFilename(packet)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${packet.handlerLabel} engineering handoff packet exported and recorded in Audit Logs.`)
  }

  const recordServerHandlerTestReview = (
    row: BackendServerHandlerTestRow,
    nextStatus: BackendServerHandlerTestMatrixStatus = serverTestStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Server Handler Test Matrix / ${row.handlerKey}`,
      actionKey: `launch_gate.server_handler_test_matrix.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} server handler test matrix: ${row.handlerLabel}`,
      severity: nextStatus === 'Blocked'
        ? 'critical'
        : nextStatus === 'Missing' || nextStatus === 'Review' || row.risk === 'Critical'
          ? 'warning'
          : 'notice',
      metadata: {
        rowId: row.id,
        packetId: row.packetId,
        specId: row.specId,
        readinessCardId: row.readinessCardId,
        previousStatus: row.status,
        nextStatus,
        recommendedStatus: row.recommendedStatus,
        risk: row.risk,
        productOwner: row.productOwner,
        engineeringOwner: serverTestOwner,
        handlerKey: row.handlerKey,
        handlerLabel: row.handlerLabel,
        endpoint: row.endpoint,
        method: row.method,
        permission: row.permission,
        mutationMode: row.mutationMode,
        coverageScore: row.coverageScore,
        requiredCaseCount: row.requiredCount,
        passedCaseCount: row.passedCount,
        readyCaseCount: row.readyCount,
        reviewCaseCount: row.reviewCount,
        blockedCaseCount: row.blockedCount,
        missingCaseCount: row.missingCount,
        dryRunRequired: row.dryRunRequired,
        humanConfirmationRequired: row.humanConfirmationRequired,
        idempotencyRequired: row.idempotencyRequired,
        note: serverTestNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveBackendServerHandlerTestRecord({
      row,
      status: nextStatus,
      owner: serverTestOwner,
      note: serverTestNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedServerTestRowId(record.rowId)
    setNotice(`${record.status} recorded for ${row.handlerLabel} test matrix.`)
  }

  const queueServerHandlerTestRequest = (row: BackendServerHandlerTestRow) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Server handler tests: ${row.handlerLabel}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: row.handlerKey }),
      reason: `${row.nextStep} Coverage: ${row.coverageScore}%. Endpoint: ${row.method} ${row.endpoint}.`,
      rollbackNotes: row.rollbackPlan,
      severity: row.risk === 'Critical' || row.status === 'Blocked' || row.status === 'Missing' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.server_handler_test_matrix.action_request_queued.mock',
      auditActionLabel: `Queued server handler test request: ${row.handlerLabel}`,
      handlerKey: row.handlerKey,
      handlerLabel: row.handlerLabel,
      handlerDescription: `${row.handlerLabel} test execution must prove permission denial, authorized actor scope, dry-run behavior, idempotency, audit shape, rollback reference, browser boundary, and launch acceptance before production execution.`,
      metadata: {
        rowId: row.id,
        packetId: row.packetId,
        specId: row.specId,
        readinessCardId: row.readinessCardId,
        status: row.status,
        recommendedStatus: row.recommendedStatus,
        risk: row.risk,
        productOwner: row.productOwner,
        engineeringOwner: row.engineeringOwner,
        endpoint: row.endpoint,
        method: row.method,
        permission: row.permission,
        mutationMode: row.mutationMode,
        coverageScore: row.coverageScore,
        testCases: row.testCases.map(test => ({
          id: test.id,
          type: test.type,
          label: test.label,
          status: test.status,
          required: test.required,
        })),
        rollbackPlan: row.rollbackPlan,
        auditPlan: row.auditPlan,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${row.handlerLabel} server handler test request queued.` : result.message)
  }

  const exportServerHandlerTestMatrix = (row: BackendServerHandlerTestRow) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Server Handler Test Matrix / ${row.handlerKey}`,
      actionKey: 'launch_gate.server_handler_test_matrix.exported.mock',
      actionLabel: `Exported server handler test matrix: ${row.handlerLabel}`,
      severity: row.status === 'Blocked' || row.status === 'Missing' || row.risk === 'Critical' ? 'warning' : 'notice',
      metadata: {
        rowId: row.id,
        packetId: row.packetId,
        specId: row.specId,
        readinessCardId: row.readinessCardId,
        handlerKey: row.handlerKey,
        handlerLabel: row.handlerLabel,
        endpoint: row.endpoint,
        method: row.method,
        permission: row.permission,
        status: row.status,
        risk: row.risk,
        coverageScore: row.coverageScore,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildBackendServerHandlerTestMatrixHtml(row, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getBackendServerHandlerTestMatrixFilename(row)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${row.handlerLabel} server handler test matrix exported and recorded in Audit Logs.`)
  }

  const recordServerTestEvidenceReview = (
    pack: BackendServerTestEvidencePack,
    nextStatus: BackendServerTestEvidencePackStatus = serverEvidenceStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Server Test Evidence Pack / ${pack.handlerKey}`,
      actionKey: `launch_gate.server_test_evidence_pack.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} server test evidence pack: ${pack.handlerLabel}`,
      severity: nextStatus === 'Blocked'
        ? 'critical'
        : nextStatus === 'Missing Evidence' || nextStatus === 'Evidence Review' || pack.risk === 'Critical'
          ? 'warning'
          : 'notice',
      metadata: {
        packId: pack.id,
        rowId: pack.rowId,
        packetId: pack.packetId,
        specId: pack.specId,
        readinessCardId: pack.readinessCardId,
        previousStatus: pack.status,
        nextStatus,
        recommendedStatus: pack.recommendedStatus,
        risk: pack.risk,
        productOwner: pack.productOwner,
        engineeringOwner: serverEvidenceOwner,
        evidenceLocation: serverEvidenceLocation,
        handlerKey: pack.handlerKey,
        handlerLabel: pack.handlerLabel,
        endpoint: pack.endpoint,
        method: pack.method,
        permission: pack.permission,
        mutationMode: pack.mutationMode,
        coverageScore: pack.coverageScore,
        requiredEvidenceCount: pack.requiredEvidenceCount,
        verifiedEvidenceCount: pack.verifiedEvidenceCount,
        missingEvidenceCount: pack.missingEvidenceCount,
        reviewEvidenceCount: pack.reviewEvidenceCount,
        readyEvidenceCount: pack.readyEvidenceCount,
        runbookStepCount: pack.runbookSteps.length,
        failureModeCount: pack.failureModes.length,
        exitCriteriaCount: pack.exitCriteria.length,
        dryRunRequired: pack.dryRunRequired,
        humanConfirmationRequired: pack.humanConfirmationRequired,
        idempotencyRequired: pack.idempotencyRequired,
        note: serverEvidenceNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveBackendServerTestEvidencePackRecord({
      pack,
      status: nextStatus,
      owner: serverEvidenceOwner,
      evidenceLocation: serverEvidenceLocation,
      note: serverEvidenceNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedServerEvidencePackId(record.packId)
    setNotice(`${record.status} recorded for ${pack.handlerLabel} evidence pack.`)
  }

  const queueServerTestEvidencePack = (pack: BackendServerTestEvidencePack) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Server test evidence: ${pack.handlerLabel}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: pack.handlerKey }),
      reason: `${pack.nextStep} Evidence: ${pack.verifiedEvidenceCount}/${pack.requiredEvidenceCount} verified. Endpoint: ${pack.method} ${pack.endpoint}.`,
      rollbackNotes: pack.rollbackPlan,
      severity: pack.risk === 'Critical' || pack.status === 'Blocked' || pack.status === 'Missing Evidence' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.server_test_evidence_pack.action_request_queued.mock',
      auditActionLabel: `Queued server test evidence pack: ${pack.handlerLabel}`,
      handlerKey: pack.handlerKey,
      handlerLabel: pack.handlerLabel,
      handlerDescription: `${pack.handlerLabel} runbook must capture permission, actor scope, dry-run, idempotency, audit, rollback, browser boundary, and launch acceptance evidence before production handler execution is enabled.`,
      metadata: {
        packId: pack.id,
        rowId: pack.rowId,
        packetId: pack.packetId,
        specId: pack.specId,
        readinessCardId: pack.readinessCardId,
        status: pack.status,
        recommendedStatus: pack.recommendedStatus,
        risk: pack.risk,
        productOwner: pack.productOwner,
        engineeringOwner: pack.engineeringOwner,
        endpoint: pack.endpoint,
        method: pack.method,
        permission: pack.permission,
        mutationMode: pack.mutationMode,
        coverageScore: pack.coverageScore,
        evidenceItems: pack.evidenceItems.map(item => ({
          id: item.id,
          type: item.type,
          label: item.label,
          status: item.status,
          required: item.required,
        })),
        runbookSteps: pack.runbookSteps.map(step => ({
          id: step.id,
          label: step.label,
          owner: step.owner,
          status: step.status,
        })),
        rollbackPlan: pack.rollbackPlan,
        auditPlan: pack.auditPlan,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${pack.handlerLabel} evidence pack queued for server test runbook execution.` : result.message)
  }

  const exportServerTestEvidencePack = (pack: BackendServerTestEvidencePack) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Server Test Evidence Pack / ${pack.handlerKey}`,
      actionKey: 'launch_gate.server_test_evidence_pack.exported.mock',
      actionLabel: `Exported server test evidence pack: ${pack.handlerLabel}`,
      severity: pack.status === 'Blocked' || pack.status === 'Missing Evidence' || pack.risk === 'Critical' ? 'warning' : 'notice',
      metadata: {
        packId: pack.id,
        rowId: pack.rowId,
        packetId: pack.packetId,
        specId: pack.specId,
        readinessCardId: pack.readinessCardId,
        handlerKey: pack.handlerKey,
        handlerLabel: pack.handlerLabel,
        endpoint: pack.endpoint,
        method: pack.method,
        permission: pack.permission,
        status: pack.status,
        risk: pack.risk,
        coverageScore: pack.coverageScore,
        requiredEvidenceCount: pack.requiredEvidenceCount,
        verifiedEvidenceCount: pack.verifiedEvidenceCount,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildBackendServerTestEvidencePackHtml(pack, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getBackendServerTestEvidencePackFilename(pack)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${pack.handlerLabel} server test evidence pack exported and recorded in Audit Logs.`)
  }

  const recordBackendExecutionReadinessReview = (
    row: BackendExecutionReadinessRow,
    nextStatus: BackendExecutionReadinessStatus = executionReadinessStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Backend Execution Readiness / ${row.handlerKey}`,
      actionKey: `launch_gate.backend_execution_readiness.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} backend execution readiness: ${row.handlerLabel}`,
      severity: nextStatus === 'Blocked'
        ? 'critical'
        : nextStatus === 'Review Only' || row.risk === 'Critical'
          ? 'warning'
          : 'notice',
      metadata: {
        readinessRowId: row.id,
        packId: row.packId,
        testRowId: row.rowId,
        previousStatus: row.status,
        nextStatus,
        recommendedStatus: row.recommendedStatus,
        risk: row.risk,
        productOwner: row.productOwner,
        engineeringOwner: executionReadinessOwner,
        handlerKey: row.handlerKey,
        handlerLabel: row.handlerLabel,
        endpoint: row.endpoint,
        method: row.method,
        permission: row.permission,
        mutationMode: row.mutationMode,
        evidenceStatus: row.evidenceStatus,
        endpointConfigured: row.endpointConfigured,
        queuedRequestCount: row.queuedRequestCount,
        activeRequestCount: row.activeRequestCount,
        mockExecutionCount: row.mockExecutionCount,
        passedDryRunCount: row.passedDryRunCount,
        auditEventCount: row.auditEventCount,
        blockerCount: row.blockerCount,
        reviewCount: row.reviewCount,
        readyCount: row.readyCount,
        verifiedCount: row.verifiedCount,
        dryRunRequired: row.dryRunRequired,
        humanConfirmationRequired: row.humanConfirmationRequired,
        idempotencyRequired: row.idempotencyRequired,
        note: executionReadinessNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveBackendExecutionReadinessRecord({
      row,
      status: nextStatus,
      owner: executionReadinessOwner,
      note: executionReadinessNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedExecutionReadinessRowId(record.rowId)
    setNotice(`${record.status} recorded for ${row.handlerLabel} execution readiness.`)
  }

  const queueBackendExecutionReadinessRequest = (row: BackendExecutionReadinessRow) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Backend execution readiness: ${row.handlerLabel}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: row.handlerKey }),
      reason: `${row.nextStep} Readiness checks: ${row.verifiedCount + row.readyCount}/${row.checks.length} ready or verified. Endpoint: ${row.method} ${row.endpoint}.`,
      rollbackNotes: row.rollbackPlan,
      severity: row.risk === 'Critical' || row.status === 'Blocked' || row.status === 'Review Only' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.backend_execution_readiness.action_request_queued.mock',
      auditActionLabel: `Queued backend execution readiness request: ${row.handlerLabel}`,
      handlerKey: row.handlerKey,
      handlerLabel: row.handlerLabel,
      handlerDescription: `${row.handlerLabel} must remain server-side only, enforce ${row.permission}, honor idempotency, capture rollback metadata, write immutable audit logs, and never execute production mutations from Platform Admin browser controls.`,
      metadata: {
        readinessRowId: row.id,
        packId: row.packId,
        testRowId: row.rowId,
        status: row.status,
        recommendedStatus: row.recommendedStatus,
        risk: row.risk,
        productOwner: row.productOwner,
        engineeringOwner: row.engineeringOwner,
        endpoint: row.endpoint,
        method: row.method,
        permission: row.permission,
        mutationMode: row.mutationMode,
        evidenceStatus: row.evidenceStatus,
        endpointConfigured: row.endpointConfigured,
        queuedRequestCount: row.queuedRequestCount,
        mockExecutionCount: row.mockExecutionCount,
        passedDryRunCount: row.passedDryRunCount,
        auditEventCount: row.auditEventCount,
        checks: row.checks.map(check => ({
          id: check.id,
          label: check.label,
          status: check.status,
        })),
        rollbackPlan: row.rollbackPlan,
        auditPlan: row.auditPlan,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${row.handlerLabel} execution readiness request queued.` : result.message)
  }

  const exportBackendExecutionReadiness = (row: BackendExecutionReadinessRow) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Backend Execution Readiness / ${row.handlerKey}`,
      actionKey: 'launch_gate.backend_execution_readiness.exported.mock',
      actionLabel: `Exported backend execution readiness: ${row.handlerLabel}`,
      severity: row.status === 'Blocked' || row.status === 'Review Only' || row.risk === 'Critical' ? 'warning' : 'notice',
      metadata: {
        readinessRowId: row.id,
        packId: row.packId,
        handlerKey: row.handlerKey,
        handlerLabel: row.handlerLabel,
        endpoint: row.endpoint,
        method: row.method,
        permission: row.permission,
        status: row.status,
        risk: row.risk,
        queuedRequestCount: row.queuedRequestCount,
        mockExecutionCount: row.mockExecutionCount,
        auditEventCount: row.auditEventCount,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildBackendExecutionReadinessHtml(row, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getBackendExecutionReadinessFilename(row)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${row.handlerLabel} execution readiness exported and recorded in Audit Logs.`)
  }

  const recordTrustedHandlerDeploymentReview = (
    item: TrustedHandlerDeploymentItem,
    nextStatus: TrustedHandlerDeploymentStatus = trustedDeploymentStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Trusted Handler Deployment / ${item.handlerKey}`,
      actionKey: `launch_gate.trusted_handler_deployment.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} trusted handler deployment checklist: ${item.handlerLabel}`,
      severity: nextStatus === 'Blocked'
        ? 'critical'
        : nextStatus === 'Needs Build Plan' || item.risk === 'Critical'
          ? 'warning'
          : 'notice',
      metadata: {
        deploymentItemId: item.id,
        executionReadinessRowId: item.executionReadinessRowId,
        previousStatus: item.status,
        nextStatus,
        recommendedStatus: item.recommendedStatus,
        readinessStatus: item.readinessStatus,
        risk: item.risk,
        productOwner: item.productOwner,
        engineeringOwner: trustedDeploymentOwner,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        mutationMode: item.mutationMode,
        endpointConfigured: item.endpointConfigured,
        queuedRequestCount: item.queuedRequestCount,
        dryRunProofCount: item.dryRunProofCount,
        auditEventCount: item.auditEventCount,
        blockerCount: item.blockerCount,
        reviewCount: item.reviewCount,
        readyCount: item.readyCount,
        verifiedCount: item.verifiedCount,
        requiredCheckCount: item.requiredCheckCount,
        note: trustedDeploymentNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveTrustedHandlerDeploymentRecord({
      item,
      status: nextStatus,
      owner: trustedDeploymentOwner,
      note: trustedDeploymentNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedTrustedDeploymentItemId(record.itemId)
    setNotice(`${record.status} recorded for ${item.handlerLabel} trusted handler checklist.`)
  }

  const queueTrustedHandlerDeploymentItem = (item: TrustedHandlerDeploymentItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Trusted handler build: ${item.handlerLabel}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.handlerKey }),
      reason: `${item.nextStep} Deployment checks: ${item.readyCount + item.verifiedCount}/${item.requiredCheckCount} ready or verified. Endpoint: ${item.method} ${item.endpoint}.`,
      rollbackNotes: item.rollbackPlan,
      severity: item.risk === 'Critical' || item.status === 'Blocked' || item.status === 'Needs Build Plan' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.trusted_handler_deployment.action_request_queued.mock',
      auditActionLabel: `Queued trusted handler deployment checklist: ${item.handlerLabel}`,
      handlerKey: item.handlerKey,
      handlerLabel: item.handlerLabel,
      handlerDescription: `${item.handlerLabel} must be implemented server-side only with secret-key isolation, ${item.permission}, payload validation, idempotency, dry-run mode, rollback metadata, immutable audit logging, release toggle, and monitoring before any production mutation is enabled.`,
      metadata: {
        deploymentItemId: item.id,
        executionReadinessRowId: item.executionReadinessRowId,
        status: item.status,
        recommendedStatus: item.recommendedStatus,
        readinessStatus: item.readinessStatus,
        risk: item.risk,
        productOwner: item.productOwner,
        engineeringOwner: item.engineeringOwner,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        mutationMode: item.mutationMode,
        endpointConfigured: item.endpointConfigured,
        queuedRequestCount: item.queuedRequestCount,
        dryRunProofCount: item.dryRunProofCount,
        auditEventCount: item.auditEventCount,
        checks: item.checks.map(check => ({
          id: check.id,
          category: check.category,
          label: check.label,
          status: check.status,
          required: check.required,
        })),
        buildPlan: item.buildPlan,
        serverRoutePlan: item.serverRoutePlan,
        securityPlan: item.securityPlan,
        observabilityPlan: item.observabilityPlan,
        releasePlan: item.releasePlan,
        rollbackPlan: item.rollbackPlan,
        auditPlan: item.auditPlan,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${item.handlerLabel} trusted handler build request queued.` : result.message)
  }

  const exportTrustedHandlerDeployment = (item: TrustedHandlerDeploymentItem) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Trusted Handler Deployment / ${item.handlerKey}`,
      actionKey: 'launch_gate.trusted_handler_deployment.exported.mock',
      actionLabel: `Exported trusted handler deployment checklist: ${item.handlerLabel}`,
      severity: item.status === 'Blocked' || item.status === 'Needs Build Plan' || item.risk === 'Critical' ? 'warning' : 'notice',
      metadata: {
        deploymentItemId: item.id,
        executionReadinessRowId: item.executionReadinessRowId,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        status: item.status,
        risk: item.risk,
        requiredCheckCount: item.requiredCheckCount,
        readyCount: item.readyCount,
        verifiedCount: item.verifiedCount,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildTrustedHandlerDeploymentHtml(item, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getTrustedHandlerDeploymentFilename(item)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${item.handlerLabel} trusted handler deployment checklist exported and recorded in Audit Logs.`)
  }

  const recordBackendReleaseCommandReview = (
    item: BackendReleaseCommandItem,
    nextStatus: BackendReleaseCommandStatus = releaseCommandStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Backend Release Command / ${item.handlerKey}`,
      actionKey: `launch_gate.backend_release_command.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} backend release command: ${item.handlerLabel}`,
      severity: nextStatus === 'Blocked'
        ? 'critical'
        : nextStatus === 'Build Planning' || item.risk === 'Critical'
          ? 'warning'
          : 'notice',
      metadata: {
        releaseCommandItemId: item.id,
        deploymentItemId: item.deploymentItemId,
        previousStatus: item.status,
        nextStatus,
        recommendedStatus: item.recommendedStatus,
        deploymentStatus: item.deploymentStatus,
        lane: item.lane,
        risk: item.risk,
        productOwner: item.productOwner,
        engineeringOwner: item.engineeringOwner,
        releaseOwner: releaseCommandOwner,
        releaseWindow: releaseCommandWindow,
        goNoGo: item.goNoGo,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        mutationMode: item.mutationMode,
        endpointConfigured: item.endpointConfigured,
        queuedRequestCount: item.queuedRequestCount,
        approvedRequestCount: item.approvedRequestCount,
        activeRequestCount: item.activeRequestCount,
        completedRequestCount: item.completedRequestCount,
        dryRunProofCount: item.dryRunProofCount,
        auditEventCount: item.auditEventCount,
        blockerCount: item.blockerCount,
        reviewCount: item.reviewCount,
        readyCount: item.readyCount,
        verifiedCount: item.verifiedCount,
        note: releaseCommandNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveBackendReleaseCommandRecord({
      item,
      status: nextStatus,
      owner: releaseCommandOwner,
      releaseWindow: releaseCommandWindow,
      note: releaseCommandNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedReleaseCommandItemId(record.itemId)
    setNotice(`${record.status} recorded for ${item.handlerLabel} release command.`)
  }

  const queueBackendReleaseCommandItem = (item: BackendReleaseCommandItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Backend release command: ${item.handlerLabel}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.handlerKey }),
      reason: `${item.nextStep} Go/no-go: ${item.goNoGo}. Release window: ${releaseCommandWindow || item.releaseWindow}.`,
      rollbackNotes: item.rollbackPlan,
      severity: item.risk === 'Critical' || item.status === 'Blocked' || item.status === 'Build Planning' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.backend_release_command.action_request_queued.mock',
      auditActionLabel: `Queued backend release command: ${item.handlerLabel}`,
      handlerKey: item.handlerKey,
      handlerLabel: item.handlerLabel,
      handlerDescription: `${item.handlerLabel} release command is a server-side engineering handoff. Production release requires trusted deployment outside the browser, owner approval, rollback proof, audit logging, monitoring, and a visible go/no-go record.`,
      metadata: {
        releaseCommandItemId: item.id,
        deploymentItemId: item.deploymentItemId,
        status: item.status,
        recommendedStatus: item.recommendedStatus,
        deploymentStatus: item.deploymentStatus,
        lane: item.lane,
        risk: item.risk,
        productOwner: item.productOwner,
        engineeringOwner: item.engineeringOwner,
        releaseOwner: item.releaseOwner,
        releaseWindow: releaseCommandWindow || item.releaseWindow,
        goNoGo: item.goNoGo,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        mutationMode: item.mutationMode,
        queuedRequestCount: item.queuedRequestCount,
        dryRunProofCount: item.dryRunProofCount,
        auditEventCount: item.auditEventCount,
        checks: item.checks.map(check => ({
          id: check.id,
          label: check.label,
          status: check.status,
        })),
        buildPlan: item.buildPlan,
        releasePlan: item.releasePlan,
        monitoringPlan: item.monitoringPlan,
        rollbackPlan: item.rollbackPlan,
        auditPlan: item.auditPlan,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${item.handlerLabel} backend release command queued.` : result.message)
  }

  const exportBackendReleaseCommand = (item: BackendReleaseCommandItem) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Backend Release Command / ${item.handlerKey}`,
      actionKey: 'launch_gate.backend_release_command.exported.mock',
      actionLabel: `Exported backend release command: ${item.handlerLabel}`,
      severity: item.status === 'Blocked' || item.status === 'Build Planning' || item.risk === 'Critical' ? 'warning' : 'notice',
      metadata: {
        releaseCommandItemId: item.id,
        deploymentItemId: item.deploymentItemId,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        status: item.status,
        risk: item.risk,
        lane: item.lane,
        goNoGo: item.goNoGo,
        releaseWindow: item.releaseWindow,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildBackendReleaseCommandHtml(item, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getBackendReleaseCommandFilename(item)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${item.handlerLabel} backend release command exported and recorded in Audit Logs.`)
  }

  const recordBackendWatchReview = (
    item: BackendWatchItem,
    nextStatus: BackendWatchMonitorStatus = backendWatchStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Backend Watch Monitor / ${item.handlerKey}`,
      actionKey: `launch_gate.backend_watch_monitor.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} backend watch monitor: ${item.handlerLabel}`,
      severity: nextStatus === 'Critical Drift'
        ? 'critical'
        : nextStatus === 'Watch' || item.risk === 'Critical'
          ? 'warning'
          : 'notice',
      metadata: {
        backendWatchItemId: item.id,
        releaseCommandItemId: item.releaseCommandItemId,
        previousStatus: item.status,
        nextStatus,
        recommendedStatus: item.recommendedStatus,
        releaseStatus: item.releaseStatus,
        lane: item.lane,
        risk: item.risk,
        productOwner: item.productOwner,
        engineeringOwner: item.engineeringOwner,
        releaseOwner: item.releaseOwner,
        watchOwner: backendWatchOwner,
        releaseWindow: item.releaseWindow,
        goNoGo: item.goNoGo,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        mutationMode: item.mutationMode,
        queuedRequestCount: item.queuedRequestCount,
        activeRequestCount: item.activeRequestCount,
        completedRequestCount: item.completedRequestCount,
        blockedRequestCount: item.blockedRequestCount,
        failedRequestCount: item.failedRequestCount,
        auditEventCount: item.auditEventCount,
        dryRunProofCount: item.dryRunProofCount,
        supportFollowUpCount: item.supportFollowUpCount,
        criticalSignalCount: item.criticalSignalCount,
        watchSignalCount: item.watchSignalCount,
        stableSignalCount: item.stableSignalCount,
        verifiedSignalCount: item.verifiedSignalCount,
        note: backendWatchNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveBackendWatchRecord({
      item,
      status: nextStatus,
      owner: backendWatchOwner,
      note: backendWatchNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedBackendWatchItemId(record.itemId)
    setNotice(`${record.status} recorded for ${item.handlerLabel} backend watch.`)
  }

  const queueBackendWatchFollowUp = (item: BackendWatchItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Backend watch follow-up: ${item.handlerLabel}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.handlerKey }),
      reason: `${item.nextStep} Critical signals: ${item.criticalSignalCount}. Watch signals: ${item.watchSignalCount}.`,
      rollbackNotes: item.rollbackPlan,
      severity: item.status === 'Critical Drift' || item.risk === 'Critical' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.backend_watch_monitor.follow_up_queued.mock',
      auditActionLabel: `Queued backend watch follow-up: ${item.handlerLabel}`,
      handlerKey: item.handlerKey,
      handlerLabel: item.handlerLabel,
      handlerDescription: `${item.handlerLabel} backend watch follow-up is review-only from Platform Admin. Any production remediation, rollback, module, billing, permission, or support-state mutation must happen through trusted server handlers after approval and audit logging.`,
      metadata: {
        backendWatchItemId: item.id,
        releaseCommandItemId: item.releaseCommandItemId,
        status: item.status,
        recommendedStatus: item.recommendedStatus,
        releaseStatus: item.releaseStatus,
        lane: item.lane,
        risk: item.risk,
        watchOwner: item.watchOwner,
        releaseWindow: item.releaseWindow,
        goNoGo: item.goNoGo,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        mutationMode: item.mutationMode,
        queuedRequestCount: item.queuedRequestCount,
        activeRequestCount: item.activeRequestCount,
        blockedRequestCount: item.blockedRequestCount,
        failedRequestCount: item.failedRequestCount,
        auditEventCount: item.auditEventCount,
        dryRunProofCount: item.dryRunProofCount,
        supportFollowUpCount: item.supportFollowUpCount,
        signals: item.signals.map(signal => ({
          id: signal.id,
          type: signal.type,
          label: signal.label,
          status: signal.status,
        })),
        watchPlan: item.watchPlan,
        supportPlan: item.supportPlan,
        rollbackPlan: item.rollbackPlan,
        auditPlan: item.auditPlan,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${item.handlerLabel} backend watch follow-up queued.` : result.message)
  }

  const exportBackendWatchItem = (item: BackendWatchItem) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Backend Watch Monitor / ${item.handlerKey}`,
      actionKey: 'launch_gate.backend_watch_monitor.exported.mock',
      actionLabel: `Exported backend watch monitor: ${item.handlerLabel}`,
      severity: item.status === 'Critical Drift' || item.status === 'Watch' || item.risk === 'Critical' ? 'warning' : 'notice',
      metadata: {
        backendWatchItemId: item.id,
        releaseCommandItemId: item.releaseCommandItemId,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        status: item.status,
        releaseStatus: item.releaseStatus,
        risk: item.risk,
        criticalSignalCount: item.criticalSignalCount,
        watchSignalCount: item.watchSignalCount,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildBackendWatchHtml(item, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getBackendWatchFilename(item)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${item.handlerLabel} backend watch monitor exported and recorded in Audit Logs.`)
  }

  const recordBackendClosureEvidence = (
    item: BackendClosureEvidenceItem,
    nextStatus: BackendClosureEvidenceStatus = backendClosureStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Backend Closure Evidence / ${item.handlerKey}`,
      actionKey: `launch_gate.backend_closure_evidence.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} backend closure evidence: ${item.handlerLabel}`,
      severity: nextStatus === 'Blocked'
        ? 'critical'
        : nextStatus === 'Evidence Review' || item.risk === 'Critical'
          ? 'warning'
          : 'notice',
      metadata: {
        backendClosureEvidenceItemId: item.id,
        backendWatchItemId: item.backendWatchItemId,
        previousStatus: item.status,
        nextStatus,
        recommendedStatus: item.recommendedStatus,
        watchStatus: item.watchStatus,
        releaseStatus: item.releaseStatus,
        risk: item.risk,
        productOwner: item.productOwner,
        engineeringOwner: item.engineeringOwner,
        releaseOwner: item.releaseOwner,
        watchOwner: item.watchOwner,
        closureOwner: backendClosureOwner,
        packetLocation: backendClosurePacketLocation,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        mutationMode: item.mutationMode,
        auditEventCount: item.auditEventCount,
        dryRunProofCount: item.dryRunProofCount,
        supportFollowUpCount: item.supportFollowUpCount,
        missingCount: item.missingCount,
        reviewCount: item.reviewCount,
        readyCount: item.readyCount,
        verifiedCount: item.verifiedCount,
        requiredReadyCount: item.requiredReadyCount,
        requiredCount: item.requiredCount,
        note: backendClosureNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveBackendClosureEvidenceRecord({
      item,
      status: nextStatus,
      owner: backendClosureOwner,
      packetLocation: backendClosurePacketLocation,
      note: backendClosureNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedBackendClosureItemId(record.itemId)
    setNotice(`${record.status} recorded for ${item.handlerLabel} backend closure evidence.`)
  }

  const queueBackendClosureEvidenceFollowUp = (item: BackendClosureEvidenceItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Backend closure evidence: ${item.handlerLabel}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.handlerKey }),
      reason: `${item.nextStep} Required evidence: ${item.requiredReadyCount}/${item.requiredCount}.`,
      rollbackNotes: item.rollbackPlan,
      severity: item.status === 'Blocked' || item.risk === 'Critical' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.backend_closure_evidence.follow_up_queued.mock',
      auditActionLabel: `Queued backend closure evidence follow-up: ${item.handlerLabel}`,
      handlerKey: item.handlerKey,
      handlerLabel: item.handlerLabel,
      handlerDescription: `${item.handlerLabel} backend closure evidence follow-up is packet and review coordination only. Any production remediation, rollback, billing, module, permission, support-state, or agent mutation must run server-side after approval and audit logging.`,
      metadata: {
        backendClosureEvidenceItemId: item.id,
        backendWatchItemId: item.backendWatchItemId,
        status: item.status,
        recommendedStatus: item.recommendedStatus,
        watchStatus: item.watchStatus,
        releaseStatus: item.releaseStatus,
        risk: item.risk,
        closureOwner: item.closureOwner,
        packetLocation: item.packetLocation,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        mutationMode: item.mutationMode,
        missingCount: item.missingCount,
        reviewCount: item.reviewCount,
        requiredReadyCount: item.requiredReadyCount,
        requiredCount: item.requiredCount,
        checks: item.checks.map(check => ({
          id: check.id,
          category: check.category,
          label: check.label,
          status: check.status,
        })),
        closurePlan: item.closurePlan,
        rollbackPlan: item.rollbackPlan,
        auditPlan: item.auditPlan,
        supportPlan: item.supportPlan,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${item.handlerLabel} backend closure evidence follow-up queued.` : result.message)
  }

  const exportBackendClosureEvidence = (item: BackendClosureEvidenceItem) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Backend Closure Evidence / ${item.handlerKey}`,
      actionKey: 'launch_gate.backend_closure_evidence.exported.mock',
      actionLabel: `Exported backend closure evidence: ${item.handlerLabel}`,
      severity: item.status === 'Blocked' || item.status === 'Evidence Review' || item.risk === 'Critical' ? 'warning' : 'notice',
      metadata: {
        backendClosureEvidenceItemId: item.id,
        backendWatchItemId: item.backendWatchItemId,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        status: item.status,
        watchStatus: item.watchStatus,
        releaseStatus: item.releaseStatus,
        risk: item.risk,
        missingCount: item.missingCount,
        reviewCount: item.reviewCount,
        requiredReadyCount: item.requiredReadyCount,
        requiredCount: item.requiredCount,
        packetLocation: item.packetLocation,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildBackendClosureEvidenceHtml(item, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getBackendClosureEvidenceFilename(item)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${item.handlerLabel} backend closure evidence packet exported and recorded in Audit Logs.`)
  }

  const recordProductionGuardrailReview = (
    item: ProductionGuardrailItem,
    nextStatus: ProductionGuardrailStatus = productionGuardrailStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Production Guardrail Matrix / ${item.handlerKey}`,
      actionKey: `launch_gate.production_guardrail.${nextStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${nextStatus} production guardrail review: ${item.handlerLabel}`,
      severity: nextStatus === 'Blocked'
        ? 'critical'
        : nextStatus === 'Guardrail Review' || item.risk === 'Critical'
          ? 'warning'
          : 'notice',
      metadata: {
        productionGuardrailItemId: item.id,
        backendClosureEvidenceItemId: item.backendClosureEvidenceItemId,
        previousStatus: item.status,
        nextStatus,
        recommendedStatus: item.recommendedStatus,
        closureStatus: item.closureStatus,
        watchStatus: item.watchStatus,
        releaseStatus: item.releaseStatus,
        risk: item.risk,
        productOwner: item.productOwner,
        engineeringOwner: item.engineeringOwner,
        closureOwner: item.closureOwner,
        guardrailOwner: productionGuardrailOwner,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        mutationMode: item.mutationMode,
        browserMutationBlocked: item.browserMutationBlocked,
        serverExecutionRequired: item.serverExecutionRequired,
        humanConfirmationRequired: item.humanConfirmationRequired,
        auditRequired: item.auditRequired,
        rollbackRequired: item.rollbackRequired,
        dryRunRequired: item.dryRunRequired,
        auditEventCount: item.auditEventCount,
        dryRunProofCount: item.dryRunProofCount,
        supportFollowUpCount: item.supportFollowUpCount,
        missingCount: item.missingCount,
        reviewCount: item.reviewCount,
        readyCount: item.readyCount,
        verifiedCount: item.verifiedCount,
        requiredSatisfiedCount: item.requiredSatisfiedCount,
        requiredCount: item.requiredCount,
        note: productionGuardrailNote,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveProductionGuardrailRecord({
      item,
      status: nextStatus,
      owner: productionGuardrailOwner,
      note: productionGuardrailNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedProductionGuardrailItemId(record.itemId)
    setNotice(`${record.status} recorded for ${item.handlerLabel} production guardrails.`)
  }

  const queueProductionGuardrailFollowUp = (item: ProductionGuardrailItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Production guardrails: ${item.handlerLabel}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.handlerKey }),
      reason: `${item.nextStep} Required guardrails: ${item.requiredSatisfiedCount}/${item.requiredCount}.`,
      rollbackNotes: item.escalationPlan,
      severity: item.status === 'Blocked' || item.risk === 'Critical' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.production_guardrail.follow_up_queued.mock',
      auditActionLabel: `Queued production guardrail follow-up: ${item.handlerLabel}`,
      handlerKey: item.handlerKey,
      handlerLabel: item.handlerLabel,
      handlerDescription: `${item.handlerLabel} production guardrail follow-up is safety review only. Any production execution, rollback, billing, module, permission, support-state, or agent mutation must happen through trusted server handlers after approval and audit logging.`,
      metadata: {
        productionGuardrailItemId: item.id,
        backendClosureEvidenceItemId: item.backendClosureEvidenceItemId,
        status: item.status,
        recommendedStatus: item.recommendedStatus,
        closureStatus: item.closureStatus,
        watchStatus: item.watchStatus,
        releaseStatus: item.releaseStatus,
        risk: item.risk,
        guardrailOwner: item.guardrailOwner,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        mutationMode: item.mutationMode,
        browserMutationBlocked: item.browserMutationBlocked,
        serverExecutionRequired: item.serverExecutionRequired,
        humanConfirmationRequired: item.humanConfirmationRequired,
        auditRequired: item.auditRequired,
        rollbackRequired: item.rollbackRequired,
        dryRunRequired: item.dryRunRequired,
        missingCount: item.missingCount,
        reviewCount: item.reviewCount,
        requiredSatisfiedCount: item.requiredSatisfiedCount,
        requiredCount: item.requiredCount,
        checks: item.checks.map(check => ({
          id: check.id,
          category: check.category,
          label: check.label,
          status: check.status,
        })),
        productionBoundary: item.productionBoundary,
        verificationPlan: item.verificationPlan,
        escalationPlan: item.escalationPlan,
        localOnly: true,
        mutationApplied: false,
      },
    })

    setNotice(result.ok ? `${item.handlerLabel} production guardrail follow-up queued.` : result.message)
  }

  const exportProductionGuardrail = (item: ProductionGuardrailItem) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Production Guardrail Matrix / ${item.handlerKey}`,
      actionKey: 'launch_gate.production_guardrail.exported.mock',
      actionLabel: `Exported production guardrail matrix: ${item.handlerLabel}`,
      severity: item.status === 'Blocked' || item.status === 'Guardrail Review' || item.risk === 'Critical' ? 'warning' : 'notice',
      metadata: {
        productionGuardrailItemId: item.id,
        backendClosureEvidenceItemId: item.backendClosureEvidenceItemId,
        handlerKey: item.handlerKey,
        handlerLabel: item.handlerLabel,
        endpoint: item.endpoint,
        method: item.method,
        permission: item.permission,
        status: item.status,
        closureStatus: item.closureStatus,
        watchStatus: item.watchStatus,
        releaseStatus: item.releaseStatus,
        risk: item.risk,
        missingCount: item.missingCount,
        reviewCount: item.reviewCount,
        requiredSatisfiedCount: item.requiredSatisfiedCount,
        requiredCount: item.requiredCount,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildProductionGuardrailHtml(item, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getProductionGuardrailFilename(item)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${item.handlerLabel} production guardrail matrix exported and recorded in Audit Logs.`)
  }

  const recordExecutiveGoNoGoDecision = (
    nextDecision: ExecutiveGoNoGoDecision = executiveGoNoGoDecision,
  ) => {
    const result = runAdminAction(session, {
      permission: 'settings.manage',
      scope: 'Executive Go / No-Go Evidence Room',
      actionKey: `launch_gate.executive_go_no_go.${nextDecision.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `Recorded executive Go / No-Go decision: ${nextDecision}`,
      severity: nextDecision === 'No Go' ? 'critical' : nextDecision === 'Conditional Go' ? 'warning' : 'notice',
      metadata: {
        suggestedDecision: executiveGoNoGoRoom.decision,
        recordedDecision: nextDecision,
        owner: executiveGoNoGoOwner,
        conditionNote: executiveGoNoGoConditionNote,
        acceptedRisk: executiveGoNoGoAcceptedRisk,
        readinessScore: executiveGoNoGoRoom.readinessScore,
        launchStatus: executiveGoNoGoRoom.launchStatus,
        blockerCount: executiveGoNoGoRoom.blockedCount,
        conditionCount: executiveGoNoGoRoom.conditionCount,
        requiredClearCount: executiveGoNoGoRoom.requiredClearCount,
        requiredCount: executiveGoNoGoRoom.requiredCount,
        auditBackedCount: executiveGoNoGoRoom.auditBackedCount,
        nextEvidenceItem: executiveGoNoGoRoom.nextItem?.title,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveExecutiveGoNoGoRecord({
      room: executiveGoNoGoRoom,
      decision: nextDecision,
      owner: executiveGoNoGoOwner,
      conditionNote: executiveGoNoGoConditionNote,
      acceptedRisk: executiveGoNoGoAcceptedRisk,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.decision} executive Go / No-Go decision recorded in Audit Logs and Decision Room.`)
  }

  const exportExecutiveGoNoGoRoom = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Executive Go / No-Go Evidence Room',
      actionKey: 'launch_gate.executive_go_no_go.exported.mock',
      actionLabel: `Exported executive Go / No-Go evidence room: ${executiveGoNoGoRoom.decision}`,
      severity: executiveGoNoGoRoom.decision === 'No Go' ? 'warning' : 'notice',
      metadata: {
        decision: executiveGoNoGoRoom.decision,
        readinessScore: executiveGoNoGoRoom.readinessScore,
        launchStatus: executiveGoNoGoRoom.launchStatus,
        blockerCount: executiveGoNoGoRoom.blockedCount,
        conditionCount: executiveGoNoGoRoom.conditionCount,
        requiredClearCount: executiveGoNoGoRoom.requiredClearCount,
        requiredCount: executiveGoNoGoRoom.requiredCount,
        auditBackedCount: executiveGoNoGoRoom.auditBackedCount,
        evidenceItems: executiveGoNoGoRoom.items.length,
        recordCount: executiveGoNoGoRoom.recordCount,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildExecutiveGoNoGoHtml(executiveGoNoGoRoom, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getExecutiveGoNoGoFilename(executiveGoNoGoRoom)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${executiveGoNoGoRoom.decision} executive Go / No-Go evidence room exported and recorded in Audit Logs.`)
  }

  const recordLaunchWarRoomPulse = () => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: 'Launch War Room Timeline',
      actionKey: `launch_gate.war_room.${launchWarRoomTimeline.status.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `Recorded launch war room pulse: ${launchWarRoomTimeline.status}`,
      severity: launchWarRoomTimeline.status === 'Critical'
        ? 'critical'
        : launchWarRoomTimeline.status === 'Review' ? 'warning' : 'notice',
      metadata: {
        warRoomStatus: launchWarRoomTimeline.status,
        summary: launchWarRoomTimeline.summary,
        timelineEvents: launchWarRoomTimeline.events.length,
        criticalEvents: launchWarRoomTimeline.criticalCount,
        actionNeededEvents: launchWarRoomTimeline.actionNeededCount,
        recordedEvents: launchWarRoomTimeline.recordedCount,
        verifiedEvents: launchWarRoomTimeline.verifiedCount,
        auditBackedEvents: launchWarRoomTimeline.auditBackedCount,
        localOnlyEvents: launchWarRoomTimeline.localOnlyCount,
        activeOwners: launchWarRoomTimeline.activeOwnerCount,
        latestEvent: launchWarRoomTimeline.nextEvent?.title,
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const pulse = saveLaunchWarRoomPulse({
      timeline: launchWarRoomTimeline,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${pulse.status} launch war room pulse recorded in Audit Logs and Timeline Pulse Ledger.`)
  }

  const exportLaunchWarRoomTimeline = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch War Room Timeline',
      actionKey: 'launch_gate.war_room.exported.mock',
      actionLabel: `Exported launch war room timeline: ${launchWarRoomTimeline.status}`,
      severity: launchWarRoomTimeline.status === 'Critical' ? 'warning' : 'notice',
      metadata: {
        warRoomStatus: launchWarRoomTimeline.status,
        timelineEvents: launchWarRoomTimeline.events.length,
        criticalEvents: launchWarRoomTimeline.criticalCount,
        actionNeededEvents: launchWarRoomTimeline.actionNeededCount,
        auditBackedEvents: launchWarRoomTimeline.auditBackedCount,
        pulseCount: launchWarRoomTimeline.pulseCount,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchWarRoomTimelineHtml(launchWarRoomTimeline, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchWarRoomTimelineFilename(launchWarRoomTimeline)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchWarRoomTimeline.status} launch war room timeline exported and recorded in Audit Logs.`)
  }

  const openLaunchSavedView = (view: LaunchCommandSavedView) => {
    const result = runAdminAction(session, {
      permission: 'saved_views.view',
      scope: `Launch Command Saved Views / ${view.name}`,
      actionKey: `launch_gate.saved_view.${view.id}.applied.mock`,
      actionLabel: `Applied launch command saved view: ${view.name}`,
      severity: view.status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchSavedViewMetadata(view, {
        targetSurface: view.defaultSurface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedSavedViewId(view.id)
    setViewMode(view.defaultSurface)
    setNotice(`${view.name} opened as a read-only Launch Gate filter.`)
  }

  const recordLaunchSavedView = (view: LaunchCommandSavedView) => {
    const result = runAdminAction(session, {
      permission: 'saved_views.manage',
      scope: `Launch Command Saved Views / ${view.name}`,
      actionKey: `launch_gate.saved_view.${view.id}.saved.mock`,
      actionLabel: `Saved launch command view: ${view.name}`,
      severity: view.status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchSavedViewMetadata(view, {
        savedRecordCount: launchCommandSavedViews.savedRecordCount,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchCommandSavedViewRecord({
      view,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedSavedViewId(record.viewId)
    setNotice(`${record.viewName} saved locally and recorded in Audit Logs.`)
  }

  const exportLaunchSavedView = (view: LaunchCommandSavedView) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Launch Command Saved Views / ${view.name}`,
      actionKey: `launch_gate.saved_view.${view.id}.exported.mock`,
      actionLabel: `Exported launch command saved view: ${view.name}`,
      severity: view.status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchSavedViewMetadata(view, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchCommandSavedViewHtml(view, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchCommandSavedViewFilename(view)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${view.name} launch command saved view exported and recorded in Audit Logs.`)
  }

  const openLaunchExceptionSlaSurface = (item: LaunchExceptionSlaItem) => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: `Launch Exception SLA / ${item.title}`,
      actionKey: `launch_gate.exception_sla.${sanitizeLaunchActionKey(item.id)}.opened_surface.mock`,
      actionLabel: `Opened launch exception SLA surface: ${item.title}`,
      severity: item.status === 'Overdue' ? 'warning' : 'notice',
      metadata: buildLaunchExceptionSlaMetadata(item, {
        targetSurface: item.defaultSurface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedExceptionSlaItemId(item.id)
    setViewMode(item.defaultSurface)
    setNotice(`${item.title} opened as a read-only Launch Gate SLA target.`)
  }

  const recordLaunchExceptionSlaReview = (
    item: LaunchExceptionSlaItem,
    reviewStatus: LaunchExceptionSlaReviewStatus,
  ) => {
    const result = runAdminAction(session, {
      permission: 'notifications.manage',
      scope: `Launch Exception SLA / ${item.title}`,
      actionKey: `launch_gate.exception_sla.${sanitizeLaunchActionKey(item.id)}.${reviewStatus.toLowerCase()}.mock`,
      actionLabel: `${reviewStatus} launch exception SLA: ${item.title}`,
      severity: reviewStatus === 'Escalated' || item.status === 'Overdue' ? 'warning' : 'notice',
      metadata: buildLaunchExceptionSlaMetadata(item, {
        reviewStatus,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchExceptionSlaRecord({
      item,
      reviewStatus,
      note: reviewStatus === 'Escalated'
        ? 'Escalated for launch owner review from the Launch Exception SLA Board.'
        : 'Reviewed from the Launch Exception SLA Board.',
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSelectedExceptionSlaItemId(record.itemId)
    setNotice(`${record.itemTitle} marked ${record.reviewStatus.toLowerCase()} and recorded in Audit Logs.`)
  }

  const queueLaunchExceptionSlaHandoff = (item: LaunchExceptionSlaItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Launch exception SLA handoff: ${item.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.reference }),
      reason: `${item.nextStep} SLA: ${formatLaunchSlaRemaining(item.minutesRemaining)}. Source: ${item.source}.`,
      rollbackNotes: 'Launch exception SLA handoff is review routing only. Any production mutation must use an approved server-side handler with its own rollback plan.',
      severity: item.status === 'Overdue' || item.priority === 'Critical' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.exception_sla.handoff_queued.mock',
      auditActionLabel: `Queued launch exception SLA handoff: ${item.title}`,
      handlerKey: `launch_exception_sla_${sanitizeLaunchActionKey(item.id)}`,
      handlerLabel: `${item.title} SLA handoff`,
      handlerDescription: `${item.title} launch SLA handoff routes owner review only. It must not mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildLaunchExceptionSlaMetadata(item, {
        handoffRequired: item.actionHandoffRequired,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    setNotice(result.ok ? `${item.title} SLA handoff queued in Admin Action Requests.` : result.message)
  }

  const exportLaunchExceptionSlaBoard = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Exception SLA Board',
      actionKey: 'launch_gate.exception_sla.exported.mock',
      actionLabel: `Exported launch exception SLA board: ${launchExceptionSlaBoard.status}`,
      severity: launchExceptionSlaBoard.status === 'Overdue' ? 'warning' : 'notice',
      metadata: {
        boardStatus: launchExceptionSlaBoard.status,
        totalItems: launchExceptionSlaBoard.totalCount,
        overdueItems: launchExceptionSlaBoard.overdueCount,
        dueSoonItems: launchExceptionSlaBoard.dueSoonCount,
        actionHandoffs: launchExceptionSlaBoard.actionHandoffCount,
        executiveReviews: launchExceptionSlaBoard.executiveReviewCount,
        auditBackedItems: launchExceptionSlaBoard.auditBackedCount,
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchExceptionSlaHtml(launchExceptionSlaBoard, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchExceptionSlaFilename(launchExceptionSlaBoard)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchExceptionSlaBoard.status} launch exception SLA board exported and recorded in Audit Logs.`)
  }

  const openOwnerBriefDecisionSurface = (decision: LaunchOwnerDailyBriefDecision) => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: `Launch Owner Daily Brief / ${decision.title}`,
      actionKey: `launch_gate.owner_brief.${sanitizeLaunchActionKey(decision.id)}.opened_surface.mock`,
      actionLabel: `Opened owner brief decision target: ${decision.title}`,
      severity: decision.status === 'Critical' ? 'warning' : 'notice',
      metadata: buildLaunchOwnerBriefDecisionMetadata(decision, {
        targetSurface: decision.surface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedOwnerBriefDecisionId(decision.id)
    setViewMode(decision.surface)
    setNotice(`${decision.title} opened as a read-only owner brief target.`)
  }

  const recordLaunchOwnerDailyBrief = () => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: 'Launch Owner Daily Brief',
      actionKey: `launch_gate.owner_brief.${launchOwnerDailyBrief.status.toLowerCase()}.recorded.mock`,
      actionLabel: `Recorded launch owner daily brief: ${launchOwnerDailyBrief.status}`,
      severity: launchOwnerDailyBrief.status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchOwnerBriefMetadata(launchOwnerDailyBrief, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchOwnerDailyBriefRecord({
      brief: launchOwnerDailyBrief,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.status} owner daily brief recorded in Audit Logs.`)
  }

  const queueOwnerBriefDecisionHandoff = (decision: LaunchOwnerDailyBriefDecision) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Owner brief handoff: ${decision.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: decision.reference }),
      reason: `${decision.ask} Evidence: ${decision.evidence}`,
      rollbackNotes: 'Owner brief handoff is review routing only. Any production mutation must use an approved server-side handler with its own rollback plan.',
      severity: decision.status === 'Critical' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.owner_brief.handoff_queued.mock',
      auditActionLabel: `Queued owner brief handoff: ${decision.title}`,
      handlerKey: `launch_owner_brief_${sanitizeLaunchActionKey(decision.id)}`,
      handlerLabel: `${decision.title} owner brief handoff`,
      handlerDescription: `${decision.title} owner brief handoff routes review only. It must not mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildLaunchOwnerBriefDecisionMetadata(decision, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    setNotice(result.ok ? `${decision.title} owner brief handoff queued in Admin Action Requests.` : result.message)
  }

  const exportLaunchOwnerDailyBrief = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Owner Daily Brief',
      actionKey: 'launch_gate.owner_brief.exported.mock',
      actionLabel: `Exported launch owner daily brief: ${launchOwnerDailyBrief.status}`,
      severity: launchOwnerDailyBrief.status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchOwnerBriefMetadata(launchOwnerDailyBrief, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchOwnerDailyBriefHtml(launchOwnerDailyBrief, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchOwnerDailyBriefFilename(launchOwnerDailyBrief)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchOwnerDailyBrief.status} launch owner daily brief exported and recorded in Audit Logs.`)
  }

  const openLaunchEvidencePacketItemSurface = (item: LaunchEvidencePacketItem) => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: `Launch Evidence Packet / ${item.title}`,
      actionKey: `launch_gate.evidence_packet.${sanitizeLaunchActionKey(item.id)}.opened_surface.mock`,
      actionLabel: `Opened launch evidence packet surface: ${item.title}`,
      severity: item.status === 'Missing' ? 'warning' : 'notice',
      metadata: buildLaunchEvidencePacketItemMetadata(item, {
        targetSurface: item.surface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedEvidencePacketItemId(item.id)
    setViewMode(item.surface as LaunchViewMode)
    setNotice(`${item.title} opened as a read-only launch packet surface.`)
  }

  const recordLaunchEvidencePacket = () => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: 'Launch Evidence Packet',
      actionKey: `launch_gate.evidence_packet.${launchEvidencePacket.status.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.recorded.mock`,
      actionLabel: `Recorded launch evidence packet: ${launchEvidencePacket.status}`,
      severity: launchEvidencePacket.status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchEvidencePacketMetadata(launchEvidencePacket, {
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchEvidencePacketRecord({
      packet: launchEvidencePacket,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.status} launch evidence packet recorded in Audit Logs.`)
  }

  const queueLaunchEvidencePacketHandoff = (item: LaunchEvidencePacketItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Launch packet handoff: ${item.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.reference }),
      reason: `${item.nextStep} Evidence: ${item.evidence}`,
      rollbackNotes: 'Launch evidence packet handoff is review routing only. Any production mutation must use an approved server-side handler with its own rollback plan.',
      severity: item.status === 'Missing' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.evidence_packet.handoff_queued.mock',
      auditActionLabel: `Queued launch evidence packet handoff: ${item.title}`,
      handlerKey: `launch_evidence_packet_${sanitizeLaunchActionKey(item.id)}`,
      handlerLabel: `${item.title} packet handoff`,
      handlerDescription: `${item.title} launch packet handoff routes review only. It must not mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildLaunchEvidencePacketItemMetadata(item, {
        packetStatus: launchEvidencePacket.status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    setNotice(result.ok ? `${item.title} packet handoff queued in Admin Action Requests.` : result.message)
  }

  const exportLaunchEvidencePacket = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Evidence Packet',
      actionKey: 'launch_gate.evidence_packet.exported.mock',
      actionLabel: `Exported launch evidence packet: ${launchEvidencePacket.status}`,
      severity: launchEvidencePacket.status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchEvidencePacketMetadata(launchEvidencePacket, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchEvidencePacketHtml(launchEvidencePacket, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchEvidencePacketFilename(launchEvidencePacket)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchEvidencePacket.status} launch evidence packet exported and recorded in Audit Logs.`)
  }

  const openPostLaunchSignalSurface = (signal: LaunchPostLaunchSignal) => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: `Post-Launch Watchtower / ${signal.title}`,
      actionKey: `launch_gate.post_launch.${sanitizeLaunchActionKey(signal.id)}.opened_surface.mock`,
      actionLabel: `Opened post-launch signal surface: ${signal.title}`,
      severity: signal.status === 'Critical' ? 'warning' : 'notice',
      metadata: buildPostLaunchSignalMetadata(signal, {
        targetSurface: signal.surface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedPostLaunchSignalId(signal.id)
    setViewMode(signal.surface as LaunchViewMode)
    setNotice(`${signal.title} opened as a read-only post-launch target.`)
  }

  const recordPostLaunchWatchtower = (signal?: LaunchPostLaunchSignal) => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: signal ? `Post-Launch Watchtower / ${signal.title}` : 'Post-Launch Watchtower',
      actionKey: `launch_gate.post_launch.${launchPostLaunchWatchtower.status.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.recorded.mock`,
      actionLabel: signal
        ? `Recorded post-launch signal: ${signal.title}`
        : `Recorded post-launch watchtower: ${launchPostLaunchWatchtower.status}`,
      severity: launchPostLaunchWatchtower.status === 'Critical' ? 'warning' : 'notice',
      metadata: {
        ...buildPostLaunchWatchtowerMetadata(launchPostLaunchWatchtower, {
          localOnly: true,
          mutationApplied: false,
        }),
        selectedSignal: signal ? buildPostLaunchSignalMetadata(signal, {}) : undefined,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchPostLaunchWatchtowerRecord({
      watchtower: launchPostLaunchWatchtower,
      signal,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.status} post-launch watchtower recorded in Audit Logs.`)
  }

  const queuePostLaunchResponse = (signal: LaunchPostLaunchSignal) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Post-launch response: ${signal.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: signal.reference }),
      reason: `${signal.nextStep} Evidence: ${signal.evidence}`,
      rollbackNotes: 'Post-launch response queueing is review routing only. Any production mutation must use an approved server-side handler with its own rollback plan.',
      severity: signal.status === 'Critical' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.post_launch.response_queued.mock',
      auditActionLabel: `Queued post-launch response: ${signal.title}`,
      handlerKey: `launch_post_launch_${sanitizeLaunchActionKey(signal.id)}`,
      handlerLabel: `${signal.title} post-launch response`,
      handlerDescription: `${signal.title} post-launch response routes review only. It must not mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildPostLaunchSignalMetadata(signal, {
        watchtowerStatus: launchPostLaunchWatchtower.status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    setNotice(result.ok ? `${signal.title} post-launch response queued in Admin Action Requests.` : result.message)
  }

  const exportPostLaunchWatchtower = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Post-Launch Watchtower',
      actionKey: 'launch_gate.post_launch.exported.mock',
      actionLabel: `Exported post-launch watchtower: ${launchPostLaunchWatchtower.status}`,
      severity: launchPostLaunchWatchtower.status === 'Critical' ? 'warning' : 'notice',
      metadata: buildPostLaunchWatchtowerMetadata(launchPostLaunchWatchtower, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchPostLaunchWatchtowerHtml(launchPostLaunchWatchtower, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchPostLaunchWatchtowerFilename(launchPostLaunchWatchtower)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchPostLaunchWatchtower.status} post-launch watchtower exported and recorded in Audit Logs.`)
  }

  const openPostLaunchIncidentSurface = (incident: LaunchPostLaunchIncidentPacket) => {
    const result = runAdminAction(session, {
      permission: 'support.view',
      scope: `Post-Launch Incident / ${incident.title}`,
      actionKey: `launch_gate.post_launch_incident.${sanitizeLaunchActionKey(incident.id)}.opened_surface.mock`,
      actionLabel: `Opened post-launch incident surface: ${incident.title}`,
      severity: incident.severity === 'SEV1' || incident.severity === 'SEV2' ? 'warning' : 'notice',
      metadata: buildPostLaunchIncidentMetadata(incident, {
        targetSurface: incident.surface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedPostLaunchIncidentId(incident.id)
    setViewMode(incident.surface as LaunchViewMode)
    setNotice(`${incident.title} opened as a read-only incident target.`)
  }

  const recordPostLaunchIncident = (incident?: LaunchPostLaunchIncidentPacket) => {
    const result = runAdminAction(session, {
      permission: 'support.view',
      scope: incident ? `Post-Launch Incident / ${incident.title}` : 'Post-Launch Incident Commander',
      actionKey: `launch_gate.post_launch_incident.${launchPostLaunchIncidentCommander.status.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.recorded.mock`,
      actionLabel: incident
        ? `Recorded post-launch incident: ${incident.title}`
        : `Recorded post-launch incident commander: ${launchPostLaunchIncidentCommander.status}`,
      severity: launchPostLaunchIncidentCommander.status === 'Critical' ? 'warning' : 'notice',
      metadata: {
        ...buildPostLaunchIncidentCommanderMetadata(launchPostLaunchIncidentCommander, {
          localOnly: true,
          mutationApplied: false,
        }),
        selectedIncident: incident ? buildPostLaunchIncidentMetadata(incident, {}) : undefined,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchPostLaunchIncidentRecord({
      commander: launchPostLaunchIncidentCommander,
      incident,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.packetStatus} post-launch incident commander recorded in Audit Logs.`)
  }

  const queuePostLaunchIncidentResponse = (incident: LaunchPostLaunchIncidentPacket) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Post-launch incident response: ${incident.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: incident.reference }),
      reason: `${incident.nextStep} Impact: ${incident.customerImpact}`,
      rollbackNotes: 'Post-launch incident response queueing is coordination only. Any production mutation must use an approved server-side handler with its own rollback plan.',
      severity: incident.severity === 'SEV1' || incident.severity === 'SEV2' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.post_launch_incident.response_queued.mock',
      auditActionLabel: `Queued post-launch incident response: ${incident.title}`,
      handlerKey: `launch_post_launch_incident_${sanitizeLaunchActionKey(incident.id)}`,
      handlerLabel: `${incident.title} incident response`,
      handlerDescription: `${incident.title} post-launch incident response routes review only. It must not mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildPostLaunchIncidentMetadata(incident, {
        commanderStatus: launchPostLaunchIncidentCommander.status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    setNotice(result.ok ? `${incident.title} incident response queued in Admin Action Requests.` : result.message)
  }

  const exportPostLaunchIncidentCommander = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Post-Launch Incident Commander',
      actionKey: 'launch_gate.post_launch_incident.exported.mock',
      actionLabel: `Exported post-launch incident commander: ${launchPostLaunchIncidentCommander.status}`,
      severity: launchPostLaunchIncidentCommander.status === 'Critical' ? 'warning' : 'notice',
      metadata: buildPostLaunchIncidentCommanderMetadata(launchPostLaunchIncidentCommander, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchPostLaunchIncidentHtml(launchPostLaunchIncidentCommander, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchPostLaunchIncidentFilename(launchPostLaunchIncidentCommander)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchPostLaunchIncidentCommander.status} post-launch incident commander exported and recorded in Audit Logs.`)
  }

  const openLaunchCommsDraftSurface = (draft: LaunchCommsApprovalDraft) => {
    const result = runAdminAction(session, {
      permission: 'support.view',
      scope: `Launch Communications / ${draft.title}`,
      actionKey: `launch_gate.communications.${sanitizeLaunchActionKey(draft.id)}.opened_surface.mock`,
      actionLabel: `Opened launch communication source surface: ${draft.title}`,
      severity: draft.audience === 'Customer' || draft.status === 'Hold' ? 'warning' : 'notice',
      metadata: buildLaunchCommsDraftMetadata(draft, {
        targetSurface: draft.surface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedLaunchCommsDraftId(draft.id)
    setViewMode(draft.surface as LaunchViewMode)
    setNotice(`${draft.title} source surface opened in read-only mode.`)
  }

  const recordLaunchCommsApproval = (draft?: LaunchCommsApprovalDraft, itemStatus?: LaunchCommsApprovalStatus) => {
    const appliedStatus = itemStatus ?? draft?.status ?? (launchCommsApprovalCenter.pendingReviewCount ? 'Needs Owner Review' : 'Approved Draft')
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: draft ? `Launch Communications / ${draft.title}` : 'Launch Communications Approval Center',
      actionKey: `launch_gate.communications.${sanitizeLaunchActionKey(draft?.id ?? launchCommsApprovalCenter.status)}.${sanitizeLaunchActionKey(appliedStatus)}.recorded.mock`,
      actionLabel: draft
        ? `Recorded launch communication ${appliedStatus}: ${draft.title}`
        : `Recorded launch communications approval center: ${launchCommsApprovalCenter.status}`,
      severity: appliedStatus === 'Hold' || launchCommsApprovalCenter.status === 'Review Required' ? 'warning' : 'notice',
      metadata: {
        ...buildLaunchCommsApprovalCenterMetadata(launchCommsApprovalCenter, {
          localOnly: true,
          mutationApplied: false,
        }),
        selectedDraft: draft ? buildLaunchCommsDraftMetadata(draft, { appliedStatus }) : undefined,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchCommsApprovalRecord({
      center: launchCommsApprovalCenter,
      draft,
      itemStatus: appliedStatus,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.itemStatus} communication approval recorded in Audit Logs.`)
  }

  const queueLaunchCommsSendReview = (draft: LaunchCommsApprovalDraft) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Launch communication send review: ${draft.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: draft.reference }),
      reason: `${draft.nextStep} Draft: ${draft.draft}`,
      rollbackNotes: 'Launch communication send review is routing only. Sending or publishing any message requires a separate approved server-side workflow and human confirmation.',
      severity: draft.audience === 'Customer' || draft.status === 'Hold' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.communications.send_review_queued.mock',
      auditActionLabel: `Queued launch communication send review: ${draft.title}`,
      handlerKey: `launch_comms_${sanitizeLaunchActionKey(draft.id)}`,
      handlerLabel: `${draft.title} send review`,
      handlerDescription: `${draft.title} routes communication send review only. It must not send customer messages, publish notices, mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildLaunchCommsDraftMetadata(draft, {
        centerStatus: launchCommsApprovalCenter.status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    setNotice(result.ok ? `${draft.title} send review queued in Admin Action Requests.` : result.message)
  }

  const exportLaunchCommsApprovalCenter = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Communications Approval Center',
      actionKey: 'launch_gate.communications.exported.mock',
      actionLabel: `Exported launch communications approval center: ${launchCommsApprovalCenter.status}`,
      severity: launchCommsApprovalCenter.status === 'Review Required' ? 'warning' : 'notice',
      metadata: buildLaunchCommsApprovalCenterMetadata(launchCommsApprovalCenter, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchCommsApprovalHtml(launchCommsApprovalCenter, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchCommsApprovalFilename(launchCommsApprovalCenter)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchCommsApprovalCenter.status} launch communications approval center exported and recorded in Audit Logs.`)
  }

  const openLaunchSendReviewSource = (item: LaunchSendReviewItem) => {
    const result = runAdminAction(session, {
      permission: 'support.view',
      scope: `Launch Send Review / ${item.title}`,
      actionKey: `launch_gate.send_review.${sanitizeLaunchActionKey(item.id)}.opened_source.mock`,
      actionLabel: `Opened launch send review source: ${item.title}`,
      severity: item.customerFacing || item.status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchSendReviewItemMetadata(item, {
        targetSurface: item.surface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedLaunchSendReviewItemId(item.id)
    setViewMode(item.surface as LaunchViewMode)
    setNotice(`${item.title} source opened in read-only mode.`)
  }

  const recordLaunchSendReview = (item?: LaunchSendReviewItem, itemStatus?: LaunchSendReviewItemStatus) => {
    const appliedStatus = itemStatus ?? item?.status ?? (launchSendReviewQueue.pendingReviewCount ? 'Needs Send Review' : 'Handoff Queued')
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: item ? `Launch Send Review / ${item.title}` : 'Launch Send Review Queue',
      actionKey: `launch_gate.send_review.${sanitizeLaunchActionKey(item?.id ?? launchSendReviewQueue.status)}.${sanitizeLaunchActionKey(appliedStatus)}.recorded.mock`,
      actionLabel: item
        ? `Recorded launch send review ${appliedStatus}: ${item.title}`
        : `Recorded launch send review queue: ${launchSendReviewQueue.status}`,
      severity: appliedStatus === 'Blocked' || launchSendReviewQueue.status === 'Review Needed' ? 'warning' : 'notice',
      metadata: {
        ...buildLaunchSendReviewQueueMetadata(launchSendReviewQueue, {
          localOnly: true,
          mutationApplied: false,
        }),
        selectedItem: item ? buildLaunchSendReviewItemMetadata(item, { appliedStatus }) : undefined,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchSendReviewRecord({
      queue: launchSendReviewQueue,
      item,
      itemStatus: appliedStatus,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.itemStatus} send review recorded in Audit Logs.`)
  }

  const queueLaunchSendReviewHandoff = (item: LaunchSendReviewItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Launch send review handoff: ${item.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.reference }),
      reason: `${item.deliveryPlan} Guardrail: ${item.sendGuardrail}`,
      rollbackNotes: item.rollbackPlan,
      severity: item.customerFacing || item.status === 'Blocked' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.send_review.handoff_queued.mock',
      auditActionLabel: `Queued launch send review handoff: ${item.title}`,
      handlerKey: `launch_send_review_${sanitizeLaunchActionKey(item.id)}`,
      handlerLabel: `${item.title} handoff`,
      handlerDescription: `${item.title} routes send review handoff only. It must not send customer messages, publish notices, mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildLaunchSendReviewItemMetadata(item, {
        queueStatus: launchSendReviewQueue.status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    saveLaunchSendReviewRecord({
      queue: launchSendReviewQueue,
      item,
      itemStatus: 'Handoff Queued',
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${item.title} handoff queued in Admin Action Requests.`)
  }

  const exportLaunchSendReviewQueue = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Send Review Queue',
      actionKey: 'launch_gate.send_review.exported.mock',
      actionLabel: `Exported launch send review queue: ${launchSendReviewQueue.status}`,
      severity: launchSendReviewQueue.status === 'Review Needed' ? 'warning' : 'notice',
      metadata: buildLaunchSendReviewQueueMetadata(launchSendReviewQueue, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchSendReviewHtml(launchSendReviewQueue, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchSendReviewFilename(launchSendReviewQueue)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchSendReviewQueue.status} launch send review queue exported and recorded in Audit Logs.`)
  }

  const openLaunchDeliveryEvidenceSource = (item: LaunchDeliveryEvidenceItem) => {
    const result = runAdminAction(session, {
      permission: 'support.view',
      scope: `Launch Delivery Evidence / ${item.title}`,
      actionKey: `launch_gate.delivery_evidence.${sanitizeLaunchActionKey(item.id)}.opened_source.mock`,
      actionLabel: `Opened launch delivery evidence source: ${item.title}`,
      severity: item.customerFacing || item.status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchDeliveryEvidenceItemMetadata(item, {
        targetSurface: item.surface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedLaunchDeliveryEvidenceItemId(item.id)
    setViewMode(item.surface as LaunchViewMode)
    setNotice(`${item.title} source opened in read-only mode.`)
  }

  const recordLaunchDeliveryEvidence = (item?: LaunchDeliveryEvidenceItem, itemStatus?: LaunchDeliveryEvidenceItemStatus) => {
    const appliedStatus = itemStatus ?? item?.status ?? (launchDeliveryEvidenceLedger.needsProofCount ? 'Needs Proof' : 'Evidence Complete')
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: item ? `Launch Delivery Evidence / ${item.title}` : 'Launch Delivery Evidence Ledger',
      actionKey: `launch_gate.delivery_evidence.${sanitizeLaunchActionKey(item?.id ?? launchDeliveryEvidenceLedger.status)}.${sanitizeLaunchActionKey(appliedStatus)}.recorded.mock`,
      actionLabel: item
        ? `Recorded launch delivery evidence ${appliedStatus}: ${item.title}`
        : `Recorded launch delivery evidence ledger: ${launchDeliveryEvidenceLedger.status}`,
      severity: appliedStatus === 'Blocked' || launchDeliveryEvidenceLedger.status === 'Evidence Needed' ? 'warning' : 'notice',
      metadata: {
        ...buildLaunchDeliveryEvidenceLedgerMetadata(launchDeliveryEvidenceLedger, {
          localOnly: true,
          mutationApplied: false,
        }),
        selectedItem: item ? buildLaunchDeliveryEvidenceItemMetadata(item, { appliedStatus }) : undefined,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchDeliveryEvidenceRecord({
      ledger: launchDeliveryEvidenceLedger,
      item,
      itemStatus: appliedStatus,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.itemStatus} launch delivery evidence recorded in Audit Logs.`)
  }

  const queueLaunchDeliveryEvidenceReview = (item: LaunchDeliveryEvidenceItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Launch delivery evidence review: ${item.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.reference }),
      reason: `${item.deliveryProof} Recipient scope: ${item.recipientScope}`,
      rollbackNotes: item.correctionPlan,
      severity: item.customerFacing || item.status === 'Blocked' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.delivery_evidence.review_queued.mock',
      auditActionLabel: `Queued launch delivery evidence review: ${item.title}`,
      handlerKey: `launch_delivery_evidence_${sanitizeLaunchActionKey(item.id)}`,
      handlerLabel: `${item.title} evidence review`,
      handlerDescription: `${item.title} routes delivery evidence review only. It must not send customer messages, publish notices, mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildLaunchDeliveryEvidenceItemMetadata(item, {
        ledgerStatus: launchDeliveryEvidenceLedger.status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    saveLaunchDeliveryEvidenceRecord({
      ledger: launchDeliveryEvidenceLedger,
      item,
      itemStatus: 'Proof Review',
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${item.title} evidence review queued in Admin Action Requests.`)
  }

  const exportLaunchDeliveryEvidenceLedger = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Delivery Evidence Ledger',
      actionKey: 'launch_gate.delivery_evidence.exported.mock',
      actionLabel: `Exported launch delivery evidence ledger: ${launchDeliveryEvidenceLedger.status}`,
      severity: launchDeliveryEvidenceLedger.status === 'Evidence Needed' ? 'warning' : 'notice',
      metadata: buildLaunchDeliveryEvidenceLedgerMetadata(launchDeliveryEvidenceLedger, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchDeliveryEvidenceHtml(launchDeliveryEvidenceLedger, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchDeliveryEvidenceFilename(launchDeliveryEvidenceLedger)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchDeliveryEvidenceLedger.status} launch delivery evidence ledger exported and recorded in Audit Logs.`)
  }

  const openLaunchRecipientResponseSource = (item: LaunchRecipientResponseItem) => {
    const result = runAdminAction(session, {
      permission: 'support.view',
      scope: `Launch Recipient Response / ${item.title}`,
      actionKey: `launch_gate.recipient_response.${sanitizeLaunchActionKey(item.id)}.opened_source.mock`,
      actionLabel: `Opened launch recipient response source: ${item.title}`,
      severity: item.customerFacing || item.status === 'Escalated' ? 'warning' : 'notice',
      metadata: buildLaunchRecipientResponseItemMetadata(item, {
        targetSurface: item.surface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedLaunchRecipientResponseItemId(item.id)
    setViewMode(item.surface as LaunchViewMode)
    setNotice(`${item.title} source opened in read-only mode.`)
  }

  const recordLaunchRecipientResponse = (item?: LaunchRecipientResponseItem, itemStatus?: LaunchRecipientResponseItemStatus) => {
    const appliedStatus = itemStatus ?? item?.status ?? (launchRecipientResponseMonitor.awaitingCount ? 'Awaiting Response' : 'Acknowledged')
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: item ? `Launch Recipient Response / ${item.title}` : 'Launch Recipient Response Monitor',
      actionKey: `launch_gate.recipient_response.${sanitizeLaunchActionKey(item?.id ?? launchRecipientResponseMonitor.status)}.${sanitizeLaunchActionKey(appliedStatus)}.recorded.mock`,
      actionLabel: item
        ? `Recorded launch recipient response ${appliedStatus}: ${item.title}`
        : `Recorded launch recipient response monitor: ${launchRecipientResponseMonitor.status}`,
      severity: appliedStatus === 'Escalated' || appliedStatus === 'Needs Follow-Up' || launchRecipientResponseMonitor.status === 'Escalated' ? 'warning' : 'notice',
      metadata: {
        ...buildLaunchRecipientResponseMonitorMetadata(launchRecipientResponseMonitor, {
          localOnly: true,
          mutationApplied: false,
        }),
        selectedItem: item ? buildLaunchRecipientResponseItemMetadata(item, { appliedStatus }) : undefined,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchRecipientResponseRecord({
      monitor: launchRecipientResponseMonitor,
      item,
      itemStatus: appliedStatus,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.itemStatus} launch recipient response recorded in Audit Logs.`)
  }

  const queueLaunchRecipientResponseFollowUp = (item: LaunchRecipientResponseItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Launch recipient response follow-up: ${item.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.reference }),
      reason: `${item.followUpPlan} Expected response: ${item.expectedResponse}`,
      rollbackNotes: item.escalationPlan,
      severity: item.customerFacing || item.status === 'Escalated' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.recipient_response.follow_up_queued.mock',
      auditActionLabel: `Queued launch recipient response follow-up: ${item.title}`,
      handlerKey: `launch_recipient_response_${sanitizeLaunchActionKey(item.id)}`,
      handlerLabel: `${item.title} follow-up`,
      handlerDescription: `${item.title} routes response follow-up only. It must not send customer replies, publish notices, mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildLaunchRecipientResponseItemMetadata(item, {
        monitorStatus: launchRecipientResponseMonitor.status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    saveLaunchRecipientResponseRecord({
      monitor: launchRecipientResponseMonitor,
      item,
      itemStatus: item.status === 'Escalated' ? 'Escalated' : 'Needs Follow-Up',
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${item.title} response follow-up queued in Admin Action Requests.`)
  }

  const exportLaunchRecipientResponseMonitor = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Recipient Response Monitor',
      actionKey: 'launch_gate.recipient_response.exported.mock',
      actionLabel: `Exported launch recipient response monitor: ${launchRecipientResponseMonitor.status}`,
      severity: launchRecipientResponseMonitor.status === 'Escalated' ? 'warning' : 'notice',
      metadata: buildLaunchRecipientResponseMonitorMetadata(launchRecipientResponseMonitor, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchRecipientResponseHtml(launchRecipientResponseMonitor, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchRecipientResponseFilename(launchRecipientResponseMonitor)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchRecipientResponseMonitor.status} launch recipient response monitor exported and recorded in Audit Logs.`)
  }

  const openLaunchClosureEvidenceSource = (item: LaunchClosureEvidenceItem) => {
    const result = runAdminAction(session, {
      permission: 'support.view',
      scope: `Launch Closure Evidence / ${item.title}`,
      actionKey: `launch_gate.closure_evidence.${sanitizeLaunchActionKey(item.id)}.opened_source.mock`,
      actionLabel: `Opened launch closure evidence source: ${item.title}`,
      severity: item.customerFacing || item.status === 'Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchClosureEvidenceItemMetadata(item, {
        targetSurface: item.surface,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedLaunchClosureEvidenceItemId(item.id)
    setViewMode(item.surface as LaunchViewMode)
    setNotice(`${item.title} source opened in read-only mode.`)
  }

  const recordLaunchClosureEvidence = (item?: LaunchClosureEvidenceItem, itemStatus?: LaunchClosureEvidenceItemStatus) => {
    const appliedStatus = itemStatus ?? item?.status ?? (launchClosureEvidencePack.needsPacketCount ? 'Needs Packet' : 'Packet Ready')
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: item ? `Launch Closure Evidence / ${item.title}` : 'Launch Closure Evidence Pack',
      actionKey: `launch_gate.closure_evidence.${sanitizeLaunchActionKey(item?.id ?? launchClosureEvidencePack.status)}.${sanitizeLaunchActionKey(appliedStatus)}.recorded.mock`,
      actionLabel: item
        ? `Recorded launch closure evidence ${appliedStatus}: ${item.title}`
        : `Recorded launch closure evidence pack: ${launchClosureEvidencePack.status}`,
      severity: appliedStatus === 'Blocked' || launchClosureEvidencePack.status === 'Packet Needed' ? 'warning' : 'notice',
      metadata: {
        ...buildLaunchClosureEvidencePackMetadata(launchClosureEvidencePack, {
          localOnly: true,
          mutationApplied: false,
        }),
        selectedItem: item ? buildLaunchClosureEvidenceItemMetadata(item, { appliedStatus }) : undefined,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchClosureEvidenceRecord({
      pack: launchClosureEvidencePack,
      item,
      itemStatus: appliedStatus,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.itemStatus} launch closure evidence recorded in Audit Logs.`)
  }

  const queueLaunchClosureEvidenceReview = (item: LaunchClosureEvidenceItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Launch closure evidence review: ${item.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.reference }),
      reason: `${item.packetRequirement} Signoff: ${item.signoffPlan}`,
      rollbackNotes: item.rollbackPlan,
      severity: item.customerFacing || item.status === 'Blocked' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.closure_evidence.review_queued.mock',
      auditActionLabel: `Queued launch closure evidence review: ${item.title}`,
      handlerKey: `launch_closure_evidence_${sanitizeLaunchActionKey(item.id)}`,
      handlerLabel: `${item.title} closure review`,
      handlerDescription: `${item.title} routes closure evidence review only. It must not close production incidents, send messages, publish notices, mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildLaunchClosureEvidenceItemMetadata(item, {
        packStatus: launchClosureEvidencePack.status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    saveLaunchClosureEvidenceRecord({
      pack: launchClosureEvidencePack,
      item,
      itemStatus: 'Closure Review',
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${item.title} closure evidence review queued in Admin Action Requests.`)
  }

  const exportLaunchClosureEvidencePack = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Closure Evidence Pack',
      actionKey: 'launch_gate.closure_evidence.exported.mock',
      actionLabel: `Exported launch closure evidence pack: ${launchClosureEvidencePack.status}`,
      severity: launchClosureEvidencePack.status === 'Packet Needed' ? 'warning' : 'notice',
      metadata: buildLaunchClosureEvidencePackMetadata(launchClosureEvidencePack, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchClosureEvidenceHtml(launchClosureEvidencePack, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchClosureEvidenceFilename(launchClosureEvidencePack)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchClosureEvidencePack.status} launch closure evidence pack exported and recorded in Audit Logs.`)
  }

  const openLaunchFinalAuditSource = (item: LaunchFinalAuditItem) => {
    const result = runAdminAction(session, {
      permission: 'support.view',
      scope: `Final Launch Audit / ${item.stage}`,
      actionKey: `launch_gate.final_audit.${sanitizeLaunchActionKey(item.id)}.opened_source.mock`,
      actionLabel: `Opened final launch audit source: ${item.stage}`,
      severity: item.status === 'Blocked' || item.customerFacingCount ? 'warning' : 'notice',
      metadata: buildLaunchFinalAuditItemMetadata(item, {
        targetView: item.targetView,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedLaunchFinalAuditItemId(item.id)
    setViewMode(item.targetView as LaunchViewMode)
    setNotice(`${item.stage} source opened in read-only mode.`)
  }

  const recordLaunchFinalAudit = (item?: LaunchFinalAuditItem, itemStatus?: LaunchFinalAuditItemStatus) => {
    const appliedStatus = itemStatus ?? item?.status ?? (launchFinalAuditRoom.blockedCount ? 'Blocked' : launchFinalAuditRoom.reviewCount || launchFinalAuditRoom.needsEvidenceCount ? 'Review' : 'Ready')
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: item ? `Final Launch Audit / ${item.stage}` : 'Final Launch Audit Room',
      actionKey: `launch_gate.final_audit.${sanitizeLaunchActionKey(item?.id ?? launchFinalAuditRoom.status)}.${sanitizeLaunchActionKey(appliedStatus)}.recorded.mock`,
      actionLabel: item
        ? `Recorded final launch audit ${appliedStatus}: ${item.stage}`
        : `Recorded final launch audit room: ${launchFinalAuditRoom.status}`,
      severity: appliedStatus === 'Blocked' || launchFinalAuditRoom.status === 'Audit Blocked' ? 'warning' : 'notice',
      metadata: {
        ...buildLaunchFinalAuditRoomMetadata(launchFinalAuditRoom, {
          localOnly: true,
          mutationApplied: false,
        }),
        selectedItem: item ? buildLaunchFinalAuditItemMetadata(item, { appliedStatus }) : undefined,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchFinalAuditRecord({
      room: launchFinalAuditRoom,
      item,
      itemStatus: appliedStatus,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.itemStatus} final launch audit recorded in Audit Logs.`)
  }

  const queueLaunchFinalAuditReview = (item: LaunchFinalAuditItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Final launch audit review: ${item.stage}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.reference }),
      reason: `${item.summary} Evidence: ${item.evidence}`,
      rollbackNotes: item.nextStep,
      severity: item.status === 'Blocked' || item.customerFacingCount ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.final_audit.review_queued.mock',
      auditActionLabel: `Queued final launch audit review: ${item.stage}`,
      handlerKey: `launch_final_audit_${sanitizeLaunchActionKey(item.id)}`,
      handlerLabel: `${item.stage} final audit review`,
      handlerDescription: `${item.stage} routes final audit review only. It must not close production incidents, send messages, publish notices, mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildLaunchFinalAuditItemMetadata(item, {
        roomStatus: launchFinalAuditRoom.status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    saveLaunchFinalAuditRecord({
      room: launchFinalAuditRoom,
      item,
      itemStatus: item.status === 'Blocked' ? 'Blocked' : 'Review',
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${item.stage} final audit review queued in Admin Action Requests.`)
  }

  const exportLaunchFinalAuditRoom = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Final Launch Audit Room',
      actionKey: 'launch_gate.final_audit.exported.mock',
      actionLabel: `Exported final launch audit room: ${launchFinalAuditRoom.status}`,
      severity: launchFinalAuditRoom.status === 'Audit Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchFinalAuditRoomMetadata(launchFinalAuditRoom, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchFinalAuditHtml(launchFinalAuditRoom, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchFinalAuditFilename(launchFinalAuditRoom)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchFinalAuditRoom.status} final launch audit room exported and recorded in Audit Logs.`)
  }

  const openLaunchAuditArchiveSource = (item: LaunchAuditArchiveItem) => {
    const result = runAdminAction(session, {
      permission: 'support.view',
      scope: `Launch Audit Archive / ${item.category}`,
      actionKey: `launch_gate.audit_archive.${sanitizeLaunchActionKey(item.id)}.opened_source.mock`,
      actionLabel: `Opened launch audit archive source: ${item.category}`,
      severity: item.status === 'Blocked' || item.customerFacingCount ? 'warning' : 'notice',
      metadata: buildLaunchAuditArchiveItemMetadata(item, {
        targetView: item.targetView,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    setSelectedLaunchAuditArchiveItemId(item.id)
    setViewMode(item.targetView as LaunchViewMode)
    setNotice(`${item.category} archive source opened in read-only mode.`)
  }

  const recordLaunchAuditArchive = (item?: LaunchAuditArchiveItem, itemStatus?: LaunchAuditArchiveItemStatus) => {
    const appliedStatus: LaunchAuditArchiveItemStatus = itemStatus
      ?? item?.status
      ?? (launchAuditArchiveVault.blockedCount ? 'Blocked' : launchAuditArchiveVault.needsArchiveCount || launchAuditArchiveVault.reviewCount ? 'Archive Review' : 'Archive Ready')
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: item ? `Launch Audit Archive / ${item.category}` : 'Launch Audit Archive Vault',
      actionKey: `launch_gate.audit_archive.${sanitizeLaunchActionKey(item?.id ?? launchAuditArchiveVault.status)}.${sanitizeLaunchActionKey(appliedStatus)}.recorded.mock`,
      actionLabel: item
        ? `Recorded launch audit archive ${appliedStatus}: ${item.category}`
        : `Recorded launch audit archive vault: ${launchAuditArchiveVault.status}`,
      severity: appliedStatus === 'Blocked' || launchAuditArchiveVault.status === 'Archive Blocked' ? 'warning' : 'notice',
      metadata: {
        ...buildLaunchAuditArchiveVaultMetadata(launchAuditArchiveVault, {
          localOnly: true,
          mutationApplied: false,
        }),
        selectedItem: item ? buildLaunchAuditArchiveItemMetadata(item, { appliedStatus }) : undefined,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchAuditArchiveRecord({
      vault: launchAuditArchiveVault,
      item,
      itemStatus: appliedStatus,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.itemStatus} launch audit archive recorded in Audit Logs.`)
  }

  const queueLaunchAuditArchiveReview = (item: LaunchAuditArchiveItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Launch audit archive review: ${item.category}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.reference }),
      reason: `${item.archiveRequirement} Evidence: ${item.archiveEvidence}`,
      rollbackNotes: item.rollbackPlan,
      severity: item.status === 'Blocked' || item.customerFacingCount ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.audit_archive.review_queued.mock',
      auditActionLabel: `Queued launch audit archive review: ${item.category}`,
      handlerKey: `launch_audit_archive_${sanitizeLaunchActionKey(item.id)}`,
      handlerLabel: `${item.category} archive review`,
      handlerDescription: `${item.category} routes audit archive review only. It must not close production incidents, send messages, publish notices, mutate production data, billing, modules, permissions, support records, impersonation, or agent actions from the browser.`,
      metadata: buildLaunchAuditArchiveItemMetadata(item, {
        vaultStatus: launchAuditArchiveVault.status,
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    saveLaunchAuditArchiveRecord({
      vault: launchAuditArchiveVault,
      item,
      itemStatus: item.status === 'Blocked' ? 'Blocked' : 'Archive Review',
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${item.category} launch audit archive review queued in Admin Action Requests.`)
  }

  const exportLaunchAuditArchiveVault = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Audit Archive Vault',
      actionKey: 'launch_gate.audit_archive.exported.mock',
      actionLabel: `Exported launch audit archive vault: ${launchAuditArchiveVault.status}`,
      severity: launchAuditArchiveVault.status === 'Archive Blocked' ? 'warning' : 'notice',
      metadata: buildLaunchAuditArchiveVaultMetadata(launchAuditArchiveVault, {
        exportFormat: 'html',
        localOnly: true,
        mutationApplied: false,
      }),
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchAuditArchiveHtml(launchAuditArchiveVault, session)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchAuditArchiveFilename(launchAuditArchiveVault)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${launchAuditArchiveVault.status} launch audit archive vault exported and recorded in Audit Logs.`)
  }

  const exportLaunchReport = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Gate',
      actionKey: 'launch_gate.review_report.exported.mock',
      actionLabel: 'Exported Launch Review Report',
      severity: model.status === 'Blocked' ? 'warning' : 'notice',
      metadata: {
        readinessScore: model.score,
        launchStatus: model.status,
        readyGates: model.readyCount,
        watchGates: model.watchCount,
        blockedGates: model.blockedCount,
        criticalGates: model.criticalCount,
        exportFormat: 'html',
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchReviewReportHtml({
      model,
      session,
      sourceLabel,
      dataSourceKind,
      dataStatus: status,
      evidenceLedger,
    })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchReviewReportFilename()
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice('Launch Review Report exported and recorded in Audit Logs.')
  }

  const exportDecisionPacket = (packet: LaunchDecisionPacket) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Launch Packet / ${packet.reference}`,
      actionKey: 'launch_gate.command_packet.exported.mock',
      actionLabel: `Exported command decision packet: ${packet.title}`,
      severity: packet.status === 'Queued For Review' ? 'warning' : 'notice',
      metadata: {
        packetId: packet.id,
        commandItemId: packet.commandItemId,
        packetStatus: packet.status,
        owner: packet.owner,
        reference: packet.reference,
        exportFormat: 'html',
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchDecisionPacketHtml({
      packet,
      session,
      sourceLabel,
      dataSourceKind,
      dataStatus: status,
    })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchDecisionPacketFilename(packet)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${packet.title} decision packet exported and recorded in Audit Logs.`)
  }

  const recordPacketReview = (packet: LaunchDecisionPacket, reviewStatus: LaunchDecisionPacketReviewStatus) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Launch Packet / ${packet.reference}`,
      actionKey: `launch_gate.command_packet.review.${reviewStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${reviewStatus} launch decision packet: ${packet.title}`,
      severity: reviewStatus === 'Deferred' ? 'warning' : 'notice',
      metadata: {
        packetId: packet.id,
        commandItemId: packet.commandItemId,
        previousStatus: packet.status,
        nextStatus: reviewStatus,
        owner: packet.owner,
        followUpOwner: packetReviewOwner,
        reference: packet.reference,
        note: packetReviewNote,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const reviewedPacket = reviewLaunchDecisionPacket({
      packet,
      status: reviewStatus,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
      note: packetReviewNote,
      followUpOwner: packetReviewOwner,
    })
    setSelectedPacketId(reviewedPacket.id)
    setNotice(`${reviewedPacket.status} recorded for ${reviewedPacket.title}.`)
  }

  const recordClosureSnapshot = () => {
    const result = runAdminAction(session, {
      permission: 'settings.manage',
      scope: 'Launch Closure',
      actionKey: 'launch_gate.closure_snapshot.recorded.mock',
      actionLabel: `Recorded launch closure snapshot: ${closureModel.decision}`,
      severity: closureModel.decision === 'No Go' ? 'critical' : closureModel.decision === 'Conditional Go' ? 'warning' : 'notice',
      metadata: {
        closureDecision: closureModel.decision,
        readinessScore: model.score,
        launchStatus: model.status,
        requiredChecks: closureModel.requiredCount,
        completedRequiredChecks: closureModel.completeRequiredCount,
        blockedChecks: closureModel.blockedCount,
        reviewChecks: closureModel.reviewCount,
        requiredApprovals: closureModel.requiredApprovalCount,
        missingApprovals: closureModel.missingApprovalCount,
        unresolvedDeferrals: closureModel.unresolvedDeferralCount,
        evidenceItems: closureModel.evidenceItemCount,
        openActionRequests: closureModel.openActionCount,
        dataSourceKind,
        dataStatus: status,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const snapshot = saveLaunchClosureSnapshot({
      closureModel,
      readinessModel: model,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
      sourceLabel,
      dataSourceKind,
      dataStatus: status,
    })
    setNotice(`${snapshot.decision} closure snapshot recorded in Audit Logs and Snapshot Ledger.`)
  }

  const exportClosureSnapshot = (snapshot: LaunchClosureSnapshot) => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: `Launch Closure / ${snapshot.decision}`,
      actionKey: 'launch_gate.closure_snapshot.exported.mock',
      actionLabel: `Exported launch closure snapshot: ${snapshot.decision}`,
      severity: snapshot.decision === 'No Go' ? 'warning' : 'notice',
      metadata: {
        snapshotId: snapshot.id,
        closureDecision: snapshot.decision,
        readinessScore: snapshot.readinessScore,
        launchStatus: snapshot.launchStatus,
        blockedChecks: snapshot.blockedCount,
        reviewChecks: snapshot.reviewCount,
        exportFormat: 'html',
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchClosureSnapshotHtml(snapshot)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchClosureSnapshotFilename(snapshot)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${snapshot.decision} closure snapshot exported and recorded in Audit Logs.`)
  }

  const exportExecutiveBrief = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Executive Launch Brief',
      actionKey: 'launch_gate.executive_brief.exported.mock',
      actionLabel: `Exported executive launch brief: ${executiveBrief.recommendation}`,
      severity: executiveBrief.recommendation === 'Hold' ? 'warning' : 'notice',
      metadata: {
        recommendation: executiveBrief.recommendation,
        headline: executiveBrief.headline,
        blockers: executiveBrief.blockerCount,
        reviewItems: executiveBrief.reviewCount,
        packetCount: executiveBrief.packetCount,
        snapshotCount: executiveBrief.snapshotCount,
        exportFormat: 'html',
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchExecutiveBriefHtml({ brief: executiveBrief, session })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchExecutiveBriefFilename()
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${executiveBrief.recommendation} executive launch brief exported and recorded in Audit Logs.`)
  }

  const exportArtifactManifest = () => {
    const result = runAdminAction(session, {
      permission: 'reports.export',
      scope: 'Launch Artifact Manifest',
      actionKey: 'launch_gate.artifact_manifest.exported.mock',
      actionLabel: `Exported launch artifact manifest: ${artifactManifest.status}`,
      severity: artifactManifest.status === 'Incomplete' ? 'warning' : 'notice',
      metadata: {
        manifestStatus: artifactManifest.status,
        requiredArtifacts: artifactManifest.requiredCount,
        readyRequiredArtifacts: artifactManifest.readyRequiredCount,
        blockedArtifacts: artifactManifest.blockedCount,
        reviewArtifacts: artifactManifest.reviewCount,
        missingRequiredArtifacts: artifactManifest.missingRequiredCount,
        exportableArtifacts: artifactManifest.exportableCount,
        auditBackedArtifacts: artifactManifest.auditBackedCount,
        handoffGaps: artifactManifest.gaps.length,
        exportFormat: 'html',
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const html = buildLaunchArtifactManifestHtml({ manifest: artifactManifest, session })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = getLaunchArtifactManifestFilename()
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice(`${artifactManifest.status} launch artifact manifest exported and recorded in Audit Logs.`)
  }

  const recordHandoffApproval = () => {
    const result = runAdminAction(session, {
      permission: 'settings.manage',
      scope: 'Launch Handoff Approval',
      actionKey: `launch_gate.handoff_approval.${handoffDecision.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `Recorded launch handoff approval: ${handoffDecision}`,
      severity: handoffDecision === 'Held' ? 'critical' : handoffDecision === 'Approved With Conditions' ? 'warning' : 'notice',
      metadata: {
        handoffDecision,
        followUpOwner: handoffOwner,
        conditionNote: handoffConditionNote,
        acceptedRisk: handoffAcceptedRisk,
        manifestStatus: artifactManifest.status,
        executiveRecommendation: executiveBrief.recommendation,
        closureDecision: closureModel.decision,
        readinessScore: model.score,
        launchStatus: model.status,
        requiredReadyArtifacts: artifactManifest.readyRequiredCount,
        requiredArtifacts: artifactManifest.requiredCount,
        handoffGaps: artifactManifest.gaps.length,
        blockedArtifacts: artifactManifest.blockedCount,
        reviewArtifacts: artifactManifest.reviewCount,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const approval = saveLaunchHandoffApproval({
      decision: handoffDecision,
      conditionNote: handoffConditionNote,
      acceptedRisk: handoffAcceptedRisk,
      followUpOwner: handoffOwner,
      manifest: artifactManifest,
      executiveBrief,
      closureModel,
      readinessModel: model,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${approval.decision} launch handoff approval recorded in Audit Logs and Approval Ledger.`)
  }

  const recordFollowUpUpdate = (item: LaunchFollowUpItem) => {
    const result = runAdminAction(session, {
      permission: 'admin_actions.manage',
      scope: `Launch Follow-Up / ${item.reference}`,
      actionKey: `launch_gate.follow_up.${followUpStatus.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${followUpStatus} launch follow-up: ${item.title}`,
      severity: followUpStatus === 'Blocked' ? 'warning' : 'notice',
      metadata: {
        followUpId: item.id,
        previousStatus: item.status,
        nextStatus: followUpStatus,
        source: item.source,
        priority: item.priority,
        owner: followUpOwner,
        reference: item.reference,
        note: followUpNote,
        linkedActionRequestId: item.linkedActionRequestId,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const record = saveLaunchFollowUpRecord({
      item,
      status: followUpStatus,
      owner: followUpOwner,
      note: followUpNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${record.status} follow-up recorded for ${item.title}.`)
  }

  const queueFollowUpAction = (item: LaunchFollowUpItem) => {
    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Launch follow-up: ${item.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.reference }),
      reason: `${item.nextStep} Evidence: ${item.evidence}`,
      rollbackNotes: 'Follow-up queueing is a review record only. Any production mutation must use an approved server-side handler with its own rollback plan.',
      severity: item.priority === 'Critical' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.follow_up.action_request_queued.mock',
      auditActionLabel: `Queued launch follow-up action request: ${item.title}`,
      metadata: {
        followUpId: item.id,
        source: item.source,
        priority: item.priority,
        owner: item.owner,
        reference: item.reference,
        dueLabel: item.dueLabel,
      },
    })

    setNotice(result.ok ? `${item.title} follow-up queued in Admin Action Requests.` : result.message)
  }

  const recordWatchCheck = () => {
    const result = runAdminAction(session, {
      permission: 'settings.view',
      scope: 'Launch Watchtower',
      actionKey: `launch_gate.watchtower.${watchtower.status.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `Recorded launch watch check: ${watchtower.status}`,
      severity: watchtower.status === 'Critical Drift' ? 'critical' : watchtower.status === 'Drift' ? 'warning' : 'notice',
      metadata: {
        watchStatus: watchtower.status,
        summary: watchtower.summary,
        readinessScore: model.score,
        launchStatus: model.status,
        manifestStatus: artifactManifest.status,
        baselineApprovalId: watchtower.baselineApproval?.id,
        baselineDecision: watchtower.baselineApproval?.decision,
        criticalSignals: watchtower.criticalCount,
        watchSignals: watchtower.watchCount,
        stableSignals: watchtower.stableCount,
        scoreDrift: watchtower.scoreDrift,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const check = saveLaunchWatchCheck({
      watchModel: watchtower,
      readinessModel: model,
      manifest: artifactManifest,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setNotice(`${check.status} launch watch check recorded in Audit Logs and Watch Ledger.`)
  }

  const recordSignOff = (gate: LaunchGate) => {
    const result = runAdminAction(session, {
      permission: 'settings.manage',
      scope: `Launch Gate / ${gate.area}`,
      actionKey: `launch_gate.${gate.id}.signoff.${signOffDecision.toLowerCase()}.mock`,
      actionLabel: `${signOffDecision} launch gate: ${gate.title}`,
      severity: signOffDecision === 'Deferred' || gate.status === 'Blocked' ? 'warning' : 'notice',
      metadata: {
        gateId: gate.id,
        area: gate.area,
        status: gate.status,
        decision: signOffDecision,
        assignedTo: signOffOwner,
        note: signOffNote,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const signOff = saveLaunchGateSignOff({
      gate,
      decision: signOffDecision,
      assignedTo: signOffOwner,
      note: signOffNote,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
    })
    setSignOffNote('')
    setNotice(`${signOff.decision} sign-off recorded for ${gate.title}.`)
  }

  const reviewCommandItem = (itemId: string) => {
    const gateId = getCommandGateId(itemId)
    if (!gateId) {
      onOpenActionRequests()
      return
    }
    setSelectedId(gateId)
    setSelectedArea('All')
    setViewMode('detail')
  }

  const createDecisionPacket = (item: LaunchCommandItem, status: LaunchDecisionPacketStatus = 'Drafted') => {
    const result = runAdminAction(session, {
      permission: status === 'Drafted' ? 'settings.view' : 'admin_actions.manage',
      scope: `Launch Command / ${item.reference}`,
      actionKey: `launch_gate.command_packet.${status.toLowerCase().replace(/\s+/g, '_')}.mock`,
      actionLabel: `${status} command decision packet: ${item.title}`,
      severity: item.status === 'Blocked' ? 'warning' : 'notice',
      metadata: {
        commandItemId: item.id,
        commandItemType: item.type,
        owner: item.owner,
        status: item.status,
        severity: item.severity,
        reference: item.reference,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return undefined
    }

    const packet = saveLaunchDecisionPacket({
      item,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
      status,
    })
    setNotice(`${packet.status} packet created for ${packet.title}.`)
    return packet
  }

  const queueDecisionPacket = (item: LaunchCommandItem) => {
    if (item.type === 'Server Action') {
      createDecisionPacket(item, 'Queued For Review')
      return
    }

    const result = queueAdminActionRequest(session, {
      actionType: 'agent_recommended_action',
      title: `Launch decision packet: ${item.title}`,
      permission: 'admin_actions.manage',
      scope: createAdminActionScope({ label: item.reference }),
      reason: `${item.nextDecision} Evidence: ${item.whyItMatters}`,
      rollbackNotes: 'Decision packet is review evidence only. Any production mutation must be executed by an approved server-side handler with its own rollback plan.',
      severity: item.status === 'Blocked' ? 'warning' : 'notice',
      auditActionKey: 'launch_gate.command_packet.queued_action_request.mock',
      auditActionLabel: `Queued launch command packet for server review: ${item.title}`,
      metadata: {
        commandItemId: item.id,
        commandItemType: item.type,
        owner: item.owner,
        reference: item.reference,
        nextDecision: item.nextDecision,
      },
    })

    if (!result.ok) {
      setNotice(result.message)
      return
    }

    const packet = saveLaunchDecisionPacket({
      item,
      session,
      actorRole: roleLabels[session.role],
      auditEventId: result.auditEvent.id,
      status: 'Queued For Review',
    })
    setNotice(`${packet.title} packet queued for server-action review.`)
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Production Readiness"
        title="Launch Gate"
        description="Executive readiness score for data contracts, action governance, audit coverage, support health, billing risk, agent boundaries, and integration posture."
        action={(
          <div className="page-header-actions">
            <StatusPill label={model.status} tone={launchTone} />
            <button className="ghost-action" disabled={!canExport} onClick={exportLaunchReport}>
              <Download size={15} strokeWidth={1.8} />
              Export Report
            </button>
          </div>
        )}
      />
      {notice && <p className="warning-copy">{notice}</p>}

      <section className={`panel launch-score-panel tone-${launchTone}`}>
        <div className="launch-score-orb">
          <Gauge size={22} strokeWidth={1.8} />
          <strong>{model.score}</strong>
          <span>Readiness</span>
        </div>
        <div>
          <p className="eyebrow">Launch Decision</p>
          <h2>{model.summary}</h2>
          <span>Generated {formatDateTime(model.generatedAt)} from {sourceLabel}, local action queue state, and the current read-model diagnostics.</span>
        </div>
        <button className="ghost-action" onClick={onOpenActionRequests}>
          <ListChecks size={15} strokeWidth={1.8} />
          Action Queue
        </button>
      </section>

      <div className="launch-mode-toggle" aria-label="Launch view mode">
        <button className={viewMode === 'command' ? 'selected' : ''} onClick={() => setViewMode('command')}>
          <Gauge size={15} strokeWidth={1.8} />
          Command Mode
        </button>
        <button className={viewMode === 'matrix' ? 'selected' : ''} onClick={() => setViewMode('matrix')}>
          <DatabaseZap size={15} strokeWidth={1.8} />
          Backend Matrix
        </button>
        <button className={viewMode === 'implementation' ? 'selected' : ''} onClick={() => setViewMode('implementation')}>
          <Wrench size={15} strokeWidth={1.8} />
          Implementation
        </button>
        <button className={viewMode === 'specs' ? 'selected' : ''} onClick={() => setViewMode('specs')}>
          <FileText size={15} strokeWidth={1.8} />
          Handler Specs
        </button>
        <button className={viewMode === 'readiness' ? 'selected' : ''} onClick={() => setViewMode('readiness')}>
          <ListChecks size={15} strokeWidth={1.8} />
          Handler Board
        </button>
        <button className={viewMode === 'engHandoff' ? 'selected' : ''} onClick={() => setViewMode('engHandoff')}>
          <ClipboardCheck size={15} strokeWidth={1.8} />
          Eng Handoff
        </button>
        <button className={viewMode === 'testMatrix' ? 'selected' : ''} onClick={() => setViewMode('testMatrix')}>
          <ShieldCheck size={15} strokeWidth={1.8} />
          Test Matrix
        </button>
        <button className={viewMode === 'testEvidence' ? 'selected' : ''} onClick={() => setViewMode('testEvidence')}>
          <ScrollText size={15} strokeWidth={1.8} />
          Evidence Pack
        </button>
        <button className={viewMode === 'executionReady' ? 'selected' : ''} onClick={() => setViewMode('executionReady')}>
          <DatabaseZap size={15} strokeWidth={1.8} />
          Execution Ready
        </button>
        <button className={viewMode === 'deployChecklist' ? 'selected' : ''} onClick={() => setViewMode('deployChecklist')}>
          <ClipboardCheck size={15} strokeWidth={1.8} />
          Deploy Check
        </button>
        <button className={viewMode === 'releaseCommand' ? 'selected' : ''} onClick={() => setViewMode('releaseCommand')}>
          <Send size={15} strokeWidth={1.8} />
          Release Cmd
        </button>
        <button className={viewMode === 'backendWatch' ? 'selected' : ''} onClick={() => setViewMode('backendWatch')}>
          <Gauge size={15} strokeWidth={1.8} />
          Backend Watch
        </button>
        <button className={viewMode === 'backendClosure' ? 'selected' : ''} onClick={() => setViewMode('backendClosure')}>
          <ClipboardCheck size={15} strokeWidth={1.8} />
          Backend Closure
        </button>
        <button className={viewMode === 'productionGuardrails' ? 'selected' : ''} onClick={() => setViewMode('productionGuardrails')}>
          <ShieldCheck size={15} strokeWidth={1.8} />
          Guardrails
        </button>
        <button className={viewMode === 'goNoGo' ? 'selected' : ''} onClick={() => setViewMode('goNoGo')}>
          <UserCheck size={15} strokeWidth={1.8} />
          Go / No-Go
        </button>
        <button className={viewMode === 'warRoom' ? 'selected' : ''} onClick={() => setViewMode('warRoom')}>
          <ScrollText size={15} strokeWidth={1.8} />
          War Room
        </button>
        <button className={viewMode === 'savedViews' ? 'selected' : ''} onClick={() => setViewMode('savedViews')}>
          <Search size={15} strokeWidth={1.8} />
          Saved Views
        </button>
        <button className={viewMode === 'exceptionSla' ? 'selected' : ''} onClick={() => setViewMode('exceptionSla')}>
          <AlarmClock size={15} strokeWidth={1.8} />
          Exception SLA
        </button>
        <button className={viewMode === 'ownerBrief' ? 'selected' : ''} onClick={() => setViewMode('ownerBrief')}>
          <FileText size={15} strokeWidth={1.8} />
          Owner Brief
        </button>
        <button className={viewMode === 'evidencePacket' ? 'selected' : ''} onClick={() => setViewMode('evidencePacket')}>
          <ClipboardCheck size={15} strokeWidth={1.8} />
          Evidence Packet
        </button>
        <button className={viewMode === 'postLaunch' ? 'selected' : ''} onClick={() => setViewMode('postLaunch')}>
          <Gauge size={15} strokeWidth={1.8} />
          Post-Launch
        </button>
        <button className={viewMode === 'incidentCommand' ? 'selected' : ''} onClick={() => setViewMode('incidentCommand')}>
          <Siren size={15} strokeWidth={1.8} />
          Incident Cmd
        </button>
        <button className={viewMode === 'communications' ? 'selected' : ''} onClick={() => setViewMode('communications')}>
          <Send size={15} strokeWidth={1.8} />
          Comms
        </button>
        <button className={viewMode === 'sendReview' ? 'selected' : ''} onClick={() => setViewMode('sendReview')}>
          <GitBranch size={15} strokeWidth={1.8} />
          Send Review
        </button>
        <button className={viewMode === 'deliveryEvidence' ? 'selected' : ''} onClick={() => setViewMode('deliveryEvidence')}>
          <ClipboardCheck size={15} strokeWidth={1.8} />
          Delivery Proof
        </button>
        <button className={viewMode === 'recipientResponse' ? 'selected' : ''} onClick={() => setViewMode('recipientResponse')}>
          <MessageSquare size={15} strokeWidth={1.8} />
          Recipient Replies
        </button>
        <button className={viewMode === 'closurePack' ? 'selected' : ''} onClick={() => setViewMode('closurePack')}>
          <ScrollText size={15} strokeWidth={1.8} />
          Closure Pack
        </button>
        <button className={viewMode === 'finalAudit' ? 'selected' : ''} onClick={() => setViewMode('finalAudit')}>
          <ShieldCheck size={15} strokeWidth={1.8} />
          Final Audit
        </button>
        <button className={viewMode === 'auditArchive' ? 'selected' : ''} onClick={() => setViewMode('auditArchive')}>
          <ScrollText size={15} strokeWidth={1.8} />
          Audit Archive
        </button>
        <button className={viewMode === 'closure' ? 'selected' : ''} onClick={() => setViewMode('closure')}>
          <CheckCircle2 size={15} strokeWidth={1.8} />
          Closure
        </button>
        <button className={viewMode === 'brief' ? 'selected' : ''} onClick={() => setViewMode('brief')}>
          <FileText size={15} strokeWidth={1.8} />
          Executive Brief
        </button>
        <button className={viewMode === 'manifest' ? 'selected' : ''} onClick={() => setViewMode('manifest')}>
          <ClipboardCheck size={15} strokeWidth={1.8} />
          Artifact Manifest
        </button>
        <button className={viewMode === 'approval' ? 'selected' : ''} onClick={() => setViewMode('approval')}>
          <ShieldCheck size={15} strokeWidth={1.8} />
          Approval
        </button>
        <button className={viewMode === 'followup' ? 'selected' : ''} onClick={() => setViewMode('followup')}>
          <ListChecks size={15} strokeWidth={1.8} />
          Follow-Up
        </button>
        <button className={viewMode === 'watch' ? 'selected' : ''} onClick={() => setViewMode('watch')}>
          <Gauge size={15} strokeWidth={1.8} />
          Watch
        </button>
        <button className={viewMode === 'detail' ? 'selected' : ''} onClick={() => setViewMode('detail')}>
          <ScrollText size={15} strokeWidth={1.8} />
          Full Detail
        </button>
      </div>

      {viewMode === 'command' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Decisions Needed" value={String(commandMode.decisionCount)} delta="Command queue" tone={commandMode.decisionCount ? 'warn' : 'ok'} icon={<Gauge size={16} />} />
            <MetricCard label="Blockers" value={String(commandMode.blockerCount)} delta="Source gates blocked" tone={commandMode.blockerCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Required Sign-Offs" value={String(commandMode.requiredSignOffCount)} delta="Owner decisions" tone={commandMode.requiredSignOffCount ? 'warn' : 'ok'} icon={<UserCheck size={16} />} />
            <MetricCard label="Open Actions" value={String(commandMode.openActionRequestCount)} delta="Server queue" tone={commandMode.openActionRequestCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Decision Packets" value={String(decisionPackets.length)} delta="Local command artifacts" tone={decisionPackets.length ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
            <MetricCard label="Queued Packets" value={String(decisionPackets.filter(packet => packet.status === 'Queued For Review').length)} delta="Action review path" tone={decisionPackets.some(packet => packet.status === 'Queued For Review') ? 'warn' : 'neutral'} icon={<Send size={16} />} />
            <MetricCard label="Follow-Up Packets" value={String(decisionPackets.filter(packet => packet.status === 'Approved For Follow-Up' || packet.status === 'Assigned Follow-Up').length)} delta="Approved or assigned" tone="ok" icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Deferred Packets" value={String(decisionPackets.filter(packet => packet.status === 'Deferred').length)} delta="Needs owner decision" tone={decisionPackets.some(packet => packet.status === 'Deferred') ? 'warn' : 'neutral'} icon={<ClipboardCheck size={16} />} />
          </div>

          <section className={`panel launch-command-panel tone-${commandMode.nextItem ? getLaunchCommandItemTone(commandMode.nextItem.status) : 'ok'}`}>
            <div>
              <p className="eyebrow">Next Decision</p>
              <h2>{commandMode.nextItem?.title ?? 'No launch decisions are waiting.'}</h2>
              <span>{commandMode.nextItem?.nextDecision ?? 'All blockers, sign-offs, and action requests are clear for the current read model.'}</span>
            </div>
            <div className="launch-command-meta">
              {commandMode.nextItem ? (
                <>
                  <StatusPill label={commandMode.nextItem.status} tone={getLaunchCommandItemTone(commandMode.nextItem.status)} />
                  <strong>{commandMode.nextItem.owner}</strong>
                  <span>{commandMode.nextItem.type} / {commandMode.nextItem.reference}</span>
                  <button className="ghost-action" onClick={() => createDecisionPacket(commandMode.nextItem!)}>
                    <FileText size={15} strokeWidth={1.8} />
                    Create Packet
                  </button>
                </>
              ) : (
                <StatusPill label="Clear" tone="ok" />
              )}
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Command Rule</p>
              <h2>Only unresolved launch work appears here</h2>
              <span>This mode filters the full launch ledger into the next decisions needed: source blockers, missing sign-offs, and open server-action requests. Local decisions are evidence, not production mutations.</span>
            </div>
            <StatusPill label={canSignOff ? 'Decision recording enabled' : 'Review only'} tone={canSignOff ? 'ok' : 'warn'} />
          </section>

          <section className="panel launch-packet-review-panel">
            <div className="launch-packet-review-summary">
              <p className="eyebrow">Packet Approval</p>
              <h2>{selectedPacket?.title ?? 'No decision packet selected'}</h2>
              <span>{selectedPacket?.nextDecision ?? 'Create a packet from Command Decisions to open approval controls.'}</span>
              <div className="support-actions">
                {selectedPacket && <StatusPill label={selectedPacket.status} tone={getLaunchDecisionPacketStatusTone(selectedPacket.status)} />}
                <StatusPill label={canReviewPackets ? 'Approval enabled' : 'Read only'} tone={canReviewPackets ? 'ok' : 'warn'} />
              </div>
            </div>

            <div className="launch-packet-review-form">
              <label className="field compact-field">
                <span>Packet</span>
                <select value={selectedPacket?.id ?? ''} disabled={!decisionPackets.length} onChange={event => setSelectedPacketId(event.target.value)}>
                  {decisionPackets.length ? (
                    decisionPackets.map(packet => <option key={packet.id} value={packet.id}>{packet.title}</option>)
                  ) : (
                    <option value="">No packets</option>
                  )}
                </select>
              </label>

              <label className="field compact-field">
                <span>Follow-Up Owner</span>
                <select value={packetReviewOwner} disabled={!selectedPacket} onChange={event => setPacketReviewOwner(event.target.value)}>
                  {packetOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                </select>
              </label>

              <label className="field compact-field">
                <span>Review Note</span>
                <textarea
                  value={packetReviewNote}
                  disabled={!selectedPacket}
                  onChange={event => setPacketReviewNote(event.target.value)}
                  placeholder="Record approval context, deferral reason, or follow-up assignment."
                />
              </label>

              <div className="support-actions">
                <button className="ghost-action" disabled={!canReviewPackets || !selectedPacket} onClick={() => selectedPacket && recordPacketReview(selectedPacket, 'Approved For Follow-Up')}>
                  <CheckCircle2 size={15} strokeWidth={1.8} />
                  Approve
                </button>
                <button className="ghost-action" disabled={!canReviewPackets || !selectedPacket} onClick={() => selectedPacket && recordPacketReview(selectedPacket, 'Assigned Follow-Up')}>
                  <UserCheck size={15} strokeWidth={1.8} />
                  Assign
                </button>
                <button className="ghost-action" disabled={!canReviewPackets || !selectedPacket} onClick={() => selectedPacket && recordPacketReview(selectedPacket, 'Deferred')}>
                  <ClipboardCheck size={15} strokeWidth={1.8} />
                  Defer
                </button>
              </div>
            </div>
          </section>

          <DataTable
            label="Command Decisions"
            rows={commandMode.items}
            pageSize={8}
            emptyTitle="No command decisions are waiting."
            columns={[
              {
                key: 'type',
                header: 'Type',
                sortable: true,
                searchValue: row => `${row.type} ${row.reference}`,
                render: row => <div><strong>{row.type}</strong><span className="cell-subtext">{row.reference}</span></div>,
              },
              {
                key: 'decision',
                header: 'Decision',
                sortable: true,
                searchValue: row => `${row.title} ${row.nextDecision} ${row.whyItMatters}`,
                render: row => (
                  <button className="table-link" onClick={() => reviewCommandItem(row.id)}>
                    {row.title}
                  </button>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchCommandItemTone(row.status)} />,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => row.owner,
              },
              {
                key: 'next',
                header: 'Next Decision',
                searchValue: row => row.nextDecision,
                render: row => <span className="muted-copy">{row.nextDecision}</span>,
              },
              {
                key: 'packet',
                header: 'Packet',
                searchValue: row => latestPacketByCommandItem.get(row.id)?.status ?? 'No packet',
                render: row => {
                  const packet = latestPacketByCommandItem.get(row.id)
                  return (
                    <div className="support-actions">
                      {packet && <StatusPill label={packet.status} tone={getLaunchDecisionPacketStatusTone(packet.status)} />}
                      <button className="ghost-action" onClick={() => createDecisionPacket(row)}>
                        <FileText size={15} strokeWidth={1.8} />
                        Draft
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueDecisionPacket(row)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue
                      </button>
                      {packet && (
                        <button className="ghost-action" disabled={!canExport} onClick={() => exportDecisionPacket(packet)}>
                          <Download size={15} strokeWidth={1.8} />
                          Export
                        </button>
                      )}
                      {packet && (
                        <button className="ghost-action" onClick={() => setSelectedPacketId(packet.id)}>
                          <UserCheck size={15} strokeWidth={1.8} />
                          Review
                        </button>
                      )}
                    </div>
                  )
                },
              },
            ]}
          />

          <DataTable
            label="Decision Packets"
            rows={decisionPackets}
            pageSize={6}
            emptyTitle="No command decision packets have been created yet."
            columns={[
              {
                key: 'created',
                header: 'Created',
                sortable: true,
                searchValue: row => row.createdAt,
                render: row => formatDateTime(row.updatedAt ?? row.createdAt),
              },
              {
                key: 'packet',
                header: 'Packet',
                sortable: true,
                searchValue: row => `${row.title} ${row.evidence} ${row.nextDecision}`,
                render: row => <div><strong>{row.title}</strong><span className="cell-subtext">{row.type} / {row.reference}</span></div>,
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchDecisionPacketStatusTone(row.status)} />,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => `${row.owner} ${row.followUpOwner ?? ''} ${row.reviewedByRole ?? ''}`,
                render: row => (
                  <div>
                    <strong>{row.followUpOwner ?? row.owner}</strong>
                    {row.reviewedAt && <span className="cell-subtext">Reviewed by {row.reviewedByRole}</span>}
                  </div>
                ),
              },
              {
                key: 'approval',
                header: 'Approval Path',
                searchValue: row => row.approvalPath.join(' '),
                render: row => row.approvalPath.join(' / '),
              },
              {
                key: 'review',
                header: 'Review',
                searchValue: row => `${row.reviewNote ?? ''} ${row.reviewedBy ?? ''}`,
                render: row => (
                  <div>
                    <strong>{row.reviewedAt ? formatDateTime(row.reviewedAt) : 'Pending'}</strong>
                    <span className="cell-subtext">{row.reviewNote ?? 'No packet decision recorded yet.'}</span>
                  </div>
                ),
              },
              {
                key: 'next',
                header: 'Next Decision',
                searchValue: row => row.nextDecision,
                render: row => <span className="muted-copy">{row.nextDecision}</span>,
              },
              {
                key: 'actions',
                header: 'Actions',
                searchValue: row => `${row.title} ${row.status}`,
                render: row => (
                  <div className="support-actions">
                    <button className="ghost-action" onClick={() => setSelectedPacketId(row.id)}>
                      <UserCheck size={15} strokeWidth={1.8} />
                      Review
                    </button>
                    <button className="ghost-action" disabled={!canExport} onClick={() => exportDecisionPacket(row)}>
                      <Download size={15} strokeWidth={1.8} />
                      Export
                    </button>
                  </div>
                ),
              },
            ]}
          />
        </>
      ) : viewMode === 'matrix' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Backend Matrix" value={backendMatrix.status} delta={`${backendMatrix.score}% implementation evidence`} tone={getLaunchBackendMatrixTone(backendMatrix.status)} icon={<DatabaseZap size={16} />} />
            <MetricCard label="Ready Rows" value={String(backendMatrix.readyCount)} delta={`${backendMatrix.rows.length} total rows`} tone="ok" icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Watch Rows" value={String(backendMatrix.watchCount)} delta="Review before wiring" tone={backendMatrix.watchCount ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
            <MetricCard label="Blocked / Missing" value={`${backendMatrix.blockedCount}/${backendMatrix.missingCount}`} delta="Must clear before backend implementation" tone={backendMatrix.blockedCount || backendMatrix.missingCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Dry Runs" value={String(localMockServerExecutions.length)} delta="Execution ledger proof" tone={localMockServerExecutions.length ? 'ok' : 'warn'} icon={<DatabaseZap size={16} />} />
            <MetricCard label="Action Requests" value={String(actionRequests.length)} delta="Server-action demand" tone={actionRequests.length ? 'ok' : 'warn'} icon={<ListChecks size={16} />} />
            <MetricCard label="Audit Events" value={String(auditEvents.length)} delta="Local plus read model" tone={auditEvents.length ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Endpoint" value={executionConfig.endpoint ? 'Set' : 'Unset'} delta={executionConfig.endpoint || 'Review-only contract mode'} tone={executionConfig.endpoint ? 'ok' : 'warn'} icon={<DatabaseZap size={16} />} />
          </div>

          <section className={`panel launch-backend-matrix-panel tone-${getLaunchBackendMatrixTone(backendMatrix.status)}`}>
            <div>
              <p className="eyebrow">Backend Implementation Gate</p>
              <h2>{backendMatrix.summary}</h2>
              <span>Generated {formatDateTime(backendMatrix.generatedAt)} from approvals, handoff readiness, dry-run ledger, execution evidence, adapter coverage, audit chain, rollback proof, and browser mutation boundary.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendMatrix.status} tone={getLaunchBackendMatrixTone(backendMatrix.status)} />
              <strong>{backendMatrix.score}% score</strong>
              <button className="ghost-action" onClick={onOpenActionRequests}>
                <ListChecks size={15} strokeWidth={1.8} />
                Action Queue
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Matrix Rule</p>
              <h2>Backend readiness is proof, not deployment</h2>
              <span>{launchBackendReadinessMatrixBoundaryRule}</span>
              <span>Any production-changing work still requires scoped permissions, human confirmation where required, trusted server handlers, rollback notes, and immutable audit records.</span>
            </div>
            <StatusPill label={canRecordReview ? 'Matrix reviews enabled' : 'Read only'} tone={canRecordReview ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Backend Readiness Matrix"
              rows={backendMatrix.rows}
              pageSize={9}
              emptyTitle="No backend readiness matrix rows are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getLaunchBackendMatrixTone(row.status)} />,
                },
                {
                  key: 'gate',
                  header: 'Gate',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.evidence} ${row.nextStep}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedMatrixId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'area',
                  header: 'Area',
                  sortable: true,
                  searchValue: row => row.area,
                  render: row => row.area,
                },
                {
                  key: 'score',
                  header: 'Score',
                  sortable: true,
                  searchValue: row => String(row.score),
                  render: row => `${row.score}%`,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => row.owner,
                  render: row => row.owner,
                },
                {
                  key: 'metric',
                  header: 'Metric',
                  sortable: true,
                  searchValue: row => row.metric,
                  render: row => row.metric,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className="muted-copy">{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedMatrixRow ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Matrix Detail</p>
                      <h2>{selectedMatrixRow.title}</h2>
                    </div>
                    <StatusPill label={selectedMatrixRow.status} tone={getLaunchBackendMatrixTone(selectedMatrixRow.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Area</span><strong>{selectedMatrixRow.area}</strong></div>
                    <div><span>Owner</span><strong>{selectedMatrixRow.owner}</strong></div>
                    <div><span>Score</span><strong>{selectedMatrixRow.score}%</strong></div>
                    <div><span>Metric</span><strong>{selectedMatrixRow.metric}</strong></div>
                    <div><span>Status</span><strong>{selectedMatrixRow.status}</strong></div>
                    <div><span>Review</span><strong>{selectedMatrixRow.status === 'Ready' ? 'Monitoring' : 'Required'}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Evidence</h3>
                    <p className="muted-copy">{selectedMatrixRow.evidence}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Next Step</h3>
                    <p className={selectedMatrixRow.status === 'Blocked' || selectedMatrixRow.status === 'Missing' ? 'warning-copy' : 'muted-copy'}>{selectedMatrixRow.nextStep}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Matrix Checks</h3>
                    <div className="launch-matrix-check-list">
                      {selectedMatrixRow.checks.map(item => (
                        <article key={item.id} className={`launch-matrix-check-item tone-${getLaunchBackendMatrixTone(item.status)}`}>
                          <div>
                            <strong>{item.label}</strong>
                            <StatusPill label={item.status} tone={getLaunchBackendMatrixTone(item.status)} />
                          </div>
                          <p>{item.detail}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Action Panel</h3>
                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canRecordReview} onClick={() => recordMatrixReview(selectedMatrixRow)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Matrix Review
                      </button>
                      <button className="ghost-action" onClick={onOpenActionRequests}>
                        <ListChecks size={15} strokeWidth={1.8} />
                        Open Queue
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No matrix row selected.</div>
              )}
            </aside>
          </div>
        </>
      ) : viewMode === 'implementation' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Work Items" value={String(backendImplementationWorkbench.totalCount)} delta={`${backendImplementationWorkbench.criticalCount} critical open`} tone={backendImplementationWorkbench.criticalCount ? 'danger' : 'ok'} icon={<Wrench size={16} />} />
            <MetricCard label="Blocked Work" value={String(backendImplementationWorkbench.blockedCount)} delta="Must clear before trusted wiring" tone={backendImplementationWorkbench.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Ready For Build" value={String(backendImplementationWorkbench.readyForBuildCount)} delta="Server handler candidates" tone={backendImplementationWorkbench.readyForBuildCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Completed" value={String(backendImplementationWorkbench.completeCount)} delta="Local evidence records" tone={backendImplementationWorkbench.completeCount ? 'ok' : 'neutral'} icon={<ClipboardCheck size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Planning" value={String(backendImplementationWorkbench.planningCount)} delta="Needs owner scoping" tone={backendImplementationWorkbench.planningCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
            <MetricCard label="In Review" value={String(backendImplementationWorkbench.inReviewCount)} delta="Implementation review path" tone={backendImplementationWorkbench.inReviewCount ? 'warn' : 'neutral'} icon={<UserCheck size={16} />} />
            <MetricCard label="Local Records" value={String(backendImplementationRecords.length)} delta="Audit-backed work updates" tone={backendImplementationRecords.length ? 'ok' : 'neutral'} icon={<ScrollText size={16} />} />
            <MetricCard label="Audit Backed" value={String(backendImplementationWorkbench.auditBackedCount)} delta="Workbench items with records" tone={backendImplementationWorkbench.auditBackedCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
          </div>

          <section className={`panel launch-implementation-panel tone-${getBackendImplementationWorkTone(backendImplementationWorkbench.status)}`}>
            <div>
              <p className="eyebrow">Backend Implementation Workbench</p>
              <h2>{backendImplementationWorkbench.summary}</h2>
              <span>Generated {formatDateTime(backendImplementationWorkbench.generatedAt)} from the backend readiness matrix. Each item carries owner, handler, dependencies, rollback requirement, audit requirement, and acceptance checks.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendImplementationWorkbench.status} tone={getBackendImplementationWorkTone(backendImplementationWorkbench.status)} />
              <strong>{backendImplementationWorkbench.nextItem?.title ?? 'No open work'}</strong>
              <button className="ghost-action" onClick={() => setViewMode('matrix')}>
                <DatabaseZap size={15} strokeWidth={1.8} />
                Matrix
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Implementation Rule</p>
              <h2>Workbench records are planning evidence</h2>
              <span>{launchBackendImplementationWorkbenchBoundaryRule}</span>
              <span>To become production work, an item must be queued as an Admin Action Request and later executed by a trusted server-side handler with permission checks, rollback proof, and audit logging.</span>
            </div>
            <StatusPill label={canManageImplementation ? 'Work updates enabled' : 'Read only'} tone={canManageImplementation ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Backend Implementation Workbench"
              rows={backendImplementationWorkbench.items}
              pageSize={9}
              emptyTitle="No backend implementation work items are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getBackendImplementationWorkTone(row.status)} />,
                },
                {
                  key: 'work',
                  header: 'Work Item',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.evidence} ${row.nextStep} ${row.handlerKey}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedImplementationId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'priority',
                  header: 'Priority',
                  sortable: true,
                  searchValue: row => row.priority,
                  render: row => <StatusPill label={row.priority} tone={getBackendImplementationPriorityTone(row.priority)} />,
                },
                {
                  key: 'area',
                  header: 'Area',
                  sortable: true,
                  searchValue: row => `${row.area} ${row.type}`,
                  render: row => <div><strong>{row.area}</strong><span className="cell-subtext">{row.type}</span></div>,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => row.owner,
                  render: row => row.owner,
                },
                {
                  key: 'handler',
                  header: 'Handler',
                  searchValue: row => `${row.handlerKey} ${row.handlerLabel}`,
                  render: row => <div><strong>{row.handlerLabel}</strong><span className="cell-subtext">{row.handlerKey}</span></div>,
                },
                {
                  key: 'dependencies',
                  header: 'Dependencies',
                  sortable: true,
                  searchValue: row => row.dependencies.join(' '),
                  render: row => row.dependencies.length ? `${row.dependencies.length} open` : 'Clear',
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className="muted-copy">{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedImplementationItem ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Implementation Plan</p>
                      <h2>{selectedImplementationItem.title}</h2>
                    </div>
                    <StatusPill label={selectedImplementationItem.status} tone={getBackendImplementationWorkTone(selectedImplementationItem.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Area</span><strong>{selectedImplementationItem.area}</strong></div>
                    <div><span>Priority</span><strong>{selectedImplementationItem.priority}</strong></div>
                    <div><span>Owner</span><strong>{selectedImplementationItem.owner}</strong></div>
                    <div><span>Handler</span><strong>{selectedImplementationItem.handlerKey}</strong></div>
                    <div><span>Due</span><strong>{selectedImplementationItem.dueLabel}</strong></div>
                    <div><span>Audit</span><strong>{selectedImplementationItem.auditBacked ? 'Recorded' : 'Pending'}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Evidence</h3>
                    <p className="muted-copy">{selectedImplementationItem.evidence}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Dependencies</h3>
                    {selectedImplementationItem.dependencies.length ? (
                      <div className="launch-implementation-dependency-list">
                        {selectedImplementationItem.dependencies.map(dependency => (
                          <span key={dependency}>{dependency}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="muted-copy">No open matrix dependencies are attached to this work item.</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Acceptance Checks</h3>
                    <div className="launch-implementation-check-list">
                      {selectedImplementationItem.acceptanceChecks.map(item => (
                        <article key={item.id} className={`launch-implementation-check-item tone-${getLaunchBackendMatrixTone(item.status)}`}>
                          <div>
                            <strong>{item.label}</strong>
                            <StatusPill label={item.status} tone={getLaunchBackendMatrixTone(item.status)} />
                          </div>
                          <p>{item.detail}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Rollback And Audit</h3>
                    <p className="muted-copy">{selectedImplementationItem.rollbackRequirement}</p>
                    <p className="muted-copy">{selectedImplementationItem.auditRequirement}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Action Panel</h3>
                    <div className="launch-implementation-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={implementationStatus} onChange={event => setImplementationStatus(event.target.value as BackendImplementationWorkStatus)}>
                          {launchBackendImplementationWorkStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={implementationOwner} onChange={event => setImplementationOwner(event.target.value)}>
                          {implementationOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={implementationNote}
                          onChange={event => setImplementationNote(event.target.value)}
                          placeholder="Record dependency decision, handler scope, rollback proof, or review context."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canManageImplementation} onClick={() => recordImplementationWorkUpdate(selectedImplementationItem)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Work Review
                      </button>
                      <button className="ghost-action" disabled={!canManageImplementation} onClick={() => recordImplementationWorkUpdate(selectedImplementationItem, 'Ready For Build')}>
                        <Wrench size={15} strokeWidth={1.8} />
                        Mark Ready
                      </button>
                      <button className="ghost-action" disabled={!canManageImplementation} onClick={() => recordImplementationWorkUpdate(selectedImplementationItem, 'Complete')}>
                        <ClipboardCheck size={15} strokeWidth={1.8} />
                        Complete
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueImplementationWorkRequest(selectedImplementationItem)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Request
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No implementation work item selected.</div>
              )}
            </aside>
          </div>
        </>
      ) : viewMode === 'specs' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Handler Specs" value={String(backendHandlerSpecRegister.totalCount)} delta={`${backendHandlerSpecRegister.criticalCount} critical open`} tone={backendHandlerSpecRegister.criticalCount ? 'danger' : 'ok'} icon={<FileText size={16} />} />
            <MetricCard label="Blocked Specs" value={String(backendHandlerSpecRegister.blockedCount)} delta="Cannot move to engineering" tone={backendHandlerSpecRegister.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Needs Review" value={String(backendHandlerSpecRegister.needsReviewCount)} delta="Owner or engineering review" tone={backendHandlerSpecRegister.needsReviewCount ? 'warn' : 'ok'} icon={<UserCheck size={16} />} />
            <MetricCard label="Ready / Approved" value={`${backendHandlerSpecRegister.readyCount}/${backendHandlerSpecRegister.approvedCount}`} delta="Engineering handoff evidence" tone={backendHandlerSpecRegister.readyCount || backendHandlerSpecRegister.approvedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Draft Specs" value={String(backendHandlerSpecRegister.draftCount)} delta="Generated from workbench" tone={backendHandlerSpecRegister.draftCount ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
            <MetricCard label="Spec Reviews" value={String(backendHandlerSpecReviews.length)} delta="Local audit-backed decisions" tone={backendHandlerSpecReviews.length ? 'ok' : 'neutral'} icon={<ScrollText size={16} />} />
            <MetricCard label="Audit Backed" value={String(backendHandlerSpecRegister.auditBackedCount)} delta="Specs with review records" tone={backendHandlerSpecRegister.auditBackedCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Export Permission" value={canExport ? 'Enabled' : 'Read Only'} delta="reports.export" tone={canExport ? 'ok' : 'warn'} icon={<Download size={16} />} />
          </div>

          <section className={`panel launch-handler-spec-panel tone-${getBackendHandlerSpecStatusTone(backendHandlerSpecRegister.status)}`}>
            <div>
              <p className="eyebrow">Backend Handler Spec Generator</p>
              <h2>{backendHandlerSpecRegister.summary}</h2>
              <span>Generated {formatDateTime(backendHandlerSpecRegister.generatedAt)} from implementation work items. Each spec includes request shape, response shape, audit fields, approval gates, rollback handling, endpoint naming, and browser mutation boundaries.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendHandlerSpecRegister.status} tone={getBackendHandlerSpecStatusTone(backendHandlerSpecRegister.status)} />
              <strong>{backendHandlerSpecRegister.nextSpec?.handlerLabel ?? 'No open specs'}</strong>
              <button className="ghost-action" onClick={() => setViewMode('implementation')}>
                <Wrench size={15} strokeWidth={1.8} />
                Workbench
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Spec Rule</p>
              <h2>Handler specs are not live endpoints</h2>
              <span>{backendHandlerSpecBoundaryRule}</span>
              <span>Engineering can use these generated artifacts to implement trusted server handlers, but production-changing work still requires reviewed code, scoped permissions, human confirmation, idempotency, rollback proof, and immutable audit logging.</span>
            </div>
            <StatusPill label={canReviewHandlerSpecs ? 'Spec reviews enabled' : 'Read only'} tone={canReviewHandlerSpecs ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Backend Handler Specs"
              rows={backendHandlerSpecRegister.specs}
              pageSize={9}
              emptyTitle="No backend handler specs are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getBackendHandlerSpecStatusTone(row.status)} />,
                },
                {
                  key: 'handler',
                  header: 'Handler',
                  sortable: true,
                  searchValue: row => `${row.handlerLabel} ${row.handlerKey} ${row.endpoint}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedHandlerSpecId(row.id)}>
                      {row.handlerLabel}
                    </button>
                  ),
                },
                {
                  key: 'risk',
                  header: 'Risk',
                  sortable: true,
                  searchValue: row => row.risk,
                  render: row => <StatusPill label={row.risk} tone={getBackendHandlerSpecRiskTone(row.risk)} />,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => row.owner,
                  render: row => row.owner,
                },
                {
                  key: 'permission',
                  header: 'Permission',
                  sortable: true,
                  searchValue: row => row.permission,
                  render: row => row.permission,
                },
                {
                  key: 'endpoint',
                  header: 'Endpoint',
                  searchValue: row => `${row.method} ${row.endpoint}`,
                  render: row => <div><strong>{row.method}</strong><span className="cell-subtext">{row.endpoint}</span></div>,
                },
                {
                  key: 'mode',
                  header: 'Mode',
                  sortable: true,
                  searchValue: row => row.mutationMode,
                  render: row => row.mutationMode,
                },
                {
                  key: 'gates',
                  header: 'Gates',
                  sortable: true,
                  searchValue: row => row.approvalGates.map(gate => gate.status).join(' '),
                  render: row => `${row.approvalGates.filter(gate => gate.status !== 'Ready').length} open`,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedHandlerSpec ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Handler Spec</p>
                      <h2>{selectedHandlerSpec.handlerLabel}</h2>
                    </div>
                    <StatusPill label={selectedHandlerSpec.status} tone={getBackendHandlerSpecStatusTone(selectedHandlerSpec.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Handler</span><strong>{selectedHandlerSpec.handlerKey}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedHandlerSpec.method} {selectedHandlerSpec.endpoint}</strong></div>
                    <div><span>Permission</span><strong>{selectedHandlerSpec.permission}</strong></div>
                    <div><span>Mode</span><strong>{selectedHandlerSpec.mutationMode}</strong></div>
                    <div><span>Dry Run</span><strong>{selectedHandlerSpec.dryRunRequired ? 'Required' : 'Optional'}</strong></div>
                    <div><span>Audit</span><strong>{selectedHandlerSpec.auditBacked ? 'Recorded' : 'Pending'}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Acceptance Summary</h3>
                    <p className={selectedHandlerSpec.status === 'Blocked' ? 'warning-copy' : 'muted-copy'}>{selectedHandlerSpec.acceptanceSummary}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Request Shape</h3>
                    <div className="launch-handler-field-list">
                      {selectedHandlerSpec.requestFields.map(field => (
                        <article key={field.name} className="launch-handler-field-item">
                          <div>
                            <strong>{field.name}</strong>
                            <StatusPill label={field.required ? 'Required' : 'Optional'} tone={field.required ? 'warn' : 'neutral'} />
                          </div>
                          <span>{field.type}</span>
                          <p>{field.description}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Response Shape</h3>
                    <div className="launch-handler-field-list">
                      {selectedHandlerSpec.responseFields.map(field => (
                        <article key={field.name} className="launch-handler-field-item">
                          <div>
                            <strong>{field.name}</strong>
                            <StatusPill label={field.required ? 'Required' : 'Optional'} tone={field.required ? 'warn' : 'neutral'} />
                          </div>
                          <span>{field.type}</span>
                          <p>{field.description}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Audit Fields</h3>
                    <div className="launch-handler-field-list">
                      {selectedHandlerSpec.auditFields.map(field => (
                        <article key={field.name} className="launch-handler-field-item">
                          <div>
                            <strong>{field.name}</strong>
                            <StatusPill label={field.required ? 'Required' : 'Optional'} tone={field.required ? 'warn' : 'neutral'} />
                          </div>
                          <span>{field.type}</span>
                          <p>{field.description}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Approval Gates</h3>
                    <div className="launch-handler-gate-list">
                      {selectedHandlerSpec.approvalGates.map(gate => (
                        <article key={gate.id} className={`launch-handler-gate-item tone-${getBackendHandlerSpecGateTone(gate.status)}`}>
                          <div>
                            <strong>{gate.label}</strong>
                            <StatusPill label={gate.status} tone={getBackendHandlerSpecGateTone(gate.status)} />
                          </div>
                          <p>{gate.detail}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Rollback And Boundary</h3>
                    <p className="muted-copy">{selectedHandlerSpec.rollbackPlan}</p>
                    <p className="muted-copy">{selectedHandlerSpec.executionBoundary}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Review Controls</h3>
                    <div className="launch-handler-review-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={handlerSpecStatus} onChange={event => setHandlerSpecStatus(event.target.value as BackendHandlerSpecStatus)}>
                          {backendHandlerSpecStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={handlerSpecOwner} onChange={event => setHandlerSpecOwner(event.target.value)}>
                          {handlerSpecOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={handlerSpecNote}
                          onChange={event => setHandlerSpecNote(event.target.value)}
                          placeholder="Record engineering handoff, spec blockers, approval context, or implementation notes."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canReviewHandlerSpecs} onClick={() => recordHandlerSpecReview(selectedHandlerSpec)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Spec Review
                      </button>
                      <button className="ghost-action" disabled={!canReviewHandlerSpecs} onClick={() => recordHandlerSpecReview(selectedHandlerSpec, 'Ready For Engineering')}>
                        <Wrench size={15} strokeWidth={1.8} />
                        Mark Ready
                      </button>
                      <button className="ghost-action" disabled={!canReviewHandlerSpecs} onClick={() => recordHandlerSpecReview(selectedHandlerSpec, 'Approved')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Approve
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueHandlerSpecRequest(selectedHandlerSpec)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Request
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportHandlerSpec(selectedHandlerSpec)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No handler spec selected.</div>
              )}
            </aside>
          </div>
        </>
      ) : viewMode === 'readiness' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Handler Board" value={backendHandlerReadinessBoard.status} delta={backendHandlerReadinessBoard.summary} tone={getBackendHandlerReadinessTone(backendHandlerReadinessBoard.status)} icon={<ListChecks size={16} />} />
            <MetricCard label="Blocked" value={String(backendHandlerReadinessBoard.blockedCount)} delta="Before engineering handoff" tone={backendHandlerReadinessBoard.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Review / Draft" value={`${backendHandlerReadinessBoard.reviewCount}/${backendHandlerReadinessBoard.draftCount}`} delta="Owner or engineering review" tone={backendHandlerReadinessBoard.reviewCount || backendHandlerReadinessBoard.draftCount ? 'warn' : 'ok'} icon={<UserCheck size={16} />} />
            <MetricCard label="Ready / Approved" value={`${backendHandlerReadinessBoard.readyCount}/${backendHandlerReadinessBoard.approvedCount}`} delta="Engineering handoff" tone={backendHandlerReadinessBoard.readyCount || backendHandlerReadinessBoard.approvedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Owners" value={String(backendHandlerReadinessBoard.ownerCount)} delta="Handler accountability" tone={backendHandlerReadinessBoard.ownerCount ? 'ok' : 'neutral'} icon={<UserCheck size={16} />} />
            <MetricCard label="Endpoints" value={String(backendHandlerReadinessBoard.endpointCount)} delta="Generated endpoint inventory" tone={backendHandlerReadinessBoard.endpointCount ? 'ok' : 'neutral'} icon={<DatabaseZap size={16} />} />
            <MetricCard label="Mutation Candidates" value={String(backendHandlerReadinessBoard.mutationCandidateCount)} delta="Server-only candidates" tone={backendHandlerReadinessBoard.mutationCandidateCount ? 'warn' : 'ok'} icon={<Wrench size={16} />} />
            <MetricCard label="Critical Open" value={String(backendHandlerReadinessBoard.criticalCount)} delta="Needs attention before handoff" tone={backendHandlerReadinessBoard.criticalCount ? 'danger' : 'ok'} icon={<ShieldCheck size={16} />} />
          </div>

          <section className={`panel launch-handler-board-panel tone-${getBackendHandlerReadinessTone(backendHandlerReadinessBoard.status)}`}>
            <div>
              <p className="eyebrow">Handler Readiness Board</p>
              <h2>{backendHandlerReadinessBoard.summary}</h2>
              <span>Generated {formatDateTime(backendHandlerReadinessBoard.generatedAt)} from handler specs, owner assignments, endpoint names, permissions, approval gates, and engineering handoff status.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendHandlerReadinessBoard.status} tone={getBackendHandlerReadinessTone(backendHandlerReadinessBoard.status)} />
              <strong>{backendHandlerReadinessBoard.nextCard?.handlerLabel ?? 'No open handlers'}</strong>
              <button className="ghost-action" disabled={!canReviewHandlerReadiness} onClick={() => recordHandlerReadinessBoardReview()}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Review
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Board Rule</p>
              <h2>Readiness is handoff visibility, not execution</h2>
              <span>{backendHandlerReadinessBoardBoundaryRule}</span>
              <span>Handlers still move through generated specs, Admin Action Requests, trusted server implementation, human confirmation, dry-run proof, rollback proof, and immutable audit logs before any production-changing work.</span>
            </div>
            <StatusPill label={canReviewHandlerReadiness ? 'Board reviews enabled' : 'Read only'} tone={canReviewHandlerReadiness ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <section className="panel launch-handler-board-grid-panel">
              <div className="section-heading-row">
                <div>
                  <p className="eyebrow">Handoff Lanes</p>
                  <h2>Engineering readiness by status</h2>
                </div>
                <StatusPill label={`${backendHandlerReadinessBoard.totalCount} handlers`} tone="neutral" />
              </div>

              <div className="launch-handler-board-grid">
                {backendHandlerReadinessBoard.lanes.map(lane => (
                  <article key={lane.id} className={`launch-handler-board-lane tone-${getBackendHandlerReadinessTone(lane.status)}`}>
                    <div className="launch-handler-board-lane-header">
                      <div>
                        <strong>{lane.title}</strong>
                        <span>{lane.summary}</span>
                      </div>
                      <StatusPill label={String(lane.count)} tone={getBackendHandlerReadinessTone(lane.status)} />
                    </div>

                    <div className="launch-handler-board-card-list">
                      {lane.cards.length ? lane.cards.map(card => (
                        <button
                          key={card.id}
                          className={`launch-handler-board-card tone-${getBackendHandlerReadinessTone(card.status)}`}
                          onClick={() => setSelectedReadinessCardId(card.id)}
                        >
                          <div>
                            <strong>{card.handlerLabel}</strong>
                            <StatusPill label={card.risk} tone={getBackendHandlerReadinessRiskTone(card.risk)} />
                          </div>
                          <span>{card.owner} / {card.permission}</span>
                          <small>{card.method} {card.endpoint}</small>
                          <small>{card.handoffStatus}</small>
                        </button>
                      )) : (
                        <div className="empty-state compact">No handlers in this lane.</div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="detail-panel launch-detail-panel">
              {selectedReadinessCard ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Readiness Card</p>
                      <h2>{selectedReadinessCard.handlerLabel}</h2>
                    </div>
                    <StatusPill label={selectedReadinessCard.status} tone={getBackendHandlerReadinessTone(selectedReadinessCard.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Owner</span><strong>{selectedReadinessCard.owner}</strong></div>
                    <div><span>Permission</span><strong>{selectedReadinessCard.permission}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedReadinessCard.method} {selectedReadinessCard.endpoint}</strong></div>
                    <div><span>Mode</span><strong>{selectedReadinessCard.mutationMode}</strong></div>
                    <div><span>Gates</span><strong>{selectedReadinessCard.readyGateCount}/{selectedReadinessCard.gateCount} ready</strong></div>
                    <div><span>Audit</span><strong>{selectedReadinessCard.auditBacked ? 'Recorded' : 'Pending'}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Handoff Status</h3>
                    <p className={selectedReadinessCard.status === 'Blocked' ? 'warning-copy' : 'muted-copy'}>{selectedReadinessCard.handoffStatus}</p>
                    <p className="muted-copy">{selectedReadinessCard.nextStep}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Gate Summary</h3>
                    <div className="launch-handler-readiness-list">
                      <div><span>Blocked gates</span><strong>{selectedReadinessCard.blockerCount}</strong></div>
                      <div><span>Review gates</span><strong>{selectedReadinessCard.reviewGateCount}</strong></div>
                      <div><span>Ready gates</span><strong>{selectedReadinessCard.readyGateCount}</strong></div>
                    </div>
                    <p className="muted-copy">{selectedReadinessCard.acceptanceSummary}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Action Panel</h3>
                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canReviewHandlerReadiness} onClick={() => recordHandlerReadinessBoardReview(selectedReadinessCard)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Board Review
                      </button>
                      <button className="ghost-action" onClick={() => {
                        setSelectedHandlerSpecId(selectedReadinessCard.specId)
                        setViewMode('specs')
                      }}>
                        <FileText size={15} strokeWidth={1.8} />
                        Open Spec
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction || !selectedReadinessSpec} onClick={() => selectedReadinessSpec && queueHandlerSpecRequest(selectedReadinessSpec)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Request
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No readiness card selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Owner Handoff Load"
            rows={backendHandlerReadinessBoard.ownerGroups}
            pageSize={6}
            emptyTitle="No owner handoff load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} handlers / {row.criticalCount} critical</span></div>,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'ready',
                header: 'Ready',
                sortable: true,
                searchValue: row => String(row.ready),
                render: row => row.ready,
              },
              {
                key: 'approved',
                header: 'Approved',
                sortable: true,
                searchValue: row => String(row.approved),
                render: row => row.approved,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Endpoint Handoff Inventory"
            rows={backendHandlerReadinessBoard.endpointGroups}
            pageSize={6}
            emptyTitle="No endpoint handoff inventory is available."
            columns={[
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getBackendHandlerReadinessTone(row.status)} />,
              },
              {
                key: 'handler',
                header: 'Handler',
                sortable: true,
                searchValue: row => `${row.handlerLabel} ${row.handlerKey}`,
                render: row => <div><strong>{row.handlerLabel}</strong><span className="cell-subtext">{row.handlerKey}</span></div>,
              },
              {
                key: 'endpoint',
                header: 'Endpoint',
                sortable: true,
                searchValue: row => `${row.method} ${row.endpoint}`,
                render: row => <div><strong>{row.method}</strong><span className="cell-subtext">{row.endpoint}</span></div>,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => row.owner,
              },
              {
                key: 'risk',
                header: 'Risk',
                sortable: true,
                searchValue: row => row.risk,
                render: row => <StatusPill label={row.risk} tone={getBackendHandlerReadinessRiskTone(row.risk)} />,
              },
              {
                key: 'gates',
                header: 'Gates',
                searchValue: row => row.gateSummary,
                render: row => <span className="muted-copy">{row.gateSummary}</span>,
              },
            ]}
          />

          <DataTable
            label="Permission Handoff Groups"
            rows={backendHandlerReadinessBoard.permissionGroups}
            pageSize={6}
            emptyTitle="No permission handoff groups are available."
            columns={[
              {
                key: 'permission',
                header: 'Permission',
                sortable: true,
                searchValue: row => row.permission,
                render: row => <div><strong>{row.permission}</strong><span className="cell-subtext">{row.total} handlers</span></div>,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'mutation',
                header: 'Mutation Candidates',
                sortable: true,
                searchValue: row => String(row.mutationCandidateCount),
                render: row => row.mutationCandidateCount,
              },
              {
                key: 'dryRun',
                header: 'Dry Run Required',
                sortable: true,
                searchValue: row => String(row.dryRunRequiredCount),
                render: row => row.dryRunRequiredCount,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'engHandoff' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Handoff Packets" value={backendEngineeringHandoffRegister.status} delta={backendEngineeringHandoffRegister.summary} tone={getBackendEngineeringHandoffPacketTone(backendEngineeringHandoffRegister.status)} icon={<ClipboardCheck size={16} />} />
            <MetricCard label="Blocked" value={String(backendEngineeringHandoffRegister.blockedCount)} delta="Cannot enter implementation" tone={backendEngineeringHandoffRegister.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Review / Draft" value={`${backendEngineeringHandoffRegister.reviewCount}/${backendEngineeringHandoffRegister.draftCount}`} delta="Needs intake review" tone={backendEngineeringHandoffRegister.reviewCount || backendEngineeringHandoffRegister.draftCount ? 'warn' : 'ok'} icon={<UserCheck size={16} />} />
            <MetricCard label="Ready / Accepted" value={`${backendEngineeringHandoffRegister.readyCount}/${backendEngineeringHandoffRegister.acceptedCount}`} delta="Engineering intake path" tone={backendEngineeringHandoffRegister.readyCount || backendEngineeringHandoffRegister.acceptedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Critical Open" value={String(backendEngineeringHandoffRegister.criticalCount)} delta="High attention packets" tone={backendEngineeringHandoffRegister.criticalCount ? 'danger' : 'ok'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Packet Reviews" value={String(engineeringHandoffPacketReviews.length)} delta="Local audit-backed decisions" tone={engineeringHandoffPacketReviews.length ? 'ok' : 'neutral'} icon={<ScrollText size={16} />} />
            <MetricCard label="Audit Backed" value={String(backendEngineeringHandoffRegister.auditBackedCount)} delta="Packets with review records" tone={backendEngineeringHandoffRegister.auditBackedCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Export Permission" value={canExport ? 'Enabled' : 'Read Only'} delta="reports.export" tone={canExport ? 'ok' : 'warn'} icon={<Download size={16} />} />
          </div>

          <section className={`panel launch-engineering-handoff-panel tone-${getBackendEngineeringHandoffPacketTone(backendEngineeringHandoffRegister.status)}`}>
            <div>
              <p className="eyebrow">Engineering Handoff Packets</p>
              <h2>{backendEngineeringHandoffRegister.summary}</h2>
              <span>Generated {formatDateTime(backendEngineeringHandoffRegister.generatedAt)} from handler specs, readiness lanes, owner assignments, endpoint contracts, launch acceptance criteria, rollback plans, and audit requirements.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendEngineeringHandoffRegister.status} tone={getBackendEngineeringHandoffPacketTone(backendEngineeringHandoffRegister.status)} />
              <strong>{backendEngineeringHandoffRegister.nextPacket?.handlerLabel ?? 'No open packets'}</strong>
              <button className="ghost-action" disabled={!canManageEngineeringHandoff || !selectedEngineeringPacket} onClick={() => selectedEngineeringPacket && recordEngineeringHandoffPacketReview(selectedEngineeringPacket)}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Review
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Handoff Rule</p>
              <h2>Engineering handoff is planning, not implementation</h2>
              <span>{backendEngineeringHandoffPacketBoundaryRule}</span>
              <span>Packets can be reviewed, queued, and exported from Platform Admin. Any production-changing work still requires trusted server implementation, permission checks, human confirmation, dry-run proof, rollback proof, and immutable audit logging.</span>
            </div>
            <StatusPill label={canManageEngineeringHandoff ? 'Handoff reviews enabled' : 'Read only'} tone={canManageEngineeringHandoff ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Engineering Handoff Packets"
              rows={backendEngineeringHandoffRegister.packets}
              pageSize={9}
              emptyTitle="No engineering handoff packets are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getBackendEngineeringHandoffPacketTone(row.status)} />,
                },
                {
                  key: 'packet',
                  header: 'Packet',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.handlerLabel} ${row.handlerKey} ${row.handoffSummary}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedEngineeringPacketId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'risk',
                  header: 'Risk',
                  sortable: true,
                  searchValue: row => row.risk,
                  render: row => <StatusPill label={row.risk} tone={getBackendEngineeringHandoffPacketRiskTone(row.risk)} />,
                },
                {
                  key: 'owner',
                  header: 'Owners',
                  sortable: true,
                  searchValue: row => `${row.productOwner} ${row.engineeringOwner}`,
                  render: row => (
                    <div>
                      <strong>{row.engineeringOwner}</strong>
                      <span className="cell-subtext">Product: {row.productOwner}</span>
                    </div>
                  ),
                },
                {
                  key: 'endpoint',
                  header: 'Endpoint',
                  sortable: true,
                  searchValue: row => `${row.method} ${row.endpoint}`,
                  render: row => <div><strong>{row.method}</strong><span className="cell-subtext">{row.endpoint}</span></div>,
                },
                {
                  key: 'permission',
                  header: 'Permission',
                  sortable: true,
                  searchValue: row => row.permission,
                  render: row => row.permission,
                },
                {
                  key: 'checklist',
                  header: 'Checklist',
                  sortable: true,
                  searchValue: row => [...row.testChecklist, ...row.launchAcceptanceCriteria].map(check => `${check.label} ${check.status}`).join(' '),
                  render: row => {
                    const checks = [...row.testChecklist, ...row.launchAcceptanceCriteria]
                    const blocked = checks.filter(check => check.status === 'Blocked').length
                    const review = checks.filter(check => check.status === 'Review').length
                    const ready = checks.filter(check => check.status === 'Ready').length
                    return (
                      <div>
                        <strong>{ready} ready</strong>
                        <span className="cell-subtext">{blocked} blocked / {review} review</span>
                      </div>
                    )
                  },
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedEngineeringPacket ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Engineering Packet</p>
                      <h2>{selectedEngineeringPacket.title}</h2>
                    </div>
                    <StatusPill label={selectedEngineeringPacket.status} tone={getBackendEngineeringHandoffPacketTone(selectedEngineeringPacket.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Product Owner</span><strong>{selectedEngineeringPacket.productOwner}</strong></div>
                    <div><span>Engineering Owner</span><strong>{selectedEngineeringPacket.engineeringOwner}</strong></div>
                    <div><span>Handler</span><strong>{selectedEngineeringPacket.handlerKey}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedEngineeringPacket.method} {selectedEngineeringPacket.endpoint}</strong></div>
                    <div><span>Permission</span><strong>{selectedEngineeringPacket.permission}</strong></div>
                    <div><span>Mode</span><strong>{selectedEngineeringPacket.mutationMode}</strong></div>
                    <div><span>Dry Run</span><strong>{selectedEngineeringPacket.dryRunRequired ? 'Required' : 'Optional'}</strong></div>
                    <div><span>Human Confirmation</span><strong>{selectedEngineeringPacket.humanConfirmationRequired ? 'Required' : 'Not Required'}</strong></div>
                    <div><span>Idempotency</span><strong>{selectedEngineeringPacket.idempotencyRequired ? 'Required' : 'Review'}</strong></div>
                    <div><span>Audit</span><strong>{selectedEngineeringPacket.auditBacked ? 'Recorded' : 'Pending'}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Handoff Summary</h3>
                    <p className={selectedEngineeringPacket.status === 'Blocked' ? 'warning-copy' : 'muted-copy'}>{selectedEngineeringPacket.handoffSummary}</p>
                    {selectedEngineeringPacket.reviewedAt && (
                      <p className="muted-copy">Reviewed {formatDateTime(selectedEngineeringPacket.reviewedAt)} by {selectedEngineeringPacket.reviewedByRole}.</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Implementation Steps</h3>
                    <ol className="launch-engineering-step-list">
                      {selectedEngineeringPacket.implementationSteps.map(step => <li key={step}>{step}</li>)}
                    </ol>
                  </div>

                  <div className="detail-section">
                    <h3>Test Checklist</h3>
                    <div className="launch-engineering-check-list">
                      {selectedEngineeringPacket.testChecklist.map(check => (
                        <article key={check.id} className={`launch-engineering-check-item tone-${getBackendEngineeringChecklistTone(check.status)}`}>
                          <div>
                            <strong>{check.label}</strong>
                            <StatusPill label={check.status} tone={getBackendEngineeringChecklistTone(check.status)} />
                          </div>
                          <p>{check.detail}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Launch Acceptance</h3>
                    <div className="launch-engineering-check-list">
                      {selectedEngineeringPacket.launchAcceptanceCriteria.map(check => (
                        <article key={check.id} className={`launch-engineering-check-item tone-${getBackendEngineeringChecklistTone(check.status)}`}>
                          <div>
                            <strong>{check.label}</strong>
                            <StatusPill label={check.status} tone={getBackendEngineeringChecklistTone(check.status)} />
                          </div>
                          <p>{check.detail}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Rollback And Audit</h3>
                    <div className="launch-engineering-plan-grid">
                      <div>
                        <span>Rollback</span>
                        <strong>{selectedEngineeringPacket.rollbackPlan}</strong>
                      </div>
                      <div>
                        <span>Audit</span>
                        <strong>{selectedEngineeringPacket.auditPlan}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Review Controls</h3>
                    <div className="launch-engineering-review-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={engineeringPacketStatus} onChange={event => setEngineeringPacketStatus(event.target.value as BackendEngineeringHandoffPacketStatus)}>
                          {backendEngineeringHandoffPacketStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Engineering Owner</span>
                        <select value={engineeringPacketOwner} onChange={event => setEngineeringPacketOwner(event.target.value)}>
                          {engineeringPacketOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={engineeringPacketNote}
                          onChange={event => setEngineeringPacketNote(event.target.value)}
                          placeholder="Record implementation intake notes, handoff blockers, test evidence, or owner acceptance context."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canManageEngineeringHandoff} onClick={() => recordEngineeringHandoffPacketReview(selectedEngineeringPacket)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Handoff Review
                      </button>
                      <button className="ghost-action" disabled={!canManageEngineeringHandoff} onClick={() => recordEngineeringHandoffPacketReview(selectedEngineeringPacket, 'Ready For Handoff')}>
                        <Wrench size={15} strokeWidth={1.8} />
                        Mark Ready
                      </button>
                      <button className="ghost-action" disabled={!canManageEngineeringHandoff} onClick={() => recordEngineeringHandoffPacketReview(selectedEngineeringPacket, 'Accepted')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Accept
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueEngineeringHandoffPacket(selectedEngineeringPacket)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Request
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportEngineeringHandoffPacket(selectedEngineeringPacket)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No engineering handoff packet selected.</div>
              )}
            </aside>
          </div>
        </>
      ) : viewMode === 'testMatrix' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Test Matrix" value={backendServerHandlerTestMatrix.status} delta={backendServerHandlerTestMatrix.summary} tone={getBackendServerHandlerTestTone(backendServerHandlerTestMatrix.status)} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Blocked / Missing" value={`${backendServerHandlerTestMatrix.blockedCount}/${backendServerHandlerTestMatrix.missingCount}`} delta="Cannot execute server tests" tone={backendServerHandlerTestMatrix.blockedCount || backendServerHandlerTestMatrix.missingCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Review / Ready" value={`${backendServerHandlerTestMatrix.reviewCount}/${backendServerHandlerTestMatrix.readyCount}`} delta="Test review pipeline" tone={backendServerHandlerTestMatrix.reviewCount ? 'warn' : backendServerHandlerTestMatrix.readyCount ? 'ok' : 'neutral'} icon={<ListChecks size={16} />} />
            <MetricCard label="Passed" value={String(backendServerHandlerTestMatrix.passedCount)} delta="Local test reviews" tone={backendServerHandlerTestMatrix.passedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Coverage" value={`${backendServerHandlerTestMatrix.averageCoverage}%`} delta={`${backendServerHandlerTestMatrix.readyCaseCount}/${backendServerHandlerTestMatrix.requiredCaseCount} required cases ready`} tone={backendServerHandlerTestMatrix.averageCoverage >= 90 ? 'ok' : backendServerHandlerTestMatrix.averageCoverage >= 70 ? 'warn' : 'danger'} icon={<Gauge size={16} />} />
            <MetricCard label="Critical Open" value={String(backendServerHandlerTestMatrix.criticalCount)} delta="High-risk handlers" tone={backendServerHandlerTestMatrix.criticalCount ? 'danger' : 'ok'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Test Records" value={String(serverHandlerTestRecords.length)} delta="Local audit-backed decisions" tone={serverHandlerTestRecords.length ? 'ok' : 'neutral'} icon={<ScrollText size={16} />} />
            <MetricCard label="Audit Backed" value={String(backendServerHandlerTestMatrix.auditBackedCount)} delta="Rows with evidence" tone={backendServerHandlerTestMatrix.auditBackedCount ? 'ok' : 'warn'} icon={<DatabaseZap size={16} />} />
          </div>

          <section className={`panel launch-server-test-panel tone-${getBackendServerHandlerTestTone(backendServerHandlerTestMatrix.status)}`}>
            <div>
              <p className="eyebrow">Server Handler Test Matrix</p>
              <h2>{backendServerHandlerTestMatrix.summary}</h2>
              <span>Generated {formatDateTime(backendServerHandlerTestMatrix.generatedAt)} from engineering handoff packets. Each row checks permission denial, actor scope, dry-run behavior, idempotency, audit shape, rollback reference, browser boundary, and launch acceptance.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendServerHandlerTestMatrix.status} tone={getBackendServerHandlerTestTone(backendServerHandlerTestMatrix.status)} />
              <strong>{backendServerHandlerTestMatrix.nextRow?.handlerLabel ?? 'No open test rows'}</strong>
              <button className="ghost-action" disabled={!canManageServerHandlerTests || !selectedServerTestRow} onClick={() => selectedServerTestRow && recordServerHandlerTestReview(selectedServerTestRow)}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Review
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Test Rule</p>
              <h2>Test matrix records readiness, not execution</h2>
              <span>{backendServerHandlerTestMatrixBoundaryRule}</span>
              <span>Queued test work still requires trusted server implementation, scoped permissions, dry-run proof, rollback proof, idempotency, and immutable audit records before any production-changing handler can run.</span>
            </div>
            <StatusPill label={canManageServerHandlerTests ? 'Test reviews enabled' : 'Read only'} tone={canManageServerHandlerTests ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Server Handler Test Matrix"
              rows={backendServerHandlerTestMatrix.rows}
              pageSize={9}
              emptyTitle="No server handler test rows are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getBackendServerHandlerTestTone(row.status)} />,
                },
                {
                  key: 'handler',
                  header: 'Handler',
                  sortable: true,
                  searchValue: row => `${row.handlerLabel} ${row.handlerKey} ${row.nextStep}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedServerTestRowId(row.id)}>
                      {row.handlerLabel}
                    </button>
                  ),
                },
                {
                  key: 'risk',
                  header: 'Risk',
                  sortable: true,
                  searchValue: row => row.risk,
                  render: row => <StatusPill label={row.risk} tone={getBackendServerHandlerTestRiskTone(row.risk)} />,
                },
                {
                  key: 'coverage',
                  header: 'Coverage',
                  sortable: true,
                  searchValue: row => String(row.coverageScore),
                  render: row => (
                    <div>
                      <strong>{row.coverageScore}%</strong>
                      <span className="cell-subtext">{row.readyCount + row.passedCount}/{row.requiredCount} ready</span>
                    </div>
                  ),
                },
                {
                  key: 'endpoint',
                  header: 'Endpoint',
                  sortable: true,
                  searchValue: row => `${row.method} ${row.endpoint}`,
                  render: row => <div><strong>{row.method}</strong><span className="cell-subtext">{row.endpoint}</span></div>,
                },
                {
                  key: 'permission',
                  header: 'Permission',
                  sortable: true,
                  searchValue: row => row.permission,
                  render: row => row.permission,
                },
                {
                  key: 'cases',
                  header: 'Cases',
                  sortable: true,
                  searchValue: row => row.testCases.map(test => `${test.label} ${test.status}`).join(' '),
                  render: row => (
                    <div>
                      <strong>{row.blockedCount} blocked / {row.missingCount} missing</strong>
                      <span className="cell-subtext">{row.reviewCount} review / {row.readyCount + row.passedCount} ready</span>
                    </div>
                  ),
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedServerTestRow ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Test Matrix Row</p>
                      <h2>{selectedServerTestRow.handlerLabel}</h2>
                    </div>
                    <StatusPill label={selectedServerTestRow.status} tone={getBackendServerHandlerTestTone(selectedServerTestRow.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Coverage</span><strong>{selectedServerTestRow.coverageScore}%</strong></div>
                    <div><span>Engineering Owner</span><strong>{selectedServerTestRow.engineeringOwner}</strong></div>
                    <div><span>Product Owner</span><strong>{selectedServerTestRow.productOwner}</strong></div>
                    <div><span>Handler</span><strong>{selectedServerTestRow.handlerKey}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedServerTestRow.method} {selectedServerTestRow.endpoint}</strong></div>
                    <div><span>Permission</span><strong>{selectedServerTestRow.permission}</strong></div>
                    <div><span>Mode</span><strong>{selectedServerTestRow.mutationMode}</strong></div>
                    <div><span>Dry Run</span><strong>{selectedServerTestRow.dryRunRequired ? 'Required' : 'Optional'}</strong></div>
                    <div><span>Idempotency</span><strong>{selectedServerTestRow.idempotencyRequired ? 'Required' : 'Review'}</strong></div>
                    <div><span>Audit</span><strong>{selectedServerTestRow.auditBacked ? 'Recorded' : 'Pending'}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Next Step</h3>
                    <p className={selectedServerTestRow.status === 'Blocked' || selectedServerTestRow.status === 'Missing' ? 'warning-copy' : 'muted-copy'}>{selectedServerTestRow.nextStep}</p>
                    {selectedServerTestRow.reviewedAt && (
                      <p className="muted-copy">Reviewed {formatDateTime(selectedServerTestRow.reviewedAt)} by {selectedServerTestRow.reviewedByRole}.</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Required Test Cases</h3>
                    <div className="launch-server-test-case-list">
                      {selectedServerTestRow.testCases.map(test => (
                        <article key={test.id} className={`launch-server-test-case-item tone-${getBackendServerHandlerTestTone(test.status)}`}>
                          <div>
                            <div>
                              <strong>{test.label}</strong>
                              <span>{test.type} / {test.required ? 'Required' : 'Optional'}</span>
                            </div>
                            <StatusPill label={test.status} tone={getBackendServerHandlerTestTone(test.status)} />
                          </div>
                          <p>{test.scenario}</p>
                          <small>{test.expectedEvidence}</small>
                          <small>{test.automationHint}</small>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Rollback And Audit</h3>
                    <div className="launch-server-test-evidence-grid">
                      <div>
                        <span>Rollback</span>
                        <strong>{selectedServerTestRow.rollbackPlan}</strong>
                      </div>
                      <div>
                        <span>Audit</span>
                        <strong>{selectedServerTestRow.auditPlan}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Review Controls</h3>
                    <div className="launch-server-test-review-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={serverTestStatus} onChange={event => setServerTestStatus(event.target.value as BackendServerHandlerTestMatrixStatus)}>
                          {backendServerHandlerTestMatrixStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={serverTestOwner} onChange={event => setServerTestOwner(event.target.value)}>
                          {serverTestOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={serverTestNote}
                          onChange={event => setServerTestNote(event.target.value)}
                          placeholder="Record test evidence, missing coverage, server execution notes, or policy review context."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canManageServerHandlerTests} onClick={() => recordServerHandlerTestReview(selectedServerTestRow)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Test Review
                      </button>
                      <button className="ghost-action" disabled={!canManageServerHandlerTests} onClick={() => recordServerHandlerTestReview(selectedServerTestRow, 'Ready')}>
                        <Wrench size={15} strokeWidth={1.8} />
                        Mark Ready
                      </button>
                      <button className="ghost-action" disabled={!canManageServerHandlerTests} onClick={() => recordServerHandlerTestReview(selectedServerTestRow, 'Passed')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Pass
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueServerHandlerTestRequest(selectedServerTestRow)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Tests
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportServerHandlerTestMatrix(selectedServerTestRow)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No server handler test row selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Permission Test Coverage"
            rows={backendServerHandlerTestMatrix.permissionGroups}
            pageSize={6}
            emptyTitle="No permission test coverage is available."
            columns={[
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getBackendServerHandlerTestTone(row.status)} />,
              },
              {
                key: 'permission',
                header: 'Permission',
                sortable: true,
                searchValue: row => row.label,
                render: row => <div><strong>{row.label}</strong><span className="cell-subtext">{row.total} handlers</span></div>,
              },
              {
                key: 'coverage',
                header: 'Coverage',
                sortable: true,
                searchValue: row => String(row.averageCoverage),
                render: row => `${row.averageCoverage}%`,
              },
              {
                key: 'open',
                header: 'Open',
                sortable: true,
                searchValue: row => `${row.blocked} ${row.missing} ${row.review}`,
                render: row => `${row.blocked} blocked / ${row.missing} missing / ${row.review} review`,
              },
              {
                key: 'ready',
                header: 'Ready / Passed',
                sortable: true,
                searchValue: row => `${row.ready} ${row.passed}`,
                render: row => `${row.ready}/${row.passed}`,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Endpoint Test Inventory"
            rows={backendServerHandlerTestMatrix.endpointGroups}
            pageSize={6}
            emptyTitle="No endpoint test inventory is available."
            columns={[
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getBackendServerHandlerTestTone(row.status)} />,
              },
              {
                key: 'endpoint',
                header: 'Endpoint',
                sortable: true,
                searchValue: row => row.label,
                render: row => <div><strong>{row.label}</strong><span className="cell-subtext">{row.total} handlers</span></div>,
              },
              {
                key: 'coverage',
                header: 'Coverage',
                sortable: true,
                searchValue: row => String(row.averageCoverage),
                render: row => `${row.averageCoverage}%`,
              },
              {
                key: 'open',
                header: 'Open',
                sortable: true,
                searchValue: row => `${row.blocked} ${row.missing} ${row.review}`,
                render: row => `${row.blocked} blocked / ${row.missing} missing / ${row.review} review`,
              },
              {
                key: 'ready',
                header: 'Ready / Passed',
                sortable: true,
                searchValue: row => `${row.ready} ${row.passed}`,
                render: row => `${row.ready}/${row.passed}`,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'testEvidence' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Evidence Packs" value={backendServerTestEvidencePackRegister.status} delta={backendServerTestEvidencePackRegister.summary} tone={getBackendServerTestEvidencePackTone(backendServerTestEvidencePackRegister.status)} icon={<ScrollText size={16} />} />
            <MetricCard label="Blocked / Missing" value={`${backendServerTestEvidencePackRegister.blockedCount}/${backendServerTestEvidencePackRegister.missingCount}`} delta="Cannot execute runbook" tone={backendServerTestEvidencePackRegister.blockedCount || backendServerTestEvidencePackRegister.missingCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Review / Ready" value={`${backendServerTestEvidencePackRegister.reviewCount}/${backendServerTestEvidencePackRegister.readyCount}`} delta="Evidence review path" tone={backendServerTestEvidencePackRegister.reviewCount ? 'warn' : backendServerTestEvidencePackRegister.readyCount ? 'ok' : 'neutral'} icon={<ListChecks size={16} />} />
            <MetricCard label="Verified" value={String(backendServerTestEvidencePackRegister.verifiedCount)} delta="Evidence packs closed" tone={backendServerTestEvidencePackRegister.verifiedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Evidence" value={`${backendServerTestEvidencePackRegister.verifiedEvidenceCount}/${backendServerTestEvidencePackRegister.requiredEvidenceCount}`} delta="Required evidence verified" tone={backendServerTestEvidencePackRegister.requiredEvidenceCount === backendServerTestEvidencePackRegister.verifiedEvidenceCount ? 'ok' : backendServerTestEvidencePackRegister.verifiedEvidenceCount ? 'warn' : 'danger'} icon={<DatabaseZap size={16} />} />
            <MetricCard label="Critical Open" value={String(backendServerTestEvidencePackRegister.criticalCount)} delta="High-risk evidence packs" tone={backendServerTestEvidencePackRegister.criticalCount ? 'danger' : 'ok'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Evidence Records" value={String(serverTestEvidencePackRecords.length)} delta="Local audit-backed reviews" tone={serverTestEvidencePackRecords.length ? 'ok' : 'neutral'} icon={<ScrollText size={16} />} />
            <MetricCard label="Audit Backed" value={String(backendServerTestEvidencePackRegister.auditBackedCount)} delta="Packs with evidence records" tone={backendServerTestEvidencePackRegister.auditBackedCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
          </div>

          <section className={`panel launch-server-evidence-panel tone-${getBackendServerTestEvidencePackTone(backendServerTestEvidencePackRegister.status)}`}>
            <div>
              <p className="eyebrow">Server Test Evidence Packs</p>
              <h2>{backendServerTestEvidencePackRegister.summary}</h2>
              <span>Generated {formatDateTime(backendServerTestEvidencePackRegister.generatedAt)} from the server handler test matrix. Each pack contains preconditions, runbook steps, required evidence, failure modes, exit criteria, rollback, and audit requirements.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendServerTestEvidencePackRegister.status} tone={getBackendServerTestEvidencePackTone(backendServerTestEvidencePackRegister.status)} />
              <strong>{backendServerTestEvidencePackRegister.nextPack?.handlerLabel ?? 'No open evidence packs'}</strong>
              <button className="ghost-action" disabled={!canManageServerTestEvidence || !selectedServerEvidencePack} onClick={() => selectedServerEvidencePack && recordServerTestEvidenceReview(selectedServerEvidencePack)}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Review
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Evidence Rule</p>
              <h2>Evidence packs are runbooks, not execution</h2>
              <span>{backendServerTestEvidencePackBoundaryRule}</span>
              <span>Platform Admin can record reviews, queue a server-side request, and export packets. Trusted code, scoped permissions, dry-run proof, rollback proof, and immutable audit logs are still required before production-changing handlers run.</span>
            </div>
            <StatusPill label={canManageServerTestEvidence ? 'Evidence reviews enabled' : 'Read only'} tone={canManageServerTestEvidence ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Server Test Evidence Packs"
              rows={backendServerTestEvidencePackRegister.packs}
              pageSize={9}
              emptyTitle="No server test evidence packs are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getBackendServerTestEvidencePackTone(row.status)} />,
                },
                {
                  key: 'pack',
                  header: 'Evidence Pack',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.handlerLabel} ${row.handlerKey} ${row.objective}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedServerEvidencePackId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'risk',
                  header: 'Risk',
                  sortable: true,
                  searchValue: row => row.risk,
                  render: row => <StatusPill label={row.risk} tone={getBackendServerTestEvidenceRiskTone(row.risk)} />,
                },
                {
                  key: 'evidence',
                  header: 'Evidence',
                  sortable: true,
                  searchValue: row => `${row.verifiedEvidenceCount} ${row.requiredEvidenceCount} ${row.missingEvidenceCount}`,
                  render: row => (
                    <div>
                      <strong>{row.verifiedEvidenceCount}/{row.requiredEvidenceCount} verified</strong>
                      <span className="cell-subtext">{row.missingEvidenceCount} missing / {row.reviewEvidenceCount} review</span>
                    </div>
                  ),
                },
                {
                  key: 'endpoint',
                  header: 'Endpoint',
                  sortable: true,
                  searchValue: row => `${row.method} ${row.endpoint}`,
                  render: row => <div><strong>{row.method}</strong><span className="cell-subtext">{row.endpoint}</span></div>,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => `${row.engineeringOwner} ${row.productOwner}`,
                  render: row => <div><strong>{row.engineeringOwner}</strong><span className="cell-subtext">Product: {row.productOwner}</span></div>,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className="muted-copy">{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedServerEvidencePack ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Evidence Pack</p>
                      <h2>{selectedServerEvidencePack.title}</h2>
                    </div>
                    <StatusPill label={selectedServerEvidencePack.status} tone={getBackendServerTestEvidencePackTone(selectedServerEvidencePack.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Evidence</span><strong>{selectedServerEvidencePack.verifiedEvidenceCount}/{selectedServerEvidencePack.requiredEvidenceCount} verified</strong></div>
                    <div><span>Coverage</span><strong>{selectedServerEvidencePack.coverageScore}%</strong></div>
                    <div><span>Engineering Owner</span><strong>{selectedServerEvidencePack.engineeringOwner}</strong></div>
                    <div><span>Product Owner</span><strong>{selectedServerEvidencePack.productOwner}</strong></div>
                    <div><span>Handler</span><strong>{selectedServerEvidencePack.handlerKey}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedServerEvidencePack.method} {selectedServerEvidencePack.endpoint}</strong></div>
                    <div><span>Permission</span><strong>{selectedServerEvidencePack.permission}</strong></div>
                    <div><span>Mode</span><strong>{selectedServerEvidencePack.mutationMode}</strong></div>
                    <div><span>Evidence Location</span><strong>{selectedServerEvidencePack.evidenceLocation ?? 'Pending'}</strong></div>
                    <div><span>Audit</span><strong>{selectedServerEvidencePack.auditBacked ? 'Recorded' : 'Pending'}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Objective</h3>
                    <p className={selectedServerEvidencePack.status === 'Blocked' || selectedServerEvidencePack.status === 'Missing Evidence' ? 'warning-copy' : 'muted-copy'}>{selectedServerEvidencePack.objective}</p>
                    <p className="muted-copy">{selectedServerEvidencePack.nextStep}</p>
                    {selectedServerEvidencePack.reviewedAt && (
                      <p className="muted-copy">Reviewed {formatDateTime(selectedServerEvidencePack.reviewedAt)} by {selectedServerEvidencePack.reviewedByRole}.</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Preconditions</h3>
                    <ul className="launch-server-evidence-list">
                      {selectedServerEvidencePack.preconditions.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <h3>Runbook Steps</h3>
                    <div className="launch-server-evidence-runbook-list">
                      {selectedServerEvidencePack.runbookSteps.map(step => (
                        <article key={step.id} className={`launch-server-evidence-runbook-item tone-${getBackendServerTestEvidenceItemTone(step.status)}`}>
                          <div>
                            <div>
                              <strong>{step.label}</strong>
                              <span>{step.owner}</span>
                            </div>
                            <StatusPill label={step.status} tone={getBackendServerTestEvidenceItemTone(step.status)} />
                          </div>
                          <p>{step.detail}</p>
                          <small>{step.expectedOutcome}</small>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Evidence Checklist</h3>
                    <div className="launch-server-evidence-item-list">
                      {selectedServerEvidencePack.evidenceItems.map(item => (
                        <article key={item.id} className={`launch-server-evidence-item tone-${getBackendServerTestEvidenceItemTone(item.status)}`}>
                          <div>
                            <div>
                              <strong>{item.label}</strong>
                              <span>{item.type} / {item.required ? 'Required' : 'Optional'}</span>
                            </div>
                            <StatusPill label={item.status} tone={getBackendServerTestEvidenceItemTone(item.status)} />
                          </div>
                          <p>{item.expectedProof}</p>
                          <small>{item.captureMethod}</small>
                          <small>{item.storageTarget}</small>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Failure Modes</h3>
                    <ul className="launch-server-evidence-list">
                      {selectedServerEvidencePack.failureModes.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <h3>Exit Criteria</h3>
                    <ul className="launch-server-evidence-list">
                      {selectedServerEvidencePack.exitCriteria.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </div>

                  <div className="detail-section">
                    <h3>Rollback And Audit</h3>
                    <div className="launch-server-evidence-plan-grid">
                      <div>
                        <span>Rollback</span>
                        <strong>{selectedServerEvidencePack.rollbackPlan}</strong>
                      </div>
                      <div>
                        <span>Audit</span>
                        <strong>{selectedServerEvidencePack.auditPlan}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Review Controls</h3>
                    <div className="launch-server-evidence-review-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={serverEvidenceStatus} onChange={event => setServerEvidenceStatus(event.target.value as BackendServerTestEvidencePackStatus)}>
                          {backendServerTestEvidencePackStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={serverEvidenceOwner} onChange={event => setServerEvidenceOwner(event.target.value)}>
                          {serverEvidenceOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Evidence Location</span>
                        <input
                          value={serverEvidenceLocation}
                          onChange={event => setServerEvidenceLocation(event.target.value)}
                          placeholder="Where the server test evidence is stored."
                        />
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={serverEvidenceNote}
                          onChange={event => setServerEvidenceNote(event.target.value)}
                          placeholder="Record evidence gaps, test artifact links, runbook notes, or acceptance context."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canManageServerTestEvidence} onClick={() => recordServerTestEvidenceReview(selectedServerEvidencePack)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Evidence Review
                      </button>
                      <button className="ghost-action" disabled={!canManageServerTestEvidence} onClick={() => recordServerTestEvidenceReview(selectedServerEvidencePack, 'Ready For Execution')}>
                        <Wrench size={15} strokeWidth={1.8} />
                        Mark Ready
                      </button>
                      <button className="ghost-action" disabled={!canManageServerTestEvidence} onClick={() => recordServerTestEvidenceReview(selectedServerEvidencePack, 'Verified')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Verify
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueServerTestEvidencePack(selectedServerEvidencePack)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Runbook
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportServerTestEvidencePack(selectedServerEvidencePack)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No server test evidence pack selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Evidence Owner Load"
            rows={backendServerTestEvidencePackRegister.ownerGroups}
            pageSize={6}
            emptyTitle="No evidence owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} packs / {row.criticalCount} critical</span></div>,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'missing',
                header: 'Missing',
                sortable: true,
                searchValue: row => String(row.missing),
                render: row => row.missing,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'ready',
                header: 'Ready / Verified',
                sortable: true,
                searchValue: row => `${row.ready} ${row.verified}`,
                render: row => `${row.ready}/${row.verified}`,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Evidence Type Coverage"
            rows={backendServerTestEvidencePackRegister.evidenceTypeGroups}
            pageSize={8}
            emptyTitle="No evidence type coverage is available."
            columns={[
              {
                key: 'type',
                header: 'Type',
                sortable: true,
                searchValue: row => row.type,
                render: row => <div><strong>{row.type}</strong><span className="cell-subtext">{row.requiredCount} required / {row.total} total</span></div>,
              },
              {
                key: 'missing',
                header: 'Missing',
                sortable: true,
                searchValue: row => String(row.missing),
                render: row => row.missing,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'ready',
                header: 'Ready',
                sortable: true,
                searchValue: row => String(row.ready),
                render: row => row.ready,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'executionReady' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Execution Readiness" value={backendExecutionReadinessDashboard.status} delta={backendExecutionReadinessDashboard.summary} tone={getBackendExecutionReadinessTone(backendExecutionReadinessDashboard.status)} icon={<DatabaseZap size={16} />} />
            <MetricCard label="Blocked" value={String(backendExecutionReadinessDashboard.blockedCount)} delta="Cannot hand off" tone={backendExecutionReadinessDashboard.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Review Only" value={String(backendExecutionReadinessDashboard.reviewOnlyCount)} delta="Needs endpoint or proof" tone={backendExecutionReadinessDashboard.reviewOnlyCount ? 'warn' : 'ok'} icon={<ScrollText size={16} />} />
            <MetricCard label="Ready / Queued" value={`${backendExecutionReadinessDashboard.readyForServerCount}/${backendExecutionReadinessDashboard.queuedCount}`} delta="Trusted server handoff" tone={backendExecutionReadinessDashboard.readyForServerCount || backendExecutionReadinessDashboard.queuedCount ? 'ok' : 'neutral'} icon={<Send size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Verified" value={String(backendExecutionReadinessDashboard.verifiedCount)} delta="Execution readiness closed" tone={backendExecutionReadinessDashboard.verifiedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Endpoint Configured" value={`${backendExecutionReadinessDashboard.endpointConfiguredCount}/${backendExecutionReadinessDashboard.totalCount}`} delta={executionConfig.endpoint || 'Review-only contract mode'} tone={backendExecutionReadinessDashboard.endpointConfiguredCount === backendExecutionReadinessDashboard.totalCount && backendExecutionReadinessDashboard.totalCount ? 'ok' : 'warn'} icon={<DatabaseZap size={16} />} />
            <MetricCard label="Dry-Run Proof" value={`${backendExecutionReadinessDashboard.dryRunProofCount}/${backendExecutionReadinessDashboard.totalCount}`} delta={`${backendExecutionReadinessDashboard.mockExecutionCount} dry-run records`} tone={backendExecutionReadinessDashboard.dryRunProofCount === backendExecutionReadinessDashboard.totalCount && backendExecutionReadinessDashboard.totalCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Audit Backed" value={`${backendExecutionReadinessDashboard.auditBackedCount}/${backendExecutionReadinessDashboard.totalCount}`} delta={`${backendExecutionReadinessDashboard.queuedRequestCount} queued requests`} tone={backendExecutionReadinessDashboard.auditBackedCount ? 'ok' : 'warn'} icon={<ClipboardCheck size={16} />} />
          </div>

          <section className={`panel launch-execution-ready-panel tone-${getBackendExecutionReadinessTone(backendExecutionReadinessDashboard.status)}`}>
            <div>
              <p className="eyebrow">Backend Execution Readiness</p>
              <h2>{backendExecutionReadinessDashboard.summary}</h2>
              <span>Generated {formatDateTime(backendExecutionReadinessDashboard.generatedAt)} from server test evidence, Admin Action Requests, dry-run records, audit events, and the trusted endpoint configuration. This is the bridge from evidence pack to server handoff.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendExecutionReadinessDashboard.status} tone={getBackendExecutionReadinessTone(backendExecutionReadinessDashboard.status)} />
              <strong>{backendExecutionReadinessDashboard.nextRow?.handlerLabel ?? 'No open execution readiness work'}</strong>
              <button className="ghost-action" disabled={!canManageExecutionReadiness || !selectedExecutionReadinessRow} onClick={() => selectedExecutionReadinessRow && recordBackendExecutionReadinessReview(selectedExecutionReadinessRow)}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Review
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Execution Rule</p>
              <h2>Execution readiness is not execution</h2>
              <span>{backendExecutionReadinessBoundaryRule}</span>
              <span>Platform Admin can verify handoff posture, queue a server-side request, and export evidence. Actual production-changing execution must remain inside a trusted server endpoint with permission checks, human confirmation where required, rollback metadata, and immutable audit logs.</span>
            </div>
            <StatusPill label={canManageExecutionReadiness ? 'Readiness reviews enabled' : 'Read only'} tone={canManageExecutionReadiness ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Backend Execution Readiness"
              rows={backendExecutionReadinessDashboard.rows}
              pageSize={9}
              emptyTitle="No backend execution readiness rows are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getBackendExecutionReadinessTone(row.status)} />,
                },
                {
                  key: 'handler',
                  header: 'Handler',
                  sortable: true,
                  searchValue: row => `${row.handlerLabel} ${row.handlerKey} ${row.nextStep}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedExecutionReadinessRowId(row.id)}>
                      {row.handlerLabel}
                    </button>
                  ),
                },
                {
                  key: 'risk',
                  header: 'Risk',
                  sortable: true,
                  searchValue: row => row.risk,
                  render: row => <StatusPill label={row.risk} tone={getBackendExecutionReadinessRiskTone(row.risk)} />,
                },
                {
                  key: 'proof',
                  header: 'Proof',
                  sortable: true,
                  searchValue: row => `${row.blockerCount} ${row.reviewCount} ${row.readyCount} ${row.verifiedCount}`,
                  render: row => (
                    <div>
                      <strong>{row.readyCount + row.verifiedCount}/{row.checks.length} ready</strong>
                      <span className="cell-subtext">{row.blockerCount} blocked / {row.reviewCount} review</span>
                    </div>
                  ),
                },
                {
                  key: 'queue',
                  header: 'Queue',
                  sortable: true,
                  searchValue: row => `${row.queuedRequestCount} ${row.activeRequestCount} ${row.completedRequestCount}`,
                  render: row => (
                    <div>
                      <strong>{row.queuedRequestCount} queued</strong>
                      <span className="cell-subtext">{row.activeRequestCount} active / {row.completedRequestCount} complete</span>
                    </div>
                  ),
                },
                {
                  key: 'dryRun',
                  header: 'Dry Run',
                  sortable: true,
                  searchValue: row => `${row.mockExecutionCount} ${row.passedDryRunCount}`,
                  render: row => <div><strong>{row.passedDryRunCount}/{row.mockExecutionCount}</strong><span className="cell-subtext">{row.dryRunRequired ? 'Required' : 'Optional'}</span></div>,
                },
                {
                  key: 'endpoint',
                  header: 'Endpoint',
                  sortable: true,
                  searchValue: row => `${row.method} ${row.endpoint} ${row.endpointConfigured}`,
                  render: row => <div><strong>{row.method}</strong><span className="cell-subtext">{row.endpointConfigured ? row.endpoint : 'Review-only contract'}</span></div>,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className="muted-copy">{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedExecutionReadinessRow ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Execution Readiness</p>
                      <h2>{selectedExecutionReadinessRow.handlerLabel}</h2>
                    </div>
                    <StatusPill label={selectedExecutionReadinessRow.status} tone={getBackendExecutionReadinessTone(selectedExecutionReadinessRow.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Evidence</span><strong>{selectedExecutionReadinessRow.evidenceStatus}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedExecutionReadinessRow.endpointConfigured ? 'Configured' : 'Review Only'}</strong></div>
                    <div><span>Queue</span><strong>{selectedExecutionReadinessRow.queuedRequestCount} queued</strong></div>
                    <div><span>Dry Run</span><strong>{selectedExecutionReadinessRow.passedDryRunCount}/{selectedExecutionReadinessRow.mockExecutionCount} passed</strong></div>
                    <div><span>Audit Events</span><strong>{selectedExecutionReadinessRow.auditEventCount}</strong></div>
                    <div><span>Owner</span><strong>{selectedExecutionReadinessRow.engineeringOwner}</strong></div>
                    <div><span>Handler</span><strong>{selectedExecutionReadinessRow.handlerKey}</strong></div>
                    <div><span>Permission</span><strong>{selectedExecutionReadinessRow.permission}</strong></div>
                    <div><span>Mode</span><strong>{selectedExecutionReadinessRow.mutationMode}</strong></div>
                    <div><span>Posture</span><strong>{selectedExecutionReadinessRow.executionPosture}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Next Step</h3>
                    <p className={selectedExecutionReadinessRow.status === 'Blocked' || selectedExecutionReadinessRow.status === 'Review Only' ? 'warning-copy' : 'muted-copy'}>{selectedExecutionReadinessRow.nextStep}</p>
                    {selectedExecutionReadinessRow.reviewedAt && (
                      <p className="muted-copy">Reviewed {formatDateTime(selectedExecutionReadinessRow.reviewedAt)} by {selectedExecutionReadinessRow.reviewedByRole}.</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Execution Checks</h3>
                    <div className="launch-execution-check-list">
                      {selectedExecutionReadinessRow.checks.map(check => (
                        <article key={check.id} className={`launch-execution-check-item tone-${getBackendExecutionReadinessCheckTone(check.status)}`}>
                          <div>
                            <strong>{check.label}</strong>
                            <StatusPill label={check.status} tone={getBackendExecutionReadinessCheckTone(check.status)} />
                          </div>
                          <p>{check.detail}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Queue And Proof</h3>
                    <div className="launch-execution-evidence-grid">
                      <div>
                        <span>Admin Action Requests</span>
                        <strong>{selectedExecutionReadinessRow.queuedRequestCount} queued / {selectedExecutionReadinessRow.activeRequestCount} active / {selectedExecutionReadinessRow.completedRequestCount} complete</strong>
                      </div>
                      <div>
                        <span>Dry-Run Proof</span>
                        <strong>{selectedExecutionReadinessRow.passedDryRunCount} passing of {selectedExecutionReadinessRow.mockExecutionCount} recorded</strong>
                      </div>
                      <div>
                        <span>Evidence Location</span>
                        <strong>{selectedExecutionReadinessRow.evidenceLocation ?? 'Pending'}</strong>
                      </div>
                      <div>
                        <span>Endpoint Posture</span>
                        <strong>{selectedExecutionReadinessRow.endpointConfigured ? executionConfig.endpoint : 'No trusted endpoint configured'}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Rollback And Audit</h3>
                    <div className="launch-execution-plan-grid">
                      <div>
                        <span>Rollback</span>
                        <strong>{selectedExecutionReadinessRow.rollbackPlan}</strong>
                      </div>
                      <div>
                        <span>Audit</span>
                        <strong>{selectedExecutionReadinessRow.auditPlan}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Review Controls</h3>
                    <div className="launch-execution-review-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={executionReadinessStatus} onChange={event => setExecutionReadinessStatus(event.target.value as BackendExecutionReadinessStatus)}>
                          {backendExecutionReadinessStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={executionReadinessOwner} onChange={event => setExecutionReadinessOwner(event.target.value)}>
                          {executionReadinessOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={executionReadinessNote}
                          onChange={event => setExecutionReadinessNote(event.target.value)}
                          placeholder="Record endpoint posture, dry-run proof, approval context, rollback notes, or server handoff risk."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canManageExecutionReadiness} onClick={() => recordBackendExecutionReadinessReview(selectedExecutionReadinessRow)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Readiness Review
                      </button>
                      <button className="ghost-action" disabled={!canManageExecutionReadiness} onClick={() => recordBackendExecutionReadinessReview(selectedExecutionReadinessRow, 'Ready For Server')}>
                        <Wrench size={15} strokeWidth={1.8} />
                        Mark Ready
                      </button>
                      <button className="ghost-action" disabled={!canManageExecutionReadiness} onClick={() => recordBackendExecutionReadinessReview(selectedExecutionReadinessRow, 'Verified')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Verify
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueBackendExecutionReadinessRequest(selectedExecutionReadinessRow)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Request
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportBackendExecutionReadiness(selectedExecutionReadinessRow)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No backend execution readiness row selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Owner Execution Load"
            rows={backendExecutionReadinessDashboard.ownerGroups}
            pageSize={6}
            emptyTitle="No owner execution load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} handlers / {row.criticalCount} critical</span></div>,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'review',
                header: 'Review Only',
                sortable: true,
                searchValue: row => String(row.reviewOnly),
                render: row => row.reviewOnly,
              },
              {
                key: 'ready',
                header: 'Ready / Queued',
                sortable: true,
                searchValue: row => `${row.readyForServer} ${row.queued}`,
                render: row => `${row.readyForServer}/${row.queued}`,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Handler Execution Inventory"
            rows={backendExecutionReadinessDashboard.handlerGroups}
            pageSize={8}
            emptyTitle="No handler execution inventory is available."
            columns={[
              {
                key: 'handler',
                header: 'Handler',
                sortable: true,
                searchValue: row => `${row.handlerLabel} ${row.handlerKey}`,
                render: row => <div><strong>{row.handlerLabel}</strong><span className="cell-subtext">{row.handlerKey}</span></div>,
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getBackendExecutionReadinessTone(row.status)} />,
              },
              {
                key: 'risk',
                header: 'Risk',
                sortable: true,
                searchValue: row => row.risk,
                render: row => <StatusPill label={row.risk} tone={getBackendExecutionReadinessRiskTone(row.risk)} />,
              },
              {
                key: 'endpoint',
                header: 'Endpoint',
                sortable: true,
                searchValue: row => `${row.method} ${row.endpoint}`,
                render: row => <div><strong>{row.method}</strong><span className="cell-subtext">{row.endpoint}</span></div>,
              },
              {
                key: 'proof',
                header: 'Proof',
                sortable: true,
                searchValue: row => `${row.queuedRequestCount} ${row.mockExecutionCount} ${row.auditEventCount}`,
                render: row => `${row.queuedRequestCount} queue / ${row.mockExecutionCount} dry-run / ${row.auditEventCount} audit`,
              },
              {
                key: 'open',
                header: 'Open',
                sortable: true,
                searchValue: row => `${row.blockerCount} ${row.reviewCount}`,
                render: row => `${row.blockerCount} blocked / ${row.reviewCount} review`,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'deployChecklist' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Deploy Checklist" value={trustedHandlerDeploymentChecklist.status} delta={trustedHandlerDeploymentChecklist.summary} tone={getTrustedHandlerDeploymentTone(trustedHandlerDeploymentChecklist.status)} icon={<ClipboardCheck size={16} />} />
            <MetricCard label="Blocked" value={String(trustedHandlerDeploymentChecklist.blockedCount)} delta="Cannot build safely" tone={trustedHandlerDeploymentChecklist.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Needs Build Plan" value={String(trustedHandlerDeploymentChecklist.needsBuildPlanCount)} delta="Server route gaps" tone={trustedHandlerDeploymentChecklist.needsBuildPlanCount ? 'warn' : 'ok'} icon={<FileText size={16} />} />
            <MetricCard label="Ready / Queued" value={`${trustedHandlerDeploymentChecklist.readyForBuildCount}/${trustedHandlerDeploymentChecklist.buildQueuedCount}`} delta="Server implementation path" tone={trustedHandlerDeploymentChecklist.readyForBuildCount || trustedHandlerDeploymentChecklist.buildQueuedCount ? 'ok' : 'neutral'} icon={<Wrench size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Release Candidates" value={String(trustedHandlerDeploymentChecklist.releaseCandidateCount)} delta="Awaiting final proof" tone={trustedHandlerDeploymentChecklist.releaseCandidateCount ? 'ok' : 'neutral'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Verified" value={String(trustedHandlerDeploymentChecklist.verifiedCount)} delta="Deployment checklist closed" tone={trustedHandlerDeploymentChecklist.verifiedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Checks Ready" value={`${trustedHandlerDeploymentChecklist.readyOrVerifiedCheckCount}/${trustedHandlerDeploymentChecklist.requiredCheckCount}`} delta="Required build controls" tone={trustedHandlerDeploymentChecklist.readyOrVerifiedCheckCount === trustedHandlerDeploymentChecklist.requiredCheckCount && trustedHandlerDeploymentChecklist.requiredCheckCount ? 'ok' : 'warn'} icon={<ListChecks size={16} />} />
            <MetricCard label="Audit Backed" value={`${trustedHandlerDeploymentChecklist.auditBackedCount}/${trustedHandlerDeploymentChecklist.totalCount}`} delta={`${trustedHandlerDeploymentRecords.length} local reviews`} tone={trustedHandlerDeploymentChecklist.auditBackedCount ? 'ok' : 'warn'} icon={<ScrollText size={16} />} />
          </div>

          <section className={`panel launch-trusted-deploy-panel tone-${getTrustedHandlerDeploymentTone(trustedHandlerDeploymentChecklist.status)}`}>
            <div>
              <p className="eyebrow">Trusted Handler Deployment Checklist</p>
              <h2>{trustedHandlerDeploymentChecklist.summary}</h2>
              <span>Generated {formatDateTime(trustedHandlerDeploymentChecklist.generatedAt)} from backend execution readiness, Admin Action Requests, endpoint posture, dry-run proof, audit events, rollback plans, and release controls.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={trustedHandlerDeploymentChecklist.status} tone={getTrustedHandlerDeploymentTone(trustedHandlerDeploymentChecklist.status)} />
              <strong>{trustedHandlerDeploymentChecklist.nextItem?.handlerLabel ?? 'No open trusted handler build work'}</strong>
              <button className="ghost-action" disabled={!canManageTrustedDeployment || !selectedTrustedDeploymentItem} onClick={() => selectedTrustedDeploymentItem && recordTrustedHandlerDeploymentReview(selectedTrustedDeploymentItem)}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Review
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Deployment Rule</p>
              <h2>Deployment checklist is not deployment</h2>
              <span>{trustedHandlerDeploymentBoundaryRule}</span>
              <span>Platform Admin can record build readiness, queue engineering work, and export the checklist. Actual code deployment and production mutation enablement remain outside the browser and require trusted server implementation, release approval, rollback proof, and immutable audit logging.</span>
            </div>
            <StatusPill label={canManageTrustedDeployment ? 'Deployment reviews enabled' : 'Read only'} tone={canManageTrustedDeployment ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Trusted Handler Deployment Checklist"
              rows={trustedHandlerDeploymentChecklist.items}
              pageSize={9}
              emptyTitle="No trusted handler deployment checklist items are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getTrustedHandlerDeploymentTone(row.status)} />,
                },
                {
                  key: 'handler',
                  header: 'Handler',
                  sortable: true,
                  searchValue: row => `${row.handlerLabel} ${row.handlerKey} ${row.nextStep}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedTrustedDeploymentItemId(row.id)}>
                      {row.handlerLabel}
                    </button>
                  ),
                },
                {
                  key: 'risk',
                  header: 'Risk',
                  sortable: true,
                  searchValue: row => row.risk,
                  render: row => <StatusPill label={row.risk} tone={getTrustedHandlerDeploymentRiskTone(row.risk)} />,
                },
                {
                  key: 'checks',
                  header: 'Checks',
                  sortable: true,
                  searchValue: row => `${row.blockerCount} ${row.reviewCount} ${row.readyCount} ${row.verifiedCount}`,
                  render: row => (
                    <div>
                      <strong>{row.readyCount + row.verifiedCount}/{row.requiredCheckCount} ready</strong>
                      <span className="cell-subtext">{row.blockerCount} blocked / {row.reviewCount} review</span>
                    </div>
                  ),
                },
                {
                  key: 'readiness',
                  header: 'Readiness',
                  sortable: true,
                  searchValue: row => row.readinessStatus,
                  render: row => <StatusPill label={row.readinessStatus} tone={getBackendExecutionReadinessTone(row.readinessStatus)} />,
                },
                {
                  key: 'endpoint',
                  header: 'Endpoint',
                  sortable: true,
                  searchValue: row => `${row.method} ${row.endpoint} ${row.endpointConfigured}`,
                  render: row => <div><strong>{row.method}</strong><span className="cell-subtext">{row.endpointConfigured ? row.endpoint : 'Review-only contract'}</span></div>,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => `${row.engineeringOwner} ${row.productOwner}`,
                  render: row => <div><strong>{row.engineeringOwner}</strong><span className="cell-subtext">Product: {row.productOwner}</span></div>,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className="muted-copy">{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedTrustedDeploymentItem ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Deployment Checklist</p>
                      <h2>{selectedTrustedDeploymentItem.handlerLabel}</h2>
                    </div>
                    <StatusPill label={selectedTrustedDeploymentItem.status} tone={getTrustedHandlerDeploymentTone(selectedTrustedDeploymentItem.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Readiness</span><strong>{selectedTrustedDeploymentItem.readinessStatus}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedTrustedDeploymentItem.endpointConfigured ? 'Configured' : 'Review Only'}</strong></div>
                    <div><span>Queue</span><strong>{selectedTrustedDeploymentItem.queuedRequestCount} requests</strong></div>
                    <div><span>Dry-Run Proof</span><strong>{selectedTrustedDeploymentItem.dryRunProofCount}</strong></div>
                    <div><span>Audit Events</span><strong>{selectedTrustedDeploymentItem.auditEventCount}</strong></div>
                    <div><span>Owner</span><strong>{selectedTrustedDeploymentItem.engineeringOwner}</strong></div>
                    <div><span>Handler</span><strong>{selectedTrustedDeploymentItem.handlerKey}</strong></div>
                    <div><span>Permission</span><strong>{selectedTrustedDeploymentItem.permission}</strong></div>
                    <div><span>Mode</span><strong>{selectedTrustedDeploymentItem.mutationMode}</strong></div>
                    <div><span>Checks</span><strong>{selectedTrustedDeploymentItem.readyCount + selectedTrustedDeploymentItem.verifiedCount}/{selectedTrustedDeploymentItem.requiredCheckCount} ready</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Next Step</h3>
                    <p className={selectedTrustedDeploymentItem.status === 'Blocked' || selectedTrustedDeploymentItem.status === 'Needs Build Plan' ? 'warning-copy' : 'muted-copy'}>{selectedTrustedDeploymentItem.nextStep}</p>
                    {selectedTrustedDeploymentItem.reviewedAt && (
                      <p className="muted-copy">Reviewed {formatDateTime(selectedTrustedDeploymentItem.reviewedAt)} by {selectedTrustedDeploymentItem.reviewedByRole}.</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Deployment Checks</h3>
                    <div className="launch-deployment-check-list">
                      {selectedTrustedDeploymentItem.checks.map(check => (
                        <article key={check.id} className={`launch-deployment-check-item tone-${getTrustedHandlerDeploymentCheckTone(check.status)}`}>
                          <div>
                            <div>
                              <strong>{check.label}</strong>
                              <span>{check.category} / {check.required ? 'Required' : 'Optional'}</span>
                            </div>
                            <StatusPill label={check.status} tone={getTrustedHandlerDeploymentCheckTone(check.status)} />
                          </div>
                          <p>{check.detail}</p>
                          <small>{check.implementationNote}</small>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Build Plan</h3>
                    <div className="launch-deployment-plan-grid">
                      <div>
                        <span>Server Build</span>
                        <strong>{selectedTrustedDeploymentItem.buildPlan}</strong>
                      </div>
                      <div>
                        <span>Route</span>
                        <strong>{selectedTrustedDeploymentItem.serverRoutePlan}</strong>
                      </div>
                      <div>
                        <span>Security</span>
                        <strong>{selectedTrustedDeploymentItem.securityPlan}</strong>
                      </div>
                      <div>
                        <span>Observability</span>
                        <strong>{selectedTrustedDeploymentItem.observabilityPlan}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Release, Rollback, Audit</h3>
                    <div className="launch-deployment-plan-grid">
                      <div>
                        <span>Release</span>
                        <strong>{selectedTrustedDeploymentItem.releasePlan}</strong>
                      </div>
                      <div>
                        <span>Rollback</span>
                        <strong>{selectedTrustedDeploymentItem.rollbackPlan}</strong>
                      </div>
                      <div>
                        <span>Audit</span>
                        <strong>{selectedTrustedDeploymentItem.auditPlan}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Review Controls</h3>
                    <div className="launch-deployment-review-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={trustedDeploymentStatus} onChange={event => setTrustedDeploymentStatus(event.target.value as TrustedHandlerDeploymentStatus)}>
                          {trustedHandlerDeploymentStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={trustedDeploymentOwner} onChange={event => setTrustedDeploymentOwner(event.target.value)}>
                          {trustedDeploymentOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={trustedDeploymentNote}
                          onChange={event => setTrustedDeploymentNote(event.target.value)}
                          placeholder="Record build owner, route decision, release toggle, monitoring, rollback, or approval context."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canManageTrustedDeployment} onClick={() => recordTrustedHandlerDeploymentReview(selectedTrustedDeploymentItem)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Deployment Review
                      </button>
                      <button className="ghost-action" disabled={!canManageTrustedDeployment} onClick={() => recordTrustedHandlerDeploymentReview(selectedTrustedDeploymentItem, 'Ready For Build')}>
                        <Wrench size={15} strokeWidth={1.8} />
                        Mark Ready
                      </button>
                      <button className="ghost-action" disabled={!canManageTrustedDeployment} onClick={() => recordTrustedHandlerDeploymentReview(selectedTrustedDeploymentItem, 'Release Candidate')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Release Candidate
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueTrustedHandlerDeploymentItem(selectedTrustedDeploymentItem)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Build
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportTrustedHandlerDeployment(selectedTrustedDeploymentItem)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No trusted handler deployment checklist item selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Deployment Owner Load"
            rows={trustedHandlerDeploymentChecklist.ownerGroups}
            pageSize={6}
            emptyTitle="No deployment owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} handlers / {row.criticalCount} critical</span></div>,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'plan',
                header: 'Needs Plan',
                sortable: true,
                searchValue: row => String(row.needsBuildPlan),
                render: row => row.needsBuildPlan,
              },
              {
                key: 'ready',
                header: 'Ready / Queued',
                sortable: true,
                searchValue: row => `${row.readyForBuild} ${row.buildQueued}`,
                render: row => `${row.readyForBuild}/${row.buildQueued}`,
              },
              {
                key: 'release',
                header: 'Candidate / Verified',
                sortable: true,
                searchValue: row => `${row.releaseCandidate} ${row.verified}`,
                render: row => `${row.releaseCandidate}/${row.verified}`,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Deployment Check Coverage"
            rows={trustedHandlerDeploymentChecklist.categoryGroups}
            pageSize={6}
            emptyTitle="No deployment check coverage is available."
            columns={[
              {
                key: 'category',
                header: 'Category',
                sortable: true,
                searchValue: row => row.category,
                render: row => <div><strong>{row.category}</strong><span className="cell-subtext">{row.requiredCount} required / {row.total} checks</span></div>,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'ready',
                header: 'Ready',
                sortable: true,
                searchValue: row => String(row.ready),
                render: row => row.ready,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'releaseCommand' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Release Command" value={backendReleaseCommandCenter.status} delta={backendReleaseCommandCenter.summary} tone={getBackendReleaseCommandTone(backendReleaseCommandCenter.status)} icon={<Send size={16} />} />
            <MetricCard label="Blocked" value={String(backendReleaseCommandCenter.blockedCount)} delta="Cannot release" tone={backendReleaseCommandCenter.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Planning" value={String(backendReleaseCommandCenter.buildPlanningCount)} delta="Needs release plan" tone={backendReleaseCommandCenter.buildPlanningCount ? 'warn' : 'ok'} icon={<FileText size={16} />} />
            <MetricCard label="Build Ready / Queued" value={`${backendReleaseCommandCenter.readyForBuildCount}/${backendReleaseCommandCenter.buildQueuedCount}`} delta="Engineering queue" tone={backendReleaseCommandCenter.readyForBuildCount || backendReleaseCommandCenter.buildQueuedCount ? 'ok' : 'neutral'} icon={<Wrench size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Candidates" value={String(backendReleaseCommandCenter.releaseCandidateCount)} delta="Awaiting go/no-go" tone={backendReleaseCommandCenter.releaseCandidateCount ? 'ok' : 'neutral'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Verified" value={String(backendReleaseCommandCenter.releaseVerifiedCount)} delta="Ready for watch" tone={backendReleaseCommandCenter.releaseVerifiedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Queued Requests" value={String(backendReleaseCommandCenter.queuedRequestCount)} delta={`${backendReleaseCommandCenter.activeRequestCount} active`} tone={backendReleaseCommandCenter.queuedRequestCount ? 'ok' : 'warn'} icon={<ListChecks size={16} />} />
            <MetricCard label="Audit Backed" value={`${backendReleaseCommandCenter.auditBackedCount}/${backendReleaseCommandCenter.totalCount}`} delta={`${backendReleaseCommandRecords.length} local reviews`} tone={backendReleaseCommandCenter.auditBackedCount ? 'ok' : 'warn'} icon={<ScrollText size={16} />} />
          </div>

          <section className={`panel launch-release-command-panel tone-${getBackendReleaseCommandTone(backendReleaseCommandCenter.status)}`}>
            <div>
              <p className="eyebrow">Backend Release Command Center</p>
              <h2>{backendReleaseCommandCenter.summary}</h2>
              <span>Generated {formatDateTime(backendReleaseCommandCenter.generatedAt)} from trusted deployment checklists, Admin Action Requests, release windows, dry-run proof, audit evidence, rollback plans, and monitoring readiness.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendReleaseCommandCenter.status} tone={getBackendReleaseCommandTone(backendReleaseCommandCenter.status)} />
              <strong>{backendReleaseCommandCenter.nextItem?.handlerLabel ?? 'No open release command work'}</strong>
              <button className="ghost-action" disabled={!canManageReleaseCommand || !selectedReleaseCommandItem} onClick={() => selectedReleaseCommandItem && recordBackendReleaseCommandReview(selectedReleaseCommandItem)}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Review
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Release Rule</p>
              <h2>Release command is not deployment</h2>
              <span>{backendReleaseCommandBoundaryRule}</span>
              <span>Platform Admin can coordinate release review, queue engineering handoff work, and export release evidence. Actual deployment, mutation enablement, feature-flag changes, and production handler execution must happen through trusted server and engineering release processes.</span>
            </div>
            <StatusPill label={canManageReleaseCommand ? 'Release reviews enabled' : 'Read only'} tone={canManageReleaseCommand ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Backend Release Command"
              rows={backendReleaseCommandCenter.items}
              pageSize={9}
              emptyTitle="No backend release command items are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getBackendReleaseCommandTone(row.status)} />,
                },
                {
                  key: 'handler',
                  header: 'Handler',
                  sortable: true,
                  searchValue: row => `${row.handlerLabel} ${row.handlerKey} ${row.nextStep}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedReleaseCommandItemId(row.id)}>
                      {row.handlerLabel}
                    </button>
                  ),
                },
                {
                  key: 'lane',
                  header: 'Lane',
                  sortable: true,
                  searchValue: row => row.lane,
                  render: row => <div><strong>{row.lane}</strong><span className="cell-subtext">{row.goNoGo}</span></div>,
                },
                {
                  key: 'risk',
                  header: 'Risk',
                  sortable: true,
                  searchValue: row => row.risk,
                  render: row => <StatusPill label={row.risk} tone={getBackendReleaseCommandRiskTone(row.risk)} />,
                },
                {
                  key: 'requests',
                  header: 'Requests',
                  sortable: true,
                  searchValue: row => `${row.queuedRequestCount} ${row.activeRequestCount} ${row.completedRequestCount}`,
                  render: row => (
                    <div>
                      <strong>{row.queuedRequestCount} queued</strong>
                      <span className="cell-subtext">{row.activeRequestCount} active / {row.completedRequestCount} complete</span>
                    </div>
                  ),
                },
                {
                  key: 'proof',
                  header: 'Proof',
                  sortable: true,
                  searchValue: row => `${row.readyCount} ${row.verifiedCount} ${row.reviewCount} ${row.blockerCount}`,
                  render: row => (
                    <div>
                      <strong>{row.readyCount + row.verifiedCount}/{row.checks.length} ready</strong>
                      <span className="cell-subtext">{row.blockerCount} blocked / {row.reviewCount} review</span>
                    </div>
                  ),
                },
                {
                  key: 'window',
                  header: 'Window',
                  sortable: true,
                  searchValue: row => row.releaseWindow,
                  render: row => row.releaseWindow,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className="muted-copy">{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedReleaseCommandItem ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Release Command</p>
                      <h2>{selectedReleaseCommandItem.handlerLabel}</h2>
                    </div>
                    <StatusPill label={selectedReleaseCommandItem.status} tone={getBackendReleaseCommandTone(selectedReleaseCommandItem.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Lane</span><strong>{selectedReleaseCommandItem.lane}</strong></div>
                    <div><span>Go / No-Go</span><strong>{selectedReleaseCommandItem.goNoGo}</strong></div>
                    <div><span>Release Window</span><strong>{selectedReleaseCommandItem.releaseWindow}</strong></div>
                    <div><span>Release Owner</span><strong>{selectedReleaseCommandItem.releaseOwner}</strong></div>
                    <div><span>Requests</span><strong>{selectedReleaseCommandItem.queuedRequestCount} queued</strong></div>
                    <div><span>Dry Run</span><strong>{selectedReleaseCommandItem.dryRunProofCount}</strong></div>
                    <div><span>Audit</span><strong>{selectedReleaseCommandItem.auditEventCount}</strong></div>
                    <div><span>Handler</span><strong>{selectedReleaseCommandItem.handlerKey}</strong></div>
                    <div><span>Permission</span><strong>{selectedReleaseCommandItem.permission}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedReleaseCommandItem.method} {selectedReleaseCommandItem.endpoint}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Next Step</h3>
                    <p className={selectedReleaseCommandItem.status === 'Blocked' || selectedReleaseCommandItem.status === 'Build Planning' ? 'warning-copy' : 'muted-copy'}>{selectedReleaseCommandItem.nextStep}</p>
                    {selectedReleaseCommandItem.reviewedAt && (
                      <p className="muted-copy">Reviewed {formatDateTime(selectedReleaseCommandItem.reviewedAt)} by {selectedReleaseCommandItem.reviewedByRole}.</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Release Checks</h3>
                    <div className="launch-release-check-list">
                      {selectedReleaseCommandItem.checks.map(check => (
                        <article key={check.id} className={`launch-release-check-item tone-${getBackendReleaseCommandCheckTone(check.status)}`}>
                          <div>
                            <strong>{check.label}</strong>
                            <StatusPill label={check.status} tone={getBackendReleaseCommandCheckTone(check.status)} />
                          </div>
                          <p>{check.detail}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Release Plan</h3>
                    <div className="launch-release-plan-grid">
                      <div>
                        <span>Build</span>
                        <strong>{selectedReleaseCommandItem.buildPlan}</strong>
                      </div>
                      <div>
                        <span>Release</span>
                        <strong>{selectedReleaseCommandItem.releasePlan}</strong>
                      </div>
                      <div>
                        <span>Monitoring</span>
                        <strong>{selectedReleaseCommandItem.monitoringPlan}</strong>
                      </div>
                      <div>
                        <span>Rollback</span>
                        <strong>{selectedReleaseCommandItem.rollbackPlan}</strong>
                      </div>
                      <div>
                        <span>Audit</span>
                        <strong>{selectedReleaseCommandItem.auditPlan}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Review Controls</h3>
                    <div className="launch-release-review-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={releaseCommandStatus} onChange={event => setReleaseCommandStatus(event.target.value as BackendReleaseCommandStatus)}>
                          {backendReleaseCommandStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={releaseCommandOwner} onChange={event => setReleaseCommandOwner(event.target.value)}>
                          {releaseCommandOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Release Window</span>
                        <input
                          value={releaseCommandWindow}
                          onChange={event => setReleaseCommandWindow(event.target.value)}
                          placeholder="Owner-approved maintenance window, build window, or unscheduled."
                        />
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={releaseCommandNote}
                          onChange={event => setReleaseCommandNote(event.target.value)}
                          placeholder="Record go/no-go context, release window, monitoring plan, rollback evidence, or owner decision."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canManageReleaseCommand} onClick={() => recordBackendReleaseCommandReview(selectedReleaseCommandItem)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Release Review
                      </button>
                      <button className="ghost-action" disabled={!canManageReleaseCommand} onClick={() => recordBackendReleaseCommandReview(selectedReleaseCommandItem, 'Release Candidate')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Candidate
                      </button>
                      <button className="ghost-action" disabled={!canManageReleaseCommand} onClick={() => recordBackendReleaseCommandReview(selectedReleaseCommandItem, 'Release Verified')}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Verify
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueBackendReleaseCommandItem(selectedReleaseCommandItem)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Release
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportBackendReleaseCommand(selectedReleaseCommandItem)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No backend release command item selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Release Lanes"
            rows={backendReleaseCommandCenter.laneGroups}
            pageSize={5}
            emptyTitle="No release lanes are available."
            columns={[
              {
                key: 'lane',
                header: 'Lane',
                sortable: true,
                searchValue: row => row.lane,
                render: row => <div><strong>{row.lane}</strong><span className="cell-subtext">{row.total} handlers / {row.criticalCount} critical</span></div>,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'ready',
                header: 'Ready',
                sortable: true,
                searchValue: row => String(row.ready),
                render: row => row.ready,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Release Owner Load"
            rows={backendReleaseCommandCenter.ownerGroups}
            pageSize={6}
            emptyTitle="No release owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} handlers / {row.criticalCount} critical</span></div>,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'planning',
                header: 'Planning',
                sortable: true,
                searchValue: row => String(row.planning),
                render: row => row.planning,
              },
              {
                key: 'build',
                header: 'Build',
                sortable: true,
                searchValue: row => String(row.build),
                render: row => row.build,
              },
              {
                key: 'release',
                header: 'Release / Watch',
                sortable: true,
                searchValue: row => `${row.release} ${row.watch}`,
                render: row => `${row.release}/${row.watch}`,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'backendWatch' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Watch Monitor" value={backendWatchMonitor.status} delta={backendWatchMonitor.summary} tone={getBackendWatchMonitorTone(backendWatchMonitor.status)} icon={<Gauge size={16} />} />
            <MetricCard label="Critical" value={String(backendWatchMonitor.criticalCount)} delta="Needs owner review" tone={backendWatchMonitor.criticalCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Watch / Stable" value={`${backendWatchMonitor.watchCount}/${backendWatchMonitor.stableCount}`} delta="Active monitoring posture" tone={backendWatchMonitor.watchCount ? 'warn' : 'ok'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Verified" value={String(backendWatchMonitor.verifiedCount)} delta="Ready for closure" tone={backendWatchMonitor.verifiedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Release Ready" value={`${backendWatchMonitor.releaseCandidateCount}/${backendWatchMonitor.releaseVerifiedCount}`} delta="Candidates / verified" tone={backendWatchMonitor.releaseCandidateCount || backendWatchMonitor.releaseVerifiedCount ? 'ok' : 'neutral'} icon={<Send size={16} />} />
            <MetricCard label="Rollback Ready" value={`${backendWatchMonitor.rollbackReadyCount}/${backendWatchMonitor.totalCount}`} delta="Rollback plan attached" tone={backendWatchMonitor.rollbackReadyCount === backendWatchMonitor.totalCount && backendWatchMonitor.totalCount ? 'ok' : 'warn'} icon={<Wrench size={16} />} />
            <MetricCard label="Audit / Dry Run" value={`${backendWatchMonitor.auditBackedCount}/${backendWatchMonitor.dryRunBackedCount}`} delta="Evidence-backed handlers" tone={backendWatchMonitor.auditBackedCount && backendWatchMonitor.dryRunBackedCount ? 'ok' : 'warn'} icon={<ScrollText size={16} />} />
            <MetricCard label="Watch Records" value={String(backendWatchRecords.length)} delta={`${backendWatchMonitor.supportFollowUpCount} follow-ups linked`} tone={backendWatchRecords.length ? 'ok' : 'neutral'} icon={<ListChecks size={16} />} />
          </div>

          <section className={`panel launch-backend-watch-panel tone-${getBackendWatchMonitorTone(backendWatchMonitor.status)}`}>
            <div>
              <p className="eyebrow">Backend Watch Monitor</p>
              <h2>{backendWatchMonitor.summary}</h2>
              <span>Generated {formatDateTime(backendWatchMonitor.generatedAt)} from Release Command status, local Admin Action Requests, audit events, dry-run proof, rollback plans, support follow-up load, and monitoring readiness.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendWatchMonitor.status} tone={getBackendWatchMonitorTone(backendWatchMonitor.status)} />
              <strong>{backendWatchMonitor.nextItem?.handlerLabel ?? 'No open backend watch work'}</strong>
              <button className="ghost-action" disabled={!canManageBackendWatch || !selectedBackendWatchItem} onClick={() => selectedBackendWatchItem && recordBackendWatchReview(selectedBackendWatchItem)}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Review
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Watch Rule</p>
              <h2>Backend watch is not rollback</h2>
              <span>{backendWatchMonitorBoundaryRule}</span>
              <span>Platform Admin can review watch signals, queue follow-up, and export evidence. Actual production rollback, remediation, handler execution, feature changes, billing changes, module changes, and customer-state mutations remain server-side, permissioned, approved, and audited.</span>
            </div>
            <StatusPill label={canManageBackendWatch ? 'Watch reviews enabled' : 'Read only'} tone={canManageBackendWatch ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Backend Watch Monitor"
              rows={backendWatchMonitor.items}
              pageSize={9}
              emptyTitle="No backend watch items are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getBackendWatchMonitorTone(row.status)} />,
                },
                {
                  key: 'handler',
                  header: 'Handler',
                  sortable: true,
                  searchValue: row => `${row.handlerLabel} ${row.handlerKey} ${row.nextStep}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedBackendWatchItemId(row.id)}>
                      {row.handlerLabel}
                    </button>
                  ),
                },
                {
                  key: 'release',
                  header: 'Release',
                  sortable: true,
                  searchValue: row => `${row.releaseStatus} ${row.lane} ${row.goNoGo}`,
                  render: row => <div><strong>{row.releaseStatus}</strong><span className="cell-subtext">{row.lane} / {row.goNoGo}</span></div>,
                },
                {
                  key: 'risk',
                  header: 'Risk',
                  sortable: true,
                  searchValue: row => row.risk,
                  render: row => <StatusPill label={row.risk} tone={getBackendWatchRiskTone(row.risk)} />,
                },
                {
                  key: 'signals',
                  header: 'Signals',
                  sortable: true,
                  searchValue: row => `${row.criticalSignalCount} ${row.watchSignalCount} ${row.stableSignalCount} ${row.verifiedSignalCount}`,
                  render: row => (
                    <div>
                      <strong>{row.criticalSignalCount} critical / {row.watchSignalCount} watch</strong>
                      <span className="cell-subtext">{row.stableSignalCount} stable / {row.verifiedSignalCount} verified</span>
                    </div>
                  ),
                },
                {
                  key: 'proof',
                  header: 'Proof',
                  sortable: true,
                  searchValue: row => `${row.auditEventCount} ${row.dryRunProofCount} ${row.supportFollowUpCount}`,
                  render: row => (
                    <div>
                      <strong>{row.auditEventCount} audit / {row.dryRunProofCount} dry run</strong>
                      <span className="cell-subtext">{row.supportFollowUpCount} support follow-up</span>
                    </div>
                  ),
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => row.watchOwner,
                  render: row => row.watchOwner,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className="muted-copy">{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedBackendWatchItem ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Backend Watch</p>
                      <h2>{selectedBackendWatchItem.handlerLabel}</h2>
                    </div>
                    <StatusPill label={selectedBackendWatchItem.status} tone={getBackendWatchMonitorTone(selectedBackendWatchItem.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Release</span><strong>{selectedBackendWatchItem.releaseStatus}</strong></div>
                    <div><span>Lane</span><strong>{selectedBackendWatchItem.lane}</strong></div>
                    <div><span>Watch Owner</span><strong>{selectedBackendWatchItem.watchOwner}</strong></div>
                    <div><span>Release Window</span><strong>{selectedBackendWatchItem.releaseWindow}</strong></div>
                    <div><span>Critical Signals</span><strong>{selectedBackendWatchItem.criticalSignalCount}</strong></div>
                    <div><span>Watch Signals</span><strong>{selectedBackendWatchItem.watchSignalCount}</strong></div>
                    <div><span>Audit</span><strong>{selectedBackendWatchItem.auditEventCount}</strong></div>
                    <div><span>Dry Run</span><strong>{selectedBackendWatchItem.dryRunProofCount}</strong></div>
                    <div><span>Support Follow-Up</span><strong>{selectedBackendWatchItem.supportFollowUpCount}</strong></div>
                    <div><span>Handler</span><strong>{selectedBackendWatchItem.handlerKey}</strong></div>
                    <div><span>Permission</span><strong>{selectedBackendWatchItem.permission}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedBackendWatchItem.method} {selectedBackendWatchItem.endpoint}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Next Step</h3>
                    <p className={selectedBackendWatchItem.status === 'Critical Drift' || selectedBackendWatchItem.status === 'Watch' ? 'warning-copy' : 'muted-copy'}>{selectedBackendWatchItem.nextStep}</p>
                    {selectedBackendWatchItem.reviewedAt && (
                      <p className="muted-copy">Reviewed {formatDateTime(selectedBackendWatchItem.reviewedAt)} by {selectedBackendWatchItem.reviewedByRole}.</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Watch Signals</h3>
                    <div className="launch-backend-watch-signal-list">
                      {selectedBackendWatchItem.signals.map(signal => (
                        <article key={signal.id} className={`launch-backend-watch-signal-item tone-${getBackendWatchSignalTone(signal.status)}`}>
                          <div>
                            <div>
                              <strong>{signal.label}</strong>
                              <span>{signal.type}</span>
                            </div>
                            <StatusPill label={signal.status} tone={getBackendWatchSignalTone(signal.status)} />
                          </div>
                          <p>{signal.detail}</p>
                          <small>{signal.recommendedAction}</small>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Watch Plan</h3>
                    <div className="launch-backend-watch-plan-grid">
                      <div>
                        <span>Monitoring</span>
                        <strong>{selectedBackendWatchItem.watchPlan}</strong>
                      </div>
                      <div>
                        <span>Rollback</span>
                        <strong>{selectedBackendWatchItem.rollbackPlan}</strong>
                      </div>
                      <div>
                        <span>Audit</span>
                        <strong>{selectedBackendWatchItem.auditPlan}</strong>
                      </div>
                      <div>
                        <span>Support</span>
                        <strong>{selectedBackendWatchItem.supportPlan}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Review Controls</h3>
                    <div className="launch-backend-watch-review-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={backendWatchStatus} onChange={event => setBackendWatchStatus(event.target.value as BackendWatchMonitorStatus)}>
                          {backendWatchMonitorStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={backendWatchOwner} onChange={event => setBackendWatchOwner(event.target.value)}>
                          {backendWatchOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={backendWatchNote}
                          onChange={event => setBackendWatchNote(event.target.value)}
                          placeholder="Record signal drift, rollback/audit context, support follow-up, or closure readiness."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canManageBackendWatch} onClick={() => recordBackendWatchReview(selectedBackendWatchItem)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Watch Review
                      </button>
                      <button className="ghost-action" disabled={!canManageBackendWatch} onClick={() => recordBackendWatchReview(selectedBackendWatchItem, 'Stable')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Stable
                      </button>
                      <button className="ghost-action" disabled={!canManageBackendWatch} onClick={() => recordBackendWatchReview(selectedBackendWatchItem, 'Verified')}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Verify
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueBackendWatchFollowUp(selectedBackendWatchItem)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Follow-Up
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportBackendWatchItem(selectedBackendWatchItem)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No backend watch item selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Watch Signal Coverage"
            rows={backendWatchMonitor.signalGroups}
            pageSize={7}
            emptyTitle="No backend watch signal coverage is available."
            columns={[
              {
                key: 'type',
                header: 'Signal',
                sortable: true,
                searchValue: row => row.type,
                render: row => <div><strong>{row.type}</strong><span className="cell-subtext">{row.total} handlers</span></div>,
              },
              {
                key: 'critical',
                header: 'Critical',
                sortable: true,
                searchValue: row => String(row.critical),
                render: row => row.critical,
              },
              {
                key: 'watch',
                header: 'Watch',
                sortable: true,
                searchValue: row => String(row.watch),
                render: row => row.watch,
              },
              {
                key: 'stable',
                header: 'Stable',
                sortable: true,
                searchValue: row => String(row.stable),
                render: row => row.stable,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Watch Owner Load"
            rows={backendWatchMonitor.ownerGroups}
            pageSize={6}
            emptyTitle="No backend watch owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} handlers / {row.criticalSignalCount} critical signals</span></div>,
              },
              {
                key: 'critical',
                header: 'Critical',
                sortable: true,
                searchValue: row => String(row.critical),
                render: row => row.critical,
              },
              {
                key: 'watch',
                header: 'Watch',
                sortable: true,
                searchValue: row => String(row.watch),
                render: row => row.watch,
              },
              {
                key: 'stable',
                header: 'Stable / Verified',
                sortable: true,
                searchValue: row => `${row.stable} ${row.verified}`,
                render: row => `${row.stable}/${row.verified}`,
              },
              {
                key: 'signals',
                header: 'Open Signals',
                sortable: true,
                searchValue: row => `${row.criticalSignalCount} ${row.watchSignalCount}`,
                render: row => `${row.criticalSignalCount}/${row.watchSignalCount}`,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'backendClosure' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Closure Evidence" value={backendClosureEvidenceBinder.status} delta={backendClosureEvidenceBinder.summary} tone={getBackendClosureEvidenceTone(backendClosureEvidenceBinder.status)} icon={<ClipboardCheck size={16} />} />
            <MetricCard label="Blocked" value={String(backendClosureEvidenceBinder.blockedCount)} delta="Missing evidence" tone={backendClosureEvidenceBinder.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Review" value={String(backendClosureEvidenceBinder.evidenceReviewCount)} delta="Evidence needs review" tone={backendClosureEvidenceBinder.evidenceReviewCount ? 'warn' : 'ok'} icon={<FileText size={16} />} />
            <MetricCard label="Ready / Packet" value={`${backendClosureEvidenceBinder.readyForClosureCount}/${backendClosureEvidenceBinder.packetReadyCount}`} delta="Closure packet posture" tone={backendClosureEvidenceBinder.readyForClosureCount || backendClosureEvidenceBinder.packetReadyCount ? 'ok' : 'neutral'} icon={<ShieldCheck size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Required Evidence" value={`${backendClosureEvidenceBinder.requiredReadyCount}/${backendClosureEvidenceBinder.requiredCount}`} delta="Required checks ready" tone={backendClosureEvidenceBinder.requiredReadyCount === backendClosureEvidenceBinder.requiredCount && backendClosureEvidenceBinder.requiredCount ? 'ok' : 'warn'} icon={<ListChecks size={16} />} />
            <MetricCard label="Audit / Dry Run" value={`${backendClosureEvidenceBinder.auditBackedCount}/${backendClosureEvidenceBinder.dryRunBackedCount}`} delta="Evidence-backed handlers" tone={backendClosureEvidenceBinder.auditBackedCount && backendClosureEvidenceBinder.dryRunBackedCount ? 'ok' : 'warn'} icon={<ScrollText size={16} />} />
            <MetricCard label="Rollback Ready" value={`${backendClosureEvidenceBinder.rollbackReadyCount}/${backendClosureEvidenceBinder.totalCount}`} delta="Rollback proof attached" tone={backendClosureEvidenceBinder.rollbackReadyCount === backendClosureEvidenceBinder.totalCount && backendClosureEvidenceBinder.totalCount ? 'ok' : 'warn'} icon={<Wrench size={16} />} />
            <MetricCard label="Packet Records" value={String(backendClosureEvidenceRecords.length)} delta={`${backendClosureEvidenceBinder.closedCount} closed`} tone={backendClosureEvidenceRecords.length ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
          </div>

          <section className={`panel launch-backend-closure-panel tone-${getBackendClosureEvidenceTone(backendClosureEvidenceBinder.status)}`}>
            <div>
              <p className="eyebrow">Backend Closure Evidence Binder</p>
              <h2>{backendClosureEvidenceBinder.summary}</h2>
              <span>Generated {formatDateTime(backendClosureEvidenceBinder.generatedAt)} from Backend Watch status, release command posture, audit evidence, dry-run proof, rollback plans, support follow-up load, and packet readiness.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={backendClosureEvidenceBinder.status} tone={getBackendClosureEvidenceTone(backendClosureEvidenceBinder.status)} />
              <strong>{backendClosureEvidenceBinder.nextItem?.handlerLabel ?? 'No open backend closure evidence work'}</strong>
              <button className="ghost-action" disabled={!canManageBackendClosure || !selectedBackendClosureItem} onClick={() => selectedBackendClosureItem && recordBackendClosureEvidence(selectedBackendClosureItem)}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Evidence
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Closure Evidence Rule</p>
              <h2>Backend closure is not production close</h2>
              <span>{backendClosureEvidenceBoundaryRule}</span>
              <span>Platform Admin can collect closure evidence, queue follow-up, and export packets. Actual release closure, production rollback, remediation, handler execution, feature changes, billing changes, module changes, and customer-state mutations remain server-side, permissioned, approved, and audited.</span>
            </div>
            <StatusPill label={canManageBackendClosure ? 'Closure evidence reviews enabled' : 'Read only'} tone={canManageBackendClosure ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Backend Closure Evidence"
              rows={backendClosureEvidenceBinder.items}
              pageSize={9}
              emptyTitle="No backend closure evidence items are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getBackendClosureEvidenceTone(row.status)} />,
                },
                {
                  key: 'handler',
                  header: 'Handler',
                  sortable: true,
                  searchValue: row => `${row.handlerLabel} ${row.handlerKey} ${row.nextStep}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedBackendClosureItemId(row.id)}>
                      {row.handlerLabel}
                    </button>
                  ),
                },
                {
                  key: 'watch',
                  header: 'Watch',
                  sortable: true,
                  searchValue: row => `${row.watchStatus} ${row.releaseStatus}`,
                  render: row => <div><strong>{row.watchStatus}</strong><span className="cell-subtext">{row.releaseStatus}</span></div>,
                },
                {
                  key: 'risk',
                  header: 'Risk',
                  sortable: true,
                  searchValue: row => row.risk,
                  render: row => <StatusPill label={row.risk} tone={getBackendClosureEvidenceRiskTone(row.risk)} />,
                },
                {
                  key: 'evidence',
                  header: 'Evidence',
                  sortable: true,
                  searchValue: row => `${row.requiredReadyCount} ${row.requiredCount} ${row.missingCount} ${row.reviewCount}`,
                  render: row => (
                    <div>
                      <strong>{row.requiredReadyCount}/{row.requiredCount} required</strong>
                      <span className="cell-subtext">{row.missingCount} missing / {row.reviewCount} review</span>
                    </div>
                  ),
                },
                {
                  key: 'proof',
                  header: 'Proof',
                  sortable: true,
                  searchValue: row => `${row.auditEventCount} ${row.dryRunProofCount} ${row.supportFollowUpCount}`,
                  render: row => (
                    <div>
                      <strong>{row.auditEventCount} audit / {row.dryRunProofCount} dry run</strong>
                      <span className="cell-subtext">{row.supportFollowUpCount} support follow-up</span>
                    </div>
                  ),
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => row.closureOwner,
                  render: row => row.closureOwner,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className="muted-copy">{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedBackendClosureItem ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Backend Closure</p>
                      <h2>{selectedBackendClosureItem.handlerLabel}</h2>
                    </div>
                    <StatusPill label={selectedBackendClosureItem.status} tone={getBackendClosureEvidenceTone(selectedBackendClosureItem.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Watch</span><strong>{selectedBackendClosureItem.watchStatus}</strong></div>
                    <div><span>Release</span><strong>{selectedBackendClosureItem.releaseStatus}</strong></div>
                    <div><span>Closure Owner</span><strong>{selectedBackendClosureItem.closureOwner}</strong></div>
                    <div><span>Packet Location</span><strong>{selectedBackendClosureItem.packetLocation}</strong></div>
                    <div><span>Required Ready</span><strong>{selectedBackendClosureItem.requiredReadyCount}/{selectedBackendClosureItem.requiredCount}</strong></div>
                    <div><span>Missing</span><strong>{selectedBackendClosureItem.missingCount}</strong></div>
                    <div><span>Review</span><strong>{selectedBackendClosureItem.reviewCount}</strong></div>
                    <div><span>Audit</span><strong>{selectedBackendClosureItem.auditEventCount}</strong></div>
                    <div><span>Dry Run</span><strong>{selectedBackendClosureItem.dryRunProofCount}</strong></div>
                    <div><span>Handler</span><strong>{selectedBackendClosureItem.handlerKey}</strong></div>
                    <div><span>Permission</span><strong>{selectedBackendClosureItem.permission}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedBackendClosureItem.method} {selectedBackendClosureItem.endpoint}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Next Step</h3>
                    <p className={selectedBackendClosureItem.status === 'Blocked' || selectedBackendClosureItem.status === 'Evidence Review' ? 'warning-copy' : 'muted-copy'}>{selectedBackendClosureItem.nextStep}</p>
                    {selectedBackendClosureItem.reviewedAt && (
                      <p className="muted-copy">Reviewed {formatDateTime(selectedBackendClosureItem.reviewedAt)} by {selectedBackendClosureItem.reviewedByRole}.</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Evidence Checks</h3>
                    <div className="launch-backend-closure-check-list">
                      {selectedBackendClosureItem.checks.map(check => (
                        <article key={check.id} className={`launch-backend-closure-check-item tone-${getBackendClosureEvidenceCheckTone(check.status)}`}>
                          <div>
                            <div>
                              <strong>{check.label}</strong>
                              <span>{check.category} / {check.required ? 'Required' : 'Optional'}</span>
                            </div>
                            <StatusPill label={check.status} tone={getBackendClosureEvidenceCheckTone(check.status)} />
                          </div>
                          <p>{check.detail}</p>
                          <small>{check.nextStep}</small>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Closure Plan</h3>
                    <div className="launch-backend-closure-plan-grid">
                      <div>
                        <span>Summary</span>
                        <strong>{selectedBackendClosureItem.closureSummary}</strong>
                      </div>
                      <div>
                        <span>Closure</span>
                        <strong>{selectedBackendClosureItem.closurePlan}</strong>
                      </div>
                      <div>
                        <span>Rollback</span>
                        <strong>{selectedBackendClosureItem.rollbackPlan}</strong>
                      </div>
                      <div>
                        <span>Audit</span>
                        <strong>{selectedBackendClosureItem.auditPlan}</strong>
                      </div>
                      <div>
                        <span>Support</span>
                        <strong>{selectedBackendClosureItem.supportPlan}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Review Controls</h3>
                    <div className="launch-backend-closure-review-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={backendClosureStatus} onChange={event => setBackendClosureStatus(event.target.value as BackendClosureEvidenceStatus)}>
                          {backendClosureEvidenceStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={backendClosureOwner} onChange={event => setBackendClosureOwner(event.target.value)}>
                          {backendClosureOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Packet Location</span>
                        <input
                          value={backendClosurePacketLocation}
                          onChange={event => setBackendClosurePacketLocation(event.target.value)}
                          placeholder="Platform Admin / Launch Gate / Backend Closure / handler"
                        />
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={backendClosureNote}
                          onChange={event => setBackendClosureNote(event.target.value)}
                          placeholder="Record packet evidence, accepted gaps, export notes, owner decision, or closure constraints."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canManageBackendClosure} onClick={() => recordBackendClosureEvidence(selectedBackendClosureItem)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Closure Evidence
                      </button>
                      <button className="ghost-action" disabled={!canManageBackendClosure} onClick={() => recordBackendClosureEvidence(selectedBackendClosureItem, 'Packet Ready')}>
                        <ClipboardCheck size={15} strokeWidth={1.8} />
                        Packet Ready
                      </button>
                      <button className="ghost-action" disabled={!canManageBackendClosure} onClick={() => recordBackendClosureEvidence(selectedBackendClosureItem, 'Closed')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Close Packet
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueBackendClosureEvidenceFollowUp(selectedBackendClosureItem)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Follow-Up
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportBackendClosureEvidence(selectedBackendClosureItem)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No backend closure evidence item selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Backend Closure Evidence Coverage"
            rows={backendClosureEvidenceBinder.categoryGroups}
            pageSize={7}
            emptyTitle="No backend closure evidence coverage is available."
            columns={[
              {
                key: 'category',
                header: 'Category',
                sortable: true,
                searchValue: row => row.category,
                render: row => <div><strong>{row.category}</strong><span className="cell-subtext">{row.total} checks</span></div>,
              },
              {
                key: 'missing',
                header: 'Missing',
                sortable: true,
                searchValue: row => String(row.missing),
                render: row => row.missing,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'ready',
                header: 'Ready',
                sortable: true,
                searchValue: row => String(row.ready),
                render: row => row.ready,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Backend Closure Owner Load"
            rows={backendClosureEvidenceBinder.ownerGroups}
            pageSize={6}
            emptyTitle="No backend closure owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} handlers / {row.missingCount} missing checks</span></div>,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'ready',
                header: 'Ready / Packet',
                sortable: true,
                searchValue: row => `${row.ready} ${row.packetReady}`,
                render: row => `${row.ready}/${row.packetReady}`,
              },
              {
                key: 'closed',
                header: 'Closed',
                sortable: true,
                searchValue: row => String(row.closed),
                render: row => row.closed,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'productionGuardrails' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Guardrail Matrix" value={productionGuardrailMatrix.status} delta={productionGuardrailMatrix.summary} tone={getProductionGuardrailTone(productionGuardrailMatrix.status)} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Blocked" value={String(productionGuardrailMatrix.blockedCount)} delta="Missing guardrails" tone={productionGuardrailMatrix.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Review" value={String(productionGuardrailMatrix.reviewCount)} delta="Guardrails need review" tone={productionGuardrailMatrix.reviewCount ? 'warn' : 'ok'} icon={<FileText size={16} />} />
            <MetricCard label="Ready / Verified" value={`${productionGuardrailMatrix.readyForReviewCount}/${productionGuardrailMatrix.verifiedCount}`} delta="Production review posture" tone={productionGuardrailMatrix.readyForReviewCount || productionGuardrailMatrix.verifiedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Required Guardrails" value={`${productionGuardrailMatrix.requiredSatisfiedCount}/${productionGuardrailMatrix.requiredCount}`} delta="Required checks satisfied" tone={productionGuardrailMatrix.requiredSatisfiedCount === productionGuardrailMatrix.requiredCount && productionGuardrailMatrix.requiredCount ? 'ok' : 'warn'} icon={<ListChecks size={16} />} />
            <MetricCard label="Browser Safe" value={`${productionGuardrailMatrix.browserSafeCount}/${productionGuardrailMatrix.totalCount}`} delta="No browser mutation path" tone={productionGuardrailMatrix.browserSafeCount === productionGuardrailMatrix.totalCount && productionGuardrailMatrix.totalCount ? 'ok' : 'danger'} icon={<DatabaseZap size={16} />} />
            <MetricCard label="Audit / Rollback" value={`${productionGuardrailMatrix.auditBackedCount}/${productionGuardrailMatrix.rollbackReadyCount}`} delta="Evidence-backed controls" tone={productionGuardrailMatrix.auditBackedCount && productionGuardrailMatrix.rollbackReadyCount ? 'ok' : 'warn'} icon={<ScrollText size={16} />} />
            <MetricCard label="Guardrail Records" value={String(productionGuardrailRecords.length)} delta="Local safety reviews" tone={productionGuardrailRecords.length ? 'ok' : 'neutral'} icon={<ClipboardCheck size={16} />} />
          </div>

          <section className={`panel launch-production-guardrail-panel tone-${getProductionGuardrailTone(productionGuardrailMatrix.status)}`}>
            <div>
              <p className="eyebrow">Production Guardrail Matrix</p>
              <h2>{productionGuardrailMatrix.summary}</h2>
              <span>Generated {formatDateTime(productionGuardrailMatrix.generatedAt)} from backend closure evidence, watch status, release posture, permission requirements, audit proof, dry-run proof, rollback plans, support load, and browser mutation boundaries.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={productionGuardrailMatrix.status} tone={getProductionGuardrailTone(productionGuardrailMatrix.status)} />
              <strong>{productionGuardrailMatrix.nextItem?.handlerLabel ?? 'No open production guardrail work'}</strong>
              <button className="ghost-action" disabled={!canManageProductionGuardrails || !selectedProductionGuardrailItem} onClick={() => selectedProductionGuardrailItem && recordProductionGuardrailReview(selectedProductionGuardrailItem)}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Guardrail
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Guardrail Rule</p>
              <h2>Guardrails are not execution</h2>
              <span>{productionGuardrailBoundaryRule}</span>
              <span>The matrix proves that production work stays server-side, permissioned, audited, approved, rollback-aware, and dry-run backed. It cannot run a handler, change a feature, alter billing, enable a module, impersonate a user, or mutate customer state.</span>
            </div>
            <StatusPill label={canManageProductionGuardrails ? 'Guardrail reviews enabled' : 'Read only'} tone={canManageProductionGuardrails ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Production Guardrail Matrix"
              rows={productionGuardrailMatrix.items}
              pageSize={9}
              emptyTitle="No production guardrail items are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getProductionGuardrailTone(row.status)} />,
                },
                {
                  key: 'handler',
                  header: 'Handler',
                  sortable: true,
                  searchValue: row => `${row.handlerLabel} ${row.handlerKey} ${row.nextStep}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedProductionGuardrailItemId(row.id)}>
                      {row.handlerLabel}
                    </button>
                  ),
                },
                {
                  key: 'boundary',
                  header: 'Boundary',
                  sortable: true,
                  searchValue: row => `${row.closureStatus} ${row.watchStatus} ${row.releaseStatus}`,
                  render: row => <div><strong>{row.closureStatus}</strong><span className="cell-subtext">{row.watchStatus} / {row.releaseStatus}</span></div>,
                },
                {
                  key: 'risk',
                  header: 'Risk',
                  sortable: true,
                  searchValue: row => row.risk,
                  render: row => <StatusPill label={row.risk} tone={getProductionGuardrailRiskTone(row.risk)} />,
                },
                {
                  key: 'guardrails',
                  header: 'Guardrails',
                  sortable: true,
                  searchValue: row => `${row.requiredSatisfiedCount} ${row.requiredCount} ${row.missingCount} ${row.reviewCount}`,
                  render: row => (
                    <div>
                      <strong>{row.requiredSatisfiedCount}/{row.requiredCount} required</strong>
                      <span className="cell-subtext">{row.missingCount} missing / {row.reviewCount} review</span>
                    </div>
                  ),
                },
                {
                  key: 'proof',
                  header: 'Proof',
                  sortable: true,
                  searchValue: row => `${row.auditEventCount} ${row.dryRunProofCount} ${row.supportFollowUpCount}`,
                  render: row => (
                    <div>
                      <strong>{row.auditEventCount} audit / {row.dryRunProofCount} dry run</strong>
                      <span className="cell-subtext">{row.supportFollowUpCount} support follow-up</span>
                    </div>
                  ),
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => row.guardrailOwner,
                  render: row => row.guardrailOwner,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className="muted-copy">{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedProductionGuardrailItem ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Production Guardrail</p>
                      <h2>{selectedProductionGuardrailItem.handlerLabel}</h2>
                    </div>
                    <StatusPill label={selectedProductionGuardrailItem.status} tone={getProductionGuardrailTone(selectedProductionGuardrailItem.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Closure</span><strong>{selectedProductionGuardrailItem.closureStatus}</strong></div>
                    <div><span>Watch</span><strong>{selectedProductionGuardrailItem.watchStatus}</strong></div>
                    <div><span>Guardrail Owner</span><strong>{selectedProductionGuardrailItem.guardrailOwner}</strong></div>
                    <div><span>Browser Mutation</span><strong>{selectedProductionGuardrailItem.browserMutationBlocked ? 'Blocked' : 'Needs Review'}</strong></div>
                    <div><span>Required Ready</span><strong>{selectedProductionGuardrailItem.requiredSatisfiedCount}/{selectedProductionGuardrailItem.requiredCount}</strong></div>
                    <div><span>Missing</span><strong>{selectedProductionGuardrailItem.missingCount}</strong></div>
                    <div><span>Review</span><strong>{selectedProductionGuardrailItem.reviewCount}</strong></div>
                    <div><span>Audit</span><strong>{selectedProductionGuardrailItem.auditEventCount}</strong></div>
                    <div><span>Dry Run</span><strong>{selectedProductionGuardrailItem.dryRunProofCount}</strong></div>
                    <div><span>Handler</span><strong>{selectedProductionGuardrailItem.handlerKey}</strong></div>
                    <div><span>Permission</span><strong>{selectedProductionGuardrailItem.permission}</strong></div>
                    <div><span>Endpoint</span><strong>{selectedProductionGuardrailItem.method} {selectedProductionGuardrailItem.endpoint}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Next Step</h3>
                    <p className={selectedProductionGuardrailItem.status === 'Blocked' || selectedProductionGuardrailItem.status === 'Guardrail Review' ? 'warning-copy' : 'muted-copy'}>{selectedProductionGuardrailItem.nextStep}</p>
                    {selectedProductionGuardrailItem.reviewedAt && (
                      <p className="muted-copy">Reviewed {formatDateTime(selectedProductionGuardrailItem.reviewedAt)} by {selectedProductionGuardrailItem.reviewedByRole}.</p>
                    )}
                  </div>

                  <div className="detail-section">
                    <h3>Guardrail Checks</h3>
                    <div className="launch-production-guardrail-check-list">
                      {selectedProductionGuardrailItem.checks.map(check => (
                        <article key={check.id} className={`launch-production-guardrail-check-item tone-${getProductionGuardrailCheckTone(check.status)}`}>
                          <div>
                            <div>
                              <strong>{check.label}</strong>
                              <span>{check.category} / {check.required ? 'Required' : 'Optional'}</span>
                            </div>
                            <StatusPill label={check.status} tone={getProductionGuardrailCheckTone(check.status)} />
                          </div>
                          <p>{check.detail}</p>
                          <small>{check.guardrail}</small>
                        </article>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Production Boundary</h3>
                    <div className="launch-production-guardrail-plan-grid">
                      <div>
                        <span>Boundary</span>
                        <strong>{selectedProductionGuardrailItem.productionBoundary}</strong>
                      </div>
                      <div>
                        <span>Verification</span>
                        <strong>{selectedProductionGuardrailItem.verificationPlan}</strong>
                      </div>
                      <div>
                        <span>Escalation</span>
                        <strong>{selectedProductionGuardrailItem.escalationPlan}</strong>
                      </div>
                      <div>
                        <span>Packet</span>
                        <strong>{selectedProductionGuardrailItem.packetLocation}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Review Controls</h3>
                    <div className="launch-production-guardrail-review-form">
                      <label className="field compact-field">
                        <span>Status</span>
                        <select value={productionGuardrailStatus} onChange={event => setProductionGuardrailStatus(event.target.value as ProductionGuardrailStatus)}>
                          {productionGuardrailStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={productionGuardrailOwner} onChange={event => setProductionGuardrailOwner(event.target.value)}>
                          {productionGuardrailOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Review Note</span>
                        <textarea
                          value={productionGuardrailNote}
                          onChange={event => setProductionGuardrailNote(event.target.value)}
                          placeholder="Record guardrail decision, accepted evidence gaps, production review limits, or escalation notes."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canManageProductionGuardrails} onClick={() => recordProductionGuardrailReview(selectedProductionGuardrailItem)}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Guardrail Review
                      </button>
                      <button className="ghost-action" disabled={!canManageProductionGuardrails} onClick={() => recordProductionGuardrailReview(selectedProductionGuardrailItem, 'Ready For Production Review')}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Ready
                      </button>
                      <button className="ghost-action" disabled={!canManageProductionGuardrails} onClick={() => recordProductionGuardrailReview(selectedProductionGuardrailItem, 'Verified')}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Verify
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueProductionGuardrailFollowUp(selectedProductionGuardrailItem)}>
                        <Send size={15} strokeWidth={1.8} />
                        Queue Follow-Up
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportProductionGuardrail(selectedProductionGuardrailItem)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No production guardrail item selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Production Guardrail Coverage"
            rows={productionGuardrailMatrix.categoryGroups}
            pageSize={9}
            emptyTitle="No production guardrail coverage is available."
            columns={[
              {
                key: 'category',
                header: 'Category',
                sortable: true,
                searchValue: row => row.category,
                render: row => <div><strong>{row.category}</strong><span className="cell-subtext">{row.total} checks</span></div>,
              },
              {
                key: 'missing',
                header: 'Missing',
                sortable: true,
                searchValue: row => String(row.missing),
                render: row => row.missing,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'ready',
                header: 'Ready',
                sortable: true,
                searchValue: row => String(row.ready),
                render: row => row.ready,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Production Guardrail Owner Load"
            rows={productionGuardrailMatrix.ownerGroups}
            pageSize={6}
            emptyTitle="No production guardrail owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} handlers / {row.missingCount} missing guardrails</span></div>,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'ready',
                header: 'Ready',
                sortable: true,
                searchValue: row => String(row.ready),
                render: row => row.ready,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'goNoGo' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Executive Decision" value={executiveGoNoGoRoom.decision} delta="Evidence-derived posture" tone={getExecutiveGoNoGoTone(executiveGoNoGoRoom.decision)} icon={<UserCheck size={16} />} />
            <MetricCard label="Blockers" value={String(executiveGoNoGoRoom.blockedCount)} delta="Must clear before Go" tone={executiveGoNoGoRoom.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Conditions" value={String(executiveGoNoGoRoom.conditionCount)} delta="Requires owner tracking" tone={executiveGoNoGoRoom.conditionCount ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
            <MetricCard label="Required Clear" value={`${executiveGoNoGoRoom.requiredClearCount}/${executiveGoNoGoRoom.requiredCount}`} delta="Decision evidence" tone={executiveGoNoGoRoom.requiredClearCount === executiveGoNoGoRoom.requiredCount ? 'ok' : 'warn'} icon={<CheckCircle2 size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Audit Backed" value={`${executiveGoNoGoRoom.auditBackedCount}/${executiveGoNoGoRoom.items.length}`} delta="Evidence with audit trail" tone={executiveGoNoGoRoom.auditBackedCount ? 'ok' : 'warn'} icon={<ScrollText size={16} />} />
            <MetricCard label="Approval Baseline" value={latestHandoffApproval?.decision ?? 'Missing'} delta={latestHandoffApproval ? formatDateTime(latestHandoffApproval.recordedAt) : 'Record approval before close'} tone={latestHandoffApproval ? getLaunchHandoffDecisionTone(latestHandoffApproval.decision) : 'danger'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Decision Records" value={String(executiveGoNoGoRoom.recordCount)} delta={executiveGoNoGoRoom.latestRecord ? formatDateTime(executiveGoNoGoRoom.latestRecord.recordedAt) : 'No room record'} tone={executiveGoNoGoRoom.latestRecord ? getExecutiveGoNoGoTone(executiveGoNoGoRoom.latestRecord.decision) : 'neutral'} icon={<FileText size={16} />} />
            <MetricCard label="Record Permission" value={canRecordExecutiveGoNoGo ? 'Enabled' : 'Read Only'} delta="settings.manage" tone={canRecordExecutiveGoNoGo ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
          </div>

          <section className={`panel launch-go-no-go-panel tone-${getExecutiveGoNoGoTone(executiveGoNoGoRoom.decision)}`}>
            <div>
              <p className="eyebrow">Executive Go / No-Go Evidence Room</p>
              <h2>{executiveGoNoGoRoom.headline}</h2>
              <span>Generated {formatDateTime(executiveGoNoGoRoom.generatedAt)} from launch readiness, closure, executive brief, artifact manifest, handoff approval, watchtower, backend closure, guardrails, follow-up, action queue, data contracts, and audit evidence.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={executiveGoNoGoRoom.decision} tone={getExecutiveGoNoGoTone(executiveGoNoGoRoom.decision)} />
              <strong>{executiveGoNoGoRoom.nextItem?.title ?? 'Evidence is clear for final decision'}</strong>
              <button className="ghost-action" disabled={!canRecordExecutiveGoNoGo} onClick={() => recordExecutiveGoNoGoDecision()}>
                <UserCheck size={15} strokeWidth={1.8} />
                Record Decision
              </button>
              <button className="ghost-action" disabled={!canExport} onClick={exportExecutiveGoNoGoRoom}>
                <Download size={15} strokeWidth={1.8} />
                Export Room
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Decision Boundary</p>
              <h2>Go / No-Go records do not execute launch</h2>
              <span>{executiveGoNoGoBoundaryRule}</span>
              <span>The room creates executive evidence, not production changes. Any follow-up still moves through permissions, human confirmation where required, server-side handlers, rollback notes, and audit records.</span>
            </div>
            <StatusPill label={canRecordExecutiveGoNoGo ? 'Decision recording enabled' : 'Read only'} tone={canRecordExecutiveGoNoGo ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Executive Go / No-Go Evidence"
              rows={executiveGoNoGoRoom.items}
              pageSize={12}
              emptyTitle="No executive Go / No-Go evidence is available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getExecutiveGoNoGoTone(row.status)} />,
                },
                {
                  key: 'evidence',
                  header: 'Evidence',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.category} ${row.reference}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedExecutiveGoNoGoItemId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'source',
                  header: 'Source',
                  sortable: true,
                  searchValue: row => `${row.category} ${row.reference}`,
                  render: row => <div><strong>{row.category}</strong><span className="cell-subtext">{row.reference}</span></div>,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => row.owner,
                  render: row => row.owner,
                },
                {
                  key: 'audit',
                  header: 'Audit',
                  sortable: true,
                  searchValue: row => row.auditBacked ? 'Audit backed' : 'Needs audit',
                  render: row => <StatusPill label={row.auditBacked ? 'Audit Backed' : 'Needs Audit'} tone={row.auditBacked ? 'ok' : 'warn'} />,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => `${row.evidence} ${row.nextStep}`,
                  render: row => <span className={row.status === 'Blocked' ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedExecutiveGoNoGoItem ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Decision Evidence</p>
                      <h2>{selectedExecutiveGoNoGoItem.title}</h2>
                    </div>
                    <StatusPill label={selectedExecutiveGoNoGoItem.status} tone={getExecutiveGoNoGoTone(selectedExecutiveGoNoGoItem.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Decision</span><strong>{executiveGoNoGoRoom.decision}</strong></div>
                    <div><span>Readiness</span><strong>{executiveGoNoGoRoom.readinessScore}% / {executiveGoNoGoRoom.launchStatus}</strong></div>
                    <div><span>Required Clear</span><strong>{executiveGoNoGoRoom.requiredClearCount}/{executiveGoNoGoRoom.requiredCount}</strong></div>
                    <div><span>Blockers</span><strong>{executiveGoNoGoRoom.blockedCount}</strong></div>
                    <div><span>Conditions</span><strong>{executiveGoNoGoRoom.conditionCount}</strong></div>
                    <div><span>Source</span><strong>{selectedExecutiveGoNoGoItem.category}</strong></div>
                    <div><span>Reference</span><strong>{selectedExecutiveGoNoGoItem.reference}</strong></div>
                    <div><span>Owner</span><strong>{selectedExecutiveGoNoGoItem.owner}</strong></div>
                    <div><span>Required</span><strong>{selectedExecutiveGoNoGoItem.required ? 'Yes' : 'No'}</strong></div>
                    <div><span>Audit</span><strong>{selectedExecutiveGoNoGoItem.auditBacked ? 'Backed' : 'Needs Audit'}</strong></div>
                    <div><span>Updated</span><strong>{formatDateTime(selectedExecutiveGoNoGoItem.updatedAt)}</strong></div>
                    <div><span>Latest Record</span><strong>{executiveGoNoGoRoom.latestRecord ? `${executiveGoNoGoRoom.latestRecord.decision} / ${formatDateTime(executiveGoNoGoRoom.latestRecord.recordedAt)}` : 'Pending'}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Evidence</h3>
                    <p className={selectedExecutiveGoNoGoItem.status === 'Blocked' ? 'warning-copy' : 'muted-copy'}>{selectedExecutiveGoNoGoItem.evidence}</p>
                    <p className={selectedExecutiveGoNoGoItem.status === 'Clear' ? 'muted-copy' : 'warning-copy'}>{selectedExecutiveGoNoGoItem.nextStep}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Decision Controls</h3>
                    <div className="launch-go-no-go-review-form">
                      <label className="field compact-field">
                        <span>Decision</span>
                        <select value={executiveGoNoGoDecision} onChange={event => setExecutiveGoNoGoDecision(event.target.value as ExecutiveGoNoGoDecision)}>
                          {executiveGoNoGoDecisions.map(decision => <option key={decision} value={decision}>{decision}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Owner</span>
                        <select value={executiveGoNoGoOwner} onChange={event => setExecutiveGoNoGoOwner(event.target.value)}>
                          {Array.from(new Set(['Owner', 'Admin', 'Engineering', 'Operations', ...executiveGoNoGoRoom.ownerGroups.map(group => group.owner)])).map(owner => <option key={owner} value={owner}>{owner}</option>)}
                        </select>
                      </label>

                      <label className="field compact-field">
                        <span>Condition Note</span>
                        <textarea
                          value={executiveGoNoGoConditionNote}
                          onChange={event => setExecutiveGoNoGoConditionNote(event.target.value)}
                          placeholder="Record final conditions, blocker reason, approval context, or follow-up ownership."
                        />
                      </label>

                      <label className="field compact-field">
                        <span>Accepted Risk</span>
                        <textarea
                          value={executiveGoNoGoAcceptedRisk}
                          onChange={event => setExecutiveGoNoGoAcceptedRisk(event.target.value)}
                          placeholder="Record accepted risk, or state that no launch risk is accepted while held."
                        />
                      </label>
                    </div>

                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canRecordExecutiveGoNoGo} onClick={() => recordExecutiveGoNoGoDecision()}>
                        <UserCheck size={15} strokeWidth={1.8} />
                        Record Suggested
                      </button>
                      <button className="ghost-action" disabled={!canRecordExecutiveGoNoGo} onClick={() => recordExecutiveGoNoGoDecision('Go')}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Go
                      </button>
                      <button className="ghost-action" disabled={!canRecordExecutiveGoNoGo} onClick={() => recordExecutiveGoNoGoDecision('Conditional Go')}>
                        <ClipboardCheck size={15} strokeWidth={1.8} />
                        Conditional
                      </button>
                      <button className="ghost-action" disabled={!canRecordExecutiveGoNoGo} onClick={() => recordExecutiveGoNoGoDecision('No Go')}>
                        <AlertTriangle size={15} strokeWidth={1.8} />
                        No Go
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={exportExecutiveGoNoGoRoom}>
                        <Download size={15} strokeWidth={1.8} />
                        Export
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No executive decision evidence item selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Go / No-Go Source Coverage"
            rows={executiveGoNoGoRoom.sourceGroups}
            pageSize={8}
            emptyTitle="No executive decision source coverage is available."
            columns={[
              {
                key: 'category',
                header: 'Source',
                sortable: true,
                searchValue: row => row.category,
                render: row => <div><strong>{row.category}</strong><span className="cell-subtext">{row.total} evidence items</span></div>,
              },
              {
                key: 'clear',
                header: 'Clear',
                sortable: true,
                searchValue: row => String(row.clear),
                render: row => row.clear,
              },
              {
                key: 'conditions',
                header: 'Conditions',
                sortable: true,
                searchValue: row => String(row.conditions),
                render: row => row.conditions,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'required',
                header: 'Required Open',
                sortable: true,
                searchValue: row => String(row.requiredOpen),
                render: row => row.requiredOpen,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Go / No-Go Owner Load"
            rows={executiveGoNoGoRoom.ownerGroups}
            pageSize={6}
            emptyTitle="No executive decision owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} evidence items / {row.requiredOpen} required open</span></div>,
              },
              {
                key: 'clear',
                header: 'Clear',
                sortable: true,
                searchValue: row => String(row.clear),
                render: row => row.clear,
              },
              {
                key: 'conditions',
                header: 'Conditions',
                sortable: true,
                searchValue: row => String(row.conditions),
                render: row => row.conditions,
              },
              {
                key: 'blocked',
                header: 'Blocked',
                sortable: true,
                searchValue: row => String(row.blocked),
                render: row => row.blocked,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Executive Go / No-Go Decision Ledger"
            rows={executiveGoNoGoRecords}
            pageSize={6}
            emptyTitle="No executive Go / No-Go decisions have been recorded yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'decision',
                header: 'Decision',
                sortable: true,
                searchValue: row => row.decision,
                render: row => <StatusPill label={row.decision} tone={getExecutiveGoNoGoTone(row.decision)} />,
              },
              {
                key: 'score',
                header: 'Score',
                sortable: true,
                searchValue: row => `${row.readinessScore} ${row.launchStatus}`,
                render: row => `${row.readinessScore}% / ${row.launchStatus}`,
              },
              {
                key: 'evidence',
                header: 'Evidence',
                sortable: true,
                searchValue: row => `${row.blockerCount} ${row.conditionCount} ${row.requiredClearCount}/${row.requiredCount}`,
                render: row => <div><strong>{row.requiredClearCount}/{row.requiredCount} required clear</strong><span className="cell-subtext">{row.blockerCount} blocked / {row.conditionCount} conditions</span></div>,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => `${row.owner} ${row.recordedByRole}`,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.recordedByRole}</span></div>,
              },
              {
                key: 'note',
                header: 'Note',
                searchValue: row => `${row.conditionNote} ${row.acceptedRisk}`,
                render: row => <span className="muted-copy">{row.conditionNote}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'warRoom' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="War Room" value={launchWarRoomTimeline.status} delta={launchWarRoomTimeline.summary} tone={getLaunchWarRoomMetricTone(launchWarRoomTimeline.status)} icon={<ScrollText size={16} />} />
            <MetricCard label="Critical" value={String(launchWarRoomTimeline.criticalCount)} delta="Immediate owner attention" tone={launchWarRoomTimeline.criticalCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Action Needed" value={String(launchWarRoomTimeline.actionNeededCount)} delta="Open follow-up" tone={launchWarRoomTimeline.actionNeededCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
            <MetricCard label="Timeline Events" value={String(launchWarRoomTimeline.events.length)} delta="Launch evidence feed" tone={launchWarRoomTimeline.events.length ? 'neutral' : 'warn'} icon={<FileText size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Audit Backed" value={`${launchWarRoomTimeline.auditBackedCount}/${launchWarRoomTimeline.events.length}`} delta="Events with audit ids" tone={launchWarRoomTimeline.auditBackedCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Local Pulses" value={String(launchWarRoomTimeline.pulseCount)} delta={launchWarRoomTimeline.latestPulse ? formatDateTime(launchWarRoomTimeline.latestPulse.recordedAt) : 'No pulse recorded'} tone={launchWarRoomTimeline.latestPulse ? getLaunchWarRoomMetricTone(launchWarRoomTimeline.latestPulse.status) : 'neutral'} icon={<Gauge size={16} />} />
            <MetricCard label="Active Owners" value={String(launchWarRoomTimeline.activeOwnerCount)} delta="Owners with open timeline items" tone={launchWarRoomTimeline.activeOwnerCount ? 'warn' : 'ok'} icon={<UserCheck size={16} />} />
            <MetricCard label="Local Only" value={String(launchWarRoomTimeline.localOnlyCount)} delta="Review artifacts, not production writes" tone="neutral" icon={<ClipboardCheck size={16} />} />
          </div>

          <section className={`panel launch-war-room-panel tone-${getLaunchWarRoomMetricTone(launchWarRoomTimeline.status)}`}>
            <div>
              <p className="eyebrow">Launch War Room Timeline</p>
              <h2>{launchWarRoomTimeline.summary}</h2>
              <span>Generated {formatDateTime(launchWarRoomTimeline.generatedAt)} from launch blockers, evidence ledger, audit events, action queue, dry runs, sign-offs, packets, closure snapshots, approvals, watch checks, backend records, guardrails, and executive decisions.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={launchWarRoomTimeline.status} tone={getLaunchWarRoomTone(launchWarRoomTimeline.status)} />
              <strong>{launchWarRoomTimeline.nextEvent?.title ?? 'No open war-room event'}</strong>
              <button className="ghost-action" disabled={!canRecordWarRoomPulse} onClick={recordLaunchWarRoomPulse}>
                <Gauge size={15} strokeWidth={1.8} />
                Record Pulse
              </button>
              <button className="ghost-action" disabled={!canExport} onClick={exportLaunchWarRoomTimeline}>
                <Download size={15} strokeWidth={1.8} />
                Export Timeline
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">War Room Boundary</p>
              <h2>Timeline pulses are evidence, not execution</h2>
              <span>{launchWarRoomBoundaryRule}</span>
              <span>The feed is for coordination and accountability. Production follow-up still requires permissioned workflows, human confirmation where required, server-side handlers, rollback notes, and audit records.</span>
            </div>
            <StatusPill label={canRecordWarRoomPulse ? 'Pulse recording enabled' : 'Read only'} tone={canRecordWarRoomPulse ? 'ok' : 'warn'} />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Launch War Room Timeline"
              rows={launchWarRoomTimeline.events}
              pageSize={12}
              emptyTitle="No launch war room timeline events are available."
              columns={[
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getLaunchWarRoomTone(row.status)} />,
                },
                {
                  key: 'event',
                  header: 'Event',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.evidence} ${row.nextStep}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedWarRoomEventId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'lane',
                  header: 'Lane',
                  sortable: true,
                  searchValue: row => `${row.lane} ${row.source} ${row.reference}`,
                  render: row => <div><strong>{row.lane}</strong><span className="cell-subtext">{row.source}</span></div>,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => `${row.owner} ${row.actorRole ?? ''}`,
                  render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.actorRole ?? 'Owner pending'}</span></div>,
                },
                {
                  key: 'audit',
                  header: 'Audit',
                  sortable: true,
                  searchValue: row => row.auditEventId ?? 'No audit id',
                  render: row => <StatusPill label={row.auditEventId ? 'Audit Backed' : 'Local Evidence'} tone={row.auditEventId ? 'ok' : 'warn'} />,
                },
                {
                  key: 'time',
                  header: 'Time',
                  sortable: true,
                  searchValue: row => row.occurredAt,
                  render: row => formatDateTime(row.occurredAt),
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className={row.status === 'Critical' ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedWarRoomEvent ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">War Room Event</p>
                      <h2>{selectedWarRoomEvent.title}</h2>
                    </div>
                    <StatusPill label={selectedWarRoomEvent.status} tone={getLaunchWarRoomTone(selectedWarRoomEvent.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Lane</span><strong>{selectedWarRoomEvent.lane}</strong></div>
                    <div><span>Source</span><strong>{selectedWarRoomEvent.source}</strong></div>
                    <div><span>Reference</span><strong>{selectedWarRoomEvent.reference}</strong></div>
                    <div><span>Owner</span><strong>{selectedWarRoomEvent.owner}</strong></div>
                    <div><span>Actor</span><strong>{selectedWarRoomEvent.actor ?? 'Pending'}</strong></div>
                    <div><span>Actor Role</span><strong>{selectedWarRoomEvent.actorRole ?? 'Pending'}</strong></div>
                    <div><span>Occurred</span><strong>{formatDateTime(selectedWarRoomEvent.occurredAt)}</strong></div>
                    <div><span>Audit Event</span><strong>{selectedWarRoomEvent.auditEventId ?? 'Local evidence only'}</strong></div>
                    <div><span>Local Only</span><strong>{selectedWarRoomEvent.localOnly ? 'Yes' : 'No'}</strong></div>
                    <div><span>Pulse Count</span><strong>{launchWarRoomTimeline.pulseCount}</strong></div>
                    <div><span>Critical</span><strong>{launchWarRoomTimeline.criticalCount}</strong></div>
                    <div><span>Action Needed</span><strong>{launchWarRoomTimeline.actionNeededCount}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Evidence</h3>
                    <p className={selectedWarRoomEvent.status === 'Critical' ? 'warning-copy' : 'muted-copy'}>{selectedWarRoomEvent.evidence}</p>
                    <p className={selectedWarRoomEvent.status === 'Verified' ? 'muted-copy' : 'warning-copy'}>{selectedWarRoomEvent.nextStep}</p>
                  </div>

                  <div className="detail-section">
                    <h3>War Room Actions</h3>
                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canRecordWarRoomPulse} onClick={recordLaunchWarRoomPulse}>
                        <Gauge size={15} strokeWidth={1.8} />
                        Record Pulse
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={exportLaunchWarRoomTimeline}>
                        <Download size={15} strokeWidth={1.8} />
                        Export Timeline
                      </button>
                      <button className="ghost-action" onClick={onOpenActionRequests}>
                        <ListChecks size={15} strokeWidth={1.8} />
                        Action Queue
                      </button>
                    </div>
                    <p className="muted-copy">{launchWarRoomBoundaryRule}</p>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No war room event selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="War Room Lane Coverage"
            rows={launchWarRoomTimeline.laneGroups}
            pageSize={8}
            emptyTitle="No war room lane coverage is available."
            columns={[
              {
                key: 'lane',
                header: 'Lane',
                sortable: true,
                searchValue: row => row.lane,
                render: row => <div><strong>{row.lane}</strong><span className="cell-subtext">{row.total} events / latest {formatDateTime(row.latestAt)}</span></div>,
              },
              {
                key: 'critical',
                header: 'Critical',
                sortable: true,
                searchValue: row => String(row.critical),
                render: row => row.critical,
              },
              {
                key: 'action',
                header: 'Action Needed',
                sortable: true,
                searchValue: row => String(row.actionNeeded),
                render: row => row.actionNeeded,
              },
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => String(row.recorded),
                render: row => row.recorded,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="War Room Owner Load"
            rows={launchWarRoomTimeline.ownerGroups}
            pageSize={8}
            emptyTitle="No war room owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} events / latest {formatDateTime(row.latestAt)}</span></div>,
              },
              {
                key: 'critical',
                header: 'Critical',
                sortable: true,
                searchValue: row => String(row.critical),
                render: row => row.critical,
              },
              {
                key: 'action',
                header: 'Action Needed',
                sortable: true,
                searchValue: row => String(row.actionNeeded),
                render: row => row.actionNeeded,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="War Room Pulse Ledger"
            rows={launchWarRoomPulseRecords}
            pageSize={6}
            emptyTitle="No launch war room pulses have been recorded yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchWarRoomTone(row.status)} />,
              },
              {
                key: 'counts',
                header: 'Counts',
                sortable: true,
                searchValue: row => `${row.criticalCount} ${row.actionNeededCount} ${row.verifiedCount}`,
                render: row => <div><strong>{row.criticalCount} critical / {row.actionNeededCount} action</strong><span className="cell-subtext">{row.verifiedCount} verified / {row.recordedCount} recorded</span></div>,
              },
              {
                key: 'latest',
                header: 'Latest Event',
                sortable: true,
                searchValue: row => `${row.latestEventTitle} ${row.latestEventStatus}`,
                render: row => <div><strong>{row.latestEventTitle}</strong><span className="cell-subtext">{row.latestEventStatus}</span></div>,
              },
              {
                key: 'actor',
                header: 'Actor',
                sortable: true,
                searchValue: row => `${row.recordedBy} ${row.recordedByRole}`,
                render: row => <div><strong>{row.recordedByRole}</strong><span className="cell-subtext">{row.recordedBy}</span></div>,
              },
              {
                key: 'summary',
                header: 'Summary',
                searchValue: row => row.summary,
                render: row => <span className="muted-copy">{row.summary}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'savedViews' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Saved View Status" value={launchCommandSavedViews.status} delta={launchCommandSavedViews.summary} tone={getLaunchSavedViewMetricTone(launchCommandSavedViews.status)} icon={<Search size={16} />} />
            <MetricCard label="Critical Results" value={String(launchCommandSavedViews.criticalResultCount)} delta="Across command views" tone={launchCommandSavedViews.criticalResultCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Action Needed" value={String(launchCommandSavedViews.actionNeededResultCount)} delta="Filtered launch results" tone={launchCommandSavedViews.actionNeededResultCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
            <MetricCard label="Active Owners" value={String(launchCommandSavedViews.activeOwnerCount)} delta="Open saved-view workload" tone={launchCommandSavedViews.activeOwnerCount ? 'warn' : 'ok'} icon={<UserCheck size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Views" value={String(launchCommandSavedViews.views.length)} delta={`${launchCommandSavedViews.blockedViewCount} blocked / ${launchCommandSavedViews.reviewViewCount} review`} tone={launchCommandSavedViews.blockedViewCount ? 'danger' : launchCommandSavedViews.reviewViewCount ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
            <MetricCard label="Audit Backed" value={String(launchCommandSavedViews.auditBackedResultCount)} delta="Results with audit proof" tone={launchCommandSavedViews.auditBackedResultCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Saved Records" value={String(launchCommandSavedViews.savedRecordCount)} delta={launchCommandSavedViews.latestRecord ? formatDateTime(launchCommandSavedViews.latestRecord.recordedAt) : 'No local save yet'} tone={launchCommandSavedViews.savedRecordCount ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
            <MetricCard label="Production Writes" value="0" delta="Local filter contracts only" tone="ok" icon={<DatabaseZap size={16} />} />
          </div>

          <section className={`panel saved-view-status-panel tone-${getLaunchCommandSavedViewTone(launchCommandSavedViews.status)}`}>
            <div>
              <p className="eyebrow">Launch Command Search</p>
              <h2>{launchCommandSavedViews.summary}</h2>
              <span>Generated {formatDateTime(launchCommandSavedViews.generatedAt)} from Command Mode, War Room, executive Go / No-Go, backend closure, production guardrails, follow-up, and evidence ledgers.</span>
            </div>
            <div className="saved-view-status-meta">
              <StatusPill label={launchCommandSavedViews.status} tone={getLaunchCommandSavedViewTone(launchCommandSavedViews.status)} />
              <strong>{launchCommandSavedViews.totalResultCount} results</strong>
            </div>
          </section>

          <section className="panel saved-view-boundary-panel">
            <div>
              <p className="eyebrow">Saved View Boundary</p>
              <h2>Saved views are filters, not execution</h2>
              <span>{launchCommandSavedViewBoundaryRule}</span>
            </div>
            <StatusPill label={canSaveLaunchSavedViews ? 'Local saves enabled' : 'Read only'} tone={canSaveLaunchSavedViews ? 'ok' : 'warn'} />
          </section>

          <div className="timeline-filter-bar" aria-label="Launch saved view quick filters">
            {launchCommandSavedViews.views.map(view => (
              <button
                key={view.id}
                className={selectedSavedView?.id === view.id ? 'selected' : ''}
                onClick={() => setSelectedSavedViewId(view.id)}
              >
                {view.scope}
                <span>{view.resultCount}</span>
              </button>
            ))}
          </div>

          <div className="saved-views-layout">
            <DataTable
              label="Launch Command Saved Views"
              rows={launchCommandSavedViews.views}
              pageSize={8}
              emptyTitle="No launch command saved views are available."
              columns={[
                {
                  key: 'view',
                  header: 'View',
                  sortable: true,
                  searchValue: row => `${row.name} ${row.description} ${row.queryHint}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedSavedViewId(row.id)}>
                      {row.name}
                    </button>
                  ),
                },
                {
                  key: 'scope',
                  header: 'Scope',
                  sortable: true,
                  searchValue: row => row.scope,
                  render: row => row.scope,
                },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => row.status,
                  render: row => <StatusPill label={row.status} tone={getLaunchCommandSavedViewTone(row.status)} />,
                },
                {
                  key: 'results',
                  header: 'Results',
                  sortable: true,
                  searchValue: row => `${row.resultCount} ${row.criticalCount} ${row.actionNeededCount}`,
                  render: row => <div><strong>{row.resultCount} results</strong><span className="cell-subtext">{row.criticalCount} critical / {row.actionNeededCount} action</span></div>,
                },
                {
                  key: 'audit',
                  header: 'Audit',
                  sortable: true,
                  searchValue: row => String(row.auditBackedCount),
                  render: row => <StatusPill label={`${row.auditBackedCount} backed`} tone={row.auditBackedCount ? 'ok' : 'warn'} />,
                },
                {
                  key: 'surface',
                  header: 'Surface',
                  sortable: true,
                  searchValue: row => getLaunchSavedViewSurfaceLabel(row.defaultSurface),
                  render: row => getLaunchSavedViewSurfaceLabel(row.defaultSurface),
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className={row.status === 'Blocked' ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel saved-view-detail-panel">
              {selectedSavedView ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Saved View Detail</p>
                      <h2>{selectedSavedView.name}</h2>
                    </div>
                    <StatusPill label={selectedSavedView.status} tone={getLaunchCommandSavedViewTone(selectedSavedView.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Scope</span><strong>{selectedSavedView.scope}</strong></div>
                    <div><span>Audience</span><strong>{selectedSavedView.audience}</strong></div>
                    <div><span>Surface</span><strong>{getLaunchSavedViewSurfaceLabel(selectedSavedView.defaultSurface)}</strong></div>
                    <div><span>Query Hint</span><strong>{selectedSavedView.queryHint}</strong></div>
                    <div><span>Results</span><strong>{selectedSavedView.resultCount}</strong></div>
                    <div><span>Critical</span><strong>{selectedSavedView.criticalCount}</strong></div>
                    <div><span>Action Needed</span><strong>{selectedSavedView.actionNeededCount}</strong></div>
                    <div><span>Audit Backed</span><strong>{selectedSavedView.auditBackedCount}</strong></div>
                    <div><span>Owners</span><strong>{selectedSavedView.ownerCount}</strong></div>
                    <div><span>Latest</span><strong>{formatDateTime(selectedSavedView.latestAt)}</strong></div>
                  </div>

                  <section className={`panel saved-view-status-panel tone-${getLaunchCommandSavedViewTone(selectedSavedView.status)}`}>
                    <div>
                      <p className="eyebrow">Apply Readiness</p>
                      <h2>{selectedSavedView.status === 'Blocked' ? 'Owner attention needed' : selectedSavedView.status === 'Review' ? 'Review queue ready' : 'View is clear'}</h2>
                      <span>{selectedSavedView.description}</span>
                    </div>
                    <div className="saved-view-status-meta">
                      <StatusPill label={canViewSavedViews ? 'Permission available' : 'Permission missing'} tone={canViewSavedViews ? 'ok' : 'warn'} />
                      <strong>{selectedSavedView.cadence}</strong>
                    </div>
                  </section>

                  <div className="detail-section">
                    <h3>Filters</h3>
                    <div className="saved-view-filter-grid">
                      {selectedSavedView.filters.map(filter => (
                        <div key={`${filter.label}-${filter.value}`}>
                          <span>{filter.label}</span>
                          <strong>{filter.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Columns</h3>
                    <div className="adapter-chip-grid">
                      {selectedSavedView.columns.map(column => <span key={column}>{column}</span>)}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Operating Contract</h3>
                    <div className="settings-rule-list">
                      <div><Search size={16} strokeWidth={1.8} /><strong>Sort: {selectedSavedView.sort}</strong></div>
                      <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Local filter contract only; no production write path.</strong></div>
                      <div><ListChecks size={16} strokeWidth={1.8} /><strong>{selectedSavedView.nextStep}</strong></div>
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Action Panel</h3>
                    <div className="support-actions">
                      <button className="ghost-action" disabled={!canViewSavedViews} onClick={() => openLaunchSavedView(selectedSavedView)}>
                        <Search size={15} strokeWidth={1.8} />
                        Open Surface
                      </button>
                      <button className="ghost-action" disabled={!canSaveLaunchSavedViews} onClick={() => recordLaunchSavedView(selectedSavedView)}>
                        <ClipboardCheck size={15} strokeWidth={1.8} />
                        Save View
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={() => exportLaunchSavedView(selectedSavedView)}>
                        <Download size={15} strokeWidth={1.8} />
                        Export View
                      </button>
                      <span className="muted-copy">Every save, apply, and export runs permission checks and writes audit evidence.</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No launch saved view selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Saved View Results"
            rows={selectedSavedView?.results ?? []}
            pageSize={10}
            emptyTitle="This launch saved view is clear for the current review model."
            columns={[
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchCommandSavedViewTone(row.status)} />,
              },
              {
                key: 'result',
                header: 'Result',
                sortable: true,
                searchValue: row => `${row.title} ${row.evidence} ${row.nextStep}`,
                render: row => <div><strong>{row.title}</strong><span className="cell-subtext">{row.reference}</span></div>,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => `${row.owner} ${row.source}`,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.source}</span></div>,
              },
              {
                key: 'audit',
                header: 'Audit',
                sortable: true,
                searchValue: row => row.auditBacked ? 'Audit Backed' : 'Local Evidence',
                render: row => <StatusPill label={row.auditBacked ? 'Audit Backed' : 'Local Evidence'} tone={row.auditBacked ? 'ok' : 'warn'} />,
              },
              {
                key: 'surface',
                header: 'Surface',
                sortable: true,
                searchValue: row => getLaunchSavedViewSurfaceLabel(row.surface),
                render: row => getLaunchSavedViewSurfaceLabel(row.surface),
              },
              {
                key: 'updated',
                header: 'Updated',
                sortable: true,
                searchValue: row => row.updatedAt,
                render: row => formatDateTime(row.updatedAt),
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className={row.status === 'Critical' ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Saved View Ledger"
            rows={launchSavedViewRecords}
            pageSize={6}
            emptyTitle="No launch saved views have been saved locally yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'view',
                header: 'View',
                sortable: true,
                searchValue: row => `${row.viewName} ${row.scope}`,
                render: row => <div><strong>{row.viewName}</strong><span className="cell-subtext">{row.scope}</span></div>,
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchCommandSavedViewTone(row.status)} />,
              },
              {
                key: 'counts',
                header: 'Counts',
                sortable: true,
                searchValue: row => `${row.resultCount} ${row.criticalCount} ${row.actionNeededCount}`,
                render: row => <div><strong>{row.resultCount} results</strong><span className="cell-subtext">{row.criticalCount} critical / {row.actionNeededCount} action</span></div>,
              },
              {
                key: 'actor',
                header: 'Actor',
                sortable: true,
                searchValue: row => `${row.recordedBy} ${row.recordedByRole}`,
                render: row => <div><strong>{row.recordedByRole}</strong><span className="cell-subtext">{row.recordedBy}</span></div>,
              },
              {
                key: 'audit',
                header: 'Audit Event',
                sortable: true,
                searchValue: row => row.auditEventId,
                render: row => <span className="muted-copy">{row.auditEventId}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'exceptionSla' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="SLA Status" value={launchExceptionSlaBoard.status} delta={launchExceptionSlaBoard.summary} tone={getLaunchExceptionSlaStatusTone(launchExceptionSlaBoard.status)} icon={<AlarmClock size={16} />} />
            <MetricCard label="Overdue" value={String(launchExceptionSlaBoard.overdueCount)} delta="Past owner window" tone={launchExceptionSlaBoard.overdueCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Due Soon" value={String(launchExceptionSlaBoard.dueSoonCount)} delta="Inside launch warning window" tone={launchExceptionSlaBoard.dueSoonCount ? 'warn' : 'ok'} icon={<Clock3 size={16} />} />
            <MetricCard label="Active Owners" value={String(launchExceptionSlaBoard.activeOwnerCount)} delta="Open SLA owners" tone={launchExceptionSlaBoard.activeOwnerCount ? 'warn' : 'ok'} icon={<UserCheck size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Action Handoffs" value={String(launchExceptionSlaBoard.actionHandoffCount)} delta="Queueable governed reviews" tone={launchExceptionSlaBoard.actionHandoffCount ? 'warn' : 'ok'} icon={<GitBranch size={16} />} />
            <MetricCard label="Executive Review" value={String(launchExceptionSlaBoard.executiveReviewCount)} delta="Owner-visible escalation" tone={launchExceptionSlaBoard.executiveReviewCount ? 'danger' : 'ok'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Audit Backed" value={String(launchExceptionSlaBoard.auditBackedCount)} delta="SLA items with audit proof" tone={launchExceptionSlaBoard.auditBackedCount ? 'ok' : 'warn'} icon={<ScrollText size={16} />} />
            <MetricCard label="Review Records" value={String(launchExceptionSlaBoard.recordCount)} delta={launchExceptionSlaBoard.latestRecord ? formatDateTime(launchExceptionSlaBoard.latestRecord.recordedAt) : 'No SLA review yet'} tone={launchExceptionSlaBoard.recordCount ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
          </div>

          <section className={`panel sla-board-status-panel tone-${getLaunchExceptionSlaStatusTone(launchExceptionSlaBoard.status)}`}>
            <div>
              <p className="eyebrow">Launch Exception SLA Board</p>
              <h2>{launchExceptionSlaBoard.summary}</h2>
              <span>Generated {formatDateTime(launchExceptionSlaBoard.generatedAt)} from Launch Command, War Room, Saved Views, Follow-Up, Go / No-Go, backend closure, and production guardrail exceptions.</span>
            </div>
            <div className="sla-board-status-meta">
              <StatusPill label={launchExceptionSlaBoard.status} tone={getLaunchExceptionSlaStatusTone(launchExceptionSlaBoard.status)} />
              <strong>{launchExceptionSlaBoard.totalCount} items</strong>
            </div>
          </section>

          <section className="panel sla-board-boundary-panel">
            <div>
              <p className="eyebrow">SLA Boundary</p>
              <h2>The board coordinates ownership and escalation</h2>
              <span>{launchExceptionSlaBoundaryRule}</span>
            </div>
            <div className="support-actions">
              <StatusPill label={canReviewLaunchSla ? 'Review enabled' : 'Read only'} tone={canReviewLaunchSla ? 'ok' : 'warn'} />
              <button className="ghost-action" disabled={!canExport} onClick={exportLaunchExceptionSlaBoard}>
                <Download size={15} strokeWidth={1.8} />
                Export Board
              </button>
            </div>
          </section>

          <div className="timeline-filter-bar" aria-label="Launch exception SLA owner filters">
            {exceptionSlaOwnerOptions.map(owner => (
              <button
                key={owner}
                className={exceptionSlaOwnerFilter === owner ? 'selected' : ''}
                onClick={() => {
                  setExceptionSlaOwnerFilter(owner)
                  setSelectedExceptionSlaItemId('')
                }}
              >
                {owner}
                <span>{owner === 'All' ? launchExceptionSlaBoard.items.length : launchExceptionSlaBoard.items.filter(item => item.owner === owner).length}</span>
              </button>
            ))}
          </div>

          <div className="sla-board-layout">
            <DataTable
              label="Launch Exception SLA Queue"
              rows={exceptionSlaItems}
              pageSize={10}
              emptyTitle="No launch exception SLA items match this owner."
              columns={[
                {
                  key: 'item',
                  header: 'Item',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.description} ${row.reference}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedExceptionSlaItemId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'status',
                  header: 'SLA',
                  sortable: true,
                  searchValue: row => launchSlaStatusSortValue(row.status),
                  render: row => <StatusPill label={row.status} tone={getLaunchExceptionSlaStatusTone(row.status)} />,
                },
                {
                  key: 'level',
                  header: 'Level',
                  sortable: true,
                  searchValue: row => row.level,
                  render: row => <StatusPill label={row.level} tone={getLaunchExceptionSlaLevelTone(row.level)} />,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => `${row.owner} ${row.source}`,
                  render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.source}</span></div>,
                },
                {
                  key: 'due',
                  header: 'Due',
                  sortable: true,
                  searchValue: row => row.dueAt,
                  render: row => <span className={row.status === 'Overdue' ? 'danger-copy' : undefined}>{formatDateTime(row.dueAt)}</span>,
                },
                {
                  key: 'review',
                  header: 'Review',
                  sortable: true,
                  searchValue: row => row.reviewStatus,
                  render: row => <StatusPill label={row.reviewStatus} tone={getLaunchExceptionSlaReviewTone(row.reviewStatus)} />,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className={row.status === 'Overdue' ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel sla-board-detail-panel">
              {selectedExceptionSlaItem ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Launch SLA Detail</p>
                      <h2>{selectedExceptionSlaItem.title}</h2>
                    </div>
                    <StatusPill label={selectedExceptionSlaItem.status} tone={getLaunchExceptionSlaStatusTone(selectedExceptionSlaItem.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Owner</span><strong>{selectedExceptionSlaItem.owner}</strong></div>
                    <div><span>Priority</span><strong>{selectedExceptionSlaItem.priority}</strong></div>
                    <div><span>Level</span><strong>{selectedExceptionSlaItem.level}</strong></div>
                    <div><span>SLA</span><strong>{formatLaunchSlaDuration(selectedExceptionSlaItem.slaMinutes)}</strong></div>
                    <div><span>Remaining</span><strong>{formatLaunchSlaRemaining(selectedExceptionSlaItem.minutesRemaining)}</strong></div>
                    <div><span>Source</span><strong>{selectedExceptionSlaItem.source}</strong></div>
                    <div><span>Reference</span><strong>{selectedExceptionSlaItem.reference}</strong></div>
                    <div><span>Target</span><strong>{getLaunchSavedViewSurfaceLabel(selectedExceptionSlaItem.defaultSurface)}</strong></div>
                    <div><span>Audit</span><strong>{selectedExceptionSlaItem.auditBacked ? 'Audit backed' : 'Local evidence'}</strong></div>
                    <div><span>Review</span><strong>{selectedExceptionSlaItem.reviewStatus}</strong></div>
                  </div>

                  <section className={`panel sla-board-status-panel tone-${getLaunchExceptionSlaStatusTone(selectedExceptionSlaItem.status)}`}>
                    <div>
                      <p className="eyebrow">SLA Progress</p>
                      <h2>{selectedExceptionSlaItem.description}</h2>
                      <span>{formatLaunchSlaRemaining(selectedExceptionSlaItem.minutesRemaining)} / {selectedExceptionSlaItem.reference}</span>
                    </div>
                    <div className="sla-board-status-meta">
                      <StatusPill label={selectedExceptionSlaItem.level} tone={getLaunchExceptionSlaLevelTone(selectedExceptionSlaItem.level)} />
                      <strong>{selectedExceptionSlaItem.progress}% elapsed</strong>
                    </div>
                  </section>

                  <div className="sla-progress-shell" aria-label="Launch SLA progress">
                    <span style={{ width: `${selectedExceptionSlaItem.progress}%` }} />
                  </div>

                  <div className="detail-section">
                    <h3>Escalation Path</h3>
                    <div className="watch-rule-escalation-list">
                      {selectedExceptionSlaItem.escalationSteps.map(step => (
                        <div key={`${step.label}-${step.owner}-${step.dueAt}`}>
                          <span>{formatDateTime(step.dueAt)}</span>
                          <strong>{step.owner} / {step.label}</strong>
                          <p>{step.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Evidence</h3>
                    <div className="settings-rule-list">
                      {selectedExceptionSlaItem.evidence.map(item => (
                        <div key={item}><ScrollText size={16} strokeWidth={1.8} /><strong>{item}</strong></div>
                      ))}
                    </div>
                  </div>

                  {selectedExceptionSlaItem.localNote && (
                    <div className="detail-section">
                      <h3>Local Note</h3>
                      <p className="muted-copy">{selectedExceptionSlaItem.localNote}</p>
                    </div>
                  )}

                  <div className="detail-section">
                    <h3>Action Panel</h3>
                    <div className="support-actions">
                      <button className="ghost-action" onClick={() => openLaunchExceptionSlaSurface(selectedExceptionSlaItem)}>
                        <Search size={15} strokeWidth={1.8} />
                        Open Target
                      </button>
                      <button className="ghost-action" disabled={!canReviewLaunchSla} onClick={() => recordLaunchExceptionSlaReview(selectedExceptionSlaItem, 'Reviewed')}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Review
                      </button>
                      <button className="ghost-action" disabled={!canReviewLaunchSla} onClick={() => recordLaunchExceptionSlaReview(selectedExceptionSlaItem, 'Escalated')}>
                        <AlarmClock size={15} strokeWidth={1.8} />
                        Escalate Owner
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueLaunchExceptionSlaHandoff(selectedExceptionSlaItem)}>
                        <GitBranch size={15} strokeWidth={1.8} />
                        Queue Handoff
                      </button>
                      <button className="ghost-action" onClick={onOpenActionRequests}>
                        <ListChecks size={15} strokeWidth={1.8} />
                        Action Queue
                      </button>
                      <span className="muted-copy">Reviews and handoffs are audit-recorded. Production changes still require approved server-side handlers.</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No launch SLA item selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Launch SLA Owner Load"
            rows={launchExceptionSlaBoard.ownerGroups}
            pageSize={8}
            emptyTitle="No launch SLA owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} SLA items</span></div>,
              },
              {
                key: 'overdue',
                header: 'Overdue',
                sortable: true,
                searchValue: row => String(row.overdue),
                render: row => row.overdue,
              },
              {
                key: 'due',
                header: 'Due Soon',
                sortable: true,
                searchValue: row => String(row.dueSoon),
                render: row => row.dueSoon,
              },
              {
                key: 'handoff',
                header: 'Handoffs',
                sortable: true,
                searchValue: row => String(row.actionHandoff),
                render: row => row.actionHandoff,
              },
              {
                key: 'executive',
                header: 'Executive',
                sortable: true,
                searchValue: row => String(row.executiveReview),
                render: row => row.executiveReview,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className={row.overdue ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Launch SLA Review Ledger"
            rows={launchExceptionSlaRecords}
            pageSize={6}
            emptyTitle="No launch SLA reviews have been recorded yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'item',
                header: 'Item',
                sortable: true,
                searchValue: row => `${row.itemTitle} ${row.owner}`,
                render: row => <div><strong>{row.itemTitle}</strong><span className="cell-subtext">{row.owner}</span></div>,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => row.reviewStatus,
                render: row => <StatusPill label={row.reviewStatus} tone={getLaunchExceptionSlaReviewTone(row.reviewStatus)} />,
              },
              {
                key: 'level',
                header: 'Level',
                sortable: true,
                searchValue: row => row.level,
                render: row => <StatusPill label={row.level} tone={getLaunchExceptionSlaLevelTone(row.level)} />,
              },
              {
                key: 'actor',
                header: 'Actor',
                sortable: true,
                searchValue: row => `${row.recordedBy} ${row.recordedByRole}`,
                render: row => <div><strong>{row.recordedByRole}</strong><span className="cell-subtext">{row.recordedBy}</span></div>,
              },
              {
                key: 'note',
                header: 'Note',
                searchValue: row => row.note,
                render: row => <span className="muted-copy">{row.note}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'ownerBrief' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Brief Status" value={launchOwnerDailyBrief.status} delta={launchOwnerDailyBrief.headline} tone={getLaunchOwnerBriefMetricTone(launchOwnerDailyBrief.status)} icon={<FileText size={16} />} />
            <MetricCard label="Owner Decisions" value={String(launchOwnerDailyBrief.decisionCount)} delta="In today's brief" tone={launchOwnerDailyBrief.decisionCount ? 'warn' : 'ok'} icon={<UserCheck size={16} />} />
            <MetricCard label="Critical" value={String(launchOwnerDailyBrief.criticalCount)} delta="Blocking owner decisions" tone={launchOwnerDailyBrief.criticalCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Active Owners" value={String(launchOwnerDailyBrief.activeOwnerCount)} delta="Need a named response" tone={launchOwnerDailyBrief.activeOwnerCount ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Overdue SLA" value={String(launchOwnerDailyBrief.overdueSlaCount)} delta="Past owner window" tone={launchOwnerDailyBrief.overdueSlaCount ? 'danger' : 'ok'} icon={<AlarmClock size={16} />} />
            <MetricCard label="Action Handoffs" value={String(launchOwnerDailyBrief.actionHandoffCount)} delta="Queueable governed reviews" tone={launchOwnerDailyBrief.actionHandoffCount ? 'warn' : 'ok'} icon={<GitBranch size={16} />} />
            <MetricCard label="Audit Backed" value={String(launchOwnerDailyBrief.auditBackedCount)} delta="Brief decisions with audit proof" tone={launchOwnerDailyBrief.auditBackedCount ? 'ok' : 'warn'} icon={<ScrollText size={16} />} />
            <MetricCard label="Brief Records" value={String(launchOwnerDailyBrief.recordCount)} delta={launchOwnerDailyBrief.latestRecord ? formatDateTime(launchOwnerDailyBrief.latestRecord.recordedAt) : 'No daily brief record'} tone={launchOwnerDailyBrief.recordCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
          </div>

          <section className={`panel launch-brief-panel tone-${getLaunchOwnerBriefMetricTone(launchOwnerDailyBrief.status)}`}>
            <div>
              <p className="eyebrow">Launch Owner Daily Brief</p>
              <h2>{launchOwnerDailyBrief.headline}</h2>
              <span>{launchOwnerDailyBrief.summary}</span>
              <span>Generated {formatDateTime(launchOwnerDailyBrief.generatedAt)} from Launch Gate, Exception SLA, Saved Views, War Room, Go / No-Go, Follow-Up, and Audit evidence.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={launchOwnerDailyBrief.status} tone={getLaunchOwnerDailyBriefStatusTone(launchOwnerDailyBrief.status)} />
              <strong>{launchOwnerDailyBrief.goNoGoDecision}</strong>
              <button className="ghost-action" disabled={!canRecordReview} onClick={recordLaunchOwnerDailyBrief}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Brief
              </button>
              <button className="ghost-action" disabled={!canExport} onClick={exportLaunchOwnerDailyBrief}>
                <Download size={15} strokeWidth={1.8} />
                Export Brief
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Brief Boundary</p>
              <h2>Briefs are communication evidence, not execution</h2>
              <span>{launchOwnerDailyBriefBoundaryRule}</span>
            </div>
            <StatusPill label="No production mutation" tone="ok" />
          </section>

          <DataTable
            label="Owner Brief Sections"
            rows={launchOwnerDailyBrief.sections}
            pageSize={6}
            emptyTitle="No owner brief sections are available."
            columns={[
              {
                key: 'section',
                header: 'Section',
                sortable: true,
                searchValue: row => `${row.label} ${row.headline}`,
                render: row => <div><strong>{row.label}</strong><span className="cell-subtext">{row.count} signals</span></div>,
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => launchOwnerDecisionSortValue(row.status),
                render: row => <StatusPill label={row.status} tone={getLaunchOwnerDailyBriefStatusTone(row.status)} />,
              },
              {
                key: 'headline',
                header: 'Headline',
                sortable: true,
                searchValue: row => row.headline,
                render: row => row.headline,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className={row.status === 'Critical' ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
              },
            ]}
          />

          <div className="launch-readiness-layout">
            <DataTable
              label="Owner Decision Queue"
              rows={launchOwnerDailyBrief.decisions}
              pageSize={10}
              emptyTitle="No owner decisions are open for today's launch brief."
              columns={[
                {
                  key: 'decision',
                  header: 'Decision',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.evidence} ${row.ask}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedOwnerBriefDecisionId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => launchOwnerDecisionSortValue(row.status),
                  render: row => <StatusPill label={row.status} tone={getLaunchOwnerDailyBriefStatusTone(row.status)} />,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => `${row.owner} ${row.source}`,
                  render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.source}</span></div>,
                },
                {
                  key: 'audit',
                  header: 'Audit',
                  sortable: true,
                  searchValue: row => row.auditBacked ? 'Audit backed' : 'Local evidence',
                  render: row => <StatusPill label={row.auditBacked ? 'Audit Backed' : 'Local Evidence'} tone={row.auditBacked ? 'ok' : 'warn'} />,
                },
                {
                  key: 'due',
                  header: 'Due',
                  sortable: true,
                  searchValue: row => row.dueAt,
                  render: row => formatDateTime(row.dueAt),
                },
                {
                  key: 'ask',
                  header: 'Ask',
                  searchValue: row => row.ask,
                  render: row => <span className={row.status === 'Critical' ? 'warning-copy' : 'muted-copy'}>{row.ask}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedOwnerBriefDecision ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Owner Decision</p>
                      <h2>{selectedOwnerBriefDecision.title}</h2>
                    </div>
                    <StatusPill label={selectedOwnerBriefDecision.status} tone={getLaunchOwnerDailyBriefStatusTone(selectedOwnerBriefDecision.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Owner</span><strong>{selectedOwnerBriefDecision.owner}</strong></div>
                    <div><span>Source</span><strong>{selectedOwnerBriefDecision.source}</strong></div>
                    <div><span>Reference</span><strong>{selectedOwnerBriefDecision.reference}</strong></div>
                    <div><span>Surface</span><strong>{getLaunchSavedViewSurfaceLabel(selectedOwnerBriefDecision.surface)}</strong></div>
                    <div><span>Due</span><strong>{formatDateTime(selectedOwnerBriefDecision.dueAt)}</strong></div>
                    <div><span>Audit</span><strong>{selectedOwnerBriefDecision.auditBacked ? 'Audit backed' : 'Local evidence'}</strong></div>
                    <div><span>Local Only</span><strong>{selectedOwnerBriefDecision.localOnly ? 'Yes' : 'No'}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Evidence</h3>
                    <p className={selectedOwnerBriefDecision.status === 'Critical' ? 'warning-copy' : 'muted-copy'}>{selectedOwnerBriefDecision.evidence}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Owner Ask</h3>
                    <p className="warning-copy">{selectedOwnerBriefDecision.ask}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Action Panel</h3>
                    <div className="support-actions">
                      <button className="ghost-action" onClick={() => openOwnerBriefDecisionSurface(selectedOwnerBriefDecision)}>
                        <Search size={15} strokeWidth={1.8} />
                        Open Target
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueOwnerBriefDecisionHandoff(selectedOwnerBriefDecision)}>
                        <GitBranch size={15} strokeWidth={1.8} />
                        Queue Handoff
                      </button>
                      <button className="ghost-action" disabled={!canRecordReview} onClick={recordLaunchOwnerDailyBrief}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Brief
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={exportLaunchOwnerDailyBrief}>
                        <Download size={15} strokeWidth={1.8} />
                        Export Brief
                      </button>
                      <span className="muted-copy">Owner brief actions record communication evidence only. Production changes still require governed server-side execution.</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No owner decision selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Owner Brief Load"
            rows={launchOwnerDailyBrief.ownerLoads}
            pageSize={8}
            emptyTitle="No owner load is available for today's brief."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} decisions</span></div>,
              },
              {
                key: 'critical',
                header: 'Critical',
                sortable: true,
                searchValue: row => String(row.critical),
                render: row => row.critical,
              },
              {
                key: 'action',
                header: 'Action Needed',
                sortable: true,
                searchValue: row => String(row.actionNeeded),
                render: row => row.actionNeeded,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className={row.critical ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Owner Brief Ledger"
            rows={launchOwnerDailyBriefRecords}
            pageSize={6}
            emptyTitle="No owner daily briefs have been recorded yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchOwnerDailyBriefStatusTone(row.status)} />,
              },
              {
                key: 'counts',
                header: 'Counts',
                sortable: true,
                searchValue: row => `${row.decisionCount} ${row.criticalCount} ${row.actionNeededCount}`,
                render: row => <div><strong>{row.decisionCount} decisions</strong><span className="cell-subtext">{row.criticalCount} critical / {row.actionNeededCount} action</span></div>,
              },
              {
                key: 'top',
                header: 'Top Decision',
                sortable: true,
                searchValue: row => row.topDecisionTitle,
                render: row => row.topDecisionTitle,
              },
              {
                key: 'actor',
                header: 'Actor',
                sortable: true,
                searchValue: row => `${row.recordedBy} ${row.recordedByRole}`,
                render: row => <div><strong>{row.recordedByRole}</strong><span className="cell-subtext">{row.recordedBy}</span></div>,
              },
              {
                key: 'audit',
                header: 'Audit Event',
                sortable: true,
                searchValue: row => row.auditEventId,
                render: row => <span className="muted-copy">{row.auditEventId}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'evidencePacket' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Packet Status" value={launchEvidencePacket.status} delta={launchEvidencePacket.headline} tone={getLaunchEvidencePacketMetricTone(launchEvidencePacket.status)} icon={<ClipboardCheck size={16} />} />
            <MetricCard label="Required Satisfied" value={`${launchEvidencePacket.requiredSatisfiedCount}/${launchEvidencePacket.requiredCount}`} delta="Final evidence checklist" tone={launchEvidencePacket.requiredSatisfiedCount === launchEvidencePacket.requiredCount ? 'ok' : 'warn'} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Packet Gaps" value={`${launchEvidencePacket.missingCount}/${launchEvidencePacket.reviewCount}`} delta="Missing / review" tone={launchEvidencePacket.missingCount ? 'danger' : launchEvidencePacket.reviewCount ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Audit Backed" value={`${launchEvidencePacket.auditBackedCount}/${launchEvidencePacket.items.length}`} delta="Evidence items with audit proof" tone={launchEvidencePacket.auditBackedCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Ready Items" value={String(launchEvidencePacket.readyCount)} delta="Prepared for final review" tone={launchEvidencePacket.readyCount ? 'neutral' : 'ok'} icon={<UserCheck size={16} />} />
            <MetricCard label="Verified Items" value={String(launchEvidencePacket.verifiedCount)} delta="Closed evidence rows" tone={launchEvidencePacket.verifiedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Local Evidence" value={String(launchEvidencePacket.localOnlyCount)} delta="Review-only platform records" tone={launchEvidencePacket.localOnlyCount ? 'neutral' : 'ok'} icon={<ScrollText size={16} />} />
            <MetricCard label="Packet Records" value={String(launchEvidencePacket.recordCount)} delta={launchEvidencePacket.latestRecord ? formatDateTime(launchEvidencePacket.latestRecord.recordedAt) : 'No packet record'} tone={launchEvidencePacket.recordCount ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
          </div>

          <section className={`panel launch-brief-panel tone-${getLaunchEvidencePacketMetricTone(launchEvidencePacket.status)}`}>
            <div>
              <p className="eyebrow">Launch Evidence Packet</p>
              <h2>{launchEvidencePacket.headline}</h2>
              <span>{launchEvidencePacket.summary}</span>
              <span>Generated {formatDateTime(launchEvidencePacket.generatedAt)} from Owner Brief, Exception SLA, Go / No-Go, Guardrails, Closure, War Room, Saved Views, Follow-Up, Manifest, and Audit evidence.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={launchEvidencePacket.status} tone={getLaunchEvidencePacketStatusTone(launchEvidencePacket.status)} />
              <strong>{launchEvidencePacket.goNoGoDecision}</strong>
              <button className="ghost-action" disabled={!canRecordReview} onClick={recordLaunchEvidencePacket}>
                <CheckCircle2 size={15} strokeWidth={1.8} />
                Record Packet
              </button>
              <button className="ghost-action" disabled={!canExport} onClick={exportLaunchEvidencePacket}>
                <Download size={15} strokeWidth={1.8} />
                Export Packet
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Packet Boundary</p>
              <h2>Evidence packets assemble proof, they do not execute launch changes</h2>
              <span>{launchEvidencePacketBoundaryRule}</span>
            </div>
            <StatusPill label="No production mutation" tone="ok" />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Launch Evidence Packet Items"
              rows={launchEvidencePacket.items}
              pageSize={11}
              emptyTitle="No launch evidence packet items are available."
              columns={[
                {
                  key: 'item',
                  header: 'Item',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.category} ${row.evidence}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedEvidencePacketItemId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => launchEvidencePacketSortValue(row.status),
                  render: row => <StatusPill label={row.status} tone={getLaunchEvidencePacketItemTone(row.status)} />,
                },
                {
                  key: 'category',
                  header: 'Category',
                  sortable: true,
                  searchValue: row => row.category,
                  render: row => <div><strong>{row.category}</strong><span className="cell-subtext">{row.required ? 'Required' : 'Optional'}</span></div>,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => row.owner,
                  render: row => row.owner,
                },
                {
                  key: 'audit',
                  header: 'Audit',
                  sortable: true,
                  searchValue: row => row.auditBacked ? 'Audit backed' : 'Needs audit',
                  render: row => <StatusPill label={row.auditBacked ? 'Audit Backed' : 'Needs Audit'} tone={row.auditBacked ? 'ok' : 'warn'} />,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className={row.status === 'Missing' ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedEvidencePacketItem ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Packet Item</p>
                      <h2>{selectedEvidencePacketItem.title}</h2>
                    </div>
                    <StatusPill label={selectedEvidencePacketItem.status} tone={getLaunchEvidencePacketItemTone(selectedEvidencePacketItem.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Category</span><strong>{selectedEvidencePacketItem.category}</strong></div>
                    <div><span>Owner</span><strong>{selectedEvidencePacketItem.owner}</strong></div>
                    <div><span>Reference</span><strong>{selectedEvidencePacketItem.reference}</strong></div>
                    <div><span>Surface</span><strong>{getLaunchEvidencePacketSurfaceLabel(selectedEvidencePacketItem.surface)}</strong></div>
                    <div><span>Required</span><strong>{selectedEvidencePacketItem.required ? 'Yes' : 'No'}</strong></div>
                    <div><span>Audit</span><strong>{selectedEvidencePacketItem.auditBacked ? 'Audit backed' : 'Needs audit'}</strong></div>
                    <div><span>Local Only</span><strong>{selectedEvidencePacketItem.localOnly ? 'Yes' : 'No'}</strong></div>
                    <div><span>Updated</span><strong>{formatDateTime(selectedEvidencePacketItem.updatedAt)}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Evidence</h3>
                    <p className={selectedEvidencePacketItem.status === 'Missing' ? 'warning-copy' : 'muted-copy'}>{selectedEvidencePacketItem.evidence}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Next Step</h3>
                    <p className="warning-copy">{selectedEvidencePacketItem.nextStep}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Action Panel</h3>
                    <div className="support-actions">
                      <button className="ghost-action" onClick={() => openLaunchEvidencePacketItemSurface(selectedEvidencePacketItem)}>
                        <Search size={15} strokeWidth={1.8} />
                        Open Surface
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queueLaunchEvidencePacketHandoff(selectedEvidencePacketItem)}>
                        <GitBranch size={15} strokeWidth={1.8} />
                        Queue Handoff
                      </button>
                      <button className="ghost-action" disabled={!canRecordReview} onClick={recordLaunchEvidencePacket}>
                        <CheckCircle2 size={15} strokeWidth={1.8} />
                        Record Packet
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={exportLaunchEvidencePacket}>
                        <Download size={15} strokeWidth={1.8} />
                        Export Packet
                      </button>
                      <span className="muted-copy">Packet actions assemble, record, export, or route evidence only. Production changes still require governed server-side execution.</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No launch evidence packet item selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Evidence Packet Category Coverage"
            rows={launchEvidencePacket.categoryGroups}
            pageSize={8}
            emptyTitle="No packet category coverage is available."
            columns={[
              {
                key: 'category',
                header: 'Category',
                sortable: true,
                searchValue: row => row.category,
                render: row => <div><strong>{row.category}</strong><span className="cell-subtext">{row.total} evidence item{row.total === 1 ? '' : 's'}</span></div>,
              },
              {
                key: 'missing',
                header: 'Missing',
                sortable: true,
                searchValue: row => String(row.missing),
                render: row => row.missing,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'ready',
                header: 'Ready',
                sortable: true,
                searchValue: row => String(row.ready),
                render: row => row.ready,
              },
              {
                key: 'verified',
                header: 'Verified',
                sortable: true,
                searchValue: row => String(row.verified),
                render: row => row.verified,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className={row.requiredOpen ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Evidence Packet Owner Load"
            rows={launchEvidencePacket.ownerGroups}
            pageSize={8}
            emptyTitle="No packet owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} evidence item{row.total === 1 ? '' : 's'}</span></div>,
              },
              {
                key: 'required',
                header: 'Required Open',
                sortable: true,
                searchValue: row => String(row.requiredOpen),
                render: row => row.requiredOpen,
              },
              {
                key: 'missing',
                header: 'Missing',
                sortable: true,
                searchValue: row => String(row.missing),
                render: row => row.missing,
              },
              {
                key: 'review',
                header: 'Review',
                sortable: true,
                searchValue: row => String(row.review),
                render: row => row.review,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className={row.requiredOpen ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Evidence Packet Ledger"
            rows={launchEvidencePacketRecords}
            pageSize={6}
            emptyTitle="No launch evidence packets have been recorded yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchEvidencePacketStatusTone(row.status)} />,
              },
              {
                key: 'required',
                header: 'Required',
                sortable: true,
                searchValue: row => `${row.requiredSatisfiedCount} ${row.requiredCount}`,
                render: row => <div><strong>{row.requiredSatisfiedCount}/{row.requiredCount}</strong><span className="cell-subtext">{row.itemCount} packet items</span></div>,
              },
              {
                key: 'gaps',
                header: 'Gaps',
                sortable: true,
                searchValue: row => `${row.missingCount} ${row.reviewCount}`,
                render: row => <div><strong>{row.missingCount} missing</strong><span className="cell-subtext">{row.reviewCount} review</span></div>,
              },
              {
                key: 'top',
                header: 'Top Gap',
                sortable: true,
                searchValue: row => row.topGapTitle,
                render: row => row.topGapTitle,
              },
              {
                key: 'actor',
                header: 'Actor',
                sortable: true,
                searchValue: row => `${row.recordedBy} ${row.recordedByRole}`,
                render: row => <div><strong>{row.recordedByRole}</strong><span className="cell-subtext">{row.recordedBy}</span></div>,
              },
              {
                key: 'audit',
                header: 'Audit Event',
                sortable: true,
                searchValue: row => row.auditEventId,
                render: row => <span className="muted-copy">{row.auditEventId}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'postLaunch' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Watchtower Status" value={launchPostLaunchWatchtower.status} delta={launchPostLaunchWatchtower.headline} tone={getLaunchPostLaunchWatchtowerMetricTone(launchPostLaunchWatchtower.status)} icon={<Gauge size={16} />} />
            <MetricCard label="Critical Signals" value={String(launchPostLaunchWatchtower.criticalCount)} delta={`${launchPostLaunchWatchtower.watchCount} watch signals`} tone={launchPostLaunchWatchtower.criticalCount ? 'danger' : launchPostLaunchWatchtower.watchCount ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Action Required" value={String(launchPostLaunchWatchtower.actionRequiredCount)} delta="Needs owner response" tone={launchPostLaunchWatchtower.actionRequiredCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
            <MetricCard label="Audit Backed" value={`${launchPostLaunchWatchtower.auditBackedCount}/${launchPostLaunchWatchtower.signals.length}`} delta="Signals with proof" tone={launchPostLaunchWatchtower.auditBackedCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Monitoring" value={String(launchPostLaunchWatchtower.monitoringCount)} delta="Informational checks" tone="neutral" icon={<Search size={16} />} />
            <MetricCard label="Stable" value={String(launchPostLaunchWatchtower.stableCount)} delta="No response needed" tone={launchPostLaunchWatchtower.stableCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Local Signals" value={String(launchPostLaunchWatchtower.localOnlyCount)} delta="Browser-side review records" tone="neutral" icon={<ScrollText size={16} />} />
            <MetricCard label="Response Records" value={String(launchPostLaunchWatchtower.recordCount)} delta={launchPostLaunchWatchtower.latestRecord ? formatDateTime(launchPostLaunchWatchtower.latestRecord.recordedAt) : 'No post-launch record'} tone={launchPostLaunchWatchtower.recordCount ? 'ok' : 'neutral'} icon={<FileText size={16} />} />
          </div>

          <section className={`panel launch-watch-panel tone-${getLaunchPostLaunchWatchtowerMetricTone(launchPostLaunchWatchtower.status)}`}>
            <div>
              <p className="eyebrow">Post-Launch Watchtower</p>
              <h2>{launchPostLaunchWatchtower.headline}</h2>
              <span>{launchPostLaunchWatchtower.summary}</span>
              <span>Generated {formatDateTime(launchPostLaunchWatchtower.generatedAt)} from the launch packet, launch watch, backend watch, platform health, support, billing, usage, feature flags, action queue, follow-ups, and war room signals.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={launchPostLaunchWatchtower.status} tone={getLaunchPostLaunchWatchtowerTone(launchPostLaunchWatchtower.status)} />
              <strong>{launchPostLaunchWatchtower.nextSignal?.title ?? 'No open signal'}</strong>
              <button className="ghost-action" disabled={!canRecordReview} onClick={() => recordPostLaunchWatchtower()}>
                <ShieldCheck size={15} strokeWidth={1.8} />
                Record Watch
              </button>
              <button className="ghost-action" disabled={!canExport} onClick={exportPostLaunchWatchtower}>
                <Download size={15} strokeWidth={1.8} />
                Export Watch
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Post-Launch Boundary</p>
              <h2>Watchtower responses are routed, not silently executed</h2>
              <span>{launchPostLaunchWatchtowerBoundaryRule}</span>
            </div>
            <StatusPill label="No production mutation" tone="ok" />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Post-Launch Signals"
              rows={launchPostLaunchWatchtower.signals}
              pageSize={12}
              emptyTitle="No post-launch signals are available."
              columns={[
                {
                  key: 'signal',
                  header: 'Signal',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.lane} ${row.evidence}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedPostLaunchSignalId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => postLaunchSignalSortValue(row.status),
                  render: row => <StatusPill label={row.status} tone={getLaunchPostLaunchWatchtowerTone(row.status)} />,
                },
                {
                  key: 'lane',
                  header: 'Lane',
                  sortable: true,
                  searchValue: row => row.lane,
                  render: row => <div><strong>{row.lane}</strong><span className="cell-subtext">{row.responseWindow}</span></div>,
                },
                {
                  key: 'owner',
                  header: 'Owner',
                  sortable: true,
                  searchValue: row => row.owner,
                  render: row => row.owner,
                },
                {
                  key: 'audit',
                  header: 'Audit',
                  sortable: true,
                  searchValue: row => row.auditBacked ? 'Audit backed' : 'Needs audit',
                  render: row => <StatusPill label={row.auditBacked ? 'Audit Backed' : 'Needs Audit'} tone={row.auditBacked ? 'ok' : 'warn'} />,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className={row.actionRequired ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedPostLaunchSignal ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Post-Launch Signal</p>
                      <h2>{selectedPostLaunchSignal.title}</h2>
                    </div>
                    <StatusPill label={selectedPostLaunchSignal.status} tone={getLaunchPostLaunchWatchtowerTone(selectedPostLaunchSignal.status)} />
                  </div>

                  <div className="request-scope-list">
                    <div><span>Lane</span><strong>{selectedPostLaunchSignal.lane}</strong></div>
                    <div><span>Owner</span><strong>{selectedPostLaunchSignal.owner}</strong></div>
                    <div><span>Reference</span><strong>{selectedPostLaunchSignal.reference}</strong></div>
                    <div><span>Response</span><strong>{selectedPostLaunchSignal.responseWindow}</strong></div>
                    <div><span>Surface</span><strong>{getPostLaunchSurfaceLabel(selectedPostLaunchSignal.surface)}</strong></div>
                    <div><span>Action</span><strong>{selectedPostLaunchSignal.actionRequired ? 'Required' : 'Monitor'}</strong></div>
                    <div><span>Audit</span><strong>{selectedPostLaunchSignal.auditBacked ? 'Audit backed' : 'Needs audit'}</strong></div>
                    <div><span>Updated</span><strong>{formatDateTime(selectedPostLaunchSignal.updatedAt)}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Evidence</h3>
                    <p className={selectedPostLaunchSignal.status === 'Critical' ? 'warning-copy' : 'muted-copy'}>{selectedPostLaunchSignal.evidence}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Next Step</h3>
                    <p className={selectedPostLaunchSignal.actionRequired ? 'warning-copy' : 'muted-copy'}>{selectedPostLaunchSignal.nextStep}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Action Panel</h3>
                    <div className="support-actions">
                      <button className="ghost-action" onClick={() => openPostLaunchSignalSurface(selectedPostLaunchSignal)}>
                        <Search size={15} strokeWidth={1.8} />
                        Open Surface
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queuePostLaunchResponse(selectedPostLaunchSignal)}>
                        <GitBranch size={15} strokeWidth={1.8} />
                        Queue Response
                      </button>
                      <button className="ghost-action" disabled={!canRecordReview} onClick={() => recordPostLaunchWatchtower(selectedPostLaunchSignal)}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Record Signal
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={exportPostLaunchWatchtower}>
                        <Download size={15} strokeWidth={1.8} />
                        Export Watch
                      </button>
                      <span className="muted-copy">Post-launch actions record, route, or export monitoring evidence only. Any production change still requires governed server-side execution.</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No post-launch signal selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Post-Launch Lane Coverage"
            rows={launchPostLaunchWatchtower.laneGroups}
            pageSize={8}
            emptyTitle="No post-launch lane coverage is available."
            columns={[
              {
                key: 'lane',
                header: 'Lane',
                sortable: true,
                searchValue: row => row.lane,
                render: row => <div><strong>{row.lane}</strong><span className="cell-subtext">{row.total} signal{row.total === 1 ? '' : 's'}</span></div>,
              },
              {
                key: 'critical',
                header: 'Critical',
                sortable: true,
                searchValue: row => String(row.critical),
                render: row => row.critical,
              },
              {
                key: 'watch',
                header: 'Watch',
                sortable: true,
                searchValue: row => String(row.watch),
                render: row => row.watch,
              },
              {
                key: 'monitoring',
                header: 'Monitoring',
                sortable: true,
                searchValue: row => String(row.monitoring),
                render: row => row.monitoring,
              },
              {
                key: 'stable',
                header: 'Stable',
                sortable: true,
                searchValue: row => String(row.stable),
                render: row => row.stable,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className={row.critical || row.watch ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Post-Launch Owner Load"
            rows={launchPostLaunchWatchtower.ownerGroups}
            pageSize={8}
            emptyTitle="No post-launch owner load is available."
            columns={[
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => <div><strong>{row.owner}</strong><span className="cell-subtext">{row.total} signal{row.total === 1 ? '' : 's'}</span></div>,
              },
              {
                key: 'action',
                header: 'Action Required',
                sortable: true,
                searchValue: row => String(row.actionRequired),
                render: row => row.actionRequired,
              },
              {
                key: 'critical',
                header: 'Critical',
                sortable: true,
                searchValue: row => String(row.critical),
                render: row => row.critical,
              },
              {
                key: 'watch',
                header: 'Watch',
                sortable: true,
                searchValue: row => String(row.watch),
                render: row => row.watch,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className={row.actionRequired ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Post-Launch Response Ledger"
            rows={launchPostLaunchWatchtowerRecords}
            pageSize={6}
            emptyTitle="No post-launch watchtower records have been captured yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchPostLaunchWatchtowerTone(row.status)} />,
              },
              {
                key: 'signal',
                header: 'Signal',
                sortable: true,
                searchValue: row => `${row.signalTitle ?? ''} ${row.signalLane ?? ''}`,
                render: row => <div><strong>{row.signalTitle ?? 'Watchtower snapshot'}</strong><span className="cell-subtext">{row.signalLane ?? row.headline}</span></div>,
              },
              {
                key: 'counts',
                header: 'Counts',
                sortable: true,
                searchValue: row => `${row.criticalCount} ${row.watchCount} ${row.actionRequiredCount}`,
                render: row => <div><strong>{row.criticalCount} critical / {row.watchCount} watch</strong><span className="cell-subtext">{row.actionRequiredCount} action required</span></div>,
              },
              {
                key: 'actor',
                header: 'Actor',
                sortable: true,
                searchValue: row => `${row.recordedByRole} ${row.recordedBy}`,
                render: row => <div><strong>{row.recordedByRole}</strong><span className="cell-subtext">{row.recordedBy}</span></div>,
              },
              {
                key: 'audit',
                header: 'Audit Event',
                sortable: true,
                searchValue: row => row.auditEventId,
                render: row => <span className="muted-copy">{row.auditEventId}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'incidentCommand' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Incident Status" value={launchPostLaunchIncidentCommander.status} delta={launchPostLaunchIncidentCommander.headline} tone={getLaunchPostLaunchIncidentMetricTone(launchPostLaunchIncidentCommander.status)} icon={<Siren size={16} />} />
            <MetricCard label="Open Incidents" value={String(launchPostLaunchIncidentCommander.openIncidentCount)} delta={`${launchPostLaunchIncidentCommander.sev1Count} SEV1 / ${launchPostLaunchIncidentCommander.sev2Count} SEV2`} tone={launchPostLaunchIncidentCommander.sev1Count ? 'danger' : launchPostLaunchIncidentCommander.openIncidentCount ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Comms Drafts" value={String(launchPostLaunchIncidentCommander.commsDraftCount)} delta="Need owner review before sending" tone={launchPostLaunchIncidentCommander.commsDraftCount ? 'warn' : 'ok'} icon={<FileText size={16} />} />
            <MetricCard label="Closure Ready" value={String(launchPostLaunchIncidentCommander.closureReadyCount)} delta="Incident packets ready to close" tone={launchPostLaunchIncidentCommander.closureReadyCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Mitigation Ready" value={String(launchPostLaunchIncidentCommander.mitigationReadyCount)} delta="Governed response is linked" tone={launchPostLaunchIncidentCommander.mitigationReadyCount ? 'ok' : 'neutral'} icon={<GitBranch size={16} />} />
            <MetricCard label="Monitoring" value={String(launchPostLaunchIncidentCommander.monitoringCount)} delta="Active watch without escalation" tone="neutral" icon={<Search size={16} />} />
            <MetricCard label="Audit Backed" value={`${launchPostLaunchIncidentCommander.auditBackedCount}/${launchPostLaunchIncidentCommander.incidents.length}`} delta="Packets with evidence" tone={launchPostLaunchIncidentCommander.auditBackedCount ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Incident Records" value={String(launchPostLaunchIncidentCommander.recordCount)} delta={launchPostLaunchIncidentCommander.latestRecord ? formatDateTime(launchPostLaunchIncidentCommander.latestRecord.recordedAt) : 'No incident record'} tone={launchPostLaunchIncidentCommander.recordCount ? 'ok' : 'neutral'} icon={<ScrollText size={16} />} />
          </div>

          <section className={`panel launch-watch-panel tone-${getLaunchPostLaunchIncidentMetricTone(launchPostLaunchIncidentCommander.status)}`}>
            <div>
              <p className="eyebrow">Post-Launch Incident Commander</p>
              <h2>{launchPostLaunchIncidentCommander.headline}</h2>
              <span>{launchPostLaunchIncidentCommander.summary}</span>
              <span>Generated {formatDateTime(launchPostLaunchIncidentCommander.generatedAt)} from post-launch watchtower signals, launch war room activity, support impact, platform health, admin action requests, and audit events.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={launchPostLaunchIncidentCommander.status} tone={getLaunchPostLaunchIncidentStatusTone(launchPostLaunchIncidentCommander.status)} />
              <strong>{launchPostLaunchIncidentCommander.nextIncident?.title ?? 'No open incident'}</strong>
              <button className="ghost-action" disabled={!canRecordReview} onClick={() => recordPostLaunchIncident()}>
                <ShieldCheck size={15} strokeWidth={1.8} />
                Record Commander
              </button>
              <button className="ghost-action" disabled={!canExport} onClick={exportPostLaunchIncidentCommander}>
                <Download size={15} strokeWidth={1.8} />
                Export Commander
              </button>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Incident Boundary</p>
              <h2>Incident response is coordinated, not silently executed</h2>
              <span>{launchPostLaunchIncidentBoundaryRule}</span>
            </div>
            <StatusPill label="Human review required" tone="ok" />
          </section>

          <div className="launch-readiness-layout">
            <DataTable
              label="Post-Launch Incident Packets"
              rows={launchPostLaunchIncidentCommander.incidents}
              pageSize={12}
              emptyTitle="No post-launch incident packets are open."
              columns={[
                {
                  key: 'incident',
                  header: 'Incident',
                  sortable: true,
                  searchValue: row => `${row.title} ${row.lane} ${row.reference}`,
                  render: row => (
                    <button className="table-link" onClick={() => setSelectedPostLaunchIncidentId(row.id)}>
                      {row.title}
                    </button>
                  ),
                },
                {
                  key: 'severity',
                  header: 'Severity',
                  sortable: true,
                  searchValue: row => incidentSeveritySortValue(row.severity),
                  render: row => <StatusPill label={row.severity} tone={getLaunchPostLaunchIncidentSeverityTone(row.severity)} />,
                },
                {
                  key: 'status',
                  header: 'Status',
                  sortable: true,
                  searchValue: row => incidentStatusSortValue(row.status),
                  render: row => <StatusPill label={row.status} tone={getLaunchPostLaunchIncidentStatusTone(row.status)} />,
                },
                {
                  key: 'commander',
                  header: 'Commander',
                  sortable: true,
                  searchValue: row => `${row.commander} ${row.responseWindow}`,
                  render: row => <div><strong>{row.commander}</strong><span className="cell-subtext">{row.responseWindow}</span></div>,
                },
                {
                  key: 'impact',
                  header: 'Impact',
                  searchValue: row => `${row.customerImpact} ${row.evidence}`,
                  render: row => <span className={row.severity === 'SEV1' || row.severity === 'SEV2' ? 'warning-copy' : 'muted-copy'}>{row.customerImpact}</span>,
                },
                {
                  key: 'next',
                  header: 'Next Step',
                  searchValue: row => row.nextStep,
                  render: row => <span className={row.actionRequired ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
                },
              ]}
            />

            <aside className="detail-panel launch-detail-panel">
              {selectedPostLaunchIncident ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="eyebrow">Incident Packet</p>
                      <h2>{selectedPostLaunchIncident.title}</h2>
                    </div>
                    <div className="launch-command-meta">
                      <StatusPill label={selectedPostLaunchIncident.severity} tone={getLaunchPostLaunchIncidentSeverityTone(selectedPostLaunchIncident.severity)} />
                      <StatusPill label={selectedPostLaunchIncident.status} tone={getLaunchPostLaunchIncidentStatusTone(selectedPostLaunchIncident.status)} />
                    </div>
                  </div>

                  <div className="request-scope-list">
                    <div><span>Commander</span><strong>{selectedPostLaunchIncident.commander}</strong></div>
                    <div><span>Lane</span><strong>{selectedPostLaunchIncident.lane}</strong></div>
                    <div><span>Reference</span><strong>{selectedPostLaunchIncident.reference}</strong></div>
                    <div><span>Response</span><strong>{selectedPostLaunchIncident.responseWindow}</strong></div>
                    <div><span>Surface</span><strong>{getPostLaunchSurfaceLabel(selectedPostLaunchIncident.surface)}</strong></div>
                    <div><span>Affected</span><strong>{selectedPostLaunchIncident.affectedClients} clients / {selectedPostLaunchIncident.affectedVenues} venues</strong></div>
                    <div><span>Linked Actions</span><strong>{selectedPostLaunchIncident.linkedActionCount}</strong></div>
                    <div><span>Linked Audit</span><strong>{selectedPostLaunchIncident.linkedAuditCount}</strong></div>
                    <div><span>Audit</span><strong>{selectedPostLaunchIncident.auditBacked ? 'Audit backed' : 'Needs audit'}</strong></div>
                    <div><span>Updated</span><strong>{formatDateTime(selectedPostLaunchIncident.updatedAt)}</strong></div>
                  </div>

                  <div className="detail-section">
                    <h3>Customer Impact</h3>
                    <p className={selectedPostLaunchIncident.severity === 'SEV1' || selectedPostLaunchIncident.severity === 'SEV2' ? 'warning-copy' : 'muted-copy'}>{selectedPostLaunchIncident.customerImpact}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Current Mitigation</h3>
                    <p className={selectedPostLaunchIncident.status === 'Investigating' ? 'warning-copy' : 'muted-copy'}>{selectedPostLaunchIncident.currentMitigation}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Communications Draft</h3>
                    <p className={selectedPostLaunchIncident.commsDraft ? 'warning-copy' : 'muted-copy'}>{selectedPostLaunchIncident.commsDraft || 'No customer-facing draft is required for this severity. Keep internal monitoring notes attached to the packet.'}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Internal Update</h3>
                    <p className="muted-copy">{selectedPostLaunchIncident.internalUpdate}</p>
                  </div>

                  <div className="detail-section">
                    <h3>Incident Timeline</h3>
                    <div className="settings-rule-list">
                      {selectedPostLaunchIncident.timeline.map(item => (
                        <div key={item.id}>
                          <Clock3 size={16} strokeWidth={1.8} />
                          <div>
                            <strong>{item.label}</strong>
                            <span className="cell-subtext">{item.source} / {formatDateTime(item.occurredAt)}</span>
                            <span className="muted-copy">{item.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Runbook Steps</h3>
                    <div className="settings-rule-list">
                      {selectedPostLaunchIncident.runbookSteps.map(step => (
                        <div key={step.id}>
                          <ListChecks size={16} strokeWidth={1.8} />
                          <div>
                            <strong>{step.label}</strong>
                            <span className="cell-subtext">{step.owner} / {step.detail}</span>
                            <StatusPill label={step.status} tone={getLaunchPostLaunchIncidentStepTone(step.status)} />
                            <span className="muted-copy">{step.action}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Closure Checks</h3>
                    <div className="settings-rule-list">
                      {selectedPostLaunchIncident.closureChecks.map(check => (
                        <div key={check.id}>
                          <ShieldCheck size={16} strokeWidth={1.8} />
                          <div>
                            <strong>{check.label}</strong>
                            <span className="cell-subtext">{check.required ? 'Required' : 'Optional'} / {check.evidence}</span>
                            <StatusPill label={check.status} tone={getLaunchPostLaunchIncidentStepTone(check.status)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="detail-section">
                    <h3>Action Panel</h3>
                    <div className="support-actions">
                      <button className="ghost-action" onClick={() => openPostLaunchIncidentSurface(selectedPostLaunchIncident)}>
                        <Search size={15} strokeWidth={1.8} />
                        Open Surface
                      </button>
                      <button className="ghost-action" disabled={!canQueueAction} onClick={() => queuePostLaunchIncidentResponse(selectedPostLaunchIncident)}>
                        <GitBranch size={15} strokeWidth={1.8} />
                        Queue Response
                      </button>
                      <button className="ghost-action" disabled={!canRecordReview} onClick={() => recordPostLaunchIncident(selectedPostLaunchIncident)}>
                        <ShieldCheck size={15} strokeWidth={1.8} />
                        Record Packet
                      </button>
                      <button className="ghost-action" disabled={!canExport} onClick={exportPostLaunchIncidentCommander}>
                        <Download size={15} strokeWidth={1.8} />
                        Export Commander
                      </button>
                      <span className="muted-copy">Incident actions create review evidence, exports, or queued requests only. Production work still requires the governed action pathway.</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-state compact">No post-launch incident packet selected.</div>
              )}
            </aside>
          </div>

          <DataTable
            label="Incident Commander Load"
            rows={launchPostLaunchIncidentCommander.commanderGroups}
            pageSize={8}
            emptyTitle="No incident commander load is available."
            columns={[
              {
                key: 'commander',
                header: 'Commander',
                sortable: true,
                searchValue: row => row.commander,
                render: row => <div><strong>{row.commander}</strong><span className="cell-subtext">{row.total} incident{row.total === 1 ? '' : 's'}</span></div>,
              },
              {
                key: 'sev1',
                header: 'SEV1',
                sortable: true,
                searchValue: row => String(row.sev1),
                render: row => row.sev1,
              },
              {
                key: 'sev2',
                header: 'SEV2',
                sortable: true,
                searchValue: row => String(row.sev2),
                render: row => row.sev2,
              },
              {
                key: 'open',
                header: 'Open',
                sortable: true,
                searchValue: row => String(row.open),
                render: row => row.open,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className={row.open ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Incident Severity Coverage"
            rows={launchPostLaunchIncidentCommander.severityGroups}
            pageSize={8}
            emptyTitle="No incident severity coverage is available."
            columns={[
              {
                key: 'severity',
                header: 'Severity',
                sortable: true,
                searchValue: row => incidentSeveritySortValue(row.severity),
                render: row => <StatusPill label={row.severity} tone={getLaunchPostLaunchIncidentSeverityTone(row.severity)} />,
              },
              {
                key: 'status',
                header: 'Status Mix',
                sortable: true,
                searchValue: row => `${row.investigating} ${row.mitigationReady} ${row.monitoring} ${row.closureReady}`,
                render: row => <div><strong>{row.investigating} investigating / {row.mitigationReady} mitigation</strong><span className="cell-subtext">{row.monitoring} monitoring / {row.closureReady} closure ready</span></div>,
              },
              {
                key: 'total',
                header: 'Total',
                sortable: true,
                searchValue: row => String(row.total),
                render: row => row.total,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className={row.severity === 'SEV1' || row.severity === 'SEV2' ? 'warning-copy' : 'muted-copy'}>{row.nextStep}</span>,
              },
            ]}
          />

          <DataTable
            label="Incident Response Ledger"
            rows={launchPostLaunchIncidentRecords}
            pageSize={6}
            emptyTitle="No post-launch incident records have been captured yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'packet',
                header: 'Packet',
                sortable: true,
                searchValue: row => `${row.incidentTitle ?? ''} ${row.commander ?? ''}`,
                render: row => <div><strong>{row.incidentTitle ?? 'Commander snapshot'}</strong><span className="cell-subtext">{row.commander ?? row.packetStatus}</span></div>,
              },
              {
                key: 'severity',
                header: 'Severity',
                sortable: true,
                searchValue: row => row.severity ? incidentSeveritySortValue(row.severity) : '9 Snapshot',
                render: row => row.severity ? <StatusPill label={row.severity} tone={getLaunchPostLaunchIncidentSeverityTone(row.severity)} /> : <StatusPill label={row.packetStatus} tone={getLaunchPostLaunchIncidentStatusTone(row.packetStatus)} />,
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => incidentStatusSortValue(row.status),
                render: row => <StatusPill label={row.status} tone={getLaunchPostLaunchIncidentStatusTone(row.status)} />,
              },
              {
                key: 'counts',
                header: 'Counts',
                sortable: true,
                searchValue: row => `${row.openIncidentCount} ${row.sev1Count} ${row.sev2Count} ${row.commsDraftCount}`,
                render: row => <div><strong>{row.openIncidentCount} open / {row.sev1Count} SEV1</strong><span className="cell-subtext">{row.sev2Count} SEV2 / {row.commsDraftCount} comms drafts</span></div>,
              },
              {
                key: 'actor',
                header: 'Actor',
                sortable: true,
                searchValue: row => `${row.recordedByRole} ${row.recordedBy}`,
                render: row => <div><strong>{row.recordedByRole}</strong><span className="cell-subtext">{row.recordedBy}</span></div>,
              },
              {
                key: 'audit',
                header: 'Audit Event',
                sortable: true,
                searchValue: row => row.auditEventId,
                render: row => <span className="muted-copy">{row.auditEventId}</span>,
              },
            ]}
          />
        </>
      ) : viewMode === 'communications' ? (
        <LaunchCommunicationsApprovalView
          center={launchCommsApprovalCenter}
          records={launchCommsApprovalRecords}
          selectedDraft={selectedLaunchCommsDraft}
          canRecordReview={canRecordReview}
          canExport={canExport}
          canQueueAction={canQueueAction}
          onSelectDraft={setSelectedLaunchCommsDraftId}
          onOpenSource={openLaunchCommsDraftSurface}
          onRecordApproval={recordLaunchCommsApproval}
          onQueueSendReview={queueLaunchCommsSendReview}
          onExport={exportLaunchCommsApprovalCenter}
        />
      ) : viewMode === 'sendReview' ? (
        <LaunchSendReviewQueueView
          queue={launchSendReviewQueue}
          records={launchSendReviewRecords}
          selectedItem={selectedLaunchSendReviewItem}
          canRecordReview={canRecordReview}
          canExport={canExport}
          canQueueAction={canQueueAction}
          onSelectItem={setSelectedLaunchSendReviewItemId}
          onOpenSource={openLaunchSendReviewSource}
          onRecordReview={recordLaunchSendReview}
          onQueueHandoff={queueLaunchSendReviewHandoff}
          onExport={exportLaunchSendReviewQueue}
        />
      ) : viewMode === 'deliveryEvidence' ? (
        <LaunchDeliveryEvidenceLedgerView
          ledger={launchDeliveryEvidenceLedger}
          records={launchDeliveryEvidenceRecords}
          selectedItem={selectedLaunchDeliveryEvidenceItem}
          canRecordEvidence={canRecordReview}
          canExport={canExport}
          canQueueAction={canQueueAction}
          onSelectItem={setSelectedLaunchDeliveryEvidenceItemId}
          onOpenSource={openLaunchDeliveryEvidenceSource}
          onRecordEvidence={recordLaunchDeliveryEvidence}
          onQueueEvidenceReview={queueLaunchDeliveryEvidenceReview}
          onExport={exportLaunchDeliveryEvidenceLedger}
        />
      ) : viewMode === 'recipientResponse' ? (
        <LaunchRecipientResponseMonitorView
          monitor={launchRecipientResponseMonitor}
          records={launchRecipientResponseRecords}
          selectedItem={selectedLaunchRecipientResponseItem}
          canRecordResponse={canRecordReview}
          canExport={canExport}
          canQueueAction={canQueueAction}
          onSelectItem={setSelectedLaunchRecipientResponseItemId}
          onOpenSource={openLaunchRecipientResponseSource}
          onRecordResponse={recordLaunchRecipientResponse}
          onQueueFollowUp={queueLaunchRecipientResponseFollowUp}
          onExport={exportLaunchRecipientResponseMonitor}
        />
      ) : viewMode === 'closurePack' ? (
        <LaunchClosureEvidencePackView
          pack={launchClosureEvidencePack}
          records={launchClosureEvidenceRecords}
          selectedItem={selectedLaunchClosureEvidenceItem}
          canRecordClosure={canRecordReview}
          canExport={canExport}
          canQueueAction={canQueueAction}
          onSelectItem={setSelectedLaunchClosureEvidenceItemId}
          onOpenSource={openLaunchClosureEvidenceSource}
          onRecordClosure={recordLaunchClosureEvidence}
          onQueueClosureReview={queueLaunchClosureEvidenceReview}
          onExport={exportLaunchClosureEvidencePack}
        />
      ) : viewMode === 'finalAudit' ? (
        <LaunchFinalAuditRoomView
          room={launchFinalAuditRoom}
          records={launchFinalAuditRecords}
          selectedItem={selectedLaunchFinalAuditItem}
          canRecordAudit={canRecordReview}
          canExport={canExport}
          canQueueAction={canQueueAction}
          onSelectItem={setSelectedLaunchFinalAuditItemId}
          onOpenSource={openLaunchFinalAuditSource}
          onRecordAudit={recordLaunchFinalAudit}
          onQueueAuditReview={queueLaunchFinalAuditReview}
          onExport={exportLaunchFinalAuditRoom}
        />
      ) : viewMode === 'auditArchive' ? (
        <LaunchAuditArchiveVaultView
          vault={launchAuditArchiveVault}
          records={launchAuditArchiveRecords}
          selectedItem={selectedLaunchAuditArchiveItem}
          canRecordArchive={canRecordReview}
          canExport={canExport}
          canQueueAction={canQueueAction}
          onSelectItem={setSelectedLaunchAuditArchiveItemId}
          onOpenSource={openLaunchAuditArchiveSource}
          onRecordArchive={recordLaunchAuditArchive}
          onQueueArchiveReview={queueLaunchAuditArchiveReview}
          onExport={exportLaunchAuditArchiveVault}
        />
      ) : viewMode === 'closure' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Closure Decision" value={closureModel.decision} delta="Executive go/no-go" tone={getLaunchClosureDecisionTone(closureModel.decision)} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Required Complete" value={`${closureModel.completeRequiredCount}/${closureModel.requiredCount}`} delta="Closure checklist" tone={closureModel.completeRequiredCount === closureModel.requiredCount ? 'ok' : 'warn'} icon={<ClipboardCheck size={16} />} />
            <MetricCard label="Unresolved Deferrals" value={String(closureModel.unresolvedDeferralCount)} delta="Sign-offs + packets" tone={closureModel.unresolvedDeferralCount ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Open Actions" value={String(closureModel.openActionCount)} delta="Server queue" tone={closureModel.openActionCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
          </div>

          <div className="metrics-grid compact">
            <MetricCard label="Snapshot Ledger" value={String(closureSnapshots.length)} delta="Recorded closure states" tone={closureSnapshots.length ? 'ok' : 'neutral'} icon={<ScrollText size={16} />} />
            <MetricCard label="Latest Snapshot" value={latestClosureSnapshot ? formatDateTime(latestClosureSnapshot.recordedAt) : 'None'} delta={latestClosureSnapshot?.decision ?? 'No snapshot recorded'} tone={latestClosureSnapshot ? getLaunchClosureDecisionTone(latestClosureSnapshot.decision) : 'neutral'} icon={<FileText size={16} />} />
            <MetricCard label="Record Permission" value={canSignOff ? 'Enabled' : 'Read Only'} delta="settings.manage" tone={canSignOff ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Export Permission" value={canExport ? 'Enabled' : 'Read Only'} delta="reports.export" tone={canExport ? 'ok' : 'warn'} icon={<Download size={16} />} />
          </div>

          <section className={`panel launch-closure-panel tone-${getLaunchClosureDecisionTone(closureModel.decision)}`}>
            <div>
              <p className="eyebrow">Final Launch Decision</p>
              <h2>{closureModel.summary}</h2>
              <span>Generated {formatDateTime(closureModel.generatedAt)} from readiness gates, owner sign-offs, decision packets, action requests, evidence, and read-contract diagnostics.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={closureModel.decision} tone={getLaunchClosureDecisionTone(closureModel.decision)} />
              <strong>{closureModel.readyForExecutiveSignOff ? 'Ready For Sign-Off' : 'Closure Work Required'}</strong>
              <button className="ghost-action" disabled={!canSignOff} onClick={recordClosureSnapshot}>
                <ShieldCheck size={15} strokeWidth={1.8} />
                Record Snapshot
              </button>
              {latestClosureSnapshot && (
                <button className="ghost-action" disabled={!canExport} onClick={() => exportClosureSnapshot(latestClosureSnapshot)}>
                  <Download size={15} strokeWidth={1.8} />
                  Export Latest
                </button>
              )}
            </div>
          </section>

          <section className="panel launch-closure-snapshot-panel">
            <div>
              <p className="eyebrow">Decision Snapshot</p>
              <h2>One place to see why launch can or cannot close</h2>
              <span>This snapshot is evidence only. It records the current review state and does not change customer state, billing, modules, permissions, support records, messaging, or agent behavior.</span>
            </div>
            <div className="request-scope-list">
              <div><span>Readiness</span><strong>{model.score}% / {model.status}</strong></div>
              <div><span>Required Approvals</span><strong>{closureModel.requiredApprovalCount - closureModel.missingApprovalCount}/{closureModel.requiredApprovalCount}</strong></div>
              <div><span>Evidence Items</span><strong>{closureModel.evidenceItemCount}</strong></div>
              <div><span>Packet Deferrals</span><strong>{decisionPackets.filter(packet => packet.status === 'Deferred').length}</strong></div>
              <div><span>Sign-Off Deferrals</span><strong>{signOffs.filter(signOff => signOff.decision === 'Deferred').length}</strong></div>
              <div><span>Data Source</span><strong>{sourceLabel} / {status}</strong></div>
              <div><span>Last Snapshot</span><strong>{latestClosureSnapshot ? `${latestClosureSnapshot.decision} / ${formatDateTime(latestClosureSnapshot.recordedAt)}` : 'Not recorded'}</strong></div>
              <div><span>Snapshot Actor</span><strong>{latestClosureSnapshot?.recordedByRole ?? 'Pending'}</strong></div>
            </div>
          </section>

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Closure Rule</p>
              <h2>Go/no-go is a decision record, not an execution path</h2>
              <span>Any follow-up that changes production data still requires scoped permissions, human confirmation where required, server-side handlers, rollback notes, and audit records.</span>
            </div>
            <StatusPill label={canSignOff ? 'Snapshot recording enabled' : 'Read only'} tone={canSignOff ? 'ok' : 'warn'} />
          </section>

          <DataTable
            label="Launch Closure Checklist"
            rows={closureModel.checklist}
            pageSize={8}
            emptyTitle="No launch closure checks are available."
            columns={[
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchClosureItemTone(row.status)} />,
              },
              {
                key: 'requirement',
                header: 'Requirement',
                sortable: true,
                searchValue: row => `${row.title} ${row.category} ${row.reference}`,
                render: row => <div><strong>{row.title}</strong><span className="cell-subtext">{row.category} / {row.reference}</span></div>,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => row.owner,
              },
              {
                key: 'evidence',
                header: 'Evidence',
                searchValue: row => `${row.evidence} ${row.nextStep}`,
                render: row => <div><strong>{row.evidence}</strong><span className="cell-subtext">{row.nextStep}</span></div>,
              },
              {
                key: 'required',
                header: 'Required',
                sortable: true,
                searchValue: row => row.required ? 'Required' : 'Optional',
                render: row => <StatusPill label={row.required ? 'Required' : 'Optional'} tone={row.required ? 'info' : 'neutral'} />,
              },
            ]}
          />

          <DataTable
            label="Closure Snapshot Ledger"
            rows={closureSnapshots}
            pageSize={6}
            emptyTitle="No closure snapshots have been recorded yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'decision',
                header: 'Decision',
                sortable: true,
                searchValue: row => `${row.decision} ${row.summary}`,
                render: row => (
                  <div>
                    <StatusPill label={row.decision} tone={getLaunchClosureDecisionTone(row.decision)} />
                    <span className="cell-subtext">{row.summary}</span>
                  </div>
                ),
              },
              {
                key: 'score',
                header: 'Score',
                sortable: true,
                searchValue: row => String(row.readinessScore),
                render: row => `${row.readinessScore}% / ${row.launchStatus}`,
              },
              {
                key: 'checks',
                header: 'Checks',
                sortable: true,
                searchValue: row => `${row.completeRequiredCount}/${row.requiredCount} ${row.blockedCount} ${row.reviewCount}`,
                render: row => (
                  <div>
                    <strong>{row.completeRequiredCount}/{row.requiredCount} complete</strong>
                    <span className="cell-subtext">{row.blockedCount} blocked / {row.reviewCount} review</span>
                  </div>
                ),
              },
              {
                key: 'actor',
                header: 'Actor',
                sortable: true,
                searchValue: row => `${row.recordedBy} ${row.recordedByEmail} ${row.recordedByRole}`,
                render: row => <div><strong>{row.recordedByRole}</strong><span className="cell-subtext">{row.recordedBy}</span></div>,
              },
              {
                key: 'actions',
                header: 'Actions',
                searchValue: row => row.auditEventId,
                render: row => (
                  <button className="ghost-action" disabled={!canExport} onClick={() => exportClosureSnapshot(row)}>
                    <Download size={15} strokeWidth={1.8} />
                    Export
                  </button>
                ),
              },
            ]}
          />
        </>
      ) : viewMode === 'brief' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Recommendation" value={executiveBrief.recommendation} delta="Owner-ready position" tone={getLaunchExecutiveBriefTone(executiveBrief.recommendation)} icon={<FileText size={16} />} />
            <MetricCard label="Brief Blockers" value={String(executiveBrief.blockerCount)} delta="Closure blockers" tone={executiveBrief.blockerCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Required Decisions" value={String(executiveBrief.requiredDecisions.length)} delta="Owner talking track" tone={executiveBrief.requiredDecisions.length ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
            <MetricCard label="Brief Sources" value={String(executiveBrief.sources.length)} delta={`${executiveBrief.snapshotCount} closure snapshots`} tone="neutral" icon={<ScrollText size={16} />} />
          </div>

          <section className={`panel launch-brief-panel tone-${getLaunchExecutiveBriefTone(executiveBrief.recommendation)}`}>
            <div>
              <p className="eyebrow">Executive Launch Brief</p>
              <h2>{executiveBrief.headline}</h2>
              <span>{executiveBrief.narrative}</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={executiveBrief.recommendation} tone={getLaunchExecutiveBriefTone(executiveBrief.recommendation)} />
              <strong>{formatDateTime(executiveBrief.generatedAt)}</strong>
              <button className="ghost-action" disabled={!canExport} onClick={exportExecutiveBrief}>
                <Download size={15} strokeWidth={1.8} />
                Export Brief
              </button>
            </div>
          </section>

          <section className="panel launch-brief-source-panel">
            <div>
              <p className="eyebrow">Brief Sources</p>
              <h2>Evidence pulled into the owner narrative</h2>
              <span>The brief bundles readiness, closure, snapshots, packets, action queue state, and data-source posture into one reviewable owner surface.</span>
            </div>
            <div className="request-scope-list">
              {executiveBrief.sources.map(source => (
                <div key={source.id}>
                  <span>{source.label}</span>
                  <strong>{source.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <DataTable
            label="Executive Talking Points"
            rows={executiveBrief.talkingPoints}
            pageSize={6}
            emptyTitle="No executive talking points are available."
            columns={[
              {
                key: 'tone',
                header: 'Tone',
                sortable: true,
                searchValue: row => row.tone,
                render: row => <StatusPill label={row.tone} tone={row.tone} />,
              },
              {
                key: 'point',
                header: 'Talking Point',
                sortable: true,
                searchValue: row => `${row.title} ${row.body}`,
                render: row => <div><strong>{row.title}</strong><span className="cell-subtext">{row.body}</span></div>,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => row.owner,
              },
              {
                key: 'reference',
                header: 'Reference',
                sortable: true,
                searchValue: row => row.reference,
                render: row => row.reference,
              },
            ]}
          />

          <DataTable
            label="Required Owner Decisions"
            rows={executiveBrief.requiredDecisions}
            pageSize={8}
            emptyTitle="No owner decisions are currently waiting."
            columns={[
              {
                key: 'tone',
                header: 'Tone',
                sortable: true,
                searchValue: row => row.tone,
                render: row => <StatusPill label={row.tone} tone={row.tone} />,
              },
              {
                key: 'decision',
                header: 'Decision',
                sortable: true,
                searchValue: row => `${row.title} ${row.body}`,
                render: row => <div><strong>{row.title}</strong><span className="cell-subtext">{row.body}</span></div>,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => row.owner,
              },
              {
                key: 'reference',
                header: 'Reference',
                sortable: true,
                searchValue: row => row.reference,
                render: row => row.reference,
              },
            ]}
          />

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Brief Rule</p>
              <h2>The brief summarizes decisions; it does not make them</h2>
              <span>Owner approval, production follow-up, billing changes, module changes, support mutations, messaging, and agent actions still require their dedicated permissioned workflows.</span>
            </div>
            <StatusPill label={canExport ? 'Brief export enabled' : 'Read only'} tone={canExport ? 'ok' : 'warn'} />
          </section>
        </>
      ) : viewMode === 'manifest' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Manifest Status" value={artifactManifest.status} delta="Owner handoff packet" tone={getLaunchArtifactManifestTone(artifactManifest.status)} icon={<ClipboardCheck size={16} />} />
            <MetricCard label="Required Ready" value={`${artifactManifest.readyRequiredCount}/${artifactManifest.requiredCount}`} delta="Required artifacts" tone={artifactManifest.readyRequiredCount === artifactManifest.requiredCount ? 'ok' : 'warn'} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Handoff Gaps" value={String(artifactManifest.gaps.length)} delta={`${artifactManifest.blockedCount} blocked / ${artifactManifest.reviewCount} review`} tone={artifactManifest.blockedCount ? 'danger' : artifactManifest.reviewCount ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Exportable" value={String(artifactManifest.exportableCount)} delta={`${artifactManifest.auditBackedCount} audit backed`} tone="neutral" icon={<Download size={16} />} />
          </div>

          <section className={`panel launch-manifest-panel tone-${getLaunchArtifactManifestTone(artifactManifest.status)}`}>
            <div>
              <p className="eyebrow">Launch Artifact Manifest</p>
              <h2>{artifactManifest.summary}</h2>
              <span>Generated {formatDateTime(artifactManifest.generatedAt)} from the launch report, closure checklist, executive brief, decision packets, snapshots, evidence ledger, read diagnostics, and action queue state.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={artifactManifest.status} tone={getLaunchArtifactManifestTone(artifactManifest.status)} />
              <strong>{artifactManifest.latestSnapshot ? `Snapshot: ${artifactManifest.latestSnapshot.decision}` : 'Snapshot pending'}</strong>
              <button className="ghost-action" disabled={!canExport} onClick={exportArtifactManifest}>
                <Download size={15} strokeWidth={1.8} />
                Export Manifest
              </button>
            </div>
          </section>

          <section className="panel launch-manifest-source-panel">
            <div>
              <p className="eyebrow">Handoff Index</p>
              <h2>One view of the owner packet</h2>
              <span>The manifest indexes which launch artifacts exist, which are exportable, which are audit-backed, and which still need approval before handoff.</span>
            </div>
            <div className="request-scope-list">
              <div><span>Latest Snapshot</span><strong>{artifactManifest.latestSnapshot ? `${artifactManifest.latestSnapshot.decision} / ${formatDateTime(artifactManifest.latestSnapshot.recordedAt)}` : 'Not recorded'}</strong></div>
              <div><span>Decision Packets</span><strong>{decisionPackets.length}</strong></div>
              <div><span>Evidence Items</span><strong>{evidenceLedger.entries.length}</strong></div>
              <div><span>Action Queue</span><strong>{closureModel.openActionCount} open</strong></div>
              <div><span>Read Contracts</span><strong>{readViewDiagnostics.filter(diagnostic => diagnostic.status === 'ready').length} ready / {readViewDiagnostics.filter(diagnostic => diagnostic.status === 'fallback').length} fallback</strong></div>
              <div><span>Data Source</span><strong>{sourceLabel} / {status}</strong></div>
              <div><span>Audit Backed</span><strong>{artifactManifest.auditBackedCount}/{artifactManifest.artifacts.length}</strong></div>
              <div><span>Missing Required</span><strong>{artifactManifest.missingRequiredCount}</strong></div>
            </div>
          </section>

          <DataTable
            label="Launch Artifact Manifest"
            rows={artifactManifest.artifacts}
            pageSize={9}
            emptyTitle="No launch artifacts are available."
            columns={[
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchArtifactStatusTone(row.status)} />,
              },
              {
                key: 'artifact',
                header: 'Artifact',
                sortable: true,
                searchValue: row => `${row.title} ${row.type} ${row.reference}`,
                render: row => <div><strong>{row.title}</strong><span className="cell-subtext">{row.type} / {row.reference}</span></div>,
              },
              {
                key: 'required',
                header: 'Required',
                sortable: true,
                searchValue: row => row.required ? 'Required' : 'Optional',
                render: row => <StatusPill label={row.required ? 'Required' : 'Optional'} tone={row.required ? 'info' : 'neutral'} />,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => row.owner,
              },
              {
                key: 'updated',
                header: 'Updated',
                sortable: true,
                searchValue: row => row.updatedAt,
                render: row => formatDateTime(row.updatedAt),
              },
              {
                key: 'evidence',
                header: 'Evidence',
                searchValue: row => `${row.evidence} ${row.nextStep}`,
                render: row => <div><strong>{row.evidence}</strong><span className="cell-subtext">{row.nextStep}</span></div>,
              },
              {
                key: 'handoff',
                header: 'Handoff',
                searchValue: row => `${row.exportable ? 'Exportable' : 'Indexed'} ${row.auditBacked ? 'Audit backed' : 'Needs audit'}`,
                render: row => (
                  <div className="support-actions">
                    <StatusPill label={row.exportable ? 'Exportable' : 'Indexed'} tone={row.exportable ? 'info' : 'neutral'} />
                    <StatusPill label={row.auditBacked ? 'Audit backed' : 'Needs audit'} tone={row.auditBacked ? 'ok' : 'warn'} />
                  </div>
                ),
              },
            ]}
          />

          <DataTable
            label="Manifest Handoff Gaps"
            rows={artifactManifest.gaps}
            pageSize={6}
            emptyTitle="No handoff gaps are currently waiting."
            columns={[
              {
                key: 'severity',
                header: 'Severity',
                sortable: true,
                searchValue: row => row.severity,
                render: row => <StatusPill label={row.severity} tone={row.severity === 'Blocker' ? 'danger' : 'warn'} />,
              },
              {
                key: 'gap',
                header: 'Gap',
                sortable: true,
                searchValue: row => `${row.title} ${row.reference}`,
                render: row => <div><strong>{row.title}</strong><span className="cell-subtext">{row.reference}</span></div>,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => row.owner,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => row.nextStep,
                render: row => <span className="muted-copy">{row.nextStep}</span>,
              },
            ]}
          />

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Manifest Rule</p>
              <h2>The manifest is a review index, not a deployment switch</h2>
              <span>Exporting the manifest records a report action only. Production follow-up still requires permissioned workflows, human confirmation where required, server-side handlers, rollback notes, and audit records.</span>
            </div>
            <StatusPill label={canExport ? 'Manifest export enabled' : 'Read only'} tone={canExport ? 'ok' : 'warn'} />
          </section>
        </>
      ) : viewMode === 'approval' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Suggested Decision" value={getSuggestedHandoffDecision(artifactManifest.status)} delta={artifactManifest.status} tone={getLaunchHandoffDecisionTone(getSuggestedHandoffDecision(artifactManifest.status))} icon={<ShieldCheck size={16} />} />
            <MetricCard label="Approval Ledger" value={String(handoffApprovals.length)} delta="Recorded handoffs" tone={handoffApprovals.length ? 'ok' : 'neutral'} icon={<ScrollText size={16} />} />
            <MetricCard label="Latest Decision" value={latestHandoffApproval?.decision ?? 'Pending'} delta={latestHandoffApproval ? formatDateTime(latestHandoffApproval.recordedAt) : 'No approval recorded'} tone={latestHandoffApproval ? getLaunchHandoffDecisionTone(latestHandoffApproval.decision) : 'warn'} icon={<UserCheck size={16} />} />
            <MetricCard label="Record Permission" value={canSignOff ? 'Enabled' : 'Read Only'} delta="settings.manage" tone={canSignOff ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
          </div>

          <section className={`panel launch-approval-panel tone-${getLaunchHandoffDecisionTone(handoffDecision)}`}>
            <div>
              <p className="eyebrow">Owner Handoff Approval</p>
              <h2>{latestHandoffApproval ? `${latestHandoffApproval.decision} recorded by ${latestHandoffApproval.recordedByRole}` : 'No final handoff approval recorded yet'}</h2>
              <span>This records the owner decision against the current launch manifest, executive brief, closure state, and audit trail. It does not execute production changes.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={handoffDecision} tone={getLaunchHandoffDecisionTone(handoffDecision)} />
              <strong>{handoffOwner}</strong>
              <span>{artifactManifest.readyRequiredCount}/{artifactManifest.requiredCount} required ready</span>
            </div>
          </section>

          <section className="panel launch-approval-form-panel">
            <div className="launch-packet-review-summary">
              <p className="eyebrow">Decision Record</p>
              <h2>Capture the final handoff posture</h2>
              <span>The decision is stored in the local approval ledger and audit log. Conditional or held decisions keep follow-up visible without creating a browser-side mutation path.</span>
              <div className="request-scope-list">
                <div><span>Manifest</span><strong>{artifactManifest.status}</strong></div>
                <div><span>Executive Brief</span><strong>{executiveBrief.recommendation}</strong></div>
                <div><span>Closure</span><strong>{closureModel.decision}</strong></div>
                <div><span>Gaps</span><strong>{artifactManifest.gaps.length}</strong></div>
              </div>
            </div>

            <div className="launch-packet-review-form">
              <div className="support-selector launch-signoff-selector" aria-label="Launch handoff decision">
                {launchHandoffDecisions.map(decision => (
                  <button key={decision} className={handoffDecision === decision ? 'selected' : ''} onClick={() => setHandoffDecision(decision)}>
                    <ShieldCheck size={15} strokeWidth={1.8} />
                    {decision}
                  </button>
                ))}
              </div>

              <label className="field compact-field">
                <span>Follow-Up Owner</span>
                <select value={handoffOwner} onChange={event => setHandoffOwner(event.target.value)}>
                  {launchSignOffOwners.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                </select>
              </label>

              <label className="field compact-field">
                <span>Condition Note</span>
                <textarea
                  value={handoffConditionNote}
                  onChange={event => setHandoffConditionNote(event.target.value)}
                  placeholder="Record approval conditions, hold reason, or launch handoff context."
                />
              </label>

              <label className="field compact-field">
                <span>Accepted Risk</span>
                <textarea
                  value={handoffAcceptedRisk}
                  onChange={event => setHandoffAcceptedRisk(event.target.value)}
                  placeholder="Capture accepted risk, explicit non-acceptance, or follow-up guardrails."
                />
              </label>

              <div className="support-actions">
                <button className="ghost-action" disabled={!canSignOff} onClick={recordHandoffApproval}>
                  <ShieldCheck size={15} strokeWidth={1.8} />
                  Record Approval
                </button>
                <StatusPill label={canSignOff ? 'Approval recording enabled' : 'Read only'} tone={canSignOff ? 'ok' : 'warn'} />
              </div>
            </div>
          </section>

          <DataTable
            label="Handoff Approval Ledger"
            rows={handoffApprovals}
            pageSize={6}
            emptyTitle="No launch handoff approvals have been recorded yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'decision',
                header: 'Decision',
                sortable: true,
                searchValue: row => `${row.decision} ${row.conditionNote}`,
                render: row => (
                  <div>
                    <StatusPill label={row.decision} tone={getLaunchHandoffDecisionTone(row.decision)} />
                    <span className="cell-subtext">{row.conditionNote}</span>
                  </div>
                ),
              },
              {
                key: 'posture',
                header: 'Posture',
                sortable: true,
                searchValue: row => `${row.manifestStatus} ${row.executiveRecommendation} ${row.closureDecision}`,
                render: row => (
                  <div>
                    <strong>{row.manifestStatus}</strong>
                    <span className="cell-subtext">{row.executiveRecommendation} / {row.closureDecision}</span>
                  </div>
                ),
              },
              {
                key: 'artifacts',
                header: 'Artifacts',
                sortable: true,
                searchValue: row => `${row.requiredReadyCount}/${row.requiredCount} ${row.handoffGapCount}`,
                render: row => (
                  <div>
                    <strong>{row.requiredReadyCount}/{row.requiredCount} ready</strong>
                    <span className="cell-subtext">{row.blockerCount} blocked / {row.reviewCount} review / {row.handoffGapCount} gaps</span>
                  </div>
                ),
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => `${row.followUpOwner} ${row.recordedByRole} ${row.recordedBy}`,
                render: row => <div><strong>{row.followUpOwner}</strong><span className="cell-subtext">{row.recordedByRole} / {row.recordedBy}</span></div>,
              },
              {
                key: 'risk',
                header: 'Accepted Risk',
                searchValue: row => row.acceptedRisk,
                render: row => <span className="muted-copy">{row.acceptedRisk}</span>,
              },
            ]}
          />

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Approval Rule</p>
              <h2>Approval records the decision; it does not launch the product</h2>
              <span>Any follow-up that changes production data still requires scoped permission checks, human confirmation where required, server-side handlers, rollback notes, and audit records.</span>
            </div>
            <StatusPill label={canSignOff ? 'Decision recording enabled' : 'Read only'} tone={canSignOff ? 'ok' : 'warn'} />
          </section>
        </>
      ) : viewMode === 'followup' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Open Follow-Ups" value={String(followUpRegister.openCount + followUpRegister.inProgressCount)} delta={`${followUpRegister.ownerCount} active owners`} tone={followUpRegister.openCount + followUpRegister.inProgressCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
            <MetricCard label="Blocked Follow-Ups" value={String(followUpRegister.blockedCount)} delta={`${followUpRegister.criticalCount} critical`} tone={followUpRegister.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Resolved" value={String(followUpRegister.resolvedCount)} delta="Local follow-up records" tone={followUpRegister.resolvedCount ? 'ok' : 'neutral'} icon={<CheckCircle2 size={16} />} />
            <MetricCard label="Update Permission" value={canManageFollowUps ? 'Enabled' : 'Read Only'} delta="admin_actions.manage" tone={canManageFollowUps ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
          </div>

          <section className={`panel launch-followup-panel tone-${selectedFollowUp ? getLaunchFollowUpStatusTone(selectedFollowUp.status) : 'ok'}`}>
            <div>
              <p className="eyebrow">Next Follow-Up</p>
              <h2>{followUpRegister.nextItem?.title ?? 'No launch follow-ups are waiting.'}</h2>
              <span>{followUpRegister.nextItem?.nextStep ?? 'All derived follow-up items are resolved for the current launch posture.'}</span>
            </div>
            <div className="launch-command-meta">
              {followUpRegister.nextItem ? (
                <>
                  <StatusPill label={followUpRegister.nextItem.status} tone={getLaunchFollowUpStatusTone(followUpRegister.nextItem.status)} />
                  <strong>{followUpRegister.nextItem.owner}</strong>
                  <span>{followUpRegister.nextItem.source} / {followUpRegister.nextItem.dueLabel}</span>
                </>
              ) : (
                <StatusPill label="Clear" tone="ok" />
              )}
            </div>
          </section>

          <section className="panel launch-followup-form-panel">
            <div className="launch-packet-review-summary">
              <p className="eyebrow">Follow-Up Control</p>
              <h2>{selectedFollowUp?.title ?? 'No follow-up selected'}</h2>
              <span>{selectedFollowUp?.evidence ?? 'Follow-up items appear after manifest gaps, held approvals, open action requests, read-contract fallbacks, or incomplete closure checks are present.'}</span>
              <div className="request-scope-list">
                <div><span>Source</span><strong>{selectedFollowUp?.source ?? 'Clear'}</strong></div>
                <div><span>Priority</span><strong>{selectedFollowUp?.priority ?? 'None'}</strong></div>
                <div><span>Due</span><strong>{selectedFollowUp?.dueLabel ?? 'No active due date'}</strong></div>
                <div><span>Audit</span><strong>{selectedFollowUp?.auditBacked ? 'Backed' : 'Pending'}</strong></div>
              </div>
            </div>

            <div className="launch-packet-review-form">
              <label className="field compact-field">
                <span>Follow-Up</span>
                <select value={selectedFollowUp?.id ?? ''} disabled={!followUpRegister.items.length} onChange={event => setSelectedFollowUpId(event.target.value)}>
                  {followUpRegister.items.length ? (
                    followUpRegister.items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)
                  ) : (
                    <option value="">No follow-ups</option>
                  )}
                </select>
              </label>

              <div className="support-selector launch-signoff-selector" aria-label="Launch follow-up status">
                {launchFollowUpStatuses.map(itemStatus => (
                  <button key={itemStatus} className={followUpStatus === itemStatus ? 'selected' : ''} disabled={!selectedFollowUp} onClick={() => setFollowUpStatus(itemStatus)}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    {itemStatus}
                  </button>
                ))}
              </div>

              <label className="field compact-field">
                <span>Owner</span>
                <select value={followUpOwner} disabled={!selectedFollowUp} onChange={event => setFollowUpOwner(event.target.value)}>
                  {followUpOwnerOptions.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                </select>
              </label>

              <label className="field compact-field">
                <span>Follow-Up Note</span>
                <textarea
                  value={followUpNote}
                  disabled={!selectedFollowUp}
                  onChange={event => setFollowUpNote(event.target.value)}
                  placeholder="Record progress, blocker context, or resolution evidence."
                />
              </label>

              <div className="support-actions">
                <button className="ghost-action" disabled={!canManageFollowUps || !selectedFollowUp} onClick={() => selectedFollowUp && recordFollowUpUpdate(selectedFollowUp)}>
                  <CheckCircle2 size={15} strokeWidth={1.8} />
                  Record Update
                </button>
                <button className="ghost-action" disabled={!canQueueAction || !selectedFollowUp || Boolean(selectedFollowUp?.linkedActionRequestId)} onClick={() => selectedFollowUp && queueFollowUpAction(selectedFollowUp)}>
                  <Send size={15} strokeWidth={1.8} />
                  Queue Action
                </button>
              </div>
            </div>
          </section>

          <DataTable
            label="Launch Follow-Up Register"
            rows={followUpRegister.items}
            pageSize={8}
            emptyTitle="No launch follow-ups are currently waiting."
            columns={[
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchFollowUpStatusTone(row.status)} />,
              },
              {
                key: 'priority',
                header: 'Priority',
                sortable: true,
                searchValue: row => row.priority,
                render: row => <StatusPill label={row.priority} tone={getLaunchFollowUpPriorityTone(row.priority)} />,
              },
              {
                key: 'item',
                header: 'Follow-Up',
                sortable: true,
                searchValue: row => `${row.title} ${row.source} ${row.reference}`,
                render: row => (
                  <button className="table-link" onClick={() => setSelectedFollowUpId(row.id)}>
                    {row.title}
                  </button>
                ),
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => row.owner,
              },
              {
                key: 'due',
                header: 'Due',
                sortable: true,
                searchValue: row => row.dueLabel,
                render: row => row.dueLabel,
              },
              {
                key: 'next',
                header: 'Next Step',
                searchValue: row => `${row.evidence} ${row.nextStep} ${row.note ?? ''}`,
                render: row => (
                  <div>
                    <strong>{row.nextStep}</strong>
                    <span className="cell-subtext">{row.note ?? row.evidence}</span>
                  </div>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                searchValue: row => `${row.auditBacked ? 'Audit backed' : 'Needs audit'} ${row.linkedActionRequestId ?? ''}`,
                render: row => (
                  <div className="support-actions">
                    <StatusPill label={row.auditBacked ? 'Audit backed' : 'Needs audit'} tone={row.auditBacked ? 'ok' : 'warn'} />
                    <button className="ghost-action" disabled={!canQueueAction || Boolean(row.linkedActionRequestId)} onClick={() => queueFollowUpAction(row)}>
                      <Send size={15} strokeWidth={1.8} />
                      Queue
                    </button>
                  </div>
                ),
              },
            ]}
          />

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Follow-Up Rule</p>
              <h2>The register tracks accountability; it does not mutate production state</h2>
              <span>Queueing a follow-up only creates an Admin Action Request. Any production change still requires scoped permission checks, human confirmation where required, a server-side handler, rollback notes, and audit records.</span>
            </div>
            <StatusPill label={canManageFollowUps ? 'Follow-up updates enabled' : 'Read only'} tone={canManageFollowUps ? 'ok' : 'warn'} />
          </section>
        </>
      ) : viewMode === 'watch' ? (
        <>
          <div className="metrics-grid compact">
            <MetricCard label="Watch Status" value={watchtower.status} delta={watchtower.baselineApproval ? `Baseline: ${watchtower.baselineApproval.decision}` : 'No approval baseline'} tone={getLaunchWatchTone(watchtower.status)} icon={<Gauge size={16} />} />
            <MetricCard label="Critical Signals" value={String(watchtower.criticalCount)} delta={`${watchtower.watchCount} watch signals`} tone={watchtower.criticalCount ? 'danger' : watchtower.watchCount ? 'warn' : 'ok'} icon={<AlertTriangle size={16} />} />
            <MetricCard label="Score Drift" value={`${watchtower.scoreDrift > 0 ? '+' : ''}${watchtower.scoreDrift} pts`} delta="Vs latest approval" tone={watchtower.scoreDrift < -9 ? 'danger' : watchtower.scoreDrift < 0 ? 'warn' : 'ok'} icon={<Gauge size={16} />} />
            <MetricCard label="Watch Checks" value={String(watchChecks.length)} delta={latestWatchCheck ? formatDateTime(latestWatchCheck.recordedAt) : 'No check recorded'} tone={latestWatchCheck ? getLaunchWatchTone(latestWatchCheck.status) : 'neutral'} icon={<ScrollText size={16} />} />
          </div>

          <section className={`panel launch-watch-panel tone-${getLaunchWatchTone(watchtower.status)}`}>
            <div>
              <p className="eyebrow">Launch Watchtower</p>
              <h2>{watchtower.summary}</h2>
              <span>Generated {formatDateTime(watchtower.generatedAt)} from the current readiness score, artifact manifest, latest handoff approval, follow-up register, action queue, and read-contract diagnostics.</span>
            </div>
            <div className="launch-command-meta">
              <StatusPill label={watchtower.status} tone={getLaunchWatchTone(watchtower.status)} />
              <strong>{watchtower.baselineApproval ? `${watchtower.baselineApproval.decision} / ${formatDateTime(watchtower.baselineApproval.recordedAt)}` : 'No baseline'}</strong>
              <button className="ghost-action" disabled={!canRecordReview} onClick={recordWatchCheck}>
                <ShieldCheck size={15} strokeWidth={1.8} />
                Record Check
              </button>
            </div>
          </section>

          <section className="panel launch-watch-source-panel">
            <div>
              <p className="eyebrow">Baseline Drift</p>
              <h2>Approval cannot silently go stale</h2>
              <span>The watchtower compares current launch state against the latest handoff decision. It flags missing approvals, score drops, manifest degradation, unresolved follow-up, action queue drift, and read-contract fallback.</span>
            </div>
            <div className="request-scope-list">
              <div><span>Current Readiness</span><strong>{model.score}% / {model.status}</strong></div>
              <div><span>Approved Readiness</span><strong>{watchtower.baselineApproval ? `${watchtower.baselineApproval.readinessScore}% / ${watchtower.baselineApproval.launchStatus}` : 'Pending'}</strong></div>
              <div><span>Manifest</span><strong>{artifactManifest.status}</strong></div>
              <div><span>Follow-Up</span><strong>{followUpRegister.blockedCount} blocked / {followUpRegister.openCount + followUpRegister.inProgressCount} active</strong></div>
              <div><span>Action Queue</span><strong>{actionRequests.filter(request => ['Draft', 'Queued', 'Approved', 'Running', 'Blocked', 'Failed'].includes(request.status)).length} open</strong></div>
              <div><span>Read Contracts</span><strong>{readViewDiagnostics.filter(diagnostic => diagnostic.status === 'ready').length} ready / {readViewDiagnostics.filter(diagnostic => diagnostic.status === 'fallback').length} fallback</strong></div>
              <div><span>Last Check</span><strong>{latestWatchCheck ? `${latestWatchCheck.status} / ${formatDateTime(latestWatchCheck.recordedAt)}` : 'Not recorded'}</strong></div>
              <div><span>Check Actor</span><strong>{latestWatchCheck?.recordedByRole ?? 'Pending'}</strong></div>
            </div>
          </section>

          <DataTable
            label="Launch Watch Signals"
            rows={watchtower.signals}
            pageSize={8}
            emptyTitle="No launch watch signals are available."
            columns={[
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => row.status,
                render: row => <StatusPill label={row.status} tone={getLaunchWatchSignalTone(row.status)} />,
              },
              {
                key: 'signal',
                header: 'Signal',
                sortable: true,
                searchValue: row => `${row.type} ${row.reference}`,
                render: row => <div><strong>{row.type}</strong><span className="cell-subtext">{row.reference}</span></div>,
              },
              {
                key: 'owner',
                header: 'Owner',
                sortable: true,
                searchValue: row => row.owner,
                render: row => row.owner,
              },
              {
                key: 'evidence',
                header: 'Evidence',
                searchValue: row => `${row.evidence} ${row.nextStep}`,
                render: row => <div><strong>{row.evidence}</strong><span className="cell-subtext">{row.nextStep}</span></div>,
              },
              {
                key: 'created',
                header: 'Updated',
                sortable: true,
                searchValue: row => row.createdAt,
                render: row => formatDateTime(row.createdAt),
              },
            ]}
          />

          <DataTable
            label="Watch Check Ledger"
            rows={watchChecks}
            pageSize={6}
            emptyTitle="No launch watch checks have been recorded yet."
            columns={[
              {
                key: 'recorded',
                header: 'Recorded',
                sortable: true,
                searchValue: row => row.recordedAt,
                render: row => formatDateTime(row.recordedAt),
              },
              {
                key: 'status',
                header: 'Status',
                sortable: true,
                searchValue: row => `${row.status} ${row.summary}`,
                render: row => <div><StatusPill label={row.status} tone={getLaunchWatchTone(row.status)} /><span className="cell-subtext">{row.summary}</span></div>,
              },
              {
                key: 'score',
                header: 'Score',
                sortable: true,
                searchValue: row => `${row.readinessScore} ${row.scoreDrift}`,
                render: row => `${row.readinessScore}% / ${row.scoreDrift > 0 ? '+' : ''}${row.scoreDrift} pts`,
              },
              {
                key: 'baseline',
                header: 'Baseline',
                sortable: true,
                searchValue: row => `${row.baselineDecision ?? ''} ${row.baselineApprovalId ?? ''}`,
                render: row => row.baselineDecision ?? 'Pending',
              },
              {
                key: 'actor',
                header: 'Actor',
                sortable: true,
                searchValue: row => `${row.recordedByRole} ${row.recordedBy}`,
                render: row => <div><strong>{row.recordedByRole}</strong><span className="cell-subtext">{row.recordedBy}</span></div>,
              },
            ]}
          />

          <section className="panel launch-boundary-panel">
            <div>
              <p className="eyebrow">Watch Rule</p>
              <h2>Watch checks are monitoring evidence, not launch execution</h2>
              <span>Recording a watch check writes audit evidence only. If a signal requires production follow-up, route it through Follow-Up and Admin Action Requests.</span>
            </div>
            <StatusPill label={canRecordReview ? 'Watch checks enabled' : 'Read only'} tone={canRecordReview ? 'ok' : 'warn'} />
          </section>
        </>
      ) : (
        <>
      <div className="metrics-grid compact">
        <MetricCard label="Readiness Score" value={`${model.score}%`} delta="Launch confidence" tone={scoreTone} icon={<Gauge size={16} />} />
        <MetricCard label="Ready Gates" value={String(model.readyCount)} delta={`${model.gates.length} total gates`} tone="ok" icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Watch Gates" value={String(model.watchCount)} delta="Owner review needed" tone={model.watchCount ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
        <MetricCard label="Blocked Gates" value={String(model.blockedCount)} delta={`${model.criticalCount} critical`} tone={model.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Evidence Items" value={String(evidenceLedger.entries.length)} delta="Launch proof trail" tone="neutral" icon={<ScrollText size={16} />} />
        <MetricCard label="Ledger Blockers" value={String(evidenceLedger.blockedCount)} delta="Needs resolution" tone={evidenceLedger.blockedCount ? 'danger' : 'ok'} icon={<AlertTriangle size={16} />} />
        <MetricCard label="Recorded Reviews" value={String(evidenceLedger.auditEventCount)} delta={`${evidenceLedger.exportCount} report exports`} tone="ok" icon={<ShieldCheck size={16} />} />
        <MetricCard label="Queue Evidence" value={String(evidenceLedger.actionQueueCount)} delta="Open server actions" tone={evidenceLedger.actionQueueCount ? 'warn' : 'ok'} icon={<ListChecks size={16} />} />
      </div>

      <div className="metrics-grid compact">
        <MetricCard label="Owner Sign-Offs" value={String(evidenceLedger.signOffCount)} delta="Audited launch decisions" tone={evidenceLedger.signOffCount ? 'ok' : 'neutral'} icon={<UserCheck size={16} />} />
        <MetricCard label="Sign-Off Permission" value={canSignOff ? 'Enabled' : 'Read Only'} delta="Requires settings.manage" tone={canSignOff ? 'ok' : 'warn'} icon={<ShieldCheck size={16} />} />
        <MetricCard label="Resolved Decisions" value={String(signOffs.filter(signOff => signOff.decision === 'Resolved').length)} delta="Local evidence ledger" tone="ok" icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Deferred Decisions" value={String(signOffs.filter(signOff => signOff.decision === 'Deferred').length)} delta="Needs follow-up" tone={signOffs.some(signOff => signOff.decision === 'Deferred') ? 'warn' : 'ok'} icon={<ClipboardCheck size={16} />} />
      </div>

      <section className="panel launch-boundary-panel">
        <div>
          <p className="eyebrow">Operating Boundary</p>
          <h2>Launch readiness is a review surface, not an execution surface</h2>
          <span>Every production-changing action still flows through permissioned server handlers, human approval where required, and immutable audit records.</span>
        </div>
        <StatusPill label={canRecordReview ? 'Reviews Enabled' : 'Read Only'} tone={canRecordReview ? 'ok' : 'warn'} />
      </section>

      <DataTable
        label="Evidence Ledger"
        rows={evidenceLedger.entries}
        pageSize={8}
        emptyTitle="No launch evidence has been recorded yet."
        columns={[
          {
            key: 'created',
            header: 'Date',
            sortable: true,
            searchValue: row => row.createdAt,
            render: row => formatDateTime(row.createdAt),
          },
          {
            key: 'type',
            header: 'Type',
            sortable: true,
            searchValue: row => `${row.type} ${row.source}`,
            render: row => <div><strong>{row.type}</strong><span className="cell-subtext">{row.source}</span></div>,
          },
          {
            key: 'status',
            header: 'Status',
            sortable: true,
            searchValue: row => row.status,
            render: row => <StatusPill label={row.status} tone={getLaunchEvidenceTone(row.status)} />,
          },
          {
            key: 'owner',
            header: 'Owner',
            sortable: true,
            searchValue: row => row.owner,
            render: row => row.owner,
          },
          {
            key: 'evidence',
            header: 'Evidence',
            searchValue: row => `${row.evidence} ${row.nextStep} ${row.reference}`,
            render: row => <div><strong>{row.evidence}</strong><span className="cell-subtext">{row.nextStep}</span></div>,
          },
          {
            key: 'reference',
            header: 'Reference',
            sortable: true,
            searchValue: row => row.reference,
            render: row => row.reference,
          },
        ]}
      />

      <div className="support-selector" aria-label="Launch gate area filters">
        {areaFilters.map(area => (
          <button key={area} className={selectedArea === area ? 'selected' : ''} onClick={() => setSelectedArea(area)}>
            <DatabaseZap size={15} strokeWidth={1.8} />
            {area}
          </button>
        ))}
      </div>

      <div className="launch-readiness-layout">
        <DataTable
          label="Launch Gates"
          rows={rows}
          pageSize={9}
          emptyTitle="No launch gates match this area."
          columns={[
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              searchValue: row => row.status,
              render: row => <StatusPill label={row.status} tone={getLaunchGateTone(row.status)} />,
            },
            {
              key: 'gate',
              header: 'Gate',
              sortable: true,
              searchValue: row => `${row.title} ${row.evidence} ${row.nextStep}`,
              render: row => (
                <div>
                  <button className="table-link" onClick={() => setSelectedId(row.id)}>{row.title}</button>
                  {latestSignOffByGate.get(row.id) && <span className="cell-subtext">Latest: {latestSignOffByGate.get(row.id)?.decision} by {latestSignOffByGate.get(row.id)?.assignedTo}</span>}
                </div>
              ),
            },
            {
              key: 'area',
              header: 'Area',
              sortable: true,
              searchValue: row => row.area,
              render: row => row.area,
            },
            {
              key: 'severity',
              header: 'Severity',
              sortable: true,
              searchValue: row => row.severity,
              render: row => <StatusPill label={row.severity} tone={getLaunchSeverityTone(row.severity)} />,
            },
            {
              key: 'owner',
              header: 'Owner',
              sortable: true,
              searchValue: row => row.owner,
              render: row => row.owner,
            },
            {
              key: 'impact',
              header: 'Impact',
              sortable: true,
              searchValue: row => String(row.scoreImpact),
              render: row => `${row.scoreImpact} pts`,
            },
          ]}
        />

        <aside className="detail-panel launch-detail-panel">
          {selectedGate ? (
            <>
              <div className="detail-header">
                <div>
                  <p className="eyebrow">Gate Detail</p>
                  <h2>{selectedGate.title}</h2>
                </div>
                <StatusPill label={selectedGate.status} tone={getLaunchGateTone(selectedGate.status)} />
              </div>

              <div className="request-scope-list">
                <div><span>Area</span><strong>{selectedGate.area}</strong></div>
                <div><span>Owner</span><strong>{selectedGate.owner}</strong></div>
                <div><span>Severity</span><strong>{selectedGate.severity}</strong></div>
                <div><span>Score Impact</span><strong>{selectedGate.scoreImpact} pts</strong></div>
                <div><span>Surface</span><strong>{selectedGate.linkedSurface}</strong></div>
                <div><span>Review</span><strong>{selectedGate.status === 'Ready' ? 'Monitoring' : 'Required'}</strong></div>
              </div>

              {selectedSignOff && (
                <div className="detail-section">
                  <h3>Latest Sign-Off</h3>
                  <div className="request-scope-list">
                    <div><span>Decision</span><strong>{selectedSignOff.decision}</strong></div>
                    <div><span>Assigned To</span><strong>{selectedSignOff.assignedTo}</strong></div>
                    <div><span>Actor</span><strong>{selectedSignOff.actorRole}</strong></div>
                    <div><span>Date</span><strong>{formatDateTime(selectedSignOff.createdAt)}</strong></div>
                  </div>
                  <p className="muted-copy">{selectedSignOff.note}</p>
                </div>
              )}

              <div className="detail-section">
                <h3>Evidence</h3>
                <p className="muted-copy">{selectedGate.evidence}</p>
              </div>

              <div className="detail-section">
                <h3>Next Step</h3>
                <p className="warning-copy">{selectedGate.nextStep}</p>
              </div>

              <div className="detail-section">
                <h3>Gate Controls</h3>
                <div className="settings-rule-list">
                  <div><ShieldCheck size={16} strokeWidth={1.8} /><strong>Keep cross-tenant access explicit, scoped, permissioned, and audited.</strong></div>
                  <div><UserCheck size={16} strokeWidth={1.8} /><strong>Require human approval before mutations that affect client state, billing, modules, permissions, support records, or agent actions.</strong></div>
                  <div><ListChecks size={16} strokeWidth={1.8} /><strong>Route production-changing work through Admin Action Requests.</strong></div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Action Panel</h3>
                <div className="support-actions">
                  <button className="ghost-action" disabled={!canRecordReview} onClick={() => recordLaunchReview(selectedGate)}>
                    <CheckCircle2 size={15} strokeWidth={1.8} />
                    Record Review
                  </button>
                  <button className="ghost-action" onClick={onOpenActionRequests}>
                    <ListChecks size={15} strokeWidth={1.8} />
                    Open Queue
                  </button>
                </div>
              </div>

              <div className="detail-section">
                <h3>Owner Sign-Off</h3>
                <div className="support-selector launch-signoff-selector" aria-label="Launch sign-off decision">
                  {launchSignOffDecisions.map(decision => (
                    <button key={decision} className={signOffDecision === decision ? 'selected' : ''} onClick={() => setSignOffDecision(decision)}>
                      <UserCheck size={15} strokeWidth={1.8} />
                      {decision}
                    </button>
                  ))}
                </div>

                <label className="field compact-field">
                  <span>Assigned Owner</span>
                  <select value={signOffOwner} onChange={event => setSignOffOwner(event.target.value)}>
                    {launchSignOffOwners.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                  </select>
                </label>

                <label className="field compact-field">
                  <span>Decision Note</span>
                  <textarea
                    value={signOffNote}
                    onChange={event => setSignOffNote(event.target.value)}
                    placeholder="Capture decision context, deferral reason, or resolution evidence."
                  />
                </label>

                <div className="support-actions">
                  <button className="ghost-action" disabled={!canSignOff} onClick={() => recordSignOff(selectedGate)}>
                    <UserCheck size={15} strokeWidth={1.8} />
                    Record Sign-Off
                  </button>
                  {selectedSignOff && <StatusPill label={selectedSignOff.decision} tone={getLaunchSignOffDecisionTone(selectedSignOff.decision)} />}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state compact">No launch gate selected.</div>
          )}
        </aside>
      </div>
        </>
      )}
    </div>
  )
}

function getCommandGateId(itemId: string) {
  if (itemId.startsWith('gate-blocker-')) return itemId.replace('gate-blocker-', '')
  if (itemId.startsWith('signoff-required-')) return itemId.replace('signoff-required-', '')
  return ''
}

function buildLaunchSavedViewMetadata(view: LaunchCommandSavedView, extra: Record<string, unknown>) {
  return {
    savedViewId: view.id,
    savedViewName: view.name,
    scope: view.scope,
    status: view.status,
    audience: view.audience,
    defaultSurface: view.defaultSurface,
    queryHint: view.queryHint,
    resultCount: view.resultCount,
    criticalCount: view.criticalCount,
    actionNeededCount: view.actionNeededCount,
    auditBackedCount: view.auditBackedCount,
    ownerCount: view.ownerCount,
    filters: view.filters,
    columns: view.columns,
    ...extra,
  }
}

function getLaunchSavedViewSurfaceLabel(surface: LaunchCommandSavedViewSurface) {
  if (surface === 'goNoGo') return 'Go / No-Go'
  if (surface === 'backendClosure') return 'Backend Closure'
  if (surface === 'productionGuardrails') return 'Guardrails'
  if (surface === 'followup') return 'Follow-Up'
  if (surface === 'warRoom') return 'War Room'
  return 'Command Mode'
}

function getLaunchSavedViewMetricTone(status: LaunchCommandSavedView['status']) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Review') return 'warn' as const
  return 'ok' as const
}

function buildLaunchExceptionSlaMetadata(item: LaunchExceptionSlaItem, extra: Record<string, unknown>) {
  return {
    slaItemId: item.id,
    title: item.title,
    owner: item.owner,
    priority: item.priority,
    status: item.status,
    reviewStatus: item.reviewStatus,
    level: item.level,
    source: item.source,
    reference: item.reference,
    dueAt: item.dueAt,
    slaMinutes: item.slaMinutes,
    minutesRemaining: item.minutesRemaining,
    defaultSurface: item.defaultSurface,
    auditBacked: item.auditBacked,
    localOnly: item.localOnly,
    actionHandoffRequired: item.actionHandoffRequired,
    ...extra,
  }
}

function sanitizeLaunchActionKey(value: string) {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_')
}

function launchSlaStatusSortValue(status: LaunchExceptionSlaStatus) {
  if (status === 'Overdue') return '0 Overdue'
  if (status === 'Due Soon') return '1 Due Soon'
  if (status === 'Needs Review') return '2 Needs Review'
  if (status === 'On Track') return '3 On Track'
  return '4 Acknowledged'
}

function buildLaunchOwnerBriefMetadata(brief: LaunchOwnerDailyBrief, extra: Record<string, unknown>) {
  return {
    briefStatus: brief.status,
    headline: brief.headline,
    readinessScore: brief.readinessScore,
    launchStatus: brief.launchStatus,
    goNoGoDecision: brief.goNoGoDecision,
    decisionCount: brief.decisionCount,
    criticalCount: brief.criticalCount,
    actionNeededCount: brief.actionNeededCount,
    overdueSlaCount: brief.overdueSlaCount,
    dueSoonSlaCount: brief.dueSoonSlaCount,
    actionHandoffCount: brief.actionHandoffCount,
    auditBackedCount: brief.auditBackedCount,
    activeOwnerCount: brief.activeOwnerCount,
    topDecision: brief.nextDecision?.title,
    ...extra,
  }
}

function buildLaunchOwnerBriefDecisionMetadata(decision: LaunchOwnerDailyBriefDecision, extra: Record<string, unknown>) {
  return {
    decisionId: decision.id,
    title: decision.title,
    status: decision.status,
    owner: decision.owner,
    source: decision.source,
    reference: decision.reference,
    ask: decision.ask,
    surface: decision.surface,
    auditBacked: decision.auditBacked,
    localOnly: decision.localOnly,
    ...extra,
  }
}

function getLaunchOwnerBriefMetricTone(status: LaunchOwnerDailyBrief['status']) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Attention') return 'warn' as const
  return 'ok' as const
}

function launchOwnerDecisionSortValue(status: LaunchOwnerDailyBriefDecisionStatus) {
  if (status === 'Critical') return '0 Critical'
  if (status === 'Action Needed') return '1 Action Needed'
  if (status === 'Review') return '2 Review'
  return '3 Ready'
}

function buildLaunchEvidencePacketMetadata(packet: LaunchEvidencePacket, extra: Record<string, unknown>) {
  return {
    packetStatus: packet.status,
    headline: packet.headline,
    launchStatus: packet.launchStatus,
    readinessScore: packet.readinessScore,
    goNoGoDecision: packet.goNoGoDecision,
    itemCount: packet.items.length,
    requiredCount: packet.requiredCount,
    requiredSatisfiedCount: packet.requiredSatisfiedCount,
    missingCount: packet.missingCount,
    reviewCount: packet.reviewCount,
    readyCount: packet.readyCount,
    verifiedCount: packet.verifiedCount,
    auditBackedCount: packet.auditBackedCount,
    localOnlyCount: packet.localOnlyCount,
    topGap: packet.nextItem?.title,
    ...extra,
  }
}

function buildLaunchEvidencePacketItemMetadata(item: LaunchEvidencePacketItem, extra: Record<string, unknown>) {
  return {
    packetItemId: item.id,
    category: item.category,
    title: item.title,
    status: item.status,
    required: item.required,
    owner: item.owner,
    reference: item.reference,
    surface: item.surface,
    auditBacked: item.auditBacked,
    localOnly: item.localOnly,
    ...extra,
  }
}

function getLaunchEvidencePacketMetricTone(status: LaunchEvidencePacket['status']) {
  if (status === 'Blocked') return 'danger' as const
  if (status === 'Incomplete') return 'warn' as const
  if (status === 'Ready For Review') return 'neutral' as const
  return 'ok' as const
}

function launchEvidencePacketSortValue(status: LaunchEvidencePacketItemStatus) {
  if (status === 'Missing') return '0 Missing'
  if (status === 'Review') return '1 Review'
  if (status === 'Ready') return '2 Ready'
  return '3 Verified'
}

function getLaunchEvidencePacketSurfaceLabel(surface: LaunchEvidencePacketSurface) {
  if (surface === 'goNoGo') return 'Go / No-Go'
  if (surface === 'backendClosure') return 'Backend Closure'
  if (surface === 'productionGuardrails') return 'Guardrails'
  if (surface === 'followup') return 'Follow-Up'
  if (surface === 'warRoom') return 'War Room'
  if (surface === 'savedViews') return 'Saved Views'
  if (surface === 'exceptionSla') return 'Exception SLA'
  if (surface === 'ownerBrief') return 'Owner Brief'
  if (surface === 'closure') return 'Closure'
  if (surface === 'brief') return 'Executive Brief'
  if (surface === 'manifest') return 'Artifact Manifest'
  if (surface === 'approval') return 'Approval'
  if (surface === 'watch') return 'Watch'
  if (surface === 'detail') return 'Full Detail'
  return 'Command Mode'
}

function buildPostLaunchWatchtowerMetadata(watchtower: LaunchPostLaunchWatchtower, extra: Record<string, unknown>) {
  return {
    postLaunchStatus: watchtower.status,
    headline: watchtower.headline,
    signalCount: watchtower.signals.length,
    criticalCount: watchtower.criticalCount,
    watchCount: watchtower.watchCount,
    monitoringCount: watchtower.monitoringCount,
    stableCount: watchtower.stableCount,
    actionRequiredCount: watchtower.actionRequiredCount,
    auditBackedCount: watchtower.auditBackedCount,
    localOnlyCount: watchtower.localOnlyCount,
    nextSignal: watchtower.nextSignal?.title,
    ...extra,
  }
}

function buildPostLaunchSignalMetadata(signal: LaunchPostLaunchSignal, extra: Record<string, unknown>) {
  return {
    signalId: signal.id,
    lane: signal.lane,
    status: signal.status,
    title: signal.title,
    owner: signal.owner,
    reference: signal.reference,
    responseWindow: signal.responseWindow,
    actionRequired: signal.actionRequired,
    surface: signal.surface,
    auditBacked: signal.auditBacked,
    localOnly: signal.localOnly,
    ...extra,
  }
}

function buildPostLaunchIncidentCommanderMetadata(commander: LaunchPostLaunchIncidentCommander, extra: Record<string, unknown>) {
  return {
    incidentCommanderStatus: commander.status,
    headline: commander.headline,
    incidentCount: commander.incidents.length,
    openIncidentCount: commander.openIncidentCount,
    sev1Count: commander.sev1Count,
    sev2Count: commander.sev2Count,
    sev3Count: commander.sev3Count,
    sev4Count: commander.sev4Count,
    commsDraftCount: commander.commsDraftCount,
    mitigationReadyCount: commander.mitigationReadyCount,
    monitoringCount: commander.monitoringCount,
    closureReadyCount: commander.closureReadyCount,
    auditBackedCount: commander.auditBackedCount,
    actionRequiredCount: commander.actionRequiredCount,
    nextIncident: commander.nextIncident?.title,
    ...extra,
  }
}

function buildPostLaunchIncidentMetadata(incident: LaunchPostLaunchIncidentPacket, extra: Record<string, unknown>) {
  return {
    incidentId: incident.id,
    sourceSignalId: incident.sourceSignalId,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    commander: incident.commander,
    lane: incident.lane,
    reference: incident.reference,
    surface: incident.surface,
    responseWindow: incident.responseWindow,
    affectedClients: incident.affectedClients,
    affectedVenues: incident.affectedVenues,
    linkedActionCount: incident.linkedActionCount,
    linkedAuditCount: incident.linkedAuditCount,
    auditBacked: incident.auditBacked,
    actionRequired: incident.actionRequired,
    ...extra,
  }
}

function buildLaunchCommsApprovalCenterMetadata(center: LaunchCommsApprovalCenter, extra: Record<string, unknown>) {
  return {
    communicationsStatus: center.status,
    headline: center.headline,
    draftCount: center.drafts.length,
    pendingReviewCount: center.pendingReviewCount,
    approvedDraftCount: center.approvedDraftCount,
    holdCount: center.holdCount,
    customerFacingCount: center.customerFacingCount,
    internalUpdateCount: center.internalUpdateCount,
    ownerUpdateCount: center.ownerUpdateCount,
    auditBackedCount: center.auditBackedCount,
    actionRequiredCount: center.actionRequiredCount,
    nextDraft: center.nextDraft?.title,
    ...extra,
  }
}

function buildLaunchCommsDraftMetadata(draft: LaunchCommsApprovalDraft, extra: Record<string, unknown>) {
  return {
    draftId: draft.id,
    title: draft.title,
    audience: draft.audience,
    channel: draft.channel,
    status: draft.status,
    sourceIncidentId: draft.sourceIncidentId,
    sourceIncidentTitle: draft.sourceIncidentTitle,
    severity: draft.severity,
    reference: draft.reference,
    surface: draft.surface,
    owner: draft.owner,
    approvalOwner: draft.approvalOwner,
    auditBacked: draft.auditBacked,
    actionRequired: draft.actionRequired,
    ...extra,
  }
}

function buildLaunchSendReviewQueueMetadata(queue: LaunchSendReviewQueue, extra: Record<string, unknown>) {
  return {
    sendReviewStatus: queue.status,
    headline: queue.headline,
    itemCount: queue.items.length,
    pendingReviewCount: queue.pendingReviewCount,
    handoffQueuedCount: queue.handoffQueuedCount,
    approvedCount: queue.approvedCount,
    blockedCount: queue.blockedCount,
    customerFacingCount: queue.customerFacingCount,
    internalCount: queue.internalCount,
    ownerUpdateCount: queue.ownerUpdateCount,
    auditBackedCount: queue.auditBackedCount,
    actionRequiredCount: queue.actionRequiredCount,
    nextItem: queue.nextItem?.title,
    ...extra,
  }
}

function buildLaunchSendReviewItemMetadata(item: LaunchSendReviewItem, extra: Record<string, unknown>) {
  return {
    itemId: item.id,
    title: item.title,
    status: item.status,
    audience: item.audience,
    channel: item.channel,
    sourceDraftId: item.sourceDraftId,
    sourceDraftTitle: item.sourceDraftTitle,
    sourceIncidentTitle: item.sourceIncidentTitle,
    severity: item.severity,
    reference: item.reference,
    surface: item.surface,
    owner: item.owner,
    approvalOwner: item.approvalOwner,
    sendOwner: item.sendOwner,
    customerFacing: item.customerFacing,
    auditBacked: item.auditBacked,
    actionRequired: item.actionRequired,
    ...extra,
  }
}

function buildLaunchDeliveryEvidenceLedgerMetadata(ledger: LaunchDeliveryEvidenceLedger, extra: Record<string, unknown>) {
  return {
    deliveryEvidenceStatus: ledger.status,
    headline: ledger.headline,
    itemCount: ledger.items.length,
    needsProofCount: ledger.needsProofCount,
    proofReviewCount: ledger.proofReviewCount,
    completeCount: ledger.completeCount,
    blockedCount: ledger.blockedCount,
    customerFacingCount: ledger.customerFacingCount,
    internalCount: ledger.internalCount,
    ownerUpdateCount: ledger.ownerUpdateCount,
    auditBackedCount: ledger.auditBackedCount,
    actionRequiredCount: ledger.actionRequiredCount,
    sourceHandoffCount: ledger.sourceHandoffCount,
    nextItem: ledger.nextItem?.title,
    ...extra,
  }
}

function buildLaunchDeliveryEvidenceItemMetadata(item: LaunchDeliveryEvidenceItem, extra: Record<string, unknown>) {
  return {
    itemId: item.id,
    title: item.title,
    status: item.status,
    sourceSendReviewId: item.sourceSendReviewId,
    sourceSendReviewTitle: item.sourceSendReviewTitle,
    sourceSendReviewStatus: item.sourceSendReviewStatus,
    sourceDraftTitle: item.sourceDraftTitle,
    sourceIncidentTitle: item.sourceIncidentTitle,
    audience: item.audience,
    channel: item.channel,
    severity: item.severity,
    reference: item.reference,
    surface: item.surface,
    owner: item.owner,
    approvalOwner: item.approvalOwner,
    sendOwner: item.sendOwner,
    proofOwner: item.proofOwner,
    customerFacing: item.customerFacing,
    auditBacked: item.auditBacked,
    actionRequired: item.actionRequired,
    ...extra,
  }
}

function buildLaunchRecipientResponseMonitorMetadata(monitor: LaunchRecipientResponseMonitor, extra: Record<string, unknown>) {
  return {
    recipientResponseStatus: monitor.status,
    headline: monitor.headline,
    itemCount: monitor.items.length,
    awaitingCount: monitor.awaitingCount,
    acknowledgedCount: monitor.acknowledgedCount,
    followUpCount: monitor.followUpCount,
    escalatedCount: monitor.escalatedCount,
    closedCount: monitor.closedCount,
    customerFacingCount: monitor.customerFacingCount,
    internalCount: monitor.internalCount,
    ownerUpdateCount: monitor.ownerUpdateCount,
    evidenceCompleteCount: monitor.evidenceCompleteCount,
    auditBackedCount: monitor.auditBackedCount,
    actionRequiredCount: monitor.actionRequiredCount,
    nextItem: monitor.nextItem?.title,
    ...extra,
  }
}

function buildLaunchRecipientResponseItemMetadata(item: LaunchRecipientResponseItem, extra: Record<string, unknown>) {
  return {
    itemId: item.id,
    title: item.title,
    status: item.status,
    sourceDeliveryEvidenceId: item.sourceDeliveryEvidenceId,
    sourceDeliveryEvidenceTitle: item.sourceDeliveryEvidenceTitle,
    sourceDeliveryEvidenceStatus: item.sourceDeliveryEvidenceStatus,
    sourceSendReviewStatus: item.sourceSendReviewStatus,
    sourceDraftTitle: item.sourceDraftTitle,
    sourceIncidentTitle: item.sourceIncidentTitle,
    audience: item.audience,
    channel: item.channel,
    severity: item.severity,
    reference: item.reference,
    surface: item.surface,
    owner: item.owner,
    proofOwner: item.proofOwner,
    responseOwner: item.responseOwner,
    customerFacing: item.customerFacing,
    auditBacked: item.auditBacked,
    actionRequired: item.actionRequired,
    ...extra,
  }
}

function buildLaunchClosureEvidencePackMetadata(pack: LaunchClosureEvidencePack, extra: Record<string, unknown>) {
  return {
    closureEvidenceStatus: pack.status,
    headline: pack.headline,
    itemCount: pack.items.length,
    needsPacketCount: pack.needsPacketCount,
    reviewCount: pack.reviewCount,
    readyCount: pack.readyCount,
    closedCount: pack.closedCount,
    blockedCount: pack.blockedCount,
    customerFacingCount: pack.customerFacingCount,
    evidenceCompleteCount: pack.evidenceCompleteCount,
    responseClearCount: pack.responseClearCount,
    auditBackedCount: pack.auditBackedCount,
    actionRequiredCount: pack.actionRequiredCount,
    nextItem: pack.nextItem?.title,
    ...extra,
  }
}

function buildLaunchClosureEvidenceItemMetadata(item: LaunchClosureEvidenceItem, extra: Record<string, unknown>) {
  return {
    itemId: item.id,
    title: item.title,
    status: item.status,
    sourceRecipientResponseId: item.sourceRecipientResponseId,
    sourceRecipientResponseTitle: item.sourceRecipientResponseTitle,
    sourceRecipientResponseStatus: item.sourceRecipientResponseStatus,
    sourceDeliveryEvidenceStatus: item.sourceDeliveryEvidenceStatus,
    sourceSendReviewStatus: item.sourceSendReviewStatus,
    sourceDraftTitle: item.sourceDraftTitle,
    sourceIncidentTitle: item.sourceIncidentTitle,
    audience: item.audience,
    channel: item.channel,
    severity: item.severity,
    reference: item.reference,
    surface: item.surface,
    owner: item.owner,
    proofOwner: item.proofOwner,
    responseOwner: item.responseOwner,
    closureOwner: item.closureOwner,
    packetSection: item.packetSection,
    customerFacing: item.customerFacing,
    auditBacked: item.auditBacked,
    actionRequired: item.actionRequired,
    ...extra,
  }
}

function buildLaunchFinalAuditRoomMetadata(room: LaunchFinalAuditRoom, extra: Record<string, unknown>) {
  return {
    finalAuditStatus: room.status,
    headline: room.headline,
    auditScore: room.auditScore,
    itemCount: room.items.length,
    blockedCount: room.blockedCount,
    needsEvidenceCount: room.needsEvidenceCount,
    reviewCount: room.reviewCount,
    readyCount: room.readyCount,
    closedCount: room.closedCount,
    customerFacingCount: room.customerFacingCount,
    auditRecordCount: room.auditRecordCount,
    actionRequiredCount: room.actionRequiredCount,
    nextItem: room.nextItem?.title,
    ...extra,
  }
}

function buildLaunchFinalAuditItemMetadata(item: LaunchFinalAuditItem, extra: Record<string, unknown>) {
  return {
    itemId: item.id,
    stage: item.stage,
    title: item.title,
    status: item.status,
    sourceStatus: item.sourceStatus,
    owner: item.owner,
    reference: item.reference,
    targetView: item.targetView,
    auditRecordCount: item.auditRecordCount,
    customerFacingCount: item.customerFacingCount,
    actionRequiredCount: item.actionRequiredCount,
    actionRequired: item.actionRequired,
    ...extra,
  }
}

function buildLaunchAuditArchiveVaultMetadata(vault: LaunchAuditArchiveVault, extra: Record<string, unknown>) {
  return {
    archiveStatus: vault.status,
    headline: vault.headline,
    finalAuditStatus: vault.finalAuditStatus,
    finalAuditScore: vault.finalAuditScore,
    itemCount: vault.items.length,
    blockedCount: vault.blockedCount,
    needsArchiveCount: vault.needsArchiveCount,
    reviewCount: vault.reviewCount,
    readyCount: vault.readyCount,
    archivedCount: vault.archivedCount,
    customerFacingCount: vault.customerFacingCount,
    auditRecordCount: vault.auditRecordCount,
    actionRequiredCount: vault.actionRequiredCount,
    nextItem: vault.nextItem?.title,
    ...extra,
  }
}

function buildLaunchAuditArchiveItemMetadata(item: LaunchAuditArchiveItem, extra: Record<string, unknown>) {
  return {
    itemId: item.id,
    category: item.category,
    title: item.title,
    status: item.status,
    sourceFinalAuditItemId: item.sourceFinalAuditItemId,
    sourceFinalAuditStage: item.sourceFinalAuditStage,
    sourceFinalAuditStatus: item.sourceFinalAuditStatus,
    sourceStatus: item.sourceStatus,
    owner: item.owner,
    reference: item.reference,
    targetView: item.targetView,
    archiveRequirement: item.archiveRequirement,
    auditRecordCount: item.auditRecordCount,
    customerFacingCount: item.customerFacingCount,
    actionRequiredCount: item.actionRequiredCount,
    actionRequired: item.actionRequired,
    ...extra,
  }
}

function postLaunchSignalSortValue(status: LaunchPostLaunchSignalStatus) {
  if (status === 'Critical') return '0 Critical'
  if (status === 'Watch') return '1 Watch'
  if (status === 'Monitoring') return '2 Monitoring'
  return '3 Stable'
}

function incidentSeveritySortValue(severity: LaunchPostLaunchIncidentSeverity) {
  if (severity === 'SEV1') return '0 SEV1'
  if (severity === 'SEV2') return '1 SEV2'
  if (severity === 'SEV3') return '2 SEV3'
  return '3 SEV4'
}

function incidentStatusSortValue(status: LaunchPostLaunchIncidentStatus) {
  if (status === 'Investigating') return '0 Investigating'
  if (status === 'Mitigation Ready') return '1 Mitigation Ready'
  if (status === 'Monitoring') return '2 Monitoring'
  return '3 Closure Ready'
}

function getPostLaunchSurfaceLabel(surface: LaunchPostLaunchSurface) {
  if (surface === 'backendWatch') return 'Backend Watch'
  if (surface === 'productionGuardrails') return 'Guardrails'
  if (surface === 'warRoom') return 'War Room'
  if (surface === 'evidencePacket') return 'Evidence Packet'
  if (surface === 'closure') return 'Closure'
  if (surface === 'followup') return 'Follow-Up'
  if (surface === 'watch') return 'Launch Watch'
  if (surface === 'detail') return 'Full Detail'
  return 'Command Mode'
}
