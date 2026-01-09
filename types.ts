export interface Product {
  id: string;
  title: string;
  sku: string;
  price: number;
  dimensions: {
    height: number;
    width: number;
    length: number;
  };
  weight: number; // in kg
  mlStatus: 'active' | 'paused' | 'review';
  shippingMode: 'me1' | 'me2' | 'custom' | null;
  lastSync?: string;
  thumbnail?: string; // Add thumbnail support
  permalink?: string; // Link to the real ad
}

export interface LogisticsAnalysis {
  category: string;
  estimatedCost: string;
  volumetricWeight: number;
  warnings: string[];
  packingTips: string;
  isOptimized: boolean;
}

export interface MeliUser {
  id: number;
  nickname: string;
  email: string;
  points: number;
}

export enum Tab {
  DASHBOARD = 'DASHBOARD',
  PRODUCTS = 'PRODUCTS',
  SETTINGS = 'SETTINGS'
}