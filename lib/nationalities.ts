/**
 * Nationalities for the profile "Nationality" dropdown (stored in
 * profiles.metadata.nationality as the plain string).
 */
export const NATIONALITIES = [
  "Afghan", "Albanian", "Algerian", "American", "Andorran", "Angolan", "Argentine",
  "Armenian", "Australian", "Austrian", "Azerbaijani", "Bahamian", "Bahraini",
  "Bangladeshi", "Barbadian", "Belarusian", "Belgian", "Belizean", "Beninese",
  "Bhutanese", "Bolivian", "Bosnian", "Botswanan", "Brazilian", "British",
  "Bruneian", "Bulgarian", "Burkinabe", "Burmese", "Burundian", "Cambodian",
  "Cameroonian", "Canadian", "Cape Verdean", "Central African", "Chadian",
  "Chilean", "Chinese", "Colombian", "Comoran", "Congolese", "Costa Rican",
  "Croatian", "Cuban", "Cypriot", "Czech", "Danish", "Djiboutian", "Dominican",
  "Dutch", "East Timorese", "Ecuadorean", "Egyptian", "Emirati", "Equatorial Guinean",
  "Eritrean", "Estonian", "Ethiopian", "Fijian", "Filipino", "Finnish", "French",
  "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek", "Grenadian",
  "Guatemalan", "Guinean", "Guyanese", "Haitian", "Honduran", "Hungarian",
  "Icelandic", "Indian", "Indonesian", "Iranian", "Iraqi", "Irish", "Israeli",
  "Italian", "Ivorian", "Jamaican", "Japanese", "Jordanian", "Kazakhstani",
  "Kenyan", "Kittitian", "Kuwaiti", "Kyrgyz", "Laotian", "Latvian", "Lebanese",
  "Liberian", "Libyan", "Liechtensteiner", "Lithuanian", "Luxembourger",
  "Macedonian", "Malagasy", "Malawian", "Malaysian", "Maldivian", "Malian",
  "Maltese", "Marshallese", "Mauritanian", "Mauritian", "Mexican", "Micronesian",
  "Moldovan", "Monacan", "Mongolian", "Montenegrin", "Moroccan", "Mosotho",
  "Mozambican", "Namibian", "Nauruan", "Nepalese", "New Zealander", "Nicaraguan",
  "Nigerian", "Nigerien", "North Korean", "Norwegian", "Omani", "Pakistani",
  "Palauan", "Palestinian", "Panamanian", "Papua New Guinean", "Paraguayan",
  "Peruvian", "Polish", "Portuguese", "Qatari", "Romanian", "Russian", "Rwandan",
  "Saint Lucian", "Salvadoran", "Samoan", "San Marinese", "Sao Tomean", "Saudi",
  "Senegalese", "Serbian", "Seychellois", "Sierra Leonean", "Singaporean",
  "Slovak", "Slovenian", "Solomon Islander", "Somali", "South African",
  "South Korean", "South Sudanese", "Spanish", "Sri Lankan", "Sudanese",
  "Surinamese", "Swazi", "Swedish", "Swiss", "Syrian", "Taiwanese", "Tajik",
  "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian", "Tunisian", "Turkish",
  "Turkmen", "Tuvaluan", "Ugandan", "Ukrainian", "Uruguayan", "Uzbek", "Vanuatuan",
  "Venezuelan", "Vietnamese", "Yemeni", "Zambian", "Zimbabwean",
] as const

