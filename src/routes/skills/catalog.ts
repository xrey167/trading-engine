export interface SkillDef {
  readonly command: string;
  readonly description: string;
  readonly category: string;
  readonly allowedTools?: readonly string[];
}

export const SKILL_CATALOG = {
  // ── Data ──────────────────────────────────────────
  'data/analyze':           { command: 'data:analyze',               category: 'data', description: 'Answer data questions' },
  'data/explore':           { command: 'data:explore-data',          category: 'data', description: 'Profile and explore a dataset' },
  'data/validate':          { command: 'data:validate',              category: 'data', description: 'QA an analysis before sharing' },
  'data/write-query':       { command: 'data:write-query',           category: 'data', description: 'Write optimized SQL' },
  'data/create-viz':        { command: 'data:create-viz',            category: 'data', description: 'Create publication-quality visualizations' },
  'data/context-extractor': { command: 'data:data-context-extractor',category: 'data', description: 'Generate data context file' },
  'data/visualization':     { command: 'data:data-visualization',    category: 'data', description: 'Create data visualizations' },
  'data/exploration':       { command: 'data:data-exploration',      category: 'data', description: 'Profile and explore data' },
  'data/validation':        { command: 'data:data-validation',       category: 'data', description: 'Validate data quality' },

  // ── Equity Research ───────────────────────────────
  'equity-research/earnings':          { command: 'equity-research:earnings',          category: 'equity-research', description: 'Analyze quarterly earnings' },
  'equity-research/earnings-preview':  { command: 'equity-research:earnings-preview',  category: 'equity-research', description: 'Pre-earnings preview note' },
  'equity-research/initiate':          { command: 'equity-research:initiate',          category: 'equity-research', description: 'Initiating coverage report' },
  'equity-research/model-update':      { command: 'equity-research:model-update',      category: 'equity-research', description: 'Update financial model' },
  'equity-research/morning-note':      { command: 'equity-research:morning-note',      category: 'equity-research', description: 'Morning meeting note' },
  'equity-research/screen':            { command: 'equity-research:screen',            category: 'equity-research', description: 'Stock screen' },
  'equity-research/sector':            { command: 'equity-research:sector',            category: 'equity-research', description: 'Sector overview' },
  'equity-research/thesis':            { command: 'equity-research:thesis',            category: 'equity-research', description: 'Investment thesis' },
  'equity-research/catalysts':         { command: 'equity-research:catalysts',         category: 'equity-research', description: 'Catalyst calendar' },
  'equity-research/idea-generation':   { command: 'equity-research:idea-generation',   category: 'equity-research', description: 'Idea generation' },
  'equity-research/thesis-tracker':    { command: 'equity-research:thesis-tracker',    category: 'equity-research', description: 'Thesis tracker' },
  'equity-research/sector-overview':   { command: 'equity-research:sector-overview',   category: 'equity-research', description: 'Sector overview (detailed)' },
  'equity-research/catalyst-calendar': { command: 'equity-research:catalyst-calendar', category: 'equity-research', description: 'Catalyst calendar (detailed)' },

  // ── Financial Analysis ────────────────────────────
  'financial-analysis/3-statements':   { command: 'financial-analysis:3-statements',       category: 'financial-analysis', description: '3-statement model' },
  'financial-analysis/check-deck':     { command: 'financial-analysis:check-deck',         category: 'financial-analysis', description: 'QC presentation deck' },
  'financial-analysis/competitive':    { command: 'financial-analysis:competitive-analysis',category: 'financial-analysis', description: 'Competitive landscape' },
  'financial-analysis/comps':          { command: 'financial-analysis:comps',               category: 'financial-analysis', description: 'Comparable company analysis' },
  'financial-analysis/dcf':            { command: 'financial-analysis:dcf',                 category: 'financial-analysis', description: 'DCF valuation model' },
  'financial-analysis/debug-model':    { command: 'financial-analysis:debug-model',         category: 'financial-analysis', description: 'Debug financial model' },
  'financial-analysis/lbo':            { command: 'financial-analysis:lbo',                 category: 'financial-analysis', description: 'LBO model' },
  'financial-analysis/ppt-template':   { command: 'financial-analysis:ppt-template',        category: 'financial-analysis', description: 'Reusable PPT template' },
  'financial-analysis/comps-analysis': { command: 'financial-analysis:comps-analysis',      category: 'financial-analysis', description: 'Institutional-grade comps' },
  'financial-analysis/dcf-model':      { command: 'financial-analysis:dcf-model',           category: 'financial-analysis', description: 'DCF model (standalone)' },
  'financial-analysis/lbo-model':      { command: 'financial-analysis:lbo-model',           category: 'financial-analysis', description: 'LBO model (standalone)' },

  // ── Finance ───────────────────────────────────────
  'finance/statements':                { command: 'finance:financial-statements',  category: 'finance', description: 'Generate financial statements' },

  // ── Investment Banking ────────────────────────────
  'investment-banking/cim-builder':    { command: 'investment-banking:cim-builder',    category: 'investment-banking', description: 'CIM builder' },
  'investment-banking/deal-tracker':   { command: 'investment-banking:deal-tracker',   category: 'investment-banking', description: 'Deal tracker' },
  'investment-banking/merger-model':   { command: 'investment-banking:merger-model',   category: 'investment-banking', description: 'Accretion/dilution model' },
  'investment-banking/one-pager':      { command: 'investment-banking:one-pager',      category: 'investment-banking', description: 'Company one-pager' },
  'investment-banking/process-letter': { command: 'investment-banking:process-letter', category: 'investment-banking', description: 'Process letter' },
  'investment-banking/teaser':         { command: 'investment-banking:teaser',         category: 'investment-banking', description: 'Anonymous teaser' },
  'investment-banking/datapack':       { command: 'investment-banking:datapack-builder',category: 'investment-banking', description: 'Financial datapack' },
  'investment-banking/strip-profile':  { command: 'investment-banking:strip-profile',  category: 'investment-banking', description: 'Professional strip profile' },
  'investment-banking/coverage':       { command: 'equity-research:initiating-coverage',category: 'investment-banking', description: 'Initiating coverage' },

  // ── LSEG ──────────────────────────────────────────
  'lseg/equity-research':     { command: 'lseg:equity-research',        category: 'lseg', description: 'Comprehensive equity research' },
  'lseg/bond-basis':          { command: 'lseg:analyze-bond-basis',     category: 'lseg', description: 'Bond futures basis analysis' },
  'lseg/bond-rv':             { command: 'lseg:analyze-bond-rv',        category: 'lseg', description: 'Bond relative value analysis' },
  'lseg/fx-carry':            { command: 'lseg:analyze-fx-carry',       category: 'lseg', description: 'FX carry trade analysis' },
  'lseg/option-vol':          { command: 'lseg:analyze-option-vol',     category: 'lseg', description: 'Option volatility analysis' },
  'lseg/swap-curve':          { command: 'lseg:analyze-swap-curve',     category: 'lseg', description: 'Swap curve analysis' },
  'lseg/fixed-income':        { command: 'lseg:fixed-income-portfolio', category: 'lseg', description: 'Fixed income portfolio review' },
  'lseg/macro-rates':         { command: 'lseg:macro-rates-monitor',    category: 'lseg', description: 'Macro rates dashboard' },
  'lseg/option-vol-analysis': { command: 'lseg:option-vol-analysis',    category: 'lseg', description: 'Option vol analysis (detailed)' },
  'lseg/fx-carry-trade':      { command: 'lseg:fx-carry-trade',         category: 'lseg', description: 'FX carry trade (detailed)' },

  // ── Private Equity ────────────────────────────────
  'private-equity/portfolio':         { command: 'private-equity:portfolio',          category: 'private-equity', description: 'Portfolio review' },
  'private-equity/portfolio-monitor': { command: 'private-equity:portfolio-monitoring',category: 'private-equity', description: 'Portfolio monitoring' },
  'private-equity/returns':           { command: 'private-equity:returns',            category: 'private-equity', description: 'IRR/MOIC sensitivity' },
  'private-equity/returns-analysis':  { command: 'private-equity:returns-analysis',   category: 'private-equity', description: 'Returns analysis' },
  'private-equity/screen-deal':       { command: 'private-equity:screen-deal',        category: 'private-equity', description: 'Screen inbound deal' },
  'private-equity/source':            { command: 'private-equity:source',             category: 'private-equity', description: 'Source deals' },
  'private-equity/unit-economics':    { command: 'private-equity:unit-economics',     category: 'private-equity', description: 'Unit economics analysis' },
  'private-equity/value-creation':    { command: 'private-equity:value-creation',     category: 'private-equity', description: 'Value creation plan' },

  // ── Wealth Management ─────────────────────────────
  'wealth-management/financial-plan': { command: 'wealth-management:financial-plan',  category: 'wealth-management', description: 'Financial plan' },
  'wealth-management/proposal':       { command: 'wealth-management:proposal',        category: 'wealth-management', description: 'Investment proposal' },
  'wealth-management/rebalance':      { command: 'wealth-management:rebalance',       category: 'wealth-management', description: 'Portfolio rebalance' },
  'wealth-management/tax-loss':       { command: 'wealth-management:tax-loss-harvesting', category: 'wealth-management', description: 'Tax-loss harvesting' },

  // ── S&P Global ────────────────────────────────────
  'sp-global/earnings-preview':       { command: 'sp-global:earnings-preview-beta',   category: 'sp-global', description: 'Earnings preview' },
  'sp-global/funding-digest':         { command: 'sp-global:funding-digest',          category: 'sp-global', description: 'Funding digest' },

  // ── Legal ─────────────────────────────────────────
  'legal/vendor-check':               { command: 'legal:vendor-check',               category: 'legal', description: 'Vendor agreement check' },

  // ── Misc ──────────────────────────────────────────
  'chrome':                           { command: 'chrome',                           category: 'tools', description: 'Chrome browser automation' },
  'check-model':                      { command: 'check-model',                      category: 'tools', description: 'Check model info' },
  'earnings-analysis':                { command: 'equity-research:earnings-analysis', category: 'equity-research', description: 'Earnings analysis' },
} as const satisfies Record<string, SkillDef>;

export type SkillKey = keyof typeof SKILL_CATALOG;
