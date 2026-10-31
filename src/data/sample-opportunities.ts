/**
 * The six original CommonGround sample opportunities, copied field-for-field
 * from the frontend's `src/data/opportunities.ts` (fictional demo data).
 *
 * The backend stores the frontend's URL `id` as a stable `slug` and uses the
 * generated MongoDB `_id` as the public `id` in API responses.
 * This file is only used by the development seed script (`npm run seed`) and
 * its data-integrity test — it is never imported by the running server, so
 * the database is never seeded automatically.
 */

export interface SampleOrganizer {
  name: string;
  about: string;
  contactEmail: string;
}

export interface SampleOpportunity {
  slug: string;
  featured: boolean;
  title: string;
  organization: string;
  organizer: SampleOrganizer;
  category: string;
  /** Full location line, shown on cards and details pages. */
  location: string;
  /** Short city name used by the location filter on the listing page. */
  city: string;
  schedule: string;
  /** Volunteering commitment, e.g. "4 hours · single session". */
  duration: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  spotsTotal: number;
  spotsLeft: number;
}

export const sampleOpportunities: SampleOpportunity[] = [
  {
    slug: "garden-restoration",
    featured: true,
    title: "Community Garden Restoration",
    organization: "GreenRoots Collective",
    organizer: {
      name: "GreenRoots Collective",
      about:
        "GreenRoots Collective (fictional demo group) is a neighbourhood circle of plant lovers who rebuild neglected green corners around Dhaka's parks and lakes, one Saturday at a time.",
      contactEmail: "hello@greenroots.example",
    },
    category: "Environment",
    location: "Dhanmondi Lake, Dhanmondi, Dhaka, Bangladesh",
    city: "Dhaka",
    schedule: "Sat 14 Nov 2026, 9:00–13:00",
    duration: "4 hours · single Saturday session",
    description:
      "Help us bring the community garden beside Dhanmondi Lake back to life. Together we will rebuild raised beds, refresh the soil, and plant seasonal flowers and herbs that neighbours can enjoy all year round. No experience is needed — bring your energy and we will teach you the rest.",
    responsibilities: [
      "Loosen soil, weed the beds and prepare fresh planting rows with the team",
      "Plant seasonal flowers, herbs and shrubs under the coordinator's guidance",
      "Water and mulch the newly planted beds",
      "Tidy the garden paths and store shared tools at the end of the session",
    ],
    requirements: [
      "Clothes you don't mind getting soil on",
      "A water bottle, cap and sunscreen for the morning sun",
      "Ages 14 and up — volunteers under 18 bring an adult along",
      "No prior gardening experience required",
    ],
    benefits: [
      "Fuchka and lemonade lunch provided",
      "A short hands-on gardening basics class",
      "Participation certificate for students",
      "A relaxed afternoon walk by the lake with new friends",
    ],
    spotsTotal: 12,
    spotsLeft: 6,
  },
  {
    slug: "food-bank-support",
    featured: true,
    title: "Weekend Food Bank Support",
    organization: "Harvest Help",
    organizer: {
      name: "Harvest Help",
      about:
        "Harvest Help (fictional demo organization) runs a neighbourhood food pantry in Mirpur, collecting surplus groceries and turning them into weekly parcels for local families in need.",
      contactEmail: "care@harvesthelp.example",
    },
    category: "Community Care",
    location: "Mirpur 10, Mirpur, Dhaka, Bangladesh",
    city: "Dhaka",
    schedule: "Sat 7 Nov 2026, 10:00–14:00",
    duration: "4 hours · single Saturday session",
    description:
      "Lend a hand at our weekend food bank in Mirpur 10. Volunteers sort the week's donations, pack grocery parcels, and help hand them out with a smile. It is fast-paced, friendly work where you can see the impact of every single hour you give.",
    responsibilities: [
      "Sort donated rice, lentils, oil and dry goods by type and expiry date",
      "Pack grocery parcels for the week's registered families",
      "Welcome families warmly and guide them through pickup",
      "Count and log remaining stock for next week's planning",
    ],
    requirements: [
      "Comfortable lifting up to around 5 kilograms",
      "Punctuality — the morning starts with a short team briefing",
      "Patience and respect while working with families",
      "Ages 16 and up",
    ],
    benefits: [
      "Evening snacks and tea at the close of the shift",
      "Experience in logistics and community service",
      "A reference letter for future volunteering or studies",
      "The rare joy of handing a family their groceries yourself",
    ],
    spotsTotal: 10,
    spotsLeft: 4,
  },
  {
    slug: "reading-mentors",
    featured: true,
    title: "Reading Mentors for Children",
    organization: "Story Bridge",
    organizer: {
      name: "Story Bridge",
      about:
        "Story Bridge (fictional demo initiative) pairs volunteer reading mentors with primary school children at public libraries across Dhaka, turning shy readers into confident storytellers.",
      contactEmail: "stories@storybridge.example",
    },
    category: "Education",
    location: "Sufia Kamal National Public Library, Shahbag, Dhaka, Bangladesh",
    city: "Dhaka",
    schedule: "Tuesdays 16:00–17:30, from 10 Nov",
    duration: "1.5 hours weekly · 6-week programme",
    description:
      "Sit with a child for a story each Tuesday afternoon at the Sufia Kamal library. As a reading mentor you will help young readers sound out new words, talk about what they have read, and discover that books are friends for life. The programme runs for six weeks so you can watch your reader grow.",
    responsibilities: [
      "Read storybooks aloud with your assigned child each week",
      "Help sound out and practice new words in Bengali or English",
      "Play short vocabulary and memory games between chapters",
      "Encourage each child to keep a little reading diary",
    ],
    requirements: [
      "Fluent Bengali and school-level English",
      "Patience and warmth with children aged 8–11",
      "Willingness to attend all six Tuesday sessions",
      "Volunteers must be 18 or older",
    ],
    benefits: [
      "A child-engagement training session before you start",
      "Free access to the library's book stacks during the programme",
      "A recommendation letter after completing the programme",
      "Six weeks of stories, giggles and proud little reading moments",
    ],
    spotsTotal: 8,
    spotsLeft: 3,
  },
  {
    slug: "riverside-clean-up",
    featured: false,
    title: "Riverside & Beach Clean-Up",
    organization: "Blue Water Alliance",
    organizer: {
      name: "Blue Water Alliance",
      about:
        "Blue Water Alliance (fictional demo group) mobilizes weekend clean-ups along Bangladesh's beaches and riverbanks, focusing on plastics and fishing waste that harm coastal wildlife.",
      contactEmail: "waves@bluewater.example",
    },
    category: "Environment",
    location: "Kolatoli Beach, Cox's Bazar, Bangladesh",
    city: "Cox's Bazar",
    schedule: "Sun 22 Nov 2026, 8:30–12:00",
    duration: "3.5 hours · single morning session",
    description:
      "Spend a bright morning on Kolatoli Beach protecting the coastline you love. With gloves, tongs and sacks provided, our team sweeps washed-up plastics, tangled fishing nets and litter away from the tide line — and sorts what can be recycled on the spot.",
    responsibilities: [
      "Walk assigned stretches of the beach and collect litter in sacks",
      "Separate recyclables from general waste at the sorting point",
      "Flag sharp or hazardous items for the safety leads to handle",
      "Photograph before-and-after sections for the local report",
    ],
    requirements: [
      "Closed shoes suitable for sand and light walking",
      "Comfortable working outdoors in the morning sun",
      "Team spirit — clean-ups move fastest with chatter and songs",
      "Ages 12 and up — younger volunteers join with a guardian",
    ],
    benefits: [
      "Breakfast snacks and drinking water to keep you going",
      "Gloves, tongs and all equipment provided",
      "Photos of your cleaned stretch for your own collection",
      "A sunrise-crew badge you get to keep",
    ],
    spotsTotal: 20,
    spotsLeft: 15,
  },
  {
    slug: "companionship-visits",
    featured: false,
    title: "Companionship Visits for Elders",
    organization: "Warm Hearts Society",
    organizer: {
      name: "Warm Hearts Society",
      about:
        "Warm Hearts Society (fictional demo organization) arranges regular friendly visits for elders at care homes and day centres around Dhaka, because a good conversation can change a whole week.",
      contactEmail: "salam@warmhearts.example",
    },
    category: "Community Care",
    location: "Shantiniketan Old Home, Azimpur, Dhaka, Bangladesh",
    city: "Dhaka",
    schedule: "Flexible — 2 hours per week, weekday afternoons",
    duration: "2 hours weekly · flexible weekday afternoons",
    description:
      "Many residents at Shantiniketan Old Home have stories from a Dhaka that no longer exists, and nobody around with the time to hear them. As a companionship volunteer you will chat, play chaar-taash, read the paper aloud, or simply keep company. Same face, same afternoon, every week — that is what makes it work.",
    responsibilities: [
      "Visit your assigned resident for about two hours each week",
      "Chat over tea, play cards or ludo, or read newspapers aloud",
      "Gently note any health worries to share with the staff",
      "Join the volunteer circle meeting once a month",
    ],
    requirements: [
      "A calm caregivers' onboarding before your first visit",
      "Consistency — the same afternoon each week matters most",
      "Respect for residents' routines and privacy",
      "Volunteers must be 20 or older",
    ],
    benefits: [
      "Onboarding guidance about respecting residents' journeys",
      "Stories and wisdom you will not find anywhere else",
      "A certificate after 40 cumulative hours of visits",
      "Tea, biscuits and friendships across generations",
    ],
    spotsTotal: 6,
    spotsLeft: 2,
  },
  {
    slug: "youth-sports-coaching",
    featured: false,
    title: "Youth Sports Coaching Assistant",
    organization: "Eastside Youth Club",
    organizer: {
      name: "Eastside Youth Club",
      about:
        "Eastside Youth Club (fictional demo club) keeps teenagers active with free after-school football and cricket sessions, powered entirely by volunteer coaches and assistants.",
      contactEmail: "play@eastsideyc.example",
    },
    category: "Sports",
    location: "Railpara Playground, Sylhet, Bangladesh",
    city: "Sylhet",
    schedule: "Thursdays 17:30–19:00, from 5 Nov",
    duration: "1.5 hours weekly · season-long (3 months)",
    description:
      "Assist our volunteer coaches at the Thursday evening football sessions on Railpara Playground. You will warm up the players, run small-sided games, keep the kitting ritual fun, and help every child — even the one who keeps dribbling the wrong way — feel like a team member.",
    responsibilities: [
      "Lead warm-up rounds and stretching before drills",
      "Set up cones, bibs and goals for each drill",
      "Encourage and praise players during small-sided games",
      "Help pack up equipment neatly after the whistle",
    ],
    requirements: [
      "Basic football knowledge and playing experience",
      "Comfortable speaking with teenagers confidently",
      "Standing and walking on grass for 90 minutes",
      "Volunteers must be 18 or older",
    ],
    benefits: [
      "A coaching workshop led by our lead volunteer coach",
      "An assistant-coach reference for future sports work",
      "Free club jersey to wear with pride",
      "There is nothing like Thursday-evening goals under the lights",
    ],
    spotsTotal: 5,
    spotsLeft: 3,
  },
];
