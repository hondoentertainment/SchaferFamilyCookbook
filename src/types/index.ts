import type { RecipeCategory } from '../constants/taxonomy';

export interface Recipe {
  id: string;
  title: string;
  contributor: string;
  category: RecipeCategory;
  ingredients: string[];
  instructions: string[];
  notes?: string;
  image: string;
  /** Optional instructional images aligned by instruction index. */
  stepImages?: string[];
  /** How the image was sourced; used for AI badge and accuracy tracking. */
  imageSource?: 'upload' | 'nano-banana' | 'pollinations' | 'local-generated';
  /** True when the committed image is a temporary generated food photo pending a creator-uploaded actual. */
  generatedImageFallback?: boolean;
  /** Prompt used to create the temporary generated food photo, retained for traceability. */
  generatedImagePrompt?: string;
  prepTime?: string;
  cookTime?: string;
  calories?: number;
  /** Number of servings (e.g. 4) or yield description (e.g. "2 dozen cookies") */
  servings?: string | number;
  tags?: string[];
  collections?: string[];
  occasions?: string[];
  season?: string;
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

export interface TriviaScore {
  id: string;
  playerName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timestamp: string;
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

export interface RecipeRating {
  recipeId: string;
  userName: string;
  rating: number; // 1-5
  timestamp: string;
}

export interface RecipeNote {
  id: string;
  recipeId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface RecipeCollection {
  id: string;
  name: string;
  description?: string;
  recipeIds: string[];
  createdBy: string;
  icon: string;
  timestamp: string;
}

export interface StorySection {
  id: string;
  heading: string;
  body: string;
  order: number;
}

export interface RecipeVersion extends Recipe {
  savedAt: string;
  savedBy: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large';

export interface UserPreferences {
  theme: ThemeMode;
  fontSize: FontSize;
  highContrast: boolean;
}
