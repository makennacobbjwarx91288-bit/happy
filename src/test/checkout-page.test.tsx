import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Checkout from "@/pages/Checkout";
import { getDefaultThemeV2 } from "@/lib/theme-editor";

const navigateMock = vi.fn();
const updateLiveDataMock = vi.fn();
const setCartTotalMock = vi.fn();

let activeConfig: Record<string, unknown> | null = null;

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/context/CartContext", () => ({
  useCart: () => ({
    cart: [{ id: 1, name: "Test Product", price: 99, quantity: 1 }],
    totalPrice: 99,
  }),
}));

vi.mock("@/context/RealtimeContext", () => ({
  useRealtime: () => ({
    updateLiveData: updateLiveDataMock,
    setCartTotal: setCartTotalMock,
  }),
}));

vi.mock("@/context/ShopContext", () => ({
  useShop: () => ({
    config: activeConfig,
  }),
}));

vi.mock("@/components/Header", () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock("@/components/Footer", () => ({
  default: () => <div data-testid="footer" />,
}));

describe("Checkout page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const theme = getDefaultThemeV2();
    theme.pages.checkout.defaultCountry = "United States";
    activeConfig = {
      theme_editor_v2_enabled: true,
      layout_config_v2: theme,
    };
  });

  it("uses theme default country and updates when theme country changes", async () => {
    const { rerender } = render(<Checkout />);

    const countryInput = screen.getByLabelText("Country") as HTMLInputElement;
    expect(countryInput.value).toBe("United States");

    const nextTheme = getDefaultThemeV2();
    nextTheme.pages.checkout.defaultCountry = "Canada";
    activeConfig = {
      theme_editor_v2_enabled: true,
      layout_config_v2: nextTheme,
    };

    rerender(<Checkout />);

    await waitFor(() => {
      expect(countryInput.value).toBe("Canada");
    });
  });

  it("keeps original submit flow for checkout", () => {
    render(<Checkout />);

    fireEvent.change(screen.getByLabelText("First Name"), { target: { value: "Ada" } });
    fireEvent.change(screen.getByLabelText("Last Name"), { target: { value: "Lovelace" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "1234 Main St" } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "NYC" } });
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "NY" } });
    fireEvent.change(screen.getByLabelText("ZIP Code"), { target: { value: "10001" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "1234567890" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });

    const form = document.getElementById("checkout-form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);

    expect(updateLiveDataMock).toHaveBeenCalled();
    expect(setCartTotalMock).toHaveBeenCalledWith(99);
    expect(navigateMock).toHaveBeenCalledWith("/verify-coupon");
  });
});
