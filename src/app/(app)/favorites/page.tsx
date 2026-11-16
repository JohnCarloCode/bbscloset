// Placeholder: solo el título. La pantalla se construye en su paso del plan.
import { useTranslations } from "next-intl";

export default function FavoritesPage() {
  const t = useTranslations("nav");
  return (
    <main className="px-5 pt-lg pb-xl">
      <h1 className="text-lead font-semibold">{t("favorites")}</h1>
    </main>
  );
}
