import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    SystemProgram,
    sendAndConfirmTransaction,
    LAMPORTS_PER_SOL,
  } from '@solana/web3.js';
  import {
    X402ClientConfig,
    PaymentRequirements,
    PaymentResult,
    ParsedPaymentRequest,
  } from './types';
  import {
    SOLANA_DEVNET_RPC,
    SOLANA_MAINNET_RPC,
  } from './constants';
  
  export class SolanaX402Client {
    private connection: Connection;
    private config: X402ClientConfig;
  
    constructor(config: X402ClientConfig) {
      this.config = config;
      
      const rpcUrl = config.rpcUrl || 
        (config.network === 'devnet' ? SOLANA_DEVNET_RPC : SOLANA_MAINNET_RPC);
      
      this.connection = new Connection(rpcUrl, 'confirmed');
    }
  
    /**
     * Parse payment requirements from 402 response
     */
    parsePaymentRequirements(
      requirements: PaymentRequirements
    ): ParsedPaymentRequest {
      // Get first Solana payment option
      const solanaOption = requirements.paymentOptions.find(
        (opt) => opt.scheme === 'solana' && opt.network === this.config.network
      );
  
      if (!solanaOption) {
        throw new Error(
          `No Solana payment option found for network: ${this.config.network}`
        );
      }
  
      return {
        amount: parseFloat(solanaOption.amount),
        recipient: solanaOption.recipient,
        token: solanaOption.token || 'native', // 'native' means SOL
        network: solanaOption.network,
        decimals: solanaOption.decimals || 9, // SOL has 9 decimals
        paymentOptionId: solanaOption.id,
      };
    }
  
    /**
     * Execute SOL payment (native transfer)
     */
    async executePayment(
      payerKeypair: Keypair,
      paymentRequest: ParsedPaymentRequest
    ): Promise<PaymentResult> {
      const recipient = new PublicKey(paymentRequest.recipient);
      const payer = payerKeypair.publicKey;
  
      // Convert SOL to lamports (1 SOL = 1 billion lamports)
      const lamports = Math.floor(
        paymentRequest.amount * LAMPORTS_PER_SOL
      );
  
      // Create simple SOL transfer transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: recipient,
          lamports: lamports,
        })
      );
  
      // Send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [payerKeypair],
        { commitment: 'confirmed' }
      );
  
      return {
        signature,
        paymentOptionId: paymentRequest.paymentOptionId,
        amount: paymentRequest.amount,
        recipient: paymentRequest.recipient,
        timestamp: Date.now(),
      };
    }
  
    /**
     * Complete flow: Parse 402 response and execute payment
     */
    async payFor402Response(
      payerKeypair: Keypair,
      requirements: PaymentRequirements
    ): Promise<PaymentResult> {
      const parsed = this.parsePaymentRequirements(requirements);
      return this.executePayment(payerKeypair, parsed);
    }
  
    /**
     * Check SOL balance
     */
    async checkBalance(walletAddress: string): Promise<number> {
      const wallet = new PublicKey(walletAddress);
      const balance = await this.connection.getBalance(wallet);
      return balance / LAMPORTS_PER_SOL; // Convert lamports to SOL
    }
  
    /**
     * Helper: Create keypair from private key
     */
    static keypairFromSecretKey(secretKey: string): Keypair {
      const bs58 = require('bs58');
      const decoded = bs58.decode(secretKey);
      return Keypair.fromSecretKey(decoded);
    }
  
    /**
     * Helper: Generate new keypair
     */
    static generateKeypair(): Keypair {
      return Keypair.generate();
    }
  }