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
  /** Initial value. Dates accept "today" / "yesterday" / "year-start" / "month-start" / "-30d". */
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
      { param: "P_FROM_DATE", label: "From Date", kind: "date", required: true },
      { param: "P_TO_DATE", label: "To Date", kind: "date", required: true },
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
      // Ejari volume is huge (~550k contracts since April 2026): the gateway
      // 504s on a full-year window before it can answer, so keep ranges to a
      // few months unless the area/usage filters narrow it.
      { param: "P_FROM_DATE", label: "From Date", kind: "date", required: true },
      { param: "P_TO_DATE", label: "To Date", kind: "date", required: true },
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
      { param: "P_FROM_DATE", label: "From Date", kind: "date", required: true },
      { param: "P_TO_DATE", label: "To Date", kind: "date", required: true },
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
      { param: "P_FROM_DATE", label: "From Date", kind: "date", required: true },
      { param: "P_TO_DATE", label: "To Date", kind: "date", required: true },
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
      // Deliberately blank: any date range on this dataset returned zero rows
      // from the gateway (probed 2026-09-28), while blank dates list everything.
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
      // Required here although optional on the DLD form: the gateway returns
      // nothing for this dataset without a date range.
      { param: "P_FROM_DATE", label: "From Date", kind: "date", required: true },
      { param: "P_TO_DATE", label: "To Date", kind: "date", required: true },
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
  /**
   * Total matching rows — as reported by the gateway (`TOTAL` on each row), or,
   * when a column search is active, the number of scanned rows that matched.
   */
  total: number
  skip: number
  take: number
  /** Present when a column search ran. */
  search?: DldSearchInfo
}

/**
 * How a column search was carried out. The gateway has no "contains" filter,
 * so the proxy pulls the filtered result set in aligned chunks of
 * DLD_SEARCH_CHUNK rows (cached in Postgres, see lib/dld-cache.ts) and
 * matches on the chosen column itself.
 *
 * - `contains`: `%term%` over the first `scanLimit` rows in the table's sort
 *   order. `truncated` means the gateway has more rows than were scanned; the
 *   UI offers to raise the limit by DLD_SEARCH_SCAN_STEP.
 * - `exact`: the term was a whole number and the column is sortable, so the
 *   proxy sorted by that column and jumped straight to it (binary search over
 *   chunks). Covers the whole result set — never truncated.
 */
export interface DldSearchInfo {
  column: string
  term: string
  mode: "contains" | "exact"
  /** Rows actually tested. */
  scanned: number
  /** The gateway's own total for the underlying filters. */
  available: number
  truncated: boolean
  /** The cap this request scanned up to (contains mode). */
  scanLimit: number
  /** Chunks served from the cache vs pulled from the gateway. */
  cacheHits: number
  cacheMisses: number
}

/** Request keys for the column search — never forwarded to the gateway. */
export const DLD_SEARCH_COLUMN_KEY = "SEARCH_COLUMN"
export const DLD_SEARCH_TERM_KEY = "SEARCH_TERM"
/** Optional: how many rows a contains-scan may cover (multiple of the step). */
export const DLD_SEARCH_SCAN_ROWS_KEY = "SEARCH_SCAN_ROWS"
export const DLD_SEARCH_TERM_MAX = 80

/** Rows per gateway call / cache entry. The gateway answers in ~3–4s whatever
 *  the size, so bigger is cheaper — 1,000 keeps each JSONB row ~1MB. */
export const DLD_SEARCH_CHUNK = 1000
/** A contains-scan covers this many rows by default … */
export const DLD_SEARCH_SCAN_STEP = 5000
/** … and the UI can raise it, step by step, up to this. */
export const DLD_SEARCH_SCAN_MAX = 50_000

/** A column search may target any displayed column. */
export function isSearchableColumn(dataset: DldDataset, key: string): boolean {
  return dataset.columns.some((c) => c.key === key)
}

/** Case-insensitive `%term%` on one cell. Numbers are matched on their digits. */
export function cellContains(value: string | number | null | undefined, needle: string): boolean {
  if (value === null || value === undefined) return false
  return String(value).toLowerCase().includes(needle)
}

