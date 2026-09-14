import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./LoginPage.css";
import { supabase } from "../lib/supabase";
import { getUserById } from "../services/api";

function LoginPage() {

  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);


  const handleLogin = async (event) => {

    event.preventDefault();

    setError("");
    setLoading(true);

    try {

      const {data,error: authError} = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      const userId = data.session?.user?.id;
      if (userId) {
        try {
          const profile = await getUserById(userId);
          if (profile?.location && profile.location.trim()) {
            localStorage.setItem("user_city", profile.location.trim());
          } else {
            const metaCity = data.session?.user?.user_metadata?.location;
            if (metaCity) localStorage.setItem("user_city", metaCity);
          }
        } catch {
          const metaCity = data.session?.user?.user_metadata?.location;
          if (metaCity) localStorage.setItem("user_city", metaCity);
        }
      }

      navigate("/products");

    } catch (error) {

      setError("An unexpected error occured. Please try again.");

    } finally {

      setLoading(false);

    }
  };


  

  return (

    <div className="login-page">

      <div className="login-card">

        <div className="login-header">

          <Link
            to="/"
            className="login-logo"
          >
            ShareSpare
          </Link>


          <h1>
            Welcome Back
          </h1>


          <p>
            Login to continue using ShareSpare.
          </p>

        </div>


        {error && (

          <div className="login-error">
            {error}
          </div>

        )}


        <form
          className="login-form"
          onSubmit={handleLogin}
        >


          <div className="form-group">

            <label htmlFor="email">
              Email Address
            </label>


            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />

          </div>


          <div className="form-group">

            <div className="password-row">

              <label htmlFor="password">
                Password
              </label>


              <Link to="/forgot-password">
                Forgot Password?
              </Link>

            </div>


            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
            />

          </div>


          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >

            {loading
              ? "Logging in..."
              : "Login"
            }

          </button>

        </form>


        <div className="register-section">

          <span>
            Don't have an account?
          </span>


          <Link to="/register">
            Create an account
          </Link>

        </div>


        <div className="back-home">

          <Link to="/">
            Back to ShareSpare
          </Link>

        </div>

      </div>

    </div>
  );
}

export default LoginPage;