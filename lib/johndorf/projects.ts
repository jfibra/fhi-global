/**
 * Johndorf project sheets for the landing page's portfolio (/johndorf/home):
 * every house type (usable floor area, bedrooms, T&B, floors, parking), the
 * amenities and the construction-update log, read off each project's page on
 * sitedev.johndorfventures.com/project/<slug>/ on 2026-10-05, with its photos
 * saved under public/johndorf/site/projects/<slug>/. Generated — re-read their
 * pages to update; never type figures in by hand.
 *
 * Their "Typical Floor Area" figure is left out: it reads as lot area for the
 * houses but equals the unit for condos, so it can't be labelled honestly.
 * Bedroom counts keep Johndorf's own asterisk.
 */

export type JdUnit = { type: string; floorArea: number | null; bedrooms: string; baths: string; floors: string; parking: string }
export type JdImage = { src: string; label: string; kind: "photo" | "plan" | "update" }
export type JdProjectDetail = {
  slug: string
  units: JdUnit[]
  amenities: string[]
  /** The months Johndorf published construction updates for, as they label them. */
  updates: { first: string; last: string; count: number } | null
  images: JdImage[]
  officialUrl: string
}

export const PROJECT_DETAILS: Record<string, JdProjectDetail> = {
  "arvesa-village": {
    "slug": "arvesa-village",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 64.85,
        "bedrooms": "3",
        "baths": "2",
        "floors": "2",
        "parking": "2"
      }
    ],
    "amenities": [
      "Power Distribution",
      "Park",
      "Concrete Roads",
      "Guard House",
      "Sewage with Lagoon",
      "Clubhouse",
      "Basketball Court",
      "Perimeter Fence",
      "Water System",
      "Jogging Trail",
      "Cistern Tank",
      "CEPALCO Power",
      "24 Hour Security",
      "Open Spaces",
      "Street Lights",
      "Commercial Area",
      "Swimming Pool"
    ],
    "updates": {
      "first": "June 2025",
      "last": "June 2025",
      "count": 1
    },
    "images": [
      {
        "src": "/johndorf/site/projects/arvesa-village/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/arvesa-village/plan.jpg",
        "label": "Site plan",
        "kind": "plan"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/arvesa-village/"
  },
  "astana-davao": {
    "slug": "astana-davao",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 48,
        "bedrooms": "3*",
        "baths": "1",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Park and Playgrounds",
      "14-M Wide Entrance",
      "Gate and Guardhouse",
      "Clubhouse and Multi-Purpose Area",
      "Basketball Court",
      "Perimeter Fence"
    ],
    "updates": {
      "first": "March 2023",
      "last": "Jan 2024",
      "count": 4
    },
    "images": [
      {
        "src": "/johndorf/site/projects/astana-davao/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/astana-davao/plan.jpg",
        "label": "Site plan",
        "kind": "plan"
      },
      {
        "src": "/johndorf/site/projects/astana-davao/update-1.jpg",
        "label": "Block 1",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/astana-davao/update-2.jpg",
        "label": "Block 2",
        "kind": "photo"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/astana-davao/"
  },
  "coral-village": {
    "slug": "coral-village",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 76,
        "bedrooms": "3*",
        "baths": "2",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Underground Drainage and Sewer",
      "Power Distribution",
      "Park",
      "Sewage Treatment Facility",
      "Clubhouse",
      "Basketball Court",
      "Water System",
      "Jogging Trail",
      "Landscape Open Spaces"
    ],
    "updates": {
      "first": "March 2023",
      "last": "2024",
      "count": 3
    },
    "images": [
      {
        "src": "/johndorf/site/projects/coral-village/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/coral-village/update-1.jpg",
        "label": "Clubhouse",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/coral-village/update-2.jpg",
        "label": "Gate & guardhouse",
        "kind": "photo"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/coral-village/"
  },
  "evissa-davao": {
    "slug": "evissa-davao",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 63,
        "bedrooms": "3*",
        "baths": "2",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "MECO Power",
      "Park and Playgrounds",
      "14-M Wide Entrance",
      "Gate and Guardhouse",
      "Sewage Treatment Facility",
      "Clubhouse and Multi-Purpose Area",
      "Multi-Purpose Court",
      "Perimeter Fence",
      "Water Supply",
      "Swimming Pool",
      "Centralized Rainwater Catchment/Lagoon"
    ],
    "updates": {
      "first": "June 2025",
      "last": "June 2025",
      "count": 1
    },
    "images": [
      {
        "src": "/johndorf/site/projects/evissa-davao/main.jpg",
        "label": "Overview",
        "kind": "photo"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/evissa-davao/"
  },
  "evissa-lapu-lapu": {
    "slug": "evissa-lapu-lapu",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 61,
        "bedrooms": "3*",
        "baths": "1",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Underground Drainage and Sewer",
      "MECO Power",
      "Pocket Park",
      "Clubhouse and Multi-Purpose Area",
      "Multi-Purpose Court",
      "Perimeter Fence",
      "Water System (MCWD)",
      "24 Hour Security"
    ],
    "updates": {
      "first": "June 2025",
      "last": "June 2025",
      "count": 1
    },
    "images": [
      {
        "src": "/johndorf/site/projects/evissa-lapu-lapu/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/evissa-lapu-lapu/update-1.jpg",
        "label": "Exterior",
        "kind": "photo"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/evissa-lapu-lapu/"
  },
  "mimosa-cebu": {
    "slug": "mimosa-cebu",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 64,
        "bedrooms": "3*",
        "baths": "2",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "VECO Power Distribution",
      "Clubhouse and Multi-Purpose Area",
      "Multi-Purpose Court",
      "Perimeter Fence",
      "Water System (MCWD)",
      "Overhead Water Tank",
      "Sewage Treatment Plant/Lagoon"
    ],
    "updates": {
      "first": "June 2025",
      "last": "June 2025",
      "count": 1
    },
    "images": [
      {
        "src": "/johndorf/site/projects/mimosa-cebu/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/mimosa-cebu/plan.jpg",
        "label": "Site plan",
        "kind": "plan"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/mimosa-cebu/"
  },
  "mimosa-minglanilla": {
    "slug": "mimosa-minglanilla",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 85,
        "bedrooms": "3*",
        "baths": "2",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Underground Drainage and Sewer",
      "VECO Power",
      "Parks and Playgrounds",
      "Clubhouse and Multi-Purpose Area",
      "Basketball Court",
      "Perimeter Fence",
      "Water System (MCWD)",
      "Swimming Pool",
      "10-M Wide Entrance",
      "Gate and Guardhouse",
      "Lagoon"
    ],
    "updates": {
      "first": "June 2025",
      "last": "June 2025",
      "count": 1
    },
    "images": [
      {
        "src": "/johndorf/site/projects/mimosa-minglanilla/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/mimosa-minglanilla/plan.jpg",
        "label": "Site plan",
        "kind": "plan"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/mimosa-minglanilla/"
  },
  "montierra": {
    "slug": "montierra",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 64,
        "bedrooms": "3*",
        "baths": "—",
        "floors": "2",
        "parking": "1"
      },
      {
        "type": "Two-Storey Single Attached",
        "floorArea": 64,
        "bedrooms": "3*",
        "baths": "2",
        "floors": "2",
        "parking": "1"
      },
      {
        "type": "Two-Storey Duplex",
        "floorArea": 64,
        "bedrooms": "3*",
        "baths": "2",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Clubhouse and Multi-Purpose Hall",
      "Gate and Guardhouse",
      "Basketball Court",
      "Parks and Playgrounds",
      "Sewage Treatment Facility",
      "Water System",
      "CEPALCO Power Distribution",
      "Swimming Pool",
      "Jogging Trail",
      "24 Hour Security",
      "15-M Entrance",
      "Perimeter Fence",
      "Future Retail Area"
    ],
    "updates": {
      "first": "June 2025",
      "last": "June 2025",
      "count": 1
    },
    "images": [
      {
        "src": "/johndorf/site/projects/montierra/main.jpg",
        "label": "Overview",
        "kind": "photo"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/montierra/"
  },
  "navona-court": {
    "slug": "navona-court",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 58.49,
        "bedrooms": "3",
        "baths": "2",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Underground Drainage and Sewer",
      "Power Distribution",
      "Parks and Playgrounds",
      "Concrete Road",
      "Gate and Guardhouse",
      "Lagoon",
      "Sewage Treatment Facility",
      "Clubhouse and Multi-Purpose Area",
      "Basketball Court",
      "Perimeter Fence",
      "Cistern Tank",
      "Water System",
      "Open Spaces",
      "Jogging Trail",
      "Street Lights",
      "Material Recovery Facility"
    ],
    "updates": {
      "first": "2022",
      "last": "June 2025",
      "count": 16
    },
    "images": [
      {
        "src": "/johndorf/site/projects/navona-court/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/navona-court/update-1.jpg",
        "label": "Construction update",
        "kind": "update"
      },
      {
        "src": "/johndorf/site/projects/navona-court/update-2.jpg",
        "label": "Construction update",
        "kind": "update"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/navona-court/"
  },
  "navona-davao": {
    "slug": "navona-davao",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 63,
        "bedrooms": "3*",
        "baths": "2",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "MECO Power",
      "Park and Playgrounds",
      "14-M Wide Entrance",
      "Gate and Guardhouse",
      "Sewage Treatment Facility",
      "Clubhouse and Multi-Purpose Area",
      "Multi-Purpose Court",
      "Perimeter Fence",
      "Water Supply",
      "Swimming Pool",
      "Centralized Rainwater Catchment/Lagoon"
    ],
    "updates": {
      "first": "June 2025",
      "last": "June 2025",
      "count": 1
    },
    "images": [
      {
        "src": "/johndorf/site/projects/navona-davao/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/navona-davao/plan.jpg",
        "label": "Site plan",
        "kind": "plan"
      },
      {
        "src": "/johndorf/site/projects/navona-davao/update-1.jpg",
        "label": "Floor plan",
        "kind": "plan"
      },
      {
        "src": "/johndorf/site/projects/navona-davao/update-2.jpg",
        "label": "Floor plan · furnished",
        "kind": "plan"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/navona-davao/"
  },
  "navona-lumbia": {
    "slug": "navona-lumbia",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 63,
        "bedrooms": "3",
        "baths": "1",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Power Distribution",
      "Grand Clubhouse",
      "Underground Drainage",
      "Landscape Gate and Guardhouse",
      "Basketball Court",
      "Sewage Treatment Plant",
      "Water System",
      "Jogging Trail",
      "Park"
    ],
    "updates": {
      "first": "June 2025",
      "last": "June 2025",
      "count": 1
    },
    "images": [
      {
        "src": "/johndorf/site/projects/navona-lumbia/main.jpg",
        "label": "Overview",
        "kind": "photo"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/navona-lumbia/"
  },
  "pich-4b": {
    "slug": "pich-4b",
    "units": [
      {
        "type": "Duplex",
        "floorArea": 38,
        "bedrooms": "2",
        "baths": "1",
        "floors": "1",
        "parking": "1"
      }
    ],
    "amenities": [
      "Multi-Purpose Hall",
      "Landscape Gate and Guardhouse",
      "Multi-Purpose Play Court",
      "Recreational Park"
    ],
    "updates": {
      "first": "June 2025",
      "last": "June 2025",
      "count": 1
    },
    "images": [
      {
        "src": "/johndorf/site/projects/pich-4b/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/pich-4b/plan.jpg",
        "label": "Vicinity map",
        "kind": "plan"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/pich-4b/"
  },
  "plumera": {
    "slug": "plumera",
    "units": [
      {
        "type": "Studio Unit",
        "floorArea": 24,
        "bedrooms": "—",
        "baths": "1",
        "floors": "—",
        "parking": "—"
      },
      {
        "type": "1BR Unit",
        "floorArea": 36,
        "bedrooms": "1",
        "baths": "1",
        "floors": "—",
        "parking": "—"
      }
    ],
    "amenities": [
      "Underground Drainage and Sewer",
      "MECO Power",
      "Pocket Park",
      "Wide Entrance",
      "Gate and Guardhouse",
      "Lagoon",
      "Sewage Treatment Facility",
      "Clubhouse and Multi-Purpose Area",
      "Multi-Purpose Court",
      "Perimeter Fence",
      "Future Retail Area",
      "Mailbox Area",
      "Water System (MCWD)",
      "Swimming Pool",
      "Jogging Trail",
      "Fire Protection System",
      "Material Recovery Facility"
    ],
    "updates": {
      "first": "2023",
      "last": "June 2025",
      "count": 21
    },
    "images": [
      {
        "src": "/johndorf/site/plumera.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/plumera/main.jpg",
        "label": "Construction update",
        "kind": "update"
      },
      {
        "src": "/johndorf/site/projects/plumera/plan.jpg",
        "label": "Site plan",
        "kind": "plan"
      },
      {
        "src": "/johndorf/site/projects/plumera/update-1.jpg",
        "label": "Construction update",
        "kind": "update"
      },
      {
        "src": "/johndorf/site/projects/plumera/update-2.jpg",
        "label": "Construction update",
        "kind": "update"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/plumera/"
  },
  "tierranava-carcar": {
    "slug": "tierranava-carcar",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 54,
        "bedrooms": "2*",
        "baths": "1",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Underground Drainage",
      "CEBECO",
      "Clubhouse",
      "Multi-Purpose Court",
      "Perimeter Fence",
      "Water System (MCWD)",
      "Cistern Tank",
      "Sewage Treatment Plant Facility",
      "Gate and Guardhouse",
      "Lagoon"
    ],
    "updates": {
      "first": "June 2025",
      "last": "June 2025",
      "count": 1
    },
    "images": [
      {
        "src": "/johndorf/site/projects/tierranava-carcar/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/tierranava-carcar/update-1.jpg",
        "label": "Site plan",
        "kind": "plan"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/tierranava-carcar/"
  },
  "tierranava-lumbia": {
    "slug": "tierranava-lumbia",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 36,
        "bedrooms": "2*",
        "baths": "1",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Parks and Playground",
      "Gate and Guardhouse",
      "Clubhouse",
      "24 Hour Security"
    ],
    "updates": {
      "first": "Jan 2024",
      "last": "June 2025",
      "count": 12
    },
    "images": [
      {
        "src": "/johndorf/site/projects/tierranava-lumbia/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/tierranava-lumbia/plan.jpg",
        "label": "Vicinity map",
        "kind": "plan"
      },
      {
        "src": "/johndorf/site/projects/tierranava-lumbia/update-1.jpg",
        "label": "Construction update",
        "kind": "update"
      },
      {
        "src": "/johndorf/site/projects/tierranava-lumbia/update-2.jpg",
        "label": "Construction update",
        "kind": "update"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/tierranava-lumbia/"
  },
  "tierranava-opol": {
    "slug": "tierranava-opol",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 36,
        "bedrooms": "2",
        "baths": "1",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Moresco",
      "Wide Road",
      "Gate and Guardhouse",
      "Clubhouse",
      "Basketball Court",
      "Perimeter Fence",
      "Street Lights"
    ],
    "updates": {
      "first": "Jan 2024",
      "last": "June 2025",
      "count": 14
    },
    "images": [
      {
        "src": "/johndorf/site/projects/tierranava-opol/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/tierranava-opol/update-1.jpg",
        "label": "Construction update",
        "kind": "update"
      },
      {
        "src": "/johndorf/site/projects/tierranava-opol/update-2.jpg",
        "label": "Construction update",
        "kind": "update"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/tierranava-opol/"
  },
  "tierranava-tagoloan": {
    "slug": "tierranava-tagoloan",
    "units": [
      {
        "type": "Two-Storey Townhouse",
        "floorArea": 36,
        "bedrooms": "2",
        "baths": "1",
        "floors": "2",
        "parking": "1"
      }
    ],
    "amenities": [
      "Moresco",
      "Clubhouse",
      "Wide Road",
      "Gate and Guardhouse",
      "Basketball Court",
      "Perimeter Fence",
      "Street Lights"
    ],
    "updates": {
      "first": "Jan 2025",
      "last": "June 2025",
      "count": 5
    },
    "images": [
      {
        "src": "/johndorf/site/projects/tierranava-tagoloan/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/tierranava-tagoloan/update-1.jpg",
        "label": "Construction update",
        "kind": "update"
      },
      {
        "src": "/johndorf/site/projects/tierranava-tagoloan/update-2.jpg",
        "label": "Construction update",
        "kind": "update"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/tierranava-tagoloan/"
  },
  "villa-castena": {
    "slug": "villa-castena",
    "units": [
      {
        "type": "Two-Storey Single Attached",
        "floorArea": 44,
        "bedrooms": "2",
        "baths": "2",
        "floors": "2",
        "parking": "2"
      },
      {
        "type": "One-Storey Duplex",
        "floorArea": 29,
        "bedrooms": "2",
        "baths": "1",
        "floors": "1",
        "parking": "1"
      }
    ],
    "amenities": [
      "Clubhouse and Multi-Purpose Hall",
      "Gate and Guardhouse",
      "Basketball Court",
      "Parks and Playgrounds",
      "Sewage Treatment Facility",
      "Water System",
      "CEPALCO Power Distribution",
      "Swimming Pool",
      "Jogging Trail",
      "24 Hour Security",
      "15-M Entrance",
      "Perimeter Fence",
      "Future Retail Area"
    ],
    "updates": {
      "first": "March 2023",
      "last": "June 2025",
      "count": 18
    },
    "images": [
      {
        "src": "/johndorf/site/projects/villa-castena/main.jpg",
        "label": "Overview",
        "kind": "photo"
      },
      {
        "src": "/johndorf/site/projects/villa-castena/update-1.jpg",
        "label": "Construction update",
        "kind": "update"
      },
      {
        "src": "/johndorf/site/projects/villa-castena/update-2.jpg",
        "label": "Construction update",
        "kind": "update"
      }
    ],
    "officialUrl": "https://sitedev.johndorfventures.com/project/villa-castena/"
  }
}
