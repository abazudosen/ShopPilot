import { useAuth } from "../../hooks/useAuth";

export default function SellerDashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Seller Dashboard</h1>
      <p className="text-gray-500 mt-2">
        Welcome, {user?.name}. The full dashboard arrives later in the course.
      </p>
    </div>
  );
}
