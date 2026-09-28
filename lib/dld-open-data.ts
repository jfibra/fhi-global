// Dubai Land Department (DLD) open-data catalog.
//
// Mirrors the nine tabs on https://dubailand.gov.ae/en/open-data/real-estate-data/
// (Transactions, Rents, Project, Valuations, Land, Building, Unit, Broker,
// Developer). Each dataset describes the gateway command it POSTs to, the
// filter fields it accepts (names are the DLD `P_*` parameters, verbatim), the
// sort key it defaults to, and the columns worth showing from the response.
//
// Shared by the admin page (renders the filter form + table from this) and
// the proxy route in app/api/admin/dld/[command] (only forwards parameters a
// dataset declares, so the gateway never sees anything we did not author).
//
// The gateway is a public, unauthenticated API. It is proxied server-side
// rather than called from the browser so the DLD origin never has to enter
// the CSP, and so the page stays role-gated end to end.

export const DLD_GATEWAY = "https://gateway.dubailand.gov.ae/open-data"

/** Date format the gateway expects for every P_FROM_DATE / P_TO_DATE. */
export const DLD_DATE_FORMAT = "MM/DD/YYYY"

export type DldOption = { value: string; label: string }

export type DldFilterKind = "date" | "select" | "text" | "lookup"

export type DldLookupName = "carea-lookup" | "projects-lookup" | "ejari-property-types"

export interface DldFilterField {
  /** The DLD parameter name, sent verbatim (e.g. "P_AREA_ID"). */
  param: string
  label: string
  kind: DldFilterKind
  required?: boolean
  /** Static options for `select` fields. Leading "All" is added by the UI. */
  options?: DldOption[]
  /** Which gateway lookup command feeds a `lookup` field. */
  lookup?: DldLookupName
  /** Initial value. Dates accept "today" / "yesterday" / "-30d". */
  defaultValue?: string
  placeholder?: string
}

export type DldColumnFormat = "text" | "date" | "datetime" | "number" | "money" | "area" | "percent"

export interface DldColumn {
  key: string
  label: string
  format?: DldColumnFormat
}

export interface DldDataset {
  /** Tab slug + gateway command (`/open-data/{command}`). */
  command: DldCommand
  label: string
  description: string
  filters: DldFilterField[]
  /**
   * Parameters the gateway insists on receiving (it answers with an HTML 500
   * page when any is missing) but that have no UI control here. Always sent
   * as "".
   */
  hiddenParams?: string[]
  /** P_SORT sent on the first load. `{FIELD}_ASC` / `{FIELD}_DESC`. */
  defaultSort: string
  /** Columns the table sorts on (must be sort keys the gateway accepts). */
  sortable: string[]
  columns: DldColumn[]
}

export const DLD_COMMANDS = [
  "transactions",
  "rents",
  "projects",
  "valuations",
  "lands",
  "buildings",
  "units",
  "brokers",
  "developers",
] as const

export type DldCommand = (typeof DLD_COMMANDS)[number]

export const DLD_LOOKUPS: readonly DldLookupName[] = ["carea-lookup", "projects-lookup", "ejari-property-types"]

export function isDldCommand(value: string): value is DldCommand {
  return (DLD_COMMANDS as readonly string[]).includes(value)
}

export function isDldLookup(value: string): value is DldLookupName {
  return (DLD_LOOKUPS as readonly string[]).includes(value)
}

// ─── Shared option lists ─────────────────────────────────────────────────────
// Values are the codes the DLD site itself submits.

const YES_NO: DldOption[] = [
  { value: "1", label: "Yes" },
  { value: "0", label: "No" },
]

const READY_OFFPLAN: DldOption[] = [
  { value: "0", label: "Ready" },
  { value: "1", label: "Off Plan" },
]

const ZONES: DldOption[] = [
  { value: "1", label: "Deira" },
  { value: "2", label: "Dubai" },
]

const PROPERTY_TYPES: DldOption[] = [
  { value: "1", label: "Land" },
  { value: "2", label: "Building" },
  { value: "3", label: "Unit" },
]

