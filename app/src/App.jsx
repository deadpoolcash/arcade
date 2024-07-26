import Dice from './Dice.jsx'
import './App.css'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    AlphaWalletAdapter,
    BitgetWalletAdapter,
    AvanaWalletAdapter,
    BitpieWalletAdapter,
    CoinbaseWalletAdapter,
    CoinhubWalletAdapter,
    LedgerWalletAdapter,
    HuobiWalletAdapter,
    HyperPayWalletAdapter,
    MathWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import '@solana/wallet-adapter-react-ui/styles.css';
import { clusterApiUrl } from '@solana/web3.js';
import header from './assets/header.png'

// const network = clusterApiUrl('mainnet-beta')
const network = "https://mainnet.helius-rpc.com/?api-key=f1af8375-3f82-429d-a81b-9d398fa31c30"

function App() {
  const wallets = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new AlphaWalletAdapter(),
      new BitgetWalletAdapter(),
      new AvanaWalletAdapter(),
      new BitpieWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new CoinhubWalletAdapter(),
      new LedgerWalletAdapter(),
      new HuobiWalletAdapter(),
      new HyperPayWalletAdapter(),
      new MathWalletAdapter()
  ];

  return (
    <>
        <ConnectionProvider endpoint={network}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    <WalletMultiButton style={{}} />
                    <div className="App" >
                        <header className="App-header" >
                            <img src={header} className="img-fluid" alt={"header"} style={{width: '70%'}} />
                            <Dice />
                        </header>
                    </div>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    </>
  )
}

export default App
