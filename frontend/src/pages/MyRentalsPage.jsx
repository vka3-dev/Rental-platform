import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { getBookingsByRenter, createReturn, createReview, getProductById, getReviewsByReviewer } from "../services/api";
import { supabase } from "../lib/supabase";
import InnovativeToast from "../components/InnovativeNotification";
import {
	IconStar,
	IconCheck,
	IconX,
	IconCalendar,
	IconClock,
	IconMapPin,
	IconPackage,
} from "../components/Icons";
import "./WorkflowPage.css";

function MyRentalsPage() {
	const navigate = useNavigate();
	const [bookings, setBookings] = useState([]);
	const [toast, setToast] = useState(null);
	const [returnModalBooking, setReturnModalBooking] = useState(null);
	const [reviewModalBooking, setReviewModalBooking] = useState(null);
	const [returnCondition, setReturnCondition] = useState("Good Condition");
	const [returnRemarks, setReturnRemarks] = useState("");
	const [reviewRating, setReviewRating] = useState(5);
	const [reviewComment, setReviewComment] = useState("");
	const [reviewTags, setReviewTags] = useState([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState("Loading your requests...");
	const [myReviews, setMyReviews] = useState([]);

	// Optimistically mutate a single booking's fields in local state
	const optimisticUpdate = (bookingId, patch) => {
		setBookings((prev) =>
			prev.map((b) => (b.bookingId === bookingId ? { ...b, ...patch } : b))
		);
	};

	const loadBookings = async () => {
		const { data } = await supabase.auth.getSession();
		const renterId = data.session?.user?.id;
		if (!renterId) {
			setMessage("Please log in to see your rental requests.");
			return;
		}
		try {
			const fetched = await getBookingsByRenter(renterId);
			getReviewsByReviewer(renterId)
				.then(setMyReviews)
				.catch(() => setMyReviews([]));

			if (!fetched || fetched.length === 0) {
				setBookings([]);
				setMessage("No rental requests found.");
				return;
			}

			const bookingsWithItems = await Promise.all(
				fetched.map(async (booking) => {
					try {
						const item = await getProductById(booking.itemId);
						return { ...booking, item };
					} catch {
						return booking;
					}
				})
			);

			setBookings(bookingsWithItems);
			setMessage("");
		} catch (error) {
			console.error("Failed to load rentals:", error);
			setMessage("Unable to load your rental requests.");
		}
	};

	const handleReturn = async () => {
		if (!returnModalBooking) return;
		try {
			setIsSubmitting(true);
			const fullRemarks = `[Condition: ${returnCondition}] ${returnRemarks || "Returned in good shape"}`;
			await createReturn({
				bookingId: returnModalBooking.bookingId,
				remarks: fullRemarks,
				condition: "Good",
				status: "RETURNED",
			});
			// Optimistic: update status immediately so UI reflects change at once
			optimisticUpdate(returnModalBooking.bookingId, { status: "RETURNED" });
			setReturnModalBooking(null);
			setReturnRemarks("");
			setToast({
				type: "success",
				title: "Return Submitted!",
				message: "Your return has been recorded. The lender has been notified to verify receipt.",
			});
			// Background sync — no await, UI already updated
			loadBookings();
		} catch (error) {
			console.error("Error returning item:", error);
			setToast({
				type: "error",
				title: "Return Failed",
				message: "Unable to submit return. Please try again.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleReview = async () => {
		if (!reviewModalBooking) return;
		try {
			setIsSubmitting(true);
			const { data } = await supabase.auth.getSession();
			const reviewerId = data.session?.user?.id;
			const fullComment = reviewTags.length > 0
				? `[${reviewTags.join(", ")}] ${reviewComment}`
				: reviewComment;

			const savedReview = await createReview({
				bookingId: reviewModalBooking.bookingId,
				reviewerId,
				revieweeId: reviewModalBooking.lenderId,
				rating: Number(reviewRating),
				comment: fullComment,
			});
			// Optimistic: record this booking as reviewed so the button hides immediately
			setMyReviews((prev) => [
				...prev.filter((r) => r.bookingId !== reviewModalBooking.bookingId),
				savedReview || { bookingId: reviewModalBooking.bookingId, rating: reviewRating, comment: fullComment },
			]);
			setReviewModalBooking(null);
			setReviewRating(5);
			setReviewComment("");
			setReviewTags([]);
			setToast({
				type: "success",
				title: "Review Published!",
				message: "Thank you! Your feedback helps other borrowers in the community.",
			});
			// Background sync — no await, UI already updated
			loadBookings();
		} catch (error) {
			console.error("Error submitting review:", error);
			setToast({
				type: "error",
				title: "Review Failed",
				message: "Unable to submit review. Please try again.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const toggleReviewTag = (tag) => {
		setReviewTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
		);
	};

	useEffect(() => {
		loadBookings();
	}, []);

	return (
		<div className="workflow-page">
			<Navbar />
			<main className="workflow-content">
				<div className="workflow-heading">
					<div>
						<p className="workflow-kicker">Borrower Dashboard</p>
						<h1>My Rental Requests</h1>
						<p>Track request approvals, return items, and review your lenders effortlessly.</p>
					</div>
					<Link to="/products" className="workflow-button secondary">
						Browse Items
					</Link>
				</div>

				{message && <p className="workflow-message">{message}</p>}

				<div className="workflow-list">
					{bookings.map((booking) => (
						<article className="workflow-card" key={booking.bookingId}>
							{/* Top Bar */}
							<div className="card-header-row">
								<div className="card-header-left">
									<span className="workflow-label">Booking #{booking.bookingId}</span>
									{booking.createdAt && (
										<span className="booking-timestamp">
											Placed on {new Date(booking.createdAt).toLocaleDateString()}
										</span>
									)}
								</div>
								<strong className={`status status-${booking.status.toLowerCase()}`}>
									{booking.status}
								</strong>
							</div>

							{booking.status === "REJECTED" && booking.rejectionReason && (
								<p className="booking-rejection-reason">{booking.rejectionReason}</p>
							)}

							{/* Main Content */}
							<div className="card-main-content">
								<div className="item-title-row">
									<h2 className="item-title">
										{booking.item?.itemName || `Item #${booking.itemId}`}
									</h2>
								</div>

								<div className="item-meta-bar">
									<span className="meta-item">
										<IconMapPin size={14} />
										{booking.item?.location || "Location not specified"}
									</span>
									<span className="meta-item meta-price">
										Rent: ₹{booking.price ?? booking.item?.rentalPrice ?? "-"}
									</span>
									{(booking.securityDeposit != null || booking.item?.securityDeposit != null) && (
										<span className="meta-item">
											Deposit: ₹{booking.securityDeposit ?? booking.item?.securityDeposit}
										</span>
									)}
								</div>

								{/* Schedule Grid */}
								<div className="schedule-grid">
									<div className="schedule-block">
										<span className="schedule-label">
											<IconCalendar size={12} />
											Rental Start
										</span>
										<span className="schedule-value">
											{new Date(booking.startTime).toLocaleString([], {
												dateStyle: "medium",
												timeStyle: "short",
											})}
										</span>
									</div>
									<div className="schedule-block">
										<span className="schedule-label">
											<IconClock size={12} />
											Rental End
										</span>
										<span className="schedule-value">
											{new Date(booking.endTime).toLocaleString([], {
												dateStyle: "medium",
												timeStyle: "short",
											})}
										</span>
									</div>
								</div>
							</div>

							{/* Card Actions Bar */}
							<div className="card-actions-bar">
								{/* Review Lender is only allowed once the rental is returned or completed */}
								{["RETURNED", "COMPLETED"].includes(booking.status) && (
									myReviews.some((r) => r.bookingId === booking.bookingId) ? (
										<span className="workflow-button star-btn disabled" title="You already reviewed this lender">
											<IconCheck size={14} />
											Reviewed
										</span>
									) : (
										<button
											className="workflow-button star-btn"
											onClick={() => setReviewModalBooking(booking)}
											title="Leave a review for this lender"
										>
											<IconStar size={14} />
											Review Lender
										</button>
									)
								)}

								{booking.status === "APPROVED" && (
									<button
										className="workflow-button success"
										onClick={() =>
											navigate("/payment", {
												state: {
													bookingId: booking.bookingId,
													productId: booking.itemId,
													productName: booking.item?.itemName || `Item #${booking.itemId}`,
													rentAmount: booking.price,
													rentalHours: 1,
													lenderName: "Your Lender",
													deliveryMethod: booking.deliveryMethod,
													deliveryPartner: booking.deliveryPartner,
												},
											})
										}
									>
										<IconCheck size={14} />
										Pay Now (₹{booking.price})
									</button>
								)}

								{["CONFIRMED", "BOOKED"].includes(booking.status) && (
									<button
										className="workflow-button"
										onClick={() => setReturnModalBooking(booking)}
									>
										<IconPackage size={14} />
										Return Item
									</button>
								)}

								{booking.status === "RETURNED" && (
									<span className="status status-returned">
										Return Submitted — Awaiting Lender Receipt
									</span>
								)}

								{booking.status === "COMPLETED" && (
									<span className="status status-completed">
										<IconCheck size={12} />
										Rental Completed
									</span>
								)}
							</div>
						</article>
					))}
				</div>

				{/* Innovative Return Modal */}
				{returnModalBooking && (
					<div
						className="modal-overlay"
						onClick={(e) => {
							if (e.target === e.currentTarget && !isSubmitting) setReturnModalBooking(null);
						}}
					>
						<div className="modal-card innovative">
							<button
								className="modal-close-btn"
								onClick={() => setReturnModalBooking(null)}
								disabled={isSubmitting}
								title="Close dialog"
							>
								<IconX size={16} />
							</button>

							<div className="modal-header-with-badge">
								<div className="modal-icon-badge primary">
									<IconPackage size={22} />
								</div>
								<div className="modal-header-text">
									<h2>Initiate Item Return</h2>
									<p>Booking #{returnModalBooking.bookingId} • Return Confirmation</p>
								</div>
							</div>

							<div className="modal-summary-box">
								<div className="modal-summary-row">
									<span className="modal-summary-label">Returning Item</span>
									<span className="modal-summary-value">
										{returnModalBooking.item?.itemName || `Item #${returnModalBooking.itemId}`}
									</span>
								</div>
								<div className="modal-summary-row">
									<span className="modal-summary-label">Rental Duration</span>
									<span className="modal-summary-value">
										{new Date(returnModalBooking.startTime).toLocaleDateString([], { month: "short", day: "numeric" })} — {new Date(returnModalBooking.endTime).toLocaleDateString([], { month: "short", day: "numeric" })}
									</span>
								</div>
							</div>

							<div className="form-group">
								<label>Item Condition at Return</label>
								<div className="quick-chips-row">
									{["Like New / Pristine", "Good Condition", "Normal Wear & Tear"].map((cond) => (
										<button
											key={cond}
											type="button"
											className={`quick-chip-btn ${returnCondition === cond ? "active" : ""}`}
											onClick={() => setReturnCondition(cond)}
										>
											{cond}
										</button>
									))}
								</div>
							</div>

							<div className="form-group">
								<label>Handover & Return Remarks</label>
								<textarea
									value={returnRemarks}
									onChange={(e) => setReturnRemarks(e.target.value)}
									placeholder="e.g. Handed over directly to lender in original bag with all accessories..."
									rows={3}
								/>
							</div>

							<div className="modal-actions">
								<button
									type="button"
									className="workflow-button secondary"
									onClick={() => setReturnModalBooking(null)}
									disabled={isSubmitting}
								>
									Cancel
								</button>
								<button
									type="button"
									className="workflow-button success"
									onClick={handleReturn}
									disabled={isSubmitting}
								>
									<IconCheck size={14} />
									{isSubmitting ? "Submitting..." : "Confirm Return"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Innovative Review Modal */}
				{reviewModalBooking && (
					<div
						className="modal-overlay"
						onClick={(e) => {
							if (e.target === e.currentTarget && !isSubmitting) setReviewModalBooking(null);
						}}
					>
						<div className="modal-card innovative">
							<button
								className="modal-close-btn"
								onClick={() => setReviewModalBooking(null)}
								disabled={isSubmitting}
								title="Close dialog"
							>
								<IconX size={16} />
							</button>

							<div className="modal-header-with-badge">
								<div className="modal-icon-badge warning">
									<IconStar size={22} filled={true} />
								</div>
								<div className="modal-header-text">
									<h2>Review Lender & Experience</h2>
									<p>Booking #{reviewModalBooking.bookingId} • Feedback</p>
								</div>
							</div>

							<div className="form-group">
								<label>Your Rating</label>
								<div className="star-rating-select">
									{[1, 2, 3, 4, 5].map((star) => (
										<button
											key={star}
											type="button"
											className={`star-btn-pick ${star <= reviewRating ? "active" : ""}`}
											onClick={() => setReviewRating(star)}
											title={`${star} star${star > 1 ? "s" : ""}`}
										>
											<IconStar size={28} filled={star <= reviewRating} />
										</button>
									))}
									<span className="star-score-text">
										{reviewRating === 5 && "5 / 5 — Outstanding Lender! 🌟"}
										{reviewRating === 4 && "4 / 5 — Great Experience 👍"}
										{reviewRating === 3 && "3 / 5 — Satisfactory"}
										{reviewRating === 2 && "2 / 5 — Below Expectations"}
										{reviewRating === 1 && "1 / 5 — Disappointing"}
									</span>
								</div>
							</div>

							<div className="form-group">
								<label>Highlights (Click to select)</label>
								<div className="quick-chips-row">
									{[
										"Item in Pristine Condition",
										"Punctual Handover",
										"Helpful & Responsive",
										"Accurate Description",
										"Smooth Experience",
									].map((tag) => (
										<button
											key={tag}
											type="button"
											className={`quick-chip-btn ${reviewTags.includes(tag) ? "active" : ""}`}
											onClick={() => toggleReviewTag(tag)}
										>
											{tag}
										</button>
									))}
								</div>
							</div>

							<div className="form-group">
								<label>Feedback & Comments</label>
								<textarea
									value={reviewComment}
									onChange={(e) => setReviewComment(e.target.value)}
									placeholder="Tell the community how the handover and equipment quality were..."
									rows={3}
								/>
							</div>

							<div className="modal-actions">
								<button
									type="button"
									className="workflow-button secondary"
									onClick={() => setReviewModalBooking(null)}
									disabled={isSubmitting}
								>
									Cancel
								</button>
								<button
									type="button"
									className="workflow-button"
									onClick={handleReview}
									disabled={isSubmitting}
								>
									{isSubmitting ? "Submitting..." : "Submit Review"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Innovative Toast Notification */}
				<InnovativeToast
					notification={toast}
					onClose={() => setToast(null)}
				/>
			</main>
		</div>
	);
}

export default MyRentalsPage;
