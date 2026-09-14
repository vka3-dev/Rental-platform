import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { preloadRentalRequests } from "../services/rentalRequestsService";
import "./Navbar.css";
import logo from "../assets/images/logo.png";

function Navbar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser?.id) {
        preloadRentalRequests(currentUser.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser?.id) {
        preloadRentalRequests(currentUser.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/login");
  };

  const handleRequestsHover = () => {
    if (user?.id) {
      preloadRentalRequests(user.id);
    }
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-logo">
        <img src={logo} alt="ShareSpare" />
      </Link>

      <div className="navbar-links">
        <Link to="/">Home</Link>
        <Link to="/products">Explore</Link>
        {user && (
          <>
            <Link to="/my-rentals">My Rentals</Link>
            <Link to="/my-listings">My Listings</Link>
            <Link
              to="/rental-requests"
              onMouseEnter={handleRequestsHover}
              onTouchStart={handleRequestsHover}
            >
              Requests
            </Link>
            <Link to="/notifications">Notifications</Link>
          </>
        )}
      </div>

      <div className="navbar-actions">
        {user ? (
          <button onClick={handleLogout} className="navbar-logout-btn">
            Logout
          </button>
        ) : (
          <>
            <Link to="/login" className="navbar-login-link">
              Login
            </Link>
            <Link to="/register" className="navbar-signup">
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;