const USAGES: DldOption[] = [
  { value: "1", label: "Residential" },
  { value: "2", label: "Commercial" },
  { value: "3", label: "Other" },
]

const AREA: DldFilterField = { param: "P_AREA_ID", label: "Area", kind: "lookup", lookup: "carea-lookup" }
const ZONE: DldFilterField = { param: "P_ZONE_ID", label: "Zone", kind: "select", options: ZONES }
const FREE_HOLD: DldFilterField = { param: "P_IS_FREE_HOLD", label: "Is Free Hold?", kind: "select", options: YES_NO }
const LEASE_HOLD: DldFilterField = { param: "P_IS_LEASE_HOLD", label: "Is Lease Hold?", kind: "select", options: YES_NO }

// ─── Datasets ────────────────────────────────────────────────────────────────

export const DLD_DATASETS: Record<DldCommand, DldDataset> = {
  transactions: {
    command: "transactions",
    label: "Transactions",
    description: "Registered sales, mortgages and gifts.",
    filters: [
      { param: "P_FROM_DATE", label: "From Date", kind: "date", required: true, defaultValue: "yesterday" },
      { param: "P_TO_DATE", label: "To Date", kind: "date", required: true, defaultValue: "today" },
      {
        param: "P_GROUP_ID",
        label: "Transaction Type",
        kind: "select",
        options: [
          { value: "1", label: "Sales" },
          { value: "2", label: "Mortgages" },
          { value: "3", label: "Gifts" },
        ],
      },
      { param: "P_IS_OFFPLAN", label: "Registration type", kind: "select", options: READY_OFFPLAN },
      FREE_HOLD,
      AREA,
      { param: "P_USAGE_ID", label: "Usage", kind: "select", options: USAGES },
      { param: "P_PROP_TYPE_ID", label: "Property Type", kind: "select", options: PROPERTY_TYPES },
    ],
    defaultSort: "TRANSACTION_NUMBER_ASC",
    sortable: ["TRANSACTION_NUMBER", "INSTANCE_DATE", "TRANS_VALUE", "PROCEDURE_AREA", "ACTUAL_AREA"],
    columns: [
      { key: "TRANSACTION_NUMBER", label: "Transaction No." },
      { key: "INSTANCE_DATE", label: "Date", format: "datetime" },
      { key: "GROUP_EN", label: "Type" },
      { key: "PROCEDURE_EN", label: "Procedure" },
      { key: "IS_OFFPLAN_EN", label: "Registration" },
      { key: "IS_FREE_HOLD_EN", label: "Free Hold" },
      { key: "USAGE_EN", label: "Usage" },
      { key: "AREA_EN", label: "Area" },
      { key: "PROP_TYPE_EN", label: "Property Type" },
      { key: "PROP_SB_TYPE_EN", label: "Sub Type" },
      { key: "TRANS_VALUE", label: "Amount (AED)", format: "money" },
      { key: "PROCEDURE_AREA", label: "Transaction Size (sqm)", format: "area" },
      { key: "ACTUAL_AREA", label: "Property Size (sqm)", format: "area" },
      { key: "ROOMS_EN", label: "Rooms" },
      { key: "PARKING", label: "Parking" },
      { key: "PROJECT_EN", label: "Project" },
      { key: "MASTER_PROJECT_EN", label: "Master Project" },
      { key: "NEAREST_METRO_EN", label: "Nearest Metro" },
      { key: "NEAREST_MALL_EN", label: "Nearest Mall" },
      { key: "NEAREST_LANDMARK_EN", label: "Nearest Landmark" },
      { key: "TOTAL_BUYER", label: "Buyers", format: "number" },
      { key: "TOTAL_SELLER", label: "Sellers", format: "number" },
    ],
  },

  rents: {
    command: "rents",
    label: "Rents",
    description: "Ejari rental contracts.",
    filters: [
      {
        param: "P_DATE_TYPE",
        label: "Date",
        kind: "select",
        required: true,
        defaultValue: "0",
        options: [
          { value: "0", label: "Registration Date" },
          { value: "1", label: "Start Date" },
          { value: "2", label: "End Date" },
        ],
      },
      { param: "P_FROM_DATE", label: "From Date", kind: "date", required: true, defaultValue: "yesterday" },
      { param: "P_TO_DATE", label: "To Date", kind: "date", required: true, defaultValue: "today" },
      FREE_HOLD,
      {
        param: "P_VERSION",
        label: "Version",
        kind: "select",
        options: [
          { value: "1", label: "New" },
          { value: "2", label: "Renew" },
        ],
      },
      AREA,
      {
        param: "P_USAGE_ID",
        label: "Usage",
        kind: "select",
        options: [
          { value: "1", label: "Residential" },
          { value: "2", label: "Commercial" },
          { value: "-999", label: "Other" },
        ],
      },
      { param: "P_PROP_TYPE_ID", label: "Property Type", kind: "lookup", lookup: "ejari-property-types" },
    ],
    defaultSort: "REGISTRATION_DATE_ASC",
    sortable: ["REGISTRATION_DATE", "START_DATE", "END_DATE", "CONTRACT_AMOUNT", "ANNUAL_AMOUNT", "ACTUAL_AREA"],
    columns: [
      { key: "CONTRACT_NUMBER", label: "Contract No." },
      { key: "REGISTRATION_DATE", label: "Registration Date", format: "date" },
      { key: "START_DATE", label: "Start Date", format: "date" },
      { key: "END_DATE", label: "End Date", format: "date" },
      { key: "VERSION_EN", label: "Version" },
      { key: "IS_FREE_HOLD_EN", label: "Free Hold" },
      { key: "AREA_EN", label: "Area" },
      { key: "CONTRACT_AMOUNT", label: "Contract Amount (AED)", format: "money" },
      { key: "ANNUAL_AMOUNT", label: "Annual Amount (AED)", format: "money" },
      { key: "ACTUAL_AREA", label: "Property Size (sqm)", format: "area" },
      { key: "PROP_TYPE_EN", label: "Property Type" },
      { key: "PROP_SUB_TYPE_EN", label: "Sub Type" },
      { key: "USAGE_EN", label: "Usage" },
      { key: "ROOMS", label: "Rooms" },
      { key: "PARKING", label: "Parking" },
      { key: "PROJECT_EN", label: "Project" },
      { key: "MASTER_PROJECT_EN", label: "Master Project" },
      { key: "NEAREST_METRO_EN", label: "Nearest Metro" },
      { key: "NEAREST_MALL_EN", label: "Nearest Mall" },
      { key: "NEAREST_LANDMARK_EN", label: "Nearest Landmark" },
      { key: "TOTAL_PROPERTIES", label: "Properties", format: "number" },
    ],
  },

  projects: {
    command: "projects",
    label: "Project",
    description: "Registered real-estate development projects.",
    filters: [
      {
        param: "P_DATE_TYPE",
        label: "Date",
        kind: "select",
        required: true,
        defaultValue: "1",
        options: [
          { value: "1", label: "Start Date" },
          { value: "2", label: "End Date" },
          { value: "3", label: "Adoption Date" },
          { value: "4", label: "Completion Date" },
        ],
      },
      { param: "P_FROM_DATE", label: "From Date", kind: "date", required: true, defaultValue: "-30d" },
      { param: "P_TO_DATE", label: "To Date", kind: "date", required: true, defaultValue: "today" },
      AREA,
      ZONE,
      {
        param: "P_PRJ_STATUS",
        label: "Project Status",
        kind: "select",
        options: [
          { value: "ACTIVE", label: "Active" },
          { value: "FINISHED", label: "Finished" },
          { value: "FRIEZED", label: "Freezed" },
          { value: "UNDER_REVIEWING", label: "Under Reviewing" },
          { value: "CONDITIONAL_ACTIVATING", label: "Conditional Activating" },
          { value: "UNDER_CANCELATION_NOTIFICATION", label: "Under Cancellation Notification" },
          { value: "UNDER_CANCELATION_DECISION", label: "Under Cancellation Decision" },
          { value: "CANCELLED", label: "Cancelled" },
        ],
      },
    ],
    // The DLD site has no project-type dropdown but still posts the key.
    hiddenParams: ["P_PRJ_TYPE_ID"],
    defaultSort: "PROJECT_NUMBER_ASC",
    sortable: ["PROJECT_NUMBER", "START_DATE", "END_DATE", "PROJECT_VALUE", "PERCENT_COMPLETED"],
    columns: [
      { key: "PROJECT_NUMBER", label: "Project No." },
      { key: "PROJECT_EN", label: "Project" },
      { key: "DEVELOPER_NUMBER", label: "Developer No." },
      { key: "DEVELOPER_EN", label: "Developer" },
      { key: "PROJECT_STATUS", label: "Status" },
      { key: "PRJ_TYPE_EN", label: "Type" },
      { key: "START_DATE", label: "Start Date", format: "date" },
      { key: "END_DATE", label: "End Date", format: "date" },
      { key: "ADOPTION_DATE", label: "Adoption Date", format: "date" },
      { key: "COMPLETION_DATE", label: "Completion Date", format: "date" },
      { key: "INSPECTION_DATE", label: "Inspection Date", format: "date" },
      { key: "PERCENT_COMPLETED", label: "Completed", format: "percent" },
      { key: "PROJECT_VALUE", label: "Project Value (AED)", format: "money" },
      { key: "ESCROW_ACCOUNT_NUMBER", label: "Escrow Account" },
      { key: "AREA_EN", label: "Area" },
      { key: "ZONE_EN", label: "Zone" },
      { key: "MASTER_PROJECT_EN", label: "Master Project" },
      { key: "DESCRIPTION_EN", label: "Description" },
      { key: "CNT_LAND", label: "Lands", format: "number" },
      { key: "CNT_BUILDING", label: "Buildings", format: "number" },
      { key: "CNT_VILLA", label: "Villas", format: "number" },
      { key: "CNT_UNIT", label: "Units", format: "number" },
      { key: "CNT_TOTAL", label: "Total", format: "number" },
    ],
  },

  valuations: {
    command: "valuations",
    label: "Valuations",
    description: "Property valuation procedures.",
    filters: [
      { param: "P_FROM_DATE", label: "From Date", kind: "date", required: true, defaultValue: "-30d" },
      { param: "P_TO_DATE", label: "To Date", kind: "date", required: true, defaultValue: "today" },
      AREA,
      { param: "P_PROP_TYPE_ID", label: "Property Type", kind: "select", options: PROPERTY_TYPES },
    ],
    defaultSort: "PROPERTY_TOTAL_VALUE_ASC",
    sortable: ["PROPERTY_TOTAL_VALUE", "ACTUAL_AREA", "PROCEDURE_YEAR", "PROCEDURE_NUMBER", "INSTANCE_DATE", "ACTUAL_WORTH"],
    columns: [
      { key: "PROCEDURE_YEAR", label: "Year" },
      { key: "PROCEDURE_NUMBER", label: "Procedure No." },
      { key: "INSTANCE_DATE", label: "Date", format: "datetime" },
      { key: "AREA_EN", label: "Area" },
      { key: "PROPERTY_TYPE_EN", label: "Property Type" },
      { key: "PROP_SUB_TYPE_EN", label: "Sub Type" },
      { key: "PROPERTY_TOTAL_VALUE", label: "Total Value (AED)", format: "money" },
      { key: "ACTUAL_WORTH", label: "Actual Worth (AED)", format: "money" },
      { key: "ACTUAL_AREA", label: "Property Size (sqm)", format: "area" },
      { key: "PROCEDURE_AREA", label: "Procedure Size (sqm)", format: "area" },
      { key: "ROW_STATUS_CODE", label: "Status" },
    ],
  },

  lands: {
    command: "lands",
    label: "Land",
    description: "Registered land plots.",
    filters: [
      { param: "P_PROJECT", label: "Project", kind: "lookup", lookup: "projects-lookup" },
      { param: "P_MASTER_PROJECT", label: "Master Project", kind: "text", placeholder: "Master project name" },
      {
        param: "P_LAND_TYPE_ID",
        label: "Land Type",
        kind: "select",
        options: [
          { value: "1", label: "Residential" },
          { value: "2", label: "Agricultural" },
          { value: "3", label: "Industrial" },
          { value: "4", label: "Commercial" },
          { value: "5", label: "Public Facilities" },
          { value: "6", label: "Government Authority" },
        ],
      },
      AREA,
      FREE_HOLD,
      ZONE,
    ],
    // No sub-type dropdown on the DLD site either, but the key must be posted.
    hiddenParams: ["P_PROP_SB_TYPE_ID"],
    defaultSort: "LAND_TYPE_EN_ASC",
    sortable: ["LAND_TYPE_EN", "AREA_EN", "LAND_NUMBER", "ACTUAL_AREA"],
    columns: [
      { key: "LAND_NUMBER", label: "Land No." },
      { key: "LAND_SUB_NUMBER", label: "Sub No." },
      { key: "LAND_TYPE_EN", label: "Land Type" },
      { key: "PROP_SUB_TYPE_EN", label: "Sub Type" },
      { key: "AREA_EN", label: "Area" },
      { key: "ZONE_EN", label: "Zone" },
      { key: "ACTUAL_AREA", label: "Size (sqm)", format: "area" },
      { key: "IS_FREE_HOLD_EN", label: "Free Hold" },
      { key: "IS_OFFPLAN_EN", label: "Registration" },
      { key: "PROJECT_EN", label: "Project" },
      { key: "MASTER_PROJECT_EN", label: "Master Project" },
      { key: "DM_ZIP_CODE", label: "DM Zip" },
      { key: "MUNICIPALITY_NUMBER", label: "Municipality No." },
      { key: "PARCEL_ID", label: "Parcel ID" },
      { key: "PRE_REGISTRATION_NUMBER", label: "Pre-registration No." },
      { key: "SEPARATED_FROM", label: "Separated From" },
      { key: "SEPARATED_REFERENCE", label: "Separated Ref." },
    ],
  },

  buildings: {
    command: "buildings",
    label: "Building",
    description: "Registered buildings.",
    filters: [
      AREA,
      ZONE,
      { param: "P_FROM_DATE", label: "From Date", kind: "date" },
      { param: "P_TO_DATE", label: "To Date", kind: "date" },
      FREE_HOLD,
      LEASE_HOLD,
      {
        param: "P_IS_OFFPLAN",
        label: "Registration type",
        kind: "select",
        options: [
          { value: "0", label: "Completed" },
          { value: "1", label: "Off Plan" },
        ],
      },
    ],
    defaultSort: "PROP_SUB_TYPE_EN_ASC",
    sortable: ["PROP_SUB_TYPE_EN", "AREA_EN", "BUILDING_NUMBER", "ACTUAL_AREA", "CREATION_DATE"],
    columns: [
      { key: "BUILDING_NUMBER", label: "Building No." },
      { key: "PROP_SUB_TYPE_EN", label: "Type" },
      { key: "AREA_EN", label: "Area" },
      { key: "ZONE_EN", label: "Zone" },
      { key: "LAND_NUMBER", label: "Land No." },
      { key: "LAND_SUB_NUMBER", label: "Land Sub No." },
      { key: "PROJECT_EN", label: "Project" },
      { key: "MASTER_PROJECT_EN", label: "Master Project" },
      { key: "IS_FREE_HOLD_EN", label: "Free Hold" },
      { key: "IS_LEASE_HOLD_EN", label: "Lease Hold" },
      { key: "IS_OFFPLAN_EN", label: "Registration" },
      { key: "CREATION_DATE", label: "Created", format: "date" },
      { key: "ACTUAL_AREA", label: "Size (sqm)", format: "area" },
      { key: "BUILT_UP_AREA", label: "Built-up (sqm)", format: "area" },
      { key: "COMMON_AREA", label: "Common Area", format: "area" },
      { key: "ACTUAL_COMMON_AREA", label: "Actual Common Area", format: "area" },
      { key: "FLOORS", label: "Floors", format: "number" },
      { key: "BLD_LEVELS", label: "Levels", format: "number" },
      { key: "FLATS", label: "Flats", format: "number" },
      { key: "SHOPS", label: "Shops", format: "number" },
      { key: "OFFICES", label: "Offices", format: "number" },
      { key: "ROOMS_EN", label: "Rooms" },
      { key: "CAR_PARKS", label: "Car Parks", format: "number" },
      { key: "ELEVATORS", label: "Elevators", format: "number" },
      { key: "SWIMMING_POOLS", label: "Pools", format: "number" },
      { key: "PARCEL_ID", label: "Parcel ID" },
      { key: "PRE_REGISTRATION_NUMBER", label: "Pre-registration No." },
    ],
  },

  units: {
    command: "units",
    label: "Unit",
    description: "Registered units (flats, offices, shops).",
    filters: [
      AREA,
      ZONE,
      { ...FREE_HOLD, defaultValue: "1" },
      LEASE_HOLD,
      { param: "P_IS_OFFPLAN", label: "Registration type", kind: "select", options: READY_OFFPLAN },
    ],
    defaultSort: "UNIT_NUMBER_ASC",
    sortable: ["UNIT_NUMBER", "AREA_EN", "ACTUAL_AREA", "CREATION_DATE"],
    columns: [
      { key: "UNIT_NUMBER", label: "Unit No." },
      { key: "PROP_SUB_TYPE_EN", label: "Type" },
      { key: "AREA_EN", label: "Area" },
      { key: "ZONE_EN", label: "Zone" },
      { key: "BUILDING_NUMBER", label: "Building No." },
      { key: "LAND_NUMBER", label: "Land No." },
      { key: "LAND_SUB_NUMBER", label: "Land Sub No." },
      { key: "PROJECT_EN", label: "Project" },
      { key: "MASTER_PROJECT_EN", label: "Master Project" },
      { key: "FLOOR", label: "Floor" },
      { key: "ROOMS_EN", label: "Rooms" },
      { key: "ACTUAL_AREA", label: "Size (sqm)", format: "area" },
      { key: "BALCONY_AREA", label: "Balcony (sqm)", format: "area" },
      { key: "COMMON_AREA", label: "Common Area", format: "area" },
      { key: "ACTUAL_COMMON_AREA", label: "Actual Common Area", format: "area" },
      { key: "PARKING_NUMBER", label: "Parking" },
      { key: "IS_FREE_HOLD_EN", label: "Free Hold" },
      { key: "IS_LEASE_HOLD_EN", label: "Lease Hold" },
      { key: "IS_OFFPLAN_EN", label: "Registration" },
      { key: "CREATION_DATE", label: "Created", format: "date" },
      { key: "DM_ZIP_CODE", label: "DM Zip" },
      { key: "MUNICIPALITY_NUMBER", label: "Municipality No." },
      { key: "PRE_REGISTRATION_NUMBER", label: "Pre-registration No." },
    ],
  },

  brokers: {
    command: "brokers",
    label: "Broker",
    description: "Licensed real-estate brokers.",
    filters: [
      {
        param: "P_GENDER",
        label: "Gender",
        kind: "select",
        options: [
          { value: "0", label: "Male" },
          { value: "1", label: "Female" },
        ],
      },
    ],
    defaultSort: "BROKER_NUMBER_ASC",
    sortable: ["BROKER_NUMBER", "BROKER_EN", "LICENSE_START_DATE", "LICENSE_END_DATE", "REAL_ESTATE_NUMBER"],
    columns: [
      { key: "BROKER_NUMBER", label: "Broker No." },
      { key: "BROKER_EN", label: "Broker" },
      { key: "GENDER_EN", label: "Gender" },
      { key: "LICENSE_START_DATE", label: "License Start", format: "date" },
      { key: "LICENSE_END_DATE", label: "License End", format: "date" },
      { key: "REAL_ESTATE_NUMBER", label: "Office No." },
      { key: "REAL_ESTATE_EN", label: "Office" },
      { key: "PHONE", label: "Phone" },
      { key: "FAX", label: "Fax" },
      { key: "WEBPAGE", label: "Website" },
    ],
  },

  developers: {
    command: "developers",
    label: "Developer",
    description: "Registered developers.",
    filters: [
      { param: "P_NAME", label: "Developer Name", kind: "text", placeholder: "e.g. Emaar" },
      { param: "P_FROM_DATE", label: "From Date", kind: "date" },
      { param: "P_TO_DATE", label: "To Date", kind: "date" },
    ],
    defaultSort: "DEVELOPER_NUMBER_ASC",
    sortable: ["DEVELOPER_NUMBER", "DEVELOPER_EN", "REGISTRATION_DATE", "LICENSE_EXPIRY_DATE"],
    columns: [
      { key: "DEVELOPER_NUMBER", label: "Developer No." },
      { key: "DEVELOPER_EN", label: "Developer" },
      { key: "REGISTRATION_DATE", label: "Registered", format: "date" },
      { key: "LICENSE_NUMBER", label: "License No." },
      { key: "LICENSE_SOURCE_EN", label: "License Source" },
      { key: "LICENSE_TYPE_EN", label: "License Type" },
      { key: "LICENSE_ISSUE_DATE", label: "License Issued", format: "date" },
      { key: "LICENSE_EXPIRY_DATE", label: "License Expires", format: "date" },
      { key: "LEGAL_STATUS_EN", label: "Legal Status" },
      { key: "CHAMBER_OF_COMMERCE_NO", label: "Chamber of Commerce No." },
      { key: "PHONE", label: "Phone" },
      { key: "FAX", label: "Fax" },
      { key: "WEBPAGE", label: "Website" },
    ],
  },
}

