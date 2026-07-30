// PEAK STORY STUDIO - Core Dataset
// Scalable data structure: You can easily append new stories, photos, or films!

export const INITIAL_STORIES = [
  {
    id: "story-1",
    title: "The Royal Palace Symphony",
    couple: "Ranveer & Deepika",
    location: "Umaid Bhawan Palace, Jodhpur",
    date: "November 2024",
    coverImage: "/images/hero_royal.jpg",
    tags: ["Royal Wedding", "Palace", "Cinematic Film"],
    summary: "An opulent 3-day royal affair set against the golden sandstone of Jodhpur, celebrating centuries-old heritage with modern grandeur.",
    fullGallery: [
      "/images/hero_royal.jpg",
      "/images/bridal_portrait.jpg",
      "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=1200"
    ],
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ" // Example teaser video
  },
  {
    id: "story-2",
    title: "Sunset Serenade by the Ocean",
    couple: "Aria & Julian",
    location: "Amalfi Coast, Italy",
    date: "June 2025",
    coverImage: "/images/destination_wedding.jpg",
    tags: ["Destination", "Beach", "Intimate"],
    summary: "A breathtaking coastal wedding overlooking cliffside sea views, wrapped in golden hour romantic hues and candlelit dining.",
    fullGallery: [
      "/images/destination_wedding.jpg",
      "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&q=80&w=1200",
      "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&q=80&w=1200"
    ]
  },
  {
    id: "story-3",
    title: "The Regal Heritage Saga",
    couple: "Siddharth & Ananya",
    location: "City Palace, Udaipur",
    date: "February 2025",
    coverImage: "/images/bridal_portrait.jpg",
    tags: ["Heritage", "Bridal Portrait", "Traditional"],
    summary: "Capturing intimate moments of rituals, royal heirlooms, and emotional vows along the calm waters of Lake Pichola.",
    fullGallery: [
      "/images/bridal_portrait.jpg",
      "/images/hero_royal.jpg",
      "https://images.unsplash.com/photo-1545232979-fbf34f5ce947?auto=format&fit=crop&q=80&w=1200"
    ]
  }
];

export const INITIAL_PHOTOS = [
  {
    id: "photo-1",
    title: "Royal Courtyard Walk",
    url: "/images/hero_royal.jpg",
    category: "Royal",
    couple: "Ranveer & Deepika",
    location: "Jodhpur Palace",
    span: "col-span-1 md:col-span-2 row-span-2"
  },
  {
    id: "photo-2",
    title: "Bridal Elegance",
    url: "/images/bridal_portrait.jpg",
    category: "Candid",
    couple: "Ananya",
    location: "Udaipur",
    span: "col-span-1 row-span-1 md:row-span-2"
  },
  {
    id: "photo-3",
    title: "Oceanfront Vows",
    url: "/images/destination_wedding.jpg",
    category: "Pre-Wedding",
    couple: "Aria & Julian",
    location: "Amalfi Coast",
    span: "col-span-1 md:col-span-2 row-span-1"
  },
  {
    id: "photo-4",
    title: "Golden Hour Embrace",
    url: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1000",
    category: "Pre-Wedding",
    couple: "Dev & Rhea",
    location: "Jaipur",
    span: "col-span-1 row-span-1"
  },
  {
    id: "photo-5",
    title: "Emotional Ritual Moments",
    url: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80&w=1000",
    category: "Rituals",
    couple: "Rohan & Priya",
    location: "Mumbai",
    span: "col-span-1 row-span-1"
  },
  {
    id: "photo-6",
    title: "Handcrafted Jewelry & Details",
    url: "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&q=80&w=1000",
    category: "Details",
    couple: "Details",
    location: "Heritage Suite",
    span: "col-span-1 row-span-1"
  },
  {
    id: "photo-7",
    title: "Candlelit Celebration",
    url: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=1000",
    category: "Royal",
    couple: "Kabir & Tara",
    location: "Goa",
    span: "col-span-1 md:col-span-2 row-span-1"
  },
  {
    id: "photo-8",
    title: "Laughter in Bloom",
    url: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&q=80&w=1000",
    category: "Candid",
    couple: "Karan & Simran",
    location: "Florence",
    span: "col-span-1 row-span-1"
  }
];

