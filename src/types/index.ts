export interface Recipe {
  id: string;
  title: string;
  contributor: string;
  category: 'Breakfast' | 'Main' | 'Dessert' | 'Side' | 'Appetizer' | 'Bread' | 'Dip/Sauce' | 'Snack';
  ingredients: string[];
  instructions: string[];
  notes?: string;
  image: string;
  prepTime?: string;
  cookTime?: string;
  calories?: number;
  created_at?: string;
}

export interface GalleryItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  caption: string;
  contributor: string;
  created_at?: string;
}

export interface Trivia {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  contributor: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  picture: string;
  role: 'admin' | 'user';
  email?: string;
}

export interface DBStats {
  recipeCount: number;
  galleryCount: number;
  triviaCount: number;
  isCloudActive: boolean;
  activeProvider: 'local' | 'firebase';
  archivePhone?: string;
}

export interface ContributorProfile {
  id: string;
  name: string;
  avatar: string;
  role: 'admin' | 'user';
  email?: string;
  phone?: string;
}

export interface HistoryEntry {
  id: string;
  contributor: string;
  action: 'added' | 'updated' | 'deleted';
  type: 'recipe' | 'gallery' | 'trivia';
  itemName: string;
  timestamp: string;
}
