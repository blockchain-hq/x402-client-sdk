/**
 * x402 Client SDK - Official Coinbase Protocol Implementation
 * Automatically handles 402 responses and makes USDC payments on Solana
 * Features auto-generated wallet
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';

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

export class X402Client {
  private wallet: Keypair;
  private network: 'devnet' | 'mainnet-beta';
  private connection: Connection;

  constructor(walletInfo?: WalletInfo) {
    if (walletInfo) {
      // Use provided wallet
      this.wallet = Keypair.fromSecretKey(bs58.decode(walletInfo.privateKey));
      this.network = walletInfo.network;
    } else {
      // Auto-generate new wallet
      this.wallet = Keypair.generate();
      this.network = 'devnet';
    }

    // Initialize connection
    const rpcUrl = this.network === 'mainnet-beta'
      ? 'https://api.mainnet-beta.solana.com'
      : 'https://api.devnet.solana.com';
    
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  /**
   * Get wallet information
   */
  getWalletInfo(): WalletInfo {
    return {
      address: this.wallet.publicKey.toBase58(),
      privateKey: bs58.encode(this.wallet.secretKey),
      network: this.network
    };
  }

  /**
   * Get wallet balance in SOL
   */
  async getBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / 1e9; // Convert lamports to SOL
  }

  /**
   * Get USDC token balance
   */
  async getUSDCBalance(usdcMint: string): Promise<number> {
    try {
      const mintPubkey = new PublicKey(usdcMint);
      const tokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        this.wallet.publicKey
      );

      const balance = await this.connection.getTokenAccountBalance(tokenAccount);
      return parseFloat(balance.value.uiAmount?.toString() || '0');
    } catch (error) {
      return 0; // Token account doesn't exist yet
    }
  }

  /**
   * Parse 402 response and extract payment details
   */
  parse402Response(response: X402Response): X402PaymentRequirement | null {
    if (!response.accepts || response.accepts.length === 0) {
      return null;
    }

    // Get first payment option (usually only one)
    return response.accepts[0];
  }

  /**
   * Make USDC payment to fulfill x402 requirement
   */
 /**
 * Make USDC payment to fulfill x402 requirement
 */
