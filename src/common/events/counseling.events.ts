export enum CounselingEventType {
  BOOKING_REQUESTED = 'counseling.booking.requested',
  BOOKING_APPROVED = 'counseling.booking.approved',
  BOOKING_REJECTED = 'counseling.booking.rejected',
  BOOKING_CANCELLED = 'counseling.booking.cancelled',
  SESSION_COMPLETED = 'counseling.session.completed',
  PAYMENT_REQUESTED = 'counseling.payment.requested',
  PAYMENT_COMPLETED = 'counseling.payment.completed',
}

export interface CounselingBookingRequestedEvent {
  counselingId: number;
  userId: number;
  expertId: number;
  scheduleId: number;
  reason: string;
  requestedAt: Date;
}

export interface CounselingBookingApprovedEvent {
  counselingId: number;
  userId: number;
  expertId: number;
  scheduleId: number;
  appointmentDate: Date;
  approvedAt: Date;
}

export interface CounselingBookingRejectedEvent {
  counselingId: number;
  userId: number;
  expertId: number;
  scheduleId: number;
  rejectedAt: Date;
  reason?: string;
}

export interface CounselingBookingCancelledEvent {
  counselingId: number;
  userId: number;
  expertId: number;
  scheduleId: number;
  cancelledAt: Date;
  cancelledBy: 'user' | 'expert' | 'system';
}

export interface CounselingSessionCompletedEvent {
  counselingId: number;
  userId: number;
  expertId: number;
  completedAt: Date;
  sessionNotes?: string;
}

export interface CounselingPaymentRequestedEvent {
  counselingId: number;
  userId: number;
  expertId: number;
  amount: number;
  requestedAt: Date;
}

export interface CounselingPaymentCompletedEvent {
  counselingId: number;
  userId: number;
  expertId: number;
  amount: number;
  completedAt: Date;
}