import { SolanaX402Client } from '../src/client';
import { Keypair } from '@solana/web3.js';
import { PaymentRequirements } from '../src/types';
import * as fs from 'fs';

const keypairData = JSON.parse(
  fs.readFileSync('/Users/mahimathacker/devnet-test-wallet.json', 'utf-8')
);

async function testClient() {
  console.log('🧪 Testing x402 Client SDK (SOL Payments)\n');

  // Initialize client
  const client = new SolanaX402Client({
    network: 'devnet',
  });

  console.log('✅ Client initialized\n');

  // Example 402 response (SOL payment)
  const payment402: PaymentRequirements = {
    version: '1.0',
    paymentOptions: [
      {
        id: 'test-payment',
        scheme: 'solana',
        network: 'devnet',
        recipient: '8qEoLvRsumJpNCn7Q5PT19W5X5g62TKjCaMBDVBpu1hr',
        token: 'native', // 'native' means SOL
        amount: '0.01',   // 0.01 SOL
        decimals: 9,
      },
    ],
  };

  // Parse payment requirements
  console.log('📝 Parsing payment requirements...');
  const parsed = client.parsePaymentRequirements(payment402);
  console.log('Parsed:', parsed);
  console.log('✅ Parse successful\n');

  // Load payer keypair
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log('💰 Payer address:', payer.publicKey.toBase58());
  
  // Check SOL balance
  const balance = await client.checkBalance(
    payer.publicKey.toBase58()
  );
  console.log('Balance:', balance, 'SOL\n');

  if (balance < parsed.amount) {
    console.log('⚠️  Insufficient balance to test payment');
    console.log(`Need: ${parsed.amount} SOL`);
    console.log(`Have: ${balance} SOL`);
    console.log('\nTo test payment:');
    console.log('   solana airdrop 2', payer.publicKey.toBase58(), '--url devnet');
    return;
  }

  // Execute payment
  console.log('💸 Executing SOL payment...');
  const result = await client.executePayment(payer, parsed);
  
  console.log('\n✅ Payment successful!');
  console.log('Signature:', result.signature);
  console.log('Amount:', result.amount, 'SOL');
  console.log('Recipient:', result.recipient);
  console.log('\nView on explorer:');
  console.log(`https://explorer.solana.com/tx/${result.signature}?cluster=devnet`);
  
  console.log('\n🎉 Client SDK test complete!');
  console.log('\nNext: Use this signature in X-Payment header');
}

testClient().catch(console.error);