/** A whole number on a sortable column → the exact (sort-aware) lookup path. */
export function isExactLookup(dataset: DldDataset, column: string, term: string): boolean {
  return /^\d{1,15}$/.test(term) && dataset.sortable.includes(column)
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

/**
 * A filter's initial input value. Date filters start empty — the tabs that
 * need a range wait for the user to pick one (their fields are `required`).
 * Note the gateway only holds the current calendar year: probed 2026-09-28,
 * every dataset's earliest row is early January and 2025 returns nothing.
 */
export function resolveDefault(field: DldFilterField): string {
  return field.kind === "date" ? "" : (field.defaultValue ?? "")
}

/** Required filters the user has not filled in yet. */
export function missingRequired(dataset: DldDataset, values: Record<string, string>): DldFilterField[] {
  return dataset.filters.filter((f) => f.required && !(values[f.param] ?? "").trim())
}

// ─── Charts ──────────────────────────────────────────────────────────────────

/**
 * The DLD Property Price Index (`/open-data/property-price-idx`): 20 series —
 * residential (general/flats/villas) and commercial (general/hospitality/hotel
 * apartment/hotel rooms/offices/shops/shops & offices) — each annual and
 * quarterly from 2020, with the index value plus QoQ and YoY change.
 */
export const DLD_PRICE_INDEX_COMMAND = "property-price-idx"

export interface DldPriceIndexPoint {
  /** "2024" or "2024.3" (year.quarter) as the gateway labels it. */
  x: string
  actual: number | null
  qoq: number | null
  yoy: number | null
}

export interface DldPriceIndexSeries {
  category: string
  categoryCode: string
  subCategory: string
  subCategoryCode: string
  period: "Annual" | "Quarterly"
  points: DldPriceIndexPoint[]
}

export interface DldPriceIndexResponse {
  series: DldPriceIndexSeries[]
  fromCache: boolean
}

/**
 * What the breakdown charts aggregate for a dataset. Rows are pulled in date
 * order (sorted by `dateKey`), so a capped pull covers a contiguous prefix of
 * the range — the response reports the dates actually covered.
 */
export interface DldChartSpec {
  command: DldCommand
  /** Row field holding the date the daily series buckets on. Absent → no daily chart. */
  dateKey?: string
  /** Sort key the gateway accepts for that date (`{key}_ASC`); absent → the dataset's default sort. */
  dateSort?: string
  /** Row field summed per day / per category (AED). Absent → counts only. */
  valueKey?: string
  valueLabel?: string
  /** Categorical fields to break the rows down by (label = column label). */
  breakdowns: string[]
  /** "Top N" field, e.g. area or developer, ranked by count. */
  topKey: string
  /**
   * Row field with the size in sqm, when one applies to `valueKey` — powers a
   * generic AED-per-sqft figure in Breakdowns, over whatever rows match the
   * current filters (not restricted by category, unlike `kpi` below).
   */
  areaKey?: string
  /**
   * Headline figures over a subset of rows (e.g. sales only): count, average
   * price and price per sqft, a location ranking, and the latest rows for a
   * history table. Only Transactions has this today — it feeds the per-tab
   * Summary strip's exact-figures upgrade (app/api/admin/dld/charts
   * `breakdown()`), not Breakdowns' own price-per-sqft (`areaKey` above).
   */
  kpi?: {
    filterKey: string
    filterValue: string
    /** Row field with the size in sqm (price-per-sqft uses it). */
    areaKey: string
    /** Row field for the location ranking. */
    locationKey: string
    /** Fields kept on the "latest" rows sent to the client. */
    latestKeys: string[]
  }
}

export const DLD_CHART_SPECS: Record<DldCommand, DldChartSpec> = {
  transactions: {
    command: "transactions",
    dateKey: "INSTANCE_DATE",
    dateSort: "INSTANCE_DATE",
    valueKey: "TRANS_VALUE",
    valueLabel: "Transaction value (AED)",
    breakdowns: ["GROUP_EN", "USAGE_EN", "IS_OFFPLAN_EN", "PROP_TYPE_EN", "IS_FREE_HOLD_EN"],
    topKey: "AREA_EN",
    areaKey: "PROCEDURE_AREA",
    kpi: {
      filterKey: "GROUP_EN",
      filterValue: "Sales",
      areaKey: "PROCEDURE_AREA",
      locationKey: "AREA_EN",
      latestKeys: [
        "TRANSACTION_NUMBER",
        "INSTANCE_DATE",
        "PROJECT_EN",
        "AREA_EN",
        "TRANS_VALUE",
        "PROP_SB_TYPE_EN",
        "PROP_TYPE_EN",
        "ROOMS_EN",
        "PROCEDURE_AREA",
        "IS_OFFPLAN_EN",
        "PROCEDURE_EN",
      ],
    },
  },
  rents: {
    command: "rents",
    dateKey: "REGISTRATION_DATE",
    dateSort: "REGISTRATION_DATE",
    valueKey: "ANNUAL_AMOUNT",
    valueLabel: "Annual rent (AED)",
    breakdowns: ["USAGE_EN", "PROP_SUB_TYPE_EN", "VERSION_EN", "IS_FREE_HOLD_EN"],
    topKey: "AREA_EN",
    areaKey: "ACTUAL_AREA",
  },
  projects: {
    command: "projects",
    dateKey: "START_DATE",
    dateSort: "START_DATE",
    valueKey: "PROJECT_VALUE",
    valueLabel: "Project value (AED)",
    breakdowns: ["PROJECT_STATUS", "PRJ_TYPE_EN", "AREA_EN"],
    topKey: "DEVELOPER_EN",
  },
  valuations: {
    command: "valuations",
    dateKey: "INSTANCE_DATE",
    dateSort: "INSTANCE_DATE",
    valueKey: "PROPERTY_TOTAL_VALUE",
    valueLabel: "Valuation (AED)",
    breakdowns: ["PROPERTY_TYPE_EN", "PROP_SUB_TYPE_EN", "ROW_STATUS_CODE"],
    topKey: "AREA_EN",
    areaKey: "ACTUAL_AREA",
  },
  // The registry datasets have no date filter; their charts are splits only.
  lands: {
    command: "lands",
    valueKey: "ACTUAL_AREA",
    valueLabel: "Land size (sqm)",
    breakdowns: ["LAND_TYPE_EN", "ZONE_EN", "IS_FREE_HOLD_EN", "IS_OFFPLAN_EN"],
    topKey: "AREA_EN",
  },
  buildings: {
    command: "buildings",
    dateKey: "CREATION_DATE",
    dateSort: "CREATION_DATE",
    breakdowns: ["PROP_SUB_TYPE_EN", "ZONE_EN", "IS_FREE_HOLD_EN", "IS_OFFPLAN_EN"],
    topKey: "AREA_EN",
  },
  units: {
    command: "units",
    dateKey: "CREATION_DATE",
    dateSort: "CREATION_DATE",
    breakdowns: ["PROP_SUB_TYPE_EN", "ZONE_EN", "IS_FREE_HOLD_EN", "IS_OFFPLAN_EN"],
    topKey: "AREA_EN",
  },
  brokers: {
    command: "brokers",
    dateKey: "LICENSE_START_DATE",
    dateSort: "LICENSE_START_DATE",
    breakdowns: ["GENDER_EN"],
    topKey: "REAL_ESTATE_EN",
  },
  developers: {
    command: "developers",
    dateKey: "REGISTRATION_DATE",
    dateSort: "REGISTRATION_DATE",
    breakdowns: ["LICENSE_SOURCE_EN", "LICENSE_TYPE_EN"],
    topKey: "LEGAL_STATUS_EN",
  },
}

/**
 * Breakdowns are aggregated one batch of chunks per request and merged on
 * the client, so there is no cap on how much of a range the charts cover —
 * only on how long one request takes (~10 gateway calls cold, ~12–25s).
 */
export const DLD_CHART_BATCH_CHUNKS = 10
/** The first batch is small so a cold load paints within a few seconds. */
export const DLD_CHART_FIRST_BATCH_CHUNKS = 2
export const DLD_CHART_TOP_N = 10
/** Latest rows kept for the sales-history table. */
export const DLD_CHART_LATEST_N = 25
/** DLD sizes are sqm; the Bayut-style figures are per sqft. */
export const SQFT_PER_SQM = 10.7639

export type DldDeveloperSource = "dld" | "fhi" | "name" | "unmatched" | "unknown"

export interface DldChartBucket {
  label: string
  count: number
  /** Sum of `valueKey` (AED) for the bucket, when the spec has one. */
  value: number
}

export interface DldChartDay {
  /** ISO yyyy-mm-dd. */
  date: string
  count: number
  value: number
}

/**
 * The fast per-tab summary (`kind: "summary"` on the charts route).
 *
 * No full pull: `total` and every split count come from the gateway's own
 * TOTAL on one-row requests (one per option of each select filter still set
 * to "All"), run in parallel; the headline figures come from the newest
 * DLD_SUMMARY_SAMPLE rows only, and say so.
 */
export interface DldSummaryResponse {
  command: DldCommand
  total: number
  splits: Array<{ param: string; label: string; buckets: DldChartBucket[] }>
  sample: {
    rows: number
    /** Column the sample is ordered by (newest first), or null for registry sets. */
    dateKey: string | null
    from: string | null
    to: string | null
    /** Average of the spec's value field over the sample, when it has one. */
    avgValue: number | null
    /** Transactions only: AED per sqft over the sample's sales. */
    perSqft: number | null
    /** Top entries of the spec's `topKey` within the sample. */
    top: DldChartBucket[]
  } | null
  cacheHits: number
  cacheMisses: number
}

/** Rows the summary's headline figures are computed from (one gateway page). */
export const DLD_SUMMARY_SAMPLE = 1000
/**
 * Up to this many rows the summary completes its exact figures on its own
 * (≈30 gateway calls cold, about a minute; seconds from cache). Above it,
 * the user starts the full pull deliberately.
 */
export const DLD_SUMMARY_AUTO_EXACT_MAX = 30_000
/** Rough cold cost per 1,000-row chunk with 4 in flight — for the estimate. */
export const DLD_CHUNK_SECONDS_ESTIMATE = 1.2

/** Mergeable sums behind the headline tiles (all rows matching `kpi.filter`). */
export interface DldKpiSums {
  count: number
  /** Sum of the value field over all matching rows. */
  valueSum: number
  /** Sum of the value field over rows that also have a size > 0 … */
  valueWithAreaSum: number
  /** … and the sum of those sizes (sqm), for price per sqft. */
  areaSqmSum: number
  /** Location ranking over the matching rows (every bucket, mergeable). */
  locations: DldChartBucket[]
}

/**
 * Aggregates for ONE batch of chunks (`chunkFrom` … `chunkTo` - 1). Every
 * part is mergeable by summing per key, so the client accumulates batches
 * until `done`. `top` carries every bucket (not just the top N) for the same
 * reason — a top-10 of a partial batch would not merge correctly.
 */
export interface DldBreakdownResponse {
  command: DldCommand
  daily: DldChartDay[]
  /** Keyed by breakdown field; buckets sorted by count desc. */
  breakdowns: Record<string, DldChartBucket[]>
  top: DldChartBucket[]
  totals: { count: number; value: number }
  /** Present when the spec has `kpi` — sums over the filtered rows in this batch. */
  kpi?: DldKpiSums
  /** Latest filtered rows in this batch (trimmed to `kpi.latestKeys`), newest first. */
  latest?: DldRow[]
  /** Present when the spec has `areaKey` — Breakdowns' own price-per-sqft, over ALL rows in this batch (not category-restricted). */
  areaAgg?: { valueWithAreaSum: number; areaSqmSum: number }
  /**
   * Transactions only: rows tallied by the developer behind their project
   * (lib/dld-developer-lookup.ts). Every bucket, mergeable like `top`.
   * "Unknown" = no project name on the row.
   */
  developers?: DldChartBucket[]
  /** The same tally restricted to rows whose developer came from a register (DLD or FHI) via the project. */
  developersMatched?: DldChartBucket[]
  /** …and restricted to rows whose developer was only guessed from the project's name. */
  developersGuessed?: DldChartBucket[]
  /** Projects (by name) that no register or catalogue knows — the rows behind "Unmatched project". */
  projectsUnmatched?: DldChartBucket[]
  /** Every project named on a row (by PROJECT_EN), developer known or not. */
  projects?: DldChartBucket[]
  /** project name → the developer label it resolved to (register, catalogue or "(by name)" guess); absent when unmatched. */
  projectDevelopers?: Record<string, string>
  /** How the developer was found, per row in this batch — the card's "matched" line. */
  developerSources?: Record<DldDeveloperSource, number>
  coverage: {
    /** Rows in this batch. */
    rows: number
    /** The gateway's total for the filters. */
    available: number
    chunkFrom: number
    /** Exclusive. Pass as the next request's `chunkFrom`. */
    chunkTo: number
    /** True when this batch reached the end of the result set. */
    done: boolean
    /** First/last `dateKey` among this batch's rows (ISO date), null when empty. */
    from: string | null
    to: string | null
    cacheHits: number
    cacheMisses: number
  }
}
