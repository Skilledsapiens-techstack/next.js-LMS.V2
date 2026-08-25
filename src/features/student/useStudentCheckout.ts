import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { apiInvokeFunction } from '../../lib/supabaseApi';

export type StudentCheckoutItemType = 'ats_package' | 'resource' | 'workshop' | 'recording';

export type StudentCheckoutRequest = {
  itemId: string;
  itemType: StudentCheckoutItemType;
};

export type StudentCheckoutResponse = {
  checkoutUrl?: string;
  id?: string;
  itemId?: string;
  itemTitle?: string;
  itemType?: string;
  orderId?: string;
  paymentLink?: string;
  razorpayPaymentLinkId?: string | null;
  status?: string;
};

export function useCreateStudentCheckout() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: StudentCheckoutRequest) =>
      apiInvokeFunction<StudentCheckoutResponse, StudentCheckoutRequest>('razorpay-checkout', {
        accessToken: accessToken ?? undefined,
        body
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-payment-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['student-resources'] });
      void queryClient.invalidateQueries({ queryKey: ['student-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['student-recordings'] });
      void queryClient.invalidateQueries({ queryKey: ['student-ats-resume-score'] });
    }
  });
}
