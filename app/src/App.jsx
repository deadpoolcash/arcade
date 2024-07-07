import Dice from './Dice.jsx'
import './App.css'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
// import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import '@solana/wallet-adapter-react-ui/styles.css';


const network = 'https://api.devnet.solana.com';


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
                            <h1>Deadpool Casino</h1>
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
