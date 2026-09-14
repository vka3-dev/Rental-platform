import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { createProduct, addItemImage, getUserById } from "../services/api";
import { supabase } from "../lib/supabase";
import "./WorkflowPage.css";

function AddProductPage() {
	const navigate = useNavigate();

	const [form, setForm] = useState({
		itemName: "",
		description: "",
		catID: 1,
		location: "Chennai",
		condition: "Good",
		rentalPrice: "",
		securityDeposit: "",
		quantity: 1,
	});

	const [error, setError] = useState("");
	const [imageFile, setImageFile] = useState(null);
	const [imagePreview, setImagePreview] = useState("");

	useEffect(() => {
		async function loadOwnerLocation() {
			try {
				const { data } = await supabase.auth.getSession();
				const user = data.session?.user;
				if (!user) return;

				let ownerCity = user.user_metadata?.location;

				if (!ownerCity) {
					ownerCity = localStorage.getItem("user_city");
				}

				if (!ownerCity && user.id) {
					try {
						const profile = await getUserById(user.id);
						if (profile?.location) {
							ownerCity = profile.location;
						}
					} catch {
					}
				}

				if (ownerCity && ownerCity.trim()) {
					setForm((prev) => ({
						...prev,
						location: ownerCity.trim(),
					}));
				}
			} catch (err) {
				console.error("Failed to default owner location:", err);
			}
		}

		loadOwnerLocation();
	}, []);

	function updateField(event) {
		setForm({
			...form,
			[event.target.name]: event.target.value,
		});
	}

	function handleImageChange(event) {
		const file = event.target.files[0];

		if (!file) {
			setImageFile(null);
			setImagePreview("");
			return;
		}

		if (!file.type.startsWith("image/")) {
			setError("Please select a valid image.");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			setError("Image must be less than 5 MB.");
			return;
		}

		setError("");
		setImageFile(file);
		setImagePreview(URL.createObjectURL(file));
	}

	async function handleSubmit(event) {
		event.preventDefault();
		setError("");

		try {
			const { data } = await supabase.auth.getSession();

			const ownerId = data.session?.user?.id;

			if (!ownerId) {
				throw new Error(
					"Please log in before listing an item."
				);
			}

			const createdItem = await createProduct({
				...form,
				ownerId,
				availability: true,
				catID: Number(form.catID),
				quantity: Number(form.quantity || 1),
				rentalPrice: Number(form.rentalPrice),
				securityDeposit: Number(
					form.securityDeposit || 0
				),
			});

			if (imageFile) {
				const fileExtension =
					imageFile.name.split(".").pop();

				const fileName =
					`${crypto.randomUUID()}.${fileExtension}`;

				const filePath =
					`${ownerId}/${fileName}`;

				const { error: uploadError } =
					await supabase.storage
						.from("item-images")
						.upload(filePath, imageFile);

				if (uploadError) {
					throw uploadError;
				}

				const { data: publicUrlData } =
					supabase.storage
						.from("item-images")
						.getPublicUrl(filePath);

				const imageUrl =
					publicUrlData.publicUrl;

				await addItemImage(
					createdItem.itemId,
					imageUrl,
					true
				);
			}

			navigate("/my-listings");
		} catch (submitError) {
			setError(
				submitError.response?.data?.message ||
				submitError.message ||
				"Failed to create listing."
			);
		}
	}

	return (
		<div className="workflow-page">
			<Navbar />

			<main className="workflow-content">
				<div className="workflow-heading">
					<div>
						<p className="workflow-kicker">
							Lender view
						</p>

						<h1>List an item</h1>

						<p>
							Share something useful with people nearby.
						</p>
					</div>

					<Link
						to="/my-listings"
						className="workflow-button secondary"
					>
						Cancel
					</Link>
				</div>

				<form
					className="workflow-card listing-form"
					onSubmit={handleSubmit}
				>
					<label>
						Item name

						<input
							name="itemName"
							value={form.itemName}
							onChange={updateField}
							required
						/>
					</label>

					<label>
						Description

						<textarea
							name="description"
							value={form.description}
							onChange={updateField}
							required
						/>
					</label>

					<label>
						Category

						<select
							name="catID"
							value={form.catID}
							onChange={updateField}
						>
							<option value="1">
								Electronics
							</option>

							<option value="2">
								Tools & Equipment
							</option>

							<option value="3">
								Furniture & Home
							</option>

							<option value="4">
								Outdoor & Events
							</option>
						</select>
					</label>

					<label>
						Location / City

						<select
							name="location"
							value={form.location}
							onChange={updateField}
							required
						>
							{form.location && !["Chennai", "Madurai", "Pondicherry", "Coimbatore", "Trichy", "Salem"].includes(form.location) && (
								<option value={form.location}>{form.location}</option>
							)}
							<option value="Chennai">Chennai</option>
							<option value="Madurai">Madurai</option>
							<option value="Pondicherry">Pondicherry</option>
							<option value="Coimbatore">Coimbatore</option>
							<option value="Trichy">Trichy</option>
							<option value="Salem">Salem</option>
						</select>
					</label>

					<label>
						Quantity Available

						<input
							name="quantity"
							type="number"
							min="1"
							value={form.quantity}
							onChange={updateField}
							required
						/>
					</label>

					<label>
						Condition

						<input
							name="condition"
							value={form.condition}
							onChange={updateField}
							required
						/>
					</label>

					<label>
						Rent per hour

						<input
							name="rentalPrice"
							type="number"
							min="0"
							value={form.rentalPrice}
							onChange={updateField}
							required
						/>
					</label>

					<label>
						Security deposit

						<input
							name="securityDeposit"
							type="number"
							min="0"
							value={form.securityDeposit}
							onChange={updateField}
						/>
					</label>

					<label>
						Item image

						<input
							type="file"
							accept="image/*"
							onChange={handleImageChange}
							required
						/>
					</label>

					{imagePreview && (
						<div className="image-preview">
							<p>Image preview</p>

							<img
								src={imagePreview}
								alt="Selected item"
							/>
						</div>
					)}

					{error && (
						<p className="workflow-message">
							{error}
						</p>
					)}

					<button
						className="workflow-button"
						type="submit"
					>
						Publish listing
					</button>
				</form>
			</main>
		</div>
	);
}

export default AddProductPage;