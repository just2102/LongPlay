import { Providers } from "./providers";
import "@rainbow-me/rainbowkit/styles.css";
import { Footer } from "~~/components/Footer";
import "~~/styles/globals.css";
import { getMetadata } from "~~/utils/scaffold-eth/getMetadata";

export const metadata = getMetadata({
  title: "LongPlay",
  description: "LongPlay — Automated Liquidity Farming",
});

const App = ({ children }: { children: React.ReactNode }) => {
  return (
    <html suppressHydrationWarning className={``}>
      <body>
        <Providers>
          <>
            {children}

            <Footer />
          </>
        </Providers>
      </body>
    </html>
  );
};

export default App;
