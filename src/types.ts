export interface X402PaymentRequirement {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  outputSchema?: object | null;
  extra?: any;
}

export interface X402Response {
  x402Version: number;
  accepts: X402PaymentRequirement[];
  error?: string;
}

export interface WalletInfo {
  address: string;
  privateKey: string;
  network: 'devnet' | 'mainnet-beta';
}

export interface PaymentResult {
  success: boolean;
  signature?: string;
  error?: string;
  amount?: number;
  recipient?: string;
}