/** Nationality (demonym) → ISO 3166-1 alpha-2 country code, for flag rendering. */
export const NATIONALITY_ISO: Record<string, string> = {
  Afghan: "AF", Albanian: "AL", Algerian: "DZ", American: "US", Andorran: "AD",
  Angolan: "AO", Argentine: "AR", Armenian: "AM", Australian: "AU", Austrian: "AT",
  Azerbaijani: "AZ", Bahamian: "BS", Bahraini: "BH", Bangladeshi: "BD", Barbadian: "BB",
  Belarusian: "BY", Belgian: "BE", Belizean: "BZ", Beninese: "BJ", Bhutanese: "BT",
  Bolivian: "BO", Bosnian: "BA", Botswanan: "BW", Brazilian: "BR", British: "GB",
  Bruneian: "BN", Bulgarian: "BG", Burkinabe: "BF", Burmese: "MM", Burundian: "BI",
  Cambodian: "KH", Cameroonian: "CM", Canadian: "CA", "Cape Verdean": "CV",
  "Central African": "CF", Chadian: "TD", Chilean: "CL", Chinese: "CN", Colombian: "CO",
  Comoran: "KM", Congolese: "CG", "Costa Rican": "CR", Croatian: "HR", Cuban: "CU",
  Cypriot: "CY", Czech: "CZ", Danish: "DK", Djiboutian: "DJ", Dominican: "DO",
  Dutch: "NL", "East Timorese": "TL", Ecuadorean: "EC", Egyptian: "EG", Emirati: "AE",
  "Equatorial Guinean": "GQ", Eritrean: "ER", Estonian: "EE", Ethiopian: "ET",
  Fijian: "FJ", Filipino: "PH", Finnish: "FI", French: "FR", Gabonese: "GA",
  Gambian: "GM", Georgian: "GE", German: "DE", Ghanaian: "GH", Greek: "GR",
  Grenadian: "GD", Guatemalan: "GT", Guinean: "GN", Guyanese: "GY", Haitian: "HT",
  Honduran: "HN", Hungarian: "HU", Icelandic: "IS", Indian: "IN", Indonesian: "ID",
  Iranian: "IR", Iraqi: "IQ", Irish: "IE", Israeli: "IL", Italian: "IT", Ivorian: "CI",
  Jamaican: "JM", Japanese: "JP", Jordanian: "JO", Kazakhstani: "KZ", Kenyan: "KE",
  Kittitian: "KN", Kuwaiti: "KW", Kyrgyz: "KG", Laotian: "LA", Latvian: "LV",
  Lebanese: "LB", Liberian: "LR", Libyan: "LY", Liechtensteiner: "LI", Lithuanian: "LT",
  Luxembourger: "LU", Macedonian: "MK", Malagasy: "MG", Malawian: "MW", Malaysian: "MY",
  Maldivian: "MV", Malian: "ML", Maltese: "MT", Marshallese: "MH", Mauritanian: "MR",
  Mauritian: "MU", Mexican: "MX", Micronesian: "FM", Moldovan: "MD", Monacan: "MC",
  Mongolian: "MN", Montenegrin: "ME", Moroccan: "MA", Mosotho: "LS", Mozambican: "MZ",
  Namibian: "NA", Nauruan: "NR", Nepalese: "NP", "New Zealander": "NZ", Nicaraguan: "NI",
  Nigerian: "NG", Nigerien: "NE", "North Korean": "KP", Norwegian: "NO", Omani: "OM",
  Pakistani: "PK", Palauan: "PW", Palestinian: "PS", Panamanian: "PA",
  "Papua New Guinean": "PG", Paraguayan: "PY", Peruvian: "PE", Polish: "PL",
  Portuguese: "PT", Qatari: "QA", Romanian: "RO", Russian: "RU", Rwandan: "RW",
  "Saint Lucian": "LC", Salvadoran: "SV", Samoan: "WS", "San Marinese": "SM",
  "Sao Tomean": "ST", Saudi: "SA", Senegalese: "SN", Serbian: "RS", Seychellois: "SC",
  "Sierra Leonean": "SL", Singaporean: "SG", Slovak: "SK", Slovenian: "SI",
  "Solomon Islander": "SB", Somali: "SO", "South African": "ZA", "South Korean": "KR",
  "South Sudanese": "SS", Spanish: "ES", "Sri Lankan": "LK", Sudanese: "SD",
  Surinamese: "SR", Swazi: "SZ", Swedish: "SE", Swiss: "CH", Syrian: "SY",
  Taiwanese: "TW", Tajik: "TJ", Tanzanian: "TZ", Thai: "TH", Togolese: "TG",
  Tongan: "TO", Trinidadian: "TT", Tunisian: "TN", Turkish: "TR", Turkmen: "TM",
  Tuvaluan: "TV", Ugandan: "UG", Ukrainian: "UA", Uruguayan: "UY", Uzbek: "UZ",
  Vanuatuan: "VU", Venezuelan: "VE", Vietnamese: "VN", Yemeni: "YE", Zambian: "ZM",
  Zimbabwean: "ZW",
}

/** ISO alpha-2 → regional-indicator flag emoji (🇵🇭). "" for anything invalid. */
export function isoFlagEmoji(iso: string | null | undefined): string {
  const cc = (iso ?? "").trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return ""
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

/** Nationality demonym (as stored in profiles.metadata.nationality) → flag emoji. */
export function nationalityFlag(nationality: string | null | undefined): string {
  if (!nationality) return ""
  return isoFlagEmoji(NATIONALITY_ISO[nationality.trim()])
}
