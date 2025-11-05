export interface PaymentRequirements {
    version: string;
    paymentOptions: PaymentOption[];
  }
  
  export interface PaymentOption {
    id: string;
    scheme: string;
    network: string;
    recipient: string;
    token?: string;     
    amount: string;
    decimals: number;
  }
  
  export interface X402ClientConfig {
    network: 'devnet' | 'mainnet-beta';
    rpcUrl?: string;
  }
  
  export interface PaymentResult {
    signature: string;
    paymentOptionId: string;
    amount: number;
    recipient: string;
    timestamp: number;
  }
  
  export interface ParsedPaymentRequest {
    amount: number;
    recipient: string;
    token: string;
    network: string;
    decimals: number;
    paymentOptionId: string;
  }