import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import {
	updateBookingStatus,
	createDamageReport,
	createReview,
	completeReturn,
} from "../services/api";
import {
	fetchRentalRequestsWithDetails,
	getCachedRequests,
	invalidateRequestsCache,
} from "../services/rentalRequestsService";
import { supabase } from "../lib/supabase";
import InnovativeToast from "../components/InnovativeNotification";
import {
	IconStar,
	IconCheck,
	IconX,
	IconRepeat,
	IconUser,
	IconCalendar,
	IconClock,
	IconMapPin,
	IconAlertTriangle,
	IconPackage,
	IconChevronDown,
	IconChevronUp,
} from "../components/Icons";
import "./WorkflowPage.css";

function RentalRequestsPage() {
	// Initialize with cached requests if preloaded for instant 0ms render
	const [requests, setRequests] = useState(() => {
		const cached = getCachedRequests();
		return cached || [];
	});
	const [message, setMessage] = useState(() => {
		const cached = getCachedRequests();
		return cached ? "" : "Loading booking requests...";
	});
	const [actionError, setActionError] = useState("");
	const [expandedReviews, setExpandedReviews] = useState({});
	const [toast, setToast] = useState(null);

	// Innovative Modal States
	const [confirmAcceptBooking, setConfirmAcceptBooking] = useState(null);
	const [confirmRejectBooking, setConfirmRejectBooking] = useState(null);
	const [confirmReturnBooking, setConfirmReturnBooking] = useState(null);
	const [returnRelistOption, setReturnRelistOption] = useState(true);

	const [damageModalBooking, setDamageModalBooking] = useState(null);
	const [damageSeverity, setDamageSeverity] = useState("Moderate");
	const [damageDesc, setDamageDesc] = useState("");
	const [damageCost, setDamageCost] = useState("");

	const [reviewModalBooking, setReviewModalBooking] = useState(null);
	const [reviewRating, setReviewRating] = useState(5);
	const [reviewComment, setReviewComment] = useState("");
	const [reviewTags, setReviewTags] = useState([]);

	const [confirmingBookingId, setConfirmingBookingId] = useState(null);
	const [isProcessingAction, setIsProcessingAction] = useState(false);

	async function loadRequests(forceRefresh = false) {
		const { data } = await supabase.auth.getSession();
		const lenderId = data.session?.user?.id;

		if (!lenderId) {
			setMessage("Please log in to view requests for your items.");
			return;
		}

		// Instant display if cached
		const cached = getCachedRequests(lenderId);
		if (cached && !forceRefresh) {
			setRequests(cached);
			setMessage("");
		}

		try {
			const requestsWithDetails = await fetchRentalRequestsWithDetails(lenderId, { forceRefresh });
			setRequests(requestsWithDetails);
			setMessage("");
		} catch (error) {
			if (!cached) {
				setMessage(error.response?.data?.message || "Unable to load booking requests.");
			}
		}
	}

	useEffect(() => {
		loadRequests();
	}, []);

	async function reviewRequest(bookingId, status) {
		try {
			setIsProcessingAction(true);
			setActionError("");
			await updateBookingStatus(bookingId, status);
			invalidateRequestsCache();

			// Optimistic: update status immediately in UI
			if (status === "APPROVED") {
				// Also mark other REQUESTED bookings for same item as REJECTED optimistically
				const approvedReq = requests.find((r) => r.bookingId === bookingId);
				setRequests((prev) =>
					prev.map((r) => {
						if (r.bookingId === bookingId) return { ...r, status: "APPROVED" };
						if (r.itemId === approvedReq?.itemId && r.status === "REQUESTED") return { ...r, status: "REJECTED" };
						return r;
					})
				);
				setToast({
					type: "success",
					title: "Borrow Request Accepted!",
					message: "Borrower has been confirmed. Any competing requests for this item were automatically declined.",
				});
			} else if (status === "REJECTED") {
				optimisticUpdate(bookingId, { status: "REJECTED" });
				setToast({
					type: "info",
					title: "Request Declined",
					message: "The borrow request was declined.",
				});
			}
			setConfirmAcceptBooking(null);
			setConfirmRejectBooking(null);
			// Background sync — don't await, UI already updated
			loadRequests(true);
		} catch (error) {
			setActionError(error.response?.data?.message || "Unable to update this request.");
			setToast({
				type: "error",
				title: "Action Failed",
				message: error.response?.data?.message || "Unable to update this request.",
			});
		} finally {
			setIsProcessingAction(false);
		}
	}

	async function handleConfirmReturn(bookingId, relist) {
		try {
			setActionError("");
			setConfirmingBookingId(bookingId);
			setIsProcessingAction(true);
			await completeReturn(bookingId, relist);
			invalidateRequestsCache();

			// Optimistic: mark as COMPLETED immediately
			optimisticUpdate(bookingId, { status: "COMPLETED" });
			setConfirmReturnBooking(null);
			setToast({
				type: "success",
				title: "Return Verified!",
				message: relist
					? "Item has been marked as returned and relisted into your active catalog."
					: "Item has been marked as returned and kept unlisted for inspection.",
			});
			// Background sync
			loadRequests(true);
		} catch (error) {
			console.error("Failed to complete return:", error);
			setActionError(error.response?.data?.message || "Failed to confirm return.");
			setToast({
				type: "error",
				title: "Return Confirmation Failed",
				message: error.response?.data?.message || "Failed to confirm return.",
			});
		} finally {
			setConfirmingBookingId(null);
			setIsProcessingAction(false);
		}
	}

	const handleDamageReport = async () => {
		if (!damageModalBooking) return;
		try {
			setIsProcessingAction(true);
			const fullDesc = `[Severity: ${damageSeverity}] ${damageDesc}`;
			await createDamageReport({
				bookingId: damageModalBooking.bookingId,
				damageDescription: fullDesc,
				damageCost: Number(damageCost) || 0,
				status: "REPORTED",
			});
			setDamageModalBooking(null);
			setDamageDesc("");
			setDamageCost("");
			invalidateRequestsCache();
			setToast({
				type: "warning",
				title: "Damage Incident Logged",
				message: "Your damage report and estimated cost have been registered for platform review.",
			});
			await loadRequests(true);
		} catch (error) {
			console.error(error);
			setToast({
				type: "error",
				title: "Submission Failed",
				message: "Unable to submit damage report. Please try again.",
			});
		} finally {
			setIsProcessingAction(false);
		}
	};

	const handleReview = async () => {
		if (!reviewModalBooking) return;
		try {
			setIsProcessingAction(true);
			const { data } = await supabase.auth.getSession();
			const combinedComment = reviewTags.length > 0
				? `[${reviewTags.join(", ")}] ${reviewComment}`
				: reviewComment;

			const newReview = await createReview({
				bookingId: reviewModalBooking.bookingId,
				reviewerId: data.session?.user?.id,
				revieweeId: reviewModalBooking.renterId,
				rating: reviewRating,
				comment: combinedComment,
			});

			// Optimistic: inject the new review into local state immediately
			const optimisticReview = newReview || {
				reviewId: Date.now(),
				bookingId: reviewModalBooking.bookingId,
				rating: reviewRating,
				comment: combinedComment,
				createdAt: new Date().toISOString(),
			};
			const targetRenterId = reviewModalBooking.renterId;
			setRequests((prev) =>
				prev.map((r) => {
					if (r.renterId !== targetRenterId) return r;
					const existingReviews = r.reviews || [];
					const alreadyExists = existingReviews.some(
						(rv) => rv.bookingId === reviewModalBooking.bookingId
					);
					return {
						...r,
						reviews: alreadyExists
							? existingReviews.map((rv) =>
									rv.bookingId === reviewModalBooking.bookingId ? optimisticReview : rv
							  )
							: [...existingReviews, optimisticReview],
					};
				})
			);

			setReviewModalBooking(null);
			setReviewRating(5);
			setReviewComment("");
			setReviewTags([]);
			invalidateRequestsCache();
			setToast({
				type: "success",
				title: "Review Published!",
				message: "Thank you! Your feedback helps build trust in the ShareSpare community.",
			});
			// Background sync
			loadRequests(true);
		} catch (error) {
			console.error(error);
			setToast({
				type: "error",
				title: "Review Error",
				message: "Could not submit review. Please try again.",
			});
		} finally {
			setIsProcessingAction(false);
		}
	};

	const toggleReviewTag = (tag) => {
		setReviewTags((prev) =>
			prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
		);
	};

	function toggleReviews(bookingId) {
		setExpandedReviews((prev) => ({
			...prev,
			[bookingId]: !prev[bookingId],
		}));
	}

	// Optimistically mutate a single request's fields in local state
	function optimisticUpdate(bookingId, patch) {
		setRequests((prev) =>
			prev.map((r) => (r.bookingId === bookingId ? { ...r, ...patch } : r))
		);
	}

	function getBorrowerRatingDisplay(borrower, reviews) {
		if (reviews && reviews.length > 0) {
			const total = reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0);
			const avg = (total / reviews.length).toFixed(1);
			return {
				avg,
				count: reviews.length,
				label: `${avg} / 5.0 (${reviews.length} ${reviews.length === 1 ? "review" : "reviews"})`,
				badgeClass: avg >= 4 ? "rating-high" : avg >= 3 ? "rating-med" : "rating-low",
				recommendation:
					avg >= 4
						? "Highly rated borrower with verified history"
						: avg >= 3
						? "Moderate rating — check past reviews"
						: "Low rating — review details carefully",
			};
		}

		if (borrower?.rating && Number(borrower.rating) > 0) {
			const score = Number(borrower.rating).toFixed(1);
			return {
				avg: score,
				count: 1,
				label: `${score} / 5.0`,
				badgeClass: score >= 4 ? "rating-high" : "rating-med",
				recommendation: score >= 4 ? "Trusted borrower" : "Check borrower profile",
			};
		}

		return {
			avg: null,
			count: 0,
			label: "New Borrower",
			badgeClass: "rating-new",
			recommendation: "First-time borrower on ShareSpare platform",
		};
	}

	return (
		<div className="workflow-page">
			<Navbar />
			<main className="workflow-content">
				<div className="workflow-heading">
					<div>
						<p className="workflow-kicker">Lender Dashboard</p>
						<h1>Rental Requests</h1>
						<p>Review borrower reliability and manage your rental lifecycle with zero friction.</p>
					</div>
					<Link to="/my-listings" className="workflow-button secondary">
						My Listings
					</Link>
				</div>

				{message && <p className="workflow-message">{message}</p>}
				{actionError && <p className="workflow-message workflow-error">{actionError}</p>}
				{!message && requests.length === 0 && (
					<p className="workflow-message">No rental requests found for your listings.</p>
				)}

				<div className="workflow-list">
					{requests.map((request) => {
						const ratingInfo = getBorrowerRatingDisplay(request.borrower, request.reviews);
						const isReviewsOpen = expandedReviews[request.bookingId];
						const alreadyReviewedBooking = (request.reviews || []).some(
							(rv) => rv.bookingId === request.bookingId
						);
						const borrowerInitial = request.borrower?.name
							? request.borrower.name.trim()[0].toUpperCase()
							: "U";

						return (
							<article className="workflow-card" key={request.bookingId}>
								{/* Card Top Header */}
								<div className="card-header-row">
									<div className="card-header-left">
										<span className="workflow-label">Booking #{request.bookingId}</span>
										{request.createdAt && (
											<span className="booking-timestamp">
												Requested on {new Date(request.createdAt).toLocaleDateString()}
											</span>
										)}
									</div>
									<strong className={`status status-${request.status.toLowerCase()}`}>
										{request.status}
									</strong>
								</div>

								{/* Card Body */}
								<div className="card-main-content">
									<div className="item-title-row">
										<h2 className="item-title">
											{request.item?.itemName || `Item #${request.itemId}`}
										</h2>
									</div>

									<div className="item-meta-bar">
										<span className="meta-item">
											<IconMapPin size={14} />
											{request.item?.location || "Location not specified"}
										</span>
										<span className="meta-item meta-price">
											₹{request.price || request.item?.rentalPrice || "-"} / hr
										</span>
										{request.item?.securityDeposit != null && (
											<span className="meta-item">
												Deposit: ₹{request.item.securityDeposit}
											</span>
										)}
									</div>

									{/* Borrower Profile Section */}
									<div className="borrower-section">
										<div className="borrower-header">
											<div className="borrower-identity">
												<div className="borrower-avatar">{borrowerInitial}</div>
												<div className="borrower-meta">
													<div className="name-row">
														<h3 className="borrower-name">
															{request.borrower?.name || "Verified Community Member"}
														</h3>
													</div>
													{request.borrower?.location && (
														<span className="borrower-location">
															<IconMapPin size={12} />
															{request.borrower.location}
														</span>
													)}
												</div>
											</div>

											<div className={`rating-pill ${ratingInfo.badgeClass}`}>
												<IconStar size={13} filled={ratingInfo.avg !== null} />
												{ratingInfo.label}
											</div>
										</div>

										{/* Customer Rental History Badges */}
										<div className="trust-badges-row">
											{request.customerHistory?.timesWithLender > 0 ? (
												<span className="repeat-renter-pill">
													<IconRepeat size={13} />
													Repeat Customer: {request.customerHistory.timesWithLender} previous{" "}
													{request.customerHistory.timesWithLender === 1 ? "rental" : "rentals"} from you
												</span>
											) : (
												<span className="first-time-pill">
													<IconUser size={13} />
													First-time borrowing from you
												</span>
											)}

											{request.customerHistory?.totalRentals > 0 && (
												<span className="platform-history-pill">
													• {request.customerHistory.totalRentals} platform{" "}
													{request.customerHistory.totalRentals === 1 ? "rental" : "rentals"} total
												</span>
											)}
										</div>

										<div className="recommendation-note">
											<span>{ratingInfo.recommendation}</span>
										</div>

										{/* Reviews Expand / Collapse */}
										{request.reviews && request.reviews.length > 0 && (
											<div className="reviews-toggle-section">
												<button
													type="button"
													className="toggle-reviews-btn"
													onClick={() => toggleReviews(request.bookingId)}
												>
													{isReviewsOpen ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
													{isReviewsOpen
														? "Hide borrower reviews"
														: `View ${request.reviews.length} previous review${
																request.reviews.length > 1 ? "s" : ""
														  }`}
												</button>

												{isReviewsOpen && (
													<div className="reviews-list">
														{request.reviews.map((rev) => (
															<div className="review-card" key={rev.reviewId}>
																<div className="review-card-top">
																	<span className="review-card-stars">
																		<IconStar size={12} filled={true} />
																		{Number(rev.rating).toFixed(1)} / 5.0
																	</span>
																	<small className="review-card-date">
																		{rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : ""}
																	</small>
																</div>
																{rev.comment && (
																	<p className="review-card-comment">"{rev.comment}"</p>
																)}
															</div>
														))}
													</div>
												)}
											</div>
										)}
									</div>

									{/* Schedule & Duration Grid */}
									<div className="schedule-grid">
										<div className="schedule-block">
											<span className="schedule-label">
												<IconCalendar size={12} />
												Start Time
											</span>
											<span className="schedule-value">
												{new Date(request.startTime).toLocaleString([], {
													dateStyle: "medium",
													timeStyle: "short",
												})}
											</span>
										</div>
										<div className="schedule-block">
											<span className="schedule-label">
												<IconClock size={12} />
												End Time
											</span>
											<span className="schedule-value">
												{new Date(request.endTime).toLocaleString([], {
													dateStyle: "medium",
													timeStyle: "short",
												})}
											</span>
										</div>
									</div>

									{/* Direct 1-Click Return Resolution Section */}
									{request.status === "RETURNED" && (
										<div className="return-streamlined-panel">
											<div className="return-panel-header">
												<h4 className="return-panel-title">
													<IconPackage size={17} />
													Return Verification
												</h4>
												<span className="return-panel-badge">Action Required</span>
											</div>
											<p className="return-panel-desc">
												The borrower has returned this item. Inspect the product and complete the return in one click:
											</p>
											<div className="return-actions-row">
												<button
													className="workflow-button success"
													disabled={confirmingBookingId === request.bookingId}
													onClick={() => {
														setConfirmReturnBooking(request);
														setReturnRelistOption(true);
													}}
													title="Verify item return and choose relisting option"
												>
													<IconCheck size={14} />
													Verify Return & Relist
												</button>
												<button
													className="workflow-button danger"
													onClick={() => setDamageModalBooking(request)}
												>
													<IconAlertTriangle size={14} />
													Report Issue / Damage
												</button>
												{alreadyReviewedBooking ? (
													<span className="workflow-button star-btn disabled" title="You already reviewed this borrower">
														<IconCheck size={14} />
														Reviewed
													</span>
												) : (
													<button
														className="workflow-button star-btn"
														onClick={() => setReviewModalBooking(request)}
													>
														<IconStar size={14} />
														Review Borrower
													</button>
												)}
											</div>
										</div>
									)}

									{/* Completed State Banner */}
									{request.status === "COMPLETED" && (
										<div className="completed-alert-banner">
											<span className="completed-badge-text">
												<IconCheck size={16} />
												Return Verified & Rental Completed
											</span>
											<div style={{ display: "flex", gap: "8px" }}>
												{alreadyReviewedBooking ? (
													<span className="workflow-button star-btn sm disabled" title="You already reviewed this borrower">
														<IconCheck size={13} />
														Reviewed
													</span>
												) : (
													<button
														className="workflow-button star-btn sm"
														onClick={() => setReviewModalBooking(request)}
													>
														<IconStar size={13} />
														Review Borrower
													</button>
												)}
												<button
													className="workflow-button danger sm"
													onClick={() => setDamageModalBooking(request)}
												>
													<IconAlertTriangle size={13} />
													Report Damage
												</button>
											</div>
										</div>
									)}
								</div>

								{/* Card Bottom Actions (For REQUESTED status) */}
								{request.status === "REQUESTED" && (
									<div className="card-actions-bar">
										<button
											className="workflow-button success"
											onClick={() => setConfirmAcceptBooking(request)}
										>
											<IconCheck size={14} />
											Approve Request
										</button>
										<button
											className="workflow-button danger"
											onClick={() => setConfirmRejectBooking(request)}
										>
											<IconX size={14} />
											Reject Request
										</button>
									</div>
								)}
							</article>
						);
					})}
				</div>

				{/* 1. Innovative Accept Request Confirmation Modal */}
				{confirmAcceptBooking && (
					<div
						className="modal-overlay"
						onClick={(e) => {
							if (e.target === e.currentTarget && !isProcessingAction) setConfirmAcceptBooking(null);
						}}
					>
						<div className="modal-card innovative">
							<button
								className="modal-close-btn"
								onClick={() => setConfirmAcceptBooking(null)}
								disabled={isProcessingAction}
								title="Close dialog"
							>
								<IconX size={16} />
							</button>

							<div className="modal-header-with-badge">
								<div className="modal-icon-badge success">
									<IconCheck size={22} />
								</div>
								<div className="modal-header-text">
									<h2>Approve Borrow Request</h2>
									<p>Booking #{confirmAcceptBooking.bookingId} • Rental Confirmation</p>
								</div>
							</div>

							<div className="modal-summary-box">
								<div className="modal-summary-row">
									<span className="modal-summary-label">Item</span>
									<span className="modal-summary-value">
										{confirmAcceptBooking.item?.itemName || `Item #${confirmAcceptBooking.itemId}`}
									</span>
								</div>
								<div className="modal-summary-row">
									<span className="modal-summary-label">Borrower</span>
									<span className="modal-summary-value">
										{confirmAcceptBooking.borrower?.name || "Verified Borrower"}
									</span>
								</div>
								<div className="modal-summary-row">
									<span className="modal-summary-label">Rental Duration</span>
									<span className="modal-summary-value">
										{new Date(confirmAcceptBooking.startTime).toLocaleDateString([], { month: "short", day: "numeric" })} — {new Date(confirmAcceptBooking.endTime).toLocaleDateString([], { month: "short", day: "numeric" })}
									</span>
								</div>
								<div className="modal-summary-row">
									<span className="modal-summary-label">Earnings</span>
									<span className="modal-summary-value" style={{ color: "#059669" }}>
										₹{confirmAcceptBooking.price || 0}
									</span>
								</div>
							</div>

							<div className="modal-innovation-callout">
								<div className="callout-icon">🛡️</div>
								<div className="callout-body">
									<h4 className="callout-title">Exclusive Booking Protection</h4>
									<p className="callout-desc">
										Accepting this request will <strong>automatically reject all other pending borrow requests</strong> for this item to ensure zero scheduling overlap.
									</p>
								</div>
							</div>

							<div className="modal-actions">
								<button
									type="button"
									className="workflow-button secondary"
									onClick={() => setConfirmAcceptBooking(null)}
									disabled={isProcessingAction}
								>
									Cancel
								</button>
								<button
									type="button"
									className="workflow-button success"
									onClick={() => reviewRequest(confirmAcceptBooking.bookingId, "APPROVED")}
									disabled={isProcessingAction}
								>
									<IconCheck size={14} />
									{isProcessingAction ? "Approving..." : "Confirm & Approve"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* 2. Innovative Decline Request Modal */}
				{confirmRejectBooking && (
					<div
						className="modal-overlay"
						onClick={(e) => {
							if (e.target === e.currentTarget && !isProcessingAction) setConfirmRejectBooking(null);
						}}
					>
						<div className="modal-card innovative">
							<button
								className="modal-close-btn"
								onClick={() => setConfirmRejectBooking(null)}
								disabled={isProcessingAction}
								title="Close dialog"
							>
								<IconX size={16} />
							</button>

							<div className="modal-header-with-badge">
								<div className="modal-icon-badge danger">
									<IconX size={22} />
								</div>
								<div className="modal-header-text">
									<h2>Decline Request?</h2>
									<p>Booking #{confirmRejectBooking.bookingId}</p>
								</div>
							</div>

							<p style={{ color: "#475569", fontSize: "14px", lineHeight: "1.5" }}>
								Are you sure you want to decline this borrow request from{" "}
								<strong>{confirmRejectBooking.borrower?.name || "the borrower"}</strong> for{" "}
								<strong>{confirmRejectBooking.item?.itemName || `Item #${confirmRejectBooking.itemId}`}</strong>?
							</p>

							<div className="modal-actions">
								<button
									type="button"
									className="workflow-button secondary"
									onClick={() => setConfirmRejectBooking(null)}
									disabled={isProcessingAction}
								>
									Keep Request
								</button>
								<button
									type="button"
									className="workflow-button danger-solid"
									onClick={() => reviewRequest(confirmRejectBooking.bookingId, "REJECTED")}
									disabled={isProcessingAction}
								>
									{isProcessingAction ? "Declining..." : "Decline Request"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* 3. Innovative Return Verification & Relist Modal */}
				{confirmReturnBooking && (
					<div
						className="modal-overlay"
						onClick={(e) => {
							if (e.target === e.currentTarget && !isProcessingAction) setConfirmReturnBooking(null);
						}}
					>
						<div className="modal-card innovative">
							<button
								className="modal-close-btn"
								onClick={() => setConfirmReturnBooking(null)}
								disabled={isProcessingAction}
								title="Close dialog"
							>
								<IconX size={16} />
							</button>

							<div className="modal-header-with-badge">
								<div className="modal-icon-badge primary">
									<IconPackage size={22} />
								</div>
								<div className="modal-header-text">
									<h2>Verify Return & Catalog Status</h2>
									<p>Booking #{confirmReturnBooking.bookingId} • Item Receipt</p>
								</div>
							</div>

							<p style={{ color: "#475569", fontSize: "13.5px", margin: "4px 0 14px" }}>
								The borrower has returned <strong>{confirmReturnBooking.item?.itemName || `Item #${confirmReturnBooking.itemId}`}</strong>. How would you like to handle this item in your catalog?
							</p>

							{/* Interactive Relist Selection Cards */}
							<div className="modal-selection-grid">
								<div
									className={`modal-selection-card ${returnRelistOption ? "selected" : ""}`}
									onClick={() => setReturnRelistOption(true)}
								>
									<div className="selection-card-header">
										<span className="selection-card-title">
											<IconRepeat size={14} /> Relist Item
										</span>
										<div className="selection-check-dot">
											{returnRelistOption && <IconCheck size={11} />}
										</div>
									</div>
									<p className="selection-card-desc">
										Item is in good condition and immediately available for new borrowers.
									</p>
								</div>

								<div
									className={`modal-selection-card ${!returnRelistOption ? "selected" : ""}`}
									onClick={() => setReturnRelistOption(false)}
								>
									<div className="selection-card-header">
										<span className="selection-card-title">
											<IconPackage size={14} /> Keep Unlisted
										</span>
										<div className="selection-check-dot">
											{!returnRelistOption && <IconCheck size={11} />}
										</div>
									</div>
									<p className="selection-card-desc">
										Mark returned, but keep hidden from search for inspection or personal use.
									</p>
								</div>
							</div>

							<div className="modal-actions">
								<button
									type="button"
									className="workflow-button secondary"
									onClick={() => setConfirmReturnBooking(null)}
									disabled={isProcessingAction}
								>
									Cancel
								</button>
								<button
									type="button"
									className="workflow-button success"
									onClick={() => handleConfirmReturn(confirmReturnBooking.bookingId, returnRelistOption)}
									disabled={isProcessingAction}
								>
									<IconCheck size={14} />
									{isProcessingAction ? "Verifying..." : "Confirm Return"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* 4. Innovative Damage Report Modal */}
				{damageModalBooking && (
					<div
						className="modal-overlay"
						onClick={(e) => {
							if (e.target === e.currentTarget && !isProcessingAction) setDamageModalBooking(null);
						}}
					>
						<div className="modal-card innovative">
							<button
								className="modal-close-btn"
								onClick={() => setDamageModalBooking(null)}
								disabled={isProcessingAction}
								title="Close dialog"
							>
								<IconX size={16} />
							</button>

							<div className="modal-header-with-badge">
								<div className="modal-icon-badge danger">
									<IconAlertTriangle size={22} />
								</div>
								<div className="modal-header-text">
									<h2>Report Item Damage</h2>
									<p>Booking #{damageModalBooking.bookingId} • Incident Report</p>
								</div>
							</div>

							<div className="form-group">
								<label>Incident Severity</label>
								<div className="quick-chips-row">
									{["Minor Scuff / Scratch", "Moderate Damage", "Severe / Missing Parts"].map((sev) => (
										<button
											key={sev}
											type="button"
											className={`quick-chip-btn ${damageSeverity === sev ? "active" : ""}`}
											onClick={() => setDamageSeverity(sev)}
										>
											{sev}
										</button>
									))}
								</div>
							</div>

							<div className="form-group">
								<label>Damage Description</label>
								<textarea
									value={damageDesc}
									onChange={(e) => setDamageDesc(e.target.value)}
									placeholder="Describe the condition, defects, or missing accessories..."
									rows={3}
								/>
							</div>

							<div className="form-group">
								<label>Estimated Repair / Compensation Cost (₹)</label>
								<input
									type="number"
									value={damageCost}
									onChange={(e) => setDamageCost(e.target.value)}
									placeholder="e.g. 500"
								/>
							</div>

							<div className="modal-actions">
								<button
									type="button"
									className="workflow-button secondary"
									onClick={() => setDamageModalBooking(null)}
									disabled={isProcessingAction}
								>
									Cancel
								</button>
								<button
									type="button"
									className="workflow-button danger-solid"
									onClick={handleDamageReport}
									disabled={isProcessingAction || !damageDesc.trim()}
								>
									{isProcessingAction ? "Submitting..." : "Submit Report"}
								</button>
							</div>
						</div>
					</div>
				)}

				{/* 5. Innovative Borrower Review Modal */}
				{reviewModalBooking && (
					<div
						className="modal-overlay"
						onClick={(e) => {
							if (e.target === e.currentTarget && !isProcessingAction) setReviewModalBooking(null);
						}}
					>
						<div className="modal-card innovative">
							<button
								className="modal-close-btn"
								onClick={() => setReviewModalBooking(null)}
								disabled={isProcessingAction}
								title="Close dialog"
							>
								<IconX size={16} />
							</button>

							<div className="modal-header-with-badge">
								<div className="modal-icon-badge warning">
									<IconStar size={22} filled={true} />
								</div>
								<div className="modal-header-text">
									<h2>Review Borrower</h2>
									<p>Rating for {reviewModalBooking.borrower?.name || "Borrower"}</p>
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
										{reviewRating === 5 && "5 / 5 — Exceptional Borrower! 🌟"}
										{reviewRating === 4 && "4 / 5 — Great Experience 👍"}
										{reviewRating === 3 && "3 / 5 — Average Rental"}
										{reviewRating === 2 && "2 / 5 — Had Issues"}
										{reviewRating === 1 && "1 / 5 — Poor Experience"}
									</span>
								</div>
							</div>

							<div className="form-group">
								<label>Quick Tags (Click to select)</label>
								<div className="quick-chips-row">
									{[
										"Punctual Return",
										"Well-Maintained Item",
										"Courteous & Friendly",
										"Quick Communication",
										"Responsible Borrower",
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
								<label>Comments & Experience Notes</label>
								<textarea
									value={reviewComment}
									onChange={(e) => setReviewComment(e.target.value)}
									placeholder="Share details about punctuality, item care, and communication..."
									rows={3}
								/>
							</div>

							<div className="modal-actions">
								<button
									type="button"
									className="workflow-button secondary"
									onClick={() => setReviewModalBooking(null)}
									disabled={isProcessingAction}
								>
									Cancel
								</button>
								<button
									type="button"
									className="workflow-button"
									onClick={handleReview}
									disabled={isProcessingAction}
								>
									{isProcessingAction ? "Submitting..." : "Submit Review"}
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

export default RentalRequestsPage;

