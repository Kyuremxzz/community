import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui";
import { UserProvider } from "@/components/UserContext";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: {
    default: "TaskForge — estágios simulados para quem aprende a programar",
    template: "%s · TaskForge",
  },
  description:
    "Entre num squad, encare um prazo de verdade e entregue como num estágio — sem precisar de um.",
  applicationName: "TaskForge",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>
          <UserProvider>
            <div className={styles.shell}>
              <Topbar />
              <main className={`container section ${styles.main}`}>{children}</main>
              <Footer />
            </div>
          </UserProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