export const INITIAL_FILMS = [
  {
    id: "film-1",
    title: "The Palace Symphony | Official Film",
    couple: "Ranveer & Deepika",
    location: "Umaid Bhawan, Jodhpur",
    duration: "4:32 mins",
    thumbnail: "/images/hero_royal.jpg",
    videoEmbedUrl: "https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1"
  },
  {
    id: "film-2",
    title: "Waves of Eternal Love",
    couple: "Aria & Julian",
    location: "Amalfi Coast, Italy",
    duration: "3:45 mins",
    thumbnail: "/images/destination_wedding.jpg",
    videoEmbedUrl: "https://www.youtube.com/embed/EngW7tLk6R8?autoplay=1"
  },
  {
    id: "film-3",
    title: "Royal Heirlooms & Vows",
    couple: "Siddharth & Ananya",
    location: "Udaipur",
    duration: "5:10 mins",
    thumbnail: "/images/bridal_portrait.jpg",
    videoEmbedUrl: "https://www.youtube.com/embed/ScMzIvxBSi4?autoplay=1"
  }
];

// Consumed by src/components/FilmStrip.jsx — the "behind the lens" marquee of
// analog-camera frame cards. Moved out of the component body so it isn't
// rebuilt on every render (PS-015).
export const FILM_STRIP_FRAMES = [
  { title: "KODAK 400TX", location: "JODHPUR PALACE", img: "/images/hero_royal.jpg" },
  { title: "LEICA M11", location: "AMALFI COAST", img: "/images/destination_wedding.jpg" },
  { title: "HASSELBLAD", location: "CITY PALACE", img: "/images/bridal_portrait.jpg" },
  { title: "CINEMA 35MM", location: "UDAIPUR LAKE", img: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800" },
  { title: "KODAK PORTRA", location: "FLORENCE", img: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&q=80&w=800" },
  { title: "ARRI ALEXA", location: "GOA BEACH", img: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=800" },
];

// Consumed by src/components/HorizontalGallery.jsx — the "editorial showcase"
// horizontal-scroll carousel (PS-015).
export const EDITORIAL_GALLERY = [
  {
    id: 1,
    image: '/images/hero_royal.jpg',
    title: 'Royal Palace Symphony',
    location: 'Jodhpur Palace'
  },
  {
    id: 2,
    image: '/images/destination_wedding.jpg',
    title: 'Sunset Serenade',
    location: 'Amalfi Coast'
  },
  {
    id: 3,
    image: '/images/bridal_portrait.jpg',
    title: 'Regal Heritage',
    location: 'City Palace, Udaipur'
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200',
    title: 'Golden Hour Embrace',
    location: 'Jaipur'
  },
  {
    id: 5,
    image: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=1200',
    title: 'Candlelit Celebration',
    location: 'Goa'
  }
];

export const TESTIMONIALS = [
  {
    id: 1,
    quote: "Peak Story Studio didn't just photograph our wedding; they encapsulated our souls. Looking back at our film brings tears of joy every single time.",
    couple: "Deepika & Ranveer",
    event: "Royal Palace Wedding, Jodhpur"
  },
  {
    id: 2,
    quote: "The team is discrete yet captures every microscopic detail. Their artistic vision and cinematic color grading elevated our wedding to a heirloom movie.",
    couple: "Aria & Julian",
    event: "Destination Wedding, Amalfi Coast"
  },
  {
    id: 3,
    quote: "Absolute masterclass in storytelling. Every frame belongs in a luxury art gallery.",
    couple: "Ananya & Siddharth",
    event: "Lake Palace Wedding, Udaipur"
  }
];
