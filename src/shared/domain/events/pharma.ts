import type { EventDefinition } from './types.js';
import {
  EventDomain, EventFrequency, EventImportance, EventMultiplier,
  EventSector, EventTimeMode, EventType, EventUnit,
} from './types.js';

const PHARMA_BASE = {
  type: EventType.Event,
  sector: EventSector.Pharma,
  domain: EventDomain.Pharma,
  timeMode: EventTimeMode.Tentative,
  unit: EventUnit.None,
  multiplier: EventMultiplier.None,
  digits: 0,
  currency: 'ALL',
} as const;

const US_PHARMA = { ...PHARMA_BASE, countryCode: 'US' as const, countryId: 840 };

export const PHARMA_EVENTS: readonly EventDefinition[] = [
  { id: 'PHARMA.PHARMA.PDUFA_DECISION', name: 'PDUFA Target Action Date', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA issues approval/rejection decision on NDA or BLA by PDUFA target date', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.PDUFA_FILING', name: 'NDA/BLA Filing Accepted', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'NDA/BLA officially accepted for FDA review, triggers PDUFA review clock', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.SUPPLEMENT_DECISION', name: 'Supplemental NDA/BLA Decision', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA decision on supplemental application (new indication, dosage, formulation)', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.NEW_INDICATION', name: 'New Indication Approved', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA approves supplemental application for new therapeutic indication', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.COMPLETE_RESPONSE', name: 'Complete Response Letter', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA rejects NDA/BLA in current form, identifies deficiencies requiring resubmission', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.ADCOM_MEETING', name: 'Advisory Committee Meeting', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA advisory committee votes on safety and efficacy of drug application', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.ADCOM_WAIVED', name: 'Advisory Committee Waived', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA announces advisory committee meeting not required (often a positive signal)', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.BREAKTHROUGH_THERAPY', name: 'Breakthrough Therapy Designation', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA grants breakthrough therapy designation for expedited review and rolling submission', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.FAST_TRACK', name: 'Fast Track Designation', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA grants fast track status enabling rolling review and more frequent FDA interaction', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.ACCELERATED_APPROVAL', name: 'Accelerated Approval', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Drug approved based on surrogate endpoint, requires post-approval confirmatory trial', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.ORPHAN_DRUG', name: 'Orphan Drug Designation', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA grants orphan drug designation for rare disease (<200K patients), 7-year exclusivity', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.PHASE_1_START', name: 'Phase 1 Trial Initiation (IND)', importance: EventImportance.Low, frequency: EventFrequency.None, description: 'FDA approves IND application, Phase 1 human clinical studies begin', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.PHASE_2_READOUT', name: 'Phase 2 Data Readout', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Phase 2 clinical trial results announced (safety, efficacy, dose selection)', ...PHARMA_BASE },
  { id: 'PHARMA.PHARMA.PHASE_3_READOUT', name: 'Phase 3 Topline Results', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Phase 3 confirmatory trial topline results announced (primary endpoint met/missed)', ...PHARMA_BASE },
  { id: 'PHARMA.PHARMA.CLINICAL_HOLD', name: 'Clinical Trial Hold', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA places clinical trial on hold due to safety concerns', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.WARNING_LETTER', name: 'FDA Warning Letter', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA issues warning letter for regulatory violations (data integrity, cGMP, etc.)', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.DRUG_WITHDRAWAL', name: 'Drug Withdrawal/Recall', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Approved drug voluntarily withdrawn from market or recalled due to safety issue', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.LABEL_RESTRICTION', name: 'Label Safety Restriction', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA mandates label change restricting use (e.g., patient population limitation)', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.IMPORT_ALERT', name: 'Import Alert / Manufacturing Hold', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA restricts imports from manufacturing facility due to cGMP or safety violations', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.REMS_CHANGE', name: 'REMS Program Change', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA mandates or modifies Risk Evaluation and Mitigation Strategy program', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.PRIORITY_REVIEW', name: 'Priority Review Granted', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'Drug designated for priority review (6-month vs. 10-month standard timeline)', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.ROLLING_REVIEW', name: 'Rolling Review Active', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA begins reviewing NDA/BLA sections as submitted rather than waiting for complete application', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.FACILITY_INSPECTION', name: 'FDA Facility Inspection Result', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA conducts manufacturing facility inspection, results affect approval readiness', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.PATENT_EXTENSION', name: 'Patent Term Extension (Hatch-Waxman)', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA grants up to 5-year patent term extension for approved drug', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.BIOSIMILAR_APPROVAL', name: 'Biosimilar Approval', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA approves biosimilar product (impacts reference biologic revenue)', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.ANDA_APPROVAL', name: 'Generic Drug Approval (ANDA)', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA approves abbreviated new drug application for generic version', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.PATENT_CHALLENGE', name: 'Paragraph IV Patent Challenge', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Generic manufacturer challenges brand-name drug patent validity (Paragraph IV certification)', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.EXCLUSIVITY_EXPIRY', name: 'Market Exclusivity Expiration', importance: EventImportance.High, frequency: EventFrequency.None, description: 'Drug market exclusivity period expires, opening market to generic/biosimilar competition', ...PHARMA_BASE },
  { id: 'PHARMA.PHARMA.BLACK_BOX_WARNING', name: 'Black Box Warning Added', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA adds black box warning (strongest safety warning) to drug label', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.SAFETY_SIGNAL', name: 'Post-Market Safety Signal', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA identifies post-market safety signal from adverse event reports or studies', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.CLASS_RECALL', name: 'Class I/II Drug Recall', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA Class I or Class II drug recall (serious health risk or reversible adverse effects)', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.PEDIATRIC_EXCLUSIVITY', name: 'Pediatric Exclusivity Granted', importance: EventImportance.Low, frequency: EventFrequency.None, description: 'FDA grants 6-month pediatric exclusivity extension for completed pediatric studies', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.GENE_THERAPY_DECISION', name: 'Gene/Cell Therapy Decision', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA decision on gene therapy or cell therapy BLA (specialized review pathway)', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.RARE_DISEASE_VOUCHER', name: 'Rare Pediatric Disease Voucher', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA grants rare pediatric disease priority review voucher (transferable asset)', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.EUA_DECISION', name: 'Emergency Use Authorization', importance: EventImportance.High, frequency: EventFrequency.None, description: 'FDA issues or revokes Emergency Use Authorization for drug, vaccine, or diagnostic', ...US_PHARMA },
  { id: 'PHARMA.PHARMA.COMBO_PRODUCT', name: 'Combination Product Decision', importance: EventImportance.Moderate, frequency: EventFrequency.None, description: 'FDA decision on drug + device or drug + biologic combination product', ...US_PHARMA },
] as const;
