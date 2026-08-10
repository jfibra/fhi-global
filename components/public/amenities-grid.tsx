import {
  Waves, Dumbbell, Trees, Car, Shield, Wifi, Wind, Sun, Coffee, ShoppingBag,
  School, Hospital, Train, Utensils, MapPin, Star, Plane
} from "lucide-react"

const AMENITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Swimming Pool": Waves,
  "Gym": Dumbbell,
  "Garden": Trees,
  "Parking": Car,
  "Security": Shield,
  "Wifi": Wifi,
  "Air Conditioning": Wind,
  "Balcony": Sun,
  "Cafe": Coffee,
  "Retail": ShoppingBag,
  "School": School,
  "Hospital": Hospital,
  "Transport": Train,
  "Restaurant": Utensils,
}

function getIcon(name: string) {
  const Icon = AMENITY_ICONS[name]
  if (Icon) return Icon
  // Fuzzy fallback
  const nameLower = name.toLowerCase()
  if (nameLower.includes("pool") || nameLower.includes("swim")) return Waves
  if (nameLower.includes("gym") || nameLower.includes("fitness")) return Dumbbell
  if (nameLower.includes("park") || nameLower.includes("garden") || nameLower.includes("green")) return Trees
  if (nameLower.includes("car") || nameLower.includes("garage")) return Car
  if (nameLower.includes("security") || nameLower.includes("guard")) return Shield
  if (nameLower.includes("balcon") || nameLower.includes("terrace")) return Sun
  if (nameLower.includes("cafe") || nameLower.includes("coffee")) return Coffee
  if (nameLower.includes("shop") || nameLower.includes("retail") || nameLower.includes("mall")) return ShoppingBag
  if (nameLower.includes("school") || nameLower.includes("nursery")) return School
  if (nameLower.includes("hospital") || nameLower.includes("clinic")) return Hospital
  if (nameLower.includes("metro") || nameLower.includes("bus") || nameLower.includes("transport")) return Train
  if (nameLower.includes("restaurant") || nameLower.includes("dining") || nameLower.includes("food")) return Utensils
  return Star
}

type AmenitiesGridProps = {
  amenities: { amenities: { name: string } | null }[] | null
}

export function AmenitiesGrid({ amenities }: AmenitiesGridProps) {
  if (!amenities?.length) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {amenities
        .filter((a) => a.amenities?.name)
        .map((a, idx) => {
          const name = a.amenities!.name
          const Icon = getIcon(name)
          return (
            <div
              key={idx}
              className="flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-[#f7f8fa] border border-[#e8eaed] hover:border-[#001f3f]/20 hover:bg-[#001f3f]/4 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-[#e8eaed] group-hover:border-[#001f3f]/20 flex items-center justify-center transition-all shadow-sm">
                <Icon className="w-4.5 h-4.5 text-[#001f3f]" />
              </div>
              <span className="text-xs text-[#374151] font-medium text-center leading-tight">{name}</span>
            </div>
          )
        })}
    </div>
  )
}

// Nearby places types
type NearbyPlace = {
  id: number
  name?: string | null
  place_name?: string | null
  place_type?: string | null
  description: string
  distance?: string | null
}

const PLACE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  school: School,
  hospital: Hospital,
  transport: Train,
  shopping: ShoppingBag,
  restaurant: Utensils,
  airport: Plane,
  default: MapPin,
}

function getPlaceIcon(type: string | null | undefined) {
  if (!type) return MapPin
  const t = type.toLowerCase()
  return PLACE_ICONS[t] ?? MapPin
}

type NearbyPlacesProps = {
  points?: NearbyPlace[] | null
  neighbors?: NearbyPlace[] | null
}

export function NearbyPlaces({ points, neighbors }: NearbyPlacesProps) {
  const all = [...(points ?? []), ...(neighbors ?? [])]
  if (!all.length) return null

  const grouped: Record<string, NearbyPlace[]> = {}
  for (const p of all) {
    const key = p.place_type ?? "General"
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(p)
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([category, places]) => {
        const Icon = getPlaceIcon(category)
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#001f3f]/8 flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-[#001f3f]" />
              </div>
              <h4 className="text-sm font-bold text-[#0d1117] capitalize">{category}</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {places.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#f7f8fa] border border-[#e8eaed] text-sm">
                  <span className="text-[#374151] font-medium">{p.name ?? p.place_name ?? p.description}</span>
                  {p.distance && <span className="text-xs text-[#9ca3af] ml-2 shrink-0">{p.distance}</span>}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
