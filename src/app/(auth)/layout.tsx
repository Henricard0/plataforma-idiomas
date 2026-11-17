import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 font-display text-2xl font-semibold text-ink">
        {APP_NAME}
      </Link>
      <div className="card w-full max-w-sm p-6 sm:p-8">{children}</div>
    </div>
  );
}
