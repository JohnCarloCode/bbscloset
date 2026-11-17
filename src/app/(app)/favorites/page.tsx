// Favoritos (screens.md 10; paso 5.3). La pantalla es de cliente: los datos
// llegan por la API (apiFetch) en useFavoritesList; el esqueleto de la
// cuadrícula sale ya en la primera pintura.
import { FavoritesList } from "@/features/favorites/FavoritesList";

export default function FavoritesPage() {
  return <FavoritesList />;
}