/** Tab order — matches the DLD site. */
export const DLD_TAB_ORDER: readonly DldCommand[] = DLD_COMMANDS

// ─── Request / response shapes ───────────────────────────────────────────────

export type DldRow = Record<string, string | number | null>

/** What `/api/admin/dld/{command}` returns. */
export interface DldQueryResponse {
  rows: DldRow[]
  /** Total matching rows as reported by the gateway (`TOTAL` on each row). */
  total: number
  skip: number
  take: number
}

export interface DldLookupResponse {
  options: DldOption[]
}

/** Paging bounds the proxy enforces. */
export const DLD_MAX_TAKE = 100
export const DLD_DEFAULT_TAKE = 25

/** Every parameter the proxy accepts for a dataset: its filters plus paging/sort. */
export function allowedParamsFor(dataset: DldDataset): Set<string> {
  return new Set([...dataset.filters.map((f) => f.param), ...(dataset.hiddenParams ?? []), "P_TAKE", "P_SKIP", "P_SORT"])
}

/** Accept only `{FIELD}_ASC` / `{FIELD}_DESC` for fields the dataset lists as sortable. */
export function isValidSort(dataset: DldDataset, sort: string): boolean {
  const m = /^([A-Z0-9_]+)_(ASC|DESC)$/.exec(sort)
  if (!m) return false
  return dataset.sortable.includes(m[1])
}

/** MM/DD/YYYY for the gateway. `d` is a local calendar date. */
export function toDldDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${mm}/${dd}/${d.getFullYear()}`
}

/** ISO yyyy-mm-dd (what <input type="date"> speaks) → MM/DD/YYYY. Empty stays empty. */
export function isoToDldDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return ""
  return `${m[2]}/${m[3]}/${m[1]}`
}

/** Resolve a filter's `defaultValue` token into a concrete input value. */
export function resolveDefault(field: DldFilterField): string {
  const raw = field.defaultValue ?? ""
  if (field.kind !== "date") return raw
  const today = new Date()
  const iso = (d: Date) => {
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, "0")
    const da = String(d.getDate()).padStart(2, "0")
    return `${y}-${mo}-${da}`
  }
  if (raw === "today") return iso(today)
  if (raw === "yesterday") {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return iso(d)
  }
  const rel = /^-(\d+)d$/.exec(raw)
  if (rel) {
    const d = new Date(today)
    d.setDate(d.getDate() - Number(rel[1]))
    return iso(d)
  }
  return ""
}
