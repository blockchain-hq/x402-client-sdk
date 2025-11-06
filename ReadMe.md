# x402 Client SDK

Client-side SDK for making SOL payments in response to HTTP 402 errors.

[![npm version](https://badge.fury.io/js/x402-client-sdk.svg)](https://www.npmjs.com/package/x402-client-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Parse 402 payment requirements
- Make SOL payments automatically
- Return transaction signatures
- Check balances
- Devnet & Mainnet support

## Installation

```bash
npm install x402-client-sdk
```

## Quick Start

```typescript
import { SolanaX402Client } from 'x402-client-sdk';
import { Keypair } from '@solana/web3.js';

const client = new SolanaX402Client({ network: 'devnet' });
const payer = Keypair.fromSecretKey(/* your key */);

// Automatic payment on 402
try {
  const response = await fetch('https://api.example.com/premium');
} catch (error) {
  if (error.status === 402) {
    // Parse and pay in one step
    const result = await client.payFor402Response(payer, error.data);
    
    // Retry with signature
    const retry = await fetch(url, {
      headers: { 'X-Payment': result.signature }
    });
  }
}
```

## API

### Constructor

```typescript
new SolanaX402Client({
  network: 'devnet' | 'mainnet-beta',
  rpcUrl?: string
})
```

### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `parsePaymentRequirements(requirements)` | Parse 402 response | `ParsedPaymentRequest` |
| `executePayment(payer, request)` | Send payment | `Promise<PaymentResult>` |
| `payFor402Response(payer, requirements)` | Parse + Pay (recommended) | `Promise<PaymentResult>` |
| `checkBalance(address)` | Check SOL balance | `Promise<number>` |

### Static Helpers

```typescript
// Create keypair from base58 key
SolanaX402Client.keypairFromSecretKey(key)

// Generate new keypair
SolanaX402Client.generateKeypair()
```

## Axios Integration

```typescript
import axios from 'axios';

axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 402) {
      const result = await client.payFor402Response(
        payer,
        error.response.data
      );
      
      error.config.headers['X-Payment'] = result.signature;
      return axios.request(error.config);
    }
    throw error;
  }
);
```

## Wallet Management

```typescript
// From file
const keypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync('wallet.json')))
);

// From base58
const keypair = SolanaX402Client.keypairFromSecretKey('YOUR_KEY');

// Generate new
const keypair = SolanaX402Client.generateKeypair();
```

## Networks

**Devnet:**
```bash
solana airdrop 2 YOUR_ADDRESS --url devnet
```

**Mainnet:**
Purchase SOL from exchange

## Troubleshooting

| Error | Solution |
|-------|----------|
| Insufficient balance | Get more SOL (airdrop or purchase) |
| Transaction failed | Check network and balance |
| No payment option | Verify network matches server |

## License

MIT

## Contributing

Issues and PRs welcome!

## Support

- [GitHub Issues](https://github.com/blockchain-hq/x402-client-sdk/issues)

---

Made with love for Solana