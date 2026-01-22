// Mock data based on Entities schemas

const blogPosts = [
  {
    id: "1",
    created_date: "2024-10-24T10:00:00Z",
    title: "The Future of Backend Development",
    slug: "future-backend",
    excerpt: "Exploring how serverless and edge computing are reshaping the landscape.",
    content: "# The Future\n\nBackend development is evolving rapidly...",
    category: "backend",
    published: true
  },
  {
    id: "2",
    created_date: "2024-11-15T14:30:00Z",
    title: "AI Experiments with LLMs",
    slug: "ai-experiments",
    excerpt: "My journey into fine-tuning small language models.",
    content: "# LLMs are cool\n\nI tried fine-tuning Llama 3 and here is what happened...",
    category: "ai",
    published: true
  },
  {
    id: "3",
    created_date: "2025-01-05T09:15:00Z",
    title: "Database Deep Dive: PostgreSQL vs. The World",
    slug: "postgres-vs-world",
    excerpt: "Why I still choose Postgres for 90% of my projects.",
    content: "# Postgres for the win\n\nIt just works. JSONB is magic...",
    category: "databases",
    published: true
  },
  {
    id: "4",
    created_date: "2025-01-20T16:45:00Z",
    title: "Random Thoughts on UI Design",
    slug: "ui-design-thoughts",
    excerpt: "I am not a designer, but I have opinions.",
    content: "# Minimalism\n\nLess is more, but not always...",
    category: "other",
    published: true
  }
];

const galleryItems = [
  {
    id: "g1",
    title: "Mountain Hike",
    description: "A beautiful day in the Alps.",
    type: "photo",
    image_url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
    date: "2024-09-10"
  },
  {
    id: "g2",
    title: "Tech Conference Talk",
    description: "Speaking about React performance.",
    type: "event",
    image_url: "https://images.unsplash.com/photo-1544531586-fde5298cdd40",
    date: "2024-11-05"
  },
  {
    id: "g3",
    title: "Podcast Episode 42",
    description: "Discussing the state of web development.",
    type: "podcast",
    image_url: "https://images.unsplash.com/photo-1478737270239-2f02b77ac6d5",
    link: "https://example.com/podcast",
    date: "2025-01-12"
  }
];

const socialLinks = [
  { id: "s1", name: "GitHub", url: "https://github.com", icon: "github", order: 1 },
  { id: "s2", name: "Twitter", url: "https://twitter.com", icon: "twitter", order: 2 },
  { id: "s3", name: "LinkedIn", url: "https://linkedin.com", icon: "linkedin", order: 3 }
];

const comments = [];
const likes = [];
const userSettings = {
  theme: "light",
  color_palette: "warm",
  font_family: "playfair"
};

// Helper to filter/sort
const queryData = (data, filters = {}, sortField = null, limit = null) => {
  let result = [...data];

  // Filter
  if (filters) {
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined) {
         result = result.filter(item => item[key] === filters[key]);
      }
    });
  }

  // Sort
  if (sortField) {
    const isDesc = sortField.startsWith('-');
    const field = isDesc ? sortField.substring(1) : sortField;
    
    result.sort((a, b) => {
      if (a[field] < b[field]) return isDesc ? 1 : -1;
      if (a[field] > b[field]) return isDesc ? -1 : 1;
      return 0;
    });
  }

  // Limit
  if (limit) {
    result = result.slice(0, limit);
  }

  return result;
};

// Helper to create
const createItem = (dataArray, item) => {
  const newItem = {
    ...item,
    id: Math.random().toString(36).substr(2, 9),
    created_date: new Date().toISOString()
  };
  dataArray.push(newItem);
  return newItem;
};

// Helper to delete
const deleteItem = (dataArray, id) => {
  const index = dataArray.findIndex(item => item.id === id);
  if (index !== -1) {
    dataArray.splice(index, 1);
  }
  return { success: true };
};

export const base44 = {
  entities: {
    BlogPost: {
      filter: async (filters, sort, limit) => queryData(blogPosts, filters, sort, limit),
      list: async (sort, limit) => queryData(blogPosts, {}, sort, limit)
    },
    Gallery: {
      filter: async (filters, sort, limit) => queryData(galleryItems, filters, sort, limit),
      list: async (sort, limit) => queryData(galleryItems, {}, sort, limit)
    },
    SocialLink: {
      filter: async (filters, sort, limit) => queryData(socialLinks, filters, sort, limit),
      list: async (sort, limit) => queryData(socialLinks, {}, sort, limit)
    },
    Comment: {
      filter: async (filters, sort, limit) => queryData(comments, filters, sort, limit),
      list: async (sort, limit) => queryData(comments, {}, sort, limit),
      create: async (data) => createItem(comments, data)
    },
    Like: {
      filter: async (filters, sort, limit) => queryData(likes, filters, sort, limit),
      list: async (sort, limit) => queryData(likes, {}, sort, limit),
      create: async (data) => createItem(likes, data),
      delete: async (id) => deleteItem(likes, id)
    },
    UserSettings: {
      get: async () => userSettings
    }
  }
};