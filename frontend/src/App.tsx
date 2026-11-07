import { Routes, Route } from "react-router-dom";
import Layout from "./components/layout/Layout";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentResultPage from "./pages/PaymentResultPage";
import SellerDashboard from "./pages/seller/SellerDashboard";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import SellerRoute from "./components/auth/SellerRoute";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout/success"
          element={
            <ProtectedRoute>
              <PaymentResultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout/cancel"
          element={
            <ProtectedRoute>
              <PaymentResultPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seller/dashboard"
          element={
            <SellerRoute>
              <SellerDashboard />
            </SellerRoute>
          }
        />
      </Routes>
    </Layout>
  );
}