async makePayment(paymentReq: X402PaymentRequirement): Promise<PaymentResult> {
  try {
    const recipientPubkey = new PublicKey(paymentReq.payTo);
    const usdcMint = new PublicKey(paymentReq.asset);
    const amount = parseInt(paymentReq.maxAmountRequired);

    console.log('💳 [PAYMENT] Starting payment:', {
      recipient: paymentReq.payTo,
      amount: amount / 1_000_000,
      mint: paymentReq.asset
    });

    // Get token account addresses
    const senderTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      this.wallet.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const recipientTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      recipientPubkey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log('📍 [PAYMENT] Token accounts:', {
      sender: senderTokenAccount.toBase58(),
      recipient: recipientTokenAccount.toBase58()
    });

    // CRITICAL: Check if accounts actually exist using getAccountInfo
    // getTokenAccountBalance can return cached/stale data on devnet
    const [senderAccountInfo, recipientAccountInfo] = await Promise.all([
      this.connection.getAccountInfo(senderTokenAccount),
      this.connection.getAccountInfo(recipientTokenAccount)
    ]);

    console.log('🔍 [PAYMENT] Account existence check:', {
      senderExists: !!senderAccountInfo,
      senderOwner: senderAccountInfo?.owner.toBase58(),
      recipientExists: !!recipientAccountInfo,
      recipientOwner: recipientAccountInfo?.owner.toBase58()
    });

    // If sender account doesn't exist, we can't transfer
    if (!senderAccountInfo) {
      console.error('❌ [PAYMENT] Sender token account does not exist!');
      console.error('This means the wallet has NOT received USDC yet, or received USDC for a different mint.');
      
      return {
        success: false,
        error: `Sender's USDC token account does not exist for mint ${paymentReq.asset}. ` +
               `The wallet must receive USDC from this specific mint before it can send payments. ` +
               `Please use Circle's faucet at https://faucet.circle.com/ to receive USDC for the correct mint.`
      };
    }

    // Double-check balance to ensure account has funds
    let actualBalance = 0;
    try {
      const balanceInfo = await this.connection.getTokenAccountBalance(senderTokenAccount);
      actualBalance = parseFloat(balanceInfo.value.uiAmount?.toString() || '0');
      console.log('💰 [PAYMENT] Actual sender balance:', actualBalance, 'USDC');
    } catch (error) {
      console.error('❌ [PAYMENT] Could not get balance:', error);
      return {
        success: false,
        error: 'Could not verify USDC balance. Token account may be invalid.'
      };
    }

    if (actualBalance < amount / 1_000_000) {
      return {
        success: false,
        error: `Insufficient USDC balance. Have ${actualBalance} USDC, need ${amount / 1_000_000} USDC.`
      };
    }

    // Build transaction
    const transaction = new Transaction();

    // Create recipient token account if needed
    if (!recipientAccountInfo) {
      console.log('📝 [PAYMENT] Creating recipient token account...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          this.wallet.publicKey,
          recipientTokenAccount,
          recipientPubkey,
          usdcMint,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        )
      );
    } else {
      console.log('✅ [PAYMENT] Recipient token account exists');
    }

    // Add transfer instruction
    console.log(`💸 [PAYMENT] Adding transfer: ${amount} smallest units (${amount / 1_000_000} USDC)`);
    transaction.add(
      createTransferInstruction(
        senderTokenAccount,
        recipientTokenAccount,
        this.wallet.publicKey,
        amount,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Get recent blockhash and set fee payer
    const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = this.wallet.publicKey;

    console.log('📤 [PAYMENT] Sending transaction...');

    // Send and confirm
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.wallet],
      {
        commitment: 'confirmed',
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3
      }
    );

    console.log('✅ [PAYMENT] Success! Signature:', signature);

    return {
      success: true,
      signature,
      amount: amount / 1_000_000,
      recipient: paymentReq.payTo
    };

  } catch (error) {
    console.error('❌ [PAYMENT] Transaction failed:', error);
    
    let errorMessage = 'Payment transaction failed';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Log transaction logs if available
      if ('logs' in error) {
        console.error('Transaction logs:', (error as any).logs);
      }
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

  /**
   * Automatically handle 402 response and make payment
   */
  async handleX402(response: X402Response): Promise<PaymentResult> {
    const paymentReq = this.parse402Response(response);

    if (!paymentReq) {
      return {
        success: false,
        error: 'No valid payment requirements in 402 response'
      };
    }

    // Verify network matches
    const networkFromReq = paymentReq.network.replace('solana-', '');
    if (networkFromReq !== this.network) {
      return {
        success: false,
        error: `Network mismatch: wallet is on ${this.network}, payment requires ${networkFromReq}`
      };
    }

    // Make payment
    return await this.makePayment(paymentReq);
  }

  /**
   * Create payment header for HTTP request
   */
  createPaymentHeader(signature: string): string {
    const paymentPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: `solana-${this.network}`,
      payload: {
        signature,
        from: this.wallet.publicKey.toBase58()
      }
    };

    // Encode as base64
    return Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
  }

  /**
   * Full flow: Fetch resource, handle 402, retry with payment
   */
  async fetchWithPayment(url: string, options?: RequestInit): Promise<Response> {
    // First request
    let response = await fetch(url, options);

    // Check if 402
    if (response.status === 402) {
      const x402Response = await response.json() as X402Response;

      // Make payment
      const paymentResult = await this.handleX402(x402Response);

      if (!paymentResult.success) {
        throw new Error(`Payment failed: ${paymentResult.error}`);
      }

      // Retry request with payment header
      const paymentHeader = this.createPaymentHeader(paymentResult.signature!);

      response = await fetch(url, {
        ...options,
        headers: {
          ...options?.headers,
          'X-PAYMENT': paymentHeader
        }
      });
    }

    return response;
  }
}

/**
 * Helper: Generate a new wallet
 */
export function generateWallet(network: 'devnet' | 'mainnet-beta' = 'devnet'): WalletInfo {
  const keypair = Keypair.generate();
  return {
    address: keypair.publicKey.toBase58(),
    privateKey: bs58.encode(keypair.secretKey),
    network
  };
}

/**
 * Helper: Quick payment to 402 response
 */
export async function payFor402(
  x402Response: X402Response,
  walletInfo?: WalletInfo
): Promise<PaymentResult> {
  const client = new X402Client(walletInfo);
  return await client.handleX402(x402Response);
}
