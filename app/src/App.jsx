import Dice from './Dice.jsx'
import './App.css'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
// import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import '@solana/wallet-adapter-react-ui/styles.css';
import { clusterApiUrl } from '@solana/web3.js';
import header from './assets/header.png'

const network = clusterApiUrl('testnet')


function App() {
  const wallets = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter()
  ];

  return (
    <>
        <ConnectionProvider endpoint={network}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    <WalletMultiButton style={{}} />
                    <div className="App">
                        <header className="App-header">
                            <img src={header} className="img-fluid" alt={"header"} />
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
