import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getItemImages, getProducts, getUserById } from "../services/api";
import { supabase } from "../lib/supabase";
import { IconSearch, IconMapPin, IconX } from "../components/Icons";
import "./ProductsPage.css";

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedCity, setSelectedCity] = useState(
    () => localStorage.getItem("user_city") || "All"
  );
  const [userCity, setUserCity] = useState(
    () => localStorage.getItem("user_city") || ""
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const categories = [
    { label: "All", id: null },
    { label: "Electronics", id: 1 },
    { label: "Tools & Equipment", id: 2 },
    { label: "Furniture & Home", id: 3 },
    { label: "Outdoor & Events", id: 4 },
  ];

  const baseCities = [
    "All",
    "Chennai",
    "Madurai",
    "Pondicherry",
    "Coimbatore",
    "Trichy",
    "Salem",
  ];

  const cityOptions = Array.from(
    new Set([
      "All",
      ...(selectedCity && selectedCity !== "All" ? [selectedCity] : []),
      ...(userCity ? [userCity] : []),
      ...products.map((p) => p.location?.trim()).filter(Boolean),
      ...baseCities.filter((c) => c !== "All"),
    ])
  );

  useEffect(() => {
    async function init() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;

        if (user?.id) {
          try {
            const profile = await getUserById(user.id);
            if (profile?.location && profile.location.trim()) {
              const dbCity = profile.location.trim();
              localStorage.setItem("user_city", dbCity);
              setUserCity(dbCity);
              setSelectedCity(dbCity);
            }
          } catch (profileErr) {
            console.warn("Could not load user profile:", profileErr);
            const metaCity = user?.user_metadata?.location?.trim();
            if (metaCity) {
              setUserCity(metaCity);
              setSelectedCity(metaCity);
            }
          }
        }
      } catch (err) {
        console.warn("Could not determine user location:", err);
      }

      try {
        setLoading(true);

        const data = await getProducts();
        const productsWithImages = await Promise.all(
          data.map(async (product) => {
            let images = [];
            try {
              images = await getItemImages(product.itemId);
            } catch (imageError) {
              console.warn(`Unable to load images for item ${product.itemId}:`, imageError);
            }
            const primaryImage =
              images.find((image) => image.isPrimary) || images[0];

            return {
              ...product,
              imageUrl: primaryImage?.imageUrl || "",
            };
          })
        );

        setProducts(productsWithImages);
      } catch (error) {
        console.error("Error fetching products:", error);
        setError("Unable to load products. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.itemName
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === null || product.catID === selectedCategory;

    const matchesCity =
      !selectedCity ||
      selectedCity === "All" ||
      product.location?.trim().toLowerCase() === selectedCity.trim().toLowerCase();

    const isAvailable =
      product.availability !== false &&
      (product.quantity === undefined ||
        product.quantity === null ||
        Number(product.quantity) > 0);

    return matchesSearch && matchesCategory && matchesCity && isAvailable;
  });

  return (
    <div className="products-page">
      <Navbar />

      <section className="products-header">
        <div className="products-header-content">
          <h1>Explore Products</h1>
          <p>Find the products you need and rent them from people around you.</p>
        </div>
      </section>

      <section className="products-search-section">
        <div className="search-and-filter-row">
          <div className="search-box">
            <IconSearch size={17} className="search-icon" />
            <input
              type="text"
              placeholder="Search products by name..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchTerm("")}
                title="Clear search"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          <div className="city-filter-compact">
            <IconMapPin size={15} className="city-icon" />
            <select
              className="city-select"
              value={selectedCity}
              onChange={(event) => setSelectedCity(event.target.value)}
              title="Filter by city"
            >
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city === "All" ? "All Cities" : city}
                </option>
              ))}
            </select>
            {selectedCity !== "All" && (
              <button
                type="button"
                className="city-clear-btn"
                onClick={() => setSelectedCity("All")}
                title="Show all cities"
              >
                <IconX size={12} />
              </button>
            )}
          </div>
        </div>

        {userCity && (
          <div className="location-context-bar">
            {selectedCity.toLowerCase() === userCity.toLowerCase() ? (
              <span className="location-context-pill active">
                <IconMapPin size={12} />
                Showing items in your city: <strong>{userCity}</strong>
                <button
                  type="button"
                  className="location-show-all-btn"
                  onClick={() => setSelectedCity("All")}
                >
                  Show all cities
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="location-quick-switch-btn"
                onClick={() => setSelectedCity(userCity)}
              >
                <IconMapPin size={12} />
                Switch back to my city ({userCity})
              </button>
            )}
          </div>
        )}

        <div className="category-filter">
          {categories.map((category) => (
            <button
              key={category.label}
              className={
                selectedCategory === category.id
                  ? "category-button active"
                  : "category-button"
              }
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      <section className="products-section">
        <div className="products-section-header">
          <h2>Available Products</h2>
          <span>{filteredProducts.length} products</span>
        </div>

        {loading && (
          <div className="products-message">
            <p>Loading products...</p>
          </div>
        )}

        {!loading && error && (
          <div className="products-message error">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && filteredProducts.length > 0 && (
          <div className="products-grid">
            {filteredProducts.map((product) => (
              <div className="product-card" key={product.itemId}>
                <div className="product-image">
                  <img
                    src={
                      product.imageUrl ||
                      "https://via.placeholder.com/300x220?text=ShareSpare"
                    }
                    alt={product.itemName}
                  />
                </div>

                <div className="product-content">
                  <div className="product-card-meta">
                    <span className="product-category">
                      {product.category || "Available item"}
                    </span>
                    {product.location && (
                      <span className="product-location-tag">
                        <IconMapPin size={11} />
                        {product.location}
                      </span>
                    )}
                  </div>

                  <h3>{product.itemName}</h3>

                  <p className="product-description">
                    {product.description || "No description available."}
                  </p>

                  <div className="product-stock-row">
                    <span className="stock-indicator">
                      Available:{" "}
                      <strong>
                        {product.quantity !== undefined &&
                        product.quantity !== null
                          ? product.quantity
                          : 1}{" "}
                        units
                      </strong>
                    </span>
                  </div>

                  <div className="product-bottom">
                    <div className="product-price">
                      <strong>₹{product.rentalPrice}</strong>
                      <span>/ hour</span>
                    </div>

                    <Link
                      to={`/products/${product.itemId}`}
                      className="view-button"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="products-message">
            <h3>No products found</h3>
            <p>
              {selectedCity !== "All"
                ? `No available items currently found in ${selectedCity}. Try selecting "All Cities" or another location.`
                : "Try searching for another product or selecting a different category."}
            </p>
            {selectedCity !== "All" && (
              <button
                type="button"
                className="category-button active"
                style={{ marginTop: "12px", display: "inline-block" }}
                onClick={() => setSelectedCity("All")}
              >
                Browse All Cities
              </button>
            )}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}

export default ProductsPage;